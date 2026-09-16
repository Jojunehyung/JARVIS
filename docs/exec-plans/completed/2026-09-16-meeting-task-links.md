# Meeting minutes linked to existing to-do tasks, shown on both sides

- Status: completed
- Date: 2026-09-16
- Needs approval: no further approval — the user chose the design (link existing tasks, show both sides). Touches a new `migrate` block (v24) only; no existing block, no `CERTS` / `EXAMS` / `WEIGHT_MATRIX` / `CERT_W_EXC` row, no `liferpg-*` key, no `store` call site, no user data deleted.
- Agents: planner (inline, in the task prompt) → implementer → cleanup → verifier → docs-syncer

## Goal

The user asked, verbatim, `회의록 작성은 할일목록들과 매칭 가능하게 해줘`, and chose, when asked: link **existing** tasks (no creating tasks from a meeting — tasks are still created only inside a goal, [Rule 18](../../design-docs/core-beliefs.md#rule-18), [Rule 19](../../design-docs/core-beliefs.md#rule-19)), and show the link on **both sides**. A meeting stays a record, never a task: linking pays nothing, completes nothing and moves no goal, KR or streak ([Rule 1](../../design-docs/core-beliefs.md#rule-1), [Rule 9](../../design-docs/core-beliefs.md#rule-9)).

## Steps

- [x] Schema v24: `meetings[].taskIds` — new `if (s.v < 24)` block after v23 backfilling `taskIds: []`, `freshState` `v: 24`, `@schema` JSDoc `meetings` line and derived-values list updated.
- [x] `MeetingModal`: `할 일 연결` picker — candidates from `meetingTaskCandidates(state, today)` (open tasks in `todoOf` order, then tasks completed in the last 30 days, newest first), `todoLeadOf` chips, struck styling when done, a `할 일 검색` filter, cap `MEETING_LIMITS.tasks = 10` with disabled rows and a cap line; saving writes `taskIds`.
- [x] `MeetingViewModal`: `연결된 할 일` rows (`TodoRow`, `완료` or the to-do chip), tapping opens `TaskDetailModal`; dangling ids skipped and counted; empty state line.
- [x] `TaskDetailModal`: `관련 회의록` rows from `meetingsOfTask` (newest first, `{date} {title}`), tapping opens `MeetingViewModal`; hidden when empty.
- [x] `removeTask` drops the id from every meeting's `taskIds` in the same clone update; `removeMeeting` unchanged (changes no task).
- [x] Root wiring: `onOpenTask` / `onOpenMeeting` replace the single modal slot; closing returns to the list.
- [x] `demoState`: `유지보수 범위 협의` links `이력서 초안 작성` and `CATIA·도면 연습 1시간`; the other demo meetings carry `taskIds: []`.
- [x] E2E updated (not executed): `flow10.js` five steps, `flow4.js` fixture step, version assertions in `flow.js` / `flow4.js` / `flow6.js`, `tools/e2e/README.md`.
- [x] Docs: `meetings.md`, `tasks.md`, `state-lifecycle.md`, `decision-log.md`.

## What changed

`src/LifeManager.jsx`:
- `migrate` gains the v24 block; `freshState` is v24; `@schema` names `taskIds[]` and the two new derived helpers.
- New module-level constants and helpers next to the meetings region: `MEETING_LIMITS.tasks` (10), `MEETING_TASK_PAST_DAYS` (30), `MEETING_TASK_ROWS` (30), `taskClosedOn`, `meetingTaskCandidates`, `meetingsOfTask`, `linkedTaskLead`.
- `MeetingModal` keeps `taskIds` and `taskQuery` in component state; ids of deleted tasks are dropped from the initial selection and from the saved list, so they never count toward the cap. A linked task that is no longer a candidate stays listed so it can be unticked; linked rows stay visible whatever the filter.
- `MeetingViewModal` takes `today` and `onOpenTask`; `TaskDetailModal` takes `onOpenMeeting`.
- `removeTask` became a clone update that also strips the id from `meetings[].taskIds`.

### Deviations from the request

1. `removeGoal` also strips the ids of the open tasks it deletes from every meeting — the request named only `removeTask`, but an active-goal delete is the second path that removes tasks, and "links never dangle going forward" would not hold without it.
2. Inside the form, an overdue chip's `text-rose-400` is rendered as `text-rose-300`. The E2E `modalError` helper reads the first `text-rose-400` element in a modal as the validation message, and `MeetingText` already follows this convention.
3. The picker renders at most 30 rows (`MEETING_TASK_ROWS`) with a "more" line, per `docs/FRONTEND.md`'s long-list rule; this adds one Korean string beyond the request, plus `검색 결과가 없어요.`, `연결할 할 일이 없어요.` and a one-line caption stating that a link changes nothing on the task.

## Rules touched

[1](../../design-docs/core-beliefs.md#rule-1) (linking pays nothing), [9](../../design-docs/core-beliefs.md#rule-9) (the reverse list is derived at render, never stored), [12](../../design-docs/core-beliefs.md#rule-12) (new v24 block, version bump, flow4 fixture step), [13](../../design-docs/core-beliefs.md#rule-13) (dangling links are counted, not hidden; copy states facts), [18](../../design-docs/core-beliefs.md#rule-18) and [19](../../design-docs/core-beliefs.md#rule-19) (no task is created from a meeting). Not touched: 2–6, 8, 10, 11, 14–17. `parseAssistantReply` and `buildAssistantPacket` still do not read meetings ([Rule 7](../../design-docs/core-beliefs.md#rule-7)).

## Schema

```
meetings: [{ id, projectId, date, title, attendees?, summary, decisions?, actions?, eventId?, createdAt, taskIds[] }]
```
v24 block: `s = { ...s, v: 24, meetings: (s.meetings || []).map((m) => ({ ...m, taskIds: Array.isArray(m.taskIds) ? m.taskIds : [] })) }`.

Storage: `,"taskIds":[]` adds 13 chars per record; each id adds 12 (10-char `uid`, two quotes, a comma). Ten links add 13 + 120 − 1 = 132 chars, so a full record reaches about 1,642 chars. `meetingFits` measures `JSON.stringify(rec)`, which includes `taskIds`, so the existing budget guard covers the field with no change.

## Korean strings added (UI copy)

- `할 일 연결` — picker header
- `할 일 검색` — filter placeholder
- `할 일은 {n}개까지 연결돼요.` — cap line (n = 10)
- `할 일 {n}건 더 있음 — 검색어로 좁혀요` — render cap line
- `검색 결과가 없어요.` — no filter match
- `연결할 할 일이 없어요.` — no task at all
- `연결은 기록이에요 — 할 일의 상태·점수·목표는 바뀌지 않아요.` — picker caption
- `연결된 할 일` — meeting view section label
- `연결된 할 일이 없어요.` — meeting view empty state
- `삭제된 할 일 {n}건` — meeting view dangling-link count
- `관련 회의록` — task sheet section label

## Gates run

- `npm run build` — pass.
- `npm run finish` — exit 0, `finish-check: clean`.
- `npm run lang:check` — `lang-check: clean`.
- `npm run build:demo` — pass (`release/life-demo.html`).
- Throwaway puppeteer check on the demo build at 390×844 (script kept outside the repo, in the session scratchpad): 23 of 23 checks passed — demo save is v24 with a two-link meeting; a new meeting linking `이력서 초안 작성` stores exactly that id and leaves `tasks` byte-identical; the view lists the task and taps through to its sheet; the sheet's `관련 회의록` lists the new meeting and the demo meeting and taps back to the view; one modal open at a time; closing returns to the list; no horizontal scroll on the tab, form, view or sheet; no console errors.
- `node --check` — pass for `tools/e2e/flow.js`, `flow4.js`, `flow6.js`, `flow10.js`.
- `npm run docs:gen` — db-schema regenerated at v24 (14 migration blocks), symbol index 297 symbols; `npm run docs:check` — `check-docs: clean`.
- `ARCHITECTURE.md` (Meetings region row and glossary row) and `docs/RELIABILITY.md` (migration list, meeting storage line) were brought to v24 as well.

## E2E — updated, not executed

A standing user instruction says the suite runs only when the user asks. These steps were written or changed and parse, but have **not been run**:
- `flow10.js` (new): `linking two tasks when writing a meeting stores their ids and changes no task` · `the meeting view lists the linked tasks and tapping one opens its task sheet` · `the task sheet lists the meeting under its related-minutes section and opens it` · `a meeting links at most 10 tasks` · `deleting a linked task removes its id from the meeting` (also plants a dangling id to check the count line, then removes the planted tasks and meeting so `flow4.js` starts from the save it used to).
- `flow4.js` (new): `v23 save → v24 meeting task links`; `SCHEMA_V` 23 → 24.
- `flow.js` fresh-save and `flow6.js` backup version assertions 23 → 24.
- Step count as written: 170 → 176.
