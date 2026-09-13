# Daily briefing and journal
<!-- src: SPEC-4-2 -->

Opening the app on a new day shows a briefing: what the saved state says about today, stated as facts with numbers ([Rule 13](../design-docs/core-beliefs.md#rule-13)). Nothing in it is stored — it is recomputed from `(state, today)` on every render ([Rule 9](../design-docs/core-beliefs.md#rule-9)). The rules behind each line are in [../design-docs/assistant-bridge.md](../design-docs/assistant-bridge.md).

## Home card
A card above 오늘의 초점 (today's focus), labelled `오늘 브리핑`:
- counts line: `기한 지남 {n} · 오늘 기한 {n} · 매일 남음 {n} · 뒤처짐 {n}`
- schedule line, a button that switches to the 일정 tab: `오늘 일정 {n}건 · 3일 내 마감 {n}건 ›` — today's occurrence count and the `마감` occurrences inside `EVENT_SOON_DAYS` (3 days, today included)
- business line, a button that switches to the 사업 tab: `이번 달 계약 {won} · 입금 미확인 {n}건 ›` — `bizSummary`'s contracted total for this month and its unpaid billed-month count, rose when above zero
- the first severity-3 line of the briefing, in rose, when there is one
- buttons `브리핑 열기 ›` and `일지 쓰기`

## `BriefingModal` (`modal.type: "briefing"`)
Title `오늘 브리핑 — {today}`. One block per section, each with a `SectionLabel` and its lines. Line colour follows severity: 3 rose-400, 2 amber-300, 1 zinc-300. A line with an action is a button ending in ` ›`.

| Section | Lines |
|---|---|
| `오늘 할 일` | overdue, due today, then open daily tasks; `해당 없음` when there are none. Tapping a line runs the normal completion path (`tryComplete`), so evidence gates still apply ([Rule 10](../design-docs/core-beliefs.md#rule-10)) |
| `오늘 일정` | today's deadlines and appointments, the deadlines already past, and the ones inside the next 3 days; `해당 없음` when there are none. Every line switches to the 일정 tab ([schedule.md](schedule.md)) — an event is a record, so nothing here can be completed from the briefing |
| `연속 기록` | one line stating whether today is recorded, whether the streak breaks tonight, or whether a 보호권 (streak shield) will be spent |
| `목표 페이스` | one line per active goal: D-day, progress, pace verdict, and the unmet KRs when the deadline is within 7 days or already past |
| `사업` | at most `BIZ_ALERT_MAX` (3) unpaid billed months — the same cap and the same three months the `실행` tab's to-do list names ([tasks.md](tasks.md)) — a `won` contract ending within `DEAL_END_SOON` months, and a `quote` older than `QUOTE_STALE_DAYS` days, then always a closing line stating this month's contracted, collected and remaining totals — the section is never empty, so this summary line is never dropped even when the alerts above it fill the section's cap. Every line switches to the 사업 tab ([business.md](business.md)) — a business record is a record, so nothing here can be completed from the briefing |
| `영역·활동` | 영역 (areas) with no achievement in 30 days, and goals whose activity kind has no completion in 7 days; `최근 30일 정체 영역 없음 · 최근 7일 활동 공백 없음` when there is neither |
| `다음 단계` | the first role-model gap and the standard achievement that would close it, from the same source as 방향 제안 (direction advice) |
| `주간 리뷰` | whether this week's review exists |
| `일지` | today's journal length and whether an assistant reply is stored |

Footer: `AI에게 보내기`, `AI 답변 붙여넣기`, then `일지 쓰기` and `닫기`. Closing the modal — by either button, the X, or the backdrop — stamps `act.briefingSeen = today`, so the briefing opens once per day.

## When it opens
- At boot, when `act.briefingSeen !== today`.
- When the day changes while the app stays open. The root keeps `day` in state and re-reads the date on `visibilitychange`, on `focus`, and on a 60-second tick; `today` is that value everywhere, so a session left open past midnight no longer completes tasks against yesterday.
- From the home card at any time.

## `JournalModal` (`modal.type: "journal"`)
Title `일지 — {today}`. A textarea with the placeholder `오늘 한 일 · 수치 · 막힌 것 — 사실만 적어요`, a `저장` button (toast `일지를 저장했어요`), and an autosave when the modal is closed with unsaved changes. When today's entry holds an assistant reply it is shown below under `AI 답변 · {aiDate}`. A `최근 7일` list shows the previous entries collapsed to `{date} · {first 40 characters}`; tapping one expands it with its stored reply. Empty state: `일지 기록 없음`.

Entries are stored one per date in `journal[]` and upserted, so writing again on the same day replaces that day's text.

## `BridgeModal` (`modal.type: "bridge"`)
Two modes. **Send** (`AI에게 보내기`) explains `아래 글을 복사해 Claude·ChatGPT 채팅에 붙여넣고, 답변을 받아 다시 붙여넣어요. 앱은 네트워크를 쓰지 않아요.`, shows the packet in a read-only textarea and offers `복사` (toast `복사했어요 — AI 채팅에 붙여넣어요`, or `자동 복사 불가 — 글을 길게 눌러 복사해요` when the browser refuses) and `AI 답변 붙여넣기 ›`. **Paste** takes the reply in a textarea (`AI 답변을 여기에 붙여넣어요`) and `답변 확인` shows `제안 실행 확인 — {n}건`: one checkbox row per proposal reading `{title} · {goal} · {diff} · {매일|1회} · 기한 {due}`, a `목표 선택` dropdown when the goal could not be matched, and a greyed row with its reason when the proposal is refused. `선택한 실행 등록` imports the checked rows and stores the reply; the toast is `AI 제안 {n}건 등록 · 일지에 답변 저장`, or `AI 답변을 일지에 저장했어요 — 제안 실행 없음` when nothing was proposed.

## `ReviewModal` (`modal.type: "review"`)
Title `주간 리뷰 — {Monday} 주`. A facts line `이번 주 완료 {n}건 · 성취 기록 {m}건` counts the completions and achievements dated on or after that Monday. Two textareas, `잘된 것 — 사실·수치로` and `막힌 것 — 원인`, prefilled from this week's review if one exists. Empty on both sides shows `잘된 것 또는 막힌 것을 한 줄 이상 적어요.` `리뷰 저장` upserts by week and stamps `act.lastReview`. Toast: `주간 리뷰를 저장했어요`.
