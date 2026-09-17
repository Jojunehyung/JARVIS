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
| `today` | when any work item is carried from an earlier day (`state.work`, undone, dated before today — schema v26), a first line `이월 업무 {n}건 · 최장 {d}일` (`n` = the carried count, `d` = the largest `daysBetween`), `action: { type: "work" }`, severity 3 — a count only, never a title (rule 13); then overdue → `{title} — 기한 {due} 지남 ({D+n})`; due today → `{title} — 오늘 기한`; open daily → `{title} — 매일 · 미완료` | 3 / 3 / 3 / 1 |
| `events` | today's schedule and the deadlines around it, in this order: today's `마감` → `{title} — 오늘 마감`; a `마감` already past → `{title} — 마감 {date} 지남 (D+{n})`; a `마감` inside `EVENT_SOON_DAYS` → `{title} — D-{n} 마감`; today's `약속` → `{title} — {HH:MM} 약속` or `{title} — 시간 미정 · 약속`; `해당 없음` when there is none. Ticked occurrences are left out — the tab keeps them so `완료 취소` stays reachable. Every line carries `action: { type: "schedule" }`, which `closeBriefing` routes to the 일정 tab | 3 / 3 / 2 / 2 / 1 |
| `prep` (`회의 준비`, schema v26) | `오늘 회의 준비 {n}건` (`n` = `meetingPrepOf` rows dated today) with ` · 내일 {m}건` appended only when `m > 0`, `action: { type: "work" }`, severity 2 when any row exists else 1 (stated even at zero — rule 13); when any follow-up across every meeting is `!done && due && due < today`, a second item `후속 기한 지남 {n}건 · 내 담당 {m}건` (`m` = those with `mine`), `action: { type: "meetings" }`, severity 3. Counts only, never a meeting or follow-up's own text | 2 / 1 / 3 |
| `streak` | `lastActive === today` → recorded; `=== today − 1` → the streak breaks unless something is completed today; `=== today − 2` with a shield left → completing today spends one 보호권 (streak shield); otherwise the next completion resets the streak to 1. Mirrors what `completeTask` actually does | 1 / 3 / 3 / 2 |
| `goals` | every active goal, nearest deadline first: `{title} — {D-day} · 진행 {n}% · {pace}`. Severity 3 when `paceOf.gap <= −5`, when the deadline is within 7 days and progress is below 100 %, or when it has passed; those cases append the unmet KRs via `krRemainText` (at most two) | 3 / 1 |
| `biz` | records, never tasks: at most `BIZ_ALERT_MAX` (3) unpaid billed months (`{client} {title} — {month} 입금 미확인 {won}`) — the same constant and the same months the `실행` tab's to-do list names ([../product-specs/tasks.md](../product-specs/tasks.md)); a `won` deal ending within `DEAL_END_SOON` months (`{client} {title} — {month} 종료 · 남은 계약 {won}`); a `quote` older than `QUOTE_STALE_DAYS` days (`{client} {title} — 견적 {n}일 경과 · {won}`); then always the closing line `이번 달 계약 매출 {won} · 입금 확인 {won} · 남은 계약 {won}`. The closing line is the reason the section exists, so it is built last from at most `CAP − 1` alerts rather than a plain sixth item — three unpaid months plus two ending contracts would otherwise fill `CAP` and push it out. Every line carries `action: { type: "biz" }`, which `closeBriefing` routes to the 사업 tab ([business.md](../product-specs/business.md)) | 3 / 2 / 2 / 1 |
| `areas` | 영역 (areas) with no achievement in 30 days (role-model targets first, at most 3), `action: { type: "home" }` — the area's grade row and its promotion gate live on the CV; goals whose activity kind has no completion in 7 days (at most 3), `action: { type: "goals" }` | 2 |
| `next` | no role model → say so; no gaps → `모든 요구 영역 충족 · 근접도 {n}%`; otherwise the first gap and its top recommendation from `roleRecommendations` | 2 / 1 / 2 |
| `review` | no review whose `weekOf` is this Monday → `이번 주 리뷰 없음 (마지막 {date})` | 2 / 1 |
| `journal` | today's entry length, and the date of a stored assistant reply | 1 |

A tab-switch action is only ever taken when its `type` is in the module-level whitelist `TAB_ACTIONS = ["home",
"goals", "work", "schedule", "meetings", "biz"]` (2026-09-15: `"growth"` replaced by `"home"` when the growth tab
was removed — [home.md](../product-specs/home.md); `"work"` and `"meetings"` added 2026-09-17 for the carried-work
line and the overdue-follow-up line, respectively), checked by `closeBriefing`. An action type outside this list is not a
no-op: `closeBriefing` handles `task` separately, before the list, and opens every other type as the `modal.type`
of the same name that the root renders directly — `bridge`, `journal`, `review`, `roleAdvice` and `role`.

Thresholds are named constants: `AREA_STALE_DAYS` 30, `ACTIVITY_GAP_DAYS` 7, `CAP` 5, `QUOTE_STALE_DAYS` 7,
`DEAL_END_SOON` 2 months.

## `roleRecommendations(state)`
Extracted from `RoleAdviceModal` so the briefing and the direction-advice screen compute the same thing. Returns `{ rg, gaps }` where each gap carries the area, the grades, the category hints (`areaCatHints`), up to four certification recommendations sorted by job-fit multiplier then ascending difficulty, and up to three next exam bands. The tiering and payout maths are unchanged ([Rule 14](core-beliefs.md#rule-14), [Rule 15](core-beliefs.md#rule-15)).

## The bridge — `buildAssistantPacket(state, today)`
A text packet the user copies into an external chat. It opens with the role and the four rules the assistant must follow (facts and numbers only, `해요체`, no judging scores or difficulty, proposals limited to day-sized tasks under an existing goal whose title names the activity (`제목에 독서·운동처럼 활동을 그대로 적어요.`) — never a certification, an exam, or a business record — and a closing JSON block whose template no longer offers a `kind` field), then the data:

| Section | Content | Cap |
|---|---|---|
| `## 오늘 브리핑` | briefing lines of severity 2 and above — since schema v26 this includes the `회의 준비` section's counts (`오늘 회의 준비 {n}건`, and, once any follow-up is overdue, `후속 기한 지남 {n}건 · 내 담당 {m}건`) whenever their severity qualifies, and the carried-work line (`이월 업무 {n}건 · 최장 {d}일`) when it does — never a meeting or follow-up title | 12 |
| `## 이력` | one line built from `cvSummaryOf(profile, today)` — the same helper the home CV's `학력` / `경력` rows read ([home.md](../product-specs/home.md)), lifted out of this function 2026-09-15 so the two surfaces cannot state a different degree or role: degree + status label (`박사 졸업`, not a bare `박사` — `topEdu` falls back to the most recent entry when nothing is completed, and a bare degree would imply one the user does not hold) + major/field (or `전공 미기재`), then total practice months (`careerMonths`) + the latest role; `학력 미입력` when there is no education entry at all, `경력 없음` when there is no career entry, and `- 없음` for the whole line only when both are absent (`cvSummaryOf(...).any` false). Deliberately excludes `profile.name`, `birth`, `email`, `phone`, the school name and the employer name — a school or an employer identifies a person nearly as well as a name does, and this is the one place data leaves the device by design (see `docs/SECURITY.md`) | 1 |
| `## 목표` | active goals: deadline, D-day, progress, pace, KR remainders | 5 goals × 4 KRs |
| `## 열린 실행` | the agenda in order: goal, title, difficulty, cadence, due | 12 |
| `## 다가오는 일정 (14일)` | `- {date} {HH:MM\|시간 미정} · {약속\|마감} · {title}{ · 반복 {매일\|매주\|매월}}`, date-ascending from `upcomingEvents(state, today, PACKET_EVENT_DAYS)`; the heading and the window read the same constant | 8 |
| `## 사업 (계약·매출)` | the summary line `- 이번 달 계약 {won} · 입금 확인 {won} · 남은 계약 {won} · 견적 대기 {won}`, then `- 미수 {month} {client} {title} {won}` per unpaid billed month, then `- {진행 중\|예정} {client} {title} · {startMonth} ~ {endMonth} · 월 {won}` for `active`/`upcoming` deals — `bizPacketLines(state, today)` (2026-09-17, lifted to module level so the work packet below reuses it), built from the same `bizSummary` the tab and the briefing read, before the journal-trim loop below so its cap and behaviour are unaffected | `PACKET_BIZ_LINES` = 6 |
| `## 최근 일지 (7일)` | journal entries clipped to 200 characters | 7 |
| `## 최근 주간 리뷰` | the newest review | 1 |
| `## 연속·롤모델` | streak, shields, role-model proximity | 2 lines |

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
| `## 최근 회의록 ({n}건)` | newest meetings by `meetingOrder`. Visible: `- {date} [{project name \| 프로젝트 없음}] {title}` — a project-less urgent memo (2026-09-17, `projectId: null`) prints `[프로젝트 없음]` through the same fallback, unchanged — then what the meeting view states besides the minutes — `  참석: {attendees}` (when recorded), `  일정: {meetingEventText}` (when an event is linked) and `  연결된 할 일: {title} ({매일 · 오늘 }완료\|미완료) · …` for every linked task that still exists (all three added 2026-09-17; until then the packet left them out) — then `  요약:` / `  결정:` lines (each present only when the field is non-empty, newline-joined with `" / "`; a clipped text ends in `…`), then, when the meeting has follow-up items (schema v26), `  후속 {n}건:` followed by one `  - {내 담당\|타인} · {기한 YYYY-MM-DD\|기한 없음} · {완료\|미완료} · {text}` line per item (open first, then done, so a trim drops the done ones first) — the raw `  후속: {actions}` line appears **only** when the meeting has free text but no items, so nothing is stated twice — then `  진행 {date}: {text}` for the newest progress entries. Hidden (`aiHidden`): `- {date} {title}` then `  내용 비공개 (AI에 보내지 않기)` and nothing else — no project name either | `WORK_PACKET_MEETINGS` (10 meetings; 6 until 2026-09-17) × `WORK_PACKET_PROGRESS` (5 entries) × `WORK_PACKET_FOLLOWUPS` (30 follow-up items); summary up to `WORK_PACKET_SUMMARY` (5,000 — the whole field), decisions/follow-ups/progress text up to `WORK_PACKET_CLIP` (600) / `MEETING_LIMITS.followUp` (200) — the whole field. Until 2026-09-17 these were 200 and 100 with 3 entries, which cut every meeting's content |
| `## 업무 기록 (이월·어제·오늘)` | every undone item carried into today (`workOn(state, today, today)`) plus yesterday's items, deduped by id, date then `createdAt` ascending: `- {date} {완료\|미완료}{ · 이월 {n}일}{title}{ · 메모: note}{ · 처리: result}` (the `이월` fragment only on an undone carried item; `처리` only on a done item with a result, up to `WORK_PACKET_RESULT` = 300 chars, added 2026-09-17; note up to `WORK_PACKET_NOTE`, 200 — the whole field; 60 until 2026-09-17; heading widened from `어제·오늘` at schema v26) | `WORK_PACKET_RECORDS` (20) |

`WORK_PACKET_HEAD` states the role, five numbered rules (facts only, `해요체`; never judge or change a score/grade/payout/difficulty; propose only today's work items, with no count limit (`건수 제한 없이`; `최대 8건` until 2026-09-17), title ≤ 60 / note ≤ 200, never create a task/event/contract/meeting, never re-propose a title already in `업무 기록` — a carried item is in that section too, so rule 3 already covers it, and `parseWorkReply`'s own dedupe (below) reads the same `workOn` call and refuses it a second time; name the goal/meeting/project a proposal is based on in `link.title`, verbatim, or omit `link`; close with a ≤ 5-line analysis then one JSON block, `"work": []` when there is nothing to propose) and the reply template
`{"work":[{"title":"...","note":"...","link":{"kind":"goal|meeting|project","title":"..."}}],"note":"..."}`.

**Trim order** when the built text exceeds `WORK_PACKET_MAX`, applied as an ordered list of reduction closures, rebuilding and re-measuring after each step until it fits or the list is exhausted: (0) summary clip 5,000 → `WORK_PACKET_SUMMARY_TRIM` (1,500); (1) meetings 10 → 2, dropping the oldest; (2) follow-up items 30 → 5 per meeting, open ones kept first (schema v26, new step); (3) summary clip → 500 and progress 5 → 1 per meeting, together; (4) schedule lines 8 → 0; (5) business lines to the first line only; (6) open-task lines 10 → 0; (7) work-record lines 20 → 0 (last before the meeting floor — the parser dedupes proposals against `업무 기록` on its own, so losing the section only weakens that hint, never breaks a rule); (8) meetings 2 → 0. The header, the CV line and the goals section are never dropped. Measured on the demo build (2026-09-17): the demo daily packet excerpt with a prep-heavy save is 2,324 characters; the demo work packet gives 2,260 characters with nothing clipped; a heavy save (many meetings, full follow-ups) trims to two meetings of five follow-ups each at about 11,700 characters; a single meeting with thirty full follow-ups goes whole at 11,127 characters, no trim needed. A packet this long is still one paste: Claude takes it inline, and ChatGPT may turn a long paste into an attached file, which it reads.

### The reply — `parseWorkReply(text, state, today)`

Reads the reply through the same `replyJson` (fence optional); only `data.work` (array, every entry — no count limit since 2026-09-17; it was 8, then briefly 20, and 8 cut a reply short when one meeting alone had ten follow-ups) and `data.note` (≤ 200 chars) are read. `tasks`, `deals`, `events`, `meetings`, or any other key in the same reply is not merged, not stored, not even inspected beyond being ignored — proven by an E2E step that pastes a reply naming all four and asserts none of `tasks`/`deals`/`events`/`meetings`/`work`/`journal` changed.

| Field | Rule |
|---|---|
| `title` | trimmed to `WORK_LIMITS.title` (60); empty → `reject: "제목이 없어요"` |
| `note` | trimmed to `WORK_LIMITS.note` (200); `""` when absent |
| `link` | read only when `link.kind` is `goal`/`meeting`/`project` and `link.title` is a non-empty string; resolved against active goals / all meetings (newest first) / all projects by exact title match, then substring either way, first hit wins; no hit → `link: null`, `linkText: "연결 없음 — {wanted}"`; a bad `kind` → `null` |
| duplicate | `reject: "오늘 업무에 이미 있어요"` when `normWorkTitle(title)` equals an item already in `workOn(state, today, today)` (today's carried view, schema v26) or an earlier proposal in the same reply |

Returns `{ raw, note, proposals }`, each proposal `{ key: "w{n}", title, note, link, linkText, reject }`; nothing here writes state — `WorkBridgeModal`'s confirm view ticks/unticks and `importWork` (root) is what registers a record, with `source: "ai"` and `done: false`, from the ticked, non-rejected proposals only. The raw reply is never stored (unlike the daily bridge's `journal[].ai`) — storing it would collide with that key, and nothing derived needs to survive a reload here.

### Shared UI pieces

`copyPacket(taRef, text, onToast)`, `PacketSendPane({ packet, caption, taRef, onCopy, onPaste })` and `ReplyPastePane({ reply, setReply, onCheck })` are lifted out of `BridgeModal` to module level so `WorkBridgeModal` reuses them without a six-line duplicate; `BridgeModal`'s own copy and behaviour are unchanged from the user's side.

### What the work packet never carries

Exactly like the daily packet's `## 이력` line: never `profile.name`, `birth`, `email`, `phone`, a school name or an employer name — only what `cvSummaryOf` states. No photo, no evidence text, no journal entry (the journal is the daily packet's domain, not this one's). A hidden meeting's line never states its project name either, only its date and title. **Since 2026-09-17, never a meeting's `transcript`**: `meetingLines` carries a comment marking the omission and reads only the named fields above (summary, decisions, follow-ups, progress, attendees, linked schedule and tasks) — a pasted transcript, however long, contributes nothing to this packet, the daily packet, the calendar file (`buildIcs`) or the prep card (`meetingPrepOf`), by the user's own decision ([SECURITY.md](../SECURITY.md)); `tools/e2e/flow11.js` plants a sentinel string inside a transcript and asserts it absent from the built packet text.
