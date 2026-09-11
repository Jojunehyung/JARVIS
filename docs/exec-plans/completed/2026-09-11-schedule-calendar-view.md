# Schedule tab — a calendar view beside the list

- Status: completed
- Date: 2026-09-11
- Needs approval: yes — one new `migrate` block (schema v17) and a new persisted field ([Rule 12](../../design-docs/core-beliefs.md#rule-12)). No data table, no storage-key change, no user data deleted.
- Agents: planner → implementer → cleanup → verifier → docs-syncer

## Goal
The `일정` tab (shipped 2026-09-11, commit `7426a97`) renders one list grouped by day, which answers "what is next" but not "what does this month look like". Add a view toggle at the top of the same tab: `목록` keeps today's behaviour and copy exactly, `달력` shows the current month as a seven-column grid with one marker per occurrence, a selected-day panel that reuses the list's own row, and an `일정 추가` button prefilled with the selected date. The chosen view is remembered across sessions.

## Context read
`src/LifeManager.jsx`: `dstr`/`shiftDay`/`monthStr` (L1216-1221), `SectionLabel`/`Chip`/`Modal` (L1718-1766), `daysBetween`/`mondayOf`/`ddayStr` (L1793-1802), `EVENT_KIND_LABEL`/`REPEAT_LABEL`/`EVENT_HORIZON_DAYS`/`EVENT_PAST_DAYS`/`occurrencesOf`/`eventsOn`/`upcomingEvents` (L2099-2154), `@schema` JSDoc v16 + `migrate` v15/v16 blocks + `freshState` + `demoState` (L2385-2545), `ScheduleTab` incl. its inner `row` (L4683-4786), `EventModal` (L4788-4880), `addEvent`/`updateEvent`/`removeEvent`/`toggleEventDone`/`skipOccurrence` (L5221-5270), `resetAll`, `exportBackup`, `modal.type: "event"` (L5476-5532). Harness: `tools/e2e/run.js` (`clickTab`, `clickText`, `clickInModalExact`, `setValue`, `expectText`, `reload`, `page`), `flow7.js` (its `rows`/`addEvent`/`dstrIn` helpers), `flow.js` L33, `flow4.js` L13/84/108 + the `v15 save → v16 schedule` step, `flow6.js` L87. Docs: [schedule.md](../../product-specs/schedule.md), [assistant-bridge.md](../../design-docs/assistant-bridge.md), [state-lifecycle.md](../../design-docs/state-lifecycle.md), [information-architecture.md](../../design-docs/information-architecture.md), [FRONTEND.md](../../FRONTEND.md), [DESIGN.md](../../DESIGN.md), [ARCHITECTURE.md](../../../ARCHITECTURE.md), AGENTS §5/§6. Rules touched: [9](../../design-docs/core-beliefs.md#rule-9), [12](../../design-docs/core-beliefs.md#rule-12), [13](../../design-docs/core-beliefs.md#rule-13); kept untouched by construction: [1](../../design-docs/core-beliefs.md#rule-1), [7](../../design-docs/core-beliefs.md#rule-7), [8](../../design-docs/core-beliefs.md#rule-8), [10](../../design-docs/core-beliefs.md#rule-10), [16](../../design-docs/core-beliefs.md#rule-16), [17](../../design-docs/core-beliefs.md#rule-17), [18](../../design-docs/core-beliefs.md#rule-18), [19](../../design-docs/core-beliefs.md#rule-19).

## Prompt
Add a calendar view to the `일정` tab in two phases; each phase ends at the gate below. An event stays a record, never a `실행` (task): no points, no trophy, no achievement record, no metric change, no streak effect, no evidence gate and no `goalId` ([Rules 1](../../design-docs/core-beliefs.md#rule-1), [8](../../design-docs/core-beliefs.md#rule-8), [10](../../design-docs/core-beliefs.md#rule-10), [18](../../design-docs/core-beliefs.md#rule-18)). New code must not call `completeTask`, `tryComplete`, `spawnTask`, `metricsGain`, `needsEvidence`, `detectKind` or `certByTitle`. Copy is Korean `해요체`, facts and numbers only ([Rule 13](../../design-docs/core-beliefs.md#rule-13)); identifiers, comments and docs are English (AGENTS §6). Tailwind v3 core utilities only — no arbitrary values (`h-[56px]`, `w-[…]`), and the grid must fit 390 px with no horizontal scroll. `store` call sites unchanged; `resetAll` and `exportBackup` need no edit because the new field lives inside the state object.

**Occurrences (no second expansion path, [Rule 9](../../design-docs/core-beliefs.md#rule-9)).** The month grid calls `upcomingEvents(state, monthStart, daysInMonth)` **once** inside a `useMemo` keyed on `[state, monthStart, daysInMonth]` and reduces the result into a render-local `Map<date, occurrences[]>`. Use `upcomingEvents`, not a per-cell `eventsOn` loop: `upcomingEvents` already *is* the windowed helper (it loops `eventsOn` internally), so 28–31 separate calls would re-implement its loop in the component, and one map guarantees the grid and the panel cannot disagree. Do not add a new helper, do not memoise across months, and never write the map, a month index or a selection into `state`. `daysInMonth = new Date(y, m + 1, 0).getDate()` — the same idiom `occurrencesOf` already uses for monthly clamping.

**Grid.** `monthStart = "{YYYY}-{MM}-01"`; the weekday of the 1st is `new Date(monthStart + "T12:00:00").getDay()` (noon-anchored like `shiftDay`/`mondayOf`; never `toISOString`), 0 = Sunday, which matches the `일`-first header. Cell count is `Math.ceil((firstDow + daysInMonth) / 7) * 7`, so the last row is never empty. Leading and trailing cells are **blank non-interactive placeholders** — no day number, no markers, no tap target — they only hold the seven-column alignment; a neighbouring month is reached with `‹` / `›`. Layout: `grid grid-cols-7 gap-1`, each cell a `h-14 rounded-lg` button, day number `text-xs font-mono`. Today's day number is `text-amber-300 font-bold`; the selected cell adds `bg-zinc-800 border border-cyan-500` (other cells `bg-zinc-950 border border-transparent`), so today and the selection are marked differently and can coexist. Markers: under the day number, at most three dots (`w-1.5 h-1.5 rounded-full`), `마감` → `bg-rose-400`, `약속` → `bg-cyan-400`, a ticked occurrence's dot at `opacity-50` like its list row; when more than three remain, append `+{n}` (`text-xs font-mono text-zinc-500`) where `n` is the remainder. Titles never appear in a cell — at 390 px a cell is about 47 px wide.

**Month range.** Past months are browsable — a schedule is also a record, and unlike the list's `지난 마감` window (`EVENT_PAST_DAYS`, deadlines only) a past month shows both kinds, with the panel's `완료 표시` / `수정` still reachable. Paging is bounded by one new constant `CAL_RANGE_MONTHS = 24`: `‹` and `›` are disabled (`opacity-30`, no handler) outside `[today − 24 months, today + 24 months]`, so `‹` cannot walk into years of empty grids; `오늘` always returns to the current month and selects today.

**Panel.** Directly under the grid: `SectionLabel` `선택한 날짜`, a mono line `{YYYY-MM-DD} · {n}건`, the day's occurrences, then the `일정 추가` button. Rows come from the list view's row markup **extracted** into a module-level `EventRow({ ev, date, done, today, onToggleDone, onSkip, onEdit })` used by both views — do not copy the markup, `finish-check` flags duplicate blocks. A day with no occurrence shows `이 날짜에는 일정이 없어요.` instead of rows. In `달력` view the header's `일정 추가` button is **hidden** so exactly one button with that label exists at a time; the panel's button calls `onAdd(selected)`. Root: `onAdd={(date) => setModal({ type: "event", date })}`, `<EventModal … initialDate={modal.date} />`, and inside the modal `useState(event?.date || initialDate || "")`. The list view's button must become `onClick={() => onAdd()}` — `onClick={onAdd}` would pass a `MouseEvent` as the date.

**Persistence (schema v17, [Rule 12](../../design-docs/core-beliefs.md#rule-12)).** Append exactly one block after the v16 block; never edit an existing block; `liferpg-*` keys stay:
```js
if (s.v < 17) { // v17: the schedule tab remembers the chosen view; nothing derived is stored
  s = { ...s, v: 17, ui: { ...(s.ui || {}), scheduleView: s.ui?.scheduleView === "calendar" ? "calendar" : "list" } };
}
```
`freshState` gets `v: 17` and `ui: { scheduleView: "list" }`; update the `@schema` header to v17 and add the `ui: { scheduleView("list"|"calendar") }` field line. The root handler spreads (`setState((prev) => ({ ...prev, ui: { ...(prev.ui || {}), scheduleView: v } }))`) and passes `view` / `onView` to `ScheduleTab`, which reads `state.ui?.scheduleView === "calendar" ? "calendar" : "list"` defensively. The month and the selection are component state, not persisted — entering the tab always opens on the current month with today selected.

**New Korean copy — every string doubles as an E2E selector, use it verbatim:**
```
view toggle        목록 · 달력
month header       {YYYY}년 {M}월 · ‹ · › · 오늘
weekday header     일 월 화 수 목 금 토
panel              선택한 날짜 · {YYYY-MM-DD} · {n}건
panel empty day    이 날짜에는 일정이 없어요.
panel button       일정 추가   (reused; the header button is hidden in 달력 view, so only one exists at a time)
```
No new toast, no new modal copy, no new validation message. Unchanged and still exact in `목록` view: `다가오는 일정`, `오늘 {n}건 · 이번 주 {n}건 · 지난 마감 {n}건`, `지난 마감` · `오늘` · `내일` · `이번 주` · `이후`, `등록한 일정이 없어요 — 표시할 약속·마감이 없어요.`, every row and modal string. No standalone button may be labelled exactly `일정` — the E2E `clickTab` helper matches nav text.

**Acceptance criteria.** `달력` shows the current month with `일 월 화 수 목 금 토` and no horizontal scroll at 390 px; a day carrying occurrences shows one dot per occurrence up to three and `+{n}` beyond; today and the selected day are visibly distinct; tapping a day lists exactly `eventsOn(state, date)` in the panel, in the same order and with the same row component as the list; a day with none shows `이 날짜에는 일정이 없어요.`; `일정 추가` from the panel opens `새 일정` with the date input already set to the selected day and registering adds one event with that date; `‹` / `›` move one month and `오늘` returns to the current month with today selected; past months render their occurrences; the toggle choice survives a reload (`state.ui.scheduleView`); `목록` renders exactly today's groups and counts; `state` never gains a stored occurrence list, month or selection; a v16 save migrates to `v: 17` with `ui.scheduleView: "list"` and every v16 field intact; a fresh save is `v: 17`.

**Verification per phase:** `npm run verify` (0 failed steps, 0 console errors), `npm run finish` exit 0, `npm run docs:gen && npm run docs:check`. No `--smoke` run — no engine table, payout or matrix is touched. Finish protocol per AGENTS §5: cleanup → verifier → docs-syncer → report with a proposed commit message; commit only at an approved gate.

## Steps
1. **Phase A — schema, toggle, calendar.** `@schema` v17 + the `ui` field line; the `if (s.v < 17)` block; `freshState`; the root `scheduleView` handler and prop wiring; `onAdd(date)` + `EventModal initialDate` (+ the `onClick={() => onAdd()}` fix); extract `EventRow`; the `목록` / `달력` toggle (two `Chip`s under the counts line, both views keep the header and counts); `ScheduleCalendar` (month header, grid, markers, selection, panel, prefilled `일정 추가`, `CAL_RANGE_MONTHS`). **Version assertions must move in this phase or `verify` fails**: `tools/e2e/flow.js` L33, `flow4.js` L13/84/108, `flow6.js` L87 → 17. **Gate.**
2. **Phase B — E2E steps and docs.** `flow4.js`: new step `v16 save → v17 schedule view` (fixture keeps `events`, `journal`, `reviews`; assert `ui.scheduleView === "list"` and that no event was invented). `flow7.js` (extend it — do **not** add `flow8.js`), reusing its `rows`, `dstrIn` and `addEvent` helpers plus a new `dayCell(n)` page helper that finds the grid button whose day number is `n`: (a) `clickTab("일정")` → `clickText("달력")` → `expectText("선택한 날짜")` and the weekday header; (b) `reload()` → the tab still opens on `달력` and `state.ui.scheduleView === "calendar"`; (c) today's cell shows at least one dot for the deadline registered earlier in the flow; (d) select the weekly appointment's day and assert the panel rows (the existing `rows()` helper must match unchanged — proof that `EventRow` is shared); (e) select a day with nothing and read `이 날짜에는 일정이 없어요.`; (f) `일정 추가` from a selected day → assert `.fixed.inset-0 input[type="date"]` already holds that date, register `면접 일정 확인` and find it in that day's panel and in `state.events`; (g) `›` then `‹` `‹` reach the next and the previous month (assert the `{YYYY}년 {M}월` label each time), `오늘` returns and reselects today; (h) `목록` restores `이후` and the counts line, and survives a reload. Then every doc below. **Gate**, plus `npm run build:demo` and one manual open of `release/life-demo.html` from `file://`.

## Verification
`npm run verify` after each phase (E2E grows from 102 to about 111 steps); `npm run finish` exit 0; `npm run docs:gen && npm run docs:check` after both phases; `npm run docs:check -- --final` is not required. Manual: 390 px viewport, no horizontal scroll on the grid, and a month whose 1st falls on Sunday and one whose 1st falls on Saturday (31-day month → six rows).

## Cleanup checklist
- [x] `npm run finish` exit 0 (no duplicate row markup between the list and the panel — `EventRow` is shared; no unused `lucide-react` import; no unused constant left by Phase A) — clean after Phase A
- [x] allowlist additions (with reason) mirrored in `docs/exec-plans/tech-debt-tracker.md` — none needed
- [x] Phase B: `npm run finish` clean after two fixes it caught — the reload-and-reopen block shared by two new
      flow7 steps was extracted into a `reopenTab` helper, and five step names / error messages carrying Korean
      were rewritten in English (the Korean stayed only in selector and assert arguments, AGENTS §6)

## Docs to sync
[schedule.md](../../product-specs/schedule.md) (view toggle, calendar section: grid, markers, range, panel, prefilled add; the list section unchanged); [state-lifecycle.md](../../design-docs/state-lifecycle.md) (shape v17, ledger row, `freshState`, the `flow4.js` migration list); [information-architecture.md](../../design-docs/information-architecture.md) (the `일정` row gains the two views); [ARCHITECTURE.md](../../../ARCHITECTURE.md) (Schedule file region: `EventRow`, `ScheduleCalendar`; current status: schema v17, E2E step count); [assistant-bridge.md](../../design-docs/assistant-bridge.md) only if the helper table wording needs the calendar named; [demo-data.md](../../design-docs/demo-data.md) only if `demoState` changes (the three existing demo events already give the month grid markers, so no change is expected); [decision-log.md](../../design-docs/decision-log.md) (new dated row, rules 9/12/13, linking this plan); `docs/generated/*` via `npm run docs:gen`; `tools/e2e/README.md` and [RELIABILITY.md](../../RELIABILITY.md) (flow7 step count, migration list).

## Phase A log (2026-09-11)

Done, in `src/LifeManager.jsx` unless stated otherwise:
- Schema v17: `@schema` header and `v:` bumped, new `ui: { scheduleView("list"|"calendar") }` field line, one new
  `if (s.v < 17)` block appended after the v16 block (no existing block touched, `liferpg-*` keys unchanged),
  `freshState` at `v: 17` with `ui: { scheduleView: "list" }`.
- `EventRow` extracted to module level from `ScheduleTab`'s inner `row`; both the list groups and the calendar
  panel render it, so the markup exists once.
- `ScheduleCalendar`: month header, seven-column grid, markers, selection, selected-day panel and the prefilled
  `일정 추가`; `CAL_RANGE_MONTHS = 24` and `WEEKDAY_LABEL` added beside the other schedule constants.
- `ScheduleTab` takes `view` / `onView` and shows the `목록` / `달력` chips under the counts line; the header
  `일정 추가` button is hidden in `달력` view and now calls `onAdd()` (no `MouseEvent` as a date).
- Root: `setScheduleView`, `view={state.ui?.scheduleView} onView={setScheduleView}`,
  `onAdd={(date) => setModal({ type: "event", date })}`, `<EventModal … initialDate={modal.date} />`, and
  `useState(event?.date || initialDate || "")` inside the modal.
- Version assertions moved to 17: `tools/e2e/flow.js` L33, `flow4.js` L13/L84/L108, `flow6.js` L87.

Deviations from the plan:
- The `v16 save → v17 schedule view` fixture step in `tools/e2e/flow4.js` was written in Phase A, not Phase B,
  on the requester's instruction (a schema bump ships with its migration fixture, [Rule 12](../../design-docs/core-beliefs.md#rule-12)).
  It asserts `ui.scheduleView === "list"`, that the one fixture event survived unchanged and that `journal` and
  `reviews` are intact. Phase B still owns the flow7 calendar steps and every doc.
- Measured cell width at 390 px is about 42.9 px, not the 47 px the plan estimated: `main` is `px-4` and the
  section `p-4` with a 1 px border, so the grid is 324 px wide and `grid-cols-7 gap-1` leaves (324 − 24) / 7.
  Three dots plus `+{n}` still fit; the comment in the cell states 43 px.
- Paging with `‹` / `›` selects the 1st of the new month. The plan left the selection unstated, and keeping the
  old one would put the selection outside the shown month, where the month map no longer answers for it; `오늘`
  returns to the current month and selects today as specified.
- `demoState` unchanged, as the plan expected: the three demo events already give the grid its markers and the
  view toggle is reachable in the demo.

For Phase B:
- `expectText("일 월 화 수 목 금 토")` will not match: each weekday label is its own cell, so `innerText`
  separates them with newlines. Assert the seven header cells structurally (or one label at a time).
- The `dayCell(n)` helper must read the day number only from the grid buttons; the padding cells are plain
  `div`s with no text, so a text match alone would still be safe, but the panel rows contain numbers too.
- Verified by probe at 390 px (headless Chrome, seeded v16 save, 6 occurrences on today): document
  `scrollWidth` 390 = `clientWidth`, grid `scrollWidth` 324 = `clientWidth`, cells 42.84–42.86 × 56 px, 35 cells
  for 2026-09, today's cell shows three dots plus `+3`, exactly one `일정 추가` button, 0 console errors.
  Full E2E (`npm run verify`) was deliberately not run in this phase.

## Phase B log (2026-09-11)

Done:
- `tools/e2e/flow7.js` extended by eight steps (no `flow8.js`), reusing its `rows`, `dstrIn`, `readState` and
  `openEventModal` helpers and adding page helpers that read the calendar **structurally**: `gridCells` (day
  buttons only — day number, one entry per dot with its kind, the `+{n}` overflow, and the selected and today
  marks read as separate classes), `weekdayCells` (the header cell by cell, per the Phase A note),
  `monthLabel`, `panelLine`, `monthLabelIn`, `daysThisMonth`, `clickExact`, `pickDay`, `addButtonCount` and
  `reopenTab`. The steps: the `달력` toggle opens this month (header cells, month label, one tappable cell per
  day of the month, exactly one `일정 추가` button, `ui.scheduleView` stored) · the choice survives a reload ·
  today's cell carries the flow's own deadline as a rose marker, is selected on entry, and its dot count equals
  the panel's `{n}건` · the panel row is the list's row (its `완료 표시` and `수정` controls are asserted) · an
  empty day reads `이 날짜에는 일정이 없어요.` while today keeps its own mark · `일정 추가` from that day opens
  with the date already filled, registers `면접 일정 확인` on it and adds a cyan marker, with no task field and
  no change to `tasks` · `›` then `‹` `‹` reach the next and the previous month (label asserted each time, the
  weekly repeat still marked next month, nothing marked in a month before today, the 1st selected) and `오늘`
  returns and reselects today · `목록` restores `이후` and the counts line and survives a reload.
- Docs: [schedule.md](../../product-specs/schedule.md) (view toggle and where it is stored, a `Calendar view`
  section with the month header, grid, markers and `+{n}`, the selected-day panel, the prefilled add, the
  selection table and the 24-month range, plus the one-`upcomingEvents` month map under `Occurrences`, the
  `EventRow` note under `Row anatomy`, and `onAdd(date)` / `setScheduleView` under the root handlers);
  [state-lifecycle.md](../../design-docs/state-lifecycle.md) (shape v17 with `ui`, the `v < 17` ledger row, the
  migration-path list, `freshState`); [information-architecture.md](../../design-docs/information-architecture.md)
  (the `일정` row gains both views); [ARCHITECTURE.md](../../../ARCHITECTURE.md) (Schedule file region names
  `EventRow` and `ScheduleCalendar`, `migrate` v11 → v17, status line schema v17 and E2E 111 steps);
  [decision-log.md](../../design-docs/decision-log.md) (one dated row); [RELIABILITY.md](../../RELIABILITY.md)
  and `tools/e2e/README.md` (111 steps, the v16 → v17 migration, flow7 scope);
  [demo-data.md](../../design-docs/demo-data.md) and [index.md](../../product-specs/index.md) and
  [install-and-backup.md](../../product-specs/install-and-backup.md); `docs/generated/*` via `npm run docs:gen`.
- Manifest screenshot (added to this phase by the requester, not in the original plan): `gen-screenshots.js`
  takes an optional `then` label clicked inside the tab, the fourth shot became
  `{ file: "calendar.png", tab: "일정", then: "달력" }`, all four shots were regenerated from the demo build and
  `calendar.png` is now the fourth `narrow` entry of `public/manifest.webmanifest`
  (label `달력으로 보는 약속과 마감`). The three existing entries and their labels are unchanged.

Deviations from the plan:
- Step (a) of the plan's Phase B (the `v16 save → v17 schedule view` fixture in `flow4.js`) was already written
  in Phase A; Phase B added nothing to `flow4.js`.
- Plan step (d) said to select the weekly appointment's day. Its occurrences (today + 8, + 15, …) are not
  guaranteed to fall inside the current month, so the panel is asserted on today's deadline instead — the same
  proof that `EventRow` is shared — and the weekly repeat is asserted on the **next** month's grid, where it
  always has occurrences. Every day the new steps touch is found from the grid scan, never from a date guess.
- `public/screenshots/schedule.png` was deleted: with the fourth shot now the calendar, nothing generated or
  referenced it, which was the same defect the requester reported for `calendar.png`.
- E2E is 111 steps (the plan estimated "about 111"): 103 after Phase A plus 8.
- `demoState` unchanged, so [demo-data.md](../../design-docs/demo-data.md) only gained a note that the three
  existing events already mark the month grid in both colours and that `calendar.png` is generated from them.
- `npm run verify` was not run in this phase — the requester runs the E2E. The eight new steps were verified by
  running the real `tools/e2e/flow7.js` against a preview build with a seeded save (21/21 steps, 0 console
  errors, twice).
- `npm run docs:check` reports one broken link until this plan is moved: the new decision-log row points at
  `exec-plans/completed/2026-09-11-schedule-calendar-view.md`, as instructed, while the plan is still in
  `active/`. It resolves the moment docs-syncer moves the file.

## Proposed commits
`feat(schedule): schema v17 and a month calendar view in the 일정 tab` · `test(schedule): calendar E2E steps and v17 migration fixture`
