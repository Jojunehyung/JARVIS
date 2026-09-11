# Daily assistant — agenda and briefing rules
<!-- src: SPEC-5 -->

The assistant is a pure function of the saved state. `agendaOf` buckets open 실행 (tasks) by date and `buildBriefing` turns the state into an ordered list of factual lines; neither stores anything ([Rule 9](core-beliefs.md#rule-9)), and no line softens a number ([Rule 13](core-beliefs.md#rule-13)). The screens that render them are in [../product-specs/daily-briefing.md](../product-specs/daily-briefing.md).

## Dates
```js
daysBetween(a, b) = whole days from a to b, both "YYYY-MM-DD", anchored at noon (no DST drift)
mondayOf(date)    = the Monday of that date's week
lastDoneDate(q)   = daily → last of doneDates · once → doneAt · otherwise null
doneTodayCount(state, today)
```

## `agendaOf(state, today)`
Open tasks are `daily` tasks not completed today plus `once` tasks that are not done. They fall into five disjoint buckets, and `all` is their concatenation in this order:

| Bucket | Rule |
|---|---|
| `overdue` | `once` with `due < today` |
| `dueToday` | `once` with `due === today` |
| `daily` | `type === "daily"` |
| `week` | `once` with `today < due <= mondayOf(today) + 6` |
| `later` | every remaining open task (undated, or due after this week) |

Events are not tasks and are not in these buckets. They are expanded by three pure helpers next to `agendaOf`, which the 일정 tab, the briefing and the packet all read ([../product-specs/schedule.md](../product-specs/schedule.md)):

| Helper | Returns |
|---|---|
| `occurrencesOf(ev, from, to)` | the dates `ev` falls on inside the window — no `repeat` is the single date, `daily` every day, `weekly` the weekday of `date`, `monthly` its day of month clamped to the month length; stops at `repeat.until`, drops `skip` dates, never iterates past `MAX_OCC` 400 |
| `eventsOn(state, date)` | `{ ev, date, done }` for that date, `마감` first, then `약속` by time with untimed last, ties by title |
| `upcomingEvents(state, from, days)` | the same rows flattened date-ascending over `from … from + days − 1` (`days` defaults to `EVENT_HORIZON_DAYS` 90) |

Windows are named constants: `EVENT_SOON_DAYS` 3 (an imminent deadline), `EVENT_HORIZON_DAYS` 90 (how far repeats are expanded), `EVENT_PAST_DAYS` 30 (how long a missed deadline stays listed).

## `buildBriefing(state, today)`
Returns `{ counts, sections }`. `counts` is `{ overdue, dueToday, dailyOpen, behind, events, dueSoon }` for the home card — `events` is today's occurrence count and `dueSoon` the `마감` occurrences inside `EVENT_SOON_DAYS`, today included. Each section is `{ key, title, items }` and each item `{ kind, severity 3 | 2 | 1, text, action? }`, capped at five items.

| Section | Rule | Severity |
|---|---|---|
| `today` | overdue → `{title} — 기한 {due} 지남 ({D+n})`; due today → `{title} — 오늘 기한`; open daily → `{title} — 매일 · 미완료` | 3 / 3 / 1 |
| `events` | today's schedule and the deadlines around it, in this order: today's `마감` → `{title} — 오늘 마감`; a `마감` already past → `{title} — 마감 {date} 지남 (D+{n})`; a `마감` inside `EVENT_SOON_DAYS` → `{title} — D-{n} 마감`; today's `약속` → `{title} — {HH:MM} 약속` or `{title} — 시간 미정 · 약속`; `해당 없음` when there is none. Ticked occurrences are left out — the tab keeps them so `완료 취소` stays reachable. Every line carries `action: { type: "schedule" }`, which `closeBriefing` routes to the 일정 tab | 3 / 3 / 2 / 2 / 1 |
| `streak` | `lastActive === today` → recorded; `=== today − 1` → the streak breaks unless something is completed today; `=== today − 2` with a shield left → completing today spends one 보호권 (streak shield); otherwise the next completion resets the streak to 1. Mirrors what `completeTask` actually does | 1 / 3 / 3 / 2 |
| `goals` | every active goal, nearest deadline first: `{title} — {D-day} · 진행 {n}% · {pace}`. Severity 3 when `paceOf.gap <= −5`, when the deadline is within 7 days and progress is below 100 %, or when it has passed; those cases append the unmet KRs via `krRemainText` (at most two) | 3 / 1 |
| `metrics` | check-in absent or `lastCheckin` at least 7 days old; 영역 (areas) with no achievement in 30 days (role-model targets first, at most 3); goals whose activity kind has no completion in 7 days (at most 3) | 2 |
| `next` | no role model → say so; no gaps → `모든 요구 영역 충족 · 근접도 {n}%`; otherwise the first gap and its top recommendation from `roleRecommendations` | 2 / 1 / 2 |
| `review` | no review whose `weekOf` is this Monday → `이번 주 리뷰 없음 (마지막 {date})` | 2 / 1 |
| `journal` | today's entry length, and the date of a stored assistant reply | 1 |

Thresholds are named constants: `CHECKIN_STALE_DAYS` 7, `AREA_STALE_DAYS` 30, `ACTIVITY_GAP_DAYS` 7, `CAP` 5.

## `roleRecommendations(state)`
Extracted from `RoleAdviceModal` so the briefing and the direction-advice screen compute the same thing. Returns `{ rg, gaps }` where each gap carries the area, the grades, the category hints (`areaCatHints`), up to four certification recommendations sorted by job-fit multiplier then ascending difficulty, and up to three next exam bands. The tiering and payout maths are unchanged ([Rule 14](core-beliefs.md#rule-14), [Rule 15](core-beliefs.md#rule-15)).

## The bridge — `buildAssistantPacket(state, today)`
A text packet the user copies into an external chat. It opens with the role and the four rules the assistant must follow (facts and numbers only, `해요체`, no judging scores or difficulty, proposals limited to day-sized tasks under an existing goal, and a closing JSON block), then the data:

| Section | Content | Cap |
|---|---|---|
| `## 오늘 브리핑` | briefing lines of severity 2 and above | 12 |
| `## 목표` | active goals: deadline, D-day, progress, pace, KR remainders | 5 goals × 4 KRs |
| `## 열린 실행` | the agenda in order: goal, title, difficulty, cadence, due | 12 |
| `## 다가오는 일정 (14일)` | `- {date} {HH:MM\|시간 미정} · {약속\|마감} · {title}{ · 반복 {매일\|매주\|매월}}`, date-ascending from `upcomingEvents(state, today, PACKET_EVENT_DAYS)`; the heading and the window read the same constant | 8 |
| `## 최근 일지 (7일)` | journal entries clipped to 200 characters | 7 |
| `## 최근 주간 리뷰` | the newest review | 1 |
| `## 지표·연속` | metrics, last check-in, streak, shields, role-model proximity | 3 lines |

The whole packet is capped at 4,000 characters; journal entries are dropped oldest-first until it fits — the schedule lines are built before that loop, so the cap behaves exactly as before. Photos are never included.

`BridgeModal` always renders the packet in a read-only textarea, which doubles as the fallback when the clipboard is unavailable: `navigator.clipboard.writeText` first, then `select()` + `execCommand("copy")` inside the click gesture, which is what makes the copy work from `file://` where there is no secure context.

## The reply — `parseAssistantReply(text, state)`
Only a fenced ```` ```json ```` block is read, and only `tasks` (at most five) and `note`. Each proposal is validated before it can be imported:

| Field | Rule |
|---|---|
| `title` | trimmed to 60 characters; empty becomes `제목 없음` |
| `goal` | matched against active goal titles exactly, then by substring either way; no match leaves `goalId` null and the row shows a `목표 선택` dropdown ([Rule 18](core-beliefs.md#rule-18)) |
| `diff` | E, D or C — anything else becomes D. C is 60 points, below `EVIDENCE_MIN`, so an import can never bypass the evidence gate |
| `type` | `daily` or `once`, defaulting to `once`; `due` is kept only for a `once` task with a `YYYY-MM-DD` date |
| `kind` | `detectKind(title)` wins over the proposed kind |

A proposal is refused, greyed out with a reason, when the title matches a certification (`certByTitle`), contains an exam family name, or ends in `취득` — those exist only through the KR bridge ([Rule 19](core-beliefs.md#rule-19)) — or when the same title is already open under that goal.

Confirming calls `importTasks`, which prepends plain tasks built exactly like `addQuest` builds them and stores the raw reply on today's journal entry. A reply with no JSON block, or with an empty list, is stored as text only. Re-pasting on the same day overwrites the stored reply; the latest one wins.

## What the assistant never does
It reads. It does not complete tasks, promote areas, submit evidence, or change metrics, payouts, D values, or grades. Tapping a briefing line routes into the normal path — `tryComplete` for a task, a tab switch, or an existing modal — so every gate still applies. It cannot touch the schedule either: `PACKET_HEAD` asks only for tasks and `parseAssistantReply` reads only `tasks`, so a pasted reply can never create, change or tick an event.
