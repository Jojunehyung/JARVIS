# Calendar export — the phone-calendar file (RFC 5545)

The app sends no notification of its own: there is no push server (the app is local-only) and no browser API
schedules a local alarm while the app is closed (Notification Triggers was abandoned; Periodic Background Sync
is browser-timed, skips days, and a service worker cannot read `localStorage`). Instead, `CalendarExportModal`
([../product-specs/schedule.md](../product-specs/schedule.md)) downloads a `.ics` file the user imports once
into their phone's own calendar, which then raises the alarms — at the exact time, app closed, no server, no
network ([Rule 7](core-beliefs.md#rule-7)). The file is a **snapshot**, built in memory from records at export
time; nothing about the export is stored ([Rule 9](core-beliefs.md#rule-9), [Rule 12](core-beliefs.md#rule-12)
— schema stays v21).

Two pure functions do the work, in a region between `parseAssistantReply` and `/* ── State lifecycle ── */` in
`src/LifeManager.jsx` (grep `Calendar export — the phone-calendar file`): `calendarExportOf(state, today, days)`
selects and shapes the entries (the per-source table lives in [schedule.md](../product-specs/schedule.md));
`buildIcs(state, today, opts)` serialises them into RFC 5545 text. Every declaration in the region is a
top-level `const` so `tools/harness/smoke-logic.js` can lift and run each one without a browser.

## File shape
```
BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Life Manager//Calendar Export//KO
CALSCALE:GREGORIAN
X-WR-CALNAME:인생 관리
BEGIN:VEVENT
UID:event-{id}@life-manager
DTSTAMP:{export instant, UTC}
SEQUENCE:{seconds since ICS_SEQ_EPOCH}
DTSTART...
...
BEGIN:VALARM
ACTION:DISPLAY
DESCRIPTION:{summary}
TRIGGER:{duration}
END:VALARM
END:VEVENT
END:VCALENDAR
```
No `METHOD`: a plain import is not an iTIP scheduling message. Every content line ends CRLF, including the
final `END:VCALENDAR`; no BOM.

## Folding — 75 octets, counted in UTF-8 bytes
RFC 5545 §3.1 folds a content line at 75 octets: a first line of ≤ 75 octets, then continuation lines of one
space plus ≤ 74 octets. `icsFold` counts **UTF-8 bytes per code point** (`for (const ch of line)`, a Hangul
syllable is 3 bytes, an emoji 4) and never splits inside a code point or a surrogate pair. Folding by
`.length` — UTF-16 code units — would let a Korean line run to three times the limit and could still cut a
character; `ICS_LINE_OCTETS = 75` names the bound. Unfolding is `/\r\n[ \t]/g` → empty.

## TEXT escaping
`icsText` applies RFC 5545 §3.3.11 to `SUMMARY`, `DESCRIPTION` and `X-WR-CALNAME`: `\` → `\\` **first** (so the
escapes it introduces are not themselves escaped), then `;` → `\;`, `,` → `\,`, and any of CR / LF / CRLF →
`\n`.

## Time — floating local time, one UTC value
The app records wall-clock dates and `HH:MM` with no zone, every date helper is local and noon-anchored, and
`toISOString` is banned from `src/` (comments at three call sites forbid it). The export follows the same rule:
every user-visible time is a **floating local time** (no `TZID`, no `VTIMEZONE`, no trailing `Z`) —
`icsLocal(d, hhmm)` → `YYYYMMDDTHHMM00`. A floating time means "this time, wherever the phone is", which is
exactly what the app means; asserting `TZID=Asia/Seoul` would claim a zone the app never recorded, and
converting to UTC would reintroduce the conversion the codebase bans. The cost, stated plainly rather than
hidden: a calendar app reads floating time in whatever zone it is set to.

`DTSTAMP` is the one value RFC 5545 (§3.8.7.2) requires in UTC, and it is never shown to the user. `icsUtcStamp`
is the only `getUTC*` use in the region — the sole exception to "every date the app renders is local."

## Forms
- **All-day** (a `마감`, a timed-less `약속`, a dated task, a goal deadline): `DTSTART;VALUE=DATE:YYYYMMDD` +
  `DTEND;VALUE=DATE:` the **next** day (RFC 5545's exclusive end), `TRANSP:TRANSPARENT`. A deadline's stored
  time, if any, is kept as text rather than dropped: `마감 {HH:MM} · {title}`.
- **Timed appointment**: `DTSTART` at the stored time, `DTEND` = start + `ICS_APPT_MINUTES` (60). The app never
  stores an end time, and RFC 5545 forbids `DTEND = DTSTART` (a zero-length event renders unreliably in most
  calendars), so the file uses a nominal 60-minute block — stated as such in the sheet, never presented as a
  real duration.
- **Daily digest**: one timed entry per export, `DTEND` = start + `ICS_DIGEST_MINUTES` (10), not all-day —
  a calendar that ignores `VALARM` still visibly alerts near a timed event's start, which an all-day entry would
  not do reliably.

## Repeats — `RRULE`, `UNTIL`, `EXDATE`
For a repeat RFC 5545 states exactly (`daily`, `weekly`, `monthly` on day-of-month ≤ 28):
- `DTSTART` = the **first included occurrence inside the window**, not `ev.date` — so the file carries no
  history and no years of `EXDATE` for an old repeat.
- `UNTIL` = the **last included occurrence inside the window**, in the same value type as `DTSTART`
  (`YYYYMMDD` all-day, floating `YYYYMMDDTHHMMSS` timed) — this is `min(repeat.until, end)` when a stored
  `repeat.until` falls inside the window, and the window's own end otherwise.
- `EXDATE` = the dates the **bare rule** would generate between `DTSTART` and `UNTIL`
  (`occurrencesOf({ date: ev.date, repeat: ev.repeat }, first, last)`, i.e. with no `skip`) minus the dates
  actually included — so a cancelled date and a ticked date both become exceptions, uniformly, and an `EXDATE`
  never names a date the rule itself would not produce. `occurrencesOf` steps every frequency other than weekly
  and monthly one day at a time, so `FREQ=DAILY` reproduces the same set exactly; weekly keeps the weekday of
  `ev.date`, which is what `FREQ=WEEKLY` does natively too.

## Monthly clamp — day 29–31 is written as dates, not a rule
`occurrencesOf` places a monthly event dated on the 31st on the **last day of every month**
(`Math.min(dom, daysInMonth)`: Feb 28/29, Apr 30, …). `RRULE:FREQ=MONTHLY` cannot reproduce this: RFC 5545
§3.3.10 says a rule instance landing on an invalid date (February 30) MUST be ignored and not counted, so a
conforming calendar **drops** every month the app's clamp lands in, and a non-conforming one may roll the date
forward into the next month (Mar 2/3) — an occurrence the app does not have either way. `BYMONTHDAY=-1` only
fixes day 31; `BYMONTHDAY=28,29,30;BYSETPOS=-1` is exact in RFC terms but a calendar that ignores `BYSETPOS`
would create three occurrences a month instead of one.

The export stays truthful by writing, for day-of-month 29–31, **one `VEVENT` per date `occurrencesOf` itself
returns** — UID `event-{id}-{YYYYMMDD}@life-manager`, no `RRULE` — so the file carries exactly the app's dates,
nothing more and nothing less. Day-of-month ≤ 28 exists in every month, so `RRULE:FREQ=MONTHLY` stays exact
there and is used as normal.

## Alarms
Every `VEVENT` carries exactly one `VALARM` (`ACTION:DISPLAY`, `DESCRIPTION` = the entry's summary, `TRIGGER` =
`icsDuration(minutes)`):

| Entry | Trigger |
|---|---|
| All-day (deadline, untimed appointment, dated task, goal deadline) | the chosen reminder time on that day |
| Timed appointment | `-PT1H` (`ICS_APPT_LEAD_MIN = 60` minutes before) |
| Daily digest | `PT0S` (at its own start, which is already the reminder time) |

## UID, DTSTAMP, SEQUENCE
- **UID** (`icsUid`) is built from the record id alone (plus the occurrence date for an expanded monthly
  entry), so it is **stable across exports** — a calendar matching on UID can recognise a re-import. An id
  containing a character outside `[A-Za-z0-9_-]` is `encodeURIComponent`-encoded whole (reversible, so two ids
  never collide). Record ids come from `uid()`, which is random, so a UID says nothing about the person holding
  it.
- **DTSTAMP** = the export instant, UTC (`icsUtcStamp(now)`).
- **SEQUENCE** = `Math.max(0, Math.floor((now − ICS_SEQ_EPOCH) / 1000))`, whole seconds since `Date.UTC(2026, 0,
  1)` — grows with every later export without storing anything, and fits a signed 32-bit integer until 2094.
  Two exports of the same record keep the same UID and a non-decreasing `SEQUENCE` (smoke check (e), E2E step
  "a second export keeps every UID").

## Five more kinds (v28) — follow-ups, checks, milestones, payments, notices

Since schema v28, `calendarExportOf` additionally reads `meetings[].followUps`, `events[].checks`,
`state.milestones`, `deals[].payments` and `state.notices`. Every new entry is all-day and alarms at the chosen
reminder time (built through the same `entry(source, uid, date, summary, body)` helper the existing kinds use);
**every track is included** — the phone calendar is the user's own device and already carries day-job event
titles, so nothing here is filtered by `packetTracks(state)` the way the five AI packets are, and this file is
unaffected by the day-job-in-AI-packets settings switch ([SECURITY.md](../SECURITY.md#tracks--the-day-job-switch-2026-09-22)).

| Kind (`source`) | Written when | UID | Summary | Description | Skipped when |
|---|---|---|---|---|---|
| `followup` | per meeting, per open follow-up with `today ≤ due ≤ end` | `icsUid("followup", meetingId + "-" + followUpId)` | `후속 기한 · {text}` | the meeting title, `목표 기여 없음` — never the minutes | `due < today` |
| `check` | per included event occurrence with ≥ 1 open check, on `shiftDay(date, -ICS_CHECK_LEAD_DAYS)` when that date is `≥ today` | `icsUid("check", eventId, date)` | `확인할 것 {n}건 · {event title}` | one `- {text}` per open check | the reminder date (occurrence − 1 day) is before today — this counts a check whose meeting is today, since its reminder day has already passed |
| `milestone` (due day) | per not-done milestone with `today ≤ due ≤ end` | `icsUid("milestone", id)` | `마일스톤 기한 · {title}` | `진행률·페이스는 넣지 않아요 — 내보낸 뒤 바로 달라져요.` | `due < today` |
| `milestone` (D-7) | the same milestone, when `today ≤ due − 7 ≤ end` | `icsUid("milestone", id + "-d7")` | `마일스톤 D-7 · {title}` | same | (shares the due-day entry's skip) |
| `payment` | per unpaid payment line with `today ≤ due ≤ end` | `icsUid("payment", dealId + "-" + paymentId)` | `입금 예정 · {kind label} · {client} {title}` — **never the amount** | `금액은 넣지 않아요.` | `due < today` |
| `notice` | per open notice with `today ≤ deadline ≤ end` | `icsUid("notice", id)` | `공고 마감 · {title} · {agency}` | `목표 기여 없음` | `deadline < today` |

`ICS_MILESTONE_LEAD_DAYS = 7` and `ICS_CHECK_LEAD_DAYS = 1` are the two new named constants. `rank` (Ordering,
below) gains `followup: 4, check: 5, milestone: 6, payment: 7, notice: 8`; `counts` and `skipped` gain the
matching keys, read by the sheet's second preview line and its skipped-items line
([schedule.md](../product-specs/schedule.md#calendarexportmodal-modaltype-calexport)). `buildIcs` needed no
change — every new entry is all-day and alarms at the reminder time, the shape `buildIcs` already serialises.

**A daily-repeating event with open checks can write up to 365 reminder entries** at the one-year range (one
per included occurrence) — accepted, since a check belongs to the event record and every occurrence needs its
own day-before reminder.

## Ordering
Entries sort by start date, then `event → task → daily → goal → followup → check → milestone → payment →
notice` (v28), then summary, then `UID` as a final tie-break, using plain code-unit comparison (never
`localeCompare`, so the order cannot depend on the runtime's locale) — deterministic output for identical input
and `now`.

## The 365-day bound
`occurrencesOf` stops after `MAX_OCC = 400` iterations. `ICS_RANGE_DAYS = [30, 90, 365]` is the sheet's three
range chips (label `1년` for 365); smoke check (i) asserts `Math.max(...ICS_RANGE_DAYS) <= MAX_OCC`, so a daily
event over the longest offered window is never silently cut. A window longer than 400 days is deliberately not
offered for the same reason. `1년` is also what makes the monthly-clamp behaviour reachable independent of the
calendar date the export runs on: a 90-day window starting mid-year can miss every clamped month-end, a
365-day window cannot.

## Privacy by construction
`calendarExportOf` reads `state.events`, `state.tasks`, `state.goals` and, since v28, `meetings[].followUps`,
`events[].checks`, `state.milestones`, `deals[].payments` and `state.notices` — never `profile`, `folio`,
`journal`, `reviews`, `leads`, `documents`, a meeting's summary/decisions/actions/transcript/progress/attendees,
a deal's `monthly`/`costMonthly`/`note`/`paidMonths`, a payment's `amount`, a milestone's `condition` or link
lists, a notice's `note`/`documentIds`/`postedAt`, and never an event's `place` or `note`. What carries an event
through the builder is `occurrencesOf({ date: ev.date, repeat: ev.repeat }, …)` — a two-field literal, not a
copy of `ev` — so nothing downstream of that call can read `place` or `note` even by accident; a shallow copy
such as `{ ...ev, skip: [] }` would still carry both fields through untouched. `tools/harness/smoke-logic.js`
check (g) proves the boundary by building from a state whose `profile`, `folio`, `journal`, `reviews`, `leads`
and `documents` are getters that **throw** (v28: `deals` is no longer trapped whole, since the export now reads
payment lines — its own privacy-bearing fields are trapped individually instead, listed above), and whose every
event has trapped `place`/`note` getters as well, across every event branch (one-off, a repeat with exceptions,
a day-31 monthly expansion) — the build must complete without error. The full mutation-testing record (what a
weaker check would have missed) is in [../RELIABILITY.md](../RELIABILITY.md). Data-in-transit consequences of
the fields the file *does* carry (event and task titles, goal titles, follow-up text, milestone titles, a
payment's kind/client/title without the amount, notice titles) are recorded in
[../SECURITY.md](../SECURITY.md#the-calendar-file).

## What is guaranteed and what depends on the calendar app
| Guaranteed by the file | Depends on the calendar app |
|---|---|
| Stable UIDs across exports; `SEQUENCE` grows with export time; `DTSTAMP` = export instant | Whether re-importing a UID **replaces** the entry, **skips** it, or **adds a duplicate** |
| A `VALARM` on every entry | Whether the app uses it — Google Calendar is reported to ignore an imported `VALARM` and apply the destination calendar's default notification instead. **Not verified on a device**; see the manual check below |
| Exactly the app's dates inside the window, nothing after `end` | Whether floating time is read in the device's zone or the calendar's own zone setting |
| No profile, business, place, note or amount data | Whether the phone offers to open a local `.ics` at all — Samsung Calendar is known to import one; the Google Calendar Android app has not historically opened a local `.ics` file, routing instead through Google Calendar on the web (Settings → Import & export) |
| — | Nothing ever **removes** an imported entry: a record deleted or completed in the app stays in the calendar, alarm included, until the user deletes it by hand. Plain `.ics` import has no "delete" |

[install-and-backup.md](../product-specs/install-and-backup.md) recommends importing into a dedicated or
device-only calendar so a fresh export can replace the whole set by emptying that calendar first, and records
the manual Android check this table's app-dependent column cannot get from automation alone (dated, or
`pending`).

## Download
`exportCalendar` (root handler, [schedule.md](../product-specs/schedule.md#root-handler)) builds with
`buildIcs(state, today, { days, remindAt, now: Date.now() })` and hands the text to the shared `downloadBlob`
helper — the same in-memory `Blob` → `createObjectURL` → temporary `<a download>` → click → remove →
`revokeObjectURL` after 1 s sequence `exportBackup` already used, extracted once so the app has exactly one
download path. Blob type `text/calendar;charset=utf-8`; file name `life-manager-calendar-{today}.ics`. No
request ever leaves the device to produce or offer the file ([Rule 7](core-beliefs.md#rule-7)).

## Symbols (grep `src/LifeManager.jsx`)
| Symbol | What it does |
|---|---|
| `ICS_RANGE_DAYS`, `ICS_REMIND_DEFAULT`, `ICS_APPT_LEAD_MIN`, `ICS_APPT_MINUTES`, `ICS_DIGEST_MINUTES`, `ICS_LINE_OCTETS`, `ICS_SEQ_EPOCH`, `ICS_UID_HOST` | the eight fixed constants above, each commented with its reason at the declaration |
| `icsText` | TEXT escaping |
| `icsFold` | 75-octet line folding, UTF-8 byte counted |
| `icsDate`, `icsLocal` | date/time string formatting (all-day, floating local) |
| `icsAddMinutes` | wall-clock minutes added to a date + `HH:MM`, rolling the day over through `shiftDay` |
| `icsUtcStamp` | `DTSTAMP` — the one UTC value |
| `icsDuration` | minutes → an RFC 5545 `DURATION` (`PT0S` / `PT8H` / `-PT1H` / …) |
| `icsUid` | stable per-record UID, percent-encoded when the id needs it |
| `calendarExportOf(state, today, days)` | selects and shapes entries — the per-source table in [schedule.md](../product-specs/schedule.md) |
| `buildIcs(state, today, opts)` | serialises `calendarExportOf`'s entries into the complete `VCALENDAR` text |
| `ICS_MILESTONE_LEAD_DAYS`, `ICS_CHECK_LEAD_DAYS` (v28) | the D-7 milestone lead and the one-day check reminder lead, the two new fixed constants |

## Smoke checks (v28)
`tools/harness/smoke-logic.js`'s `RICH` fixture gains one meeting with an open follow-up due inside the window
and one past, one event with an open check whose occurrence is inside the window, one milestone due inside the
window and one past, one deal with an unpaid payment (amount 1,234,567), and one notice. Checks (m)–(r) (after
the pre-existing (a)–(l)): (m) the follow-up entry's UID and summary; (n) the check entry lands on the day
before the occurrence, with the check text in the description, and an occurrence today is counted (not
written); (o) the milestone yields two entries whose UIDs differ by `-d7`; (p) the payment entry's text contains
neither `1234567` nor its 만원 form; (q) the past follow-up and milestone are counted as skipped, and the
skipped/excluded lines follow the v28 copy; (r) a state without any of the v28 keys still builds. `ICS_NAMES`
(the symbols the harness lifts by name) gains `ICS_MILESTONE_LEAD_DAYS`, `ICS_CHECK_LEAD_DAYS`, `PAYMENT_KIND`
and `noticeOpen`.
