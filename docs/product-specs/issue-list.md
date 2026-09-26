# Issue list — `이슈 목록`

Added 2026-09-22 (schema stays v28, no migration — [decision log](../design-docs/decision-log.md)). One
persistent overview that lists in one place what needs attention: open work, tasks and follow-ups by track, the
next two weeks of schedule, the newest training records, and each project's latest minutes with its open
follow-ups — derived at render, storing nothing ([Rule 9](../design-docs/core-beliefs.md#rule-9)). It is the
screen the [`확인 필요 notification`](notifications.md) opens, and the target of a `이슈 목록 ›` button from two
other screens (below).

## What it is, and is not

A read-only overview, not a queue: every row opens an existing sheet in the app's single modal slot
([Rule 1](../design-docs/core-beliefs.md#rule-1), [Rule 10](../design-docs/core-beliefs.md#rule-10),
[Rule 18](../design-docs/core-beliefs.md#rule-18)) — nothing here completes, ticks, edits or promotes. No `%`
anywhere; every line is a count, a date or a title ([Rule 13](../design-docs/core-beliefs.md#rule-13)). It is not
a packet: `aiHidden` changes nothing on this screen — the list is on-device only, so a meeting flagged
`AI에 보내지 않기` still shows here in full.

## `issueListOf(state, today)`

Pure, module level, Daily assistant region after `checkNotificationOf`. Dependencies: `shiftDay`, `daysBetween`,
`occurrencesOf`, `eventsOn`, `upcomingEvents`, `workOn`, `byCreated`, `byTrack`, `trackOf`, `meetingTrack`,
`meetingOrder`, `oneLineText`, `isTraining`, `followUpsOf`, `lastMeetingOf`, `agendaOf` (for the goal-task rows — the plan's
`todoOf` extraction was not needed: the implementer read the same overdue/due-today/daily buckets straight off
`agendaOf`, so smoke need not lift the business helpers `todoOf` would drag in). Constants (plain literals, so
smoke can lift them):

| Constant | Value | What it caps |
|---|---|---|
| `ISSUE_WORK_ROWS` | 30 | rows per track group of `할 일` before `{n}건 더` |
| `ISSUE_EVENT_DAYS` | 14 | the schedule window, today included |
| `ISSUE_EVENT_ROWS` | 30 | schedule rows before `{n}건 더` |
| `ISSUE_TRAINING_ROWS` | 3 | newest training records before `{n}건 더 ›` |
| `ISSUE_PREV_MEETINGS` | 3 | a project's earlier minutes behind `이전 {n}건 ›` |
| `ISSUE_FOLLOWUPS` | 5 | open follow-up lines under a project's latest minutes |
| `ISSUE_DECISION_CLIP` | 200 | chars of the latest minutes' decisions |
| `ISSUE_SUMMARY_CLIP` | 120 | chars of the latest minutes' summary |
| `ISSUE_LEARNED_CLIP` | 120 | chars of the first line of a training record's `배운 것` |
| `ISSUE_PROJECT_TRACKS` | `["biz", "work", "personal"]` | the project groups' order — business first |

Returns `{ sections: [{ key, title, count, empty, groups?, rows?, more? }] }`, four sections, fixed order, each
`empty: true` when it has no rows or groups (the UI then prints `없음`); the section header states `{title}
({count})` where `count` is the row total (groups summed).

### 1. `todo` — `할 일`

Grouped by `TRACKS` order (`직장` → `사업` → `개인`, `TRACK_LABEL`); a group is omitted entirely when empty —
the section reads `없음` only when every group is empty. Rows per group, in this order:
1. **Carried work items** — `workOn(state, today, today).filter((w) => w.date < today)`, oldest first:
   `{ kind: "work", id, date, lead: "이월 {n}일", text: title }`.
2. **Today's own undone work items**, `byCreated`: `{ kind: "work", lead: "오늘", … }`.
3. **Goal tasks open today** — `agendaOf(state, today)`'s overdue, due-today and daily buckets (the `할 일`
   tab's own first two groups), each `{ kind: "task", id, track: "personal", lead: "{group label}", text:
   title }`. A goal task carries no track of its own, so every one lists under `개인` — a goal is the user's own
   ladder, not a work track.
4. **Open `mine` follow-ups** of every meeting (project or memo) not already mirrored to a row above (`f.workId`
   absent, or its work item is not one of rows 1–2): `{ kind: "followUp", meetingId, track: meetingTrack(state,
   m), lead: "기한 {due}" | "후속", text: "{meeting title} · {follow-up text}" }`. Read through `followUpsOf(m)`
   (2026-09-22: `[]` for a [training record](meetings.md#training-records-교육-2026-09-22--reference-only-same-day)
   — reference only, so its stored follow-ups, if any, never reach this list).

Each group capped at `ISSUE_WORK_ROWS` (30), then `{n}건 더`.

### 2. `events` — `일정 (14일)`

`upcomingEvents(state, today, ISSUE_EVENT_DAYS)`, a done occurrence included (struck through in the UI — a
fact): `{ kind: "event", eventId, date, done, lead: "{M}/{D} {time | 시간 미정}", text: "{EVENT_KIND_LABEL} ·
{title}", marker: "확인할 것 {open}/{total}" when the event carries checks, else empty }`. Cap
`ISSUE_EVENT_ROWS` (30), then `{n}건 더`.

### 3. `training` — `교육`

The newest `ISSUE_TRAINING_ROWS` (3) [training records](meetings.md#training-records-교육-2026-09-22--reference-only-same-day) across every project
and the memo group, by `meetingOrder`: `{ kind: "meeting", meetingId, lead: date.slice(2), text: "{title} ·
{project name | 프로젝트 없음}", sub: oneLineText(first line of summary, ISSUE_LEARNED_CLIP) }`. The remainder,
past the cap, renders as `{n}건 더 ›` and opens the `미팅` tab (`onTab("meetings")`) rather than expanding
in place — training records live in full on that tab already.

### 4. `projects` — `프로젝트별 최신 회의록`

One group per project track (`ISSUE_PROJECT_TRACKS = ["biz", "work", "personal"]` — business first, then the
day job, then private life; this order is deliberately not `byTrack`'s `work → biz → personal`, since the plan
wants business leading here), each project ordered the way the `미팅` tab orders sections (newest minutes first,
projects without minutes last), then a trailing memo group (`프로젝트 없음 · 긴급 메모`, the newest memo only). A
project with no meeting-kind record and no training record at all is omitted; a project with only training
records still gets a group (its `latest` is the newest training record, per `lastMeetingOf`).

Per project: `latest` = [`lastMeetingOf(meetings, projectId)`](meetings.md#training-records-교육-2026-09-22--reference-only-same-day) (the newest
meeting-kind record; a training record stands in only when the project has none) —
```
{ meetingId, date, title, kind: "meeting" | "training",
  marker: "후속 {open}/{total}" (when the meeting has follow-ups),
  summary: oneLineText(summary, ISSUE_SUMMARY_CLIP),
  decisions: oneLineText(decisions, ISSUE_DECISION_CLIP) | null,
  followUps: open ones, mine first, capped ISSUE_FOLLOWUPS (5), followUpMore }
```
— then `previous`, the project's next `ISSUE_PREV_MEETINGS` (3) meetings by `meetingOrder` (any kind, a training
row prefixed `교육 · `): `{ meetingId, date, title, followUpsText }` with `followUpsText` = `후속 {open}/{total}`
when the meeting has follow-up items, else empty. The memo group's `previous` is always empty — only its newest
memo shows.

## `IssueListModal({ state, today, onClose, onOpen, onTab, gateRead = false, onRead })`

`Modal` title `이슈 목록`, next to `DailyReaderModal` in the Modals region. Per section: `SectionLabel` `{title}
({count})`; inside `todo` and `projects`, a track head (`TrackTag`, the same component the meetings tab and the
work tab use) before each non-empty group, with its own row count; rows are `TodoRow`-shaped buttons (a lead
chip, a truncated one-line title, a right-aligned marker), a `sub` line (when present) in `text-xs
text-zinc-400`. The `projects` group renders `latest` as a row, then `text-xs` lines `{요약 label}: {summary}`
and `{결정/핵심정리 label}: {decisions}` when present (the label follows the record's own kind —
`meetingLabels(latest.kind).packetSummary`/`packetDecisions`), then up to 5 open follow-up lines (`- {내
담당|타인} · {text}`, `{n}건 더` past the cap), then, only when `previous` is non-empty, a full-width toggle
button reading `이전 {n}건 ›` (the real count, never a fixed number) / `접기` (component state, per project,
never stored — [Rule 9](../design-docs/core-beliefs.md#rule-9)) that expands `previous` as compact rows. Footer,
outside the gate: `닫기`.

**Inside the [daily gate](daily-gate.md) (`gateRead={true}`, 2026-09-24):** every row's tap is a no-op (`onOpen`
replaced by `() => {}`) and the training section's `{n}건 더 ›` button becomes the plain text `{n}건 더` — the
list is content to read here, not a route; `이전 {n}건 ›`/`접기` keeps toggling, since expanding a project's
earlier minutes is still reading. The `닫기` footer is replaced by `useReadEnd`'s sentinel-gated footer, one
button `다 읽었어요` (`disabled` until the end of the content is scrolled into view) → `onRead`, which stamps
`act.gate[today].readIssuesAt` only (no `act.briefingSeen` change — that stamp belongs to the reader). The header
X and the backdrop return to the gate without a stamp. `gateRead` defaults to `false`, so this modal's output
outside the gate is unchanged.

**Rows inside the gate (2026-09-26):** the gate-read `openRow` is no longer a blanket no-op —
`(spec) => { if (spec && GATE_READONLY_TYPES.includes(spec.type)) onOpen({ ...spec, readOnly: true }); }`. A
minutes row (`meeting` — a training record or a project card's latest/earlier minutes), a `followUp` row and an
`event` row open their sheet **read-only** (`MeetingViewModal` / `EventDetailModal` with `readOnly: true`, no
control that writes), which replaces this list in the single modal slot; closing that sheet (X or backdrop)
returns to this list, again in gate-read mode — an existing `readIssuesAt` is kept, but an unstamped list's end
sentinel starts unseen. `work` and `task` rows stay inert (a task sheet reaches the completion path —
[Rule 10](../design-docs/core-beliefs.md#rule-10), [Rule 18](../design-docs/core-beliefs.md#rule-18)), and
`{n}건 더` stays plain text. The list has no document row, so the read-only `DocumentModal` is not reachable from
here ([TD-122](../exec-plans/tech-debt-tracker.md)). The root filter admits the three read-only sheets only with
`readOnly === true` (`gateAdmits`) — see
[daily-gate.md](daily-gate.md#read-only-viewing-from-the-issue-list-2026-09-26).

**Row taps** (`issueSpecOf`, every one replacing this modal in the single slot — nothing here completes a tap):

| Row kind | Opens |
|---|---|
| `work` | `{ type: "work", workId, date }` |
| `task` | `{ type: "taskDetail", taskId }` |
| `followUp` | `{ type: "meetingView", meetingId }` |
| `event` | `{ type: "eventDetail", eventId, date }` |
| `meeting` (training or a project's latest/previous minutes) | `{ type: "meetingView", meetingId }` |

Inside the gate the `followUp`, `event` and `meeting` specs gain `readOnly: true`; `work` and `task` open nothing.

The `교육` section's `{n}건 더 ›` and nothing else calls `onTab("meetings")` (closes the modal, switches tabs).

## Entry points

- **The profile card**, `HomeTab`'s CV identity row: a button `이슈 목록 ›` beside `오늘 읽을 것 ›`, same classes
  (`onIssues` prop, root wires `setModal({ type: "issues" })`) — [home.md](home.md#identity-row).
- **The daily reader's footer**, `DailyReaderModal`: a border button `이슈 목록 ›` directly above `브리핑 ›`
  (`onAction({ type: "issues" })` — `closeBriefing` already falls through to `setModal({ type })` for a
  non-tab action, so no new routing code was needed) — [daily-reader.md](daily-reader.md#when-it-opens).
- **The `확인 필요` notification** — a tap routes here through the service worker's `notificationclick` handler
  and the `?open=issues` boot param — [notifications.md](notifications.md#boot-param-and-the-in-app-message).
- **The [daily gate](daily-gate.md)'s `이슈 목록 열기 ›` button** (2026-09-24) — opens this modal in gate-read
  mode above the gate; the same `?open=issues` boot param and the worker message also land here, in gate-read
  mode, whenever the gate is active, since `"issues"` is one of `GATE_MODAL_TYPES`.

`TAB_ACTIONS` (the tab-switch whitelist) is unchanged — the issue list is a `modal.type`, not a tab.

## What the issue list never does

- Writes no state — every row read is derived at render, and every write happens only after a tap opens a real
  sheet ([Rule 9](../design-docs/core-beliefs.md#rule-9)).
- Completes, ticks, edits or promotes nothing itself — a work item, a task, a follow-up, an event or a meeting is
  only ever opened, never acted on, from this screen; inside the gate the sheets it opens are read-only
  ([Rule 1](../design-docs/core-beliefs.md#rule-1), [Rule 10](../design-docs/core-beliefs.md#rule-10),
  [Rule 18](../design-docs/core-beliefs.md#rule-18)).
- Never builds or sends a packet — `aiHidden` and the day-job AI switch (`workInAiOf`/`packetTracks`) are about
  what leaves the device; this screen never leaves the device, so neither applies here.
- Shows no percentage — every fact is a count, a date or a title
  ([Rule 13](../design-docs/core-beliefs.md#rule-13)).

## E2E coverage (written, not run — standing user instruction)

`tools/e2e/flow11.js` adds steps covering: opening the issue list from the profile card and from the reader
(which stamps `act.briefingSeen` on close); the four sections in order with no `%`; a carried work item leading
its track group as `이월 {n}일`; a training record listed under `교육` and correctly excluded as a project's
`latest` while a meeting-kind record of the same project exists; a project's `latest` row stating its `요약:`
line, `이전 {n}건 ›` expanding to the real count of compact rows and toggling to `접기`; and every row kind
(work, task, follow-up, event, meeting) opening its sheet with no state changed.

**The daily gate (2026-09-24, written, not run):** `tools/e2e/flow12.js` covers this screen in gate-read mode —
a work row tap opening no sheet (a carried work row since 2026-09-26), no `건 더 ›` button, `이전 {n}건 ›` still
toggling, `다 읽었어요` stamping `readIssuesAt` and returning to the gate; steps 15–17 (2026-09-26) tap a minutes
row, an event row and a follow-up row inside the gate — each opens a read-only sheet, writes nothing, and its X
returns to this list — and a work row again opens nothing; see
[daily-gate.md](daily-gate.md#reading-to-the-end--usereadendenabled-and-gate-read-mode). See
[tools/e2e/README.md](../../tools/e2e/README.md) for the exact step count.
