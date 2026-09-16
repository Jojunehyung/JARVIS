# To-do tab — completed items stay in place; the archive lists ticked events

- Status: completed
- Date: 2026-09-16
- Needs approval: no — no data-table row, no `migrate` block, no `v` bump, no `liferpg-*` key, no `store` call site, no user data deleted. The user chose the fix.
- Agents: implementer → cleanup → verifier (gates below; E2E not executed) → docs-syncer

## Goal

The user reported `할일 탭 부분에 완료 처리 한것들의 목록이 안떠`. On the demo build a completed task left its group for an `오늘 완료` section at the very bottom of a long list, so on a phone it looked like it vanished; ticked schedule occurrences never appeared in the `완료` archive, which listed tasks only. Keep today's completions in place, struck through, and make the archive list ticked event occurrences too.

## What changed

- `todoOf` (`src/LifeManager.jsx`): tasks completed today are added as `done: true` rows. A done daily task, a done task without a date, or a done row that would land in `기한 지남` sits in `오늘`; any other done row sits in its date's group. A ticked occurrence dated before today is left out; one dated today or later stays in its date's group, done. In `이후`, open and ticked occurrences collapse separately. Within a group open rows come first, then done rows, each in `todoSort` order. `counts` count open rows only. The `done` return value is removed (only `TaskTab` read it).
- `TaskTab`: the `오늘 완료` section is removed; `onlyBiz` ignores done rows; the empty state still reads `counts.open`. The archive (`doneAll`) merges completed tasks (dated by `lastDoneDate`) and every date in `ev.doneDates` (dated by the occurrence), newest first, capped by `TODO_DONE_MAX`; the count line `완료 {total}건 · 최근 {shown}건` totals both kinds. Event rows carry `목표 기여 없음` and open `EventDetailModal` for that date.
- `todoLeadOf`: an archived event row leads with its occurrence date (`MM-DD`).
- A stale comment above the calendar export that pointed at `todoOf` was reworded.
- No Korean UI string was added or changed; the `오늘 완료` section label was removed.
- Completion still happens only through `tryComplete` in the task sheet (Rules 10, 11, 16); an event completes nothing and pays nothing (Rule 1); nothing derived is stored (Rule 9).

## E2E — updated, not executed

Per the standing user instruction, the suite was not run. Every edited file passes `node --check`.

- `tools/e2e/flow7.js`, step `the to-do list lists today's deadline and ticks it only through its event sheet`: after `완료 표시` the occurrence must stay in `오늘`, led by `완료`, struck through, with the `오늘` count down by one and no `오늘 완료` section; the `완료` archive must list it with `목표 기여 없음`; un-ticking from the `오늘` row returns it to an open row.
- `tools/e2e/flow5.js`, step `the tasks tab opens the briefing and stamps it seen`: asserts the archive count line equals completed tasks plus ticked event occurrences.
- `tools/e2e/run.js`, `tapTodoRow`: prefers an open row over a struck-through one of the same title, since done rows no longer sit at the end of the list.

## Gates run

- `npm run build` — pass.
- `npm run finish` — exit 0 (`finish-check: clean`).
- `npm run lang:check` — clean.
- Throwaway puppeteer check (outside the repo) on `release/life-demo.html` after `npm run build:demo`: completing `CATIA·도면 연습 1시간` through its sheet kept it in `오늘`, struck through and led by `완료`, after the open rows; counts went `기한 지남 2 · 오늘 3 · 이번 주 5` → `기한 지남 2 · 오늘 2 · 이번 주 4`; no `오늘 완료` section; ticking tomorrow's `영어 스터디 모임` in `일정` kept it struck through in `내일`; the `완료` archive read `완료 4건 · 최근 4건` and listed the event with `목표 기여 없음`, and tapping it opened the event sheet with `완료 취소`; no console errors.
- `npm run verify` / E2E — not run (standing user instruction).
