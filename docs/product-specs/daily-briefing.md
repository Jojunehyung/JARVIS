# Daily briefing and journal
<!-- src: SPEC-4-2 -->

Opening the app on a new day shows a briefing: what the saved state says about today, stated as facts with numbers ([Rule 13](../design-docs/core-beliefs.md#rule-13)). Nothing in it is stored — it is recomputed from `(state, today)` on every render ([Rule 9](../design-docs/core-beliefs.md#rule-9)). The rules behind each line are in [../design-docs/assistant-bridge.md](../design-docs/assistant-bridge.md).

## Home card
A card above 오늘의 초점 (today's focus), labelled `오늘 브리핑`:
- counts line: `기한 지남 {n} · 오늘 기한 {n} · 매일 남음 {n} · 뒤처짐 {n}`
- the first severity-3 line of the briefing, in rose, when there is one
- buttons `브리핑 열기 ›` and `일지 쓰기`

## `BriefingModal` (`modal.type: "briefing"`)
Title `오늘 브리핑 — {today}`. One block per section, each with a `SectionLabel` and its lines. Line colour follows severity: 3 rose-400, 2 amber-300, 1 zinc-300. A line with an action is a button ending in ` ›`.

| Section | Lines |
|---|---|
| `오늘 할 일` | overdue, due today, then open daily tasks; `해당 없음` when there are none. Tapping a line runs the normal completion path (`tryComplete`), so evidence gates still apply ([Rule 10](../design-docs/core-beliefs.md#rule-10)) |
| `연속 기록` | one line stating whether today is recorded, whether the streak breaks tonight, or whether a 보호권 (streak shield) will be spent |
| `목표 페이스` | one line per active goal: D-day, progress, pace verdict, and the unmet KRs when the deadline is within 7 days or already past |
| `지표·영역` | metrics check-in age, 영역 (areas) with no achievement in 30 days, and goals whose activity kind has no completion in 7 days |
| `다음 단계` | the first role-model gap and the standard achievement that would close it, from the same source as 방향 제안 (direction advice) |
| `주간 리뷰` | whether this week's review exists |
| `일지` | today's journal length and whether an assistant reply is stored |

Footer: `일지 쓰기` and `닫기`. Closing the modal — by either button, the X, or the backdrop — stamps `act.briefingSeen = today`, so the briefing opens once per day.

## When it opens
- At boot, when `act.briefingSeen !== today`.
- When the day changes while the app stays open. The root keeps `day` in state and re-reads the date on `visibilitychange`, on `focus`, and on a 60-second tick; `today` is that value everywhere, so a session left open past midnight no longer completes tasks against yesterday.
- From the home card at any time.

## `JournalModal` (`modal.type: "journal"`)
Title `일지 — {today}`. A textarea with the placeholder `오늘 한 일 · 수치 · 막힌 것 — 사실만 적어요`, a `저장` button (toast `일지를 저장했어요`), and an autosave when the modal is closed with unsaved changes. When today's entry holds an assistant reply it is shown below under `AI 답변 · {aiDate}`. A `최근 7일` list shows the previous entries collapsed to `{date} · {first 40 characters}`; tapping one expands it with its stored reply. Empty state: `일지 기록 없음`.

Entries are stored one per date in `journal[]` and upserted, so writing again on the same day replaces that day's text.

## Metrics check-in
`saveMetrics` now also stamps `act.lastCheckin = today`, and the growth tab's metrics footer ends with ` · 마지막 체크인 {date or 없음}`. The stamp is a date, not a verdict: the metric values themselves still move only through `metricsGain` and the check-in sliders ([Rule 8](../design-docs/core-beliefs.md#rule-8)).
