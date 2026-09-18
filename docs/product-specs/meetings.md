# Meetings tab — `미팅`

Added 2026-09-16 (schema v23, [decision log](../design-docs/decision-log.md)). The user asked, verbatim, to use
the tab only for storing meeting content, because an automated meeting workflow (transcription, an API) needs
paid features the app deliberately does not have. `미팅` is storage only: hand-written or pasted minutes grouped
by project, in the user's own words, never generated, never sent anywhere, never scored.

Since 2026-09-17, the tab also holds **urgent memos** — meetings with no project (`projectId: null`), listed
under their own group `프로젝트 없음 · 긴급 메모` — and an optional **transcript** (`meetings[].transcript`) kept
exactly as pasted, up to 30,000 characters. This supersedes the "full transcripts are not stored" sentence below
from 2026-09-16: the app still transcribes nothing itself (no recording, no speech-to-text, no API); the user
pastes text they transcribed themselves, and the app stores it verbatim and never processes it — no summary, no
split, no judgement ([Rule 7](../design-docs/core-beliefs.md#rule-7)).

Since 2026-09-17 (schema v27), the tab also lists **documents** — top-level records of what a file says,
attached to a project or to none — and, on a project-linked schedule event, a **pre-meeting checklist** and a
copy/paste AI prep packet. These are covered in full in [documents.md](documents.md) and
[schedule.md](schedule.md)/[assistant-bridge.md](../design-docs/assistant-bridge.md); this document covers where
they surface inside `미팅` itself (below) and the storage arithmetic they add.

## What a meeting record is, and is not
A record of what was said, never a task and never an appointment:
```
meetingProjects: [{ id, name, note?, track("work"|"biz"|"personal"), createdAt }]
meetings: [{ id, projectId(string | null), date("YYYY-MM-DD"), title, attendees?, summary, decisions?, actions?, transcript?, eventId?, createdAt, taskIds[],
             progress[], aiHidden, followUps[{ id, text, mine, due?, done, workId? }], track?("work"|"biz"|"personal") }]
```
`track` on a project (schema v28) is a stored field with `TrackRow` chips in `ProjectModal`, default `work`,
backfilled `work` on every existing project. `track?` on a meeting is written **only for a memo**
(`projectId == null`) — a project meeting inherits its project's track (`meetingTrack`, below) and never stores
one of its own; `commitMeeting` deletes `rec.track` before the reconcile whenever `rec.projectId != null`, so a
memo moved into a project drops its own track key on that save. See [Tracks (v28)](#tracks-v28).
`projectId` may be `null` since 2026-09-17: an urgent memo with no project. No backfill was needed — the form
always writes the key, so an absent `projectId` never occurs, and `null` is a value every existing reader now
tolerates or has been updated to state (below).
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

`followUps` (schema v26, secretary stage 1-A, 2026-09-17) holds **structured** follow-up items next to the
free-text `actions`, which the migration and everything else never rewrites
([Rule 12](../design-docs/core-beliefs.md#rule-12)): `{ id, text (≤ 200, `MEETING_LIMITS.followUp`), mine
(boolean, default `false`), due?("YYYY-MM-DD"), done (boolean), workId? }`, at most `MEETING_FOLLOWUPS_MAX` (30)
per meeting. An item the user marks `내 담당` (`mine: true`) is **registered automatically as a work item**
(`source: "meeting"`, [daily-work.md](daily-work.md)) and the two stay linked both ways — only `done` mirrors,
in either direction; text, due date and the work item's date never mirror back. See "Follow-up items" below.

`taskIds` (schema v24, 2026-09-16) holds the ids of existing tasks the minutes refer to, at most
`MEETING_LIMITS.tasks` (10). The user asked, verbatim, `회의록 작성은 할일목록들과 매칭 가능하게 해줘`, and chose
to link **existing** tasks only — a meeting never creates a task, because tasks are still created only inside a
goal ([Rule 18](../design-docs/core-beliefs.md#rule-18), [Rule 19](../design-docs/core-beliefs.md#rule-19)) — and
to show the link on both sides. A link is a reference: it pays nothing, completes nothing and moves no goal, KR or
streak ([Rule 1](../design-docs/core-beliefs.md#rule-1), [Rule 9](../design-docs/core-beliefs.md#rule-9)). The
reverse list on the task sheet (`meetingsOfTask`) is computed at render, never stored.

`summary` is a hand-written or pasted minutes-style summary, not a recording. **Superseded 2026-09-17**: `summary`
is still that, but a meeting may separately carry `transcript` (optional, ≤ 30,000 chars) — the pasted text kept
exactly as pasted, no normalisation, no clipping beyond the cap. It is written in `MeetingModal` (collapsed
behind a `녹취록 붙여넣기` button while empty), read collapsed in `MeetingViewModal` (`녹취록 {n}자 · 펼치기`) and
cleared on its own (`녹취록 지우기`, below) — never merged with `summary`, never summarised, split or judged by
the app. Only the form, the view, `clearTranscript`, `recordFits` (through `JSON.stringify` of the whole record)
and `demoState` read it; no packet, the calendar file or the prep card do ([Rule 7](../design-docs/core-beliefs.md#rule-7), [SECURITY.md](../SECURITY.md)).

A meeting is a record, never a task ([Rule 1](../design-docs/core-beliefs.md#rule-1),
[Rule 18](../design-docs/core-beliefs.md#rule-18)): no payout, no trophy, no goal, no streak, no evidence gate.
`removeEvent`, `updateEvent`, `toggleEventDone`, `EventRow` and `ScheduleCalendar` are unchanged by any of this;
`todoOf`, `agendaOf`, `buildBriefing`, `buildAssistantPacket`, `parseAssistantReply` and `calendarExportOf` do not
read `meetingProjects` or `meetings` — nothing here reaches the to-do list, the briefing, the packet or the
calendar file ([Rule 7](../design-docs/core-beliefs.md#rule-7)).

## Tracks (v28)
Every project, document, event, work item and deal carries a `track` (`work`/`직장` — the day job; `biz`/`사업`
— the business; `personal`/`개인` — private life), declared once at the head of the Business region:
```js
const TRACKS = ["work", "biz", "personal"];
const TRACK_LABEL = { work: "직장", biz: "사업", personal: "개인" };
const trackOf = (rec, fallback = "work") => (TRACKS.includes(rec?.track) ? rec.track : fallback);
```
A meeting is the one kind that does not store its own track when it belongs to a project — it **inherits**:
`meetingTrack(state, m)` returns `trackOf(m)` for a memo (`m.projectId == null`) and otherwise `trackOf` of the
meeting's project. A record of another kind whose `track` is missing (a hand-edited save) reads as `work`, the
safe default — a record wrongly left on the day-job track is only absent from a packet, never leaked; there is
no per-record "send to AI anyway" override ([TD-73](../exec-plans/tech-debt-tracker.md), backlog).

- **The form row.** `TrackRow({ value, onPick, caption })`, a shared component beside `BizChips`: label `트랙`,
  the three chips, caption `직장 트랙은 AI 패킷에 실리지 않아요.` `ProjectModal` shows it after `메모 (선택)`,
  default `work`. `MeetingModal` shows it **only while `pid === null`** (the memo path), default `work`; picking
  a project instead removes the row and, on submit, the record carries no `track` key at all.
- **`followUpWorkItem(fu, m, today, track)`** (gains a fourth argument) stamps the mirrored work item with the
  meeting's track at creation; `reconcileFollowUps` passes it through. The work item then keeps its own `track`
  field afterwards — editing the meeting's or the project's track later never rewrites an already-created work
  item ([Rule 12](../design-docs/core-beliefs.md#rule-12) in spirit: the app never cascades a track change).
- **Section heads and rows.** `groupHead(name, rowCount, docCount, track)` prints a mono tag (`TRACK_TONE[track]`)
  before the counts on a project's section head; the memo group's own head carries no tag (a memo has no single
  track until read per row); each memo row's marker is prefixed with that memo's own track label and ` · `; each
  document row's marker becomes the track label, ` · ` and the `yy-mm-dd` date.
- **Packet exclusion.** A `work`-track record never enters the work packet, the daily packet or a prep packet —
  see [assistant-bridge.md](../design-docs/assistant-bridge.md) (`PACKET_TRACKS`). `buildWorkPacket` filters its
  meetings by `PACKET_TRACKS.includes(meetingTrack(state, m))` before the slice; a linked event or deal on the
  `work` track is never named through a live-link lookup either — `buildPrepPacket` treats a packet-track
  event's `work`-track project as if the event had no project at all (no project name, minutes, documents or
  contracts), and `meetingPacketLines`' `일정:` fact line omits a linked event's title when that event is
  currently on the `work` track (a **deleted** link is still stated as gone). `MeetingPrepCard`'s block for a
  `work`-track event replaces the `AI에게 회의 준비 묻기` button with the line `직장 트랙 — AI 패킷에 실리지
  않아요` and states the event's track label on its second line.
- **Order.** Every surface that lists mixed-track records — the reader, the briefing, the work tab — orders
  `직장` first, then `사업`, then `개인`: the day job's items must not slip, so they lead; see
  [daily-work.md](daily-work.md), [daily-reader.md](daily-reader.md), [daily-briefing.md](daily-briefing.md).

## Caps and the storage arithmetic
`MEETING_LIMITS = { title: 40, attendees: 80, summary: 10000, decisions: 1000, actions: 1000, tasks: 10, progress: 300, followUp: 200, transcript: 30000 }` (the minutes caps were widened at the user's request, from 800 / 200 / 200 to 1000 / 400 / 400 on 2026-09-16, to 1500 / 600 / 600 and then the summary alone to 5000 on 2026-09-17, and to 10000 / 1000 / 1000 on 2026-09-18; `progress` is new at schema v25, `followUp` at schema v26, `transcript` (2026-09-17, optional field, no migration) is `녹취록은` — placed last among the field caps, so the refusal order is title, attendees, summary, decisions, actions, then transcript, before the follow-up-row cap),
`PROJECT_LIMITS = { name: 40, note: 200 }`. 5,000 Hangul characters is about three pages of key points — still short of a transcript, which runs about 21,000 characters for a 45-minute meeting.
`MEETING_TASK_ROWS = 30` shapes the task-link picker (below); `MEETING_PROGRESS_MAX = 30` caps the progress
entries per meeting; `MEETING_FOLLOWUPS_MAX = 30` caps the follow-up items per meeting, refusing with
`후속 항목은 30건까지예요.`

- Unit: `storageUsedBytes` counts string length, so the budget is `STORAGE_BUDGET` = 3.5 × 1,048,576 = 3,672,064
  chars, shared with the rest of the save and every thumbnail. `JSON.stringify` keeps Hangul as one char; a
  newline costs two (`\n`).
- Overhead of an empty record (ten-char `uid`s, both dates, all keys, the comma), measured, is about 190 chars.
- Largest record: 40 + 80 + 10,000 + 1,000 + 1,000 + 190 = **12,310 chars**, plus one per newline. Completely full records at three a working day (750 a year) use 9.23 M chars a year and cross the budget in about four to five months; typical minutes (~850 chars) are unaffected, since a higher cap does not make minutes longer.
- Task links (v24): `,"taskIds":[]` adds 13 chars to every record and each linked id 12 more (a ten-char `uid`,
  two quotes, a comma, less one comma for the first), so ten links add 13 + 120 − 1 = **132 chars**: a full record
  with ten links is about 12,442 chars. `recordFits` (renamed from `meetingFits`, 2026-09-17) stringifies the
  whole record, `taskIds` included, so the same guard refuses a save that would cross the budget; no new check
  was needed.
- Progress entries and the AI flag (v25): `,"progress":[]` (14) + `,"aiHidden":false` (17) = **31 chars** added
  to every record. One entry, `{"id":"…","date":"YYYY-MM-DD","text":""}`, is about 45 chars plus its text (+ 1
  comma): a typical 80-char entry ≈ 125, a full 300-char entry ≈ 345; thirty full entries ≈ 10,380 chars — so a
  completely full meeting with ten task links and thirty full progress entries reaches about
  12,442 + 31 + 10,380 ≈ **22,850 chars**. Typical minutes (~850) with three typical entries (~125 each) reach
  about 850 + 31 + 375 ≈ **1,260 chars**; three a working day ≈ 0.95 M chars a year (26 % of the budget a year,
  about 3 years 10 months before the guard applies). `recordFits` measures the whole record, `progress` included.
- Follow-up items (v26): `,"followUps":[]` adds **15 chars** to every record. One item,
  `{"id":"…","text":"","mine":false,"done":false}`, is about 50 chars plus its text (+ 1 comma); `,"due":"YYYY-MM-DD"`
  adds 19 and `,"workId":"…"` adds 22, so a fully-keyed item is ≈ 92 chars + text — a typical 40-char item ≈ 90
  without a due date, ≈ 132 with a due date and a work link; a full 200-char item with both ≈ 292, and thirty of
  them ≈ 8,760 chars. A completely full meeting (ten task links, thirty full progress entries, thirty full
  follow-ups) reaches about 22,850 + 15 + 8,760 ≈ **31,625 chars**. Typical minutes with three typical progress
  entries and four typical follow-ups (~4 × 130 = 520) reach about 850 + 375 + 31 + 15 + 520 ≈ **1,810 chars**;
  three a working day ≈ 1.36 M chars a year (37 % of the budget a year, about 2 years 8 months before
  `recordFits` refuses). Each `mine` follow-up also creates a work item — see [daily-work.md](daily-work.md)'s
  storage arithmetic; `commitMeeting` measures the meeting record **plus every work item its reconcile creates**
  before writing either.
- Transcript (2026-09-17): `,"transcript":""` adds **15 chars**, only when a transcript exists; `"projectId":null`
  (16 chars) against `"projectId":"xxxxxxxxxx"` (24) makes a project-less memo 8 chars **smaller**. `JSON.stringify`
  writes every line break as `\n` (2 chars) and escapes every `"`, so a full 30,000-char transcript with ~300 line
  breaks stores as ≈ **30,315 chars**; a completely full meeting with one reaches about 25,825 + 15 + 30,315 ≈
  **56,140 chars**. Full transcripts alone: 3,672,064 / 30,315 ≈ **121** by the guard's own string-length unit;
  browsers meter `localStorage` in UTF-16 units (commonly 5 MiB per origin ≈ 2.6 M chars), so the physical bound is
  nearer **55** — the guard's own comment already calls it a heuristic ceiling, and this gap, pre-existing, is
  sharper now that one field can be 30,000 chars ([TD-59](../exec-plans/tech-debt-tracker.md), accepted). Typical: a
  ten-minute voice memo transcribed ≈ 2,500 Korean chars ≈ 2,540 stored; three such memos a week ≈ 0.4 M chars a
  year (11 % of the budget); one transcript on every one of three meetings a working day turns the v26 horizon
  (1,810 chars each, 37 % a year) into ≈ 4,350 × 750 ≈ 3.26 M a year (89 %), about **1 year 1 month** before
  `recordFits` refuses. `recordFits` already measures the whole record, transcript included, before any write, and
  the tab's `저장 공간` line already counts it; `clearTranscript` (`녹취록 지우기`) is the in-app way to reclaim it,
  the backup path the way out of a full budget.
- Track backfill (v28): `,"track":"work"` adds **15 chars** per project, document, event, work item and memo;
  `,"track":"biz"` adds **14** per deal; `,"track":"personal"` is 19 chars when chosen. A save with 20 projects,
  50 documents, 200 events, 500 work items, 20 deals and 10 memos grows by ≈ 12 k chars (0.3 % of the budget).
- Documents and checks (schema v27, [documents.md](documents.md), [schedule.md](schedule.md)) share the same
  storage budget: `,"documents":[]` adds 15 chars once; one document ≈ 91 chars + title + summary (+ 12 with a
  `source`); a full document (60 + 120 + 5,000) ≈ 5,283 chars, a typical one ≈ 753. One event check ≈ 60 chars +
  text, `,"checks":[]` adding 12 the first time; thirty full 200-char checks ≈ 7,829 chars on one event.
  `recordFits` measures a document record whole; `addCheck` / `importChecks` measure the event record as it will
  be written against its stored length, so ticking or deleting a check never trips the guard.
- Typical record assumed: title 25, attendees 30, summary 400, decisions 100, actions 100 → 655 + 190 = **~850 chars**. Unchanged by the wider caps: a higher cap does not make minutes longer.
- Frequency assumed: "several a day" = 3 meetings per working day × 250 days = **750 records a year** (2 a day = 500).

| Case | Per year | Share of 3.5 MB after 3 years | after 5 years |
|---|---|---|---|
| 3/day, typical (850, no progress) | 0.64 M chars | 1.91 M (52 %) | 3.19 M (87 %) |
| 2/day, typical (850, no progress) | 0.43 M chars | 1.28 M (35 %) | 2.13 M (58 %) |
| 3/day, typical minutes + 3 progress entries (1,260) | 0.95 M chars | 2.84 M (77 %) | exceeds (about 3 years 10 months) |
| 3/day, typical minutes + progress + follow-ups (1,810) | 1.36 M chars | 4.08 M (exceeds, about 2 years 8 months) | exceeds |
| 3/day, every field full incl. progress and follow-ups (25,825) | 19.37 M chars | exceeds (well under 1 year) | exceeds |

Typical minutes fit two and a half to five years at several a day; completely full records at three a day fit
well under a year. The caps alone cannot promise more, so two facts guard the rest: (1) the tab always states its storage
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

`MeetingsTab({ state, onAddProject, onEditProject, onAddMeeting, onOpenMeeting, onAddDocument, onOpenDocument })`
(the last two props added schema v27, [documents.md](documents.md)):
- Header section: `SectionLabel` (cyan) `미팅 — 프로젝트별 회의록`, button `프로젝트 추가` on the right (same style
  as `일정 추가`); caption `회의 시간은 일정 탭에, 회의에서 나온 내용은 여기에 적어요. 회의록은 목표·실행·점수에
  반영되지 않아요. 문서는 요약 글만 저장돼요 — 파일은 저장되지 않아요.` (the second sentence added v27); counts
  line (`font-mono text-xs text-zinc-400`) `프로젝트 {p}개 · 회의록 {n}건 · 문서 {d}건 · 저장 공간 {mb}MB / 3.5MB`
  (`mb` to one decimal; the `문서 {d}건` fragment inserted after `회의록 {n}건` at v27, so the pre-existing
  substring `프로젝트 2개 · 회의록 4건` still matches).
- No project: one section `프로젝트가 없어요 — 프로젝트를 먼저 만들어요.` — this card is about *project* minutes and
  stays true even then; the memo group below it (next bullet) is the entry point for a memo when no project exists,
  and in that case it is the only group and renders first, by the same code path.
- One section per project, ordered by its newest minutes date (`meetingOrder`, descending), projects without
  minutes last, ordered by `createdAt` descending. Section head (`groupHead`): the project name (`text-sm
  font-bold truncate`) and, on the right, `회의록 {n}건 · 문서 {d}건` (mono, one span joined by ` · `, `문서`
  added v27); buttons `프로젝트 수정`, `회의록 추가`, and (v27) `문서 추가` (`onAddDocument(p.id)`). Rows are the
  newest-first minutes (`meetingOrder`: `date` descending, then `createdAt` descending) rendered as `TodoRow`s
  ([tasks.md](tasks.md)) — lead chip `{date.slice(2)}` (`YY-MM-DD`, zinc tone), the title, marker
  `meetingRowMarker(m)`: `진행 {n}건` and `후속 {open}/{total}` joined by ` · `, each present only when its own
  total is above zero, none when both are zero — each row opening `onOpenMeeting(id)`.
  The first `MEETING_ROWS_SHOWN` (5) rows show; beyond that, `{n}건 더 보기` / `접기` toggles a component-state
  expansion (`useState`, per-project, never stored — [Rule 9](../design-docs/core-beliefs.md#rule-9)). An empty
  project reads `회의록이 없어요.` Rows and their expander are built by a shared helper, `rowsBlock(key, rows,
  emptyText, rowOf = meetingRow)`, reused by the memo group below and, since v27, by the documents block: its
  fourth argument is the row renderer (`meetingRow` by default, `docRow` for documents), so the same expansion
  logic serves both row kinds without a duplicate.
  A **documents block** (v27, `docsBlock`, [documents.md](documents.md)) sits below the minutes rows, only when
  the project has at least one document: a head line `문서 {d}건`, then the documents through `rowsBlock` with
  `docRow` — a `TodoRow` leading `문서` (violet), the title, a mono `YY-MM-DD` marker, opening
  `onOpenDocument(id)`.
- **The memo group** (2026-09-17): after every project section, **always** rendered — its `긴급 메모 추가` button
  is the only way to start a memo when no project exists (a project section's own `회의록 추가` preselects that
  project). Collects every meeting with `projectId == null`, sorted by `meetingOrder`, under a section with the
  same shell: title `프로젝트 없음 · 긴급 메모` (`text-sm font-bold truncate`), mono `회의록 {n}건 · 문서 {d}건`
  (v27), caption `프로젝트 없이 적은 회의록이에요 — 나중에 수정에서 프로젝트를 고르면 그 프로젝트로 옮겨져요.`
  (`text-xs text-zinc-600`), buttons `긴급 메모 추가` (same border style as `회의록 추가`, calls
  `onAddMeeting(null)`) and (v27) `문서 추가` (`onAddDocument(null)`), rows via `rowsBlock("none", memos, "긴급
  메모가 없어요.")` and (v27) the memo group's own documents block (`docsBlock("doc:none", memoDocs)`). When no
  project exists this is the only section and stands first, by the same code path. Editing a memo and picking a
  project moves it into that project's section, and back.

## Sheets
- **`ProjectModal({ project, meetingCount, documentCount, onClose, onAdd, onUpdate, onRemove })`** (`documentCount`
  added schema v27), `modal: { type: "project", projectId? }`, title `새 프로젝트` / `프로젝트 수정`: inputs
  `프로젝트 이름 — 예: ○○물산 재고 관리`, `메모 (선택)`; errors `프로젝트 이름을 입력해 주세요.`, `프로젝트
  이름은 40자까지예요 — 지금 {n}자예요.`, `메모는 200자까지예요 — 지금 {n}자예요.`; button `등록` / `저장`; in edit
  mode, `삭제` is disabled when `meetingCount > 0 || documentCount > 0` (no confirmation dialog needed when it is
  enabled — nothing is lost). The minutes line takes priority: `회의록 {n}건이 있어 삭제할 수 없어요 — 회의록을
  먼저 지워요.` shows whenever `meetingCount > 0`; only when `meetingCount === 0 && documentCount > 0` does the
  sheet instead state `문서 {n}건이 있어 삭제할 수 없어요 — 문서를 먼저 지워요.` (v27). The root handler
  (`removeProject`) refuses a project with minutes, then with documents, not only through the disabled button,
  toasting the matching message either way.
- **`MeetingModal({ state, meeting, projectId, today, onClose, onAdd, onUpdate, onRemove })`**, `modal: { type:
  "meeting", meetingId?, projectId? }`, title `새 회의록` / `회의록 수정`: `프로젝트` chips (preselected from
  `projectId` or the record's own), with a first chip `없음 (긴급 메모)` (2026-09-17, `on={pid === null}`); under
  the row, only while `pid === null`, the line `프로젝트 없이 저장돼요 — 미팅 탭의 '프로젝트 없음 · 긴급 메모'에
  실려요.` Submit's guard changed the same day from "pick a project" to "a chosen id must be live": `pid !== null
  && !projects.some((p) => p.id === pid)` refuses `프로젝트를 골라 주세요.` — a `null` id (the memo chip) never
  does. `날짜` date input (default `today`), inputs `회의 이름 — 예: 2차 요구사항
  회의`, `참석자 (선택) — 예: 김OO, 박OO`; between them and the summary, a **transcript block** (2026-09-17):
  collapsed behind a border button `녹취록 붙여넣기` while the field is empty (so a new form's first textarea is
  still `회의 요약`), which on tap opens `<MeetingText placeholder="녹취록 (선택) — 급히 녹음한 내용을 옮겨 적은
  글을 그대로 붙여넣어요" rows={6} cap={MEETING_LIMITS.transcript} />`; a saved transcript opens it at once on
  edit. Only the ends are trimmed on save — the interior (line breaks, spacing, punctuation) is byte-identical to
  the paste; an all-whitespace transcript is not written. Then textareas (with `{n} / {cap}` counters, rose over cap, no
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
  as a boolean and keeps the live `progress` array untouched — the form never edits entries.

  **Follow-up items** (schema v26), below the `후속 조치 (선택)` textarea, which stays for free text — the two
  never merge and `actions` is never rewritten by this block ([Rule 12](../design-docs/core-beliefs.md#rule-12)).
  State initialised from `meeting?.followUps || []` (shallow copies; `done` and `workId` pass through
  untouched — the form never edits either). Header `후속 항목` and a mono `{n} / 30` on the right. One card per
  row, two lines so it fits 390 px: line 1 a text input (`후속 항목 — 예: 견적서 송부`, no `maxLength`) and an `X`
  button (`aria-label="후속 항목 삭제"`); line 2 a `내 담당` `Chip` (off by default), a `type="date"` input
  (`aria-label="후속 기한"`), and, when done, a mono `완료` tag. `항목 추가` appends a row, disabled at the cap
  with `후속 항목은 30건까지예요.`; caption `내 담당을 켜면 업무 탭에 등록돼요 — 회의 날짜가 지났으면 오늘
  업무로요.` Turning a row's `내 담당` on registers a work item once the record is saved (below); the form itself
  never touches `done`.

  **`확인할 것 가져오기`** (schema v27, [schedule.md](schedule.md)): when the form's `eventId` names a linked
  event whose `checks` is non-empty, a border button `확인할 것 가져오기 ({n}건)` appears under `항목 추가` (`n`
  = that event's check count). Tapping appends, for each check whose trimmed text equals no existing follow-up
  row's trimmed text, `{ id: uid(), text: c.text, mine: false, done: false }` to the follow-up rows until
  `MEETING_FOLLOWUPS_MAX`, and states `확인할 것 {k}건을 가져왔어요 — 이미 있는 {d}건은 건너뛰었어요.` (`d` may be
  0) or, when nothing fits, `후속 항목은 30건까지예요.` This is component (form) state only: the event's `checks`
  are never written, and a second tap on an unsaved form appends nothing new (every text already exists),
  stating `이미 있는 {n}건은 건너뛰었어요.`

  Note, since 2026-09-17, `녹취록은 붙여넣은 그대로 저장돼요 — AI 패킷에는 실리지 않아요.` (replaces the
  2026-09-16 `전체 녹취가 아니라 요약만 저장해요.`, now false — a transcript is stored, verbatim, above). Submit
  refuses, in order, with `프로젝트를 골라 주세요.`,
  `날짜를 선택해 주세요.`, `회의 이름을 입력해 주세요.`, `회의 요약을 입력해 주세요.`, then the
  `{field}은/는 {cap}자까지예요 — 지금 {n}자예요.` cap messages in field order — title, attendees, summary,
  decisions, actions, then, last (2026-09-17), `녹취록은 30000자까지예요 — 지금 {n}자예요.` — then, for each follow-up row over
  `MEETING_LIMITS.followUp` (200), `후속 항목은 200자까지예요 — {k}번째 항목이 지금 {n}자예요.` (1-based `k`). On
  any refusal `submit` only calls `setErr` — no state reset — so the pasted transcript stays in the textarea.
  The record is built with only non-empty optional
  fields — a cleared field disappears from the save on an edit; `followUps` is always written as an array. `onAdd` / `onUpdate` answer with an error string
  (`""` = saved); a non-empty return — the storage-budget refusal — is shown as the modal error:
  `저장 공간이 부족해요 — 현재 {mb}MB 사용 중이라 회의록을 저장하지 않았어요. 백업을 내보낸 뒤 오래된 회의록이나
  사진을 지워요.` and the form stays open with everything typed. Edit mode adds `삭제` →
  `window.confirm("{title} 회의록을 삭제해요. 계속할까요?")`.
- **`MeetingViewModal({ state, meetingId, today, onClose, onEdit, onOpenTask, onAddProgress, onRemoveProgress,
  onToggleFollowUp, onSetFollowUpMine, onAppendFollowUps, onClearTranscript })`**,
  `modal: { type: "meetingView", meetingId }`,
  title the meeting's own title: `CvFact wrap` rows `프로젝트` (2026-09-17: `없음 (긴급 메모)` for a memo, else
  `project?.name || "없음"`), `날짜` (mono), `참석자` (or `기록 없음`), `일정`
  (`{time || "시간 미정"} {title}` read live from the linked event; `연결 없음` with none; `연결된 일정이
  삭제됐어요` when `eventId` matches no live event), `AI 전송` (`보내지 않음` when `aiHidden`, else
  `요약·진행사항 포함` — unchanged by the transcript, which the packet never carries anyway). Directly above
  `요약`, a **transcript block** (2026-09-17): `SectionLabel` `녹취록` with a mono border button on the same
  header row, `녹취록 {n}자 · 펼치기` (`n = m.transcript.length`, plain digits) toggling to `접기`; expanded, the
  full text as `<p className="whitespace-pre-wrap break-words">` (never truncated) and, under it, a rose border
  button `녹취록 지우기` that confirms `녹취록만 지워요. 요약·결정·후속·진행사항은 남아요. 계속할까요?` before
  calling `onClearTranscript(m.id)`; without a transcript the block reads `없음`, the same `block(label, text)`
  helper as `결정 사항`. Then three blocks with a `SectionLabel` each — `요약`,
  `결정 사항`, `후속 조치` — `<p className="whitespace-pre-wrap break-words">` (or `없음`).

  **후속 항목** block (schema v26), directly after `후속 조치`: `SectionLabel` plus a mono `{open}/{total}`.
  When `actions` has text, a chip button `항목으로 나누기` on the same header row opens an inline preview panel
  (component state inside this modal, not a new `modal.type` — the root has a single modal slot): tapping
  computes `splitFollowUpText(m.actions)` — splitting on newlines, ` / `, before every circled number and before
  ` 1) ` / ` 1. `, stripping one leading marker per piece, trimming, dropping empties and exact duplicates,
  clipping to the item cap — into candidates `[{ text, on, mine }]`; a candidate equal to an existing follow-up
  text starts unticked, tagged `이미 있어요`; a candidate past the remaining 30-item room starts unticked and
  disabled, with the line `후속 항목은 30건까지예요 — {room}건만 추가할 수 있어요.` under the list. Panel: title
  `후속 조치에서 항목 나누기 — {n}건`, rows of checkbox + text + `내 담당` chip, `나눌 항목이 없어요.` when empty,
  buttons `추가` (disabled when nothing is ticked; calls `onAppendFollowUps`; a non-empty return shows as a rose
  line in the panel; `""` closes it) and `취소`. The text in `actions` is never changed and the button stays
  available after appending. Below: empty state `후속 항목이 없어요.`; each row (checkbox `aria-label="후속
  완료"`, `checked={fu.done}`) shows the text (struck through when done) and a mono facts line joined by ` · `:
  `내 담당` (cyan) or `타인` (zinc); `기한 {due}` (rose-400 when overdue and undone) or `기한 없음`; the linked
  work item's state — `업무 미완료` / `업무 완료` when `workId` names a live item, `업무 삭제됨` when `mine` but
  no live item, nothing when not mine — and a `내 담당` chip on the right (`onSetFollowUpMine`). Ticking the
  checkbox calls `onToggleFollowUp`.

  A `진행사항` block
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

## Follow-up items — reconcile, root handlers and mirroring (schema v26)

`reconcileFollowUps(work, rec, prev, today)`, pure, no `setState`: given the meeting record `rec` about to be
written and `prev` (the stored record, or `null`), answers `{ work, meeting }` with no side effect. Per
follow-up, in order: (1) a `workId` naming no live item is dropped from the follow-up (a dangling reference is
never kept); (2) `fu.mine` with no live item, when `fu` is new or was not `mine` before, creates
`followUpWorkItem(fu, rec, today)` — `date` = the meeting's date when it is today or later, otherwise today;
`title` = the text clipped to `WORK_LIMITS.title`, with the full text copied to `note` when it overflows;
`source: "meeting"`; `link: { kind: "meeting", id: rec.id, followUpId: fu.id }` — and sets `fu.workId` to it (a
mine item whose work item the user deleted is **not** re-created by a later save, only a `mine` off→on flip or a
new row creates one); (3) `!fu.mine` with a live undone item removes that item and drops `workId` (a **done**
item stays linked, so its `done` keeps mirroring); (4) a live item whose `done` differs from the follow-up's
takes the follow-up's value — the meeting side wins, since this runs on meeting writes. A follow-up **removed**
from the record (present in `prev.followUps`, absent from `rec.followUps`) takes its still-**undone** linked
item with it; a done one stays, its `followUpId` then dangling ([TD-54](../exec-plans/tech-debt-tracker.md)).

`commitMeeting(rec, prev)` (root) runs the reconcile against the render's `state.work` — the same object
`prev.work` would be for a user-driven write, the pattern `addMeeting` already used to build its own record
([TD-56](../exec-plans/tech-debt-tracker.md)) — computes `created` (new work items) and `removed` (dropped
ones), and checks `recordFits([meeting, ...created], prevLen, "회의록을")` against the meeting **plus every
created work item** before writing either; a refusal writes nothing. `addMeeting` / `updateMeeting` both go
through it and append ` · 업무 {n}건 등록` to their toast when `created > 0`.

## Root handlers and toasts
Clone-pattern updates next to the business handlers, reading and writing `meetingProjects` and `meetings`, plus
the `work` items a mine follow-up mirrors (v26) — never `act`, `tasks`, `goals`, `areas`, `room`, `exams` or
`events` ([Rule 1](../design-docs/core-beliefs.md#rule-1), [Rule 18](../design-docs/core-beliefs.md#rule-18)):

| Handler | Effect | Toast |
|---|---|---|
| `addProject(p)` | prepends `{ id: uid(), ...p, createdAt: today }` | `프로젝트를 등록했어요` |
| `updateProject(id, next)` | replaces the record, keeping `id` and `createdAt` | `프로젝트를 수정했어요` |
| `removeProject(id)` | refuses (toast only, no state change) when the project still has minutes; otherwise drops it | `프로젝트를 삭제했어요` |
| `addMeeting(next)` | `commitMeeting({ id: uid(), ...next, createdAt: today }, null)`; a refusal writes nothing | `회의록을 등록했어요{ · 업무 {n}건 등록}` |
| `updateMeeting(id, next)` | `commitMeeting({ id: cur.id, ...next, createdAt: cur.createdAt }, cur)`, same refusal | `회의록을 수정했어요{ · 업무 {n}건 등록}` |
| `removeMeeting(id)` | confirms by name, then drops the record; no cascade to its work items (below) | `회의록을 삭제했어요` |
| `addProgress(meetingId, text)` (schema v25) | refuses at `MEETING_PROGRESS_MAX` or `recordFits`; otherwise prepends `{ id: uid(), date: today, text }` to `progress` via `putMeeting` | `진행사항을 추가했어요` |
| `removeProgress(meetingId, entryId)` (schema v25) | filters the entry out via `putMeeting` | `진행사항을 삭제했어요` |
| `clearTranscript(meetingId)` (2026-09-17) | no-ops with no transcript; otherwise writes the record without its `transcript` key via `putMeeting` — every other field untouched, no budget check (the record shrinks) | `녹취록을 지웠어요` |
| `toggleFollowUp(meetingId, fuId)` (v26) | flips that follow-up's `done`; if `workId` names a live item, sets its `done` to match, in the same update | `후속 항목을 완료로 표시했어요` / `후속 항목 완료를 취소했어요` |
| `setFollowUpMine(meetingId, fuId, mine)` (v26) | `commitMeeting` with that flag flipped; a refusal is toasted instead of thrown | `내 담당으로 표시했어요{ · 업무 등록}` / `내 담당을 해제했어요{ · 미완료 업무 삭제}` |
| `appendFollowUps(meetingId, items)` (v26) | refuses `후속 항목은 30건까지예요 — {room}건만 추가할 수 있어요.` past the cap; otherwise `commitMeeting` with the new rows appended | `후속 항목 {n}건을 추가했어요{ · 업무 {k}건 등록}` |

Two task handlers write `meetings` since v24, and only to remove a link: `removeTask(id)` drops the id from every
meeting's `taskIds` in the same clone update that removes the task, and `removeGoal(id)` does the same for the
open tasks it deletes with an active goal. Links therefore never dangle going forward; a dangling id from an older
or hand-edited save is still skipped and counted at render, never cleaned up by a read.

The mirror runs the other way too, in the daily-work handlers ([daily-work.md](daily-work.md)): `toggleWork`
sets a linked follow-up's `done` to match; `removeWork` / `removeWorkMany` clear `workId` off the follow-up they
unlink (leaving `mine` and `done` alone); `updateWork` keeps a `source: "meeting"` item's `link` regardless of
what the sheet sends, since the link is owned by the follow-up.

`recordFits(next, prevLen = 0, noun = "회의록을")` (renamed from `meetingFits` 2026-09-17, so the one guard also
covers progress entries and work items — [daily-work.md](daily-work.md)); since v26, `commitMeeting` calls it
with `next` as an **array** — the meeting record plus every work item the reconcile creates — measuring
`JSON.stringify` of the whole array against the budget in one call:
`storageUsedWith(state) + JSON.stringify(next).length - prevLen <= STORAGE_BUDGET` (`prevLen` is the stored
length of the record being replaced, so editing a meeting is judged against the space it frees, not
double-counted); `noun` is the object-marked word substituted into the refusal sentence, built by the caller
(`"회의록을"` / `"진행사항을"` / `"업무를"`) — the helper does no grammar of its own. `putMeeting(rec)` (still
used by `addProgress` / `removeProgress`, which never touch follow-ups) replaces one meeting record in place;
callers build and budget-check the record first.

## Backup, reset and migration (schema v23–v27)
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
if (s.v < 26) {
  s = { ...s, v: 26, meetings: (s.meetings || []).map((m) => ({ ...m, followUps: Array.isArray(m.followUps) ? m.followUps : [] })) };
}
if (s.v < 27) {
  s = { ...s, v: 27, documents: Array.isArray(s.documents) ? s.documents : [] };
}
if (s.v < 28) {
  const stamp = (list, t) => (s[list] || []).map((r) => ({ ...r, track: TRACKS.includes(r.track) ? r.track : t }));
  s = { ...s, v: 28,
    meetingProjects: stamp("meetingProjects", "work"), documents: stamp("documents", "work"), events: stamp("events", "work"),
    work: stamp("work", "work"), deals: stamp("deals", "biz"),
    meetings: (s.meetings || []).map((m) => (m.projectId == null && !TRACKS.includes(m.track) ? { ...m, track: "work" } : m)),
    milestones: Array.isArray(s.milestones) ? s.milestones : [],
    timeLog: Array.isArray(s.timeLog) ? s.timeLog : [],
    leads: Array.isArray(s.leads) ? s.leads : [],
    notices: Array.isArray(s.notices) ? s.notices : [],
    settings: { ...(s.settings || {}), bizHoursPerWeek: Number.isFinite(s.settings?.bizHoursPerWeek) ? s.settings.bizHoursPerWeek : 20 },
  };
}
```
`documents` (v27) is the only new array at that step; `events[].checks` is optional with no backfill, like
`projectId` at v26 ([documents.md](documents.md), [schedule.md](schedule.md)). At v28: every project, document,
event, work item and memo gains `track: "work"` unless it already carries a valid one; every deal gains
`track: "biz"`; a project meeting inherits and stores nothing. `milestones` / `timeLog` / `leads` / `notices`
are added as empty arrays and `settings.bizHoursPerWeek` defaults to 20; `deals[].payments`, `role.stages` and
`work[].minutes` stay optional with no backfill. See [state-lifecycle.md](../design-docs/state-lifecycle.md) for
the full ledger and [business.md](business.md) for what the new arrays hold. `freshState`: `v: 28`,
`meetingProjects: []`, `meetings: []`, `work: []`, `documents: []`, `milestones: []`, `timeLog: []`, `leads: []`,
`notices: []`, `settings: { bizHoursPerWeek: 20 }`. `exportBackup` writes the whole
`state`, so every array travels in the backup file with no code change of their own; `importBackup` runs the
file's `state` through `migrate`, so an older backup gains the new fields on import; `resetAll` deletes the
state key, which removes every project, every meeting and every work item along with the rest of the save. See
[state-lifecycle.md](../design-docs/state-lifecycle.md) and [install-and-backup.md](install-and-backup.md).

`demoState` carries two synthetic projects (`○○물산 재고 관리 자동화`, `△△테크 문서 검색 AI`) and three short
synthetic minutes dated 9, 3 and 1 days before today, with no personal names (`담당자 A`, `담당자 B`) and no
`eventId` link. `유지보수 범위 협의` links two demo tasks (`이력서 초안 작성`, `CATIA·도면 연습 1시간`), carries
one progress entry, and (schema v26) three follow-ups — one `mine` and mirrored to a demo work item, one owned
by someone else, one done — so its minutes row states `후속 2/3`; `요구사항 1차 회의` is flagged
`aiHidden: true`; every meeting carries an (empty or filled) `followUps` array. One demo event, `○○물산 주간
점검` tomorrow, carries `projectId` naming the maintenance project. Since 2026-09-17, `s.meetings` also carries
one urgent memo, `긴급 메모 — ◇◇스튜디오 전화` (`projectId: null`, dated yesterday, a 259-char transcript, one
progress entry, one `mine: false` follow-up so the demo work counts stay unchanged), prepended so the demo
counts line reads `프로젝트 2개 · 회의록 4건`. Since 2026-09-17 (schema v27), `s.documents` carries two records
(one on `△△테크 문서 검색 AI`, one project-less), so the counts line reads `프로젝트 2개 · 회의록 4건 · 문서
2건`; the demo tomorrow event, `○○물산 주간 점검`, carries two `checks` (one `manual`, one `ai` with a folded
basis) — see [documents.md](documents.md), [schedule.md](schedule.md) and
[demo-data.md](../design-docs/demo-data.md).

**Tracks and a day-job project (v28, 2026-09-17).** Every existing demo project, document, deal, memo and work
item is `track: "biz"`; the three schedule events stay `personal`; `○○물산 주간 점검` is `biz`. One synthetic
day-job project is added, `mpJob`, name `데이터 프로파일링 — 데모기관`, `track: "work"`, created 15 days back,
prepended so the order reads `[mpJob, mp2, mp1]` — a real institution is never named. It carries one meeting
(`주간 품질 점검`, 2 days back, attendee `담당자 C`) and one follow-up (`결측 컬럼 목록 정리`, due tomorrow,
mirrored to a `track: "work"` work item), plus one manual `track: "work"` work item today (`프로필 리포트
초안`) and one `track: "work"` event today (`품질 회의`, `appt`, `15:00`, linked to `mpJob`). The demo counts
move to `프로젝트 3개 · 회의록 5건 · 문서 2건`, and the `미팅` section head for `mpJob` carries the `직장` tag —
see [demo-data.md](../design-docs/demo-data.md) for the day-job additions' effect on every other tab's demo
figures.

## Meeting-prep rows (`meetingPrepOf`, schema v26)

`meetingPrepOf(state, today)` (pure, derived at render — [Rule 9](../design-docs/core-beliefs.md#rule-9)) feeds
the `업무` tab's `MeetingPrepCard` and the briefing's `회의 준비` section — see
[daily-work.md](daily-work.md) (`MeetingPrepCard`) for the card
and [assistant-bridge.md](../design-docs/assistant-bridge.md) for the briefing lines. For every open schedule
occurrence today and tomorrow (`PREP_DAYS` = 2) that belongs to a live meeting project — matched by the event's
own `projectId`, or, when absent, by the newest meeting whose **trimmed title equals the event's trimmed
title** ([TD-55](../exec-plans/tech-debt-tracker.md): exact, case-sensitive; a retitled event or meeting stops
matching), via `eventProjectOf(state, ev)` (schema v27, the same match — extracted as its own function so
`buildPrepPacket` below can call it too) — it returns the project, the newest meeting for that project (`last`,
by `meetingOrder`, or `null`), that meeting's open follow-ups (mine first), its newest `PREP_PROGRESS` (3)
progress entries, its live linked tasks, and (schema v27) the project's documents, `docs: documents.filter((d) =>
d.projectId === project.id).sort(docOrder)` ([documents.md](documents.md)). Nothing here writes state or reaches
`computeGrades` / `krProgress` / `todoOf`. A project-less memo never
yields a prep row by design — `liveProject(null)` is `null` and `m.projectId === project.id` never matches
`null` — but the title-match fallback names the **newest** same-title meeting whatever its project, so an event
whose newest same-title meeting is a memo gets no prep row even when an older same-title meeting names a live
project ([TD-60](../exec-plans/tech-debt-tracker.md), accepted).

## What a meeting never does
- No `goalId`, no difficulty, no points, no trophy, no achievement record, no streak effect, no evidence gate.
- Linking a task never changes it: no status, due date, goal, KR count or completion moves, and the task sheet's
  `관련 회의록` list is derived at render. A meeting never creates a task — nor does a follow-up item: the work
  item a `mine` follow-up registers is a record outside the goal ladder, with no `goalId`, difficulty or points
  ([Rule 18](../design-docs/core-beliefs.md#rule-18)).
- It never runs through `tryComplete`, `completeTask` or `needsEvidence` — there is no completion path for a
  meeting at all.
- It is excluded from `agendaOf`, `todoOf`, `krProgress` and `goalProgress`; `할 일` never lists a meeting.
- `buildAssistantPacket` (the daily check-in packet) still never reads `meetingProjects` or `meetings` — a
  meeting title never appears in that packet ([Rule 7](../design-docs/core-beliefs.md#rule-7)). `buildBriefing`
  (schema v26) now reads `meetings` for the `회의 준비` section — the prep count today/tomorrow and overdue
  follow-ups (`후속 기한 지남 {n}건 · 내 담당 {m}건`) — but only as **numbers**, never a meeting title or a
  follow-up's text ([Rule 13](../design-docs/core-beliefs.md#rule-13)). The **work packet** (`buildWorkPacket`,
  `오늘 업무 만들기`) does read every meeting's content by the user's own 2026-09-17 decision — reversing the
  prior default — unless a meeting is flagged `aiHidden`, in which case only its date and title appear; see
  [daily-work.md](daily-work.md) and [assistant-bridge.md](../design-docs/assistant-bridge.md).
- `calendarExportOf` never reads it — a meeting is not exported to the phone calendar; its time, if any, is
  whatever the linked `일정` event already exports.
- Deleting the linked `일정` event never deletes or edits the minutes; the view states the link is gone rather
  than hiding or fabricating a time ([Rule 13](../design-docs/core-beliefs.md#rule-13)).
- Deleting a meeting (`removeMeeting`) does not cascade to the `source: "meeting"` work items its follow-ups
  registered — they stay, and the work sheet's `연결` line states `연결 대상이 삭제됐어요` (the TD-49 policy,
  [daily-work.md](daily-work.md)). A cascade may be added later at the user's request.
- A project with documents cannot be deleted any more than one with minutes can (schema v27,
  [documents.md](documents.md)); a document itself is never a task, is never read by `buildAssistantPacket` or
  `calendarExportOf`, and its `source` field is never carried into the prep packet.
- (v28) A `work`-track project's or memo's meeting never reaches the work packet, the daily packet or a prep
  packet, whatever `aiHidden` says — the track filter runs first; see [Tracks (v28)](#tracks-v28).
- A transcript (2026-09-17) is never read anywhere but `MeetingModal`, `MeetingViewModal`, `clearTranscript`,
  `recordFits` (through `JSON.stringify` of the whole record) and `demoState`: `buildWorkPacket`,
  `buildAssistantPacket`, `calendarExportOf`, `buildIcs` and `meetingPrepOf` never read it — the app never
  summarises, splits or judges a transcript ([Rule 7](../design-docs/core-beliefs.md#rule-7)); see
  [SECURITY.md](../SECURITY.md).

## E2E coverage (2026-09-17)

`tools/e2e/flow10.js` (written, **not run** — standing user instruction) adds five steps after the follow-up
steps: a memo saved with no project has `projectId: null` and lists under `프로젝트 없음 · 긴급 메모` after every
project section; the view states the transcript's length collapsed, expands to the text and `녹취록 지우기`, and
collapses again, with the packet-facing fact rows (`AI 전송`) unchanged; the transcript refuses 30,001 chars with
the count and keeps the paste in the form, then accepts 30,000; `녹취록 지우기` removes the `transcript` key only
— every other field byte-identical — and the block reads `없음`; moving a memo into a project relists it there,
and back to `없음 (긴급 메모)` returns it to the group. `tools/e2e/flow11.js` adds two steps: the work packet
states a project-less memo as `[프로젝트 없음] {title}` and carries none of its transcript (a sentinel string);
`회의록 열기` on a meeting-linked work item opens that meeting's view in place of the sheet, and a goal-linked
item has no such button. `tools/e2e/flow10.js` adds four **documents** steps (schema v27, [documents.md](documents.md))
after that: registering a document under a project and in the memo group, the sheet's caps and edit, moving a
document between the memo group and a project, and the project-deletion guard by document count. `flow11.js`
adds five **pre-meeting check** steps (schedule.md) covering the prep card's checklist, the event sheet, the
prep packet, a pasted prep reply, and `확인할 것 가져오기`. **Tracks (v28, written 2026-09-17, not run):**
`flow10.js` adds a step registering a project with the `사업` chip (`track: "biz"`, the section head's tag), a
meeting on it storing no `track` key, and a memo whose track chips render only while `없음 (긴급 메모)` is
chosen — picking `개인` and registering stores `track: "personal"`, and moving the memo into the project drops
the key. See [tools/e2e/README.md](../../tools/e2e/README.md).
