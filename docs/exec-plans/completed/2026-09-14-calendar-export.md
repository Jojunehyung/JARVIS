# Calendar export — an `.ics` snapshot the phone's calendar raises alarms from
- Status: completed
- Date: 2026-09-14
- Needs approval: **no** by the `docs/PLANS.md` criteria — no `CERTS` / `EXAMS` / `WEIGHT_MATRIX` / `CERT_W_EXC` row, no `migrate` block, no `v` bump, no `liferpg-*` key, no deletion of user data. The two product decisions this plan implements (export to the phone calendar as a file; item titles inside the file) are recorded as the user's own, as relayed in the planning brief. A planner cannot verify consent: before Phase 3 starts, the main agent confirms both decisions appear in the user's own messages.
- Agents: planner → implementer → cleanup → verifier → docs-syncer (no data-curator: no frozen table is read for writing)

## Goal
The user asked (Korean, verbatim in the brief) to be told every day, by alarm, about the goals and schedule they set. The app is a local-only PWA with no server: a fixed-time daily notification while the app is closed would need a push server (breaks the local-only design) or a local-scheduling browser API that does not exist in shipping browsers (Notification Triggers was abandoned; Periodic Background Sync is browser-timed, skips days, and a service worker cannot read `localStorage`). The user chose to **export an `.ics` file** that the phone's own calendar imports once and then raises alarms from — at the exact time, app closed, no server, no network — and to **include item titles**, knowing that a Google account calendar stores them on Google's servers.

Outcome: a `캘린더로 내보내기` button on the `일정` tab opens a sheet that asks the daily reminder time and how far ahead to include, states plainly that the file is a snapshot, and downloads `life-manager-calendar-{date}.ics`, built by a pure `buildIcs(state, today, opts)` that reads records and writes nothing back. No schema change.

## Context read
Source anchors, re-read on 2026-09-14 in `src/LifeManager.jsx` (7,092 lines; the symbol index says 7,093 and is stale by one line — trust grep, not numbers):
- Dates: `dstr` L1290, `shiftDay` L1294 (noon-anchored), `daysBetween` / `mondayOf` L1918–1919. No `toISOString` anywhere in `src/` (only comments forbidding it at L2206, L2403, L5548).
- Events: `EVENT_KIND_LABEL`, `REPEAT_LABEL`, `EVENT_HORIZON_DAYS = 90`, `MAX_OCC = 400` L2338–2343; `occurrencesOf` L2347–2375 — the monthly branch L2357–2367 clamps with `Math.min(dom, daysInMonth)` at L2363 (day 31 → 28/29/30); weekly keeps the weekday of `ev.date`; `skip` dates are dropped; `repeat.until` bounds the window. `eventsOn` L2378, `upcomingEvents(state, from, days)` L2388 covers `from … from + days − 1`.
- Tasks and goals: `agendaOf` L2324–2334 (open = daily not done today / once not `done`); `todoOf` L2410–2493 skips a ticked occurrence at L2438. Goal `deadline` is optional (`AddGoalModal` stores `deadline || null`, L4000); cert/exam milestones copy `due: goal.deadline` at creation (L4711, L4714).
- `@schema v21` JSDoc L2773–2822 (derived-values sentence L2817–2821); `parseAssistantReply` ends L2770; banner `/* ── State lifecycle ── */` L2772; `demoState` L2940–3037 (timed appointment, untimed deadline, weekly repeat, two daily tasks, one overdue once task, goal deadlines at +60/+90/+150).
- UI atoms: `SectionLabel` L1849, `Chip` L1853, `Modal` L1884 (`.fixed.inset-0` overlay, X button). `ToastHost` L4301 (2,600 ms).
- `ScheduleTab` L5636–5720: header section L5673–5692, view chips row L5688–5691. `EventModal` L5723–5794 (label `w-24 shrink-0` + input `flex-1 w-0` pattern L5760–5764, rose error L5783). Business banner L5796.
- `GrowthTab` data section L5319–5336 (`백업 내보내기` / `백업 불러오기` / `데이터 초기화`).
- Root `LifeManager` L6350: `exportBackup` L6863–6884 (`Blob` → `createObjectURL` → `<a download>` → revoke after 1 s → toast), `ScheduleTab` render L6987–6993, modal dispatch L7012–7086 (19 types; `profile` last).
- Imports L1–5 (no new icon is needed: the button is text-only, like the backup buttons).

Harness anchors: `tools/e2e/run.js` (`h` object L326, `closeModal`, `clickInModalExact`, `modalError` reads the **first** `text-rose-400` element in the top overlay), `tools/e2e/flow.js` chain L271–278 (`flow2 → flow3 → flow5 → flow7 → flow8 → flow4 → flow6`, then demo + reset), `tools/e2e/flow6.js` backup-export interception L107–132, `tools/e2e/flow7.js` (leaves `주간 스터디` weekly 20:00 with tomorrow skipped, `원서 접수 마감` ticked on +3, `서류 제출 마감` today, `면접 일정 확인` untimed), `tools/e2e/flow5.js` (open once tasks `저녁 요가 30분` +3 and `밀린 독서 30분` −1), `tools/e2e/flow.js` (profile `E2E테스터` / `E2E닉` / `1998-05-14` / `e2e@example.com` / `010-1234-5678` / `E2E대학교` / `E2E전장`), `tools/e2e/flow8.js` (deals, rates). Last verify: `tools/e2e/out/verify-result.json` 09:11 today — **149 steps, 0 failed, 0 console errors**. `tools/harness/smoke-logic.js` (79 lines), `tools/harness/lib/source.js` `grabBlock` L25–39 (extracts top-level `const` blocks closed by a column-0 `};`), `tools/harness/finish-check.js` duplicate detector L72–131 (normalised 6-line window, ≥ 4 logic lines, scans `src/`, `tools/e2e`, `tools/harness`), `tools/harness/lang-check.js` (Hangul flagged in comments, and in `tools/e2e` step names / `Error` / `errors.push` / log strings), `tools/harness/gen-screenshots.js` (`calendar.png` = `일정` tab with `달력` clicked by exact label).

Concurrent work: when this plan was written, `index.html`, `src/index.css` and `tools/e2e/flow.js` carried uncommitted edits from another process (dark `color-scheme`, input text colour, and extra assertions inside the existing step `profile modal — opens from the home card and lists the CV` — no new step). Do not revert them and do not fold them into this plan's commit unless the user says so; re-anchor line numbers after they land.

Docs read: `AGENTS.md` §3–§7, `docs/PLANS.md`, `docs/design-docs/core-beliefs.md`, `ARCHITECTURE.md`, `docs/FRONTEND.md`, `docs/DESIGN.md`, `docs/product-specs/schedule.md`, `install-and-backup.md`, `growth.md`, `docs/SECURITY.md`, `docs/PRODUCT_SENSE.md`, `docs/RELIABILITY.md`, `docs/QUALITY_SCORE.md`, `docs/design-docs/decision-log.md`, `demo-data.md`, `information-architecture.md`, `tools/e2e/README.md`, `docs/exec-plans/tech-debt-tracker.md`, `backlog.md`, and the completed plan `2026-09-13-cv-profile.md` for house style.

### Rules
| Rule | Touch |
|---|---|
| [7](../../design-docs/core-beliefs.md#rule-7) | The file is built in memory and handed to the browser as a `blob:` download under a user tap. No `fetch`, no XHR, no push, no share API, no service-worker change, no AI. |
| [9](../../design-docs/core-beliefs.md#rule-9) | Everything in the file is derived at export time from records; the sheet's time and range are component state; no occurrence list, preview, stamp or preference reaches the save. E2E proves the save is byte-identical after an export. |
| [13](../../design-docs/core-beliefs.md#rule-13) | Every string is a fact. The snapshot limitation is stated in the sheet and inside every calendar entry, never softened; skipped overdue items are counted, not silently dropped; event entries carry `목표 기여 없음`; no progress or pace number is frozen into the file. |
| [18](../../design-docs/core-beliefs.md#rule-18), [19](../../design-docs/core-beliefs.md#rule-19) | The export reads tasks, goals and events and creates none; no task path, no KR bridge, no completion. |
| [12](../../design-docs/core-beliefs.md#rule-12) | **Not touched**: nothing is stored, so there is no `if (s.v < 22)` block and no `v` bump. Only the `@schema` JSDoc's derived-values sentence gains `buildIcs` (a comment; field lines and `v: 21` stay byte-identical). |
| [1](../../design-docs/core-beliefs.md#rule-1), [8](../../design-docs/core-beliefs.md#rule-8), [10](../../design-docs/core-beliefs.md#rule-10), [16](../../design-docs/core-beliefs.md#rule-16) | Boundaries confirmed untouched: no payout, no metric, no evidence gate, no photo in the file. |

## Design

### What goes into the file, per source
`today … end` is the window, `end = shiftDay(today, days − 1)` — the same semantics as `upcomingEvents(state, today, days)`.

| Source | In the file? | Shape | Why |
|---|---|---|---|
| `events[]`, one-off | yes, when `today ≤ date ≤ end` and the date is not in `doneDates` | one `VEVENT`, UID `event-{id}@life-manager` | the user set the date. A ticked occurrence is left out exactly as `todoOf` leaves it out: a reminder for something already marked done is a false prompt. |
| `events[]`, `daily` / `weekly` / `monthly` with day-of-month ≤ 28 | yes, when at least one occurrence in the window is not ticked | one `VEVENT` with `RRULE` + `EXDATE` (below) | RFC 5545 `FREQ=DAILY` / `WEEKLY` / `MONTHLY` generates exactly the dates `occurrencesOf` generates for these cases. |
| `events[]`, `monthly` with day-of-month 29–31 | yes | **one `VEVENT` per included occurrence**, UID `event-{id}-{YYYYMMDD}@life-manager`, no `RRULE` | see "Monthly clamp". At most 12 entries per such event over `1년`. |
| `마감` kind | all-day (`DTSTART;VALUE=DATE`); a stored time goes into the summary as `마감 {HH:MM} · {title}` | | the app treats a deadline as a date (its row leads with a D-day badge); the time is kept as text rather than dropped. |
| `약속` with a time | timed floating `DTSTART`, `DTEND` = start + `ICS_APPT_MINUTES` (60) | alarm `-PT1H` | the app stores no end time; RFC 5545 forbids `DTEND = DTSTART`, and a zero-length event renders unreliably, so the file uses a nominal 60-minute block and the docs say so. |
| `약속` without a time | all-day | alarm at the reminder time on the day | |
| Open `once` tasks with `due` (milestones included) | yes, when `today ≤ due ≤ end` | all-day, UID `task-{id}@life-manager`, summary `실행 기한 · {title}` | a dated commitment the user set. |
| Open `once` tasks with `due < today` | **no — counted** in the sheet (`기한이 지난 실행 {x}건`) | | there is no truthful future date to put them on; the count keeps them visible (Rule 13). |
| Daily tasks (`type: "daily"`) | **one repeating digest**, UID `daily-tasks@life-manager` | timed at the reminder time, `DTEND` + `ICS_DIGEST_MINUTES` (10), `RRULE:FREQ=DAILY;UNTIL={end}T{time}`, alarm `PT0S`; summary `매일 실행 {n}건 · {first title}` (+ ` 외 {n-1}건`), description lists every title | a dozen daily tasks as a dozen repeating alarms at the same minute interrupt twelve times and say nothing one alarm listing them would not. The app already treats every daily task as due today, so one daily prompt matches the model. Timed rather than all-day because calendars that ignore `VALARM` still alert near a timed event's start. |
| Goal deadlines (`status: "active"`, `today ≤ deadline ≤ end`) | yes | all-day, UID `goal-{id}@life-manager`, summary `목표 기한 · {title}` | the user set the date and asked about goals. Progress and pace are **not** written: a number frozen at export is false the next day (Rule 9); the entry says where the live number is. |
| Goal deadlines already past | **no — counted** (`목표 {y}건`) | | same as overdue tasks. |
| Done goals, done tasks | no | | nothing pending. |
| Business (`deals`, `rates`, `folio`) | **no, and no money amount ever** | | not requested (goals and schedule were); a business row's date is derived (the close of an unpaid month, a contract's last month), not one the user chose; and the entries would carry client names and revenue to a synced server — the user agreed to item titles, not to commercial figures. A contract date the user wants reminded belongs in `일정` as a `마감`, which is exported. |
| `profile` / CV (name, nick, birth, e-mail, phone, schools, employers, photo) | **no** | | identifying data has no place in a reminder file. `PRODID`, `X-WR-CALNAME` and the file name are fixed strings; `buildIcs` never reads `state.profile` (smoke proves it with a throwing getter). |
| Event `place` / `note`, journal, reviews, achievements, grades, exams, evidence | no | | beyond "item titles". Including `place` / `note` is a separate user decision (backlog entry below). |

### File format (RFC 5545)
```
BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Life Manager//Calendar Export//KO
CALSCALE:GREGORIAN
X-WR-CALNAME:인생 관리
BEGIN:VEVENT
UID:event-k3x9q2abc1@life-manager
DTSTAMP:20260914T013012Z
SEQUENCE:22036212
DTSTART;VALUE=DATE:20260917
DTEND;VALUE=DATE:20260918
SUMMARY:마감 · 원서 접수 마감
DESCRIPTION:목표 기여 없음\n2026-09-14에 인생 관리에서 내보냈어요. 앱에서 바꾼 내
 용은 다시 내보내야 반영돼요.
TRANSP:TRANSPARENT
BEGIN:VALARM
ACTION:DISPLAY
DESCRIPTION:마감 · 원서 접수 마감
TRIGGER:PT8H
END:VALARM
END:VEVENT
BEGIN:VEVENT
UID:event-w7m2p0def4@life-manager
DTSTAMP:20260914T013012Z
SEQUENCE:22036212
DTSTART:20260922T200000
DTEND:20260922T210000
RRULE:FREQ=WEEKLY;UNTIL=20261208T200000
EXDATE:20260929T200000
SUMMARY:약속 · 주간 스터디
...
END:VEVENT
END:VCALENDAR
```
(The fold in the example is illustrative; the real fold point is computed in bytes.)

- **Line endings**: every content line ends with CRLF, including the last `END:VCALENDAR`. No BOM. No `METHOD` (a plain import is not an iTIP scheduling message).
- **Folding**: a content line longer than 75 octets is split into a first line of ≤ 75 octets and continuation lines of one space + ≤ 74 octets. Octets are **UTF-8 bytes** — a Hangul syllable is 3, an emoji 4 — counted per code point (`for (const ch of s)`), and a split never falls inside a code point or a surrogate pair. Folding by `.length` would overrun the limit threefold on Korean and could cut a character.
- **TEXT escaping** (`SUMMARY`, `DESCRIPTION`, `X-WR-CALNAME`): `\` → `\\` first, then `;` → `\;`, `,` → `\,`, CR / LF / CRLF → `\n`.
- **Time zone: floating local time**, no `VTIMEZONE`, no `TZID`, no `Z` on any user-visible time. The app records wall-clock dates and `HH:MM` with no zone, keeps every date function local and noon-anchored, and never converts to UTC (`toISOString` is banned; TD-04). A floating time means "20:00 wherever the phone is", which is exactly what the app means. A `TZID=Asia/Seoul` + `VTIMEZONE` would assert a zone the app never recorded and needs a hand-maintained zone block; UTC would reintroduce the conversion the codebase bans. Cost, documented: a calendar interprets floating time in its own zone setting.
- **The one UTC value**: `DTSTAMP` (RFC 5545 requires UTC), built by `icsUtcStamp(now)` from `getUTC*` accessors — never displayed.
- **All-day**: `DTSTART;VALUE=DATE:YYYYMMDD` + `DTEND;VALUE=DATE:` next day (exclusive end); `TRANSP:TRANSPARENT`. Alarm `TRIGGER:PT{h}H{m}M` relative to the local start of the day = the reminder time on that day.
- **Repeats**: `DTSTART` = the **first included occurrence** in the window (not `ev.date`, so the file carries no history and no years of `EXDATE`). `UNTIL` = the **last included occurrence** in the window (≤ `min(repeat.until, end)`), in the same value type as `DTSTART` (`YYYYMMDD` for all-day, floating `YYYYMMDDTHHMMSS` for timed) — the instance set equals `UNTIL=repeat.until` when that falls inside the window, and stops the file at the window otherwise. `EXDATE` = dates the bare rule generates between `DTSTART` and `UNTIL` (`occurrencesOf({ ...ev, skip: [] }, first, last)`) minus the included dates — so skipped and ticked dates are excluded uniformly and an `EXDATE` never names a date the rule would not produce.
- **Alarms**: every `VEVENT` has exactly one `VALARM` (`ACTION:DISPLAY`, `DESCRIPTION` = the summary, `TRIGGER`): all-day → reminder time on the day; timed appointment → `-PT1H` (`ICS_APPT_LEAD_MIN = 60`); digest → `PT0S`.
- **Descriptions** (fixed app text plus titles only): events `목표 기여 없음`; tasks `목표 · {goal.title}` or `목표 기여 없음` when the goal is gone; goals `진행률·페이스는 넣지 않아요 — 내보낸 뒤 바로 달라져요.`; digest `- {title}` per daily task; every entry ends with `{today}에 인생 관리에서 내보냈어요. 앱에서 바꾼 내용은 다시 내보내야 반영돼요.` — the snapshot fact travels with the entry, where staleness is actually met.
- **UID / DTSTAMP / SEQUENCE**: UID from the record id only (plus the occurrence date for expanded monthly entries); an id outside `[A-Za-z0-9_-]` is `encodeURIComponent`-encoded (reversible, collision-free). `SEQUENCE = max(0, floor((now − Date.UTC(2026, 0, 1)) / 1000))` — grows with every later export without storing anything; fits a signed 32-bit integer until 2094.
- **Order**: entries sorted by start date, then `event → task → daily → goal`, then summary — deterministic output for identical input and `now`.

### Monthly clamp
`occurrencesOf` places a monthly event dated on the 31st on the **last day of every month** (Feb 28/29, Apr 30, …). `RRULE:FREQ=MONTHLY` does not reproduce this: RFC 5545 §3.3.10 says a rule instance with an invalid date (February 30) MUST be ignored and not counted, so a conforming calendar **drops** the months the app clamps, and a non-conforming one may roll the date into the next month (Mar 2/3) — an occurrence the app does not have. `BYMONTHDAY=-1` fixes day 31 only; `BYMONTHDAY=28,29,30;BYSETPOS=-1` is exact in RFC terms but a calendar that ignores `BYSETPOS` would create three occurrences a month. The export stays truthful by writing, for day-of-month 29–31, the dates `occurrencesOf` itself returns — one `VEVENT` each — so the file carries exactly the app's dates, nothing more and nothing less. Day-of-month ≤ 28 exists in every month, so `RRULE:FREQ=MONTHLY` is exact there.

### What is guaranteed and what depends on the calendar app
| Guaranteed by the file | Depends on the calendar app |
|---|---|
| Stable UIDs across exports; `SEQUENCE` grows with export time; `DTSTAMP` = export instant | Whether re-importing a UID **replaces** the entry, **skips** it, or **adds a duplicate** |
| A `VALARM` on every entry | Whether the app uses it. Google Calendar is reported to ignore `VALARM` on import and apply the destination calendar's default notifications instead — **unverified here; the manual check records it** |
| Exactly the app's dates inside the window, nothing after `end` | Whether floating time is read in the device's zone or the calendar's zone setting |
| No profile, business, place, note or amount data | Whether the phone offers to open a local `.ics` at all (Samsung Calendar is known to import one; the Google Calendar Android app has not historically opened local `.ics` files — then import goes through Google Calendar on the web, Settings → Import & export) |
| — | Nothing ever **removes** an imported entry: a record deleted or completed in the app stays in the calendar, alarm included, until deleted by hand. The format has no plain-import "delete" |

Recommendation written into `install-and-backup.md`: import into a **dedicated calendar** (e.g. one named `인생 관리`, or a device-only calendar where the phone offers one — that also keeps titles off any server), so a fresh export can replace the whole set by emptying that calendar first.

### Where the control lives, and what it asks
- **One entry point: the `일정` tab header**, right-aligned on the `목록` / `달력` chip row, so both views show the same single button. The request is about dates and alarms, and dates live on this tab. **Not** in `데이터 — 백업 · 초기화`: that section holds the recovery file and a destructive reset; a calendar file restores nothing and a backup cannot be imported into a calendar, so placing them side by side invites confusing the two. One button also means one copy set and one E2E path. `growth.md` states this absence in one sentence.
- **The sheet asks two things**: `매일 알림 시각` (`input type="time"`, default `08:00`) and `넣을 기간` (chips `30일` · `90일` · `1년`, default `90일` = `EVENT_HORIZON_DAYS`, the horizon the schedule list already uses). The appointment lead is a fixed, stated 60 minutes — one more control for a value the phone calendar lets the user change per entry is not worth it.
- **Nothing is stored.** Both values are `useState` in the sheet and reset to defaults each time. A remembered preference would be a new `state.ui` key → `if (s.v < 22)` block, `v` bump, a `flow4.js` fixture step and a schema regen — for two taps on an occasional action. If the user later asks for it, that is its own plan.
- **Why `1년` is offered and not more**: `occurrencesOf` stops at `MAX_OCC = 400` steps, so a daily event over a window longer than 400 days would be silently cut. `max(ICS_RANGE_DAYS) = 365 ≤ MAX_OCC`, asserted in smoke. `1년` is also what makes the monthly-clamp E2E step date-independent (a 90-day window starting on 1 July contains no clamped month-end).

### Download mechanism
Reuse `exportBackup`'s path, extracted once into a root-level `downloadBlob(blob, fileName)` both exports call: `URL.createObjectURL(blob)` → a temporary `<a download>` appended, clicked, removed → `URL.revokeObjectURL` after 1 s. Blob type `text/calendar;charset=utf-8`; file name `life-manager-calendar-{today}.ics`.

On the user's device (Android, installed PWA — a Chrome WebAPK): a `blob:` URL is in-memory, so no network request is made and the export works offline; Chrome's download manager writes the file to the device's downloads and posts a download notification with an open action, in a tab or in the standalone app alike. That is the expected behaviour, **not yet verified on this phone** — backlog item 2 (real-device smoke) is still open, so even `백업 내보내기` has never been exercised on the device. Opening the file hands `text/calendar` to whichever installed app registers for it (see the table above). The manual check below records what actually happens.

## Prompt
> Implement the calendar export in `src/LifeManager.jsx`, `tools/harness/smoke-logic.js`, `tools/e2e/run.js`, `tools/e2e/flow6.js`, a new `tools/e2e/flow9.js`, `tools/e2e/flow.js` (one `require` line), then the docs listed under "Docs to sync". This plan's **Design** and **Korean strings** sections are part of this prompt and binding. Work phase by phase; a phase starts only when the previous gate is green. Re-read every anchor from "Context read" before editing it — grep the symbol, do not trust line numbers.
>
> **Language.** Identifiers, comments, E2E step names, error and log strings, and commit messages are English. UI copy and the Korean strings written into the file are copied **verbatim** from "Korean strings" — each is an E2E assertion.
>
> **Frozen.** Do not touch `CERTS`, `EXAMS`, `WEIGHT_MATRIX`, `CERT_W_EXC`, any `migrate` block, `freshState`'s `v`, any `store` call site (the `store.get` loop in `exportBackup` stays exactly as it is — only its download tail moves into `downloadBlob`), any `liferpg-*` key, `occurrencesOf` / `eventsOn` / `upcomingEvents` / `todoOf` (read them, never change them), or `demoState` (it already contains every source the export reads: a timed appointment, an untimed deadline, a weekly repeat, two daily tasks, an overdue once task and three goal deadlines). No `fetch`, no `navigator.share`, no service-worker change, no `toISOString`, no `getTimezoneOffset`, no `TZID` / `VTIMEZONE` ([Rule 7](../../design-docs/core-beliefs.md#rule-7), [Rule 12](../../design-docs/core-beliefs.md#rule-12)). Tailwind v3 core utilities only; 390 px, no horizontal scroll. If `data-guard` denies an edit, stop and report — do not set `HARNESS_DATA_EDIT=1`.
>
> ### Phase 1 — the pure file builder, unit-checked without a browser
> 1. Add a region **between the end of `parseAssistantReply` and the `/* ── State lifecycle ── */` banner**, with its own banner `/* ───────────────────────── Calendar export — the phone-calendar file (RFC 5545) ───────────────────────── */`, so no existing symbol changes section in the generated index. Every declaration is a **top-level `const`**, and every multi-line one closes with `};` at column 0 with no other column-0 `};` inside and no multi-line template literal — `grabBlock` must be able to lift each one for the smoke harness.
> 2. Constants: `ICS_RANGE_DAYS = [30, 90, 365]`, `ICS_REMIND_DEFAULT = "08:00"`, `ICS_APPT_LEAD_MIN = 60`, `ICS_APPT_MINUTES = 60`, `ICS_DIGEST_MINUTES = 10`, `ICS_LINE_OCTETS = 75`, `ICS_SEQ_EPOCH = Date.UTC(2026, 0, 1)`, `ICS_UID_HOST = "life-manager"`. A one-line comment on each states the reason recorded in Design (e.g. the 365 bound vs `MAX_OCC`).
> 3. Helpers, each pure: `icsText(s)` (escaping, backslash first); `icsFold(line)` (UTF-8 byte count per code point, continuation = one space + ≤ 74 octets, returns the pieces joined by CRLF); `icsDate(d)`; `icsLocal(d, hhmm)` → floating `YYYYMMDDTHHMM00`; `icsAddMinutes(d, hhmm, minutes)` → `{ date, time }` with day rollover through `shiftDay` (23:30 + 60 → next day 00:30); `icsUtcStamp(ms)` (the only `getUTC*` use in the file, with a comment citing the RFC's UTC requirement for `DTSTAMP`); `icsDuration(min)` → `PT0S` / `PT8H` / `PT8H30M` / `-PT1H`; `icsUid(kind, id, date)`.
> 4. `calendarExportOf(state, today, days)` → `{ end, entries, counts: { event, task, daily, goal }, skipped: { tasks, goals } }`. It clamps `days` to a member of `ICS_RANGE_DAYS` (else `EVENT_HORIZON_DAYS`), applies the per-source table in Design exactly, and reads **only** `state.events`, `state.tasks`, `state.goals` — never `profile`, `deals`, `rates`, `folio`, `journal`, `reviews`, `ev.place`, `ev.note`, and never `displayName`. Each entry carries `{ uid, source, date, time?, allDay, summary, description, rrule?: { freq, until }, exdates?, alarm }` — descriptors, no RFC text.
> 5. `buildIcs(state, today, { days, remindAt = ICS_REMIND_DEFAULT, now })` → `{ text, entries, counts, skipped, end }`. Pure given `now` (ms). It serialises the entries per "File format"; `text` is a complete `VCALENDAR` even with zero entries.
> 6. **Smoke.** Append section `5) calendar file` to `tools/harness/smoke-logic.js` (English comments; Korean only inside string literals): build the function set with `new Function(names.map((n) => S.grabBlock(n, src).text).join("\n") + "\nreturn { buildIcs, calendarExportOf, icsFold, icsText, icsAddMinutes, ICS_RANGE_DAYS, MAX_OCC, occurrencesOf };")()` over `dstr`, `shiftDay`, `daysBetween`, `EVENT_KIND_LABEL`, `EVENT_HORIZON_DAYS`, `MAX_OCC`, `occurrencesOf` and every `ICS_*` / `ics*` / `calendarExportOf` / `buildIcs` declaration. Checks, each through `ok(cond, msg)`:
>    - (a) `icsText("a\\b;c,d\ne")` escapes to `a\\b\;c\,d\ne`.
>    - (b) a summary of 60 Hangul syllables plus an emoji folds into lines of ≤ 75 bytes (`Buffer.byteLength`), continuation lines start with exactly one space, no line holds a lone surrogate, and unfolding (`/\r\n[ \t]/g` → empty) restores the input exactly.
>    - (c) monthly clamp: `{ date: "2026-01-31", repeat: { freq: "monthly" } }` with `today = "2026-02-01"`, `days = 365` yields `VEVENT` start dates equal to `occurrencesOf(ev, today, end)` (including `20260228`, `20260430`, `20260930`, `20270131`) and no `RRULE` line; a day-15 monthly event yields one `VEVENT` with `RRULE:FREQ=MONTHLY;UNTIL=`.
>    - (d) a weekly timed event with one skipped and one ticked date inside the window has `DTSTART` = its first included occurrence, `UNTIL` = its last, and `EXDATE` listing exactly those two dates; a skipped date before `DTSTART` is not listed.
>    - (e) two builds with different `now` have identical UID lists and non-decreasing `SEQUENCE`.
>    - (f) CRLF only: the text ends with `END:VCALENDAR\r\n`, and contains no LF without CR and no CR without LF.
>    - (g) privacy by construction: a state whose `profile`, `deals`, `rates`, `folio` and `journal` are getters that **throw** builds without error.
>    - (h) `icsAddMinutes("2026-12-31", "23:30", 60)` → `{ date: "2027-01-01", time: "00:30" }`.
>    - (i) `Math.max(...ICS_RANGE_DAYS) <= MAX_OCC`.
>    - (j) a state with no events, tasks or goals → `entries.length === 0`, text still starts `BEGIN:VCALENDAR` and ends `END:VCALENDAR`.
>    - (k) forms: an all-day entry carries `DTSTART;VALUE=DATE:` and a next-day `DTEND;VALUE=DATE:`; `remindAt "08:30"` gives `TRIGGER:PT8H30M`; a timed appointment gives `TRIGGER:-PT1H`; the digest gives `TRIGGER:PT0S`.
>    - (l) every `VEVENT` has exactly one `VALARM` with `ACTION:DISPLAY`, `TRIGGER` and `DESCRIPTION`.
>
> **Gate 1:** `npm run smoke` → `smoke: all checks passed` · `npm run verify -- --smoke` → 149 steps, 0 failed, 0 console errors (nothing user-visible changed) · `npm run finish` → exit 0.
>
> ### Phase 2 — one download path, one interception helper
> 7. In `LifeManager`, add `const downloadBlob = (blob, fileName) => { … }` directly above `exportBackup`, holding the existing create-URL / anchor / click / remove / delayed-revoke sequence; `exportBackup` calls `downloadBlob(new Blob([...], { type: "application/json" }), \`life-manager-backup-${today}.json\`)`. Its image loop, toast and file content are unchanged.
> 8. In `tools/e2e/run.js`, add `captureDownload(trigger, { waitMs = 900 } = {})` and expose it on `h`: it stubs `URL.createObjectURL` (recording `blob.type` and the bytes as base64 plus UTF-8 text via `blob.arrayBuffer()`) and `HTMLAnchorElement.prototype.click` (recording `this.download`, swallowing only anchors with `download`), runs `trigger`, waits, restores **both** originals in `finally`, and returns `{ name, type, text, b64 }` or `null` when no file was offered.
> 9. Rewire `flow6.js`'s `backup export writes the state to a file` to `const dl = await captureDownload(() => clickText("백업 내보내기"))` and keep every assertion and the step name as they are.
>
> **Gate 2:** `npm run verify` → 149 steps, 0 failed, 0 console errors · `npm run finish` → exit 0 (the backup path and its E2E now each exist once).
>
> ### Phase 3 — the sheet, the button, the E2E
> 10. **`CalendarExportModal({ state, today, onClose, onExport })`** in the Schedule region, directly after `EventModal`, under its own banner `/* ── Calendar export sheet — reads records, writes a file, stores nothing ── */`. State: `remindAt` (`ICS_REMIND_DEFAULT`), `days` (`EVENT_HORIZON_DAYS`), `err`. Preview: `const sel = useMemo(() => calendarExportOf(state, today, days), [state, today, days])`. Order inside `<Modal title="휴대폰 캘린더로 내보내기">`: intro line → time row (the `EventModal` label pattern: `w-24 shrink-0` label, `flex-1 w-0` input, `font-mono`) → time rule note → range label + three `Chip`s (label `1년` for 365, `{d}일` otherwise) → preview line 1 and 2 (`text-xs font-mono text-zinc-400`) → skipped line when `x + y > 0` (`text-xs text-zinc-400`) → excluded line → snapshot box (`bg-zinc-950 border border-zinc-800 rounded-xl p-3 space-y-1`, four `<p className="text-xs text-zinc-300">`) → calendar-app notes (three `<p className="text-xs text-zinc-500">`) → how-to line → error (`text-xs text-rose-400`) → button `파일 내보내기` (`w-full py-3 rounded-xl bg-cyan-500 text-zinc-950 font-black text-sm disabled:opacity-30`, `disabled` when `sel.entries.length === 0`) → the empty line in place of the preview lines when there is nothing to include. **The validation error is the only `text-rose-400` element in the sheet** — `modalError()` in `run.js` returns the first one it finds. Submit: `if (!/^\d{2}:\d{2}$/.test(remindAt)) { setErr("알림 시각을 입력해 주세요."); return; }` then `onExport({ days, remindAt })`.
> 11. **`ScheduleTab`**: new prop `onExport`. Wrap the view chips in `<div className="flex items-center justify-between gap-2 mt-2.5">` with the chips in an inner `flex gap-1.5` and a text-only button `캘린더로 내보내기` (`shrink-0 px-3 py-1.5 rounded-xl border border-zinc-700 text-zinc-300 text-xs font-bold`, `onClick={() => onExport()}` — never `onClick={onExport}`). No icon, so no import change.
> 12. **Root**: `exportCalendar({ days, remindAt })` builds with `buildIcs(state, today, { days, remindAt, now: Date.now() })`, returns early when `entries.length === 0`, calls `downloadBlob(new Blob([text], { type: "text/calendar;charset=utf-8" }), \`life-manager-calendar-${today}.ics\`)`, `setModal(null)`, then toasts `캘린더 파일을 내보냈어요 · {n}건 · {end}까지`. It calls no `setState`. Render `onExport={() => setModal({ type: "calExport" })}` on `ScheduleTab` and `{modal?.type === "calExport" && <CalendarExportModal state={state} today={today} onClose={() => setModal(null)} onExport={exportCalendar} />}` after the `profile` modal.
> 13. **`@schema` JSDoc**: append `, and the calendar export file (\`buildIcs\`)` to the derived-values sentence. Nothing else in the block changes.
> 14. **E2E — new `tools/e2e/flow9.js`**, required from `flow.js` between `flow8.js` and `flow4.js` (the save then carries the full CV, deals and every event kind). Local helpers: `readState`, `dstrIn` (in-page, noon-anchored — if `finish` flags either as a duplicate of `flow5.js` / `flow7.js`, lift them into `run.js` the way `rows` / `clickExact` were lifted, never allowlist), `unfold`, `unescapeText`, and `parseIcs(text)` → `VEVENT` blocks of `{ name, params, value }`. Eight steps:
>     1. `calendar export — the sheet states the snapshot limit and stores nothing` — record the state string and the sorted `localStorage` keys; `일정` → `캘린더로 내보내기`; assert the title, all four snapshot sentences (the fourth with `dstrIn(89)`), the three calendar-app sentences, the excluded line and the how-to line verbatim; the time input reads `08:00`; preview line 1 matches `{today} ~ {dstrIn(89)} · 항목 {n}건` with `n > 0`; clear the time, `captureDownload(() => clickInModalExact("파일 내보내기"))` returns `null` and `modalError()` is `알림 시각을 입력해 주세요.`; tap `1년` and preview line 1 ends at `dstrIn(364)`; close; the state string and key list are identical.
>     2. `calendar export — one VEVENT per included record, each with its alarm` — **before this step, inside a flow-level `try { … } finally { restore the recorded state string; await h.reload(); }` that spans steps 2–7**, plant into the save and reload: an event `{ id: "ics-monthly31", title: "월말 정산 확인", kind: "due", date: "2026-01-31", repeat: { freq: "monthly" }, createdAt }`; an event `{ id: "ics-long", title: <the long title below>, kind: "appt", date: dstrIn(2), time: "09:30", place: "E2E장소", note: "E2E메모", createdAt }`; `dstrIn(15)` appended to `skip` of the event titled `주간 스터디`; `deadline: dstrIn(20)` on the goal `하네스 설계 엔지니어 취업`; `deadline: dstrIn(-3)` on one other active goal (throw if the save has none — the step would prove nothing about skipped goals). Open the sheet, set the time to `07:45`, tap `1년`, assert the skipped line equals the counts read from the save, then capture `파일 내보내기`. Assert: name `life-manager-calendar-{today}.ics`; type starts `text/calendar`; text starts `BEGIN:VCALENDAR\r\nVERSION:2.0\r\n` and ends `END:VCALENDAR\r\n`; no bare LF or CR; `X-WR-CALNAME:인생 관리`; no `TZID`, `VTIMEZONE` or `METHOD`. Expected UIDs, computed from the save alone: one-off events with `today ≤ date ≤ end` and the date not ticked; `event-ics-monthly31-{YYYYMMDD}` per month-end in the window (computed in page with `new Date(y, m + 1, 0, 12)`); `event-{id}` for `주간 스터디`; throw on any other repeating event (unhandled fixture); `task-{id}` for open once tasks with `today ≤ due ≤ end`; `daily-tasks` when any daily task exists; `goal-{id}` for active goals with `today ≤ deadline ≤ end`. The file's UID set equals it both ways, with no duplicate. Every `VEVENT` has one `VALARM` (`ACTION:DISPLAY`, `TRIGGER`, `DESCRIPTION`), a `DTSTAMP` matching `^\d{8}T\d{6}Z$` and an integer `SEQUENCE`. Forms: `서류 제출 마감` → `DTSTART;VALUE=DATE:{today}` and `TRIGGER:PT7H45M`; `ics-long` → `DTSTART:{+2}T093000`, `DTEND:{+2}T103000`, `TRIGGER:-PT1H`; digest → `DTSTART:{today}T074500`, `RRULE:FREQ=DAILY;UNTIL={end}T074500`, `TRIGGER:PT0S`, and its unfolded description contains every daily-task title; `목표 기한 · 하네스 설계 엔지니어 취업` present; `원서 접수 마감` (ticked) and the past-deadline goal absent. The toast reads `캘린더 파일을 내보냈어요 · {VEVENT count}건 · {end}까지`. The state string after export equals the planted one (the export created and stored nothing).
>     3. `calendar export — a weekly repeat carries its RRULE, UNTIL and cancelled date` — the `주간 스터디` entry has `DTSTART:{+8}T200000`, `RRULE:FREQ=WEEKLY;UNTIL={last}T200000` where `last` is the last `+8 + 7k` ≤ `end`, `EXDATE` containing `{+15}T200000` and not `{+1}`.
>     4. `calendar export — a monthly event on the 31st lists the app's own dates instead of a rule` — the `event-ics-monthly31-*` entries' start dates equal the computed month-ends exactly, at least one of them is before the 31st (non-vacuous), and none carries `RRULE`.
>     5. `calendar export — lines fold at 75 octets and a Korean title unfolds to the original` — from `Buffer.from(dl.b64, "base64")` split on CRLF bytes: every segment ≤ 75 bytes and decodes with `new TextDecoder("utf-8", { fatal: true })`; the `ics-long` summary spans ≥ 2 physical lines; unfolded and unescaped it equals `약속 · ` + the planted title exactly; its escaped form contains `\,`, `\;` and `\\`.
>     6. `calendar export — a second export keeps every UID` — export again with the same options; the UID multiset and `VEVENT` count are identical and every `SEQUENCE` is ≥ its first-export value.
>     7. `calendar export — no profile, contact or business field is in the file` — read `name`, `nick`, `birth`, `email`, `phone`, every school and employer from the save and throw if any is empty (vacuous); none occurs anywhere in the text, `birth` also without dashes; every deal `client` / `title`, rate `name`, portfolio `title`, deal `monthly` / `costMonthly` amount, `E2E장소`, `E2E메모` and the journal text are absent from every unfolded `SUMMARY` / `DESCRIPTION` value (amounts are checked in text values only — a `SEQUENCE` number could contain the digits by chance).
>     8. `calendar export — with nothing to include the sheet says so and writes no file` — inside its own `try / finally` (restore + reload), plant `events: []`, `tasks: []`, `goals: []`, reload, open the sheet: the empty line with today and `dstrIn(89)` is shown, `파일 내보내기` is `disabled`, and `captureDownload` returns `null`.
>
>     The long title, planted verbatim: `전기기사 실기 원서 접수 마감, 수험표 출력; 사진 규격 확인 \ 결제 영수증 보관 📌 오후 6시 전까지 끝내기`.
> 15. `npm run build:demo && node tools/harness/gen-screenshots.js` — the `일정` header gained a button, so the committed `public/screenshots/calendar.png` is stale; commit the regenerated file with this change.
>
> **Gate 3:** `npm run verify -- --smoke` → **157 steps** (149 + 8), 0 failed, 0 console errors, `smoke: all checks passed` — report the number `verify` prints; if the baseline moved because of concurrent work, the delta must still be +8 · manual 390 px check (Chrome device toolbar: the `일정` header in `목록` and `달력`, the sheet at `1년` with the skipped line and both note blocks — no horizontal scroll, no clipped time input) · `npm run finish` → exit 0.
>
> ### Phase 4 — docs and the device check
> 16. Hand over to docs-syncer with "Docs to sync". Then `npm run docs:gen && npm run docs:check`.
> 17. Run the manual Android check under "Verification" once the build is on the phone, and record the result, or record it as pending, in `docs/product-specs/install-and-backup.md` and backlog item 2. It cannot be automated.
>
> **Gate 4:** `npm run docs:check` → exit 0 · `npm run finish` → exit 0 · the device check recorded (done or pending, never assumed) · plan moved to `docs/exec-plans/completed/`.
>
> ### Acceptance criteria (observable)
> 1. The `일정` tab shows exactly one `캘린더로 내보내기` button in both views; `데이터 — 백업 · 초기화` is unchanged.
> 2. The sheet states the four snapshot sentences verbatim before anything is exported.
> 3. Opening the sheet, changing its options and exporting leave `liferpg-state-v1` byte-identical and add no `localStorage` key.
> 4. The downloaded file is `life-manager-calendar-{today}.ics`, type `text/calendar`, CRLF throughout, every line ≤ 75 UTF-8 bytes, and a folded Korean title unfolds to the stored title exactly.
> 5. Every included record has exactly one `VEVENT` with a `VALARM` — except a monthly event on day 29–31, which has one per app occurrence and no `RRULE`.
> 6. A repeating event carries `RRULE` with `UNTIL` and its cancelled dates as `EXDATE`; a ticked one-off is absent.
> 7. Two exports produce the same UIDs.
> 8. No profile field, business field, amount, place or note appears in the file.
> 9. With nothing to include, the button is disabled and no file is offered.
> 10. `npm run verify -- --smoke` reports 157 steps, 0 failed, 0 console errors; `npm run finish` and `npm run docs:check` exit 0.
>
> ### Finish protocol
> cleanup (`npm run finish` exit 0; any intentional finding goes to `tools/harness/finish-allowlist.json` with a reason, mirrored in `docs/exec-plans/tech-debt-tracker.md` — none is expected) → verifier (`npm run verify -- --smoke`) → docs-syncer (`npm run docs:gen`, `npm run docs:check`, move this plan to `completed/`) → report: what changed, commands and results, findings, the device-check status, the proposed commit message. Commit only at a gate the user approved.

## Korean strings
Every string below is new; each is an E2E selector or assertion. Copy verbatim.

### `ScheduleTab`
| Where | String |
|---|---|
| header button | `캘린더로 내보내기` |

### `CalendarExportModal`
| Where | String |
|---|---|
| modal title | `휴대폰 캘린더로 내보내기` |
| intro | `이 앱은 알림을 보내지 않아요. 내보낸 파일을 휴대폰 캘린더 앱에서 가져오면 캘린더 앱이 알림을 울려요.` |
| time label | `매일 알림 시각` |
| time rule note | `마감·실행 기한·목표 기한·시간 없는 약속과 매일 실행 목록은 이 시각에 알려요. 시간이 있는 약속은 시작 1시간 전에 알려요.` |
| range label | `넣을 기간` |
| range chips | `30일` · `90일` · `1년` |
| preview line 1 (mono) | `{today} ~ {end} · 항목 {n}건` |
| preview line 2 (mono) | `일정 {a} · 실행 기한 {b} · 매일 실행 {c} · 목표 기한 {d}` |
| skipped line (only when `x + y > 0`) | `기한이 지난 실행 {x}건 · 목표 {y}건은 날짜가 지나 넣지 않아요.` |
| excluded line | `넣지 않는 것: 이름·생년월일·연락처·학력·경력, 사업 기록과 금액, 일정의 장소·메모.` |
| snapshot 1 | `내보낸 순간의 기록만 들어가요. 앱에서 추가·수정·완료·삭제해도 휴대폰 캘린더는 바뀌지 않아요 — 바뀐 내용은 다시 내보내야 들어가요.` |
| snapshot 2 | `앱에서 완료해도 캘린더의 알림은 꺼지지 않아요.` |
| snapshot 3 | `매일 알림에는 내보낼 때의 매일 실행 목록이 그대로 남아요.` |
| snapshot 4 | `{end} 뒤로는 알림이 없어요.` |
| calendar-app note 1 | `다시 가져올 때 같은 항목을 바꿔 넣을지 하나 더 만들지는 캘린더 앱마다 달라요.` |
| calendar-app note 2 | `파일에 적힌 알림 대신 캘린더 앱의 기본 알림을 쓰는 앱도 있어요.` |
| calendar-app note 3 | `구글 계정 캘린더로 가져오면 제목이 구글 서버에 저장돼요.` |
| how-to | `파일은 브라우저의 다운로드로 저장돼요. 휴대폰 캘린더 앱에서 이 파일을 열어 가져와요.` |
| button | `파일 내보내기` |
| validation | `알림 시각을 입력해 주세요.` |
| empty state (replaces the preview lines) | `넣을 항목이 없어요 — {today} ~ {end}에 일정·실행 기한·매일 실행·목표 기한이 없어요.` |
| toast after export | `캘린더 파일을 내보냈어요 · {n}건 · {end}까지` |

### Inside the file
| Where | String |
|---|---|
| `X-WR-CALNAME` | `인생 관리` |
| summary, appointment | `약속 · {title}` |
| summary, deadline | `마감 · {title}` / `마감 {HH:MM} · {title}` |
| summary, dated task | `실행 기한 · {title}` |
| summary, goal deadline | `목표 기한 · {title}` |
| summary, daily digest | `매일 실행 {n}건 · {first title}` plus ` 외 {n-1}건` when `n > 1` |
| description, event | `목표 기여 없음` |
| description, task | `목표 · {goal.title}` / `목표 기여 없음` |
| description, goal | `진행률·페이스는 넣지 않아요 — 내보낸 뒤 바로 달라져요.` |
| description, digest line | `- {title}` |
| description, last line of every entry | `{today}에 인생 관리에서 내보냈어요. 앱에서 바꾼 내용은 다시 내보내야 반영돼요.` |

Changed or removed: none.

## Steps
1. Phase 1 — calendar-export region (constants, `ics*` helpers, `calendarExportOf`, `buildIcs`); `smoke-logic.js` section 5. Gate 1 (`--smoke`).
2. Phase 2 — root `downloadBlob` shared by `exportBackup`; `captureDownload` on `h`; `flow6.js` rewired. Gate 2.
3. Phase 3 — `CalendarExportModal`, `ScheduleTab` button, `exportCalendar`, `calExport` modal type (20th), `@schema` derived sentence, `flow9.js` (8 steps) chained in `flow.js`, screenshots regenerated. Gate 3 (`--smoke`, 157 steps, 390 px).
4. Phase 4 — docs-syncer, manual Android check recorded, plan to `completed/`. Gate 4.

## Verification
- Gates 1 and 3: `npm run verify -- --smoke` — `--smoke` **is required**, because the `buildIcs` unit checks live in `smoke-logic.js`; 0 failed, 0 console errors. Gate 2: `npm run verify`.
- `npm run finish` → exit 0 at every gate; `npm run docs:gen && npm run docs:check` → exit 0 at Gate 4.
- E2E count: 149 today → **157** (+8, all in `tools/e2e/flow9.js`). Report what `verify` prints.
- Manual, Gate 3: 390 px layout check (see Gate 3).
- **Manual, Gate 4 — Android device check (cannot be automated).** Puppeteer drives desktop Chrome; the harness has no Android device, no calendar app, and no way to observe an OS alarm, and alarm delivery depends on the phone's calendar app and notification settings. The installed app loads the deployed build, and deploying requires a commit and push at a user-approved gate; before that, `npx vite preview --host` opened in the phone's Chrome over the local network covers the file, import and alarm half (not the installed-app download path, and without a service worker). Steps:
  1. In the installed app: `일정` → `캘린더로 내보내기`; set the time 3–5 minutes ahead; `30일`; `파일 내보내기`. Record where the file went (notification text, folder).
  2. Open it from the notification or the Files app. Record which apps are offered (none / Samsung Calendar / Google Calendar / other).
  3. Import into a dedicated or device-only calendar if offered. Record the destination.
  4. Confirm: today's digest at the chosen time, an all-day deadline, a timed appointment, a weekly series with its cancelled date missing.
  5. Swipe the app away and lock the phone. At the chosen time, record whether an alarm fired, and whether at the file's time (`VALARM` honoured) or at the calendar's default notification time.
  6. Export again unchanged and re-import. Record: replaced, skipped, or duplicated.
  7. Write the results, dated, with device model, Android version and calendar app, into `install-and-backup.md`; if the check could not run, write `pending` there and in backlog item 2 — never assume it passed.

## Cleanup checklist
- [ ] `npm run finish` exit 0 (unused symbols/imports, duplicates, residue, language)
- [ ] the create-URL / anchor / revoke sequence exists once in `src/` (`downloadBlob`), and the anchor-click stub exists once in `tools/e2e` (`captureDownload`)
- [ ] the calendar-export region never references `profile`, `displayName`, `deals`, `rates`, `folio`, `journal`, `reviews`, `place` or `note` (grep the region)
- [ ] no `toISOString`, `getTimezoneOffset`, `TZID`, `VTIMEZONE` or `METHOD` in `src/`; `getUTC` appears only inside `icsUtcStamp`
- [ ] no new `state.ui` key, no `v` change, no `migrate` edit, no `store` call site added or changed; `demoState` untouched
- [ ] every `ICS_*` constant and `ics*` helper is referenced, and the smoke pick list names exactly that set
- [ ] no new lucide import
- [ ] allowlist additions (with reason) mirrored in `tech-debt-tracker.md` — none expected
- [ ] the concurrent `index.html` / `src/index.css` / `tools/e2e/flow.js` edits are neither reverted nor folded into this commit

## Docs to sync
| Doc | Change |
|---|---|
| `docs/product-specs/schedule.md` | Header button on the chip row (both views); new section `CalendarExportModal` (fields, defaults, preview, skipped/excluded lines, the snapshot and calendar-app notes, validation, empty state, toast); the per-source table; the root handler row `exportCalendar`; "Occurrences" gains the export as a fourth reader of `occurrencesOf`; "What an event never does" gains "an export reads events and writes none". |
| **new** `docs/design-docs/calendar-export.md` (listed in `docs/design-docs/index.md`) | The RFC 5545 decisions: floating time vs `VTIMEZONE`, byte-counted folding, escaping, `DTSTAMP` as the one UTC value, `UID` / `SEQUENCE`, the monthly-clamp expansion, the daily digest, alarm triggers, the nominal appointment length, the 365 ≤ `MAX_OCC` bound, and the guaranteed-vs-app-dependent table. |
| `docs/product-specs/install-and-backup.md` | New section on the calendar file: the download on Android (expected vs verified), opening and importing, the dedicated-calendar recommendation, what never syncs back, and the dated device-check record. |
| `docs/product-specs/growth.md` | One sentence in the data section: the calendar file is exported from `일정`, not here, and why. |
| `docs/SECURITY.md` | New subsection "The calendar file": it carries item titles (events, dated tasks, daily tasks, goal deadlines, goal titles in task descriptions) and dates out of the app sandbox into whatever calendar the user imports it into — a synced account (e.g. Google) stores them on that provider's servers, outside this threat model, at the user's action; what it never carries (profile/CV, business records and amounts, place, note, journal, evidence, grades, progress); the app still makes no network call. "Data in transit" gains one sentence pointing to it. |
| `docs/PRODUCT_SENSE.md` | Non-goals: the app sends no notifications — there is no push server and no local-scheduling browser API; the only reminder path is a calendar file the user exports, whose alarms the phone's calendar raises at times the user chose (facts only, no streak guilt). |
| `docs/design-docs/decision-log.md` | 2026-09-14 entry: why no in-app notification; the `.ics` snapshot; titles included by the user's decision; business, CV, place and note excluded; one digest for daily tasks; floating time; monthly clamp expanded; nothing stored (no v22); E2E 149 → 157. |
| `ARCHITECTURE.md` | New region row "Calendar export" (anchor `const buildIcs =`); Schedule row gains `CalendarExportModal`; App root handlers gain `downloadBlob`, `exportCalendar`; status line: E2E 157 steps; file line count. |
| `docs/design-docs/information-architecture.md` | `modal.type` 19 → 20 values (`calExport`, from the `일정` header). |
| `docs/product-specs/index.md` | Modal list gains `CalendarExportModal`; the schedule row mentions the export. |
| `docs/RELIABILITY.md` | `run.js` helpers gain `captureDownload`; new `flow9.js` row; `flow6.js` row notes the shared helper; `--smoke` description gains the calendar-file checks; step count 157; "Known limits" gains the snapshot limitation and the app-dependent import behaviour. |
| `tools/e2e/README.md` | `node run.js --tag run    # 157-step scenario`; `flow9.js` row. |
| `docs/QUALITY_SCORE.md` | Rule 9 row: `buildIcs` — smoke (throwing-getter state) and E2E (byte-identical save after export). |
| `docs/design-docs/demo-data.md` | One sentence: the demo already exercises every export source, including the overdue once task the sheet reports as skipped; no demo change. |
| `docs/exec-plans/tech-debt-tracker.md` | **TD-38** (S3, calendar export, accepted): a calendar file is a snapshot — edits, completions and deletions never reach an imported calendar, completed items keep alarming, the digest text is frozen, and re-import dedupe / `VALARM` / floating-time handling depend on the calendar app; inherent to a file export without a server, recorded so no later plan promises live sync. |
| `docs/exec-plans/backlog.md` | Item 2 (real-device smoke) gains the calendar import and alarm check; "Smaller items" gains "Calendar export: include event place and note — needs the user's decision, since it sends more text to a synced calendar". |
| `docs/generated/*` | `npm run docs:gen` (symbol index gains the new symbols; `db-schema.md` picks up the derived-values sentence). Never hand-edited. |

## Proposed commit
`feat(schedule): export dates to the phone calendar as an .ics snapshot with alarms`
