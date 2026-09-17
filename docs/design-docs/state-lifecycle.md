# State lifecycle — storage, migration, daily tick
<!-- src: SPEC-6 -->

One JSON object holds everything, under one key, in the browser. It is loaded once at start-up, migrated forward through sequential version blocks, ticked for the new day, and written back on every change. The field reference, the `freshState` defaults and the migration ledger are generated from the source into [../generated/db-schema.md](../generated/db-schema.md) — this document covers the policy around them.

## Shape (v25)
```
{ v, profile, areas[], tasks[], goals[], events[], folio[], rates[], deals[], meetingProjects[], meetings[], work[], journal[], reviews[], act, exams, certBest, room, role, ui, lastTick, dModel }
```
`profile` (schema v21) carries the exact CV: `name`, `birth` (`YYYY-MM-DD`), optional `email` / `phone`, and the two record arrays `edus[]` (school, major, `MAJOR_FIELDS` field, `EDU_OPTS`-keyed degree, status, dates) and `careers[]` (company, role, employment kind, dates) the profile screen edits directly. Alongside them, `edu` (`EDU_OPTS` key) and `career` (`CAREER_OPTS` key) are snapshot inputs of the one-time starting-grade computation run once at `Onboarding.start()` — never recomputed from `edus[]` / `careers[]` afterwards, so editing the CV later cannot move an area grade ([Rule 4](core-beliefs.md#rule-4), [Rule 11](core-beliefs.md#rule-11)). Legacy fields `age`, `majorField`, `majorName` survive untouched on saves that predate v21 and are read only as fallbacks (`ageText`'s band guard). `areas` carry grade and 방향 (direction); `tasks` carry `goalId` (required for new tasks), difficulty, evidence, the milestone flags `isCert` / `isExam` / `isStudy`, and — for an exam milestone completed from v22 on — an optional `score` (the score report's own value, display only, [scoring-engine.md](scoring-engine.md)); `goals` carry `krs` of the four KR types; `exams` holds `best` (each entry optionally carrying the same display-only `score`) / `dim` / `spec`; `room.trophies` is the achievement wall; `journal[]` holds one free-text entry per date plus the assistant reply pasted back that day, and `reviews[]` one entry per week; `events[]` holds the schedule records (`약속` / `마감`) with an optional time and repeat rule, which are never tasks and never paid ([../product-specs/schedule.md](../product-specs/schedule.md)); `folio[]` / `rates[]` / `deals[]` hold the business records — a portfolio piece, a unit price, and a period contract stored as a billing rule plus the user's own `paidMonths` stamps — which are likewise never tasks and never paid directly ([../product-specs/business.md](../product-specs/business.md)); `meetingProjects[]` / `meetings[]` (schema v23) hold hand-written meeting minutes grouped by project — records with a date, an optional link to an `일정` event and (schema v24) `taskIds`, the ids of up to 10 existing tasks they refer to, never a task, never paid, never read by the briefing or the daily assistant packet — but read, unless flagged `aiHidden` (schema v25), by the second (`오늘 업무 만들기`) packet ([../product-specs/meetings.md](../product-specs/meetings.md)); `meetings[]` also carries (schema v25) `progress[]`, dated entries of the work that followed, and `aiHidden`, a boolean excluding the meeting's body from that packet; `work[]` (schema v25) holds daily work items — dated records typed by hand or proposed by the assistant and confirmed per item, outside the goal ladder entirely: no payout, trophy, goal, KR or streak ([Rule 1](core-beliefs.md#rule-1), [Rule 7](core-beliefs.md#rule-7), [Rule 9](core-beliefs.md#rule-9), [Rule 18](core-beliefs.md#rule-18)) — see [../product-specs/daily-work.md](../product-specs/daily-work.md); `ui` holds screen preferences only — `bizView` (`"deals"` | `"rates"` | `"folio"`, the view the 사업 tab opens on) — while the month shown, the selected day, and any component-local list state stay outside the save. `ui.scheduleView` (the view the 일정 tab opened on, `"list"` or `"calendar"`) is retired: nothing has read it since the schedule tab became calendar-only (2026-09-16), and the v22 block drops it from the save. Progress is never stored — it is derived by `krProgress`, `goalProgress`, `paceOf` and `roleGap` ([Rule 9](core-beliefs.md#rule-9)); the same holds for every business total (`bizSummary` and its helpers) and for the meetings tab's storage-use line (`storageUsedWith`). The canonical field list lives in the `@schema` JSDoc block above `migrate` in the source, which is what the generator copies.

## Storage keys (frozen, [Rule 12](core-beliefs.md#rule-12))

| Key | Content | Written | Read | Deleted |
|---|---|---|---|---|
| `liferpg-state-v1` (`KEY`) | the whole state object | effect on every `state` change | boot | `resetAll` |
| `liferpg-img-profile` | profile photo data URL | `onFile` | boot | `clearImg`, `resetAll` |
| `liferpg-img-ev-{taskId}` | certificate / score-report / evidence photo | `EvidenceModal` submit | `EvidenceViewModal` | task delete, `resetAll` |
| `liferpg-img-study-{taskId}-{n}` | study output photos, n = 1…2 | `StudyVerifyModal` submit | `EvidenceViewModal` | task delete, `resetAll` |
| `liferpg-img-folio-{id}` | portfolio representative image | `FolioModal` submit, only when the image changed | `포트폴리오` view (`FolioView`), `FolioModal` on edit | portfolio entry delete, `resetAll` |

The `liferpg-` prefix is a historical name kept for data compatibility; renaming it would orphan every existing save.

### The `store` adapter
```js
const mem = {};
store.get(k)  // localStorage.getItem + JSON.parse; falls back to mem[k] ?? null, never throws
store.set(k, v) // always writes mem[k], then localStorage.setItem + JSON.stringify inside try/catch
store.del(k)  // deletes mem[k], then localStorage.removeItem inside try/catch
```
All three are `async`, so call sites can stay unchanged if the backing store is ever swapped for an asynchronous one (that was the point of the 2026-09-03 shim). Every read adds `.catch(() => null)`; image writes are fired without `await`. A browser that refuses storage (private mode, disabled site data) degrades to the in-memory object for the session rather than failing.

## Boot sequence
```js
saved = await store.get(KEY)          // null when absent or unreadable
m     = saved ? migrate(saved) : null
m ? (setState(applyDailyTick(m)), setPhase("main")) : setPhase("onboard")
readyRef.current = true               // only now may the persist effect write
profile photo = await store.get("liferpg-img-profile")
```
The `readyRef` guard exists so the persist effect cannot overwrite a real save with the empty initial state during the first render pass.

## `migrate(s)` — policy and ledger
`migrate` returns `null` for a missing or non-object save, which sends the app to onboarding. A save whose `v` is not a number is normalised to `v: 0` first, so pre-versioning saves run through every block instead of silently skipping them.

| Block | Converts |
|---|---|
| `v < 11` | one-shot conversion of the game-era saves: copies `profile` minus `persona`; whitelists areas to `{ id, name, grade, dir, achievements }`; strips `bossHp` from tasks; rebuilds `act`, `metrics` (from the old `story`), `exams`, `certBest`, `room`, `role`, `lastTick`, `dModel` |
| `v < 12` | drops `metrics.risk` (risk) and introduces `metrics.body` (appearance) at a fixed 15 — the meaning is inverted, so the value is reset rather than carried; `asset` and `infl` pass through `statClamp` |
| `v < 13` | trophy `kind: "boss"` (the old boss-defeat effect) becomes `"ach"`; values and display unchanged |
| `v < 14` | terminology rename: `quests` → `tasks`, `parts` → `areas`, `partId` → `areaId` on tasks and goals; the old keys are deleted. Storage keys stay as they are |
| `v < 15` | daily assistant: adds `journal[]` and `reviews[]` (empty), and the `act` stamps `lastCheckin` / `briefingSeen` / `lastReview` (null). Existing tasks gain no `due`; nothing derived is stored |
| `v < 16` | schedule: adds `events[]` (empty). Every other field passes through untouched, and no occurrence list is written — the repeat rule plus the user's `skip` / `doneDates` stamps are all that is stored |
| `v < 17` | schedule view: adds `ui.scheduleView`, `"calendar"` only when the save already carried that value, otherwise `"list"`. A preference, not derived data — no month index, no selected day and no occurrence list is written, and `events[]` is untouched |
| `v < 18` | the `meet` activity kind is gone — a meeting belongs to the `일정` tab, not to a goal. Maps `tasks`: a task whose `kind === "meet"` loses the `kind` property and keeps every other field (title, difficulty, points, completion dates, evidence); an unknown kind is left alone. Nothing the user recorded is removed |
| `v < 19` | life metrics are gone (user decision 2026-09-11): drops `metrics` entirely and `lastCheckin` from `act`. Every other `act` stamp (`streak`, `lastActive`, `shieldMonth`, `shieldsLeft`, `briefingSeen`, `lastReview`) and every other field passes through untouched — what the triple claimed to measure now belongs to a goal's metric KR ([Rule 8](core-beliefs.md#rule-8)) |
| `v < 20` | business records: adds empty `folio[]` / `rates[]` / `deals[]` and `ui.bizView` (kept when the save already carried `"rates"` or `"folio"`, otherwise `"deals"`). A contract is a billing rule (`startMonth`, `months`, `monthly`) plus the user's own `paidMonths` stamps; nothing here pays P, creates a trophy, moves a goal or touches the streak, and every month/total/margin stays derived at render |
| `v < 21` | the CV: adds `name`, `birth`, `email`, `phone` (empty/`null` fallbacks) and the two empty record arrays `profile.edus` / `profile.careers`. Nothing is removed — `age`, `edu`, `career`, `majorField` and `majorName` stay exactly as the old save wrote them, because `edu` / `career` are the frozen one-time inputs of the starting-grade computation and must never be recomputed ([Rule 4](core-beliefs.md#rule-4), [Rule 11](core-beliefs.md#rule-11)), and the age band is the only age fact an old save has until the user enters a birth date. `profile` stays `null` on a save that never finished onboarding — materialising an object here would trap a half-onboarded save in the main app with no profile data, since the root routes on `!state?.profile` |
| `v < 22` | (2026-09-16) exam scores: nothing is backfilled — a save from before v22 simply has no `tasks[].score` / `exams.best[famId].score` and shows its band label instead. The only conversion this block performs is dropping the retired `ui.scheduleView` key (unread since the schedule tab became calendar-only) via object destructuring; `ui.bizView` is kept exactly as it was. Payout, grade and D stay band-based — nothing here touches `p`, `d`, `label` or `ver` ([Rule 1](core-beliefs.md#rule-1), [Rule 2](core-beliefs.md#rule-2), [Rule 6](core-beliefs.md#rule-6)) |
| `v < 23` | (2026-09-16) meeting minutes: adds empty `meetingProjects[]` / `meetings[]`. A record, never a task — no payout, trophy, goal or streak field is added anywhere else ([Rule 1](core-beliefs.md#rule-1), [Rule 18](core-beliefs.md#rule-18)) |
| `v < 24` | (2026-09-16) meeting task links: maps `meetings` and gives every record `taskIds: []` (an array already present is kept). Every other meeting field and every other key passes through untouched; no task is changed. A link is a reference only — no payout, completion, goal or streak effect — and the task sheet's reverse list is derived at render ([Rule 1](core-beliefs.md#rule-1), [Rule 9](core-beliefs.md#rule-9), [Rule 18](core-beliefs.md#rule-18)) |
| `v < 25` | (2026-09-17) daily work items: adds empty `work[]` and maps `meetings`, giving every record `progress: []` (an array already present is kept) and `aiHidden: false` (unless already `true`). A work item is a record, never a task — no payout, trophy, goal, KR or streak field is added anywhere else ([Rule 1](core-beliefs.md#rule-1), [Rule 7](core-beliefs.md#rule-7), [Rule 9](core-beliefs.md#rule-9), [Rule 18](core-beliefs.md#rule-18)); every existing field and key passes through untouched |

Why a block exists for v22 even though nothing is backfilled: the repo convention since v15 is that every new persisted field gets a block and a `v` bump, so `@schema`, this document and the `flow4.js` fixtures can all name the version that introduced a field, and a backup from a newer app build can never be mistaken for an older shape.

Rules for changing this ([Rule 12](core-beliefs.md#rule-12)): add a new `if (s.v < N)` block, bump `v` in `freshState`, never edit an existing block, and never rename a storage key. Migration paths are covered by the E2E harness (`tools/e2e/flow4.js` exercises a v10 save, a save with no `v`, a v13 → v14 rename, a v14 → v15 upgrade, a v15 → v16 upgrade, a v16 → v17 upgrade, a v17 → v18 upgrade that converts a saved `meet` task, a v18 → v19 upgrade that drops the life-metric store and check-in stamp while every other `act` stamp and record survives, a v19 → v20 upgrade that adds the three empty business arrays and defaults `ui.bizView` to `"deals"` while leaving `ui.scheduleView` and every other record untouched, a v20 → v21 upgrade — `v20 save → v21 CV records` — that adds the two empty CV arrays and the three contact/name fields while every legacy profile field, area, task, event, folio entry, journal entry, review and act stamp survives untouched, plus a second fixture proving a `profile: null` save still migrates to `profile === null`; the steps for v22 and v23 were updated in the same change that introduced these two blocks, the `v23 save → v24 meeting task links` step in the change that introduced v24, and `v24 save → v25 work items and meeting progress` in the change that introduced v25 — adding empty `work: []` and backfilling `progress: []`/`aiHidden: false` on a planted meeting that carries a task link, with every other field and key unchanged; per the standing user instruction covering the v22–v25 changes, none of these steps has been run since it was written, so their green status is unverified rather than confirmed).

## `freshState(areas)` and `applyDailyTick(s)`
`freshState` builds a v25 state with the areas produced by onboarding, empty `tasks` / `goals` / `events` / `folio` / `rates` / `deals` / `meetingProjects` / `meetings` / `work` / `journal` / `reviews` / `trophies`, `act` at streak 0 with 2 shields for the current month and the two remaining date stamps (`briefingSeen`, `lastReview`) null, an empty `exams` bundle stamped with `POINT_POLICY_VERSION`, `role: null`, `ui: { bizView: "deals" }`, `lastTick: dstr()` and `dModel: DIFF_RAW_VERSION`. It passes through `applyDailyTick` once. Callers: onboarding's `onStart` and `demoState`. Exact values: [../generated/db-schema.md](../generated/db-schema.md).

`applyDailyTick` refills 보호권 (streak shields) when the month changed (`shieldMonth !== monthStr()` → `shieldsLeft = 2`) and stamps `lastTick`. It runs at boot, on the migrated state.

## Date and id utilities
```js
uid()             = Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-3)  // 10 chars, not sortable
dstr(d = new Date()) = local "YYYY-MM-DD"
shiftDay(base, delta) = dstr(new Date(base + "T12:00:00") + delta days)   // noon anchor avoids DST edges
monthStr()        = dstr().slice(0, 7)
statClamp(v)      = Math.max(0, Math.min(100, Math.round(v)))
```
`today = dstr()` is computed during render in the app root, so a session left open past midnight keeps completing tasks against the previous day until it re-renders.
