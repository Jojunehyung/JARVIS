# Meetings tab — `미팅`

Added 2026-09-16 (schema v23, [decision log](../design-docs/decision-log.md)). The user asked, verbatim, to use
the tab only for storing meeting content, because an automated meeting workflow (transcription, an API) needs
paid features the app deliberately does not have. `미팅` is storage only: hand-written or pasted minutes grouped
by project, in the user's own words, never generated, never sent anywhere, never scored.

## What a meeting record is, and is not
A record of what was said, never a task and never an appointment:
```
meetingProjects: [{ id, name, note?, createdAt }]
meetings: [{ id, projectId, date("YYYY-MM-DD"), title, attendees?, summary, decisions?, actions?, eventId?, createdAt, taskIds[],
             progress[], aiHidden }]
```
No time, place, repeat, reminder, status, goal, points or evidence field: **the time of a meeting lives only in
`일정`** — this is the 2026-09-11 decision that removed the `meet` activity kind because a meeting overlaps the
schedule tab, applied consistently here ([decision log](../design-docs/decision-log.md)). `date` is the day the
minutes belong to — needed to order minutes even when no schedule event exists for that meeting. `eventId`
optionally points at the `일정` event whose occurrence falls on `date` (for a repeating event, `eventId` + `date`
together identify the occurrence); the meeting copies nothing from that event and reads its time and title live,
at render. Deleting the linked event never deletes the minutes: the view states the link is gone
(`연결된 일정이 삭제됐어요`), it is never cleaned up automatically ([TD-46](../exec-plans/tech-debt-tracker.md)).

`progress` (schema v25, 2026-09-17) holds dated entries of the work that followed the meeting — see
[daily-work.md](daily-work.md) for the log itself, added and deleted only in `MeetingViewModal`. `aiHidden`
(schema v25) is a boolean, always present, set from a checkbox in `MeetingModal`: when true, the work packet
(`buildWorkPacket`, [assistant-bridge.md](../design-docs/assistant-bridge.md)) states only this meeting's date
and title, never its summary, decisions, follow-ups or progress.

`taskIds` (schema v24, 2026-09-16) holds the ids of existing tasks the minutes refer to, at most
`MEETING_LIMITS.tasks` (10). The user asked, verbatim, `회의록 작성은 할일목록들과 매칭 가능하게 해줘`, and chose
to link **existing** tasks only — a meeting never creates a task, because tasks are still created only inside a
goal ([Rule 18](../design-docs/core-beliefs.md#rule-18), [Rule 19](../design-docs/core-beliefs.md#rule-19)) — and
to show the link on both sides. A link is a reference: it pays nothing, completes nothing and moves no goal, KR or
streak ([Rule 1](../design-docs/core-beliefs.md#rule-1), [Rule 9](../design-docs/core-beliefs.md#rule-9)). The
reverse list on the task sheet (`meetingsOfTask`) is computed at render, never stored.

Full transcripts are not stored, by the user's own decision: `summary` is a hand-written or pasted minutes-style
summary, not a recording or a verbatim transcript.

A meeting is a record, never a task ([Rule 1](../design-docs/core-beliefs.md#rule-1),
[Rule 18](../design-docs/core-beliefs.md#rule-18)): no payout, no trophy, no goal, no streak, no evidence gate.
`removeEvent`, `updateEvent`, `toggleEventDone`, `EventRow` and `ScheduleCalendar` are unchanged by any of this;
`todoOf`, `agendaOf`, `buildBriefing`, `buildAssistantPacket`, `parseAssistantReply` and `calendarExportOf` do not
read `meetingProjects` or `meetings` — nothing here reaches the to-do list, the briefing, the packet or the
calendar file ([Rule 7](../design-docs/core-beliefs.md#rule-7)).

## Caps and the storage arithmetic
`MEETING_LIMITS = { title: 40, attendees: 80, summary: 5000, decisions: 600, actions: 600, tasks: 10, progress: 300 }` (the minutes caps were widened at the user's request, from 800 / 200 / 200 to 1000 / 400 / 400 on 2026-09-16, to 1500 / 600 / 600 and then the summary alone to 5000 on 2026-09-17; `progress` is new at schema v25),
`PROJECT_LIMITS = { name: 40, note: 200 }`. 5,000 Hangul characters is about three pages of key points — still short of a transcript, which runs about 21,000 characters for a 45-minute meeting.
`MEETING_TASK_ROWS = 30` shapes the task-link picker (below); `MEETING_PROGRESS_MAX = 30` caps the progress
entries per meeting.

- Unit: `storageUsedBytes` counts string length, so the budget is `STORAGE_BUDGET` = 3.5 × 1,048,576 = 3,672,064
  chars, shared with the rest of the save and every thumbnail. `JSON.stringify` keeps Hangul as one char; a
  newline costs two (`\n`).
- Overhead of an empty record (ten-char `uid`s, both dates, all keys, the comma), measured, is about 190 chars.
- Largest record: 40 + 80 + 5,000 + 600 + 600 + 190 = **6,510 chars**, plus one per newline. Completely full records at three a working day (750 a year) use 4.88 M chars a year and cross the budget in about nine months; typical minutes (~850 chars) are unaffected, since a higher cap does not make minutes longer.
- Task links (v24): `,"taskIds":[]` adds 13 chars to every record and each linked id 12 more (a ten-char `uid`,
  two quotes, a comma, less one comma for the first), so ten links add 13 + 120 − 1 = **132 chars**: a full record
  with ten links is about 6,642 chars. `recordFits` (renamed from `meetingFits`, 2026-09-17) stringifies the
  whole record, `taskIds` included, so the same guard refuses a save that would cross the budget; no new check
  was needed.
- Progress entries and the AI flag (v25): `,"progress":[]` (14) + `,"aiHidden":false` (17) = **31 chars** added
  to every record. One entry, `{"id":"…","date":"YYYY-MM-DD","text":""}`, is about 45 chars plus its text (+ 1
  comma): a typical 80-char entry ≈ 125, a full 300-char entry ≈ 345; thirty full entries ≈ 10,380 chars — so a
  completely full meeting with ten task links and thirty full progress entries reaches about
  6,642 + 31 + 10,380 ≈ **17,050 chars**. Typical minutes (~850) with three typical entries (~125 each) reach
  about 850 + 31 + 375 ≈ **1,260 chars**; three a working day ≈ 0.95 M chars a year (26 % of the budget a year,
  about 3 years 10 months before the guard applies). `recordFits` measures the whole record, `progress` included.
- Typical record assumed: title 25, attendees 30, summary 400, decisions 100, actions 100 → 655 + 190 = **~850 chars**. Unchanged by the wider caps: a higher cap does not make minutes longer.
- Frequency assumed: "several a day" = 3 meetings per working day × 250 days = **750 records a year** (2 a day = 500).

| Case | Per year | Share of 3.5 MB after 3 years | after 5 years |
|---|---|---|---|
| 3/day, typical (850, no progress) | 0.64 M chars | 1.91 M (52 %) | 3.19 M (87 %) |
| 2/day, typical (850, no progress) | 0.43 M chars | 1.28 M (35 %) | 2.13 M (58 %) |
| 3/day, typical minutes + 3 progress entries (1,260) | 0.95 M chars | 2.84 M (77 %) | exceeds (about 3 years 10 months) |
| 3/day, every field full incl. progress (17,050) | 12.79 M chars | exceeds (well under 1 year) | exceeds |

Typical minutes fit three to five years at several a day; completely full records at three a day fit about
nine months. The caps alone cannot promise more, so two facts guard the rest: (1) the tab always states its storage
use, `저장 공간 {mb}MB / 3.5MB` (`storageUsedWith(state)`, memoised on `state`, not `storageUsedBytes()` alone —
see below); (2) saving a meeting is refused, with the form kept open and nothing lost, when the record would push
total usage over the budget. The backup file is the way out of a full budget (export, then delete old minutes).
No IndexedDB. Re-serialising the whole state on every change to compute storage use is recorded as tech debt
([TD-45](../exec-plans/tech-debt-tracker.md)).

`storageUsedWith(state)`, not `storageUsedBytes()` alone: the root persists `state` in an effect that runs after
render, so reading `storageUsedBytes()` alone during a render or a handler can be one change behind. It computes
`storageUsedBytes() - (bytes currently stored under KEY) + JSON.stringify(state).length`, i.e. storage use as it
will be once the current in-memory `state` is what is on disk — the meeting guard and the tab's storage line both
read this instead.

## The tab
`NAV` inserts `["meetings", "미팅", MessagesSquare]` between `일정` and `사업`: `프로필 · 목표 · 할 일 · 업무 ·
일정 · 미팅 · 사업` (seven tabs since 2026-09-17, [daily-work.md](daily-work.md)). Position: next to `일정`,
because a meeting's time is an `일정` event and its minutes link to it; before `사업`, because projects here are
usually client work recorded under `사업`. The bar is `grid-cols-7`; labels stay on one line (each nav `<span>`
is `whitespace-nowrap`).

`MeetingsTab({ state, onAddProject, onEditProject, onAddMeeting, onOpenMeeting })`:
- Header section: `SectionLabel` (cyan) `미팅 — 프로젝트별 회의록`, button `프로젝트 추가` on the right (same style
  as `일정 추가`); caption `회의 시간은 일정 탭에, 회의에서 나온 내용은 여기에 적어요. 회의록은 목표·실행·점수에
  반영되지 않아요.`; counts line (`font-mono text-xs text-zinc-400`) `프로젝트 {p}개 · 회의록 {n}건 · 저장 공간
  {mb}MB / 3.5MB` (`mb` to one decimal).
- No project: one section `프로젝트가 없어요 — 프로젝트를 먼저 만들어요.`
- One section per project, ordered by its newest minutes date (`meetingOrder`, descending), projects without
  minutes last, ordered by `createdAt` descending. Section head: the project name (`text-sm font-bold truncate`),
  `회의록 {n}건` (mono), buttons `프로젝트 수정` and `회의록 추가`. Rows are the newest-first minutes
  (`meetingOrder`: `date` descending, then `createdAt` descending) rendered as `TodoRow`s ([tasks.md](tasks.md)) —
  lead chip `{date.slice(2)}` (`YY-MM-DD`, zinc tone), the title, no marker — each opening `onOpenMeeting(id)`.
  The first `MEETING_ROWS_SHOWN` (5) rows show; beyond that, `{n}건 더 보기` / `접기` toggles a component-state
  expansion (`useState`, per-project, never stored — [Rule 9](../design-docs/core-beliefs.md#rule-9)). An empty
  project reads `회의록이 없어요.`

## Sheets
- **`ProjectModal({ project, meetingCount, onClose, onAdd, onUpdate, onRemove })`**, `modal: { type: "project",
  projectId? }`, title `새 프로젝트` / `프로젝트 수정`: inputs `프로젝트 이름 — 예: ○○물산 재고 관리`, `메모
  (선택)`; errors `프로젝트 이름을 입력해 주세요.`, `프로젝트 이름은 40자까지예요 — 지금 {n}자예요.`, `메모는 200자
  까지예요 — 지금 {n}자예요.`; button `등록` / `저장`; in edit mode, `삭제` is enabled only when `meetingCount ===
  0` (no confirmation dialog needed — nothing is lost); otherwise it is disabled and the sheet states `회의록
  {n}건이 있어 삭제할 수 없어요 — 회의록을 먼저 지워요.` The root handler (`removeProject`) refuses a project with
  minutes too, not only through the disabled button, and toasts the same message.
- **`MeetingModal({ state, meeting, projectId, today, onClose, onAdd, onUpdate, onRemove })`**, `modal: { type:
  "meeting", meetingId?, projectId? }`, title `새 회의록` / `회의록 수정`: `프로젝트` chips (preselected from
  `projectId` or the record's own), `날짜` date input (default `today`), inputs `회의 이름 — 예: 2차 요구사항
  회의`, `참석자 (선택) — 예: 김OO, 박OO`; textareas (with `{n} / {cap}` counters, rose over cap, no
  `maxLength` — a paste is never silently truncated, the submit refuses instead) `회의 요약 — 논의한 내용을 요점
  으로 적어요` (`rows=8`), `결정 사항 (선택)`, `후속 조치 (선택)` (`rows=3` each); `일정 연결 (선택)` chips from
  `eventsOn(state, date)`: `연결 안 함` plus `{time || "시간 미정"} {title}` per occurrence that day, or the line
  `이 날짜에는 일정이 없어요.`; changing the date clears a link whose event no longer has an occurrence on the new
  date. `할 일 연결` (v24), placed directly under the date and above the text fields so it is in view on a phone without scrolling (moved 2026-09-16): a header with the `{n} / 10` count, a text filter input `할 일 검색`, and one
  `role="checkbox"` row per candidate from `meetingTaskCandidates(state, today)` — open tasks first in the `할 일`
  list's own `todoOf` order, then every completed task, newest first (no age cut-off since 2026-09-16 — minutes often concern work finished long ago; the row cap and the search keep a long history usable). Each row shows a tick box, the
  to-do row's lead chip (`todoLeadOf`; an archived-style `MM-DD` chip for a completed task; an overdue chip is
  rose-300 here because rose-400 is reserved for the form's validation line) and the title, struck through and
  dimmed when completed. A linked task that is not a candidate (a finished task with no completion date on record) stays listed
  so it can be unticked, and linked rows stay visible whatever the filter. At most 30 rows render; beyond that
  `할 일 {n}건 더 있음 — 검색어로 좁혀요`. No match: `검색 결과가 없어요.`; no task at all: `연결할 할 일이 없어요.`
  At 10 links every unticked row is disabled and the line `할 일은 10개까지 연결돼요.` shows. A caption states
  `연결은 기록이에요 — 할 일의 상태·점수·목표는 바뀌지 않아요.` On an edit, an id whose task was deleted is dropped
  from the initial selection, so it never counts toward the cap; saving writes `taskIds` (always an array,
  possibly empty) with ids of live tasks only. Below the `일정 연결` chips, a checkbox `AI에 보내지 않기` (state
  `aiHidden`, schema v25, initialised from the record) with the caption `켜면 오늘 업무 만들기 패킷에 이
  회의록의 날짜와 제목만 실려요.` ([daily-work.md](daily-work.md)); the saved record always carries `aiHidden`
  as a boolean and keeps the live `progress` array untouched — the form never edits entries. Note `전체 녹취가 아니라 요약만 저장해요.` Submit refuses, in order, with `프로젝트를 골라 주세요.`,
  `날짜를 선택해 주세요.`, `회의 이름을 입력해 주세요.`, `회의 요약을 입력해 주세요.`, then the four
  `{field}은/는 {cap}자까지예요 — 지금 {n}자예요.` cap messages. The record is built with only non-empty optional
  fields — a cleared field disappears from the save on an edit. `onAdd` / `onUpdate` answer with an error string
  (`""` = saved); a non-empty return — the storage-budget refusal — is shown as the modal error:
  `저장 공간이 부족해요 — 현재 {mb}MB 사용 중이라 회의록을 저장하지 않았어요. 백업을 내보낸 뒤 오래된 회의록이나
  사진을 지워요.` and the form stays open with everything typed. Edit mode adds `삭제` →
  `window.confirm("{title} 회의록을 삭제해요. 계속할까요?")`.
- **`MeetingViewModal({ state, meetingId, today, onClose, onEdit, onOpenTask, onAddProgress, onRemoveProgress })`**,
  `modal: { type: "meetingView", meetingId }`,
  title the meeting's own title: `CvFact wrap` rows `프로젝트`, `날짜` (mono), `참석자` (or `기록 없음`), `일정`
  (`{time || "시간 미정"} {title}` read live from the linked event; `연결 없음` with none; `연결된 일정이
  삭제됐어요` when `eventId` matches no live event), `AI 전송` (`보내지 않음` when `aiHidden`, else
  `요약·진행사항 포함`); then three blocks with a `SectionLabel` each — `요약`,
  `결정 사항`, `후속 조치` — `<p className="whitespace-pre-wrap break-words">` (or `없음`); a `진행사항` block
  (schema v25) with a mono `{n}건` beside its label, newest-first entries (`date` descending, then stored order)
  each showing the entry's date (mono), its text, and an `X` button (`aria-label="진행사항 삭제"`) that confirms
  `진행사항을 삭제해요. 계속할까요?` before calling `onRemoveProgress(meetingId, entryId)`; empty state
  `진행사항이 없어요.`; below it a `진행사항 추가` textarea (`rows=2`, capped at `MEETING_LIMITS.progress`) and an
  `추가` button calling `onAddProgress(meetingId, text)`, refusing in order with `진행사항을 입력해 주세요.`,
  `진행사항은 300자까지예요 — 지금 {n}자예요.`, `진행사항은 30건까지예요.`, or the storage-refusal line the
  handler returns ([daily-work.md](daily-work.md)); then a `연결된 할 일`
  block (v24) with one `TodoRow` per linked live task — lead `완료` when closed, otherwise the to-do row's own chip
  (`linkedTaskLead`), struck through when closed — each tapping `onOpenTask(id)` →
  `setModal({ type: "taskDetail", taskId })`, which replaces this sheet in the single modal slot; ids whose task no
  longer exists are skipped and counted, `삭제된 할 일 {n}건`; none linked → `연결된 할 일이 없어요.`; a full-width
  `수정` button → `setModal({ type: "meeting", meetingId })`.
- **Reverse side**: `TaskDetailModal` shows `관련 회의록` — the meetings whose `taskIds` include the task, newest
  first, each a `TodoRow` led by the full `date` and titled with the meeting title, opening `MeetingViewModal`. The
  section is hidden when no meeting links the task ([tasks.md](tasks.md)).

## Root handlers and toasts
Clone-pattern updates next to the business handlers, all reading and writing only `meetingProjects` and
`meetings` — never `act`, `tasks`, `goals`, `areas`, `room`, `exams`, `events` or `work`
([Rule 1](../design-docs/core-beliefs.md#rule-1), [Rule 18](../design-docs/core-beliefs.md#rule-18)):

| Handler | Effect | Toast |
|---|---|---|
| `addProject(p)` | prepends `{ id: uid(), ...p, createdAt: today }` | `프로젝트를 등록했어요` |
| `updateProject(id, next)` | replaces the record, keeping `id` and `createdAt` | `프로젝트를 수정했어요` |
| `removeProject(id)` | refuses (toast only, no state change) when the project still has minutes; otherwise drops it | `프로젝트를 삭제했어요` |
| `addMeeting(next)` | refused by `recordFits` when it would cross the budget (returns the message, writes nothing); otherwise prepends `{ id: uid(), ...next, createdAt: today }` | `회의록을 등록했어요` |
| `updateMeeting(id, next)` | refused the same way; otherwise replaces the record via `putMeeting`, keeping `id` and `createdAt` | `회의록을 수정했어요` |
| `removeMeeting(id)` | confirms by name, then drops the record; no task changes | `회의록을 삭제했어요` |
| `addProgress(meetingId, text)` (schema v25) | refuses at `MEETING_PROGRESS_MAX` or `recordFits`; otherwise prepends `{ id: uid(), date: today, text }` to `progress` via `putMeeting` | `진행사항을 추가했어요` |
| `removeProgress(meetingId, entryId)` (schema v25) | filters the entry out via `putMeeting` | `진행사항을 삭제했어요` |

Two task handlers write `meetings` since v24, and only to remove a link: `removeTask(id)` drops the id from every
meeting's `taskIds` in the same clone update that removes the task, and `removeGoal(id)` does the same for the
open tasks it deletes with an active goal. Links therefore never dangle going forward; a dangling id from an older
or hand-edited save is still skipped and counted at render, never cleaned up by a read.

`recordFits(next, prevLen = 0, noun = "회의록을")` (renamed from `meetingFits` 2026-09-17, so the one guard also
covers progress entries and work items — [daily-work.md](daily-work.md)):
`storageUsedWith(state) + JSON.stringify(next).length - prevLen <= STORAGE_BUDGET` (`prevLen` is the stored
length of the record being replaced, so editing a meeting is judged against the space it frees, not
double-counted); `noun` is the object-marked word substituted into the refusal sentence, built by the caller
(`"회의록을"` / `"진행사항을"` / `"업무를"`) — the helper does no grammar of its own. `putMeeting(rec)` replaces
one meeting record in place; callers build and budget-check the record first.

## Backup, reset and migration (schema v23–v25)
```js
if (s.v < 23) {
  s = { ...s, v: 23, meetingProjects: s.meetingProjects || [], meetings: s.meetings || [] };
}
if (s.v < 24) {
  s = { ...s, v: 24, meetings: (s.meetings || []).map((m) => ({ ...m, taskIds: Array.isArray(m.taskIds) ? m.taskIds : [] })) };
}
if (s.v < 25) {
  s = { ...s, v: 25, work: Array.isArray(s.work) ? s.work : [],
    meetings: (s.meetings || []).map((m) => ({ ...m, progress: Array.isArray(m.progress) ? m.progress : [], aiHidden: m.aiHidden === true })) };
}
```
`freshState`: `v: 25`, `meetingProjects: []`, `meetings: []`, `work: []`. `exportBackup` writes the whole
`state`, so every array travels in the backup file with no code change of their own; `importBackup` runs the
file's `state` through `migrate`, so an older backup gains the new fields on import; `resetAll` deletes the
state key, which removes every project, every meeting and every work item along with the rest of the save. See
[state-lifecycle.md](../design-docs/state-lifecycle.md) and [install-and-backup.md](install-and-backup.md).

`demoState` carries two synthetic projects (`○○물산 재고 관리 자동화`, `△△테크 문서 검색 AI`) and three short
synthetic minutes dated 9, 3 and 1 days before today, with no personal names (`담당자 A`, `담당자 B`) and no
`eventId` link. `유지보수 범위 협의` links two demo tasks (`이력서 초안 작성`, `CATIA·도면 연습 1시간`) so both
sides of the task link show in the demo, and carries one progress entry; `요구사항 1차 회의` is flagged
`aiHidden: true`; the other meeting carries `taskIds: []`, empty `progress` and `aiHidden: false`. See
[demo-data.md](../design-docs/demo-data.md).

## What a meeting never does
- No `goalId`, no difficulty, no points, no trophy, no achievement record, no streak effect, no evidence gate.
- Linking a task never changes it: no status, due date, goal, KR count or completion moves, and the task sheet's
  `관련 회의록` list is derived at render. A meeting never creates a task.
- It never runs through `tryComplete`, `completeTask` or `needsEvidence` — there is no completion path for a
  meeting at all.
- It is excluded from `agendaOf`, `todoOf`, `krProgress` and `goalProgress`; `할 일` never lists a meeting.
- `buildBriefing` and `buildAssistantPacket` (the daily check-in packet) still never read `meetingProjects` or
  `meetings` — a meeting title never appears in the daily briefing or that packet
  ([Rule 7](../design-docs/core-beliefs.md#rule-7)). The **work packet** (`buildWorkPacket`,
  `오늘 업무 만들기`) does read `meetings` by the user's own 2026-09-17 decision — reversing the prior default —
  unless a meeting is flagged `aiHidden`, in which case only its date and title appear; see
  [daily-work.md](daily-work.md) and [assistant-bridge.md](../design-docs/assistant-bridge.md).
- `calendarExportOf` never reads it — a meeting is not exported to the phone calendar; its time, if any, is
  whatever the linked `일정` event already exports.
- Deleting the linked `일정` event never deletes or edits the minutes; the view states the link is gone rather
  than hiding or fabricating a time ([Rule 13](../design-docs/core-beliefs.md#rule-13)).
