# Home tab
<!-- src: SPEC-4-2 -->

The first section is the 오늘 브리핑 card (see [daily-briefing.md](daily-briefing.md)). `HomeTab` is the landing screen after onboarding: a profile card, the three most urgent active goals with their 페이스 (pace), and up to five of today's open 실행 (tasks) with a one-tap completion that still goes through the evidence gate. Everything is derived from `state` at render time — nothing is stored ([Rule 9](../design-docs/core-beliefs.md#rule-9)). Props: `state, today, imgs, onUpload (askUpload), onClearImg (clearImg), onComplete (tryComplete), onGoGoals, onGoQuests, onGoSchedule, onGoBiz` — the last four switch the bottom tab to 목표 / 실행 / 일정 / 사업.

## Profile card
- Portrait: `Portrait` at size 72 renders `imgs.profile` when a photo exists, otherwise the parametric `PortraitSprite` from `profile.look` and `profile.gender`. With a photo present a `✕` button calls `onClearImg("profile")` → `clearImg` clears it from memory and deletes the `liferpg-img-profile` key.
- Upload: the `업로드` button (Camera icon) calls `onUpload("profile")` → `askUpload` records the slot and clicks the hidden `<input type="file" accept="image/*">` owned by `App`; `onFile` runs `resizeImage` (256×320 cover crop, JPEG quality 0.82, data URL), stores it under `liferpg-img-profile`, and toasts `📷 사진이 등록됐어요` — on a decode failure `이미지를 읽지 못했어요`.
- Text: `profile.nick`; one line listing every 영역 (area) as `{area.name} {RANKS[grade].name}` joined by ` · `; `오늘 {doneToday}건 완료`, where `doneToday` = `daily` tasks whose `doneDates` includes `today` + `once` tasks with `doneAt === today`.
- The streak `🔥 {act.streak}일` (amber) and 보호권 (streak shields) `🛡 {act.shieldsLeft}` are not on this card: `App` renders them in the header of every tab, next to `nick · status`.

## 오늘 브리핑 card
Three mono lines and, when one exists, the first severity-3 line of the briefing in rose. The second mono line is
a button: `오늘 일정 {n}건 · 3일 내 마감 {n}건 ›` (`brief.counts.events` / `brief.counts.dueSoon`, the 3 read from
`EVENT_SOON_DAYS`) → `onGoSchedule` switches to the 일정 tab. The third, reading the same `buildBriefing` call:
`이번 달 계약 {won} · 입금 미확인 {n}건 ›` (`brief.counts.bizMonth` / `brief.counts.bizUnpaid`, the unpaid count
rose when above zero) → `onGoBiz` switches to the 사업 tab. Both are date/money facts that belong beside the other
today numbers, which is why they are lines here instead of a fifth and sixth card. Full card:
[daily-briefing.md](daily-briefing.md); the tabs themselves: [schedule.md](schedule.md), [business.md](business.md).

## 오늘의 초점 (today's focus)
`SectionLabel` in cyan with `전체 보기 ›` (→ goals tab). `focus` = active goals sorted ascending by `deadline || "9999"` (undated goals last), first 3.
- No active goal: `EmptyGoalSvg`, `목표 없음 — 진행률을 계산할 대상이 없습니다.`, button `첫 목표 세우기` (→ goals tab).
- Each card is one button (→ goals tab): title + `ddayStr(deadline)` (`D-{n}` / `D-DAY` / `D+{n}`, empty when undated); `Bar(pc.p)` in `bg-cyan-400`; a mono line `진행 {round(p·100)}%`, then ` · 시간 경과 {round(el·100)}%` only when `pc.el` is not null (deadline and `createdAt` present), then ` · {pc.label}` in `pc.cls`. `pc = paceOf(goal, state)`: `gap = round((p − el)·100)`; label `{−gap}%p 뒤처짐` (rose) when `gap ≤ −5`, `{gap}%p 앞섬` (emerald) when `gap ≥ 5`, else `궤도 유지`; `기한 없음` without a deadline. Formulas: `goal-engine.md` in `../design-docs/`. Pace is never hidden ([Rule 13](../design-docs/core-beliefs.md#rule-13)).

## 오늘 할 일 (today's tasks)
The list is `agendaOf(state, today).all`, ordered overdue → due today → daily → due this week → undated, capped at five rows. Each row shows a `DueChip`: `기한 지남` (rose) when the date has passed, otherwise `ddayStr(due)` with `D-DAY` amber for today.
`SectionLabel` with `관리 ›` (→ tasks tab). `todayQuests` = tasks where `daily` → `!doneDates.includes(today)` and `once` → `status !== "done"`, in state order, `slice(0, 5)`. Empty: `오늘 예정된 할 일이 없습니다.`
- Row: a check button (`Check` icon drawn `text-transparent`) → `onComplete(q)` = `tryComplete`, which opens `StudyVerifyModal` (`isStudy`), `ActivityLogModal` (`kind`), or `EvidenceModal` (`needsEvidence`) before `completeTask` runs — [Rule 10](../design-docs/core-beliefs.md#rule-10), [Rule 16](../design-docs/core-beliefs.md#rule-16), [Rule 17](../design-docs/core-beliefs.md#rule-17); the goal-delta toast comes from `completeTask`, not from this tab. Title with kind prefix `📚 ` / `💪 ` for `book` / `fit`; subtitle `{area.name}[ · 🎯 {goal.title}][ · 매일]`, plus ` · 목표 연결 없음` when the task has no goal. Right side: `isExam` → `시험 D{band.d}`, `isCert` → `자격 D{certD}` (both coloured by `GRADE_TEXT` / `GRADE_BORDER` of `achGrade(d)`), otherwise `DiffBadge(diff)`.
