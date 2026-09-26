# Schedule tab — `일정`

The fourth tab records what happens on a date: an interview, an exam, an application deadline. An event is a
**record, never a 실행 (task)** — it pays no points, creates no achievement, moves no metric, touches no streak
and passes no evidence gate. Together with the 사업 tab ([business.md](business.md)), it is one of the only two
screens whose rows have no goal behind them.

Data shape: [`events[]` in the generated schema](../generated/db-schema.md). Occurrence, briefing and packet
rules: [../design-docs/assistant-bridge.md](../design-docs/assistant-bridge.md).

Since 2026-09-17 (schema v27), a project-linked event may also carry a **pre-meeting checklist** —
`확인할 것` — covered in full below and in [meetings.md](meetings.md) (the prep card that shares this
checklist) and [../design-docs/assistant-bridge.md](../design-docs/assistant-bridge.md) (the third bridge
packet that can propose check items).

## Screen
`ScheduleTab` props: `state, today, onAdd, onEdit, onToggleDone, onSkip, onExport`. Tab key `schedule`, label
`일정`, icon `CalendarDays`, fifth entry of `NAV` (`grid-cols-7` since the `업무` tab landed, [daily-work.md](daily-work.md)),
after `업무` and before `미팅` and `사업`.

Calendar-only since 2026-09-16 (D-P2b, [decision log](../design-docs/decision-log.md)): the `목록` view, its
`목록`/`달력` chips and the header's own `일정 추가` button are all gone, so `ScheduleTab` renders only the header
section and `ScheduleCalendar`, always. The calendar panel's own `일정 추가` is the one add button on the tab, as
it already was in `달력` view before this change.

- Header section: first row `SectionLabel` `다가오는 일정` on the left, the button `캘린더로 내보내기` →
  `onExport()` → `CalendarExportModal` (below) on the right; second row the counts line.
- Counts line, full width under the header: `오늘 {n}건 · 이번 주 {n}건 · 지난 마감 {n}건`.
  - `오늘` — occurrences dated today.
  - `이번 주` — every occurrence from today to Sunday (`mondayOf(today) + 6`). It answers how much is left this
    week, so it includes today and tomorrow.
  - `지난 마감` — `마감` occurrences in the last 30 days (`EVENT_PAST_DAYS`).
- `<ScheduleCalendar … />` always follows, today selected on entry.

The month shown and the selected day are **component state** in `ScheduleCalendar`, never stored
([Rule 9](../design-docs/core-beliefs.md#rule-9)) — entering the tab always opens on the current month with
today selected, whichever month was open last time.

`state.ui.scheduleView` is retired: nothing has read it since this change, and the v22 migration block drops it
from the save on load ([state-lifecycle.md](../design-docs/state-lifecycle.md)). A save that still carries
`"list"` (every save that never chose the calendar before 2026-09-16) simply opens on the calendar the next time
it loads and loses the key on the way.

Missed deadlines the old `목록` view showed under `지난 마감` stay visible two other ways: the counts line's
`지난 마감` figure above, and `기한 지남` rows in `할 일` ([tasks.md](tasks.md)) — `todoOf` already lists deadlines
of the past 30 days.

## Row anatomy
`EventRow({ ev, date, done, today, onToggleDone, onSkip, onEdit, readOnly = false })` is a module-level component rendered by the
calendar's selected-day panel **and** by `할 일`'s `EventDetailModal` ([tasks.md](tasks.md)), so the two surfaces
cannot drift apart. The now-unused `tail` prop (a trailing fragment the old `할 일` row used to print
`목표 기여 없음` on the same line) was removed in the same change that moved that marker onto the compact row shell
instead.
```
[ D-3 ]  전기기사 실기 원서 접수 마감                    [마감]
         2026-09-20 · 접수 후 수험표 확인 · 반복 매주
         [완료 표시] [이번 회차 취소] [수정]
```
- **Lead badge** (mono, bordered): `마감` → `ddayStr(date)` — `D-3` / `D-DAY` / `D+2`, rose when the date has
  passed, amber on today, zinc otherwise. `약속` → `time`, or `시간 미정` when no time was given.
- **Title**, struck through at 50 % opacity once the occurrence is ticked.
- **Sub-line**: the occurrence date in mono, then ` · {장소}`, ` · {메모}`, ` · 반복 {매일|매주|매월}` when present, then (v28) ` · {track label}` last.
- **Kind chip**: `약속` (zinc) or `마감` (amber).
- **Buttons**: `완료 표시` ↔ `완료 취소` (`onToggleDone(id, date)`); `이번 회차 취소` (`onSkip(id, date)`) only on a
  repeating occurrence — skipping the single date of a one-off would leave a record that can never be rendered,
  edited or deleted again, so a one-off is removed with `삭제` in the modal; `수정` opens the modal in edit mode.
- Ordering inside a date: `마감` first, then `약속` by time with untimed last, ties by title (`eventsOn`).
- `readOnly` (2026-09-26, only from `EventDetailModal`'s read-only variant, below) omits the whole button row; the
  calendar panel and every other use render it as before.

## The month grid and selected-day panel — `ScheduleCalendar`
`ScheduleCalendar` props: `state, today, onAdd, onEdit, onToggleDone, onSkip`. Two sections under the header:
the month grid, then the selected-day panel. This is the whole tab body since 2026-09-16 — there is no longer a
second view to switch to.

### Month header
`{YYYY}년 {M}월` in mono on the left; `‹`, `›` and `오늘` on the right.

### Month grid
- `monthStart = "{YYYY}-{MM}-01"`; the weekday of the 1st is `new Date(monthStart + "T12:00:00").getDay()`
  (noon-anchored like `shiftDay`, never `toISOString`), 0 = Sunday, which is why the header starts at `일`.
- Weekday header `일 월 화 수 목 금 토` — one cell per label, not one string.
- `Math.ceil((firstDow + daysInMonth) / 7) * 7` cells in `grid grid-cols-7 gap-1`, so the last row is never
  empty and a 31-day month starting on Saturday gets six rows. Leading and trailing cells are blank,
  non-interactive placeholders — no day number, no marker, no tap target; a neighbouring month is reached with
  `‹` / `›`.
- A day is an `h-14 rounded-lg` button: day number in `text-xs font-mono` plus exactly one tone
  ([Holidays](#holidays) gives the precedence); the selected cell adds `bg-zinc-800 border border-cyan-500` (every other `bg-zinc-950 border
  border-transparent`). Today and the selection are separate marks, so they can sit on the same cell.
- Markers, under the day number: one `w-1.5 h-1.5 rounded-full` dot per occurrence, **at most three** — `마감`
  rose, `약속` cyan, a ticked occurrence at `opacity-50` exactly like its row. Beyond three, `+{n}`
  (`text-xs font-mono text-zinc-500`) states the remainder, so a busy day reads `● ● ● +2`. Titles never appear
  in a cell: at 390 px a cell is about 43 px wide.

### Holidays
`HOLIDAYS` is a frozen flat map `{ "YYYY-MM-DD": "설날" }` covering **2026 and 2027** (46 dates), declared beside
`CAL_RANGE_MONTHS` and read with a direct `HOLIDAYS[date]` lookup — no helper function, nothing derived into
state, nothing stored. `HOLIDAY_YEARS` derives the coverage from the keys, so appending a year moves the note
below by itself.

**Source of record.** The rows are copied from the Gwanbo gazette notices issued under the Presidential Decree on
the holidays of government offices, cross-checked against the KASI almanac published the preceding year. None of
it is computable: `설날` and `추석` follow the lunar calendar, `대체공휴일` are granted per year, and an election
day is set by its own law. The Decree amended on 2026-04-30 added `노동절` (5/1) and restored `제헌절` (7/17), both
substitute-eligible. **Append the next year only from a cited announcement** — never interpolate a lunar date,
never infer a substitute day, and never add a temporary holiday that has not been designated. A day painted red is
a day the user will not schedule.

This is [Rule 6](../design-docs/core-beliefs.md#rule-6) in spirit, not in letter: the rule names the numeric
`CERTS` / `EXAMS` tables and does not cover this one, so `HOLIDAYS` is deliberately **not** registered in
`DATA_TABLES` — the generated symbol index would otherwise label it "frozen by rules 6/15", which would be false.

**Tone precedence** on the day number, exactly one tone, first match wins:

| Order | Condition | Class |
|---|---|---|
| 1 | today | `text-amber-300 font-bold` |
| 2 | in `HOLIDAYS`, or Sunday | `text-rose-400` |
| 3 | Saturday | `text-sky-400` |
| 4 | anything else | `text-zinc-300` |

`dow` is the cell's own column, `(firstDow + day - 1) % 7`, so the weekend tones are read off the grid rather than
recomputed from the date. **Today outranks the holiday tone**: today is a state mark that has to stay one
unambiguous colour, and the fact is not lost, because selecting today still names the holiday in the panel.

The holiday tint cannot be confused with the `마감` marker: the number is **text** (`text-rose-400`) on the cell's
first line, the marker is a filled dot (`w-1.5 h-1.5 rounded-full bg-rose-400`) on the line below. Different
element, different line, text colour against fill.

**Outside the covered years** nothing is marked at all, and a single caption renders under the grid, inside the
same section: `공휴일은 {from}~{to}년만 표시해요.` (`text-xs text-zinc-500`, one text node, no nested spans). It is
under the grid because it explains the grid, and it renders only when the shown month's year is outside
`HOLIDAY_YEARS`, so a covered month gains no clutter. Weekend colouring still applies out there — it comes from
the date, not from the table.

**A holiday is never an event.** `HOLIDAYS` is read only by `ScheduleCalendar`. No `events[]` record, no
`occurrencesOf` / `eventsOn` / `upcomingEvents` involvement, no counts-line change, no briefing line, no packet
line, no task, goal, point, metric, trophy or streak effect, and no schema field
([Rule 9](../design-docs/core-beliefs.md#rule-9), [Rule 12](../design-docs/core-beliefs.md#rule-12)). `demoState`
is unchanged — the layer is static, so the demo shows it without demo data.

### Selected-day panel
`선택한 날짜` (`SectionLabel`), the mono line `{YYYY-MM-DD} · {n}건`, then — when `HOLIDAYS[sel]` exists — one
`text-xs text-rose-400` line `공휴일 · {name}` directly under it (never appended to the mono line, which the E2E
asserts verbatim, and the `공휴일 · ` prefix keeps a bare name from reading like an event title), then the day's
occurrences as `EventRow`s, `완료 표시` / `이번 회차 취소` / `수정` included — the same component `할 일`'s
`EventDetailModal` renders for a single occurrence ([tasks.md](tasks.md)). A day with none reads `이 날짜에는
일정이 없어요.` The panel's `일정 추가` calls `onAdd(selected)`, so `EventModal` opens in add mode with its date
input already on that day (`useState(event?.date || initialDate || "")`) and registering stores the event on it.

### Selection and range
| Action | Selection afterwards |
|---|---|
| entering the tab | today, in the current month |
| tapping a day | that day; the panel follows immediately |
| `‹` / `›` | the **1st** of the month moved to — keeping the old day would leave the panel on a date the shown month no longer answers for |
| `오늘` | today, back in the current month |

Paging is bounded by `CAL_RANGE_MONTHS = 24` months either side of today; at the edge the button is disabled
(`opacity-30`), so `‹` cannot walk into years of empty grids. Past months are browsable and show **both** kinds,
with `완료 표시` and `수정` still reachable: a schedule is also a record of what happened.

## `EventModal` (`modal.type: "event"`)
One form for both modes: `새 일정` when opened from `일정 추가`, `일정 수정` when opened from a row (`modal.event`).

| Field | Control | Notes |
|---|---|---|
| name | text, placeholder `일정 이름 — 예: 1차 면접` | required |
| kind | chips `약속` / `마감` | defaults to `약속`; decides the lead badge and the group filtering |
| date | `input type="date"` | required |
| time | `input type="time"` under `시간 (선택)` | optional; without it the row leads with `시간 미정` |
| repeat | chips `반복 없음` / `매일` / `매주` / `매월`, then `반복 종료 (선택)` | the end-date input appears only once a repeat is chosen |
| place | text, placeholder `장소 (선택)` | optional |
| note | text, placeholder `메모 (선택)` | optional |
| project (schema v26) | `<select aria-label="프로젝트 (선택)">` under the label `프로젝트 (선택)`, listing `meetingProjects` | optional; `연결 안 함` plus one option per project; no project → the line `프로젝트가 없어요 — 미팅 탭에서 만들어요.` instead of a picker; a `projectId` whose project no longer exists stays selectable as `연결 대상이 삭제됐어요` rather than being silently dropped |
| track (v28) | `TrackRow` chips, after the project select | initial `event?.track || "work"`; picking a project follows that project's track (`BizChips`, [meetings.md](meetings.md#tracks-v28)) until the user taps a track chip; writes `track` |

`EventModal`'s new `projects` prop is `state.meetingProjects || []`, passed by the root. Submit writes
`...(projectId ? { projectId } : {})` into the record — `updateEvent` spreads the form's record over the
stamps, so choosing `연결 안 함` on an edit removes the key from the save. `projectId` is a reference the
meeting-prep card reads ([meetings.md](meetings.md#meeting-prep-rows-meetingprepof-schema-v26)); neither
`calendarExportOf` nor `buildIcs` ever reads it.

Submit is `등록` in add mode and `저장` in edit mode; edit mode also offers `삭제`. Validation, checked in this
order and shown in rose above the button:

| Message | Condition |
|---|---|
| `일정 이름을 입력해 주세요.` | the trimmed name is empty |
| `날짜를 선택해 주세요.` | no date |
| `반복 종료일은 날짜 이후여야 해요.` | a repeat is chosen and the end date is not after the start date |

The form **replaces** the record: a place, note or repeat cleared in the modal disappears from the save. The
user's own stamps do not — `updateEvent` keeps `id`, `createdAt`, `skip` and `doneDates`.

## Root handlers and toasts
| Handler | Effect | Toast |
|---|---|---|
| `addEvent(ev)` | prepends `{ id: uid(), createdAt: today, ...ev }` | `일정을 등록했어요` |
| `updateEvent(id, next)` | replaces the record, keeping the four fields above | `일정을 수정했어요` |
| `removeEvent(id)` | drops the event; every occurrence disappears with it | `일정을 삭제했어요` |
| `toggleEventDone(id, date)` | adds or removes that date in `doneDates` | `일정을 완료로 표시했어요` when marking; silent when un-marking |
| `skipOccurrence(id, date)` | adds that date to `skip` | `이번 회차를 취소했어요` |

All five use the `structuredClone` updater pattern and write nothing derived. Two more root handlers serve the
tab itself: `onAdd={(date) => setModal({ type: "event", date })}` — the list's button passes no date
(`onClick={() => onAdd()}`, never `onClick={onAdd}`, which would hand the modal a `MouseEvent`), the panel's
passes the selected day, and `<EventModal … initialDate={modal.date} />` prefills from it; and
`setScheduleView(v)`, which spreads `v` into `ui.scheduleView`.

## Pre-meeting checks — `확인할 것` (schema v27)

```
events[].checks?: [{ id, text (≤ 200), done, source: "manual" | "ai" }]
```
Optional, no backfill — the same shape of change as `events[].projectId` at v26: the field is written the first
time a check is added, and every reader uses `ev.checks || []`. At most `EVENT_CHECKS_MAX` (30) items of
`EVENT_CHECK_TEXT` (200) characters each. A checklist belongs to the **event record**, not to an occurrence: a
repeating event carries the same checklist to every occurrence, so a check ticked one week is still ticked next
week until the user unticks or deletes it ([TD-61](../exec-plans/tech-debt-tracker.md), accepted — an
occurrence-keyed checklist would need a date map on the event for a use the user has not asked for). A check
pays nothing and completes nothing ([Rule 1](../design-docs/core-beliefs.md#rule-1),
[Rule 18](../design-docs/core-beliefs.md#rule-18)).

**`EventChecks({ ev, onAdd, onToggle, onRemove, readOnly = false })`** (Schedule region) renders the checklist for both surfaces
that show it — the meeting-prep card (`MeetingPrepCard`, [meetings.md](meetings.md)) and, below, the event
detail sheet — so the two cannot drift apart. Header row: `확인할 것` on the left, a mono `{open}/{total}` on
the right (`open` = `!done`). One row per check (`bg-zinc-950 rounded-xl`): a checkbox (`aria-label="확인
완료"`) toggling `done`; the text, struck through when done; a mono `AI` tag (violet) when `source === "ai"`; an
`X` button (`aria-label="확인할 것 삭제"`) → `window.confirm("확인할 것을 삭제해요. 계속할까요?")` →
`onRemove`. Empty: `확인할 것이 없어요.` Add row: an input (`확인할 것 — 예: 단가표 회신 여부`, no `maxLength`)
and a border button `추가`; a refusal from `onAdd` shows as a rose line and the input keeps its text; at the cap
the input and button disable and the line `확인할 것은 30건까지예요.` shows. `readOnly` (2026-09-26): the
checkboxes stay visible with their state but `disabled` (a guarded no-op `onChange`), and there is no `확인할 것
삭제` X, no input, no `추가`, no error line and no cap line; the meeting-prep card never passes it.

**`EventDetailModal`** (the `할 일` tab's own event sheet, [tasks.md](tasks.md)) renders `EventChecks` only when
`eventProjectOf(state, ev)` is non-null (the event belongs to a live meeting project, by its own `projectId` or
the newest meeting whose trimmed title equals the event's) — a plain appointment's sheet is unchanged. When
shown, it is preceded by one line `프로젝트 · {project.name}` and sits above the existing `목표 기여 없음` line.
**Read-only variant** (`readOnly`, 2026-09-26 — opened only from the [daily gate](daily-gate.md#read-only-viewing-from-the-issue-list-2026-09-26)'s
issue list, `modal: { type: "eventDetail", eventId, date, readOnly: true }`): it passes `readOnly` to `EventRow`
(no `완료 표시`/`완료 취소`, `이번 회차 취소` or `수정`) and to `EventChecks` (above); the `목표 기여 없음` line stays
([Rule 13](../design-docs/core-beliefs.md#rule-13)). Closing returns to the issue list. Without `readOnly` the
sheet is byte-identical to before.

### Root handlers and toasts

| Handler | Effect | Toast |
|---|---|---|
| `addCheck(eventId, text, source = "manual")` | refuses `확인할 것을 입력해 주세요.` (empty), the char-count message past `EVENT_CHECK_TEXT`, `확인할 것은 30건까지예요.` at the cap, or `recordFits`; otherwise appends `{ id: uid(), text, done: false, source }` | `확인할 것을 추가했어요` |
| `toggleCheck(eventId, checkId)` | flips that check's `done` | `확인 완료로 표시했어요` / `확인 완료를 취소했어요` |
| `removeCheck(eventId, checkId)` | filters the check out (the caller confirms) | `확인할 것을 삭제했어요` |
| `importChecks(eventId, list)` | registers every ticked, non-rejected prep proposal with `{ id: uid(), text, done: false, source: "ai" }`; refuses `확인할 것은 30건까지예요 — {room}건만 등록할 수 있어요.` when the list would overflow the cap (writes nothing) | `AI 제안 확인할 것 {n}건 등록` |

All four write only one event's `checks`, through a shared `writeChecks(eventId, fn)` clone updater — never
`act`, `tasks`, `goals`, `meetings` or `work`. See [meetings.md](meetings.md) for the prep card and
`확인할 것 가져오기`, and [../design-docs/assistant-bridge.md](../design-docs/assistant-bridge.md) for the third
bridge packet (`AI에게 회의 준비 묻기`) that proposes check items.

## Calendar export (`캘린더로 내보내기`)
The app sends no notification of its own; the button downloads a phone-calendar file (RFC 5545, `.ics`) that the
user imports once, and it is the phone's calendar that then raises the alarms. Mechanics, file format and the
RFC decisions: [../design-docs/calendar-export.md](../design-docs/calendar-export.md). This section covers the
sheet and what each source contributes.

### `CalendarExportModal` (`modal.type: "calExport"`)
`CalendarExportModal({ state, today, onClose, onExport })`, opened by the header button above.
Everything it shows is read live from `calendarExportOf(state, today, days)` (`useMemo` keyed on
`[state, today, days]`) — the same function `buildIcs` calls to write the file, so the sheet cannot promise a
count the export does not produce. Nothing here is stored: `remindAt` and `days` are `useState`, reset to their
defaults every time the sheet opens ([Rule 9](../design-docs/core-beliefs.md#rule-9)) — a remembered preference
would be a schema field for two taps on an occasional action.

| Field | Control | Default |
|---|---|---|
| `매일 알림 시각` | `input type="time"` | `08:00` (`ICS_REMIND_DEFAULT`) |
| `넣을 기간` | chips `30일` / `90일` / `1년` (`ICS_RANGE_DAYS`) | `90일` (`EVENT_HORIZON_DAYS`, the horizon the schedule list already uses) |

Order top to bottom: intro line (states the app sends no notification itself) → the time row → a note on which
kinds fire at that time and which fire on their own schedule → the range label and chips → a preview (below) or,
with nothing to include, one line in its place → a skipped-items line, shown only when it would report something
→ an excluded-fields line (always shown) → a snapshot box of four fixed sentences → three calendar-app notes →
a how-to line → the validation error, the sheet's only `text-rose-400` element → the button `파일 내보내기`,
`disabled` while the selection is empty.

**Preview** (hidden, replaced by one line, when `sel.entries.length === 0`):
- line 1 — `{today} ~ {end} · 항목 {n}건`
- line 2 — `일정 {a} · 실행 기한 {b} · 매일 실행 {c} · 목표 기한 {d}` (`sel.counts`)
- line 3 (v28) — `후속 {e} · 확인 {f} · 마일스톤 {g} · 입금 {h} · 공고 {i}` (the five v28 kinds)

**Skipped line**, shown whenever any of tasks, goals, follow-ups, milestones, payments or notices is above 0:
`기한이 지난 실행 {x}건 · 목표 {y}건 · 후속 {z}건 · 마일스톤 {w}건 · 입금 {v}건 · 공고 {u}건은 날짜가 지나
넣지 않아요.` — the overdue items the file cannot date truthfully are counted, never silently dropped
([Rule 13](../design-docs/core-beliefs.md#rule-13)); a separate line, shown only when the checks counter is
above 0, `확인할 것 {n}건은 하루 전이 지나 넣지 않아요.` (v28).

**Excluded line** (always shown, v28): `넣지 않는 것: 이름·생년월일·연락처·학력·경력, 사업 금액·단가·포트폴리오·
리드, 일정의 장소·메모, 녹취록·문서.`

**Snapshot box**, four fixed sentences, none of them a number that could go stale: the file only holds what
existed at export time and does not follow later edits; completing something in the app does not silence the
calendar's alarm; the daily reminder keeps the task list exactly as it was at export; and where the alarms stop
(`{end} 뒤로는 알림이 없어요.`). The time note (v28) gains one sentence: `후속 기한·마일스톤·입금 예정·공고
마감과 회의 하루 전 확인할 것도 이 시각에 알려요.`

**Calendar-app notes**, three sentences on what the app cannot promise: whether re-import replaces or
duplicates depends on the calendar app; some calendars use their own default notification instead of the
file's `VALARM`; a Google-account calendar stores the imported titles on Google's servers.

**Validation**: `if (!/^\d{2}:\d{2}$/.test(remindAt)) { setErr("알림 시각을 입력해 주세요."); return; }` — the
only failure mode, since the range is always one of three chips.

**Submit**: `onExport({ days, remindAt })` → the root's `exportCalendar` (below).

### What goes into the file, per source
`today … end` is the window, `end = shiftDay(today, span − 1)` where `span` is the chosen days clamped to
`ICS_RANGE_DAYS` (falling back to `EVENT_HORIZON_DAYS`) — the same semantics as `upcomingEvents(state, today,
days)`. `calendarExportOf` reads `state.events`, `state.tasks` and `state.goals` only.

| Source | In the file? | Shape |
|---|---|---|
| `events[]`, one-off (no `repeat`) | yes, when `today ≤ date ≤ end` and the date is not in `doneDates` | one `VEVENT`, UID `event-{id}@life-manager` |
| `events[]`, `daily`/`weekly`/`monthly` with day-of-month ≤ 28 | yes, when at least one occurrence in the window is not ticked | one `VEVENT` with `RRULE` (`DTSTART` = first included occurrence, `UNTIL` = last) and one `EXDATE` per skipped or ticked date between them |
| `events[]`, `monthly` with day-of-month 29–31 | yes | one `VEVENT` per included occurrence, UID `event-{id}-{YYYYMMDD}@life-manager`, no `RRULE` — see "Monthly clamp" in [calendar-export.md](../design-docs/calendar-export.md) |
| `마감` (deadline) kind | all-day; a stored time is kept as text: `마감 {HH:MM} · {title}` | |
| `약속` with a time | timed, `DTEND` = start + 60 min (`ICS_APPT_MINUTES`), alarm 60 min before (`ICS_APPT_LEAD_MIN`) | |
| `약속` without a time | all-day, alarm at the chosen reminder time | |
| Open `once` tasks with `due` (milestones included) | yes, when `today ≤ due ≤ end` | all-day, UID `task-{id}@life-manager`, summary `실행 기한 · {title}` |
| Open `once` tasks with `due < today` | no — counted in the sheet's skipped line | |
| Daily tasks (`type: "daily"`) | one repeating digest, UID `daily-tasks@life-manager` | timed at the reminder time, `RRULE:FREQ=DAILY;UNTIL={end}`, alarm `PT0S`; summary states the count and the first title, description lists every title |
| Goal deadlines (`status: "active"`, `today ≤ deadline ≤ end`) | yes | all-day, UID `goal-{id}@life-manager`, summary `목표 기한 · {title}`; no progress or pace number is written |
| Goal deadlines already past | no — counted in the sheet's skipped line | |
| Done goals, done tasks | no | |
| Meeting follow-ups, open, with a due date (v28) | yes, when `today ≤ due ≤ end` | all-day, UID `followup-{meetingId}-{followUpId}@life-manager`, summary `후속 기한 · {text}`, description names the meeting title, never the minutes |
| Meeting follow-ups with `due < today` | no — counted in the sheet's skipped line | |
| Event checks, open, per included occurrence (v28) | yes, one entry `ICS_CHECK_LEAD_DAYS` (1) day before the occurrence, when that reminder date is `≥ today` | all-day, UID `check-{eventId}-{YYYYMMDD}@life-manager`, summary `확인할 것 {n}건 · {event title}`, description lists each open check's text |
| Event checks whose reminder day has already passed | no — counted in the sheet's own `checks` skipped line | |
| Roadmap milestones, not done, with a due date (v28) | yes, on the due day **and** on `ICS_MILESTONE_LEAD_DAYS` (7) days before it, each when inside the window | all-day, UID `milestone-{id}@life-manager` and `milestone-{id}-d7@life-manager`, summary `마일스톤 기한 ·`/`마일스톤 D-7 ·` + title; no progress or pace number is written |
| Milestones with `due < today` | no — counted in the sheet's skipped line | |
| Unpaid contract payment lines, with a due date (v28) | yes, when `today ≤ due ≤ end` | all-day, UID `payment-{dealId}-{paymentId}@life-manager`, summary `입금 예정 · {kind} · {client} {title}` — **never the amount** |
| Payment lines with `due < today` | no — counted in the sheet's skipped line | |
| Open national-project notices, with a deadline (v28) | yes, when `today ≤ deadline ≤ end` | all-day, UID `notice-{id}@life-manager`, summary `공고 마감 · {title} · {agency}` |
| Notices with `deadline < today` | no — counted in the sheet's skipped line | |
| Business (`deals`/`rates`/`folio`) amounts, portfolio, hospital leads, an event's `place`/`note`, documents, transcripts, `profile`/CV, `journal`, `reviews`, achievements, grades, exams, evidence | never | see [../SECURITY.md](../SECURITY.md) |

**Every track is included** (v28) — the phone calendar is the user's own device and already carries day-job
event titles, so nothing here is filtered by `packetTracks(state)` the way the AI packets are, and this file is
unaffected by the day-job-in-AI-packets settings switch (2026-09-22,
[../SECURITY.md](../SECURITY.md#tracks--the-day-job-switch-2026-09-22)); see
[../design-docs/calendar-export.md](../design-docs/calendar-export.md).

A one-off event is left out both when its date is ticked (in `doneDates`) and when its date is in `skip` —
the export calls `occurrencesOf`, which drops a `skip`-listed date regardless of whether the event currently
repeats. The second case is reachable: `updateEvent` keeps `skip` across an edit (`EventModal` above), so a
weekly event with a cancelled date, edited back down to a one-off, can still carry that leftover `skip` array.

### Root handler
| Handler | Effect | Toast |
|---|---|---|
| `exportCalendar({ days, remindAt })` | builds `buildIcs(state, today, { days, remindAt, now: Date.now() })`; with zero entries it returns early — no download, no modal close, no toast; otherwise downloads the file through the shared `downloadBlob`, closes the modal | `캘린더 파일을 내보냈어요 · {n}건 · {end}까지` |

`exportCalendar` calls no `setState` and no `store` write: the file is built from the current render's `state`
and handed to the browser, nothing more ([Rules 7](../design-docs/core-beliefs.md#rule-7),
[9](../design-docs/core-beliefs.md#rule-9)).

## Occurrences
`occurrencesOf(ev, from, to)` expands the repeat rule at render time and never writes back
([Rule 9](../design-docs/core-beliefs.md#rule-9)): no `repeat` yields the single date when it is inside the
window, `daily` every day, `weekly` the weekday of `date`, `monthly` its day of month clamped to the month
length (31 → 28/29/30). It stops at `repeat.until`, drops `skip` dates, and never iterates more than
`MAX_OCC` = 400 steps. `eventsOn(state, date)` and `upcomingEvents(state, from, days)` build the rows from it;
`upcomingEvents` covers `from … from + days − 1`, and the tab, the briefing and the packet all read the same
expansion. `calendarExportOf` is a fourth reader — it calls `occurrencesOf` directly (once for the ticked
occurrences, once more on the bare rule to compute `EXDATE`) rather than through `upcomingEvents`, and, like
every other reader, only ever reads it.

The month grid adds no second expansion path: `ScheduleCalendar` calls `upcomingEvents(state, monthStart,
daysInMonth)` **once** inside a `useMemo` keyed on `[state, monthStart, daysInMonth]` and reduces the result
into a render-local `Map<date, occurrences[]>` that feeds both the cells and the panel — one call per cell would
re-implement the loop `upcomingEvents` already runs and let the grid and the panel disagree. The map is
recomputed per month and never memoised across months, and neither it, the month index nor the selected day
reaches the save.

## The other two surfaces
- **Daily briefing**: section `오늘 일정` between `오늘 할 일` and `연속 기록`; every line routes back here.
- **Assistant packet**: `## 다가오는 일정 (14일)`, at most 8 lines.

Both are specified in [../design-docs/assistant-bridge.md](../design-docs/assistant-bridge.md). There is no
home-card line for this any more (2026-09-15) — home is a CV with no date-scoped facts; the `일정` header's own
counts line (above) is the one on-screen summary outside this tab and the briefing.

## What an event never does
- No `goalId`, no difficulty, no points, no trophy, no achievement record, no metric change, no streak effect.
- It never runs through `completeTask`, `tryComplete`, `needsEvidence`, `detectKind`
  or `certByTitle`: a certification name inside an event title stays plain text and creates no milestone
  ([Rules 1](../design-docs/core-beliefs.md#rule-1), [10](../design-docs/core-beliefs.md#rule-10),
  [18](../design-docs/core-beliefs.md#rule-18), [19](../design-docs/core-beliefs.md#rule-19)).
- It is excluded from `agendaOf`, `krProgress`, `goalProgress` and `paceOf`, so no event can move a goal's
  progress or its pace.
- Its optional `projectId` (schema v26) is a reference only, read by the meeting-prep card
  ([meetings.md](meetings.md)) — it moves no meeting, changes no follow-up, and neither `calendarExportOf` nor
  `buildIcs` ever reads it.
- A pasted assistant reply can never create or change one: `parseAssistantReply` reads `tasks` and nothing else.
- `완료 표시` is a record of what happened, not a completion: it stores a date in `doneDates` and nothing more.
- The calendar export reads events (and tasks and goals) and creates none: `calendarExportOf`/`buildIcs` call
  no `setState` and no `store` write, so exporting a file cannot mark an occurrence done, cancel one, or move a
  goal.
- A check (schema v27) pays nothing, completes nothing, and is never read by the daily packet or the work
  packet (only the prep packet, `AI에게 회의 준비 묻기`, reads it, to avoid proposing a duplicate — the check
  itself is read by the **calendar file** since v28, as a reminder, never a proposal). A pasted prep reply can
  only *propose* a check item; it never ticks, edits or deletes an existing one, and nothing in that packet is a
  task ([../design-docs/assistant-bridge.md](../design-docs/assistant-bridge.md)).
- (v28) An event's `track` never enters the calendar file's filtering — every track is exported — but does
  gate the three AI packets exactly as every other record kind's track does; see
  [meetings.md](meetings.md#tracks-v28).
