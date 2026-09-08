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

## `buildBriefing(state, today)`
Returns `{ counts, sections }`. `counts` is `{ overdue, dueToday, dailyOpen, behind }` for the home card. Each section is `{ key, title, items }` and each item `{ kind, severity 3 | 2 | 1, text, action? }`, capped at five items.

| Section | Rule | Severity |
|---|---|---|
| `today` | overdue → `{title} — 기한 {due} 지남 ({D+n})`; due today → `{title} — 오늘 기한`; open daily → `{title} — 매일 · 미완료` | 3 / 3 / 1 |
| `streak` | `lastActive === today` → recorded; `=== today − 1` → the streak breaks unless something is completed today; `=== today − 2` with a shield left → completing today spends one 보호권 (streak shield); otherwise the next completion resets the streak to 1. Mirrors what `completeTask` actually does | 1 / 3 / 3 / 2 |
| `goals` | every active goal, nearest deadline first: `{title} — {D-day} · 진행 {n}% · {pace}`. Severity 3 when `paceOf.gap <= −5`, when the deadline is within 7 days and progress is below 100 %, or when it has passed; those cases append the unmet KRs via `krRemainText` (at most two) | 3 / 1 |
| `metrics` | check-in absent or `lastCheckin` at least 7 days old; 영역 (areas) with no achievement in 30 days (role-model targets first, at most 3); goals whose activity kind has no completion in 7 days (at most 3) | 2 |
| `next` | no role model → say so; no gaps → `모든 요구 영역 충족 · 근접도 {n}%`; otherwise the first gap and its top recommendation from `roleRecommendations` | 2 / 1 / 2 |
| `review` | no review whose `weekOf` is this Monday → `이번 주 리뷰 없음 (마지막 {date})` | 2 / 1 |
| `journal` | today's entry length, and the date of a stored assistant reply | 1 |

Thresholds are named constants: `CHECKIN_STALE_DAYS` 7, `AREA_STALE_DAYS` 30, `ACTIVITY_GAP_DAYS` 7, `CAP` 5.

## `roleRecommendations(state)`
Extracted from `RoleAdviceModal` so the briefing and the direction-advice screen compute the same thing. Returns `{ rg, gaps }` where each gap carries the area, the grades, the category hints (`areaCatHints`), up to four certification recommendations sorted by job-fit multiplier then ascending difficulty, and up to three next exam bands. The tiering and payout maths are unchanged ([Rule 14](core-beliefs.md#rule-14), [Rule 15](core-beliefs.md#rule-15)).

## What the assistant never does
It reads. It does not complete tasks, promote areas, submit evidence, or change metrics, payouts, D values, or grades. Tapping a briefing line routes into the normal path — `tryComplete` for a task, a tab switch, or an existing modal — so every gate still applies.
