# Daily briefing and journal
<!-- src: SPEC-4-2 -->

The daily briefing: what the saved state says about today, stated as facts with numbers ([Rule 13](../design-docs/core-beliefs.md#rule-13)). Nothing in it is stored — it is recomputed from `(state, today)` on every render ([Rule 9](../design-docs/core-beliefs.md#rule-9)). The rules behind each line are in [../design-docs/assistant-bridge.md](../design-docs/assistant-bridge.md).

Since 2026-09-17 (schema v27), the briefing no longer opens on its own: the **daily reader** (`오늘 읽을 것`,
[daily-reader.md](daily-reader.md)) opens once a day in its place, and reuses this modal's `biz` and `goals`
items verbatim in two of its own sections so the two screens cannot state a different number. Everything below —
every section, the footer and the journal/weekly-review routes — is otherwise unchanged; only "When it opens"
(below) reflects the change.

There is no card for this on any tab any more (2026-09-15): home is a CV with no date-scoped facts, so the manual way back into the briefing sits on `할 일` (renamed from `실행` 2026-09-16) instead — see "When it opens" below. `buildBriefing` itself dropped its `counts` return value along with the card that was its only reader; `sections` (the table below) is unchanged.

## `BriefingModal` (`modal.type: "briefing"`)
Title `오늘 브리핑 — {today}`. One block per section, each with a `SectionLabel` and its lines. Line colour follows severity: 3 rose-400, 2 amber-300, 1 zinc-300. A line with an action is a button ending in ` ›`.

| Section | Lines |
|---|---|
| `오늘 할 일` | when any work item is carried from an earlier day (schema v26), a first line `이월 업무 {n}건 · 최장 {d}일 · 직장 {a} · 사업 {b} · 개인 {c}` (the per-track counts appended v28, opens `업무`, never a title), then overdue, due today, then open daily tasks; `해당 없음` when there are none of the latter three. Tapping a task line runs the normal completion path (`tryComplete`), so evidence gates still apply ([Rule 10](../design-docs/core-beliefs.md#rule-10)) |
| `오늘 일정` | today's deadlines and appointments, the deadlines already past, and the ones inside the next 3 days; each line prefixed with its track label and ` · ` (v28); `해당 없음` when there are none. Every line switches to the 일정 tab ([schedule.md](schedule.md)) — an event is a record, so nothing here can be completed from the briefing |
| `회의 준비` (schema v26) | `오늘 회의 준비 {n}건 · 직장 {a} · 사업 {b} · 개인 {c}` (per-track counts v28, plus ` · 내일 {m}건` when any), opening `업무`; when any follow-up is overdue, a second line `후속 기한 지남 {n}건 · 내 담당 {m}건`, opening `미팅`. Counts only, from `meetingPrepOf` — never a meeting or follow-up's title ([Rule 13](../design-docs/core-beliefs.md#rule-13)) |
| `연속 기록` | one line stating whether today is recorded, whether the streak breaks tonight, or whether a 보호권 (streak shield) will be spent |
| `목표 페이스` | one line per active goal: D-day, progress, pace verdict, and the unmet KRs when the deadline is within 7 days or already past |
| `사업` | in order: at most `BIZ_ALERT_MAX` (3) unpaid billed months — the same cap and the same three months the `할 일` tab's to-do list names ([tasks.md](tasks.md)); up to `PAYMENT_ALERT_MAX` (3, v28) unpaid lump-sum lines (`{client} {title} — {kind} 입금 예정 {due} · 미확인`); a `won` contract ending within `DEAL_END_SOON` months, and a `quote` older than `QUOTE_STALE_DAYS` days; `다음 액션 기한 지난 리드 {n}건` (v28, a count only, `n > 0` only); up to `NOTICE_ALERT_MAX` (2, v28) open-notice lines (`공고 {title} — 마감 {D-day}`); up to `ROADMAP_ALERT_MAX` (2, v28) not-done milestone lines (`마일스톤 {title} — {D-day}`, filtered by `milestoneTrack` — see [assistant-bridge.md](../design-docs/assistant-bridge.md)); then always a closing line stating this month's contracted, collected and remaining totals — the section is never empty, so this summary line is never dropped even when the alerts above it fill the section's cap (a full slate of alerts can instead crowd out the ending-contract or stale-quote line first — accepted, TD-72). Every line switches to the 사업 tab ([business.md](business.md)) — a business record is a record, so nothing here can be completed from the briefing |
| `영역·활동` | 영역 (areas) with no achievement in 30 days, and goals whose activity kind has no completion in 7 days; `최근 30일 정체 영역 없음 · 최근 7일 활동 공백 없음` when there is neither. A stagnant-area line switches to `home` (2026-09-15) — the area's grade row and its promotion gate live on the CV now, not on a tab of their own; an activity-gap line still switches to `goals` |
| `다음 단계` | the first role-model gap and the standard achievement that would close it, from the same source as 방향 제안 (direction advice, now `RoleGradeSection` inside the `롤모델` screen); when the gap's area is `사업` and `role.stages` exist, the tail becomes `다음: {stage}단계 {name} · 조건 {c}/{m}` instead (v28, [metrics-and-role-model.md](../design-docs/metrics-and-role-model.md#role-stages-v28) — stage numbers and counts only, never a business record's own name); the line opens the `롤모델` screen (`{ type: "role" }`) in every case since 2026-09-18 — with a usable role model it opens the same screen a gap would have opened (`RoleAdviceModal` until that day); without one it opens the story section directly instead of switching tabs, since setting a role model lives in `SettingsModal`, not on a tab of its own |
| `주간 리뷰` | whether this week's review exists |
| `일지` | today's journal length and whether an assistant reply is stored |

Footer: (2026-09-17) a full-width border button `오늘 읽을 것 ›` → the daily reader ([daily-reader.md](daily-reader.md)), then `AI에게 보내기`, `AI 답변 붙여넣기`, then `일지 쓰기` and `닫기`. Closing the modal — by any button, the X, or the backdrop — stamps `act.briefingSeen = today`, the same marker the daily reader now also stamps on close.

## When it opens
- **No longer at boot or on a day change** (2026-09-17): the daily reader opens there instead — see
  [daily-reader.md](daily-reader.md#when-it-opens).
- From the `할 일` tab's header chip row, `브리핑 열기 ›`, at any time (2026-09-15) — through it the way to the journal, the weekly review and the assistant bridge. It sits on `할 일` because the briefing opens with `오늘 할 일` and that is the tab already showing today's tasks; see [tasks.md](tasks.md).
- From the daily reader's own footer button, `브리핑 ›` (2026-09-17).

## `JournalModal` (`modal.type: "journal"`)
Title `일지 — {today}`. A textarea with the placeholder `오늘 한 일 · 수치 · 막힌 것 — 사실만 적어요`, a `저장` button (toast `일지를 저장했어요`), and an autosave when the modal is closed with unsaved changes. When today's entry holds an assistant reply it is shown below under `AI 답변 · {aiDate}`. A `최근 7일` list shows the previous entries collapsed to `{date} · {first 40 characters}`; tapping one expands it with its stored reply. Empty state: `일지 기록 없음`.

Entries are stored one per date in `journal[]` and upserted, so writing again on the same day replaces that day's text.

## `BridgeModal` (`modal.type: "bridge"`)
Two modes. **Send** (`AI에게 보내기`) explains `아래 글을 복사해 Claude·ChatGPT 채팅에 붙여넣고, 답변을 받아 다시 붙여넣어요. 앱은 네트워크를 쓰지 않아요.`, shows the packet in a read-only textarea and offers `복사` (toast `복사했어요 — AI 채팅에 붙여넣어요`, or `자동 복사 불가 — 글을 길게 눌러 복사해요` when the browser refuses) and `AI 답변 붙여넣기 ›`. **Paste** takes the reply in a textarea (`AI 답변을 여기에 붙여넣어요`) and `답변 확인` shows `제안 실행 확인 — {n}건`: one checkbox row per proposal reading `{title} · {goal} · {diff} · {매일|1회} · 기한 {due}`, a `목표 선택` dropdown when the goal could not be matched, and a greyed row with its reason when the proposal is refused. `선택한 실행 등록` imports the checked rows and stores the reply; the toast is `AI 제안 {n}건 등록 · 일지에 답변 저장`, or `AI 답변을 일지에 저장했어요 — 제안 실행 없음` when nothing was proposed.

## `ReviewModal` (`modal.type: "review"`)
Title `주간 리뷰 — {Monday} 주`. A facts line `이번 주 완료 {n}건 · 성취 기록 {m}건` counts the completions and achievements dated on or after that Monday. Two textareas, `잘된 것 — 사실·수치로` and `막힌 것 — 원인`, prefilled from this week's review if one exists. Empty on both sides shows `잘된 것 또는 막힌 것을 한 줄 이상 적어요.` `리뷰 저장` upserts by week and stamps `act.lastReview`. Toast: `주간 리뷰를 저장했어요`.

**Per-track facts (v28).** After the existing facts line, three mono lines of nowrap fragments, from
`weekFacts(state, weekOf)` / `weekFactRows`:
```
직장 · 이번 주 기한 후속 {a}/{b} · 업무 완료 {c}건 · {h}
사업 · 이번 주 기한 후속 {a}/{b} · 업무 완료 {c}건 · {h}/{budget}h · 마일스톤 완료 {n}건 · 리드 진전 {m}건
개인 · 업무 완료 {c}건 · {h}
```
Follow-ups and work items store `done` only, with no completion stamp of their own, so the week is read from due
dates and item dates instead ([TD-71](../exec-plans/tech-debt-tracker.md), accepted): a follow-up counts when
its `due` falls inside the week (`meetingTrack` for the track), a work item counts when it is `done` and dated
inside the week, minutes are `weekMinutes(state, weekOf, track)`, and (business track only) a milestone counts
when its `doneAt` falls inside the week and a lead when its `stageAt` does, past the `potential` stage.

Under `리뷰 저장`, a border button `AI에게 회고 묻기 ›` opens the `주간 회고` packet (`reviewBridge`, below) —
**enabled only once this week's review is saved**, so the packet reads the stored review, never an unsaved
draft; otherwise disabled with the caption `먼저 리뷰를 저장해요 — 저장된 리뷰가 패킷에 실려요.`
