# Schedule tab — `일정`

The fourth tab records what happens on a date: an interview, an exam, an application deadline. An event is a
**record, never a 실행 (task)** — it pays no points, creates no achievement, moves no metric, touches no streak
and passes no evidence gate. Together with the 사업 tab ([business.md](business.md)), it is one of the only two
screens whose rows have no goal behind them.

Data shape: [`events[]` in the generated schema](../generated/db-schema.md). Occurrence, briefing and packet
rules: [../design-docs/assistant-bridge.md](../design-docs/assistant-bridge.md).

## Screen
`ScheduleTab` props: `state, today, view, onView, onAdd, onEdit, onToggleDone, onSkip, onExport`. Tab key
`schedule`, label `일정`, icon `CalendarDays`, fourth entry of `NAV` (`grid-cols-6`), before `사업`.

- Header section: `다가오는 일정` (cyan `SectionLabel`) and, in `목록` view only, the button `일정 추가` →
  `EventModal` in add mode. In `달력` view the button lives in the selected-day panel instead, so exactly one
  button with that label exists at a time.
- Counts line, full width under the header, in **both** views: `오늘 {n}건 · 이번 주 {n}건 · 지난 마감 {n}건`.
  - `오늘` — occurrences dated today.
  - `이번 주` — every occurrence from today to Sunday (`mondayOf(today) + 6`). It answers how much is left this
    week, so it includes today and tomorrow and is **not** the row count of the group of the same name.
  - `지난 마감` — `마감` occurrences in the last 30 days (`EVENT_PAST_DAYS`); equal to the rows of that group.
- Empty state, when no group has a row (`목록` view): `등록한 일정이 없어요 — 표시할 약속·마감이 없어요.`

## Views — `목록` and `달력`
Two `Chip`s under the counts line, `목록` first. `목록` answers "what is next", `달력` answers "what does this
month look like"; both read the same expansion and the same row, so they can state nothing different. The same
row also carries, right-aligned, the text-only button `캘린더로 내보내기` → `onExport()` → `CalendarExportModal`
(below) — the one entry point into the calendar export, present in both views so neither reads differently.

- The choice is stored in `state.ui.scheduleView` (`"list"` | `"calendar"`, schema v17) and survives a reload:
  the root's `setScheduleView` spreads it into `ui`, `ScheduleTab` reads `view === "calendar"` and treats every
  other value, including a save written before v17, as `목록`.
- The month shown and the selected day are **component state** in `ScheduleCalendar`, never stored
  ([Rule 9](../design-docs/core-beliefs.md#rule-9)) — entering the tab always opens on the current month with
  today selected, whichever month was open last time.

## Day groups (`목록` view)
Rendered in this order; a group with no row is not rendered at all.

| Group | Window | Rows |
|---|---|---|
| `지난 마감` | today − 30 … yesterday | `마감` only — a past appointment is not actionable, a missed deadline is ([Rule 13](../design-docs/core-beliefs.md#rule-13)). Ticked occurrences stay so `완료 취소` remains reachable |
| `오늘` | today | one row per occurrence |
| `내일` | tomorrow | one row per occurrence |
| `이번 주` | tomorrow + 1 … Sunday | one row per occurrence |
| `이후` | after tomorrow and after Sunday, to today + 90 (`EVENT_HORIZON_DAYS`) | **one row per event** — its earliest occurrence in the window |

The `이후` collapse (2026-09-11) exists because the group is the only unbounded one: at one row per occurrence a
single weekly repeat fills 12 rows over the 90-day horizon and a daily one 90, and the one dated deadline in
between disappears. The collapsed row keeps its `반복 매주` marker, so the repeat is stated rather than hidden,
and no new copy was needed. The near groups stay one row per occurrence because those are the ones a person acts
on individually — ticking or cancelling a single date. Rows stay date-ascending in every group.

## Row anatomy
`EventRow({ ev, date, done, today, onToggleDone, onSkip, onEdit, tail = null })` is a module-level component
rendered by the day groups **and** by the calendar's selected-day panel, so the two views cannot drift apart.
`tail` is an optional trailing fragment on the sub-line, rendered as `` · {tail}`` in `text-zinc-600` — the same
markup a task row uses for `목표 기여 없음`. This tab and `ScheduleCalendar` pass nothing, so their `EventRow` is
byte-identical to before; the `실행` tab ([tasks.md](tasks.md)) is the one caller that passes
`tail="목표 기여 없음"`, since an event there sits beside tasks and has to state, on the row itself, that it moves
no goal.
```
[ D-3 ]  전기기사 실기 원서 접수 마감                    [마감]
         2026-09-20 · 접수 후 수험표 확인 · 반복 매주
         [완료 표시] [이번 회차 취소] [수정]
```
- **Lead badge** (mono, bordered): `마감` → `ddayStr(date)` — `D-3` / `D-DAY` / `D+2`, rose when the date has
  passed, amber on today, zinc otherwise. `약속` → `time`, or `시간 미정` when no time was given.
- **Title**, struck through at 50 % opacity once the occurrence is ticked.
- **Sub-line**: the occurrence date in mono, then ` · {장소}`, ` · {메모}`, ` · 반복 {매일|매주|매월}` when present.
- **Kind chip**: `약속` (zinc) or `마감` (amber).
- **Buttons**: `완료 표시` ↔ `완료 취소` (`onToggleDone(id, date)`); `이번 회차 취소` (`onSkip(id, date)`) only on a
  repeating occurrence — skipping the single date of a one-off would leave a record that can never be rendered,
  edited or deleted again, so a one-off is removed with `삭제` in the modal; `수정` opens the modal in edit mode.
- Ordering inside a date: `마감` first, then `약속` by time with untimed last, ties by title (`eventsOn`).

## Calendar view (`달력`)
`ScheduleCalendar` props: `state, today, onAdd, onEdit, onToggleDone, onSkip`. Two sections under the header:
the month grid, then the selected-day panel.

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
([Rule 9](../design-docs/core-beliefs.md#rule-9), [Rule 12](../design-docs/core-beliefs.md#rule-12)). **The `목록`
view shows nothing about holidays**: every row there carries `완료 표시` / `수정`, feeds the counts and the `이후`
collapse, and a holiday is none of those. `demoState` is unchanged — the layer is static, so the demo shows it
without demo data.

### Selected-day panel
`선택한 날짜` (`SectionLabel`), the mono line `{YYYY-MM-DD} · {n}건`, then — when `HOLIDAYS[sel]` exists — one
`text-xs text-rose-400` line `공휴일 · {name}` directly under it (never appended to the mono line, which the E2E
asserts verbatim, and the `공휴일 · ` prefix keeps a bare name from reading like an event title), then the day's
occurrences as `EventRow`s —
the same rows in the same order as the list's groups, `완료 표시` / `이번 회차 취소` / `수정` included. A day with
none reads `이 날짜에는 일정이 없어요.` The panel's `일정 추가` calls `onAdd(selected)`, so `EventModal` opens in
add mode with its date input already on that day (`useState(event?.date || initialDate || "")`) and registering
stores the event on it.

### Selection and range
| Action | Selection afterwards |
|---|---|
| entering the tab in `달력` view | today, in the current month |
| tapping a day | that day; the panel follows immediately |
| `‹` / `›` | the **1st** of the month moved to — keeping the old day would leave the panel on a date the shown month no longer answers for |
| `오늘` | today, back in the current month |

Paging is bounded by `CAL_RANGE_MONTHS = 24` months either side of today; at the edge the button is disabled
(`opacity-30`), so `‹` cannot walk into years of empty grids. Past months are browsable and show **both** kinds
— unlike the list's `지난 마감` window (`EVENT_PAST_DAYS`, deadlines only) — with `완료 표시` and `수정` still
reachable: a schedule is also a record of what happened.

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

## Calendar export (`캘린더로 내보내기`)
The app sends no notification of its own; the button downloads a phone-calendar file (RFC 5545, `.ics`) that the
user imports once, and it is the phone's calendar that then raises the alarms. Mechanics, file format and the
RFC decisions: [../design-docs/calendar-export.md](../design-docs/calendar-export.md). This section covers the
sheet and what each source contributes.

### `CalendarExportModal` (`modal.type: "calExport"`)
`CalendarExportModal({ state, today, onClose, onExport })`, opened by the header button above, in both views.
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

**Skipped line**, only when `sel.skipped.tasks + sel.skipped.goals > 0`: `기한이 지난 실행 {x}건 · 목표
{y}건은 날짜가 지나 넣지 않아요.` — the overdue items the file cannot date truthfully are counted, never silently
dropped ([Rule 13](../design-docs/core-beliefs.md#rule-13)).

**Excluded line** (always shown): `넣지 않는 것: 이름·생년월일·연락처·학력·경력, 사업 기록과 금액, 일정의
장소·메모.`

**Snapshot box**, four fixed sentences, none of them a number that could go stale: the file only holds what
existed at export time and does not follow later edits; completing something in the app does not silence the
calendar's alarm; the daily reminder keeps the task list exactly as it was at export; and where the alarms stop
(`{end} 뒤로는 알림이 없어요.`).

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
| Business (`deals`/`rates`/`folio`), `profile`/CV, an event's `place`/`note`, `journal`, `reviews`, achievements, grades, exams, evidence | never | see [../SECURITY.md](../SECURITY.md) |

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

## The other three surfaces
- **Home briefing card**: a second mono line under the counts, `오늘 일정 {n}건 · 3일 내 마감 {n}건 ›`, which
  switches to this tab. The 3 is `EVENT_SOON_DAYS`; the deadline count includes today.
- **Daily briefing**: section `오늘 일정` between `오늘 할 일` and `연속 기록`; every line routes back here.
- **Assistant packet**: `## 다가오는 일정 (14일)`, at most 8 lines. Both are specified in
  [../design-docs/assistant-bridge.md](../design-docs/assistant-bridge.md).

## What an event never does
- No `goalId`, no difficulty, no points, no trophy, no achievement record, no metric change, no streak effect.
- It never runs through `completeTask`, `tryComplete`, `needsEvidence`, `detectKind`
  or `certByTitle`: a certification name inside an event title stays plain text and creates no milestone
  ([Rules 1](../design-docs/core-beliefs.md#rule-1), [10](../design-docs/core-beliefs.md#rule-10),
  [18](../design-docs/core-beliefs.md#rule-18), [19](../design-docs/core-beliefs.md#rule-19)).
- It is excluded from `agendaOf`, `doneTodayCount`, `krProgress`, `goalProgress` and `paceOf`, so no event can
  move a goal's progress or its pace.
- A pasted assistant reply can never create or change one: `parseAssistantReply` reads `tasks` and nothing else.
- `완료 표시` is a record of what happened, not a completion: it stores a date in `doneDates` and nothing more.
- The calendar export reads events (and tasks and goals) and creates none: `calendarExportOf`/`buildIcs` call
  no `setState` and no `store` write, so exporting a file cannot mark an occurrence done, cancel one, or move a
  goal.
