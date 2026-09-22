# Daily work tab — `업무`

Added 2026-09-17 (schema v25, [decision log](../design-docs/decision-log.md)). The user asked, verbatim,
`각 회의 후 어떤 업무를 이어서 진행했는지 진행사항 적고 모든일에 대한 요약을 해서 ai를 돌려 어플 내 모든 내용을
분석 후 오늘 할일을 만들어주고(오늘업무사항 탭 만듬) 수기로 추가도 가능하게끔 하고싶어`. `업무` is a seventh
bottom tab holding **dated work items** — typed by hand, or proposed by the assistant bridge and confirmed per
item — plus the meeting progress log that feeds them (`docs/product-specs/meetings.md`). Secretary stage 1-A
(2026-09-17, schema v26, same day) added derived carry-forward of undone items, a meeting-prep card, and a third
source (`source: "meeting"`) for a work item a follow-up registers — see the sections below.

## What a work item is, and is not

A dated record of something the user did or means to do that day, never a task:
```
work: [{ id, date("YYYY-MM-DD"), title, note?, result?, minutes?, done, link?{ kind("goal"|"meeting"|"project"), id, followUpId? }, source("manual"|"ai"|"meeting"), track("work"|"biz"|"personal"), createdAt }]
```
`track` (schema v28) is a stored field, backfilled `work` on every existing item. `minutes?` (v28, optional, no
backfill) is the item's own fact — how long it took, typed on completion — read only by its own sheet fact and
by `syncTimeLog`, below; the weekly time sum never reads it directly (below).
Rule 19's amendment restricts goal tasks to reading, exercise, certifications and study, so an item like
`견적서 송부` cannot be a task ([Rule 19](../design-docs/core-beliefs.md#rule-19)). A work item pays nothing,
completes nothing, moves no grade, streak, KR or goal, and never enters `computeGrades`, `krProgress`,
`goalProgress`, `agendaOf`, `todoOf`, `krProgress` or the trophy wall/achievement log
([Rule 1](../design-docs/core-beliefs.md#rule-1), [Rule 8](../design-docs/core-beliefs.md#rule-8),
[Rule 9](../design-docs/core-beliefs.md#rule-9), [Rule 18](../design-docs/core-beliefs.md#rule-18)); `buildBriefing`
reads only the carried count and its oldest age (below), never a title or a work item itself. `done` is the one
stored fact; the day view, the carried rows and the link label are derived at render (`workOn`, `workLeadOf`,
`workLinkText`).

`source: "meeting"` (schema v26) is a third source value, next to `manual` and `ai`: a work item a `mine`
follow-up on a meeting registers automatically (`followUpWorkItem`, [meetings.md](meetings.md)). Its `link` is
`{ kind: "meeting", id: <meetingId>, followUpId: <followUp.id> }` — `followUpId` is an extra key read only by the
follow-up mirror logic; `workLinkLabel` still reads only `kind` / `id`, so the link label is unaffected. Such an
item's `link` is owned by the follow-up: `updateWork` keeps it whatever the sheet sends, and `WorkModal` shows no
link picker for it (below).

An item keeps its date rather than moving with "today": the tab pages by day (`viewDate`, component state,
never stored — [Rule 9](../design-docs/core-beliefs.md#rule-9)). Carry-forward (schema-free, 2026-09-17,
superseding the `지난 미완료` section and its `오늘로 옮기기` button) is derived, never stored: `workOn(state,
date, today)` prefixes **today's own view only** with every undone item dated before today, oldest first, each
stating its age as a lead chip `이월 {n}일` (`workLeadOf`) in the overdue tone; the item's stored `date` never
changes, so it also still appears, struck through if done, on its own day — nothing is moved and nothing is
hidden ([Rule 9](../design-docs/core-beliefs.md#rule-9), [Rule 13](../design-docs/core-beliefs.md#rule-13)).
`workPastOpen`, `onMove` and `moveWorkToToday` no longer exist.

A link to a goal, a meeting or a project is a reference only — no cascading effect either way. A target deleted
later is stated as `연결 대상이 삭제됐어요` and never cleaned up, the same policy as a meeting's `eventId`
([TD-46](../exec-plans/tech-debt-tracker.md), [TD-49](../exec-plans/tech-debt-tracker.md)); `removeGoal`,
`removeMeeting` and `removeProject` do not touch `work`.

## Caps and the storage arithmetic

`WORK_LIMITS = { title: 60, note: 200, result: 1000 }` (`result` added 2026-09-17, optional, no migration) — no per-day count cap (the cap of 20 was removed 2026-09-17 at the user's request: undone items are carried to the next day, so a day's list grows; only `recordFits` bounds it); `WORK_LINK_MEETINGS = 20` (meetings offered by the link
picker, newest first by `meetingOrder`).

- Record overhead `{"id":"…","date":"…","title":"","done":false,"source":"manual","createdAt":"…"}` is about 100
  chars; with a 20-char title, a 30-char note (`,"note":""` + 30) and a link
  (`,"link":{"kind":"meeting","id":"…"}` ≈ 45) an item is about 200 chars, about 150 without a link.
- Eight items a day for a year ≈ 2,920 × 150 ≈ 0.44 M chars (12 % of the 3.5 MB budget a year); twenty a day
  with every field full (60 + 200 + link ≈ 400 chars) ≈ 2.9 M a year. Nothing caps the count, so the storage guard below is the only bound.
- The tab always states `저장 공간 {mb}MB / 3.5MB` (`storageUsedWith(state)`, memoised on `state`, the same
  helper the `미팅` tab reads); `recordFits` refuses a save that would cross the budget before any write, keeping
  the form open with everything typed. The backup path is the way out of a full budget.
- A follow-up-mirrored item (schema v26) adds a `followUpId` key to its `link`: `,"link":{"kind":"meeting","id":"…","followUpId":"…"}`
  ≈ 66 chars beyond the plain `meeting` link, so such an item is ≈ 100 (overhead) + title (≤ 60) + 66 ≈ 210 chars
  for a 40-char title; a follow-up text over `WORK_LIMITS.title` (60) is copied whole into `note` (≤ 200), so the
  largest such item ≈ 436 chars. `commitMeeting` ([meetings.md](meetings.md)) measures the meeting record **plus
  every work item its reconcile creates** against the budget before writing either.
- Track backfill (v28): `,"track":"work"` adds **15 chars** per work item; `,"minutes":120` (v28, optional) adds
  **14**. A time-log entry, `{"id":"…","date":"…","track":"biz","minutes":120,"createdAt":"…"}`, is ≈ **85
  chars** (+22 with `workId`); one entry a working day ≈ 250 × 107 ≈ **27 k chars a year** (0.7 % of the budget).
  `,"settings":{"bizHoursPerWeek":20}` adds **33 chars** once; `,"milestones":[],"timeLog":[],"leads":[],"notices":[]`
  adds **56** once (shared with [business.md](business.md)'s arithmetic). Every write of a time-log entry runs
  `recordFits` (noun `시간 기록을`).

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

`WorkTab({ state, today, onAdd, onOpen, onBridge, onRemoveMany, onOpenMeeting, onOpenDocument, onAddCheck, onToggleCheck, onRemoveCheck, onAskAi })` (the last four props added schema v27, passed straight through to `MeetingPrepCard`):
- Renders `MeetingPrepCard` (below) first, then the tab body.
- Header: `SectionLabel` `오늘 업무 — {today}` on the viewed day, else `업무 — {viewDate}`; a `업무 추가` button
  (top right, same style as `프로젝트 추가`); below it a pager row `‹` / `오늘` (disabled when already today) /
  `›`, and, right-aligned on the same row, `AI로 만들기 ›` (opens `WorkBridgeModal`) — placed on the pager row
  rather than beside `업무 추가` because the label, both pager buttons and their gaps together exceed the 326 px
  a 390 px screen leaves next to the add button.
- Caption `업무는 기록이에요 — 목표·실행·점수에 반영되지 않아요.`; counts line (`font-mono text-xs
  text-zinc-400`), on today's view: `남음 {n}건 · 이월 {c}건 · 완료 {n}건 · AI 제안 {n}건 · 저장 공간 {mb}MB / 3.5MB`
  (`남음` counts carried items too; `이월` is only on today's view; any other day keeps the four fragments it
  always had, with no `이월` fragment). The `지난 미완료` section and its `오늘로 옮기기` button are gone — see
  carry-forward, above.
- The day's list: one `TodoRow` per `workOn(state, viewDate, today)` item — on today's view, every undone item
  from earlier days first (oldest date first), then today's own items by `createdAt` ascending (a done item
  keeps its place); any other day is unprefixed, in its own `createdAt` order. Lead chip (`workLeadOf`): a
  carried item states `이월 {n}일` in the overdue tone; otherwise `AI` (violet) for `source === "ai"`, `회의`
  (cyan-300 on cyan-800) for `source === "meeting"`, `수기` (zinc) for manual. The row marker (v28) starts with
  the item's track label (`TRACK_LABEL[trackOf(w)]`), then, only when linked, ` · ` and the link word (`목표` /
  `회의록` / `프로젝트`). Empty: `오늘 업무가 없어요.` (today) / `이 날짜에는 업무가 없어요.` (any other day).
- **Grouped by track (v28).** The day's rows are additionally grouped by `TRACKS` order (`직장` → `사업` →
  `개인`), each group a head line `{track label} {n}건` (`text-xs font-bold text-zinc-500 mt-1`) followed by
  that group's rows in the order above (a carried item still sorts first within its own group); an empty group
  renders nothing. Select mode (below) covers every group at once, as it already covered the flat list.
- Every row opens `WorkModal` (`onOpen`); `업무 추가` opens it in add mode for the viewed day. A row with
  `source === "meeting"` came from a meeting follow-up (below).

## Weekly time budget (v28)

A **setting** the user types, `settings.bizHoursPerWeek` (default 20) — never a measure
([Rule 8](../design-docs/core-beliefs.md#rule-8)) — set from `설정` → `사업 시간 — 주간 예산` (see
[home.md](../product-specs/home.md)). The weekly sum itself is always derived from dated `timeLog` entries,
never stored ([Rule 9](../design-docs/core-beliefs.md#rule-9)): `TIME_LOG_MAX_MINUTES = 1440`; `weekMinutes(state,
weekOf, track)` sums `timeLog` minutes dated `weekOf`..`weekOf + 6`, filtered to `track` when given;
`weekDaysLeft(today)` — days to Sunday inclusive; `hoursText(min)` — `12.5h` / `20h`; `bizHoursOf(state)` — the
setting when finite, else 20; `timeLine(state, today)` → `이번 주 사업 {h}/{budget}h · 남은 날 {d}`, the one
string the work tab, `TimeLogModal` and the reader's `사업 로드맵` section (first item) all print.

**The single source of the weekly sum.** `work[].minutes` is the item's own fact, shown on its own sheet; the
`timeLog[]` entry a completion appends (with `workId`) is what `weekMinutes` actually sums — nothing is
double-counted because the sum never reads `work[].minutes` itself. `syncTimeLog(s, w)` (App root, beside
`mirroredFollowUp`) keeps **exactly one** entry per done item with minutes and none otherwise: it removes any
existing entry for `w.id`, then, when `w.done && w.minutes > 0`, appends `{ id: uid(), date: w.date, track:
trackOf(w), minutes: w.minutes, workId: w.id, createdAt: today }` (or keeps the existing entry unchanged when its
date, track and minutes already match, so a plain re-save never churns ids). `toggleWork`, `updateWork` and
`toggleFollowUp` (which mirrors `done` onto a linked item) all call it in the same clone update; `dropWork`
removes the entries of every deleted item.

**`WorkModal`'s minutes field.** Edit mode only, after `처리 내용 (선택)`: a row `걸린 시간 (분, 선택)`, a number
input (`aria-label="걸린 시간"`, initial the stored minutes or empty). `draft()` includes `minutes` as an integer
1–1440 or absent, refused with `걸린 시간은 1 이상 1440 이하 분으로 입력해 주세요.` The sheet's `상태` fact reads
`완료 · {n}분` once done with minutes recorded, `미완료 · {n}분` when un-completed with minutes kept.

**`TimeLogModal({ state, today, onClose, onAdd, onRemove })`**, `modal.type: "timeLog"`, title `사업 시간 기록`:
`timeLine(state, today)` and a second mono line `직장 {h}h · 개인 {h}h` (this week's other two tracks); fields a
date input (default today), a number `BizField` `분 — 예: 90`, `TrackRow` (default `사업`), button `기록` →
`onAdd({ date, track, minutes })` — refusals `날짜를 선택해 주세요.`, `분을 1 이상 1440 이하로 입력해 주세요.`;
below, this week's entries newest first, one mono line each (date · track label · `{n}분` · the linked work
item's title or `직접 기록`) with a remove `X` (`aria-label="시간 기록 삭제"` → confirm → `onRemove(id)`) — shown
only for an entry with no `workId` (a mirrored entry is edited on the work sheet, not here, and shows `업무에서
기록` with no button). Empty: `이번 주 기록이 없어요.`

`WorkTab` renders, under the counts line, a full-width left-aligned text button (`text-xs font-mono
text-zinc-400 active:opacity-70`) reading `{timeLine(state, today)} ›` → opens `TimeLogModal` (root:
`setModal({ type: "timeLog" })`).

**Root handlers** (writing `timeLog` or `settings` only): `addTimeLog(next)` (`recordFits`, noun `시간
기록을`) appends, toast `시간 {n}분을 기록했어요`; `removeTimeLog(id)` filters, toast `시간 기록을 삭제했어요`;
`setBizHours(n)` writes `settings.bizHoursPerWeek` only, toast `주간 사업 시간을 {n}시간으로 저장했어요`.

## `MeetingPrepCard({ state, today, onOpenMeeting, onOpenDocument, onAddCheck, onToggleCheck, onRemoveCheck, onAskAi })` — `오늘 회의 준비` (schema v26; documents + checklist + AI prep packet, schema v27)

The first section of the `업무` tab, derived at render (`meetingPrepOf(state, today)`,
[meetings.md](meetings.md)) and stores nothing beyond the check writes below ([Rule 9](../design-docs/core-beliefs.md#rule-9));
renders `null` when no row matches. One block per open schedule occurrence today and tomorrow that belongs to a
live meeting project (by the event's own `projectId`, or, absent that, by a previous meeting whose trimmed title
equals the event's), header `오늘 회의 준비` with a mono `{n}건`.

Each block is a **`div`**, not a `<button>` (schema v27, [TD-64](../exec-plans/tech-debt-tracker.md)): the
checklist's own checkboxes and inputs cannot nest inside a button. It states the project name, `{오늘|내일}
{time | 시간 미정} · {event title}`, then `마지막 회의 {date} · {title}` or `이전 회의록 없음`; when there is a
last meeting, an explicit border button `회의록 열기 ›` opens it (`onOpenMeeting`) — the whole-block tap this
button replaces (`flow11.js`'s prep step now taps the button, not the block). When there is a last meeting:
`결정: {clipped decisions | 없음}`, up to `PREP_FOLLOWUPS` (10) open follow-up lines `{내 담당|타인} · {text} ·
기한 {due | 없음} · 업무 {완료|미완료|없음}` (mine first) with `{k}건 더` past the cap, up to `PREP_PROGRESS` (3)
progress lines or `진행사항 없음`, and up to `PREP_TASKS` (5) linked-task lines (block omitted when none linked).
On-device only, so a meeting flagged `aiHidden` is stated in full here. Line 2 gains (v28) ` · ` and the event's
own track label.

For a row whose event is on the `work` track (v28), whether the block's `AI에게 회의 준비 묻기` button (below)
shows or is replaced by the line `직장 트랙 — AI 패킷에 실리지 않아요` (`text-xs text-zinc-500`) is the
day-job-in-AI-packets settings switch (`settings.workInAi`, 2026-09-22,
[SECURITY.md](../SECURITY.md#tracks--the-day-job-switch-2026-09-22)) — **on by default**, so the button shows
for a day-job row exactly as for any other. While the switch is off, the block still states everything
on-device (the project name, the last meeting, its follow-ups and progress), since none of that leaves the
device; only the ask-AI path is withheld, the same rule the prep packet itself enforces
([documents.md](documents.md), [assistant-bridge.md](../design-docs/assistant-bridge.md)).

Then (schema v27, [documents.md](documents.md)) `문서 {n}건` and up to `PREP_DOCS` (5) of the project's
documents, each a left-aligned button `{title} — {oneLineText(summary, DOC_SUMMARY_CLIP)}` that opens the
document sheet (`onOpenDocument`), `{k}건 더` past the cap, `문서 없음` at zero. Then `<EventChecks ev={row.ev}
onAdd={onAddCheck} onToggle={onToggleCheck} onRemove={onRemoveCheck} />` ([schedule.md](schedule.md)) — the same
checklist component the event detail sheet renders — with a caption `확인할 것은 이 일정에 저장돼요 —
회의록을 쓸 때 후속 항목으로 가져올 수 있어요.` Then a full-width border button `AI에게 회의 준비 묻기` →
`onAskAi(ev.id, date)`, opening `PrepBridgeModal` ([../design-docs/assistant-bridge.md](../design-docs/assistant-bridge.md)).

`PREP_DAYS` (2), `PREP_DECISION_CLIP` (200 chars), `PREP_DOCS` (5), `DOC_SUMMARY_CLIP` (100).

## `WorkModal({ state, work, date, today, onClose, onAdd, onUpdate, onToggle, onRemove, onOpenMeeting })`

`modal: { type: "work", workId?, date? }`, title `업무 추가` / `업무`. In edit mode, facts first: `날짜` (mono;
an undone item dated before today appends ` · 이월 {n}일`), `출처` (`수기` / `AI 제안` / `회의 후속` for
`source === "meeting"`), `상태` (`완료` / `미완료`), `연결` (`workLinkText` or `연결 없음`). Directly under the
`연결` fact, when `work.link?.kind === "meeting"` **and** the meeting still exists (`workLinkLabel(state,
work.link)` non-null — a link stated as `연결 대상이 삭제됐어요` shows no button), a border button `회의록 열기`
(2026-09-17) calls `onOpenMeeting(work.link.id)`, wired at the root to `setModal({ type: "meetingView",
meetingId })`. The root has one modal slot, so opening the view **replaces this sheet**; closing the view lands
on the `업무` tab underneath, not back in the sheet — anything typed and not saved is dropped, the same as
closing the sheet any other way ([TD-58](../exec-plans/tech-debt-tracker.md), accepted). Fields: title
input (`업무 제목 — 예: 견적서 송부`, no `maxLength` — the submit refuses instead of truncating a paste), a
`메모 (선택)` textarea (`rows=3`, capped at `WORK_LIMITS.note`), in edit mode only a `처리 내용 (선택) — 어떻게 처리했는지 적어요` textarea (`rows=4`, capped at `WORK_LIMITS.result`; how the item was done, added 2026-09-17 at the user's request), and a `연결 (선택)` `<select>` of
`연결 안 함` plus `workLinkOptions(state)` — active goals, the newest `WORK_LINK_MEETINGS` meetings, every
project — **except** for `source === "meeting"`, where the picker is replaced by the line `연결은 회의록의 후속
항목을 따라요.` (the `연결` fact row above still shows `회의록 · {date} {title}`; the link is owned by the
follow-up, schema v26). After `연결 (선택)` (v28), the `TrackRow` chips (also shown for a `source: "meeting"`
item, whose link line above stays): initial `work?.track || "work"`; `draft()` includes `track`. Submit refuses in order: `업무 제목을 입력해 주세요.`, `업무 제목은 60자까지예요 — 지금 {n}자예요.`,
`메모는 200자까지예요 — 지금 {n}자예요.`, `처리 내용은 1000자까지예요 — 지금 {n}자예요.`, then whatever `onAdd`/`onUpdate` returns (the
storage-budget line). The record keeps only non-empty optional fields, so a cleared note, result or link disappears on
an edit; `updateWork` keeps a `source: "meeting"` item's `link` whatever the sheet sends. Buttons: `등록` (add) / `저장` (edit), then, in edit mode, a full-width `완료로 표시` / `완료 취소`
(`onToggle(id, draft)`: the toggle validates and writes what the sheet shows — title, note, result and link — in the same update, so a result typed before tapping it is kept; a refusal keeps the sheet open; closes the sheet) and `삭제` (`onRemove`, confirmed by name: `{title} 업무를 삭제해요. 계속할까요?`;
deleting a follow-up-mirrored item leaves the follow-up on its meeting, unlinked — [meetings.md](meetings.md)).

**Select mode** (2026-09-17, the user asked for selected and all-at-once deletion). When the day shown has any
item, the list card carries a `선택` chip. Tapping it turns every row (including carried ones) into a
checkbox label (lead chip and title, a `ring-rose-500` outline when ticked; the row no longer opens the sheet) and
replaces the chip with `전체 선택` / `선택 해제`, a rose `선택 삭제 {n}건` (disabled at 0) and `취소`. Delete calls
`onRemoveMany(ids)` — one confirmation, `업무 {n}건을 삭제해요. 계속할까요?` — and
leaves select mode when it deletes. The selection is component state only and is cleared when the pager changes the
day ([Rule 9](../design-docs/core-beliefs.md#rule-9)). `전체 선택` covers what is on screen — today's view plus its
carried rows — never other days.

## Root handlers and toasts

Clone-pattern updates writing only `work` — never `act`, `tasks`, `goals`, `areas`, `room`, `exams` or
`events` — plus, for a follow-up-mirrored item, the linked meeting's follow-up `done` state or `workId`
(schema v26, [meetings.md](meetings.md); [Rule 1](../design-docs/core-beliefs.md#rule-1),
[Rule 9](../design-docs/core-beliefs.md#rule-9), [Rule 18](../design-docs/core-beliefs.md#rule-18)):

| Handler | Effect | Toast |
|---|---|---|
| `addWork(next)` | `recordFits`; otherwise prepends `{ id: uid(), ...next, track: trackOf(next), done: false, source: "manual", createdAt: today }` | `업무를 등록했어요` |
| `updateWork(id, next)` | replaces title/note/result/minutes/link, keeping `id`/`date`/`done`/`source`/`createdAt`; writes `track: trackOf(next, cur.track)` (a `meeting`-sourced item keeps its own `link` regardless of `next.link`) | `업무를 수정했어요` |
| `toggleWork(id, next?)` | flips `done`; writes whatever the sheet sends (`title`/`note`/`result`/`minutes`/`track`/`link`) in the same update, so a result or minutes typed before completing is kept; when the item mirrors a follow-up, sets that follow-up's `done` to match; runs `syncTimeLog` (v28) in the same update — no streak, no trophy, no KR | `완료로 표시했어요` / `완료를 취소했어요` |
| `removeWork(id)` | confirmed by name, then calls the shared `dropWork(new Set([id]))`, which filters `work` and (v28) removes the matching `timeLog` entry; a mirrored item's follow-up loses its `workId` (`mine`/`done` kept) | `업무를 삭제했어요` |
| `removeWorkMany(ids)` | one confirmation `업무 {n}건을 삭제해요. 계속할까요?`, then `dropWork(ids)` the same way for every id; answers `true` when it deleted, so the tab leaves select mode | `업무 {n}건을 삭제했어요` |
| `importWork(list, date = today, track = null)` (from the AI bridge, below) | registers every ticked proposal as `source: "ai"`, `done: false` records dated `date`; `track` is the given value or the Phase 1 rule (the linked project's or meeting's track via `meetingTrack`, else `biz` — a proposal can only originate from an allowed packet, so it never resolves to `work`); the raw reply is never stored | `AI 제안 업무 {n}건 등록`, plus ` · {date}` when `date` is not today |

`moveWorkToToday` and its `onMove` wiring are gone (carry-forward is derived, above).

`meetingFits` was renamed `recordFits(next, prevLen = 0, noun)` (still returning `""` when the record fits, or
the same storage-refusal sentence with `noun` substituted — `회의록을` / `진행사항을` / `업무를`); every meeting,
progress and work write runs through it, all sharing the one storage budget ([meetings.md](meetings.md)).

## `오늘 업무 만들기` and `주간 회고` — `WorkBridgeModal` (generalised, v28)

The second bridge packet, alongside the daily check-in bridge (`AI에게 보내기`). `modal: { type: "workBridge" }`;
opened from the tab's `AI로 만들기 ›` button. Shares its send pane, paste pane and clipboard routine
(`PacketSendPane`, `ReplyPastePane`, `copyPacket`) with `BridgeModal`; the confirm view is its own — a work
proposal has no goal, difficulty or type to choose.

1. **Send** (`오늘 업무 만들기`): a read-only textarea holding `buildWorkPacket(state, today)`, `복사` and
   `AI 답변 붙여넣기 ›`. Caption (2026-09-17, gained one sentence; v28 gained a second): `아래 글을 복사해
   Claude·ChatGPT 채팅에 붙여넣고, 답변을 받아 다시 붙여넣어요. 앱은 네트워크를 쓰지 않아요. 회의록 요약과
   진행사항이 실려요 — 녹취록은 실리지 않아요. 보내지 않을 회의록은 회의록 수정에서 'AI에 보내지 않기'를
   켜요.` — plus, **only while the day-job-in-AI-packets settings switch is off** (`settings.workInAi`,
   2026-09-22, on by default, [SECURITY.md](../SECURITY.md#tracks--the-day-job-switch-2026-09-22)), the sentence
   `직장 트랙 기록은 실리지 않아요.`
2. **Paste** (`AI 답변 붙여넣기`): a textarea (`AI 답변을 여기에 붙여넣어요`) and `답변 확인`, which runs
   `parseWorkReply` and pre-ticks every non-rejected proposal.
3. **Confirm**: `제안 업무 확인 — {n}건`, the reply's own `note` line, then one row per proposal — a checkbox
   (disabled and unticked when rejected), the title, a second line `{linkText || "연결 없음"}{ · note}`, and a
   rose reason line when rejected. No proposals: `제안 업무 없음 — 등록할 항목이 없어요.` `선택한 업무 등록`
   calls `importWork` with the ticked, non-rejected proposals only.

**Generalised for a second caller (v28).** `WorkBridgeModal({ state, today, build, title, caption, importDate,
importTrack, onClose, onImport, onToast })` takes the packet builder, the title, the caption, an import date and
an import track as props rather than hard-coding them, so there is exactly **one** confirm view for both
packets — a second copy would be a ≥ 6-line duplicate `npm run finish` flags. The root renders it twice:
`workBridge` with `buildWorkPacket`, the existing title and caption, `today` and no track (the Phase 1 rule
above); `reviewBridge` with `buildReviewPacket`, title `주간 회고 — AI에게 묻기`, caption `아래 글을 복사해
Claude·ChatGPT 채팅에 붙여넣고, 답변을 받아 다시 붙여넣어요. 앱은 네트워크를 쓰지 않아요. 사업 트랙의 이번 주
업무·후속·로드맵·파이프라인·공고·입금 예정과 저장된 리뷰가 실려요 — 직장·개인 트랙, 녹취록, 이름·연락처는
실리지 않아요. 답변의 제안은 다음 주 월요일 업무로 등록돼요.`, next Monday (`shiftDay(mondayOf(today), 7)`) and
`track: "biz"`. The `주간 회고` packet itself, its reply path and the `ReviewModal` button that opens it are
documented in [assistant-bridge.md](../design-docs/assistant-bridge.md) — this section covers only the shared
screen.

The packet, the parser and their caps are documented in full in
[assistant-bridge.md](../design-docs/assistant-bridge.md); this spec covers the screen. Nothing here writes state
before the user ticks and confirms; the raw reply is not stored anywhere
([TD-50](../exec-plans/tech-debt-tracker.md)). A project-less memo (2026-09-17) still gets its own line
(`- {date} [프로젝트 없음] {title}` — `buildWorkPacket`'s existing `?.name || "프로젝트 없음"` fallback needed no
change), stated with its summary, decisions, follow-ups and progress exactly like a project's meeting; its
`transcript` is never read by `meetingLines` — the packet states named fields only ([SECURITY.md](../SECURITY.md)).

## Backup and migration (schema v26)

```js
if (s.v < 26) {
  s = { ...s, v: 26, meetings: (s.meetings || []).map((m) => ({ ...m, followUps: Array.isArray(m.followUps) ? m.followUps : [] })) };
}
```
`freshState`: `v: 26`. `exportBackup` writes the whole state, so `work` (including a follow-up-mirrored item)
and every meeting's `followUps` travel in the backup file with no code change of their own; `importBackup`
runs the file's `state` through `migrate`, so an older backup gains the new fields on import; `resetAll` deletes
the state key, removing every work item, meeting and follow-up along with the rest of the save. See
[state-lifecycle.md](../design-docs/state-lifecycle.md).

## Demo content

`s.work` holds three items dated today: a manual, open item (`○○물산 유지보수 견적서 송부`, linked to the
demo maintenance project), an assistant-proposed, done item (`전기기사 필기 기출 1회분 채점`, linked to the
harness-scenario goal), and (schema v26) an item registered from `유지보수 범위 협의`'s mine follow-up
(`긴급 대응 기준 초안 공유`, `source: "meeting"`, `link.followUpId` set, `회의` lead chip). One demo event,
`○○물산 주간 점검` tomorrow, carries `projectId: mp1.id`, so the demo `업무` tab opens with the prep card. Since
2026-09-17 (schema v27), the demo also carries a fourth work item — `○○물산 월 리포트 양식 회신`, dated
**yesterday**, `done: true`, with a `result` (`양식 v2 확정본을 메일로 송부 — 다음 달부터 적용`) — so the daily
reader's `오늘 업무` section states a `처리:` line; it is not in today's view, so the demo's own-day counts line
stays `남음 2건 · 이월 0건 · 완료 1건 · AI 제안 1건` unchanged ([TD-57](../exec-plans/tech-debt-tracker.md) still
holds — there is still no carried row). The tomorrow event also carries two `checks`
([schedule.md](schedule.md)). See [demo-data.md](../design-docs/demo-data.md), [meetings.md](meetings.md).

**Tracks and the day-job project (v28).** Every existing demo work item is `track: "biz"`; the day-job project
`데이터 프로파일링 — 데모기관` ([meetings.md](meetings.md)) adds one `track: "work"` follow-up-mirrored item
(`결측 컬럼 목록 정리`, due tomorrow) and one manual `track: "work"` item today (`프로필 리포트 초안`) — the
demo counts move to `남음 4건 · 이월 0건 · 완료 1건 · AI 제안 1건` with the work tab's heads `직장 2건` and
`사업 3건` (two open plus one done business item today; the head counts every row of the day, done included).
**Time budget and payments (v28 Phase 3).** The done AI work item (`전기기사 필기 기출 1회분 채점`) gains
`minutes: 180`; `s.timeLog` holds three entries dated today: business 180 minutes with that item's `workId`,
business 90 minutes with no `workId`, day-job 60 minutes — so the work tab's week line reads `이번 주 사업
4.5h/20h · 남은 날 {d}`. See [demo-data.md](../design-docs/demo-data.md).

## E2E coverage

`tools/e2e/flow11.js` (written 2026-09-17, **not run** — standing user instruction) runs between `flow10.js` and
`flow4.js`: the tab's empty state, counts line and day paging; a progress entry added in the meeting view,
listed newest first, counted on the minutes row, and proven to move nothing else; the progress textarea's
empty/over-cap refusals; the `AI에 보내지 않기` checkbox round-tripped through the meeting form and stated in
the view; a manual work item registered with a project link, changing no task, meeting, streak or trophy;
completion in place (struck through, reversible); an item three days back carried into today's list with lead
`이월 3일`, absent on other days, listed with `수기` on its own day, and its stored date never rewritten;
completing a carried item keeps its date and takes it off today's list; select mode covering a carried row; a
twenty-first item on one day registered (no per-day cap); both new arrays present in the exported backup file;
the work packet carrying a visible meeting's summary, progress and follow-up lines, only the date and title of a
hidden one, and no profile identifier; the packet's `업무 기록 (이월·어제·오늘)` section stating a carried item;
a pasted reply importing two of three proposals (one rejected as a duplicate) with `source: "ai"`; a reply
naming `tasks`/`deals`/`events`/`meetings` creating none of them; the briefing's `이월 업무 {n}건 · 최장 {d}일`
line opening the `업무` tab; a project-linked event and a title-matched event giving the tab's `오늘 회의 준비`
two blocks, one tap opening its meeting, and the briefing's `회의 준비` section stating the same counts plus
overdue follow-ups once one is late. **Urgent memos and transcripts (2026-09-17)** add two more steps: the work
packet states a planted project-less memo as `- {today} [프로젝트 없음] {title}` with its `요약:` line and none
of its transcript (a planted sentinel string, absent from the packet); and, with a meeting-linked and a
goal-linked work item both planted, `회의록 열기` on the former replaces the sheet with the meeting's view (one
overlay, the collapsed `녹취록 …자 · 펼치기` row), closing it lands on `업무`, and the goal-linked item has no
such button. **Documents and pre-meeting checks (2026-09-17, schema v27)** add: the prep card's `회의록 열기 ›`
button replaces the old whole-block tap (the prep step in `flow11.js` was updated to tap it); five more
`flow11.js` steps cover the checklist add/tick/delete, the event sheet's checklist, the prep packet, a pasted
prep reply, and `확인할 것 가져오기` — see [meetings.md](meetings.md) and [schedule.md](schedule.md) for the full
detail. Every step parses (`node --check`); none has been executed.

**Tracks (v28, written 2026-09-17):** one item per track planted and listed in `flow11.js` lists the reading
order `직장` → `사업` → `개인` under the heads `직장 1건` / `사업 1건` / `개인 1건`, and the sheet's chips
round-trip `track`; a day-job project, meeting, work item, event and contract stay out of the work, daily and
prep packets. **Time budget and time log (v28 Phase 3, written 2026-09-18):** typing `90` into `걸린 시간` and
completing writes `minutes: 90` and exactly one business `timeLog` entry with the item's `workId`, moving `work`
and `timeLog` only; the week line moves from `0h/20h` to `1.5h/20h`; un-completing removes the entry and keeps
`minutes`; `1441` is refused; deleting a completed item leaves no entry. The week line opens `사업 시간 기록`,
whose quick entry records minutes by track (`timeLog` only) and whose settings save writes `settings` only.
See [tools/e2e/README.md](../../tools/e2e/README.md) for the running step count.

## What a work item never does

- No `goalId`, no difficulty, no points, no trophy, no achievement record, no streak effect, no evidence gate.
- It never runs through `tryComplete`, `completeTask` or `needsEvidence` — `toggleWork` is the only completion
  path, and it changes `done` alone.
- It is excluded from `agendaOf`, `todoOf`, `krProgress` and `goalProgress` — `할 일` never lists a work item.
  `buildBriefing` (schema v26) now states the carried count and its oldest age (`이월 업무 {n}건 · 최장 {d}일`),
  and the meeting-prep counts and overdue follow-ups — always as numbers, never a work item's title or content.
- `buildAssistantPacket` (the daily check-in packet) and `calendarExportOf` never read `work` — a work item
  never appears in that packet or in the exported calendar file.
- `parseAssistantReply` never reads a `work` key, and `parseWorkReply` never reads `tasks`, `deals`, `events` or
  `meetings` — the two bridges cannot create each other's record kind.
- (v28) A `work`-track item never enters the work packet, the daily packet, a prep packet or the `주간 회고`
  packet, whatever else is true about it; a time-log entry and the weekly business-hours setting pay nothing,
  move no grade and are never read by `computeGrades` or `krProgress`.
