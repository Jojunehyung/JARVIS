# Meetings record tab, compact to-do rows, exact exam scores, calendar-only schedule, renamed tabs
- Status: completed
- Date: 2026-09-16
- Needs approval: **yes, for phases 4 and 5 only.** Phase 4 appends a new `if (s.v < 22)` block and Phase 5 a new `if (s.v < 23)` block to `migrate` (no existing block is edited, no `liferpg-*` key changes, no user data is deleted — v22 drops only the retired view preference `ui.scheduleView`). Phases 1–3 touch no rule data, no migrate block, no key and no stored field; they can run immediately. No `CERTS` / `EXAMS` / `WEIGHT_MATRIX` / `CERT_W_EXC` row is touched in any phase.
- Agents: planner → implementer (one phase at a time) → cleanup → verifier (build, `node --check`, smoke — **no E2E run**) → docs-syncer
- **E2E policy (standing user instruction):** `npm run verify` and `node tools/e2e/run.js` are **not run** in any phase or gate. Every E2E step whose selectors or assertions this change breaks is **edited**, and new steps are **added**, but the suite is **updated, not executed**. The user runs E2E only when they ask. The final report must say so in one plain sentence.

## Goal
The user asked, verbatim: `그럼 일단 미팅내용들을 다 저장하는 용도로만 쓰자 / 아무래도 api등의 유료 기능들이 많이 필요하니까 / 그리고 홈 페이지에 자격이랑 시험 뒤 D66 같은거 지워줘 / 시험도 정확한 점수 기재하게해 / 일정탭에 목록 지워주고 / 실행탭에 나열된거 제목이랑 디데이와 같은 핵심 내용들만 나열되게 해줘 / 그리고 클릭하면 상세내용 나오게끔 / 그리고 탭 이름을 좀더 어울리게 해줘`.

In product terms, six changes that land in five phases, smallest first:
1. The home CV's `자격` and `시험` rows stop printing the `D{n}` difficulty after each name.
2. The tabs are renamed `프로필 · 목표 · 할 일 · 일정 · 사업`, and the `일정` tab keeps only its month calendar (the `목록` view and its chips go).
3. The `할 일` (formerly `실행`) list shows one compact line per item — a D-day chip, the title and at most one marker — and tapping a line opens a detail sheet that holds everything else, including completion. The row has no checkbox.
4. An exam milestone records the exact score from the score report (for example `835`), shown on the CV; payout, grade and difficulty stay band-based.
5. A new sixth tab `미팅` stores hand-written minutes grouped by project — a record only: no AI, no API, no automation, no payout.

## Context read
Code — `src/LifeManager.jsx`, 7,332 lines today. Line numbers are approximate; grep the anchor before every edit.

| Symbol | Anchor (≈ line) | Why it matters |
|---|---|---|
| lucide imports | L2–5 | `Flag` is used only by `NAV` (becomes unused); `IdCard` and `MessagesSquare` are added (both exist in lucide-react 0.460.0) |
| `DueChip` | `function DueChip` L1414 | only caller is the `TaskTab` row; folded into the new lead chip helper |
| `STORAGE_BUDGET`, `storageUsedBytes`, `saveImageChecked` | L1357, L1363, L1376 | the meeting budget guard reuses the first two; the budget is counted in string length (3.5 × 1,048,576 = 3,672,064 chars) |
| `EXAMS` | `const EXAMS = [` L1813 | **read only**: band labels decide the score input kind and bounds; 13 families have numeric labels, 4 do not (`opic`, `cambridge`, `jlpt`, `hsk`) |
| `needsEvidence`, `ddayStr` | L1936, L1953 | reused unchanged |
| `agendaOf`, `EVENT_KIND_LABEL`, `eventsOn`, `upcomingEvents` | L2354, L2368, ~L2410, ~L2419 | read by the to-do list and the meeting form's event chips |
| `TODO_GROUPS`, `todoOf`, `lastDoneDate` | L2427, L2440, ~L2513 | unchanged; the compact rows are a view over it |
| `TAB_ACTIONS` | L2532 | unchanged (`home`, `goals`, `schedule`, `biz`); internal tab keys are not renamed |
| `@schema` JSDoc | L2983–3032 | `ui.scheduleView` (L3024), `tasks[]`, `exams.best` lines change in phases 4–5 |
| `migrate` | `const migrate =` L3033; v17 block L3085–3088; v21 block L3108–3117 | append-only; v22 and v23 blocks go after v21 |
| `freshState` | L3128 (`v: 21`, `ui` L3145) | `v` bump and `ui` in phase 4; new arrays in phase 5 |
| `demoState` | L3150; `exams.best` L3240 | demo score in phase 4, demo projects and minutes in phase 5 |
| Onboarding photo note | L3607 | copy names `홈 프로필 카드` |
| `CvFact`, `HomeTab` | L3797, L3840; `자격` / `시험` rows L3875–3883; `프로필` button ~L3862 | phase 1 and the button label in phase 2 |
| `ProfileModal` `보유 기록` | L3925; exam line ~L4012–4015 | already prints no `D`; gains the score in phase 4 |
| `BizTodoRow`, `TODO_TONE`, `TODO_DONE_MAX`, `TaskTab` | L4755, L4768, L4769, L4775 (row builder ~L4789–4834, `rowOf` ~L4837–4842, header ~L4846–4876) | phase 3 rewrite target |
| `EvidenceModal` | L5130 | phase 4 score input |
| `AchievementWallModal` exam rows | L5417, rows ~L5447–5458 | keeps `D{b.d} · 누적 {P}P`; gains the score in phase 4 |
| `EventRow`, `ScheduleCalendar`, `ScheduleTab`, `EventModal` | L5632, L5676, L5780, L5872 | phase 2 removes the list; `EventRow` is reused by the event detail sheet |
| `BizTab` | L6235 | the new meetings region goes after this region |
| root: `removeTask`, `tryComplete`, `completeTask` (exam branch ~L6711–6743) | L6656, L6676, L6683 | completion path unchanged; `completeTask` gains an optional third argument in phase 4 |
| root: event handlers, `setScheduleView`, business handlers | ~L6870–6925, L6927, L6940 | `setScheduleView` deleted in phase 2 |
| root: `closeBriefing`, `exportBackup`, `importBackup`, `resetAll` | ~L6991, L7092, L7118, L7133 | unchanged; `exportBackup` writes the whole `state`, so meetings travel in the file with no code change |
| root: `NAV`, `<main>` mounts, nav bar, modal dispatch | L7162, L7196–7227, L7229 (`grid-cols-5`), L7237–7329 | wiring |

E2E (`tools/e2e`, chain `flow.js` → flow2 → flow3 → flow5 → flow7 → flow8 → flow9 → flow4 → flow6, then the demo and reset steps in `flow.js`): helpers in `run.js` (`clickTab` L177 matches nav labels with `includes`, `todoRows` L209, `openSettings` ~L262, `completeQuest` ~L119 clicks a row's first button, `assertDone` ~L57, `submitPhotoEvidence` ~L370, `logActivity` ~L378); `flow.js` L86–88, L217–224, L242–300, L315, L346–356; `flow2.js` L13–48, L62, L118–200; `flow3.js` L8–10, L43, L72, L90, L123–134; `flow4.js` L10, L33–36, L99, L147, v17–v21 fixtures L200–366; `flow5.js` L13–23, L44–100, L129, L208, L237, L250–286; `flow7.js` whole file; `flow8.js` L58, L305–315, L323, L350–373, L476; `flow9.js` L93 (unaffected: it uses the header `캘린더로 내보내기`); bench scripts `ab.js` L23/L27, `perf.js` L77, `prof.js` L26 (still use the retired label `퀘스트` — TD-40). `flow6.js` touches none of these surfaces.

Harness: `tools/harness/gen-screenshots.js` `SHOTS` (tabs `홈`, `실행`, `목표`, `일정` + `달력`), `public/manifest.webmanifest` screenshot labels (`tasks.png` label is stale — TD-41), `smoke-logic.js` (reads `EXAMS` with `evalConst`), `finish-check.js`, `lang-check.js`, `check-docs.js`.

Docs read: `AGENTS.md`, `docs/PLANS.md`, `docs/design-docs/core-beliefs.md`, `ARCHITECTURE.md`, `docs/FRONTEND.md`, `docs/DESIGN.md`, `docs/product-specs/index.md`, `docs/design-docs/information-architecture.md` (headings), `docs/exec-plans/tech-debt-tracker.md` (TD-40, TD-41, TD-42; highest id TD-43), `docs/design-docs/decision-log.md` (2026-09-11 `meet` kind removal, 2026-09-15 CV home), completed plan [cv-home](../completed/2026-09-15-cv-home.md).

### Rules
| Rule | How this plan touches it |
|---|---|
| [1](../../design-docs/core-beliefs.md#rule-1) | A meeting or project pays nothing and creates no trophy or achievement. The exam score is display-only; no payout reads it. |
| [2](../../design-docs/core-beliefs.md#rule-2) | `calcExamPayout`, the band snapshot, `exams.dim`, `exams.spec` and the `q.band.p > prevBest.p` replacement test are byte-identical. The score is merged into `exams.best[famId]` only as an extra display field (D-P4c). |
| [6](../../design-docs/core-beliefs.md#rule-6) | `EXAMS` is read (labels) and never edited. |
| [7](../../design-docs/core-beliefs.md#rule-7) | Meetings add no AI, no network, no API; `buildAssistantPacket` and `parseAssistantReply` do not read meetings or scores (packet byte-identical). |
| [9](../../design-docs/core-beliefs.md#rule-9) | Counts, D-day chips, storage use, the "more" toggle and sheet contents are derived at render or held in component/modal state; nothing derived is stored. |
| [10](../../design-docs/core-beliefs.md#rule-10) / [11](../../design-docs/core-beliefs.md#rule-11) / [16](../../design-docs/core-beliefs.md#rule-16) | The sheet's completion button calls `tryComplete` exactly as the row did; `EvidenceModal` keeps the photo gate and adds the score as an extra requirement (never a relaxation). `PromoteModal` untouched. `liferpg-img-ev-*` handling untouched. |
| [12](../../design-docs/core-beliefs.md#rule-12) | Two appended blocks (v22, v23), `v` bumped in `freshState`, `@schema` updated, fixtures in `flow4.js`; no existing block edited, no key changed. |
| [13](../../design-docs/core-beliefs.md#rule-13) | Every compact row that serves no goal still states `목표 기여 없음`; sheets and the meetings tab state zeros and limits as facts in `해요체`. |
| [17](../../design-docs/core-beliefs.md#rule-17) | Kind tasks still complete through `ActivityLogModal`, reached from the sheet via `tryComplete`. |
| [18](../../design-docs/core-beliefs.md#rule-18) / [19](../../design-docs/core-beliefs.md#rule-19) | No task creation path is added; a meeting is not a task and has no `goalId`. The amendment copy that sends appointments to `일정` stays true and unchanged. |
| Checked, untouched | [3](../../design-docs/core-beliefs.md#rule-3), [4](../../design-docs/core-beliefs.md#rule-4), [5](../../design-docs/core-beliefs.md#rule-5), [8](../../design-docs/core-beliefs.md#rule-8), [14](../../design-docs/core-beliefs.md#rule-14), [15](../../design-docs/core-beliefs.md#rule-15) |

Conventions: `docs/FRONTEND.md` — clone-pattern state updates, Tailwind v3 core utilities only (no arbitrary values), `font-mono` for numbers, D values and D-day, lucide icons only and only those used, `<Modal title onClose>` for every sheet, `demoState` updated for every feature, copy changes update `tools/e2e` in the same phase.

## Prompt
You are implementing `docs/exec-plans/active/2026-09-16-meetings-and-simplify.md` for Life Manager, **one phase per invocation** (the invoking agent names the phase). Files: `src/LifeManager.jsx`, `tools/e2e/*`, `tools/harness/gen-screenshots.js`, `tools/harness/smoke-logic.js` (phase 4 only), `public/manifest.webmanifest`, `public/screenshots/*.png` (final step only). Read `docs/design-docs/core-beliefs.md` and `docs/FRONTEND.md` first and re-read every anchor in "Context read" before editing it. English identifiers, comments, E2E step names and failure messages; Korean UI copy exactly as quoted in each phase's "Korean strings" list (each string is an E2E selector). Tailwind v3 core utilities only; at 390 px nothing scrolls horizontally.

**Frozen in every phase.** `CERTS`, `EXAMS`, `WEIGHT_MATRIX`, `CERT_W_EXC`, every `DATA_TABLES` block, the `store` call sites, the `liferpg-*` keys, every existing `migrate` block (v11–v21), `calcExamPayout`, `tryComplete`, `promoteArea`, `PromoteModal`, `EvidencePicker`, `composeEvidence`, `exportBackup`, `importBackup`, `resetAll`, `buildBriefing`, `BriefingModal`, `closeBriefing`, `buildAssistantPacket`, `parseAssistantReply`, `calendarExportOf`, `buildIcs`. Check with `git diff` that each is byte-identical at every gate (phase 4 adds one optional parameter to `completeTask` and one merge line in its exam branch — nothing else in `completeTask` moves).

**Never run** `npm run verify` or `node tools/e2e/run.js`. Edit and add E2E steps as listed; check that every edited E2E file parses with `node --check`. Say in the report that E2E was updated and not executed.

Stop and report instead of improvising if: a phase seems to need a stored field it does not list, an existing migrate block seems to need an edit, a payout/grade/D figure would change, or `todoOf` / `agendaOf` would need a behaviour change.

### Phase 1 — no `D` figures on the CV's `자격` and `시험` rows
**D-P1.** In `HomeTab`, the `자격` row renders `{n}건` then ` · {name}` per held certification (drop `{c.d != null && <> <span className="font-mono">D{c.d}</span></>}`); the `시험` row renders `{n}건` then ` · {exam name} {band label}` (drop the `D{b.d}` span). Keep both sorts (highest D first) — the order still carries the ranking without printing the number. Update the `HomeTab` banner comment and the `heldCertsOf` comment near L1305 that describe what the row prints.

Scope decision: `ProfileModal`'s `보유 기록` already prints names and band labels without `D` — no change. `AchievementWallModal` keeps `D{b.d} · 누적 {P}P` on its exam rows: that sheet is the payout ledger, where D is what explains P ([Rule 1](../../design-docs/core-beliefs.md#rule-1), [Rule 2](../../design-docs/core-beliefs.md#rule-2)); the user asked about the home page only. `RoleAdviceModal` and `CatalogModal` keep `D` (recommendation and catalogue screens, not the CV).

Korean strings: none added, changed or removed (only the ` D{n}` fragments go).

E2E: `flow2.js` step `the CV states held credentials and record counts, and the wall lists every area` — add after the `want` loop: `if (/\bD\d{1,3}\b/.test(res.cv)) throw new Error("the CV still prints a difficulty figure: " + res.cv)`. Rename the step to **`the CV states held credentials without difficulty figures, and the wall lists every area`**. The wall part of the step is unchanged (the wall still shows `D`).

Acceptance: on the demo save the CV reads `시험 1건 · TOEIC L&R 700` with no `D49`; `자격 0건`; the wall still reads `D49 · 누적 480P`.

Gate 1: `npm run build` · `npm run finish` · `npm run lang:check` · `node --check tools/e2e/flow2.js`.

### Phase 2 — tab labels and a calendar-only `일정`
**D-P2a — labels.** `NAV` becomes `[["home", "프로필", IdCard], ["goals", "목표", Target], ["tasks", "할 일", ClipboardList], ["schedule", "일정", CalendarDays], ["biz", "사업", Briefcase]]`. Internal keys stay (`home`, `tasks`): `TAB_ACTIONS`, briefing actions and `setTab` calls keep working untouched. Import `IdCard`, remove `Flag`. `프로필` names what the tab is since 2026-09-15 (one CV); `할 일` names what the list is (time-ordered things to do across tasks, events and business rows — `실행` stays the word for a task created under a goal, per the glossary).

Nav labels on one line: wrap `{label}` in `<span className="whitespace-nowrap leading-4">`. At 390 px the bar is 390 − 24 (`inset-x-3`) − 8 (`px-1`) − 2 (border) = 356 px; five cells are ~71 px, six (phase 5) ~59 px; `text-xs` Hangul is ~12 px per glyph, so the widest label `프로필` is ~36 px.

Copy that follows the rename — only strings that name a tab as a place:
| Where | Old | New |
|---|---|---|
| `TaskTab` header `SectionLabel` | `실행 — 시간순 할 일` | `할 일 — 시간순` |
| `HomeTab` identity button | `프로필` | `프로필 편집` (a `프로필` button inside a tab named `프로필` is ambiguous, and E2E `clickText("프로필")` would match the nav) |
| Onboarding photo note (L3607) | `사진은 시작한 뒤 홈 프로필 카드에서 등록해요.` | `사진은 시작한 뒤 프로필 탭의 프로필 편집에서 등록해요.` |

Kept on purpose (they name the concept, not the tab): `실행 추가`, `실행이 추가됐어요`, `새 실행은 목표 탭에서 만들어요.`, `마일스톤 실행에서 합격증 제출로 완료`, `실행·일정·사업을 …`, `활동 유형 없는 실행은 일정 탭에서 관리해요`, the `AddTaskModal` error quoted by Rule 19's amendment (`… 약속·미팅은 일정 탭에서 만들어요.`), the briefing's `오늘 할 일` section, the calendar-export copy (`매일 실행 목록` — verified by `flow9.js`), and the `TaskTab` `할 일` / `완료` view chips (the chip names the open-items view inside the tab; E2E addresses the chips with `clickExact`).

**D-P2b — `일정` without `목록`.** `ScheduleTab({ state, today, onAdd, onEdit, onToggleDone, onSkip, onExport })`: drop `view` / `onView`, the `cal` flag, the `groups` computation and every list branch (empty-state section, group sections). Keep the `counts` memo (today, this week, past deadlines — the same three numbers from the same windows). Header section: first row `flex items-center justify-between gap-2` with `SectionLabel` `다가오는 일정` on the left and the existing `캘린더로 내보내기` button (same classes) on the right; second row the counts line, unchanged. Then `<ScheduleCalendar … />` always. Delete the header `일정 추가` button (the calendar panel's own `일정 추가` is the one add button, as in calendar view today). Root: delete `setScheduleView` and the `view` / `onView` props. Rewrite comments that mention the list view (`EventRow` banner: the calendar panel and — from phase 3 — the event detail sheet render it; `ScheduleCalendar`; `upcomingEvents` "the schedule list and the assistant packet" → "the calendar and the assistant packet"; the `todoOf` `이후` collapse comment "exactly as ScheduleTab does" → "the later group collapses repeats itself").

`ui.scheduleView` in this phase: nothing reads it; `freshState` still writes `"list"` and old saves keep whatever they hold — **no schema change in phase 2**. A save whose stored value is `"list"` (every save that never chose the calendar) opens on the calendar, today selected. The key is dropped by the v22 block in phase 4 (D-P4e). Add a one-line comment on `freshState`'s `ui` and on the `@schema` line: retired 2026-09-16, never read, dropped at v22.

Every route that landed on the list lands on the calendar: the bottom nav, the briefing's schedule lines (`action: { type: "schedule" }` → `setTab("schedule")` opens the month with today selected, where today's occurrences are listed), `flow9`'s export button (unchanged position class). Missed deadlines the list showed under `지난 마감` stay visible as the counts line figure and as `기한 지남` rows in `할 일` (`todoOf` already lists deadlines of the past 30 days).

Manifest and screenshots: `gen-screenshots.js` `SHOTS` → `{ file: "home.png", tab: "프로필" }`, `{ file: "tasks.png", tab: "할 일" }`, `{ file: "goals.png", tab: "목표" }`, `{ file: "calendar.png", tab: "일정" }` (no `then`; fix the comment that says the tab opens on its list). `manifest.webmanifest` `tasks.png` label `목표별 실행과 마일스톤` → `시간순 할 일 — 제목과 D-day` (closes TD-41; the label describes phase 3's rows, so apply it in phase 3 if phases land separately).

Korean strings — added: `프로필` (nav), `할 일` (nav), `할 일 — 시간순`, `프로필 편집`, `사진은 시작한 뒤 프로필 탭의 프로필 편집에서 등록해요.`. Removed: `홈` (nav), `실행` (nav), `실행 — 시간순 할 일`, `사진은 시작한 뒤 홈 프로필 카드에서 등록해요.`, `목록`, `달력` (chips), `등록한 일정이 없어요 — 표시할 약속·마감이 없어요.`, the `ScheduleTab` group labels `지난 마감` · `오늘` · `내일` · `이번 주` · `이후` (the same words remain in `todoOf`'s groups and the counts line), the header `일정 추가` button (the panel's `일정 추가` remains). Changed: nothing else.

E2E edits (phase 2):
- `run.js`: `openSettings` → `clickTab("프로필")`; `submitPhotoEvidence` and `logActivity` → `clickTab("할 일")`. Keep `clickTab`'s `includes` match (no label is a substring of another: `프로필`, `목표`, `할 일`, `일정`, `사업`, and in phase 5 `미팅`).
- Every `clickTab("홈")` → `clickTab("프로필")` and every `clickTab("실행")` / `openFrom("실행", …)` → `"할 일"` in `flow.js`, `flow2.js`, `flow3.js`, `flow4.js`, `flow5.js`, `flow7.js`, `flow8.js`; fix comments that name the tabs.
- `flow.js` `profile modal — opens from the home card and lists the CV` → rename **`profile modal — opens from the profile tab and lists the CV`**; `clickText("프로필")` → `clickText("프로필 편집")`. Same replacement in `flow3.js` `profile photo upload through the profile modal`.
- `flow.js` `go to tasks tab`: `expectText("할 일 — 시간순")`.
- `flow.js` tab sweep `["홈", "실행", "목표"]` → `["프로필", "할 일", "목표"]`; demo sweep → `["할 일", "목표", "일정", "사업", "프로필"]`; `a briefing area line lands on the home CV`: `res.tab !== "프로필"`.
- `flow.js` `bottom nav order (home, goals, tasks, schedule, business)` → **`bottom nav order and one-line labels (profile, goals, to-do, schedule, business)`**: `want = ["프로필", "목표", "할 일", "일정", "사업"]`; still `grid-cols-5`; add: every `nav button span` has `getBoundingClientRect().height <= 18` and `scrollWidth <= clientWidth` (one line, not clipped).
- `flow.js` `home is one CV with the proximity line under it`: the `want` list keeps `프로필` (still a substring of `프로필 편집`); no other change.
- `flow7.js` (the schedule flow was written against the list; rewrite as follows, keeping every assertion about the stored record):
  - Add helpers: `showDay(date)` — `clickTab("일정")`, read `monthLabel()`, press `›` / `‹` until the month of `date` is shown (at most 2 presses, throw otherwise), then `pickDay(Number(date.slice(8)))`; move `gridCells`, `monthLabel`, `pickDay`, `panelLine` above the first step that needs them. `addEvent` is unchanged (the panel's `일정 추가` opens the form; the date input is set explicitly).
  - `schedule tab starts empty` → **`schedule tab opens on the calendar and starts empty`**: `expectText("다가오는 일정")`, `expectText("이 날짜에는 일정이 없어요.")`, counts line equals `오늘 0건 · 이번 주 0건 · 지난 마감 0건`, and `!(await hasText("목록"))`.
  - `appointment registers under its day group with its time` → **`appointment registers on its day with its time`**: after `addEvent`, `showDay(dstrIn(1))`, then the existing `rows([...])` assertions (`14:00` lead, task fields, task count).
  - `deadline registers and shows its D-day`: `showDay(dstrIn(3))` before `rows`.
  - `weekly repeat shows next week and collapses the later occurrences` → **`weekly repeat marks both weeks and the to-do list collapses the later ones`**: `showDay(dstrIn(1))` and `showDay(dstrIn(8))` each give one row containing `반복 매주`; the stored-rule and no-derived-array checks stay; the collapse check moves to `clickTab("할 일")` + `todoRows()`: the title appears once in `내일` and at most once in `이후` (the `todoOf` collapse).
  - `completion mark flips the button and stores only the date`, `cancelling one occurrence leaves the next one`, `editing changes the stored event and its row`, `deleting removes the event from the tab`: prefix each `rows(...)` read with `showDay(<the occurrence date>)` (`dstrIn(3)`, `dstrIn(1)` then `dstrIn(8)`, `dstrIn(1)`, `dstrIn(1)`). Assertions unchanged.
  - `the briefing line opens the schedule tab`: after the tap, also assert `panelLine()` starts with today's date.
  - `the schedule tab counts line states today's deadline`: unchanged.
  - `the calendar view opens on this month with its weekday header` → **`the calendar opens on this month with its weekday header`**: delete `clickExact("달력")` and the stored-view assertion.
  - `the chosen view survives a reload` → replace with **`a save that stored the list view opens on the calendar`**: patch `ui.scheduleView = "list"` into the save, `h.reload()`, `clickTab("일정")`, `expectText("선택한 날짜")`, `!(await hasText("목록"))`, and the stored value is still `"list"` (phase 2 does not rewrite it; phase 4 changes this last assertion, see below).
  - `the selected day's panel renders the list's own row` → **`the selected day's panel renders the full event row`** (body unchanged).
  - `the list view comes back with its groups and counts` → replace with **`no list view remains`**: no button whose exact text is `목록` or `달력`, exactly one `일정 추가` button, the counts line present.
  - `reopenTab` loses its `stored` field or is deleted if unused.
- `flow8.js` `the chosen business view survives a reload`: the `scheduleView !== "list"` assertion stays in phase 2 (phase 4 replaces it).
- `flow4.js` fixtures: no change in phase 2.
- `ab.js`, `perf.js`, `prof.js`: `홈` → `프로필`, `퀘스트` → `할 일` (closes TD-40).

Acceptance: five nav labels read `프로필 · 목표 · 할 일 · 일정 · 사업`, each on one line at 390 px; `일정` shows the header, the counts line and the calendar and nothing named `목록` / `달력`; the briefing's schedule line lands on the month with today selected; home's edit button reads `프로필 편집`.

Gate 2: `npm run build` · `npm run finish` · `npm run lang:check` · `node --check` on every edited file in `tools/e2e` and `tools/harness/gen-screenshots.js`.

### Phase 3 — compact to-do rows and detail sheets
**D-P3a — one row shape for every item.** A module-level `TodoRow({ lead, title, done, marker, onOpen })` in the tasks region: `<button onClick={onOpen} className="w-full text-left flex items-center gap-2.5 bg-zinc-950 rounded-xl px-3 py-2.5 active:opacity-70 {done ? "opacity-50" : ""}">` holding, in order, the lead chip `<span className="font-mono text-xs font-bold border rounded-lg px-1.5 py-1 bg-zinc-900 shrink-0 {lead.tone}">{lead.text}</span>`, the title `<div className="flex-1 min-w-0 text-sm font-semibold truncate {done ? "line-through" : ""}">{title}</div>`, and the marker (or nothing). Class names `bg-zinc-950`, `rounded-xl` and `text-sm font-semibold` are kept because `todoRows` in `run.js` finds rows by them. No nested button, no input.

What a row keeps, and why:
| Kept | Why |
|---|---|
| Lead chip (D-day) | The user asked for the D-day; it is the one fact the time-ordered list is sorted by. |
| Title | The user asked for the title; `truncate`, the full title is the sheet's title. |
| Marker `목표 기여 없음` (`text-xs text-zinc-600 shrink-0`) on every row that serves no goal — every event row, every business row, and a task whose `goalId` finds no goal | [Rule 13](../../design-docs/core-beliefs.md#rule-13) forbids hiding it; today each row states it. |
| Otherwise, marker `<Lock size={13} className="text-zinc-500 shrink-0" aria-label="증거 필요" />` on an open task with `isCert`, `isExam`, `isStudy` or `needsEvidence(q)` | Tapping such a row leads to a gate, not a one-tap completion; one 13 px icon states that before the tap ([Rule 10](../../design-docs/core-beliefs.md#rule-10), [Rule 16](../../design-docs/core-beliefs.md#rule-16)). |

Dropped from the row (all moved into the sheets): goal title, area name, `매일` suffix, `증거 필요` / `성적표 사진 필수` / `📖 산출물검증` text, job-fit tier, D value, difficulty badge, cert badge, `시험` / `사업` badges, kind emoji, completion date and `증거 보기`, the checkbox / lock button, the `X` delete button, the event's three buttons, the business month chip.

Lead chip, one pure helper `todoLeadOf(r, today, archived)` → `{ text, tone }`, first match wins:
1. `archived` (the `완료` view) → `{lastDoneDate(q).slice(5)}` (`MM-DD`), `text-emerald-400 border-emerald-800`; `날짜 없음` when there is no date.
2. A done row (`r.done`, or a task done today) → `완료`, emerald as above.
3. An appointment dated today with a time → `{time}` (`HH:MM`), `text-amber-300 border-amber-700` (the `오늘` group already says the day; the time is what distinguishes today's appointments).
4. Any row with `r.date`: `r.date < today` → `기한 지남`, `text-rose-400 border-rose-800`; `r.date === today` → `D-DAY` (`ddayStr`), amber; later → `ddayStr(r.date)`, `text-zinc-400 border-zinc-700`. Business rows use their `r.date` (the month-end date `todoOf` already assigns).
5. An undated daily task → `매일`, `text-zinc-500 border-zinc-700`.
6. Any other undated task → `기한 없음`, `text-zinc-500 border-zinc-700`.
Delete `DueChip` once unused (its tones live in the helper). Width budget at 390 px: row content 390 − 32 − 32 − 24 = 302 px; lead ≤ 60 px (`기한 지남`), marker ≤ 84 px (`목표 기여 없음`), two 10 px gaps → the title keeps ≥ 138 px (about ten Hangul glyphs at `text-sm`).

**D-P3b — `TaskTab`.** Props become `{ state, today, onOpenTask, onOpenEvent, onOpenBiz, onCatalog, onGoGoals, onGoBiz, onBriefing }`. `rowOf(r)` → `TodoRow` for all three kinds: task → `onOpenTask(r.task.id)`; event → `onOpenEvent(r.ev.id, r.date)`; business → `onOpenBiz(r)`. The archive renders `doneShown.map((q) => <TodoRow … lead={todoLeadOf({ kind: "task", task: q }, today, true)} done onOpen={() => onOpenTask(q.id)} />)`. `BizTodoRow` is deleted. Header: `할 일 — 시간순` (phase 2), the caption becomes `실행·일정·사업을 시간순으로 모아요. 항목을 누르면 상세가 열려요. 새 실행은 목표 탭에서 만들어요.`; the counts line, the business button, `도감`, the chips and `브리핑 열기 ›` are unchanged. Update the component comment: completion is reachable only from the task sheet.

**D-P3c — `TaskDetailModal({ state, taskId, today, onClose, onComplete, onRemove, onViewEvidence })`,** `modal: { type: "taskDetail", taskId }`. It reads the live task (`state.tasks.find`) and returns `null` when it is gone. Title: the task title. Body `space-y-3`:
- Facts, one `CvFact` row each (give `CvFact` an optional `wrap` prop: `break-words` instead of `truncate` for the value; update its comment — "label/value row shared by the CV and the detail sheets"):
  | Label | Value |
  |---|---|
  | `상태` | once: `할 일` or `완료 {doneAt}`; daily: `매일 · 완료 {n}회` plus ` · 오늘 완료` when done today |
  | `기한` | `{due} · {ddayStr(due)}` (`기한 지남` instead of the D+ figure when past), `매일`, or `기한 없음` |
  | `목표` | `{goal.title}` or `목표 기여 없음` |
  | `영역` | area name, or `영역 없음` |
  | `유형` | `📚 독서` · `💪 운동` · `📖 학습` · `자격 마일스톤` · `시험 마일스톤` · `일반` |
  | `난이도` | cert: `<CertBadge>` + `D{certD}` and, when `jobWeightForCert` returns a tier, ` · 직무 적합 {tier}` in `TIER_CLS`; exam: `{exam name} {band.label} 구간 · D{band.d}`; otherwise `<DiffBadge d={q.diff} />` |
  | `증거` | cert `합격증 사진 필수`; exam `성적표 사진 필수`; study `산출물 검증 — {diff}급 기준`; book `독후감 기록`; fit `운동 기록`; other `needsEvidence` → `증거 필요`; else `없음` |
  | `증거 기록` | only when `q.evidence`: the text (`wrap`), then a `증거 보기` button → `onViewEvidence(q)` |
- Actions: when the task is not closed (daily not done today / once not done), a full-width `완료하기` button (`bg-cyan-500 text-zinc-950 font-black`) → `onComplete(q)`; always a full-width `삭제` button (`border border-rose-800 text-rose-300`) → `onRemove(q.id)`. No completion control when closed — the archive stays a record, as today.
- Root wiring: `onComplete={tryComplete}` (plain tasks: `completeTask` already calls `setModal(null)`; gated tasks: `tryComplete` replaces this sheet with the study / activity / evidence modal); `onRemove={(id) => { removeTask(id); setModal(null); }}` (`removeTask` unchanged — it asked nothing before either); `onViewEvidence={(q) => setModal({ type: "evidenceView", task: q })}`.

**D-P3d — `EventDetailModal({ state, eventId, date, today, onClose, onToggleDone, onSkip, onEdit })`,** `modal: { type: "eventDetail", eventId, date }`, title `일정 — {ev.title}`. Body: the existing `EventRow` for the live occurrence (`done` read from `ev.doneDates`) — its `완료 표시` / `완료 취소`, `이번 회차 취소` and `수정` buttons are the event's detail actions — then `<p className="text-xs text-zinc-500">목표 기여 없음 — 일정은 기록이라 점수와 목표에 반영되지 않아요.</p>`. Returns `null` when the event is gone. Root: `onToggleDone={toggleEventDone}` (the sheet stays open and re-renders flipped), `onSkip={(id, d) => { skipOccurrence(id, d); setModal(null); }}` (the occurrence no longer exists), `onEdit={(ev) => setModal({ type: "event", event: ev })}`. Remove `EventRow`'s now-unused `tail` prop.

**D-P3e — `BizTodoModal({ row, onClose, onOpen })`,** `modal: { type: "bizDetail", row }` (a render-time snapshot held in the modal slot, never stored), title `사업 — {row.title}`. Body: `CvFact` `월` → `{row.month}` (`font-mono`), then `<p className="text-xs text-zinc-400 break-words">{row.text}</p>` (already ends `· 목표 기여 없음`), then a full-width button `사업 탭에서 보기 ›` → root `() => { setModal(null); setBizView("deals"); setTab("biz"); }`. No payment control here — the payment chip stays in `사업` ([Rule 1](../../design-docs/core-beliefs.md#rule-1), [Rule 18](../../design-docs/core-beliefs.md#rule-18)).

The briefing's `오늘 할 일` lines keep completing through `closeBriefing` → `tryComplete` (unchanged; the user asked about the list only).

Korean strings — added: `완료하기`, `삭제` (sheet), `상태`, `기한`, `목표`, `영역`, `유형`, `난이도`, `증거`, `증거 기록`, `할 일`, `완료 {date}`, `매일 · 완료 {n}회`, ` · 오늘 완료`, `기한 없음`, `영역 없음`, `📚 독서`, `💪 운동`, `📖 학습`, `자격 마일스톤`, `시험 마일스톤`, `일반`, `{name} {label} 구간 · D{d}`, ` · 직무 적합 {tier}`, `합격증 사진 필수`, `성적표 사진 필수`, `산출물 검증 — {diff}급 기준`, `독후감 기록`, `운동 기록`, `증거 필요`, `없음`, `매일` (lead chip), `완료` (lead chip), `일정 — {title}`, `목표 기여 없음 — 일정은 기록이라 점수와 목표에 반영되지 않아요.`, `사업 — {title}`, `월`, `사업 탭에서 보기 ›`, `실행·일정·사업을 시간순으로 모아요. 항목을 누르면 상세가 열려요. 새 실행은 목표 탭에서 만들어요.`. Removed from the list rows (still present elsewhere where noted): `증거 필요`, `성적표 사진 필수` (row versions; the sheet has its own), `📖 산출물검증`, ` · 매일`, `🎯 {goal}`, `완료 {date} · …` row line, `날짜 없음` row line (kept only as the archive lead fallback), `시험` and `사업` badges, `직무 적합` row text, `실행·일정·사업을 시간순으로 모아서 보여줘요. 새 실행은 목표 탭에서 만들어요.`. `증거 보기` moves into the task sheet.

E2E edits (phase 3):
- `run.js`: rewrite `completeQuest(title)` — in `main`, find the `.text-sm.font-semibold` node whose text includes `title`, walk up to the enclosing `BUTTON` with `bg-zinc-950` + `rounded-xl`, click it, wait 450 ms, then `clickInModalExact("완료하기")`; throw `task row not found` / `no completion button in the detail sheet` with the title. Add `openTodo(title)` (the same walk, click, wait, no completion) and export it in `h`. `assertDone` stays: the title node's parent is the row button, which carries the `완료` lead chip once done — update its comment. Update the `todoRows` comment: rows are buttons with zero inner controls; `tap` without `button` presses the row.
- `flow2.js` `evidence viewer — stored certificate photo shown`: `clickTab("할 일")`, `openTodo("전기기사 취득")`, assert the sheet lists `합격증 사진 필수` and `증거 기록`, `clickInModalExact("증거 보기")`, then the existing image assertions.
- New step in `flow2.js` right after it — **`to-do rows show a lead chip, the title and at most one marker`**: `clickTab("할 일")`, `todoRows()` over every group; for each row: `controls === 0`; text contains none of `🎯`, `직무 적합`, `증거 필요`, `산출물검증`, `증거 보기`; for a row whose title belongs to a stored task with a live `goalId` goal, the text does not contain `목표 기여 없음`; for event and business rows (titles from `events` / `deals` in the save) it does. Then **`the task sheet states goal, area, type, difficulty and evidence`**: `openTodo` on `설계 실습 1시간` (open daily task), `overlayText()` contains `상태`, `기한`, `목표`, `영역`, `유형`, `난이도`, `증거`, `완료하기`, `삭제`, and the goal title stored for that task.
- `flow3.js` `delete task`: `clickTab("할 일")`, `openTodo("설계 실습 1시간")`, `clickInModalExact("삭제")`, then assert from the save that no task has that title (replace the `errors.push` fallback with a throw).
- `flow5.js` `the archive lists yesterday's completion and cannot complete it again` (the last step, ~L250): `clickExact("완료")` instead of `clickText("완료")`; find the row by title in the archive section; assert its lead chip text equals `yesterday.slice(5)`; tap the row; the sheet text contains `매일 · 완료 1회` and no `완료하기` button exists in the overlay; close; the save's `doneDates` and `act.streak` are unchanged (existing assertions).
- `flow7.js` `the tasks tab lists today's deadline and completes it without a task path` → rename **`the to-do list lists today's deadline and ticks it only through its event sheet`**: the row's `controls === 0`, text contains `D-DAY` and `목표 기여 없음`; `todoRows("오늘", { title: "서류 제출 마감" })` opens the sheet; `overlayText()` contains `일정 — 서류 제출 마감`, `완료 표시`, `수정`, `목표 기여 없음 — 일정은 기록이라 점수와 목표에 반영되지 않아요.` and no `완료하기`; `clickInModalExact("완료 표시")`; `closeModal()`; the row is in `오늘 완료`; reopen it there, `clickInModalExact("완료 취소")`, close; the row is back in `오늘`.
- `flow8.js` `the tasks tab lists the unpaid month as a business row that completes nothing`: replace `biz.text.includes("사업")` with the lead chip check (`기한 지남` or `D-`) and keep `목표 기여 없음`; `controls` stays 0; `todoRows(null, { title: biz.title })` now opens the sheet: `overlayText()` contains `사업 — ` and `입금 미확인`, no `완료`-named button; `clickInModalExact("사업 탭에서 보기 ›")`; then the existing `headerLines()` and `최근 6개월` assertions.
- `flow.js` `complete daily task (goal progress delta)`, `flow2.js` cert/study steps, `flow3.js` exam and exercise steps, `flow4.js` `register and complete a task on the goal (progress 100%)`: no edit — they go through the rewritten `completeQuest` / `submitPhotoEvidence` / `logActivity`.
- `flow4.js` `deleting a goal keeps its completed tasks` (~L99): `clickExact("완료")` then `expectText("남길 실행")` and `expectText("목표 기여 없음")` still hold (the archive row carries the marker).

Acceptance: at 390 px every `할 일` row is one line — chip, title, optional marker — with no horizontal scroll; tapping a task opens its sheet, `완료하기` on an exam task opens `EvidenceModal` and nothing completes without the photo; an event row opens its sheet with the three schedule buttons; a business row opens its sheet and `사업 탭에서 보기 ›` lands on the contract view; the `완료` archive lists `MM-DD` chips and its sheets have no completion button.

Gate 3: `npm run build` · `npm run finish` · `npm run lang:check` · `node --check` on every edited `tools/e2e` file · `git diff` shows `tryComplete`, `completeTask`, `removeTask`, `todoOf`, `agendaOf` byte-identical.

### Phase 4 — the exact exam score (schema v22) — needs approval
**D-P4a — the stored shape.** `tasks[].score?` — the score exactly as entered, a trimmed string ≤ 20 chars, on exam milestones completed from this version on. `exams.best[famId].score?` — the score shown for that exam's best band. Both optional: a save from before v22 has none, and the display falls back to the band label (D-P4d). Strings, not numbers, because four families are graded by level (`opic` `IH`, `cambridge` `B2 First`, `jlpt` `N2`, `hsk` `5급`) and because an IELTS `6.5` must not become `6.50`.

**D-P4b — input and validation.** Pure helpers next to `calcExamPayout` (outside the `EXAMS` literal):
- `examScoreNumeric(fam)` → `true` when every band label starts with a number (`/^\d+(\.\d+)?/`). Numeric today: `toeic`, `toeicsp`, `ielts`, `toefl`, `teps` (`268 (3+)` reads 268), `gtelp`, `pte`, `duolingo`, `jpt`, `sat`, `gmat`, `lsat`, `mcat`.
- `examScoreError(fam, band, raw)` → `""` or the message: empty → `성적표에 적힌 점수를 입력해 주세요.`; longer than 20 → `점수는 20자까지예요.`; numeric family: not `/^\d{1,4}(\.\d{1,2})?$/` → `점수는 숫자로 입력해 주세요.`; below `parseFloat(band.label)` → `{band.label} 구간 미만 점수예요 — 이 마일스톤은 {band.label} 이상일 때 완료해요.`; above `parseFloat` of the family's last band label (the top band of every numeric family is the scale maximum: 990, 200, 9.0, 6.0, 600, 100, 90, 160, 990, 1600, 805, 180, 528) → `{fam.n} 최고 점수는 {max}예요.`. Level families accept any 1–20 char text (for example `N2 142점`, `IH`).
- `examScoreBetter(fam, next, prev)` → numeric family: `prev == null` or `parseFloat(next) > parseFloat(prev)`; level family: always `true` (free text has no order; the newer entry replaces).

The below-band refusal is new and deliberate: completing an `800` milestone with a `790` score report would record an achievement the report does not show. It tightens the evidence gate and changes no payout; say so in the report.

`EvidenceModal`, only when `task.isExam`: under the photo block, a `점수` field — `<input value={score} onChange=… placeholder={numeric ? "성적표에 적힌 점수 — 숫자만" : "성적표에 적힌 등급·점수 그대로"} inputMode={numeric ? "decimal" : "text"} className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-2.5 text-sm font-mono" />` and a note `<p className="text-xs text-zinc-500 mt-1">점수는 기록용이에요 — 지급 P·등급·난이도는 {band.label} 구간 기준 그대로예요.</p>`. In `submit`, after the photo check and **before** `store.set(...)`: `const se = task.isExam ? examScoreError(examOf(task.famId), task.band, score) : ""; if (se) { setErr(se); return; }`. Then `onSubmit(text, task.isExam ? score.trim() : undefined)`. The submit button's disabled state stays photo-only. Cert and study modals are unchanged.

**D-P4c — the write.** Root dispatch `onSubmit={(ev, score) => completeTask(modal.task.id, ev, score)}`. `completeTask(id, evidence, score)`: after `if (evidence) q.evidence = evidence;` add `if (q.isExam && score) q.score = score;`. In the exam branch, the existing replacement becomes `s.exams.best[q.famId] = { label, d, p, ver, date, ...(score ? { score } : {}) }` (same fields, same condition); add one `else if` for the equal band only: `else if (score && prevBest && q.band.p === prevBest.p && examScoreBetter(fam, score, prevBest.score)) s.exams.best[q.famId] = { ...prevBest, score };` — label, d, p, ver and date untouched. A lower band never touches `best`. `r`, the achievement text, the trophy, `exams.dim`, `exams.spec` and the overlay are unchanged.

**D-P4d — display.** One helper `examBestText(id, b)` → `{examOf(id)?.n || id} {b.score}` when `b.score`, else `{name} {b.label} 구간`. Read by the CV `시험` row, `ProfileModal`'s `시험 성적` line and nothing else. `AchievementWallModal` exam row left side: `{fam.n} <b>{b.label}</b>` then, when `b.score`, ` · 점수 {b.score}`; right side unchanged. Task sheet: `증거` for exams becomes `성적표 사진 + 점수 필수`; a `점수` row (`font-mono`) when `q.score`. Packet, briefing, achievement texts: unchanged.

**D-P4e — the v22 block and the retired view key.** Append after v21:
```js
if (s.v < 22) {
  // v22: exam scores are recorded exactly as the score report states them — tasks[].score and
  // exams.best[famId].score, both optional display strings; payout, grade and D stay band-based (rules 1, 2, 6).
  // Nothing is backfilled: a save from before v22 simply has no score and shows its band label. The retired
  // schedule view preference ui.scheduleView (unread since the list view was removed) is dropped; ui.bizView is kept.
  const { scheduleView, ...ui } = s.ui || {};
  s = { ...s, v: 22, ui };
}
```
Why a block although nothing is backfilled: the repo convention since v15 is that every new persisted field gets a block and a `v` bump, so `@schema`, `docs/generated/db-schema.md` and the `flow4` fixtures name the version that introduced it and a backup from a newer app cannot be mistaken for an older shape. `freshState`: `v: 22`, `ui: { bizView: "deals" }`. `@schema`: `v: 22`, `tasks[]` gains `score?(string — exam milestones, as entered, display only)`, `exams.best{famId:{label,d,p,ver,date,score?}}`, `ui: { bizView(…) }` with `scheduleView` removed. `demoState`: `exams.best.toeic` gains `score: "735"`.

Smoke (`tools/harness/smoke-logic.js`, data checks only): add a section **exam score input** that evaluates `EXAMS` and asserts (a) exactly 13 families have all-numeric band labels and the other 4 are `opic`, `cambridge`, `jlpt`, `hsk`; (b) in every numeric family `parseFloat` of the band labels is strictly ascending, so "below the band" and "above the top band" are well defined. Mirror `examScoreNumeric` locally, as the file mirrors other app formulas.

Korean strings — added: `점수`, `성적표에 적힌 점수 — 숫자만`, `성적표에 적힌 등급·점수 그대로`, `점수는 기록용이에요 — 지급 P·등급·난이도는 {label} 구간 기준 그대로예요.`, `성적표에 적힌 점수를 입력해 주세요.`, `점수는 20자까지예요.`, `점수는 숫자로 입력해 주세요.`, `{label} 구간 미만 점수예요 — 이 마일스톤은 {label} 이상일 때 완료해요.`, `{name} 최고 점수는 {max}예요.`, `{name} {label} 구간` (CV and profile without a score), ` · 점수 {score}` (wall), `성적표 사진 + 점수 필수` (sheet). Removed: `성적표 사진 필수` from the task sheet. Changed: the CV `시험` row and the `보유 기록` line now print the score (or `… 구간`).

E2E edits (phase 4):
- `run.js` `submitPhotoEvidence(title, { score } = {})`: after `attach()`, when `score` is given, `typeInto("성적표에 적힌", score)`.
- `flow3.js`: before `submit score report photo (exam payout)` add **`the score report needs a score inside the band`**: `clickTab("할 일")`, `completeQuest("TOEIC")`, `attach()`, then in turn: submit with no score → `modalError()` is `성적표에 적힌 점수를 입력해 주세요.`; `abc` → `점수는 숫자로 입력해 주세요.`; `790` → contains `800 구간 미만 점수예요`; `1000` → `TOEIC L&R 최고 점수는 990예요.`; after each, the save's task is still open and `localStorage` has no `liferpg-img-ev-{id}` key; `closeModal()`. Change the submit step to `submitPhotoEvidence("TOEIC", { score: "835" })` and add **`the exact score is stored beside an unchanged band`**: from the save, the exam task has `score === "835"` and `band.label === "800"`; `exams.best.toeic` has `score === "835"`, `label === "800"`, `p === 720`, `d === 60`; the newest achievement text starts `TOEIC L&R 800 — D60`. Then `clickTab("프로필")`: the CV contains `TOEIC L&R 835` and not `D60`.
- `flow3.js` new step **`a same-band retake updates only the shown score`**: plant a second open task `{ id: "tretake", title: "TOEIC L&R 800 재응시", isExam: true, famId: "toeic", band: <the stored band>, goalId: <the exam goal id>, areaId: <same>, diff: "B", pts: 720, type: "once", status: "todo", doneDates: [], createdAt: today }`, reload, `submitPhotoEvidence("800 재응시", { score: "870" })`; `exams.best.toeic` is `{ …same label, d, p, date…, score: "870" }` and `exams.dim.toeic` is unchanged.
- `flow7.js` `a save that stored the list view opens on the calendar`: the final assertion becomes `!("scheduleView" in (st.ui || {}))` (v22 dropped it on load).
- `flow8.js` `the chosen business view survives a reload`: replace the `scheduleView !== "list"` check with `if ("scheduleView" in (after.ui || {})) throw new Error("the retired schedule view came back: " + JSON.stringify(after.ui))`.
- `flow4.js`: introduce `const SCHEMA_V = 22;` at the top and use it in `migrateFixture`, `v10 save migration`, `legacy save without v migration` and the half-onboarded half of `v20 save → v21 CV records`. In the v17, v18, v19, v20 and v21 fixture steps, replace every `st.ui?.scheduleView` end-state assertion with `"scheduleView" in (st.ui || {})` being false (comment: the v17 normalisation is no longer observable in an end state, the v12 precedent), and keep the `bizView` assertions. Add **`v21 save → v22 exam score fields`**: a v21 save with `ui: { scheduleView: "calendar", bizView: "rates" }`, one done exam task without `score` and `exams.best.toeic = { label: "700", d: 49, p: 480, ver: "1.0", date: "2026-01-02" }`; after `migrateFixture`: `v === 22`, `ui` deep-equals `{ bizView: "rates" }`, the task and `exams.best.toeic` deep-equal their planted values (no invented `score`), every other array length unchanged, and `clickTab("프로필")` shows `TOEIC L&R 700 구간`.

Acceptance: an exam milestone cannot complete without a valid score; `835` for an `800` milestone pays exactly what it paid before this change; the CV reads `TOEIC L&R 835`; an old save shows `… 구간`; the demo CV reads `TOEIC L&R 735`.

Gate 4: `npm run build` · `npm run smoke` · `npm run finish` · `npm run lang:check` · `npm run docs:gen && npm run docs:check` · `node --check` on every edited `tools/e2e` file · `git diff` shows `calcExamPayout`, `EXAMS`, v11–v21 blocks byte-identical.

### Phase 5 — the `미팅` tab (schema v23) — needs approval
**D-P5a — what a meeting record is.** A record of what was said, never a task, never an appointment:
```
meetingProjects: [{ id, name, note?, createdAt }]
meetings: [{ id, projectId, date("YYYY-MM-DD"), title, attendees?, summary, decisions?, actions?, eventId?, createdAt }]
```
No time, place, repeat, reminder, status, goal, points or evidence fields: **the time of a meeting lives only in `일정`** (the 2026-09-11 decision that removed the `meet` kind because meetings overlap the schedule tab stands). `date` is the day the minutes belong to — needed to order minutes even when no event exists. `eventId` optionally points at the `일정` event whose occurrence falls on `date` (for a repeating event, `eventId` + `date` identify the occurrence); the meeting copies nothing from it and reads its time and title at render. Deleting an event never deletes minutes: the view states the link is gone. `removeEvent`, `updateEvent`, `toggleEventDone`, `EventRow` and `ScheduleCalendar` are not changed; `todoOf`, `agendaOf`, `buildBriefing`, `buildAssistantPacket`, `parseAssistantReply`, `calendarExportOf` do not read `meetings` (a later decision may add that).

Full transcripts are not stored (user decision): `summary` is a hand-written or pasted minutes-style summary.

**D-P5b — caps and the storage arithmetic.** `MEETING_LIMITS = { title: 40, attendees: 80, summary: 800, decisions: 200, actions: 200 }`, `PROJECT_LIMITS = { name: 40, note: 200 }`. 800 Hangul characters is a page of key points, not a transcript.
- Unit: `storageUsedBytes` counts string length, so the budget is 3,672,064 chars, shared with the rest of the save and every thumbnail. `JSON.stringify` keeps Hangul as one char; a newline costs two (`\n`).
- Overhead of an empty record (ten-char `uid`s, both dates, all keys, comma) measured at 189 chars → ~190.
- Largest record: 40 + 80 + 800 + 200 + 200 + 190 = **1,510 chars**, plus one per newline.
- Typical record assumed: title 25, attendees 30, summary 400, decisions 100, actions 100 → 655 + 190 = **~850 chars**.
- Frequency assumed: "several a day" = 3 meetings per working day × 250 days = **750 records a year** (2 a day = 500).

| Case | Per year | Share of 3.5 MB after 3 years | after 5 years |
|---|---|---|---|
| 3/day, typical (850) | 0.64 M chars | 1.91 M (52 %) | 3.19 M (87 %) |
| 2/day, typical (850) | 0.43 M chars | 1.28 M (35 %) | 2.13 M (58 %) |
| 3/day, every field full (1,510) | 1.13 M chars | 3.40 M (93 %) | exceeds |

So typical minutes fit three to five years at several a day; completely full records at three a day fit about three. The caps alone cannot promise more, so two facts guard the rest: (1) the meetings tab states `저장 공간 {used}MB / 3.5MB` at all times (`storageUsedBytes`, memoised on `state`); (2) saving a meeting is refused, with the form kept open and nothing lost, when `storageUsedBytes() + JSON.stringify(next).length − (old record length when editing) > STORAGE_BUDGET`. The backup file is the way out (export, then delete old minutes). No IndexedDB. Serialising a multi-megabyte state on every change is recorded as tech debt (TD-45).

**D-P5c — the tab.** `NAV` inserts `["meetings", "미팅", MessagesSquare]` between `일정` and `사업`: `프로필 · 목표 · 할 일 · 일정 · 미팅 · 사업`. Position: next to `일정`, because a meeting's time is an `일정` event and its minutes link to it; before `사업`, because projects are usually client work recorded under `사업`; the three planning tabs (`목표`, `할 일`, `일정`) stay contiguous. The bar becomes `grid-cols-6`; labels stay on one line (D-P2a).

`MeetingsTab({ state, onAddProject, onEditProject, onAddMeeting, onOpenMeeting })` in a new region `/* ── Meetings ── */` after the business region:
- Header section: `SectionLabel tone="text-cyan-400"` `미팅 — 프로젝트별 회의록` and, on the right, `프로젝트 추가` (the `일정 추가` button style); caption `<p className="text-xs text-zinc-600 mt-0.5">회의 시간은 일정 탭에, 회의에서 나온 내용은 여기에 적어요. 회의록은 목표·실행·점수에 반영되지 않아요.</p>`; counts line `font-mono text-xs text-zinc-400`: `프로젝트 {p}개 · 회의록 {n}건 · 저장 공간 {mb}MB / 3.5MB` (`mb` with one decimal).
- No project: one section `프로젝트가 없어요 — 프로젝트를 먼저 만들어요.`.
- One section per project, ordered by its newest meeting date (desc), projects without minutes last by `createdAt` desc. Section head: name (`text-sm font-bold truncate`), `회의록 {n}건` (mono), buttons `프로젝트 수정` and `회의록 추가` (`px-2.5 py-1.5 rounded-lg border border-zinc-700 text-xs font-bold`). Rows newest first (`date` desc, then `createdAt` desc): a `<button>` in the `TodoRow` shell — lead chip `{date.slice(2)}` (`YY-MM-DD`, zinc), the title, no marker — → `onOpenMeeting(id)`. The first `MEETING_ROWS_SHOWN = 5` rows, then `{n}건 더 보기` / `접기` (component state). Empty project: `회의록이 없어요.`.

**D-P5d — sheets.**
- `ProjectModal({ project, meetingCount, onClose, onAdd, onUpdate, onRemove })`, `modal: { type: "project", projectId? }`, title `새 프로젝트` / `프로젝트 수정`: inputs `프로젝트 이름 — 예: ○○물산 재고 관리`, `메모 (선택)`; errors `프로젝트 이름을 입력해 주세요.`, `프로젝트 이름은 40자까지예요 — 지금 {n}자예요.`, `메모는 200자까지예요 — 지금 {n}자예요.`; button `등록` / `저장`; in edit mode `삭제` — enabled only when `meetingCount === 0` (no confirm: nothing is lost), otherwise disabled with `회의록 {n}건이 있어 삭제할 수 없어요 — 회의록을 먼저 지워요.`. The root handler refuses a project with minutes too.
- `MeetingModal({ state, meeting, projectId, today, onClose, onAdd, onUpdate, onRemove })`, `modal: { type: "meeting", meetingId?, projectId? }`, title `새 회의록` / `회의록 수정`: `프로젝트` chips (preselected), `날짜` date input (default `today`), inputs `회의 이름 — 예: 2차 요구사항 회의`, `참석자 (선택) — 예: 김OO, 박OO`; textareas `회의 요약 — 논의한 내용을 요점으로 적어요` (`rows={8}`), `결정 사항 (선택)`, `후속 조치 (선택)` (`rows={3}`), each with a counter `{n} / {cap}` (`font-mono`, rose when over); `일정 연결 (선택)` chips from `eventsOn(state, date)`: `연결 안 함` plus `{ev.time || "시간 미정"} {ev.title}`, or the line `이 날짜에는 일정이 없어요.`; changing the date clears a link that no longer matches. Note `전체 녹취가 아니라 요약만 저장해요.`. No `maxLength` (a paste is never silently truncated); submit refuses with `프로젝트를 골라 주세요.`, `날짜를 선택해 주세요.`, `회의 이름을 입력해 주세요.`, `회의 요약을 입력해 주세요.`, `회의 이름은 40자까지예요 — 지금 {n}자예요.`, `참석자는 80자까지예요 — 지금 {n}자예요.`, `회의 요약은 800자까지예요 — 지금 {n}자예요.`, `결정 사항은 200자까지예요 — 지금 {n}자예요.`, `후속 조치는 200자까지예요 — 지금 {n}자예요.`. The record is built with only non-empty optional fields. `onAdd` / `onUpdate` return an error string or `""`; a non-empty return is shown as the modal error: `저장 공간이 부족해요 — 현재 {mb}MB 사용 중이라 회의록을 저장하지 않았어요. 백업을 내보낸 뒤 오래된 회의록이나 사진을 지워요.`. Edit mode has `삭제` → root `removeMeeting` with `window.confirm("{title} 회의록을 삭제해요. 계속할까요?")`.
- `MeetingViewModal({ state, meetingId, onClose, onEdit })`, `modal: { type: "meetingView", meetingId }`, title `{title}`: `CvFact wrap` rows `프로젝트`, `날짜` (mono), `참석자` (or `기록 없음`), `일정` (`{time || "시간 미정"} {title}` from the live event; `연결 없음`; or `연결된 일정이 삭제됐어요` when the id matches nothing); then three blocks with `SectionLabel` `요약`, `결정 사항`, `후속 조치`, each `<p className="text-sm text-zinc-200 whitespace-pre-wrap break-words">` (or `없음`); a full-width `수정` button → `setModal({ type: "meeting", meetingId })`.
- Root handlers (clone pattern, next to the business handlers): `addProject`, `updateProject`, `removeProject`, `addMeeting`, `updateMeeting` (form replaces the record, keeps `id`, `createdAt`), `removeMeeting`, and `meetingFits(next, prevLen)`. Toasts: `프로젝트를 등록했어요`, `프로젝트를 수정했어요`, `프로젝트를 삭제했어요`, `회의록을 등록했어요`, `회의록을 수정했어요`, `회의록을 삭제했어요`. None of them touches `act`, `tasks`, `goals`, `areas`, `room`, `exams` or `events`.

**D-P5e — v23, backup, demo.** Append:
```js
if (s.v < 23) {
  // v23: meeting minutes — meetingProjects[] and meetings[], hand-written records grouped by project. A record, never a
  // task: no payout, no trophy, no goal, no streak (rules 1, 18). The time of a meeting stays a schedule event; a meeting
  // stores only its date and an optional eventId. Nothing existing is changed.
  s = { ...s, v: 23, meetingProjects: s.meetingProjects || [], meetings: s.meetings || [] };
}
```
`freshState`: `v: 23`, `meetingProjects: []`, `meetings: []`. `@schema`: `v: 23` and the two arrays with a comment that they are records, that time lives in `events`, and that nothing derived is stored. Backup: `exportBackup` writes `state` whole, so both arrays are in the file without a code change; `importBackup` runs `migrate`, so an older backup gains empty arrays; `resetAll` deletes the state key, which removes minutes with everything else. `demoState`: two synthetic projects (`○○물산 재고 관리 자동화`, `△△테크 문서 검색 AI`) and three short synthetic minutes dated −9, −3 and −1 days, no personal names (use `담당자 A`, `담당자 B`), no `eventId`.

Korean strings — added: `미팅` (nav), `미팅 — 프로젝트별 회의록`, `프로젝트 추가`, `회의 시간은 일정 탭에, 회의에서 나온 내용은 여기에 적어요. 회의록은 목표·실행·점수에 반영되지 않아요.`, `프로젝트 {p}개 · 회의록 {n}건 · 저장 공간 {mb}MB / 3.5MB`, `프로젝트가 없어요 — 프로젝트를 먼저 만들어요.`, `회의록 {n}건`, `프로젝트 수정`, `회의록 추가`, `{n}건 더 보기`, `접기`, `회의록이 없어요.`, `새 프로젝트`, `프로젝트 이름 — 예: ○○물산 재고 관리`, `메모 (선택)`, `프로젝트 이름을 입력해 주세요.`, `프로젝트 이름은 40자까지예요 — 지금 {n}자예요.`, `메모는 200자까지예요 — 지금 {n}자예요.`, `회의록 {n}건이 있어 삭제할 수 없어요 — 회의록을 먼저 지워요.`, `새 회의록`, `회의록 수정`, `프로젝트`, `날짜`, `회의 이름 — 예: 2차 요구사항 회의`, `참석자 (선택) — 예: 김OO, 박OO`, `회의 요약 — 논의한 내용을 요점으로 적어요`, `결정 사항 (선택)`, `후속 조치 (선택)`, `일정 연결 (선택)`, `연결 안 함`, `시간 미정` (existing copy), `이 날짜에는 일정이 없어요.` (existing copy), `전체 녹취가 아니라 요약만 저장해요.`, `프로젝트를 골라 주세요.`, `날짜를 선택해 주세요.` (existing copy), `회의 이름을 입력해 주세요.`, `회의 요약을 입력해 주세요.`, the four `…자까지예요 — 지금 {n}자예요.` messages above, `저장 공간이 부족해요 — 현재 {mb}MB 사용 중이라 회의록을 저장하지 않았어요. 백업을 내보낸 뒤 오래된 회의록이나 사진을 지워요.`, `{title} 회의록을 삭제해요. 계속할까요?`, `참석자`, `기록 없음`, `일정`, `연결 없음`, `연결된 일정이 삭제됐어요`, `요약`, `결정 사항`, `후속 조치`, `없음`, `수정`, `등록`, `저장`, `삭제`, and the six toasts. Removed: none.

E2E edits (phase 5):
- `flow.js` nav step → **`bottom nav order and one-line labels (profile, goals, to-do, schedule, meetings, business)`**: `want = ["프로필", "목표", "할 일", "일정", "미팅", "사업"]`, `grid-cols-6`, the one-line checks; demo sweep adds `미팅`.
- New `tools/e2e/flow10.js`, required from `flow.js` after `flow9.js` and before `flow4.js` (flow4 replaces the save). Header comment: a meeting is a record, never a task. Steps:
  1. **`meetings tab starts empty and states its storage use`** — `clickTab("미팅")`; `프로젝트가 없어요 — 프로젝트를 먼저 만들어요.`; counts line matches `/^프로젝트 0개 · 회의록 0건 · 저장 공간 \d+\.\dMB \/ 3\.5MB$/`.
  2. **`the project form refuses an empty name, then registers`** — `프로젝트 추가`, `등록` → `프로젝트 이름을 입력해 주세요.`; type `E2E 프로젝트`, `등록`; the save has one project with only `id`, `name`, `createdAt`.
  3. **`the meeting form refuses a missing title, a missing summary and an over-cap summary`** — `회의록 추가`; `등록` → `회의 이름을 입력해 주세요.`; title `킥오프 회의`, `등록` → `회의 요약을 입력해 주세요.`; `setValue` an 801-char summary → `회의 요약은 800자까지예요 — 지금 801자예요.`; the save has zero meetings.
  4. **`meetings register under their project, newest first, and pay nothing`** — capture `boundary(state)` (copy flow8's helper: trophies, achievements, streak, shields, lastActive, tasks, goals, plus `events`); add `킥오프 회의` dated −2 with a two-line summary and `주간 점검` dated today; the section's first row is `주간 점검`, its lead chip is today as `YY-MM-DD`; `boundary` is unchanged; each stored meeting has no `time`, `place`, `repeat`, `goalId`, `pts` or `diff` key.
  5. **`a meeting links to a schedule occurrence on its date without copying it`** — in `일정`, add `주간 회의` today at `10:00` (flow7's `addEvent` pattern); in `미팅`, add a meeting dated today and tap the chip `10:00 주간 회의`; the stored `eventId` equals the event's id and the record has no `time`; open the row: the view states `10:00 주간 회의`; delete the event in `일정` (row `수정` → `삭제`); the meeting is still stored and its view states `연결된 일정이 삭제됐어요`.
  6. **`the view shows the full minutes and editing replaces the record`** — open `킥오프 회의`: overlay text contains both summary lines; `수정`, change the title to `킥오프 회의 1차`, `저장`; stored title changed, `id` and `createdAt` unchanged.
  7. **`a project with minutes cannot be deleted; an empty one can`** — `프로젝트 수정`: the `삭제` button is disabled and `회의록 3건이 있어 삭제할 수 없어요 — 회의록을 먼저 지워요.` is shown; stub `window.confirm = () => true`, delete the three meetings from their edit forms; `프로젝트 수정` → `삭제` → no project in the save.
  8. **`a meeting that would exceed the storage budget is refused and the form stays open`** — recreate a project; plant `localStorage.setItem("e2e-filler", "x".repeat(3672064 - used + 100))` where `used` is computed in the page the same way as `storageUsedBytes`; add a meeting → modal error starts `저장 공간이 부족해요 — 현재`; the overlay is still open with the typed title; no meeting stored; in `finally`, remove `e2e-filler` and reload.
  9. **`meetings travel in the backup file`** — add one meeting; `captureDownload(() => clickInModal("백업 내보내기"))` after `openSettings()`; parse `text`; `state.meetings` and `state.meetingProjects` deep-equal the save's arrays.
  10. **`the briefing, the to-do list and the packet never read a meeting`** — the meeting title is absent from `todoRows()` titles, from the briefing `overlayText()`, and from the packet textarea (`브리핑 열기` → `AI에게 보내기`).
- `flow4.js`: `SCHEMA_V = 23`; add **`v22 save → v23 meeting records`**: a v22 save without the two arrays → `meetingProjects` and `meetings` are `[]`, every other top-level key deep-equals the planted value except `v` and `lastTick`; `clickTab("미팅")` shows `프로젝트가 없어요 — 프로젝트를 먼저 만들어요.`.
- `gen-screenshots.js`: add `{ file: "meetings.png", tab: "미팅" }`; manifest adds `{ "src": "./screenshots/meetings.png", "sizes": "430x932", "type": "image/png", "form_factor": "narrow", "label": "프로젝트별 회의록" }`.

Acceptance: six one-line nav labels at 390 px; a project and its minutes can be created, read in full, edited and deleted; a project with minutes cannot be deleted; nothing outside `meetingProjects` / `meetings` changes when minutes are saved; minutes appear in the backup file; the demo shows two projects with three minutes.

Gate 5: `npm run build` · `npm run finish` · `npm run lang:check` · `npm run docs:gen && npm run docs:check` · `node --check tools/e2e/flow10.js` and every other edited E2E file · `git diff` shows v11–v22 blocks byte-identical.

### Final step (after the last phase that lands)
`npm run build:demo`, then `node tools/harness/gen-screenshots.js` (rewrites `public/screenshots/*.png`: `home`, `tasks`, `goals`, `calendar`, and `meetings` once phase 5 lands). Then the docs-syncer (below) and the report: what changed per phase, the commands run with results, the plain sentence "E2E steps were updated but not executed (standing user instruction)", findings, and the proposed commit message(s). Do not commit unless the user approves the gate.

## Steps
1. Phase 1 — implementer: D-P1 and its E2E edit → cleanup (`npm run finish`) → verifier (Gate 1) → report.
2. Phase 2 — implementer: D-P2a, D-P2b, bench scripts, `gen-screenshots.js` → cleanup → verifier (Gate 2) → report.
3. Phase 3 — implementer: D-P3a–e, E2E helper rewrite and step edits, manifest `tasks.png` label → cleanup → verifier (Gate 3) → report.
4. **Ask the user to approve phases 4 and 5** (new migrate blocks v22 and v23; the retired `ui.scheduleView` is dropped at v22). Proceed only on the user's own approval.
5. Phase 4 — implementer: D-P4a–e, smoke section, E2E edits and the v22 fixture → cleanup → verifier (Gate 4, includes smoke) → report.
6. Phase 5 — implementer: D-P5a–e, `flow10.js`, v23 fixture, screenshot entry → cleanup → verifier (Gate 5) → report.
7. Final step: `npm run build:demo`, `node tools/harness/gen-screenshots.js`; docs-syncer updates every doc below, `npm run docs:gen && npm run docs:check`, moves this plan to `completed/`.
8. The user does the 390 px phone check below.

## Verification
No gate runs `npm run verify` or the puppeteer suite. E2E is updated but not executed.

| Gate | Commands |
|---|---|
| every phase | `npm run build` · `npm run finish` · `npm run lang:check` · `node --check <each edited tools/e2e and tools/harness file>` |
| phases 4, 5 | + `npm run docs:gen && npm run docs:check` |
| phase 4 | + `npm run smoke` |
| final | `npm run build:demo` · `node tools/harness/gen-screenshots.js` · `npm run docs:gen && npm run docs:check` |

Manual check the user can do on the phone (390 px wide, demo data or their own save; take a backup first for phases 4–5):
1. Bottom bar shows `프로필 · 목표 · 할 일 · 일정 · 미팅 · 사업`, every label on one line, the active tab cyan.
2. `프로필`: the `자격` and `시험` rows show names without `D` numbers; the exam row shows the exact score, or `… 구간` for an older record; `프로필 편집` opens the profile screen.
3. `일정`: only the month grid, today selected; no `목록` / `달력`; `캘린더로 내보내기` still in the header; the briefing's schedule line lands here.
4. `할 일`: each item is one line (D-day chip, title, and `목표 기여 없음` or a lock where applicable); nothing scrolls sideways; tapping an item opens its sheet; `완료하기` on a normal task completes it; on a certification or exam it opens the photo submission; the `완료` view lists dates and its sheets have no `완료하기`.
5. An exam milestone refuses submission without a score, refuses a score below its band, accepts a valid one; the paid P shown in the overlay matches the band.
6. `미팅`: create a project, add minutes with a long pasted summary (the counter turns rose over 800 and saving refuses), link today's `일정` event, reopen the minutes and read them in full; the storage line shows the MB used.
7. Export a backup from `설정` and confirm the file contains `meetings`.

## Cleanup checklist
- [ ] `npm run finish` exit 0 at every gate (unused symbols: `Flag`, `DueChip`, `BizTodoRow`, `setScheduleView`, `EventRow`'s `tail`, any list-only locals in `ScheduleTab`; unused imports; duplicates across the three detail sheets — share `CvFact` rather than copying row markup)
- [ ] No allowlist addition expected; any addition is mirrored in `tech-debt-tracker.md` with a reason
- [ ] `git diff` confirms the frozen symbols in the Prompt are byte-identical
- [ ] No Korean outside UI copy, data rows, `demoState`, E2E selector arguments (`npm run lang:check`)

## Docs to sync
- `docs/product-specs/home.md` — tab named `프로필`; the `프로필 편집` button; `자격` / `시험` rows without `D`; exam score or `… 구간`.
- `docs/product-specs/tasks.md` — tab named `할 일`; `TodoRow` (lead chip rules, the one-marker rule and its reasons); `TaskDetailModal`, `EventDetailModal`, `BizTodoModal`; completion only from the task sheet; archive `MM-DD` chips.
- `docs/product-specs/schedule.md` — calendar only; the header (counts line, export button); where missed deadlines are visible now; `ui.scheduleView` retired (read by nothing since phase 2, dropped at v22); `EventRow` also renders in the event sheet.
- New `docs/product-specs/meetings.md` — purpose (storage only, no AI, no API), the record shape, projects, the three sheets, caps and the storage arithmetic table, the budget guard, the relation to `일정` (time lives in the event; `eventId` + `date`; dangling link display), what a meeting never does, backup and reset behaviour.
- `docs/product-specs/index.md` — six tabs `프로필 · 목표 · 할 일 · 일정 · 미팅 · 사업`, the new modals, the meetings row in the table.
- `docs/product-specs/evidence-modals.md` — the exam score field, validation order and messages.
- `docs/product-specs/daily-briefing.md` — opened from the `할 일` header (label change only).
- `docs/product-specs/install-and-backup.md` — minutes are in the backup file; `meetings.png` screenshot.
- `docs/design-docs/information-architecture.md` — screen map, six tabs, modal count 22 → 28 (`taskDetail`, `eventDetail`, `bizDetail`, `project`, `meeting`, `meetingView`), the meetings record in the hierarchy (outside the goal ladder, like events and business).
- `docs/design-docs/state-lifecycle.md` — v22 (score fields, `ui.scheduleView` dropped) and v23 (meeting arrays) blocks and why v22 exists without a backfill.
- `docs/design-docs/evidence-and-promotion.md` — the exam gate now also needs a score within the band's range; no relaxation.
- `docs/design-docs/scoring-engine.md` — `score` is display-only; `exams.best` replacement unchanged; the equal-band score merge.
- `docs/DESIGN.md` — six-tab invariant (2026-09-16, user decision adding `미팅`), icon list (`Flag` out, `IdCard` and `MessagesSquare` in), screen inventory (A3 `프로필`, A5 compact rows and sheets, new meetings screen), nav label nowrap.
- `docs/FRONTEND.md` — no change unless the implementer adds a convention (e.g., `CvFact wrap`).
- `docs/SECURITY.md` — minutes may contain client names, prices and decisions; they are stored unencrypted in `localStorage` and in the plaintext backup JSON; the demo ships synthetic minutes only; nothing is sent anywhere.
- `docs/RELIABILITY.md` — the meeting storage guard and the storage-line fact; E2E suite updated 2026-09-16 but not executed; new `flow10.js` in the chain.
- `ARCHITECTURE.md` — regions (`TaskTab` rows and sheets, `ScheduleTab` calendar only, new Meetings region, new modals, root handlers), status line (schema v23, six tabs, modal count, E2E "updated, not run"), glossary rows `할 일` (tab) and `미팅 (프로젝트 · 회의록)`.
- `tools/e2e/README.md` — `flow10.js` in the chain; helpers `openTodo`, `completeQuest` via the sheet, `submitPhotoEvidence` score; the static step count (count `step(` calls) marked not executed since 2026-09-16.
- `docs/exec-plans/tech-debt-tracker.md` — resolve TD-40 (bench tab labels) and TD-41 (manifest label); add TD-44 (S2, E2E harness: the suite was edited in five phases without a run — first run pending the user), TD-45 (S3, reliability: the whole state including minutes is re-serialised on every change; measure at 2 MB), TD-46 (S3, meetings: a deleted event leaves `eventId` dangling — displayed, never cleaned, by design), TD-47 (S3, tasks: `삭제` in the task sheet still deletes without asking, carried from the row's `X`, unless an existing entry already tracks it).
- `docs/exec-plans/backlog.md` — meeting search; marking events that have minutes in the calendar panel; whether the packet may read minutes (needs a user decision under Rule 7's amendment).
- `docs/design-docs/decision-log.md` — one 2026-09-16 row: the user's verbatim request, the six decisions, schema v22/v23, links to this plan.
- `docs/generated/*` — only via `npm run docs:gen` (db-schema from `@schema`, symbol index).

## Proposed commit
One commit per phase, each only at a gate the user approves:
1. `fix(home): drop difficulty figures from the CV's certification and exam rows`
2. `feat(nav): rename the home and task tabs and make the schedule tab calendar-only`
3. `feat(tasks): one-line to-do rows with detail sheets; completion moves into the sheet`
4. `feat(exams): record the exact score on exam milestones (schema v22, display only)`
5. `feat(meetings): a sixth tab for project minutes, stored locally only (schema v23)`

Each message ends with the attribution lines from the session's system reminder.
