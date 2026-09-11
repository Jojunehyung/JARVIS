# Schedule tab — `일정`

The fifth tab records what happens on a date: an interview, an exam, an application deadline. An event is a
**record, never a 실행 (task)** — it pays no points, creates no achievement, moves no metric, touches no streak
and passes no evidence gate. It is the only screen whose rows have no goal behind them.

Data shape: [`events[]` in the generated schema](../generated/db-schema.md). Occurrence, briefing and packet
rules: [../design-docs/assistant-bridge.md](../design-docs/assistant-bridge.md).

## Screen
`ScheduleTab` props: `state, today, onAdd, onEdit, onToggleDone, onSkip`. Tab key `schedule`, label `일정`,
icon `CalendarDays`, fifth entry of `NAV` (`grid-cols-5`).

- Header section: `다가오는 일정` (cyan `SectionLabel`) and the button `일정 추가` → `EventModal` in add mode.
- Counts line, full width under the header: `오늘 {n}건 · 이번 주 {n}건 · 지난 마감 {n}건`.
  - `오늘` — occurrences dated today.
  - `이번 주` — every occurrence from today to Sunday (`mondayOf(today) + 6`). It answers how much is left this
    week, so it includes today and tomorrow and is **not** the row count of the group of the same name.
  - `지난 마감` — `마감` occurrences in the last 30 days (`EVENT_PAST_DAYS`); equal to the rows of that group.
- Empty state, when no group has a row: `등록한 일정이 없어요 — 표시할 약속·마감이 없어요.`

## Day groups
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

All five use the `structuredClone` updater pattern and write nothing derived.

## Occurrences
`occurrencesOf(ev, from, to)` expands the repeat rule at render time and never writes back
([Rule 9](../design-docs/core-beliefs.md#rule-9)): no `repeat` yields the single date when it is inside the
window, `daily` every day, `weekly` the weekday of `date`, `monthly` its day of month clamped to the month
length (31 → 28/29/30). It stops at `repeat.until`, drops `skip` dates, and never iterates more than
`MAX_OCC` = 400 steps. `eventsOn(state, date)` and `upcomingEvents(state, from, days)` build the rows from it;
`upcomingEvents` covers `from … from + days − 1`, and the tab, the briefing and the packet all read the same
expansion.

## The other three surfaces
- **Home briefing card**: a second mono line under the counts, `오늘 일정 {n}건 · 3일 내 마감 {n}건 ›`, which
  switches to this tab. The 3 is `EVENT_SOON_DAYS`; the deadline count includes today.
- **Daily briefing**: section `오늘 일정` between `오늘 할 일` and `연속 기록`; every line routes back here.
- **Assistant packet**: `## 다가오는 일정 (14일)`, at most 8 lines. Both are specified in
  [../design-docs/assistant-bridge.md](../design-docs/assistant-bridge.md).

## What an event never does
- No `goalId`, no difficulty, no points, no trophy, no achievement record, no metric change, no streak effect.
- It never runs through `completeTask`, `tryComplete`, `spawnTask`, `metricsGain`, `needsEvidence`, `detectKind`
  or `certByTitle`: a certification name inside an event title stays plain text and creates no milestone
  ([Rules 1](../design-docs/core-beliefs.md#rule-1), [10](../design-docs/core-beliefs.md#rule-10),
  [18](../design-docs/core-beliefs.md#rule-18), [19](../design-docs/core-beliefs.md#rule-19)).
- It is excluded from `agendaOf`, `doneTodayCount`, `krProgress`, `goalProgress` and `paceOf`, so no event can
  move a goal's progress or its pace.
- A pasted assistant reply can never create or change one: `parseAssistantReply` reads `tasks` and nothing else.
- `완료 표시` is a record of what happened, not a completion: it stores a date in `doneDates` and nothing more.
