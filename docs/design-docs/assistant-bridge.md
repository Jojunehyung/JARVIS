# Daily assistant — agenda and briefing rules
<!-- src: SPEC-5 -->

The assistant is a pure function of the saved state. `agendaOf` buckets open 실행 (tasks) by date and `buildBriefing` turns the state into an ordered list of factual lines; neither stores anything ([Rule 9](core-beliefs.md#rule-9)), and no line softens a number ([Rule 13](core-beliefs.md#rule-13)). The screens that render them are in [../product-specs/daily-briefing.md](../product-specs/daily-briefing.md).

## Dates
```js
daysBetween(a, b) = whole days from a to b, both "YYYY-MM-DD", anchored at noon (no DST drift)
mondayOf(date)    = the Monday of that date's week
lastDoneDate(q)   = daily → last of doneDates · once → doneAt · otherwise null
```
`doneTodayCount` was deleted 2026-09-15 with its only call site, the home profile card's `오늘 {n}건 완료` line — home is a CV now and states no date-scoped fact ([home.md](../product-specs/home.md)); today's completions are still visible in the `할 일` tab, where a row completed today stays in its own group struck through (since 2026-09-16; the separate `오늘 완료` group was removed), and in the briefing's `연속 기록` line.

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
Returns `{ sections }` (2026-09-15; the `counts` field it used to return — `{ overdue, dueToday, dailyOpen, behind, events, dueSoon, bizMonth, bizUnpaid }` — was dropped along with the home briefing card, its only reader; every count it held is still on screen elsewhere: `실행`'s and `일정`'s own counts lines, and the sections below). Each section is `{ key, title, items }` and each item `{ kind, severity 3 | 2 | 1, text, action? }`, capped at five items (`CAP`).

| Section | Rule | Severity |
|---|---|---|
| `today` | when any work item is carried from an earlier day (`state.work`, undone, dated before today — schema v26), a first line `이월 업무 {n}건 · 최장 {d}일 · 직장 {a} · 사업 {b} · 개인 {c}` (`n` = the carried count, `d` = the largest `daysBetween`, the per-track counts appended v28), `action: { type: "work" }`, severity 3 — a count only, never a title (rule 13); then overdue → `{title} — 기한 {due} 지남 ({D+n})`; due today → `{title} — 오늘 기한`; open daily → `{title} — 매일 · 미완료` | 3 / 3 / 3 / 1 |
| `events` | today's schedule and the deadlines around it, each line prefixed with its own track label and ` · ` (v28), in this order: today's `마감` → `{title} — 오늘 마감`; a `마감` already past → `{title} — 마감 {date} 지남 (D+{n})`; a `마감` inside `EVENT_SOON_DAYS` → `{title} — D-{n} 마감`; today's `약속` → `{title} — {HH:MM} 약속` or `{title} — 시간 미정 · 약속`; `해당 없음` when there is none. Ticked occurrences are left out — the tab keeps them so `완료 취소` stays reachable. Every line carries `action: { type: "schedule" }`, which `closeBriefing` routes to the 일정 tab | 3 / 3 / 2 / 2 / 1 |
| `prep` (`회의 준비`, schema v26) | `오늘 회의 준비 {n}건 · 직장 {a} · 사업 {b} · 개인 {c}` (`n` = `meetingPrepOf` rows dated today, per-track counts v28) with ` · 내일 {m}건` appended only when `m > 0`, `action: { type: "work" }`, severity 2 when any row exists else 1 (stated even at zero — rule 13); when any follow-up across every meeting is `!done && due && due < today`, a second item `후속 기한 지남 {n}건 · 내 담당 {m}건` (`m` = those with `mine`), `action: { type: "meetings" }`, severity 3. Counts only, never a meeting or follow-up's own text | 2 / 1 / 3 |
| `streak` | `lastActive === today` → recorded; `=== today − 1` → the streak breaks unless something is completed today; `=== today − 2` with a shield left → completing today spends one 보호권 (streak shield); otherwise the next completion resets the streak to 1. Mirrors what `completeTask` actually does | 1 / 3 / 3 / 2 |
| `goals` | every active goal, nearest deadline first: `{title} — {D-day} · 진행 {n}% · {pace}`. Severity 3 when `paceOf.gap <= −5`, when the deadline is within 7 days and progress is below 100 %, or when it has passed; those cases append the unmet KRs via `krRemainText` (at most two) | 3 / 1 |
| `biz` | records, never tasks, in order: at most `BIZ_ALERT_MAX` (3) unpaid billed months (`{client} {title} — {month} 입금 미확인 {won}`) — the same constant and the same months the `실행` tab's to-do list names ([../product-specs/tasks.md](../product-specs/tasks.md)); up to `PAYMENT_ALERT_MAX` (3, v28) unpaid lump-sum lines (`{client} {title} — {kind} 입금 예정 {due} · 미확인`, carrying the deal's track); a `won` deal ending within `DEAL_END_SOON` months (`{client} {title} — {month} 종료 · 남은 계약 {won}`); a `quote` older than `QUOTE_STALE_DAYS` days (`{client} {title} — 견적 {n}일 경과 · {won}`); `다음 액션 기한 지난 리드 {n}건` (v28, `n > 0` only, carries `track: "biz"` and `packet: false` — below); up to `NOTICE_ALERT_MAX` (2, v28) open-notice lines (`공고 {title} — 마감 {D-day}`, `packet: false`); up to `ROADMAP_ALERT_MAX` (2, v28) not-done milestone lines (`마일스톤 {title} — {D-day}`, carrying `milestoneTrack`); then always the closing line `이번 달 계약 매출 {won} · 입금 확인 {won} · 남은 계약 {won}`. The closing line is the reason the section exists, so it is built last from at most `CAP − 1` alerts rather than a plain sixth item — a full slate of business alerts (an unpaid month, a payment line, an overdue lead and two near notices) can fill that budget and push an ending contract, a stale quote or a milestone line out of the briefing itself (TD-72's crowding note); the revenue line is never cut. Every line carries `action: { type: "biz" }`, which `closeBriefing` routes to the 사업 tab ([business.md](../product-specs/business.md)) | 3 / 2 / 2 / 1 |
| `areas` | 영역 (areas) with no achievement in 30 days (role-model targets first, at most 3), `action: { type: "home" }` — the area's grade row and its promotion gate live on the CV; goals whose activity kind has no completion in 7 days (at most 3), `action: { type: "goals" }` | 2 |
| `next` | no role model → `롤모델 미설정 — 설정에서 롤모델을 정해요`; a role with no requirement grades → `요구 등급 없음 — 세부 수정에서 정해요`; no gaps → `모든 요구 영역 충족`; otherwise the first gap and its top recommendation from `roleRecommendations` — or, when the gap's area is `사업` and `role.stages` exist (v28), the stage tail instead: see [metrics-and-role-model.md](metrics-and-role-model.md#the-briefings-next-step-tail) — no percentage anywhere in this line since the [Rule 14](core-beliefs.md#rule-14) amendment of 2026-09-18 | 2 / 2 / 1 / 2 |
| `review` | no review whose `weekOf` is this Monday → `이번 주 리뷰 없음 (마지막 {date})` | 2 / 1 |
| `journal` | today's entry length, and the date of a stored assistant reply | 1 |

A tab-switch action is only ever taken when its `type` is in the module-level whitelist `TAB_ACTIONS = ["home",
"goals", "work", "schedule", "meetings", "biz"]` (2026-09-15: `"growth"` replaced by `"home"` when the growth tab
was removed — [home.md](../product-specs/home.md); `"work"` and `"meetings"` added 2026-09-17 for the carried-work
line and the overdue-follow-up line, respectively), checked by `closeBriefing`. An action type outside this list is not a
no-op: `closeBriefing` handles `task` separately, before the list, and opens every other type as the `modal.type`
of the same name that the root renders directly — `bridge`, `journal`, `review` and `role` (`roleAdvice` retired
2026-09-18, second change of the day — every action that used to name it now names `role`, opening the `롤모델`
screen).

Thresholds are named constants: `AREA_STALE_DAYS` 30, `ACTIVITY_GAP_DAYS` 7, `CAP` 5, `QUOTE_STALE_DAYS` 7,
`DEAL_END_SOON` 2 months.

## `roleRecommendations(state)`
Originally extracted from `RoleAdviceModal`; shared, unchanged in its own filtering and payout logic, by the briefing and `RoleGradeSection` (the `롤모델` screen's `영역 등급` section, since 2026-09-18) so the two compute the same thing. Returns `{ areas, gaps }` (renamed from `{ rg, gaps }` 2026-09-18, third role-model change of the day, alongside `roleGap` → `roleAreas` below) where each gap carries the area, the grades, the category hints (`areaCatHints`), up to four certification recommendations sorted by job-fit multiplier then ascending difficulty, and up to three next exam bands. The tiering and payout maths are unchanged ([Rule 14](core-beliefs.md#rule-14), [Rule 15](core-beliefs.md#rule-15)).

The bridge carries **six** packets in total (2026-09-17/18/24): the daily check-in, `오늘 업무 만들기`,
`AI에게 회의 준비 묻기`, the fourth, `주간 회고` (v28), the fifth, `AI에게 판정 묻기` (2026-09-18), and the sixth,
`오늘의 관문 퀴즈` (2026-09-24, the [daily gate](../product-specs/daily-gate.md)), below.

## Tracks — what leaves the device, and the day-job switch (v28; the switch 2026-09-22)

Every project, document, event, work item, meeting and deal carries or derives a `track`
(`work`/`직장`, `biz`/`사업`, `personal`/`개인` — see [meetings.md](../product-specs/meetings.md#tracks-v28)).
Whether a `work`-track record leaves the device through a packet is a settings switch,
`settings.workInAi`, **on by default** (absent reads as `true`; no schema migration — `설정 › AI 요청문 ›
직장 기록을 AI 요청문에 포함`). `packetTracks(state)` is the single helper every packet reads:
`workInAiOf(state) ? TRACKS : PACKET_TRACKS_NO_WORK`, where `TRACKS = ["work", "biz", "personal"]` and
`PACKET_TRACKS_NO_WORK = ["biz", "personal"]`. **With the switch on (the default), a `work`-track record goes
into every packet that would otherwise carry it, exactly like a business or private record; with it off, a
`work`-track record never leaves the device through any of the four packets below** — the day-job track is
still the safe default in either state (a record wrongly left on it is only ever absent, never leaked beyond
what the switch allows), and there is no per-record override — the switch is global
([TD-73](../exec-plans/tech-debt-tracker.md)).

| Packet | Filter |
|---|---|
| Daily check-in (`buildAssistantPacket`) | `briefLines` keeps only briefing items with no `track` or a track in `packetTracks(state)`, and additionally drops any item with `packet: false` (the v28 lead/notice count lines, below); `eventLines` filters by the event's own track; `bizPacketLines` filters deals by `trackOf(d, "biz")` and recomputes its summary line over that filtered list, so the section's totals can never disagree with the lines it names |
| `오늘 업무 만들기` (`buildWorkPacket`) | `meetings` filtered by `packetTracks(state).includes(meetingTrack(state, m))` before the slice; `eventLines` and the work-record section filtered by track; `taskLines` unchanged (a task has no track) |
| `AI에게 회의 준비 묻기` (`buildPrepPacket`) | `docs` filtered by `trackOf(d)`; `dealsOfProject`'s result filtered by `trackOf(d, "biz")`; when the event's own track is outside `packetTracks(state)`, the function returns just the header plus `## 회의` with the single line `- 직장 트랙 일정 — AI 패킷에 실리지 않아요` |
| `주간 회고` (`buildReviewPacket`, v28) | business track only by construction, unaffected by the switch — see below |
| `AI에게 판정 묻기` (`buildRoleVerdictPacket`, 2026-09-18) | record counts computed over `deals`/`milestones` filtered by `packetTracks(state)`; portfolio, leads and notices carry no track ([TD-78](../exec-plans/tech-debt-tracker.md)) and are counted whole — counts only, never a name — see below |
| `오늘의 관문 퀴즈` (`buildQuizPacket`, 2026-09-24) | every section filtered to `packetTracks(state)` — the preparation rows by the event's and the project's track, the work lines by `trackOf(w)`, the schedule lines by `trackOf(o.ev)`, the decision/minutes/training lines by `meetingTrack(state, m)`, the documents by `trackOf(d)` — see below |

Captions state the exclusion in the send pane itself, **only while the switch is off**: `BridgeModal`'s,
`WorkBridgeModal`'s and `QuizModal`'s (2026-09-24) captions each gain the sentence `직장 트랙 기록은 실리지 않아요.`; `PrepBridgeModal`'s gains
`직장 트랙 문서·계약은 실리지 않아요.`; the role-verdict caption's `고객사 이름·직장 트랙 기록은 실리지 않아요`
becomes `고객사 이름은 실리지 않아요` while the switch is on. The `트랙` chip row on every record form
(`TrackRow`) shows `직장 트랙은 AI 패킷에 실리지 않아요.` only while the switch is off; while it is on, the row
carries no caption. The demo build measures the effect directly: with `settings.workInAi` absent (on), the demo
work packet gains the day-job meeting, its work item and its event — 2,650 → 2,925 characters; the demo daily
packet, 2,419 → 2,445 (the extra briefing line pushes `[주간 리뷰]` out at its 12-line cap, [Rule
13](core-beliefs.md#rule-13) — nothing is softened, a line is dropped by the same cap rule that already governed
it). With the switch off, every packet is byte-identical to the build before this switch existed.

## The bridge — `buildAssistantPacket(state, today)`
A text packet the user copies into an external chat. It opens with the role and the four rules the assistant must follow (facts and numbers only, `해요체`, no judging scores or difficulty, proposals limited to day-sized tasks under an existing goal whose title names the activity (`제목에 독서·운동처럼 활동을 그대로 적어요.`) — never a certification, an exam, or a business record — and a closing JSON block whose template no longer offers a `kind` field), then the data:

| Section | Content | Cap |
|---|---|---|
| `## 오늘 브리핑` | briefing lines of severity 2 and above — since schema v26 this includes the `회의 준비` section's counts (`오늘 회의 준비 {n}건`, and, once any follow-up is overdue, `후속 기한 지남 {n}건 · 내 담당 {m}건`) whenever their severity qualifies, and the carried-work line (`이월 업무 {n}건 · 최장 {d}일`) when it does — never a meeting or follow-up title. `briefLines` additionally drops any item with `track` outside `packetTracks(state)` (only the day-job track while the switch above is off) and, since v28, any item flagged `packet: false` — the lead-count and open-notice lines carry that flag so they never reach this packet even though their severity would otherwise qualify (a demo run without the flag pushed `[주간 리뷰] 이번 주 리뷰 없음` out of this cap; the flag is the one-condition fix) | 12 |
| `## 이력` | one line built from `cvSummaryOf(profile, today)` — the same helper the home CV's `학력` / `경력` rows read ([home.md](../product-specs/home.md)), lifted out of this function 2026-09-15 so the two surfaces cannot state a different degree or role: degree + status label (`박사 졸업`, not a bare `박사` — `topEdu` falls back to the most recent entry when nothing is completed, and a bare degree would imply one the user does not hold) + major/field (or `전공 미기재`), then total practice months (`careerMonths`) + the latest role; `학력 미입력` when there is no education entry at all, `경력 없음` when there is no career entry, and `- 없음` for the whole line only when both are absent (`cvSummaryOf(...).any` false). Deliberately excludes `profile.name`, `birth`, `email`, `phone`, the school name and the employer name — a school or an employer identifies a person nearly as well as a name does, and this is the one place data leaves the device by design (see `docs/SECURITY.md`) | 1 |
| `## 목표` | active goals: deadline, D-day, progress, pace, KR remainders | 5 goals × 4 KRs |
| `## 열린 실행` | the agenda in order: goal, title, difficulty, cadence, due | 12 |
| `## 다가오는 일정 (14일)` | `- {date} {HH:MM\|시간 미정} · {약속\|마감} · {title}{ · 반복 {매일\|매주\|매월}}`, date-ascending from `upcomingEvents(state, today, PACKET_EVENT_DAYS)`; the heading and the window read the same constant | 8 |
| `## 사업 (계약·매출)` | the summary line `- 이번 달 계약 {won} · 입금 확인 {won} · 남은 계약 {won} · 견적 대기 {won}`, then (v28) `- 입금 예정 {kind} {due} {client} {title} {won}` per payment line of an allowed deal (` · 입금 확인 {paidAt}` when paid), then `- 미수 {month} {client} {title} {won}` per unpaid billed month, then `- {진행 중\|예정} {client} {title} · {startMonth} ~ {endMonth} · 월 {won}` for `active`/`upcoming` deals — `bizPacketLines(state, today)` (2026-09-17, lifted to module level so the work packet below reuses it), built from the same `bizSummary` the tab and the briefing read, filtered to `packetTracks(state)` deals (v28), before the journal-trim loop below so its cap and behaviour are unaffected. A milestone, a lead and a notice **never** appear here — only the fourth packet (`주간 회고`, below) carries the roadmap, the pipeline and open notices | `PACKET_BIZ_LINES` = 6 |
| `## 최근 일지 (7일)` | journal entries clipped to 200 characters | 7 |
| `## 최근 주간 리뷰` | the newest review | 1 |
| `## 연속·롤모델` | streak, shields, the role-model stage line (`- 롤모델 {name} · 단계 k/n · 조건 c/m`, `- 롤모델 {name} · 단계 없음`, or `- 롤모델 미설정` — no percentage since the [Rule 14](core-beliefs.md#rule-14) amendment of 2026-09-18) | 2 lines |

The whole packet is capped at 4,000 characters; journal entries are dropped oldest-first until it fits — the schedule lines are built before that loop, so the cap behaves exactly as before. Photos are never included.

`BridgeModal` always renders the packet in a read-only textarea, which doubles as the fallback when the clipboard is unavailable: `navigator.clipboard.writeText` first, then `select()` + `execCommand("copy")` inside the click gesture, which is what makes the copy work from `file://` where there is no secure context.

## The reply — `parseAssistantReply(text, state)`
The JSON is read by `replyJson`: a fenced block (```` ```json ```` or untagged) first, then the whole pasted text, then the span from the first `{` to the last `}` — a chat's code-block copy button copies only the inside of the block, and until 2026-09-17 such a paste read as no proposals. Only `tasks` (at most five) and `note`. Each proposal is validated before it can be imported:

| Field | Rule |
|---|---|
| `title` | trimmed to 60 characters; empty becomes `제목 없음` |
| `goal` | matched against active goal titles exactly, then by substring either way; no match leaves `goalId` null and the row shows a `목표 선택` dropdown ([Rule 18](core-beliefs.md#rule-18)) |
| `diff` | E, D or C — anything else becomes D. C is 60 points, below `EVIDENCE_MIN`, so an import can never bypass the evidence gate |
| `type` | `daily` or `once`, defaulting to `once`; `due` is kept only for a `once` task with a `YYYY-MM-DD` date |
| `kind` | `detectKind(title)` only. The reply's own `kind` field is never read (since 2026-09-16): a title that does not name the activity is refused with `활동 유형 없는 실행은 일정 탭에서 관리해요`, whatever kind the reply declares. `importTasks` re-derives it from the title and drops any entry without one, so a caller that skipped the parser cannot import a mislabelled task either |

A proposal is refused, greyed out with a reason, when the title matches a certification (`certByTitle`), contains an exam family name, or ends in `취득` — those exist only through the KR bridge ([Rule 19](core-beliefs.md#rule-19)) — when the same title is already open under that goal, or when it resolves to no `kind` at all (`활동 유형 없는 실행은 일정 탭에서 관리해요`) — a proposal can only carry the same book/fit kinds a goal accepts (Rule 19 amendment).

Confirming calls `importTasks`, which prepends plain tasks built exactly like `addQuest` builds them and stores the raw reply on today's journal entry. A reply with no JSON block, or with an empty list, is stored as text only. Re-pasting on the same day overwrites the stored reply; the latest one wins.

## What the assistant never does
It reads. It does not complete tasks, promote areas, submit evidence, or change metrics, payouts, D values, or grades. Tapping a briefing line routes into the normal path — `tryComplete` for a task, a tab switch, or an existing modal — so every gate still applies. It cannot touch the schedule or the business records either: `PACKET_HEAD` asks only for tasks and `parseAssistantReply` reads only `tasks`, so a pasted reply can never create, change or tick an event, a contract, a rate or a portfolio entry — proven by an E2E step that pastes a reply naming all three business lists and asserts none of them changed. The second bridge, below, cannot create a task, a contract, an event or a meeting either — a reply to it can only propose a work item, and `parseAssistantReply` and this parser never read each other's key.

## The second packet — `오늘 업무 만들기` (`buildWorkPacket` / `parseWorkReply`, 2026-09-17 amendment)

The bridge carries a second, independent packet and parser, added by the [daily-work](../product-specs/daily-work.md) feature and covered by [Rule 7](core-beliefs.md#rule-7)'s 2026-09-17 amendment. It has its own cap, `WORK_PACKET_MAX` (20,000 — it shared the daily packet's `PACKET_MAX` of 4,000 until 2026-09-17, when the user found the minutes cut short), and shares the section-line shape (`packetSection`, lifted to module level so both packets call it) with `buildAssistantPacket`, but is otherwise a separate function with its own head, its own reply key and its own confirm flow (`WorkBridgeModal`, [daily-work.md](../product-specs/daily-work.md)). `bizPacketLines(state, today)` — the contract summary line, the unpaid-month lines and the active/upcoming deal lines — is likewise lifted to module level and shared by both packets; `buildAssistantPacket`'s own text is byte-identical after the extraction.

By the user's own decision, reversing the 2026-09-16 default that the packet never reads a meeting, this packet **does** read `meetings` — summaries, decisions, follow-up items and progress entries — for every meeting except one flagged `aiHidden`, which contributes its date and title only.

| Section | Content | Cap |
|---|---|---|
| `## 이력` | the same `cvSummaryOf` line as the daily packet | 1 |
| `## 목표` | active goals: deadline, D-day, progress, pace, up to 4 KR remainders | 5 goals |
| `## 열린 할 일` | open task rows from `todoOf(state, today)`, in its own group order: `- {group label} · {title} · {goal title \| 목표 없음} · 기한 {due \| 없음}` | `WORK_PACKET_TASKS` (10) |
| `## 다가오는 일정 ({PACKET_EVENT_DAYS}일)` | the same event-line shape as the daily packet | `WORK_PACKET_EVENTS` (8) |
| `## 사업 (계약·매출)` | `bizPacketLines(state, today)` | `PACKET_BIZ_LINES` (6) |
| `## 최근 회의록 ({n}건)` | newest **meeting-kind** records by `meetingOrder` — since 2026-09-22 (same-day follow-up), a [training record](../product-specs/meetings.md#training-records-교육-2026-09-22--reference-only-same-day) never reaches this list at all: `buildWorkPacket` (both full and since-mode, through `workSinceOf`) filters `!isTraining(m)` before building the meeting list, so the assistant never sees one and cannot turn it into a work item. (The `교육 · ` head-line prefix and the `배운 것:`/`핵심 정리:`/`기억할 점:` body labels `meetingPacketLines` knows how to print for a training record are exercised only by the third packet, `AI에게 회의 준비 묻기`, below — never here.) Visible: `- {date} [{project name \| 프로젝트 없음}] {title}` — a project-less urgent memo (2026-09-17, `projectId: null`) prints `[프로젝트 없음]` through the same fallback, unchanged — then what the meeting view states besides the minutes — `  참석: {attendees}` (when recorded), `  일정: {meetingEventText}` (when an event is linked) and `  연결된 할 일: {title} ({매일 · 오늘 }완료\|미완료) · …` for every linked task that still exists (all three added 2026-09-17; until then the packet left them out) — then `  요약:` / `  결정:` lines (each present only when the field is non-empty, newline-joined with `" / "`; a clipped text ends in `…`), then, when the meeting has follow-up items (schema v26), `  후속 {n}건:` followed by one `  - {내 담당\|타인} · {기한 YYYY-MM-DD\|기한 없음} · {완료\|미완료} · {text}` line per item (open first, then done, so a trim drops the done ones first) — the raw `  후속: {actions}` line appears **only** when the meeting has free text but no items, so nothing is stated twice — then `  진행 {date}: {text}` for the newest progress entries. Hidden (`aiHidden`): `- {date} {title}` then `  내용 비공개 (AI에 보내지 않기)` and nothing else — no project name either | `WORK_PACKET_MEETINGS` (10 meetings; 6 until 2026-09-17) × `WORK_PACKET_PROGRESS` (5 entries) × `WORK_PACKET_FOLLOWUPS` (30 follow-up items); summary up to `WORK_PACKET_SUMMARY` (5,000 — the whole field), decisions/follow-ups/progress text up to `WORK_PACKET_CLIP` (600) / `MEETING_LIMITS.followUp` (200) — the whole field. Until 2026-09-17 these were 200 and 100 with 3 entries, which cut every meeting's content |
| `## 업무 기록 (이월·어제·오늘)` | every undone item carried into today (`workOn(state, today, today)`) plus yesterday's items, deduped by id, date then `createdAt` ascending: `- {date} {완료\|미완료}{ · 이월 {n}일}{title}{ · 메모: note}{ · 처리: result}` (the `이월` fragment only on an undone carried item; `처리` only on a done item with a result, up to `WORK_PACKET_RESULT` = 300 chars, added 2026-09-17; note up to `WORK_PACKET_NOTE`, 200 — the whole field; 60 until 2026-09-17; heading widened from `어제·오늘` at schema v26) | `WORK_PACKET_RECORDS` (20) |

`WORK_PACKET_HEAD` states the role, five numbered rules (facts only, `해요체`; never judge or change a score/grade/payout/difficulty; propose only today's work items, with no count limit (`건수 제한 없이`; `최대 8건` until 2026-09-17), title ≤ 60 / note ≤ 200, never create a task/event/contract/meeting, never re-propose a title already in `업무 기록` — a carried item is in that section too, so rule 3 already covers it, and `parseWorkReply`'s own dedupe (below) reads the same `workOn` call and refuses it a second time; name the goal/meeting/project a proposal is based on in `link.title`, verbatim, or omit `link`; and, since 2026-09-22, one added sentence: `각 항목의 track에 직장·사업·개인 중 하나를 적어요 — 근거가 된 기록의 트랙을 따라요.` (state the item's track, following the track of whatever record grounds it); close with a ≤ 5-line analysis then one JSON block, `"work": []` when there is nothing to propose) and the reply template
`{"work":[{"title":"...","note":"...","track":"직장|사업|개인","link":{"kind":"goal|meeting|project","title":"..."}}],"note":"..."}`
(the `track` key added 2026-09-22; the rule numbering stays 1–5). `REVIEW_PACKET_HEAD` is unchanged — its items are business by scope, so it asks for no `track` key.

**Trim order** when the built text exceeds `WORK_PACKET_MAX`, applied as an ordered list of reduction closures, rebuilding and re-measuring after each step until it fits or the list is exhausted: (0) summary clip 5,000 → `WORK_PACKET_SUMMARY_TRIM` (1,500); (1) meetings 10 → 2, dropping the oldest; (2) follow-up items 30 → 5 per meeting, open ones kept first (schema v26, new step); (3) summary clip → 500 and progress 5 → 1 per meeting, together; (4) schedule lines 8 → 0; (5) business lines to the first line only; (6) open-task lines 10 → 0; (7) work-record lines 20 → 0 (last before the meeting floor — the parser dedupes proposals against `업무 기록` on its own, so losing the section only weakens that hint, never breaks a rule); (8) meetings 2 → 0. The header, the CV line and the goals section are never dropped. Measured on the demo build (2026-09-17): the demo daily packet excerpt with a prep-heavy save is 2,324 characters; the demo work packet gives 2,260 characters with nothing clipped; a heavy save (many meetings, full follow-ups) trims to two meetings of five follow-ups each at about 11,700 characters; a single meeting with thirty full follow-ups goes whole at 11,127 characters, no trim needed. A packet this long is still one paste: Claude takes it inline, and ChatGPT may turn a long paste into an attached file, which it reads.

### The reply — `parseWorkReply(text, state, today)`

Reads the reply through the same `replyJson` (fence optional); only `data.work` (array, every entry — no count limit since 2026-09-17; it was 8, then briefly 20, and 8 cut a reply short when one meeting alone had ten follow-ups) and `data.note` (≤ 200 chars) are read. `tasks`, `deals`, `events`, `meetings`, or any other key in the same reply is not merged, not stored, not even inspected beyond being ignored — proven by an E2E step that pastes a reply naming all four and asserts none of `tasks`/`deals`/`events`/`meetings`/`work`/`journal` changed.

| Field | Rule |
|---|---|
| `title` | trimmed to `WORK_LIMITS.title` (60); empty → `reject: "제목이 없어요"` |
| `note` | trimmed to `WORK_LIMITS.note` (200); `""` when absent |
| `link` | read only when `link.kind` is `goal`/`meeting`/`project` and `link.title` is a non-empty string; resolved against active goals / all meetings (newest first) / all projects by exact title match, then substring either way, first hit wins; no hit → `link: null`, `linkText: "연결 없음 — {wanted}"`; a bad `kind` → `null` |
| `track` (2026-09-22) | read through `replyTrackOf`: the label the head asks for (`직장`/`사업`/`개인`) or the internal value (`work`/`biz`/`personal`) maps to the internal value; anything else → `null`. Still only `data.work` and `data.note` are read at the top level — `track` is a field of each work item, not a new top-level key |
| duplicate | `reject: "오늘 업무에 이미 있어요"` when `normWorkTitle(title)` equals an item already in `workOn(state, today, today)` (today's carried view, schema v26) or an earlier proposal in the same reply |

Returns `{ raw, note, proposals }`, each proposal `{ key: "w{n}", title, note, link, linkText, track, reject }` (`track` added 2026-09-22, the parsed value or `null`); nothing here writes state — `WorkBridgeModal`'s confirm view ticks/unticks and picks a track per row (`proposalTrackOf`, below) and `importWork` (root) is what registers a record, with `source: "ai"` and `done: false`, from the ticked, non-rejected proposals only, each carrying the track picked on its row. The raw reply is never stored (unlike the daily bridge's `journal[].ai`) — storing it would collide with that key, and nothing derived needs to survive a reload here.

### The track a proposal's confirm row preselects — `proposalTrackOf(state, p)` (2026-09-22)

Fixes a rule left from when day-job records never reached the work packet: with the day-job-in-AI-packets switch on, an unlinked or goal-linked proposal used to be filed under `사업` regardless (`importTrackOf`, now removed). The confirm row's preselected track, in order: the track the reply stated (`p.track`), else the track of the link the proposal resolved to (`linkTrackOf(state, p.link)` — a resolved `project` or `meeting` link's own track, lifted from the old root-level `importTrackOf`; a `goal` link or no link carries none, so this step is skipped), else `직장` (`work`) while day-job records go into packets (`workInAiOf(state)`), else `사업` (`biz`). The user may change the pick on any row before registering; a rejected row shows no chips at all.

### Shared UI pieces

`copyPacket(taRef, text, onToast)`, `PacketSendPane({ packet, caption, taRef, onCopy, onPaste })` and `ReplyPastePane({ reply, setReply, onCheck })` are lifted out of `BridgeModal` to module level so `WorkBridgeModal` reuses them without a six-line duplicate; `BridgeModal`'s own copy and behaviour are unchanged from the user's side.

### What the work packet never carries

Exactly like the daily packet's `## 이력` line: never `profile.name`, `birth`, `email`, `phone`, a school name or an employer name — only what `cvSummaryOf` states. No photo, no evidence text, no journal entry (the journal is the daily packet's domain, not this one's). A hidden meeting's line never states its project name either, only its date and title. **Since 2026-09-17, never a meeting's `transcript`**: `meetingLines` carries a comment marking the omission and reads only the named fields above (summary, decisions, follow-ups, progress, attendees, linked schedule and tasks) — a pasted transcript, however long, contributes nothing to this packet, the daily packet, the calendar file (`buildIcs`) or the prep card (`meetingPrepOf`), by the user's own decision ([SECURITY.md](../SECURITY.md)); `tools/e2e/flow11.js` plants a sentinel string inside a transcript and asserts it absent from the built packet text.

### `meetingPacketLines(state, list, today, k)` — shared by the work and prep packets (2026-09-17)

`buildWorkPacket`'s local `meetingLines` closure is lifted to module level as `meetingPacketLines(state, list,
today, { summary, progress, followUps, openOnly = false })` (schema v27). `buildWorkPacket` calls it with its own
knobs and `openOnly: false`; its output is byte-identical to before the extraction (verified against a captured
baseline of the demo work packet). The prep packet (below) calls it with `openOnly: true`, which lists only the
**open** (`!done`) follow-ups under the `후속 {n}건:` head, so the head's own count states how many are open
rather than the total — the transcript stays unread either way (the comment marking that omission moved with the
function).

## Since-mode — the incremental work packet (2026-09-22)

Every `오늘 업무 만들기` packet used to restate the ten newest meetings whole, so a user who refreshes daily
pasted the same minutes every day. `act.workRefreshedAt?` (an optional date, a **user-action stamp** like
`act.briefingSeen`, never read as progress — [Rule 9](core-beliefs.md#rule-9)) is written by `importWork` only
when called from the work bridge (`stamp: true`) with at least one proposal ticked; the review bridge never
stamps, since its proposals are next week's business items, not a refresh of today
([daily-work.md](../product-specs/daily-work.md)).

With a stamp, `WorkBridgeModal`'s `workBridge` render (never the review bridge) shows two chips above the packet
textarea, `지난 갱신 이후` (preselected) and `전체`; picking one calls `buildWorkPacket(state, today, { since })`
with or without `since = act.workRefreshedAt`. **Without `since`, output is byte-identical to before this
change** — verified against 54 packet builds (the demo, the demo with `settings.workInAi: false`, and a heavy
save, each with and without a planted stamp, across every one of the five bridge packets).

`workSinceOf(state, since)` (pure, module level, directly above `buildWorkPacket`) splits the packet-track,
**meeting-kind-only** meetings (2026-09-22, same-day follow-up: `allowed` filters `!isTraining(m)` before the
track filter, so a training record is in neither `recent` nor `older`):
- `recent` — dated **or created** on or after `since` (`>=`, so a meeting written on the stamp day after the
  refresh is not lost), uncapped, `meetingOrder`; the builder caps the printed list at `WORK_PACKET_MEETINGS`
  (10) as usual.
- `older` — every other non-hidden meeting with at least one progress entry dated on or after `since`, or at
  least one open `mine` follow-up (follow-ups carry no date, so every open one qualifies), each carrying its
  qualifying `progress` (newest first) and `followUps`.
- `docs` — documents `addedAt >= since` on a packet track.
- `counts` — `{ meetings: recent.length, progress, docs: docs.length }`; `progress` counts every qualifying
  progress entry across non-hidden meetings, recent and older together.

Since-mode changes the packet in four places, none of them touching goals, open tasks, schedule, contracts or
the `업무 기록` records section (current state, not history, and unchanged in since-mode):
1. A line right after the packet's opening bracket, before the head: `마지막 갱신 {since} · 그 뒤 회의록 {n}건 ·
   진행사항 {n}건 · 문서 {n}건`.
2. `workPacketHead(since)` — the head is `WORK_PACKET_HEAD` unchanged when `since` is falsy, else a copy whose
   rule 3 line gains one trailing sentence: ` '지난 갱신 이후' 기록을 우선 반영해요.`
3. `## 최근 회의록`'s title becomes `({n}건 · {since} 이후)` and its list holds only `recent`.
4. Two sections follow it: `## 이전 회의록의 새 기록` (per older meeting, in meeting order, its qualifying
   progress lines `- {title} · 진행 {date}: {clipped text}`, flattened across meetings and sorted newest first,
   capped `WORK_PACKET_OLDER_PROGRESS` (30) overall, then its open `mine` follow-up lines `- {title} · 후속 내
   담당 미완료: {clipped text}`, capped `WORK_PACKET_OLDER_FOLLOWUPS` (20) overall) and `## 문서 ({since} 이후)`
   (per document, `- {addedAt} [{project name | 프로젝트 없음}] {title}` then `  요약: {clipped summary}` —
   never `source` — capped `WORK_PACKET_DOCS` (10), clip `WORK_PACKET_DOC_CLIP` (300)).

**Trim order** gains two steps before the last, inserted after the work-records step: drop `## 문서` entirely (a
dropped section keeps its heading with `- 없음`, so the AI still knows the section exists), then drop `##
이전 회의록의 새 기록` entirely — documents before the older-meeting section, since a progress entry is closer to
an action than a document summary. `WORK_PACKET_MAX` (20,000) is unchanged; measured on a heavy save (30
meetings × 30 follow-ups, 3,000-char summaries, 100 post-stamp progress entries, 20 post-stamp documents):
19,195 chars with the stamp three days back (reductions fired: summary clip 10,000 → 1,500, then meetings 7 →
2 — the older section's 30 progress + 20 follow-up lines and the 10 documents survive intact), 19,224 ten days
back, 15,766 thirty-one days back (summary clip, then meetings 35 → 10 → 4). The demo with a stamp three days
back measures 3,363 chars (the full packet: 2,997).

## The third packet — `AI에게 회의 준비 묻기` (`buildPrepPacket` / `parsePrepReply`, 2026-09-17, the [Rule 7](core-beliefs.md#rule-7) amendment "second of the day")

Built for **one schedule event** that belongs to a meeting project (`eventProjectOf(state, ev)`), opened from the
meeting-prep card's `AI에게 회의 준비 묻기` button (`MeetingPrepCard`,
[../product-specs/daily-work.md](../product-specs/daily-work.md)).
A reply to it can only *propose* **check items** (`events[].checks`,
[../product-specs/schedule.md](../product-specs/schedule.md)) — never a task, a work item, an event, a deal or
a meeting.

`buildPrepPacket(state, ev, today, date = ev.date)`: when the event names no live project, the packet is just
the header plus one `## 회의` line; otherwise it builds, in order, through the same `packetSection` helper:

| Section | Content | Cap / clip |
|---|---|---|
| `## 회의` | one line: `- {date} {time \| 시간 미정} · {title} · 프로젝트 {project.name}` — no place, no note, no `## 이력` | — |
| `## 확인할 것 (이미 있음)` | every existing check on the event, `- {text} · {완료\|미완료}` | — |
| `## 최근 회의록 ({n}건)` | the project's meetings by `meetingOrder`, **any kind**, through `meetingPacketLines(…, { openOnly: true })` — unlike the work packet (above), this list keeps a [training record](../product-specs/meetings.md#training-records-교육-2026-09-22--reference-only-same-day) (2026-09-22): it helps meeting preparation, so it stays as content, with `교육 · ` after the project bracket and `배운 것:`/`핵심 정리:`/`기억할 점:` body labels, and no follow-up/progress/linked-task lines (`followUpsOf` is `[]` for one, and its progress/task links are never read here) — a meeting flagged `aiHidden` still contributes its date and title only | `PREP_PACKET_MEETINGS` (5) |
| `## 문서 ({n}건)` | the project's documents by `docOrder`: `- {addedAt} {title}` then `  요약: {clipped summary}` — never `source` | `PREP_PACKET_DOCS` (10) × `PREP_PACKET_DOC_CLIP` (1,500, trimmed to `PREP_PACKET_DOC_CLIP_TRIM` 500 under the cap) |
| `## 열린 할 일 (회의록 연결)` | open tasks linked by the shown, non-hidden, **non-training** meetings, deduped, not closed today (2026-09-22: `!isTraining(m)` added to the meeting filter, so a training record's stored task links, if any, never contribute a row) | `PREP_PACKET_TASKS` (10) |
| `## 계약 (같은 고객사)` | `dealsOfProject(state, project)` — `- {phase label} · {client} {title} · {period \| 기간 없음} · 월 {won}`, then a `  미수 {month} {won}` line per unpaid billed month of that deal | `PREP_PACKET_DEALS` (6) |

Header: `[인생 관리 — 회의 준비 요청 {today}]`, `PREP_PACKET_HEAD` (below), a blank line. Own cap
`PREP_PACKET_MAX` = 20,000. `WORK_PACKET_SUMMARY`, `WORK_PACKET_SUMMARY_TRIM`, `WORK_PACKET_PROGRESS` and
`WORK_PACKET_FOLLOWUPS` are reused for the summary/progress/follow-up knobs, so the two packets shrink a meeting
the same way.

**Trim order** when the built text exceeds `PREP_PACKET_MAX`, rebuilding and re-measuring after each step: (0)
document clip 1,500 → 500; (1) meetings 5 → 2, oldest first; (2) follow-ups 30 → 5 per meeting; (3) summary clip
5,000 → 1,500; (4) summary → 500 and progress 5 → 1, together; (5) documents 10 → 3; (6) tasks → 0; (7) deals →
0; (8) documents 3 → 0; (9) meetings 2 → 0. The header, the `## 회의` line and the existing checks are never
dropped. Measured: the demo prep packet is **1,337 chars**; a heavy save (a hidden meeting plus four heavy
meetings) trims to **19,064 chars**; a heavy save of five heavy meetings trims to **16,264 chars**.

`PREP_PACKET_HEAD` (verbatim, five numbered rules): facts and numbers only, `해요체`; never judge or change a
score/grade/payout/difficulty; propose only check items for **this meeting** — a question, an open point, a
risk, a thing to bring — each ≤ 200 chars, never creating or changing a task/event/work item/contract/meeting,
and never re-proposing an item already in `확인할 것 (이미 있음)`; state each proposal's `basis` in one line
(a meeting date or a document title, in the data's own wording, or empty when there is none); close with a
≤ 5-line analysis then one JSON block, `{"checks":[{"text":"...","basis":"..."}],"note":"..."}` (`"checks": []`
when there is nothing to propose).

### The reply — `parsePrepReply(text, ev)`

Reads the reply through the same `replyJson`; only `data.checks` (array) and `data.note` (≤ 200 chars) — `tasks`,
`work`, `deals`, `events`, `meetings` or any other key is ignored, proven by an E2E step that pastes all four
alongside `checks` and asserts none of them changed. Per entry: `text` and `basis` are trimmed; the **basis is
folded into the check text** as `{text} — {basis}` when that result is ≤ `EVENT_CHECK_TEXT` (200) chars,
otherwise the text alone is stored (clipped to 200) and the basis is dropped from the stored text but still
shown on the confirm row's second line, so nothing is hidden before the tick. A proposal is refused —
`reject: "내용이 없어요"` when the text is empty, `reject: "이미 확인할 것에 있어요"` when its normalised form
(folded or not) already names an existing check on the event or an earlier proposal in the same reply.

Returns `{ raw, note, proposals: [{ key: "c{n}", text, basis, reject }] }`; nothing here writes state.
`PrepBridgeModal`'s confirm view ticks/unticks and `importChecks` (root, [../product-specs/schedule.md](../product-specs/schedule.md))
is what registers a check, with `source: "ai"` and `done: false`, from the ticked, non-rejected proposals only.

### `PrepBridgeModal({ state, today, eventId, date, onClose, onImport, onToast })`

`modal: { type: "prepBridge", eventId, date }`, opened from the prep card's `AI에게 회의 준비 묻기` button.
Reuses the shared `PacketSendPane` / `ReplyPastePane` / `copyPacket` panes. Send caption: `아래 글을 복사해
Claude·ChatGPT 채팅에 붙여넣고, 답변을 받아 다시 붙여넣어요. 앱은 네트워크를 쓰지 않아요. 이 프로젝트의 회의록
요약·후속·진행사항과 문서 요약이 실려요 — 녹취록·이름·연락처·문서 출처는 실리지 않아요.` Confirm view: `확인할
것 제안 — {n}건`, the reply's `note`, one row per proposal (a checkbox, disabled and unticked when rejected; the
text; a second line `근거: {basis}` or `근거 없음`; a rose reject line), `제안 없음 — 등록할 항목이 없어요.` when
empty; `선택한 항목 등록` calls `onImport(eventId, ticked)`; a non-empty return (the 30-item cap refusal) shows
as a rose line above the button.

### What the prep packet never carries

Never `profile.name`, `birth`, `email`, `phone`, a school name or an employer name (no `## 이력` line at all —
meeting preparation needs no CV); never a transcript (the shared meeting-line builder has no access to it);
never an event's `place` or `note`; never a document's `source`; a hidden meeting always contributes date and
title only, never its summary or project name. `tools/e2e/flow11.js` plants a hidden meeting, a transcript and a
document with a `source`, and asserts each is absent from the built packet text.

## The fourth packet — `주간 회고` (`buildReviewPacket` / the unchanged `parseWorkReply`, v28)

Opened from `ReviewModal`'s `AI에게 회고 묻기 ›` button — **enabled only once this week's review is saved**, so
the packet always reads the stored review, never an unsaved draft ([../product-specs/daily-briefing.md](../product-specs/daily-briefing.md)).
It needs **no Rule 7 amendment**: the reply is read by the unchanged `parseWorkReply` (key `work` only, exactly
as `오늘 업무 만들기`'s reply is) and registered by `importWork`, which gains an optional `date` (next Monday)
argument — no new stored key, no network call. The confirm sheet still preselects every row `사업`
(`importTrack="biz"`, since `REVIEW_PACKET_HEAD` asks for no `track` field), but the user may repick any row the
same way as the work bridge's rows before registering. Business track of the current week only
(`mondayOf(today)`), unaffected by the day-job switch above — **no day-job or private record, no `## 이력` line, no profile identifier, no transcript,
and no body of a meeting flagged `aiHidden`** (its follow-ups stay out too); a milestone whose `milestoneTrack`
is `work` also stays out.

`buildReviewPacket(state, today)`, through the same `packetSection` helper:

| Heading | Content |
|---|---|
| `## 이번 주 사실 (사업)` | the review's business-track line (`weekFactRows(weekFacts(state, weekOf)).biz`) and `timeLine(state, today)` |
| `## 이번 주 완료 업무 (사업)` | business work items dated in the week and done: date, title, the result clipped at `WORK_PACKET_RESULT` |
| `## 미완료 업무·후속 (사업)` | every undone business work item whatever its date (future-dated included, carried ones with `이월 {n}일`), then open follow-ups of non-`aiHidden` business meetings (`- 후속 · {meeting} · {내 담당\|타인} · {text} · {기한 {due}\|기한 없음}`) |
| `## 로드맵` | `timeLine`, the stage-order note when any, one `milestoneLine` per not-done business-track milestone by `milestoneOrder` |
| `## 파이프라인` | one `leadLine` per lead not won, by `leadOrder` (leads carry no track — all included) |
| `## 공고` | one `noticeLine` per open notice, by `noticeOrder` (notices carry no track — all included) |
| `## 입금 예정` | kind, due, client, title, amount, paid date — for payment lines of business-track deals, whatever their status |
| `## 이번 주 리뷰` | `- 잘된 것: {clipped wins \| 없음}` and `- 막힌 것: {clipped blocks \| 없음}` from the saved review |

Header `[인생 관리 — 주간 회고 요청 {today}]`, then `REVIEW_PACKET_HEAD` (verbatim below), a blank line. Own cap
`REVIEW_PACKET_MAX` = 20,000.

`REVIEW_PACKET_HEAD` (five numbered rules, verbatim): facts and numbers only, `해요체`; never judge or change a
score/grade/payout/difficulty; propose only business work items to do **next week** — no count limit, title ≤
60 / note ≤ 200 chars, never create or change a task/event/contract/meeting/milestone/lead, never re-propose a
title already in `미완료 업무·후속`; name a proposal's meeting/project basis in `link.title` verbatim, or a
milestone/lead/notice basis in `note`, or omit `link` when there is none; close with a ≤ 5-line retrospective
then one JSON block, `{"work":[{"title":"...","note":"...","link":{"kind":"meeting|project","title":"..."}}],"note":"..."}`
(`"work": []` when there is nothing to propose) — the **same shape as the work packet's**, so `parseWorkReply`
reads the reply with no change of its own.

**Trim order**, rebuilding and re-measuring after each step: (0) done-work lines 30 → 10; (1) open-work lines
30 → 10; (2) follow-up lines 30 → 5; (3) lead lines 20 → 5; (4) notice lines 10 → 3; (5) payment lines → 3; (6)
done-work lines → 0; (7) lead lines → 0. The header, the facts line and the roadmap section are never dropped.
Measured on the demo build (2026-09-18): 1,946 chars with a saved review, 1,912 without; a heavy save (300 work
items, 40 business meetings × 30 follow-ups each, 50 leads, 20 notices, 12 payment lines per deal) trims to
18,938 chars with no transcript, lead contact string or day-job item present.

`ReviewModal`'s per-track facts line (`직장 · 이번 주 기한 후속 …`, `사업 · … · {h}/{budget}h · 마일스톤 완료
{n}건 · 리드 진전 {m}건`, `개인 · …`) is documented in [../product-specs/daily-briefing.md](../product-specs/daily-briefing.md#reviewmodal-modaltype-review);
`weekFacts` reads due dates and item dates rather than a completion stamp, since follow-ups and work items store
`done` only ([TD-71](../exec-plans/tech-debt-tracker.md), accepted).

**Duplicate-check caveat (TD-71-adjacent, plan error found during implementation):** `parseWorkReply`'s dedupe
compares a proposed title against **today's** view (`workOn(state, today, today)`), not the import date (next
Monday) — a proposal whose title already exists on next Monday's own list is not refused by the parser; the
packet head's own rule 3 ("don't re-propose what `미완료 업무·후속` already lists") is the only guard against a
duplicate landing on that future date.

`WorkBridgeModal` is generalised (`build`, `title`, `caption`, `importDate`, `importTrack` props) to render both
`workBridge` and `reviewBridge` with one confirm view — see [../product-specs/daily-work.md](../product-specs/daily-work.md#오늘-업무-만들기-and-주간-회고--workbridgemodal-generalised-v28).
`importWork(list, date = today)` (its `track` argument dropped 2026-09-22) dates the registered items `date` and
writes each item's own picked `track` (carried on the proposal since the confirm sheet's track pick, above),
appending ` · {date}` to the toast when `date` is not today.

## The fifth packet — `AI에게 판정 묻기` (`buildRoleVerdictPacket` / `parseRoleVerdictReply`, 2026-09-18, the
[Rule 7](core-beliefs.md#rule-7) amendment dated 2026-09-18)

Opened from the `롤모델` screen's `AI에게 판정 묻기 ›` button (`RoleVerdictModal`, `modal.type: "roleVerdict"`;
the button lived on `RoleAdviceModal` until that sheet was retired 2026-09-18, second change of the day),
disabled until `role.story` is set. Built from the user's own `원하는 모습` story (`role.story`, the one free
text sent verbatim), the CV line, the area grades and requirements, the held certifications and exam bests,
business-and-private record counts, the current stages with their condition values, and the last verdict. A
reply may *propose* a role model — stages with conditions the app can evaluate, area requirement grades — and
*state* a verdict (summary, basis, position, gaps — **no probability**, retired 2026-09-18, third role-model
change of the day, [Rule 14](core-beliefs.md#rule-14) amendment); nothing is saved without the user's tick, and
stage conditions are evaluated by the app from its own records (`condValue`), never by the reply. Full mechanics
of the confirm sheet, the headline decision, the stage-completion overlay and the verdict history live in
[metrics-and-role-model.md](metrics-and-role-model.md#the-story-the-verdict-and-stage-progress-2026-09-18); this
section documents the packet and the parser only.

`buildRoleVerdictPacket(state, today)`, through the same `packetSection` helper, own cap `ROLE_PACKET_MAX` =
12,000:

| Section | Content |
|---|---|
| `## 원하는 모습` | the story as one line, or `- 없음 — 롤모델 설정에서 원하는 모습을 적어요` |
| `## 이력` | the same `cvSummaryOf` line every packet states — never `profile.name`, `birth`, `email`, `phone`, a school or an employer |
| `## 영역 등급` | one line per area: grade name and `n/9`, plus ` · 요구 {RANKS[need].name}` when `role.targets[id] > 0` |
| `## 보유 자격·시험` | held certifications (`heldCertsOf`) and exam bests (`examBestText`), or `- 자격 없음` / `- 시험 없음` |
| `## 기록 요약` | counts only, computed over `deals`/`milestones` filtered by `packetTracks(state)` (won/active/upcoming contract counts, this month's revenue, portfolio and AI-portfolio counts, milestone completion, per-stage lead counts, per-status notice counts) — never a deal title, client, lead name, notice title, milestone title, project or work item; a day-job record's own count is counted only while the switch above is on |
| `## 현재 단계` | per stage, its name and (unless trimmed) one line per condition value, or `- 없음` without stages |
| `## 지난 판정` | `- {date} · 단계 {k}/{n} · {clipped summary}` for the newest verdict, or `- 없음` — no probability figure since 2026-09-18 (third role-model change of the day) |

`ROLE_PACKET_HEAD` (verbatim, five numbered rules): facts and numbers only, `해요체`, **and, since 2026-09-18
(third role-model change of the day, [Rule 14](core-beliefs.md#rule-14) amendment), an explicit instruction not
to state a likelihood figure**: `달성 가능성을 숫자로 쓰지 않아요.` (the app cannot strip a number the AI writes
into its own free text anyway — [tech-debt-tracker.md](../exec-plans/tech-debt-tracker.md) TD-92); a company/role
target is judged against the real hiring specs of the last three years, a founding target against real
survival/success rates, uncertain figures marked `추정`; scores/grades/payouts/difficulty are never evaluated or
changed, grade names quoted exactly as `## 영역 등급` states them; stages propose only conditions the app can
evaluate — the `type` and value vocabulary of `## 조건 종류` (generated from `COND_TYPES`, so the head can never
drift from the evaluator) — at most 12 stages of 5 conditions each, stage names ≤ 40 chars, certification names
official, area names from `## 영역 등급` only, requirement grades 1–8; the reply closes with a ≤ 4-line verdict
(요약·근거·현재 위치·부족한 것 — summary, basis, position, gaps; **no probability line**, dropped 2026-09-18) then
one JSON block (`{"verdict":{...},"stages":[...],"areas":{...},"note":"..."}`, `"stages": []` / `"areas": {}`
when there is nothing to propose — the JSON template itself carries no `"probability"` key any more).

**Trim order**, rebuilding and re-measuring after each step: (0) the story clips 2,000 → `ROLE_PACKET_STORY_TRIM`
(1,000); (1) the condition lines drop from `## 현재 단계` (stage names stay); (2) the story clips again, →
`ROLE_PACKET_STORY_TRIM2` (500); (3) the stage lines drop to `- 없음`. The header, the CV, the grades, the
certificates, the counts and the last verdict are never dropped. Measured figures, packet lengths and demo
values: [metrics-and-role-model.md](metrics-and-role-model.md#storage-arithmetic).

### The reply — `parseRoleVerdictReply(text, state, today)`

Reads the reply through the same `replyJson`; only `data.verdict`, `data.stages`, `data.areas` and `data.note`
— `tasks`, `work`, `checks`, `deals`, `events` or any other key is ignored, not inspected. A `probability` key
inside `data.verdict` is likewise ignored the way `tasks` is (2026-09-18, third role-model change of the day) —
not read, not copied, not stripped from an older verdict record that still carries one. `verdict` is `null`
unless `data.verdict` is an object, else `{ summary, basis, position, gaps[] (≤ 8, each ≤ 120 chars) }` — an
object with an empty summary is still a verdict (the sheet prints `요약 없음`). Each proposed stage is validated and, on the first invalid condition, **rejected whole** (a half-stage is
never saved silently): empty name → `단계 이름이 없어요`; no conditions → `조건이 없어요`; an unknown `type` (not
in `COND_TYPES`) → `알 수 없는 조건 종류예요: {type}`; a non-finite or negative `min` → `기준은 0 이상 숫자예요`;
a `cert_held` whose `certByTitle(arg)` is `null` → `자격 표에 없는 이름이에요: {arg}` — matched, its `arg` is
normalised to the official name (longest name first, [Rule 15](core-beliefs.md#rule-15)) so `condValue`'s exact
match against `heldCertsOf` works. At most `ROLE_STAGES_MAX` (12) stages of `STAGE_CONDS_MAX` (5) conditions
each are read. Each proposed area's name is matched **exactly** against `state.areas[].name` (unknown → `없는
영역이에요: {name}`); its grade must be an integer 1–8 (else `요구 등급은 1–8이에요`); an area whose proposed
grade equals the current requirement is **dropped** (only changes are listed); a duplicated name keeps the
last entry.

Returns `{ raw, verdict, stages, areas, note }` — nothing here writes state; a proposal becomes a stage, a grade
or a verdict only in `importRoleVerdict`, after the user's tick. The raw reply is never stored — not on the
journal (`upsertReply` is not called), not on the verdict record, which holds only the clipped
summary/basis/position/gaps text (no probability, 2026-09-18).

### What the role verdict packet never carries

Never `profile.name`, `birth`, `email`, `phone`, a school name, an employer name, a client or lead name, or a
transcript, and makes no network call; a day-job record's own name or text never enters — only its count in `##
기록 요약`, and only while the day-job switch (above) is on. The daily packet and the briefing stay
byte-identical, since the re-assessment line lives in the reader, not the briefing (`buildBriefing` is
unchanged; [../product-specs/daily-reader.md](../product-specs/daily-reader.md#the-role-verdict-section)) — and,
since 2026-09-18 (third role-model change of the day, [Rule 14](core-beliefs.md#rule-14) amendment), no packet
of any kind asks for or states a probability figure any more.

## The sixth packet — `오늘의 관문 퀴즈` (`buildQuizPacket` / `parseQuizReply`, 2026-09-24, the [Rule 7](core-beliefs.md#rule-7) amendment "2026-09-24")

Built for the [daily gate](../product-specs/daily-gate.md) — the full-screen layer that stands until the user reads both `오늘 읽을 것` and `이슈 목록` to their end, passes a locally graded quiz on that content, and refreshes today's work. A reply to this packet can only *propose* four-choice questions; the app grades the user's answers **locally** (`gradeQuiz`) and stores the result as a fact — no praise, no badge, no streak of its own ([Rule 13](core-beliefs.md#rule-13)).

`buildQuizPacket(state, today)`, through the same `packetSection` helper, own cap `QUIZ_PACKET_MAX` = 12,000:

| Section | Content | Cap / clip |
|---|---|---|
| `오늘·내일 회의 준비` | `meetingPrepOf(state, today)` rows on packet tracks — event, open checks, `결정: {clipped decisions \| 없음}` or `이전 회의록 없음`, or (a hidden last meeting) `내용 비공개 (AI에 보내지 않기)` | never dropped |
| `업무 (이월·오늘)` | open work items from `workOn(state, today, today)`, carried first (`이월 {n}일` / `오늘`), with a `메모:` fragment | `QUIZ_PACKET_WORK` (30) |
| `다가오는 일정 (14일)` | `upcomingEvents(state, today, QUIZ_PACKET_EVENT_DAYS)` — date, time, kind, title; never `place`/`note` | `QUIZ_PACKET_EVENTS` (30) |
| `최근 7일 결정 사항` | meetings dated within `QUIZ_PACKET_DECISIONS` (7) days with a non-empty `decisions`, any kind, newest first; a hidden meeting states date and title only | clip `QUIZ_PACKET_CLIP` (300) |
| `회의록 ({n}건[ · {since} 이후])` | since-mode when `act.workRefreshedAt` exists (`workSinceOf(state, since).recent`), else the newest meeting-kind minutes, through `meetingPacketLines` | `QUIZ_PACKET_MEETINGS` (5) |
| `이전 회의록의 새 기록` (since-mode only) | the older meetings' post-stamp progress lines, newest first | `QUIZ_PACKET_OLDER_PROGRESS` (20) |
| `교육` | the newest training records as content, through `meetingPacketLines` (`배운 것`/`핵심 정리`/`기억할 점`) | `QUIZ_PACKET_TRAINING` (3) |
| `문서 ([{since} 이후])` | since-mode post-stamp documents, else the newest by `docOrder`; title and a clipped summary, never `source` | `QUIZ_PACKET_DOCS` (5) |

Knobs are shared with the work packet through `minutesReductions(k)` (lifted to module level, 2026-09-24 — a `finish` duplicate finding merged the two packets' first four reductions; the work packet's own output stays byte-identical). Head (`QUIZ_PACKET_HEAD`, verbatim, a role line and four numbered rules): facts and numbers only, `해요체`; exactly `QUIZ_ASK` (7) questions, four choices each, one answer, `basis` a literal line from the data; no trap questions, no guesswork, nothing outside the data, and no evaluating or changing a score/grade/payout/difficulty; one JSON block only, `{"quiz":[{"q":"...","choices":["...","...","...","..."],"answer":0,"basis":"..."}]}`.

**Trim order**, rebuilding and re-measuring after each step: the four `minutesReductions` steps shared with the work packet (summary clip 10,000 → `WORK_PACKET_SUMMARY_TRIM` (1,500); meetings → 2, one at a time; follow-ups → 5; summary → 500 with progress → 1), then schedule → 0; documents → 0; the decisions clip 300 → 100; the older-meeting section → 0; training → 0; work → 0; meetings 2 → 0. The title, the head and the preparation section are never dropped; a dropped section keeps its heading with `- 없음`.

Measured: the demo packet is **2,761 chars**, no reduction fired; a heavy save shaped like `flow11.js`'s fixture (30 meetings × 30 follow-ups, 3,000-char summaries, 100 progress entries, 20 documents) trims to **5,242 chars** (summary clip, then meetings 5 → 2 — three steps); a heavier save adding 2,000-char transcripts, a hidden meeting, training records, dated events and `source`-carrying documents on every record trims to **8,155 chars** through all eleven reduction steps in order (the older-meeting section is a no-op without a stamp).

### The reply — `parseQuizReply(text)`

Reads the reply through the same `replyJson`; only `data.quiz` — `tasks`, `work`, `checks`, `verdict` or any other key is ignored, exactly like the other five parsers ignore each other's key. An item is kept whole or dropped, never repaired: `q` a non-empty trimmed string (clipped `QUIZ_Q_MAX` 200); `choices` exactly 4 non-empty trimmed strings, no two equal, each clipped `QUIZ_CHOICE_MAX` (80); `answer` an integer 0–3 (`Number.isInteger`; a numeric string like `"1"` is **not** coerced); `basis` optional, clipped `QUIZ_BASIS_MAX` (200), else `""`. The first `QUIZ_MAX` (10) valid items are kept in reply order; fewer than `QUIZ_MIN` (5) valid → `items: []`, `refused: "퀴즈 문제가 5개 미만이에요 — 답변을 다시 받아요"`. Nothing here writes state, and the raw reply is never stored.

### Local grading — `gradeQuiz(items, answers)` / `quizNeed(total)` / `shuffleQuiz(items, rand)`

`quizNeed(total) = Math.ceil(GATE_PASS_RATIO × total)` (`GATE_PASS_RATIO` 0.8 — 7 → 6, 5 → 4, 6 → 5, 8 → 7, 10 → 8, the user's own pass threshold, decision 1, 2026-09-24). `gradeQuiz` marks an unanswered item (`answers[i] == null`) wrong and returns `{ total, score, need, passed }`; nothing here is remote — the score is computed on the device from the user's own picks. `shuffleQuiz(items, rand = Math.random)` reorders each item's four choices (Fisher–Yates) and remaps `answer` to the correct text's new index, for `같은 문제 다시 풀기` (the same-questions retry) — pure, `rand` injectable so smoke fixes the order. The parsed items are held in the root's own component state (`quizHeld`), never in `state`; a reload loses them. See [../product-specs/daily-gate.md](../product-specs/daily-gate.md) for the gate screen, the grading UI and the stamps `act.gate[date].quiz` records.

### What the sixth packet never carries

Never `profile.name`, `birth`, `email`, `phone`, a school or an employer name — no `## 이력` line at all, like the prep packet. Never a transcript, an event's `place` or `note`, a document's `source`. A meeting flagged `aiHidden` contributes its date and title only, in every section it could otherwise appear in. `tools/e2e/flow12.js` step 4 plants a sentinel on each of these fields and asserts every one absent from the built packet text, while the content the reader and the issue list state that day (a decision line, an event title, a document title, a training summary, a hidden meeting's date/title) is present.
