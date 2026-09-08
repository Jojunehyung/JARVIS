# State lifecycle — storage, migration, daily tick
<!-- src: SPEC-6 -->

One JSON object holds everything, under one key, in the browser. It is loaded once at start-up, migrated forward through sequential version blocks, ticked for the new day, and written back on every change. The field reference, the `freshState` defaults and the migration ledger are generated from the source into [../generated/db-schema.md](../generated/db-schema.md) — this document covers the policy around them.

## Shape (v14)
```
{ v, profile, areas[], tasks[], goals[], act, metrics, exams, certBest, room, role, lastTick, dModel }
```
`areas` carry grade and 방향 (direction); `tasks` carry `goalId` (required for new tasks), difficulty, evidence and the milestone flags `isCert` / `isExam` / `isStudy`; `goals` carry `krs` of the four KR types; `exams` holds `best` / `dim` / `spec`; `room.trophies` is the achievement wall. Progress is never stored — it is derived by `krProgress`, `goalProgress`, `paceOf` and `roleGap` ([Rule 9](core-beliefs.md#rule-9)). The canonical field list lives in the `@schema` JSDoc block above `migrate` in the source, which is what the generator copies.

## Storage keys (frozen, [Rule 12](core-beliefs.md#rule-12))

| Key | Content | Written | Read | Deleted |
|---|---|---|---|---|
| `liferpg-state-v1` (`KEY`) | the whole state object | effect on every `state` change | boot | `resetAll` |
| `liferpg-img-profile` | profile photo data URL | `onFile` | boot | `clearImg`, `resetAll` |
| `liferpg-img-ev-{taskId}` | certificate / score-report / evidence photo | `EvidenceModal` submit | `EvidenceViewModal` | task delete, `resetAll` |
| `liferpg-img-study-{taskId}-{n}` | study output photos, n = 1…2 | `StudyVerifyModal` submit | `EvidenceViewModal` | task delete, `resetAll` |

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

Rules for changing this ([Rule 12](core-beliefs.md#rule-12)): add a new `if (s.v < N)` block, bump `v` in `freshState`, never edit an existing block, and never rename a storage key. Migration paths are covered by the E2E harness (`flow4.js` exercises a v10 save, a save with no `v`, and a v13 → v14 rename).

## `freshState(areas)` and `applyDailyTick(s)`
`freshState` builds a v14 state with the areas produced by onboarding, empty `tasks` / `goals` / `trophies`, `act` at streak 0 with 2 shields for the current month, `metrics` `{ asset: 10, infl: 5, body: 15 }`, an empty `exams` bundle stamped with `POINT_POLICY_VERSION`, `role: null`, `lastTick: dstr()` and `dModel: DIFF_RAW_VERSION`. It passes through `applyDailyTick` once. Callers: onboarding's `onStart` and `demoState`. Exact values: [../generated/db-schema.md](../generated/db-schema.md).

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
