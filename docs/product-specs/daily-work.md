# Daily work tab — `업무`

Added 2026-09-17 (schema v25, [decision log](../design-docs/decision-log.md)). The user asked, verbatim,
`각 회의 후 어떤 업무를 이어서 진행했는지 진행사항 적고 모든일에 대한 요약을 해서 ai를 돌려 어플 내 모든 내용을
분석 후 오늘 할일을 만들어주고(오늘업무사항 탭 만듬) 수기로 추가도 가능하게끔 하고싶어`. `업무` is a seventh
bottom tab holding **dated work items** — typed by hand, or proposed by the assistant bridge and confirmed per
item — plus the meeting progress log that feeds them (`docs/product-specs/meetings.md`).

## What a work item is, and is not

A dated record of something the user did or means to do that day, never a task:
```
work: [{ id, date("YYYY-MM-DD"), title, note?, done, link?{ kind("goal"|"meeting"|"project"), id }, source("manual"|"ai"), createdAt }]
```
Rule 19's amendment restricts goal tasks to reading, exercise, certifications and study, so an item like
`견적서 송부` cannot be a task ([Rule 19](../design-docs/core-beliefs.md#rule-19)). A work item pays nothing,
completes nothing, moves no grade, streak, KR or goal, and never enters `computeGrades`, `krProgress`,
`goalProgress`, `agendaOf`, `todoOf`, `buildBriefing`, the trophy wall or an achievement log
([Rule 1](../design-docs/core-beliefs.md#rule-1), [Rule 8](../design-docs/core-beliefs.md#rule-8),
[Rule 9](../design-docs/core-beliefs.md#rule-9), [Rule 18](../design-docs/core-beliefs.md#rule-18)). `done` is
the one stored fact; the day view, the past-undone list and the link label are derived at render
(`workOn`, `workPastOpen`, `workLinkText`).

An item keeps its date rather than moving with "today": the tab pages by day (`viewDate`, component state,
never stored — [Rule 9](../design-docs/core-beliefs.md#rule-9)), and an undone item from an earlier day is
listed under `지난 미완료 {n}건` with one button, `오늘로 옮기기`, that sets its `date` to today — widened from
"yesterday only" so nothing is stranded out of sight ([Rule 13](../design-docs/core-beliefs.md#rule-13)).

A link to a goal, a meeting or a project is a reference only — no cascading effect either way. A target deleted
later is stated as `연결 대상이 삭제됐어요` and never cleaned up, the same policy as a meeting's `eventId`
([TD-46](../exec-plans/tech-debt-tracker.md), [TD-49](../exec-plans/tech-debt-tracker.md)); `removeGoal`,
`removeMeeting` and `removeProject` do not touch `work`.

## Caps and the storage arithmetic

`WORK_LIMITS = { title: 60, note: 200 }` — no per-day count cap (the cap of 20 was removed 2026-09-17 at the user's request: undone items are carried to the next day, so a day's list grows; only `recordFits` bounds it); `WORK_LINK_MEETINGS = 20` (meetings offered by the link
picker, newest first by `meetingOrder`).

- Record overhead `{"id":"…","date":"…","title":"","done":false,"source":"manual","createdAt":"…"}` is about 100
  chars; with a 20-char title, a 30-char note (`,"note":""` + 30) and a link
  (`,"link":{"kind":"meeting","id":"…"}` ≈ 45) an item is about 200 chars, about 150 without a link.
- Eight items a day for a year ≈ 2,920 × 150 ≈ 0.44 M chars (12 % of the 3.5 MB budget a year); twenty a day
  with every field full (60 + 200 + link ≈ 400 chars) ≈ 2.9 M a year. Nothing caps the count, so the storage guard below is the only bound.
- The tab always states `저장 공간 {mb}MB / 3.5MB` (`storageUsedWith(state)`, memoised on `state`, the same
  helper the `미팅` tab reads); `recordFits` refuses a save that would cross the budget before any write, keeping
  the form open with everything typed. The backup path is the way out of a full budget.

## The meeting progress log (feeds the work packet)

`meetings[].progress: [{ id, date("YYYY-MM-DD"), text }]`, capped at `MEETING_LIMITS.progress` (300 chars) per
entry and `MEETING_PROGRESS_MAX` (30) entries per meeting. Entries are added and deleted **only** in
`MeetingViewModal` — never from the work tab or its sheet, since the task sheet already shows a meeting's related
minutes and opens the same view. A progress entry grows an existing meeting record and touches nothing else — no
task, goal, act, room, event or work item ([Rule 1](../design-docs/core-beliefs.md#rule-1),
[Rule 18](../design-docs/core-beliefs.md#rule-18)). Storage arithmetic and the full field shape are in
[meetings.md](meetings.md).

`meetings[].aiHidden` (boolean, always present, backfilled `false`) is a per-meeting flag set from a checkbox
`AI에 보내지 않기` in `MeetingModal`. When set, the work packet (below) states only that meeting's date and
title — the summary, decisions, follow-ups and progress entries stay out.

## The tab

`NAV` inserts `["work", "업무", ListChecks]` after `["tasks", "할 일", ClipboardList]`:
`프로필 · 목표 · 할 일 · 업무 · 일정 · 미팅 · 사업`. Position: next to `할 일` so the two "today" lists sit
together. The bar is `grid-cols-7`; at 390 px each cell is ≈ 51 px — `업무` (2 glyphs) fits on one line where
`오늘 업무` would clip.

`WorkTab({ state, today, onAdd, onOpen, onMove, onBridge })`:
- Header: `SectionLabel` `오늘 업무 — {today}` on the viewed day, else `업무 — {viewDate}`; a `업무 추가` button
  (top right, same style as `프로젝트 추가`); below it a pager row `‹` / `오늘` (disabled when already today) /
  `›`, and, right-aligned on the same row, `AI로 만들기 ›` (opens `WorkBridgeModal`) — placed on the pager row
  rather than beside `업무 추가` because the label, both pager buttons and their gaps together exceed the 326 px
  a 390 px screen leaves next to the add button.
- Caption `업무는 기록이에요 — 목표·실행·점수에 반영되지 않아요.`; counts line (`font-mono text-xs
  text-zinc-400`) `남음 {n}건 · 완료 {n}건 · AI 제안 {n}건 · 저장 공간 {mb}MB / 3.5MB`.
- On the viewed day equal to today, when `workPastOpen` is non-empty: a section `지난 미완료 {n}건` with
  `오늘로 옮기기` and one `TodoRow` per item (lead `{MM-DD}` in the overdue tone, marker = the link's kind word).
- The day's list: one `TodoRow` per `workOn(state, viewDate)` item, ordered by `createdAt` ascending (a done item
  keeps its place) — lead chip `AI` (violet) for `source === "ai"`, `수기` (zinc) for manual; `done` from the
  item; marker `목표` / `회의록` / `프로젝트` when linked, none otherwise. Empty: `오늘 업무가 없어요.` (today) /
  `이 날짜에는 업무가 없어요.` (any other day).
- Every row opens `WorkModal` (`onOpen`); `업무 추가` opens it in add mode for the viewed day.

## `WorkModal({ state, work, date, today, onClose, onAdd, onUpdate, onToggle, onRemove })`

`modal: { type: "work", workId?, date? }`, title `업무 추가` / `업무`. In edit mode, facts first: `날짜` (mono),
`출처` (`수기` / `AI 제안`), `상태` (`완료` / `미완료`), `연결` (`workLinkText` or `연결 없음`). Fields: title
input (`업무 제목 — 예: 견적서 송부`, no `maxLength` — the submit refuses instead of truncating a paste), a
`메모 (선택)` textarea (`rows=3`, capped at `WORK_LIMITS.note`), and a `연결 (선택)` `<select>` of
`연결 안 함` plus `workLinkOptions(state)` — active goals, the newest `WORK_LINK_MEETINGS` meetings, every
project. Submit refuses in order: `업무 제목을 입력해 주세요.`, `업무 제목은 60자까지예요 — 지금 {n}자예요.`,
`메모는 200자까지예요 — 지금 {n}자예요.`, then whatever `onAdd`/`onUpdate` returns (the
storage-budget line). The record keeps only non-empty optional fields, so a cleared note or link disappears on
an edit. Buttons: `등록` (add) / `저장` (edit), then, in edit mode, a full-width `완료로 표시` / `완료 취소`
(`onToggle`, closes the sheet) and `삭제` (`onRemove`, confirmed by name: `{title} 업무를 삭제해요. 계속할까요?`).

**Select mode** (2026-09-17, the user asked for selected and all-at-once deletion). When the day shown or the
`지난 미완료` section has any item, the list card carries a `선택` chip. Tapping it turns every row of both sections into a
checkbox label (lead chip and title, a `ring-rose-500` outline when ticked; the row no longer opens the sheet) and
replaces the chip with `전체 선택` / `선택 해제`, a rose `선택 삭제 {n}건` (disabled at 0) and `취소`; `오늘로 옮기기` is
hidden meanwhile. Delete calls `onRemoveMany(ids)` — one confirmation, `업무 {n}건을 삭제해요. 계속할까요?` — and
leaves select mode when it deletes. The selection is component state only and is cleared when the pager changes the
day ([Rule 9](../design-docs/core-beliefs.md#rule-9)). `전체 선택` covers what is on screen — the day shown plus the
past-undone rows — never other days.

## Root handlers and toasts

Clone-pattern updates writing only `work` — never `act`, `tasks`, `goals`, `areas`, `room`, `exams`, `events` or
`meetings` ([Rule 1](../design-docs/core-beliefs.md#rule-1), [Rule 9](../design-docs/core-beliefs.md#rule-9),
[Rule 18](../design-docs/core-beliefs.md#rule-18)):

| Handler | Effect | Toast |
|---|---|---|
| `addWork(next)` | `recordFits`; otherwise prepends `{ id: uid(), ...next, done: false, source: "manual", createdAt: today }` | `업무를 등록했어요` |
| `updateWork(id, next)` | replaces title/note/link, keeping `id`/`date`/`done`/`source`/`createdAt` | `업무를 수정했어요` |
| `toggleWork(id)` | flips `done` only — no streak, no trophy, no KR | `완료로 표시했어요` / `완료를 취소했어요` |
| `removeWork(id)` | confirmed by name, then filters | `업무를 삭제했어요` |
| `removeWorkMany(ids)` | one confirmation `업무 {n}건을 삭제해요. 계속할까요?`, then filters; answers `true` when it deleted, so the tab leaves select mode | `업무 {n}건을 삭제했어요` |
| `moveWorkToToday(ids)` | sets `date = today` on every given item not already dated today | `미완료 {n}건을 오늘로 옮겼어요` |
| `importWork(list)` (from the AI bridge, below) | registers every ticked proposal as `source: "ai"`, `done: false` records; the raw reply is never stored | `AI 제안 업무 {n}건 등록` |

`meetingFits` was renamed `recordFits(next, prevLen = 0, noun)` (still returning `""` when the record fits, or
the same storage-refusal sentence with `noun` substituted — `회의록을` / `진행사항을` / `업무를`); every meeting,
progress and work write runs through it, all sharing the one storage budget ([meetings.md](meetings.md)).

## `오늘 업무 만들기` — the assistant bridge, `WorkBridgeModal`

The second bridge packet, alongside the daily check-in bridge (`AI에게 보내기`). `modal: { type: "workBridge" }`;
opened from the tab's `AI로 만들기 ›` button. Shares its send pane, paste pane and clipboard routine
(`PacketSendPane`, `ReplyPastePane`, `copyPacket`) with `BridgeModal`; the confirm view is its own — a work
proposal has no goal, difficulty or type to choose.

1. **Send** (`오늘 업무 만들기`): a read-only textarea holding `buildWorkPacket(state, today)`, `복사` and
   `AI 답변 붙여넣기 ›`. Caption: `아래 글을 복사해 Claude·ChatGPT 채팅에 붙여넣고, 답변을 받아 다시
   붙여넣어요. 앱은 네트워크를 쓰지 않아요. 회의록 요약과 진행사항이 실려요 — 보내지 않을 회의록은 회의록
   수정에서 'AI에 보내지 않기'를 켜요.`
2. **Paste** (`AI 답변 붙여넣기`): a textarea (`AI 답변을 여기에 붙여넣어요`) and `답변 확인`, which runs
   `parseWorkReply` and pre-ticks every non-rejected proposal.
3. **Confirm**: `제안 업무 확인 — {n}건`, the reply's own `note` line, then one row per proposal — a checkbox
   (disabled and unticked when rejected), the title, a second line `{linkText || "연결 없음"}{ · note}`, and a
   rose reason line when rejected. No proposals: `제안 업무 없음 — 등록할 항목이 없어요.` `선택한 업무 등록`
   calls `importWork` with the ticked, non-rejected proposals only.

The packet, the parser and their caps are documented in full in
[assistant-bridge.md](../design-docs/assistant-bridge.md); this spec covers the screen. Nothing here writes state
before the user ticks and confirms; the raw reply is not stored anywhere
([TD-50](../exec-plans/tech-debt-tracker.md)).

## Backup and migration (schema v25)

```js
if (s.v < 25) {
  s = { ...s, v: 25, work: Array.isArray(s.work) ? s.work : [],
    meetings: (s.meetings || []).map((m) => ({ ...m, progress: Array.isArray(m.progress) ? m.progress : [], aiHidden: m.aiHidden === true })) };
}
```
`freshState`: `v: 25`, `work: []` (after `meetings: []`). `exportBackup` writes the whole state, so `work` and
every meeting's `progress`/`aiHidden` travel in the backup file with no code change of their own; `importBackup`
runs the file's `state` through `migrate`, so an older backup gains the new fields on import; `resetAll` deletes
the state key, removing every work item and progress entry along with the rest of the save. See
[state-lifecycle.md](../design-docs/state-lifecycle.md).

## Demo content

`demoState` gives every demo meeting `progress: []` and `aiHidden: false`, except `유지보수 범위 협의`, which
gets one progress entry (`월 10시간 한도를 반영한 유지보수 견적서 초안 작성`, dated two days before today), and
`요구사항 1차 회의`, which is flagged `aiHidden: true` so the demo shows both v25 fields. `s.work` holds two
items dated today: a manual, open item (`○○물산 유지보수 견적서 송부`, linked to the demo maintenance project)
and an assistant-proposed, done item (`전기기사 필기 기출 1회분 채점`, linked to the harness-scenario goal). See
[demo-data.md](../design-docs/demo-data.md).

## E2E coverage

`tools/e2e/flow11.js` (new, written 2026-09-17, **not run** — standing user instruction), 12 steps run between
`flow10.js` and `flow4.js`: the tab's empty state, counts line and day paging; a progress entry added in the
meeting view, listed newest first, counted on the minutes row, and proven to move nothing else; the progress
textarea's empty/over-cap refusals; the `AI에 보내지 않기` checkbox round-tripped through the meeting form and
stated in the view; a manual work item registered with a project link, changing no task, meeting, streak or
trophy; completion in place (struck through, reversible); an item from three days back listed under
`지난 미완료` and moved to today; a twenty-first item on one day registered (no per-day cap); both new arrays present in
the exported backup file; the work packet carrying a visible meeting's summary and progress, only the date and
title of a hidden one, and no profile identifier; a pasted reply importing two of three proposals (one rejected
as a duplicate) with `source: "ai"`; a reply naming `tasks`/`deals`/`events`/`meetings` creating none of them.
Every step parses (`node --check`); none has been executed. See [tools/e2e/README.md](../../tools/e2e/README.md).

## What a work item never does

- No `goalId`, no difficulty, no points, no trophy, no achievement record, no streak effect, no evidence gate.
- It never runs through `tryComplete`, `completeTask` or `needsEvidence` — `toggleWork` is the only completion
  path, and it changes `done` alone.
- It is excluded from `agendaOf`, `todoOf`, `krProgress`, `goalProgress` and `buildBriefing` — `할 일` and the
  daily briefing never list a work item.
- `buildAssistantPacket` (the daily check-in packet) and `calendarExportOf` never read `work` — a work item
  never appears in that packet or in the exported calendar file.
- `parseAssistantReply` never reads a `work` key, and `parseWorkReply` never reads `tasks`, `deals`, `events` or
  `meetings` — the two bridges cannot create each other's record kind.
