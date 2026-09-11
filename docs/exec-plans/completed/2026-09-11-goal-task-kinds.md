# Goal tasks: certifications, study and fitness only

- Status: completed
- Date: 2026-09-11
- Needs approval: yes — **already granted** by the user on 2026-09-11. The plan bumps the schema (new `if (s.v < 18)` block, [Rule 12](../../design-docs/core-beliefs.md#rule-12)) and amends the text of [Rule 17](../../design-docs/core-beliefs.md#rule-17) and [Rule 19](../../design-docs/core-beliefs.md#rule-19). No user data is deleted; no `CERTS`/`EXAMS`/`WEIGHT_MATRIX`/`CERT_W_EXC` row and no `liferpg-*` key is touched. Do not re-ask.
- Agents: planner → implementer → cleanup → verifier → docs-syncer

## Goal

The user's request, verbatim: `목표 안에는 자격증이랑 기본공부 운동만 하게해줘 / 그냥 미팅같은 일정은 일정부분이랑 너무 겹쳐`. Appointment-shaped work duplicates the `일정` tab that shipped today, so a goal may no longer be the place where meetings live. After this change the only things creatable under a goal are: certification milestone · exam milestone · `학습` (study) · `📚 독서` · `💪 운동` · a task that fills a `횟수` (count) `핵심결과`. The `meet` activity kind disappears from the product, and a normal task can no longer be registered without an activity kind. Everything else belongs in the `일정` tab.

Two decisions are settled and must not be re-litigated:

1. Both the `meet` kind **and** the free-form kind-less normal task are removed from creation under a goal. The consequence was shown to the user (a plain task such as `이력서 초안 작성` can no longer be created) and accepted.
2. Saved `meet` tasks are **converted**, not deleted: a v18 migration drops `kind` and keeps title, difficulty, points, `doneDates`/`doneAt` and the stored minutes `evidence`.

One carve-out resolves a contradiction found after those answers: `fillCount` prefills the normal form from a count KR and sets `kind = detectKind(kr.title)`, which is usually `""`. A goal could therefore define `설계 실습 10회` and then be unable to create the task that fills it. **A task created through the count-KR bridge stays creatable without an activity kind** — a count KR is the goal's own measured action, not an appointment. The carve-out is tracked by component state in `AddTaskModal` only (never persisted), and applies to no other path.

## Context read

Source — `src/LifeManager.jsx` (line numbers as of `87681ba`; the implementer re-greps before editing):

| Region | Lines | What changes |
|---|---|---|
| `TASK_TEMPLATES` | 1095–1100 | rows `업무 회고 작성` (kind `""`) and `거래처 미팅` (kind `meet`) removed; `아침 운동 30분` and `독서 30분` stay |
| `detectKind` | 1101–1106 | `/미팅|회의|거래처/ → "meet"` branch removed |
| `goalKinds` | 1108–1126 | `new Set([""])` seed and the `/영업|매출|거래처|고객|세일즈|계약/ → meet` line removed |
| assistant packet template | 2307 | `"kind":"book|fit|meet"` → `"book|fit"` |
| `KIND_LABEL` | 2157 | `meet` entry removed (briefing activity-gap lines 2244–2251 read it; no other change there) |
| `parseAssistantReply` | 2366–2379 | kind whitelist `["book","fit","meet"]` → `["book","fit"]`; new reject for a proposal with no kind |
| `@schema` JSDoc | 2384–2418 | `v17`→`v18`, `v: 17`→`v: 18`, `kind?("book"\|"fit"\|"meet")` → `kind?("book"\|"fit")` |
| `migrate` | 2419–2476 | **new** `if (s.v < 18)` block appended after the v17 block (2471–2474) |
| `freshState` | 2485–2503 | `v: 17` → `v: 18` |
| `demoState` | 2505–2560 | no task carries `kind: "meet"` — nothing to change (see "Docs to sync") |
| task row prefixes | 3099, 3855 | `q.kind === "meet" ? "🤝 " : ""` arm removed from both ternaries |
| `AddTaskModal` | 3942–4130 | `krId` state, `fillCount`, `submitNormal` gate + copy, template chips, kind chip row, hints |
| `ActivityLogModal` | 4215–4315 | whole meeting shape removed, `onSpawn` prop removed |
| `spawnTask` / wiring | 5209–5214, 5718 | removed (the meeting modal is the only caller — verified by grep) |
| `tryComplete` | 5228–5231 | unchanged: `q.kind && !q.evidence` keeps working because v18 removes `kind` from legacy meeting tasks |
| activity log icon | 5337 | `q.kind === "book" ? "📚" : q.kind === "fit" ? "💪" : "🤝"` → two-way |

E2E — `tools/e2e/run.js` (`addKindTask` 216–224, `logActivity` 237–247, `typeInto` replaces the field contents), `flow.js` 73–81 (`register daily task`, currently types a kind-less title without touching the bridge), `flow2.js` 82–90 (reading activity — unaffected: the `독서` chip is in `gk.kinds` for that goal), `flow3.js` 37–57 (exercise activity — unaffected, `detectKind("웨이트 40분") = fit`; meeting steps 47–57 — removed), `flow4.js` 164–181 (latest migration fixture, the pattern to copy), `flow5.js` 125–172 (assistant paste fixture — both imported proposals are kind-less today). Flow order: `flow.js` → flow2 → flow3 → flow5 → flow7 → flow4 → flow6; 114 steps as of 2026-09-11.

Rules touched: [Rule 17](../../design-docs/core-beliefs.md#rule-17) (kind list and the meeting clause), [Rule 19](../../design-docs/core-beliefs.md#rule-19) (`goalKinds` scoping becomes a hard gate), [Rule 12](../../design-docs/core-beliefs.md#rule-12) (new migration block, keys frozen), [Rule 7](../../design-docs/core-beliefs.md#rule-7) amendment (the assistant proposes through the same gate), [Rule 9](../../design-docs/core-beliefs.md#rule-9) (the carve-out must not store anything derived), [Rule 13](../../design-docs/core-beliefs.md#rule-13) (refusal copy states facts and where the item belongs), [Rule 18](../../design-docs/core-beliefs.md#rule-18) (goal-first, unchanged — quote it in the refusal, do not edit its text), [Rule 16](../../design-docs/core-beliefs.md#rule-16) (study tiers untouched), [Rule 10](../../design-docs/core-beliefs.md#rule-10) (evidence gate untouched — activity kinds cap at C so `pts < 150`).

Conventions: `docs/FRONTEND.md` (clone pattern, Tailwind v3 core utilities only, Korean `해요체` UI copy with English identifiers/comments, a copy change is an E2E change, schema change = block + `v` bump + `@schema` + `flow4.js` fixture). Specs: `docs/product-specs/tasks.md` (23–43), `docs/product-specs/evidence-modals.md` (35–51), `docs/design-docs/goal-engine.md` (47–66), `docs/design-docs/assistant-bridge.md` (80), `docs/design-docs/information-architecture.md` (16, 29).

## Prompt

> Execute `docs/exec-plans/active/2026-09-11-goal-task-kinds.md`. Work in `src/LifeManager.jsx` and `tools/e2e/*.js` only; documentation is the docs-syncer's phase D. English identifiers, comments and commit messages; Korean only inside UI strings. Tailwind v3 core utilities only. Never touch `CERTS`/`EXAMS`/`WEIGHT_MATRIX`/`CERT_W_EXC`, the `store` call sites, the `liferpg-*` keys, or any existing `if (s.v < N)` block.
>
> **Goal.** Under a goal only these can be created: certification milestone, exam milestone, `학습` (study), `📚 독서`, `💪 운동`, and a task that fills a `횟수` `핵심결과` (count KR). Remove the `meet` activity kind from the product and require an activity kind for every other normal task. Convert saved `meet` tasks instead of deleting them.
>
> **Phase A — schema v18 (migration first, so later phases never see a stored `meet`).**
> 1. Append a new block after the v17 block in `migrate`: `if (s.v < 18)` sets `v: 18` and maps `tasks` so that a task with `kind === "meet"` loses its `kind` property and keeps every other field (`title`, `diff`, `pts`, `type`, `status`, `doneDates`, `doneAt`, `evidence`, `goalId`, `areaId`, `due`, `createdAt`). Only `"meet"` is touched — an unknown kind is left alone. One English comment line stating why (a meeting belongs to the `일정` tab; nothing the user recorded is removed).
> 2. `freshState`: `v: 17` → `v: 18`. `@schema` JSDoc header: `@schema v17` → `v18`, the `v: 17` field line → `v: 18`, and `kind?("book"|"fit"|"meet")` → `kind?("book"|"fit")`.
> 3. `tools/e2e/flow4.js`: add one step `v17 save → v18 meeting task converted` after the existing `v16 save → v17 schedule view` step, built with `migrateFixture` in the same shape as its neighbours. The fixture is a `v: 17` save carrying `ui: { scheduleView: "calendar" }` and a task `{ id: "tm", title: "거래처 미팅", areaId: "av", kind: "meet", diff: "D", type: "once", status: "done", doneAt: "2026-01-02", doneDates: [], evidence: "회의록 · ○○상사 김과장 — 안건: 사양 협의" }`. Assert: the task still exists, `kind` is `undefined`, `title` / `diff` / `status` / `doneAt` / `evidence` are unchanged, and `ui.scheduleView` is still `"calendar"` (the new block must not rewrite v17 fields).
>
> **Phase B — the creation gate.**
> 4. `TASK_TEMPLATES`: delete the `업무 회고 작성` and `거래처 미팅` rows. (`data-guard` does not match these rows, so no `HARNESS_DATA_EDIT` is needed; `finish.config.json` counts do not cover templates.)
> 5. `detectKind`: delete the `/미팅|회의|거래처/` branch. `goalKinds`: seed with an empty `Set` and delete the `/영업|매출|거래처|고객|세일즈|계약/` line. Keep the returned `{ kinds, study }` shape — `kinds` still scopes the template chips and the kind chip row, so it is not dead.
> 6. `AddTaskModal`:
>    - Add `const [krId, setKrId] = useState(null)`. `fillCount(kr)` also calls `setKrId(kr.id)`; the study-mode toggle button (which already clears the title) also calls `setKrId(null)`. **Never put `krId` on the task passed to `onAdd`** — it is form state only ([Rule 9](../../design-docs/core-beliefs.md#rule-9)).
>    - `submitNormal`: keep the empty-title check and the `dk`/`kind` conflict check (its `nm` map loses the meeting entry, wording unchanged). Then, before `onAdd`, compute `ek = kind || dk` and refuse when `!ek && !krId` with exactly: `활동 유형을 골라 주세요 — 📚 독서·💪 운동만 목표에 등록돼요. 공부는 '학습', 자격·시험은 핵심결과, 약속·미팅은 일정 탭에서 만들어요.` When `krId` is set and `ek` is empty, submit as today (no `kind` key in the payload).
>    - Kind chip row: drop the `gk.kinds.size > 1` gate and render the row whenever `mode === "normal"`. Entries are `[["book", "📚 독서"], ["fit", "💪 운동"]]` filtered by `gk.kinds`; when the filtered list is **empty**, fall back to both entries so a goal that matches no keyword (a revenue goal with only a metric KR, for example) is never a dead end — add a one-line English comment saying so. The `["", "기타"]` entry is gone.
>    - Chips toggle: clicking the selected chip clears the selection (`setKind(kind === k ? "" : k)`), otherwise a mis-click can never be undone now that `기타` is gone.
>    - Row label: `활동 유형 (필수) — 독서·운동만 목표에 등록돼요`, replaced by `활동 유형 (선택) — 횟수 핵심결과를 채우는 실행이에요` while `krId` is set.
>    - Hint text under a selected chip: keep the `book` and `fit` sentences verbatim, delete the meeting sentence (the current ternary's else branch).
> 7. Assistant bridge (same gate, one rule): the packet template string becomes `"kind":"book|fit"`; `parseAssistantReply`'s whitelist becomes `["book","fit"]`; after the existing cert/exam and duplicate rejects add `else if (!kind) reject = "활동 유형 없는 실행은 일정 탭에서 관리해요";`. Nothing else in the bridge changes — it still only *proposes*.
> 8. E2E for phase B:
>    - `flow.js`, step `register daily task`: click `채우기 ›` inside the modal first (the count KR `설계 실습`), then `typeInto("무엇을 하나요", "설계 실습 1시간")` as today (it selects-all before typing), then register. Assert `modalError()` is empty, so the carve-out is proven, not assumed. Step name and count unchanged.
>    - `flow3.js`: delete the steps `register meeting activity task` and `meeting minutes + action item follow-up` and the `await shot("meet-done")` line. Add one step in their place, `kind-less task under a goal is refused`: `openTaskModalFor("하네스")`, type `이력서 초안 작성` into `무엇을 하나요`, click `등록`, require `modalError()` to contain `활동 유형`, read the state and require no task with that title, then `closeModal()`. Do **not** route it through `addKindTask` — that helper pushes a rejection into `errors`.
>    - `flow5.js`, steps `pasted reply is validated before import` and `confirmed proposals become tasks; cert proposal is refused`: the fixture's two importable proposals must now carry a detectable kind — use `기술 서적 30분 독서` (book) for the goal-matched one and `아침 러닝 30분` (fit) for the `없는 목표` goal-picker one, updating both steps' title assertions. Keep `전기기사 취득` and its reject assertion. Add a fourth proposal `도면 기호 복습` under `하네스 설계 엔지니어 취업` and assert the screen shows `활동 유형 없는 실행은` and that the state never gains that title. Step names and count unchanged.
>
> **Phase C — remove the now-unreachable meeting surfaces.**
> 9. `KIND_LABEL`: drop the `meet` entry. Task row prefixes at 3099 and 3855: drop the `🤝` arm. Activity log icon at 5337: `q.kind === "book" ? "📚" : "💪"`.
> 10. `ActivityLogModal`: delete the `withWho` / `agenda` / `decision` / `actions` / `spawned` state, `actionList`, `doSpawn`, the `onSpawn` prop, the `k === "meet"` JSX block and the meeting arms of the `submit` branch and the modal title. `submit` becomes `if (k === "book") … else …` (fitness). Update the region banner comment (`reading, exercise, meetings` → reading and exercise).
> 11. Delete `spawnTask` and the `onSpawn={(t) => spawnTask(t, modal.task)}` prop at the `ActivityLogModal` call site. Grep first to confirm there is no other caller.
>
> **Acceptance criteria (observable).**
> - Opening `실행 추가` from any goal shows the mode toggle, the KR bridge rows, and a kind chip row with at most `📚 독서` and `💪 운동`; `기타` and `🤝 미팅` appear nowhere in the app.
> - Registering a normal task with no chip selected and a title that `detectKind` does not classify shows the refusal string above and creates nothing.
> - Clicking `채우기 ›` on a count KR and registering (any title, no kind) creates a task with no `kind`, and the KR count advances on completion.
> - A title containing the word `미팅` is now unclassified: it is refused with the same message, which names the `일정` tab.
> - A v17 save holding a `kind: "meet"` task loads as v18 with the task intact and no `kind`; opening it completes in one tap and never opens `ActivityLogModal`.
> - A pasted assistant reply proposing a kind-less task shows `활동 유형 없는 실행은 일정 탭에서 관리해요` and cannot be selected.
> - `npm run verify`: 114 steps, 0 failed, 0 console errors.
>
> **Verification per phase.** `npm run verify` (0 failed steps, 0 console errors) and `npm run finish` exit 0 at every phase gate; `npm run verify -- --smoke` at the phase B gate because `TASK_TEMPLATES` is a registered data region (smoke does not cover `migrate` or kinds, so it is a regression guard only). Do not start the next phase on a red gate.
>
> **Finish protocol.** cleanup (`npm run finish` exit 0; any intentional finding goes to `tools/harness/finish-allowlist.json` with a reason and is mirrored in `docs/exec-plans/tech-debt-tracker.md`) → verifier (`npm run verify`) → docs-syncer (phase D below, `npm run docs:gen && npm run docs:check`, move this plan to `docs/exec-plans/completed/`). Report what changed, the commands and their results, and the proposed commit message; commit only at a user-approved gate.

## Steps

1. **Phase A — schema v18.** Migration block, `freshState`, `@schema`, `flow4.js` fixture step. Gate: `npm run verify` (115 steps at this point: 114 + the new migration step), `npm run finish` exit 0.
2. **Phase B — creation gate.** `TASK_TEMPLATES`, `detectKind`, `goalKinds`, `AddTaskModal` (`krId`, chip row, copy, `submitNormal`), assistant packet + `parseAssistantReply` reject; `flow.js`, `flow3.js`, `flow5.js`. Gate: `npm run verify -- --smoke` (114 steps: 115 − 2 + 1), `npm run finish` exit 0.
3. **Phase C — dead-surface removal.** `KIND_LABEL`, the two row prefixes, the log icon, the meeting half of `ActivityLogModal`, `spawnTask` and its wiring. Gate: `npm run verify` (114 steps), `npm run finish` exit 0 — this is the phase where an orphaned symbol would show up.
4. **Phase D — docs (docs-syncer).** The list below, then `npm run docs:gen && npm run docs:check`, then move this plan to `completed/` and link it from the decision log.

## Verification

- Per phase: `npm run verify` — required result **0 failed steps, 0 console errors**; the final count is **114 steps** (114 − 2 removed meeting steps + 1 refusal step + 1 migration step).
- `npm run verify -- --smoke` once, at the phase B gate (`TASK_TEMPLATES` is a data region). Not needed elsewhere: no scoring engine, D/P table or matrix change.
- `npm run finish` exit 0 at every phase gate.
- `npm run docs:gen && npm run docs:check` at phase D (regenerates `docs/generated/onboarding-tables.md`, whose row `| "거래처 미팅" | "meet" | "D" | "once" |` and the `TASK_TEMPLATES` line ranges in `symbol-index.md` change by themselves — never hand-edit either).
- Manual, once, in `npm run dev` with the demo state: open `실행 추가` from `체력 기반 만들기` (kinds = fit only) and confirm the chip row renders; open it from `서류 어학 컷 넘기기` (kinds = book) and confirm `채우기 ›` on `영어 스터디 참석` still registers.

## Cleanup checklist

- [ ] `npm run finish` exit 0 (unused symbols/imports, duplicates, residue, language)
- [ ] `spawnTask`, `onSpawn`, `doSpawn`, `actionList` and the meeting-only `useState` calls are gone, not merely unreferenced
- [ ] no `meet` / `🤝` / `기타` / `거래처` / `회의록` string survives in `src/LifeManager.jsx` except inside the v18 migration comment and the `q.kind === "meet"` comparison in that block
- [ ] `krId` is form state only — grep the payload of `onAdd` to confirm it is not persisted
- [ ] allowlist additions (with reason) mirrored in `docs/exec-plans/tech-debt-tracker.md`

## Docs to sync

| File | Change |
|---|---|
| `docs/design-docs/core-beliefs.md` | **Rule 17**: kinds become `book / fit`; delete the meeting clause and the `spawnTask` sentence; keep the fitness-measure, `detectKind`-mismatch and difficulty-C sentences. **Rule 19**: add that a normal task now requires an activity kind, with the count-KR carve-out named explicitly. Heading count stays **19**; no rule is renumbered or removed; Rule 18's text is not edited. |
| `docs/design-docs/decision-log.md` | One row dated 2026-09-11: the scope decision, the two settled answers, the carve-out, schema v18, rules 17/19 amended; link this plan in `completed/`. |
| `docs/design-docs/state-lifecycle.md` | Shape heading `(v17)` → `(v18)`, the v18 block in the migration list, the `freshState` paragraph, and the `flow4.js` coverage sentence. |
| `docs/product-specs/tasks.md` | Lines 17, 23, 30, 39, 41, 43: template chip list, the kind chip row (label copy, both variants, no `기타`), the `fillCount` row (now also sets the carve-out), the new refusal string, and the removed `🤝 ` prefix. |
| `docs/product-specs/evidence-modals.md` | Delete the meeting section (35–51) and the meeting row of the routing table; the `tryComplete` list keeps `kind && !evidence`. |
| `docs/design-docs/evidence-and-promotion.md` | Lines 15, 47–54: kind list, the meeting row, the `spawnTask` sentence, and the `🤝` in the log-line format. |
| `docs/design-docs/goal-engine.md` | Lines 47–66: `detectKind` branches, `goalKinds` (`kinds` no longer contains `""`, no meeting line, empty-set fallback), the template table, and the title/kind conflict paragraph. |
| `docs/design-docs/assistant-bridge.md` | The `kind` row of the field table and the new reject reason; packet template string. |
| `docs/design-docs/information-architecture.md` | Lines 16 and 29: `kind? book|fit`, and the count-KR prefill note (carve-out). |
| `docs/product-specs/home.md` | Line 27: drop `🤝 ` from the prefix list. |
| `docs/design-docs/demo-data.md` | No task changes — no `demoState` task carries `kind: "meet"`, and the one activity task is `아침 운동 30분` (`kind: "fit"`). Note that `이력서 초안 작성` stays as seeded data and is now unreproducible through the UI: it is the demo's example of a legacy plain task. |
| `ARCHITECTURE.md` | Status line: schema **v18**; E2E stays **114 steps**. |
| `docs/RELIABILITY.md` | Line 9: add the v17 → v18 fixture; line 29: the step count stays 114 but the sentence lists the new refusal assertion. |
| `tools/e2e/README.md` | `flow.js` row (the fresh save asserts v18), `flow3.js` row (meeting activities out, kind-less refusal in); the `114-step scenario` line is unchanged. |
| `docs/QUALITY_SCORE.md` | Line 37: Rule 17 evidence — `(E2E: reading, fitness)`, meeting follow-up dropped. |
| `docs/exec-plans/tech-debt-tracker.md` | Rewrite **TD-09** to keep only the `StudyVerifyModal` truncation half (meeting follow-up spawning no longer exists). Add **TD-31** (S3, task creation): after `채우기 ›` the carve-out survives an arbitrary rewrite of the title, so one kind-less task per count KR can still be created deliberately; accepted because the goal owns the count KR. |
| `docs/generated/*` | `npm run docs:gen` only — `onboarding-tables.md` (the two removed template rows), `symbol-index.md` (line ranges), `db-schema.md` (v18 and the kind union). Never hand-edited. |

## Proposed commit

```
feat(tasks): goals hold certifications, study and fitness only

The meet activity kind and kind-less task creation are gone; a count-KR
fill is the one carve-out. Saved meeting tasks migrate to plain tasks
(schema v18) with their minutes intact. Rules 17 and 19 amended.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
```
