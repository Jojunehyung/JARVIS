# Information architecture
<!-- src: SPEC-3 -->

The app is a four-level hierarchy — 영역 (area) → 목표 (goal) → KR (key result) → 실행 (task) — shown through six tabs, eighteen modals, and two overlays. The fourth tab, 일정 (schedule), and the fifth, 사업 (business), both sit outside the hierarchy: an event or a business record is a dated record with no goal above it ([../product-specs/schedule.md](../product-specs/schedule.md), [../product-specs/business.md](../product-specs/business.md)). Every other spec assumes this vocabulary. Field shapes are generated in [../generated/db-schema.md](../generated/db-schema.md); per-screen behaviour lives in [../product-specs/index.md](../product-specs/index.md).

## Hierarchy: area → goal → KR → task
```
영역  areas[]   life area + optional job directions `dir`. `grade` 0–9. Achievement log `achievements[]`.
└ 목표  goals[]  OKR: title · areaId · deadline? · note? · status active|done · createdAt · krs[] (no limit, 0 allowed)
    └ KR  krs[]   four types
        metric  { title, start, target, current, unit }   → updated by KR check-in and fitness records
        count   { title, need }                            → derived from completions of tasks linked to the goal
        exam    { title, famId, band{label,d,p,conf} }     → derived from `exams.best` once the exam milestone completes
        cert    { title, certName, done? }                 → `done` is set automatically when the cert milestone completes
    └ 실행  tasks[] `goalId` required for new tasks; `areaId` inherited from the goal
        daily task   diff E/D/C · type daily|once · kind? book|fit
        study        isStudy · diff E/D · source · scope?
        milestone    isCert (certD, sg?) / isExam (famId, band) — created only by KR one-click, type once
```
Progress is never stored ([Rule 9](core-beliefs.md#rule-9)): `krProgress` computes each KR (metric = (current − start) / (target − start) clamped to 0–1; exam = `best.p / band.p` capped at 1; cert = `done ? 1 : 0`; count = completions / `need` capped at 1, where a daily task counts every entry in `doneDates` and a once task counts 1 when `status === "done"`), and `goalProgress` is the mean over the goal's KRs (0 with no KRs). `paceOf` compares that with elapsed time ([Rule 13](core-beliefs.md#rule-13)).

## KR–task bridge (`AddTaskModal`)
The modal opens from a goal (`modal.type === "addQuest"`, `goalId`) and shows `실행 추가`, a goal box `🎯 {goal.title}` / `영역: {areaName} (목표에서 상속)`, then — when the goal has KRs — the list `이 목표의 핵심결과 — 클릭해서 바로 연결` ([Rule 19](core-beliefs.md#rule-19)).

| KR type | Row label | Right-hand state | Creates |
|---|---|---|---|
| exam | `🎓 {fam.n} {band.label} — 시험 마일스톤 · D{band.d}` | `달성` (`exams.best[famId].p ≥ band.p`) / `등록됨` (an `isExam` task with the same `famId` + band label already exists in this goal) / `등록 ›` | `{ title: "{fam?.n \|\| "시험"} {label} 달성", diff: scoreTier(band.p), pts: band.p, type: "once", isExam, famId, band }` — `시험` is the fallback when the family is not found |
| cert | `📜 {c.n} — 자격 마일스톤 · 적합 {tier} · +{gain}P` | `취득` (`kr.done`) / `등록됨` (any `isCert` task anywhere whose title includes `certName`) / `등록 ›` | `{ title: "{c.n} 취득", diff: scoreTier(certP(d)), pts: certP(d), certD, sg?, type: "once", isCert }` |
| count | `🔁 {title} — 일일 실행으로 채우기 · {krDoneCount}/{need}` | `채우기 ›` | form prefill only: title, `kind = detectKind(title)`, diff E, type daily, and `krId = kr.id` — the one carve-out that lets registration go through with no kind, since a count KR is the goal's own measured action; the `등록` button still has to be pressed |
| metric | `📈 {title} — 목표 탭 체크인으로 관리 (운동 기록의 측정값도 자동 반영)` | guidance only | nothing |

- The cert row resolves `certOf(kr.certName) || certByTitle(kr.certName)`; if neither matches it renders `📜 {certName} — 도감에 없는 명칭이라 자동 연결 불가(KR 이름을 표준 명칭으로 맞춰 주세요)` and nothing can be registered.
- `tier` comes from `jobWeightForCert` for the goal's area and `gain = Math.round(certGainOf({ certBest }, c) * (jw?.mult ?? 1) / 10) * 10` ([Rule 15](core-beliefs.md#rule-15), [Rule 3](core-beliefs.md#rule-3)). Rows in the 달성 / 등록됨 / 취득 state are disabled.
- The root `addQuest` handler refuses a second `isCert` task with the same title: toast `{title} — 이미 등록된 자격입니다. 자격 지급은 영역과 무관하게 1회입니다.`

## Time groups, not goal groups (`TaskTab`, rewritten 2026-09-13)
`실행` no longer mirrors the hierarchy above: it is one time-ordered list — tasks, schedule occurrences and two
dated business facts — built by the pure helper `todoOf(state, today)`, and `목표` is the only surface left that
groups by goal (as numbers, never as a task-row list). The four-level hierarchy itself is unchanged; only this
tab's *view* stopped mirroring it. Full behaviour: [../product-specs/tasks.md](../product-specs/tasks.md).

- **Milestone** — `isMile = isCert || isExam || isStudy` still names the one-day exception
  ([Rule 18](core-beliefs.md#rule-18)) and still shows a `Lock` icon instead of a checkbox until completed, but a
  milestone is now just a `task`-kind row like any other: it sits wherever its `due` (or, undated, `이후`) places
  it, with no divider and no per-goal section around it. Every row — milestone or not — states its own goal on
  itself (`🎯 {goal.title}` or `목표 기여 없음`), which is what makes a goal-scoped section unnecessary.
- **Daily task** — everything else. Still capped at difficulty C (`DIFFS.C.pts` 60 < `EVIDENCE_MIN` 150); the
  modal still offers only E / D / C and says `하루분량 상한 C`.
- **Orphan tasks** — no `goalId`, or a `goalId` that resolves to no goal (including the completed tasks kept when
  an active goal is deleted through `목표 삭제`, and every task of a goal removed with `기록에서 제거`). There is
  no longer a section named for them: they render as ordinary rows tagged `목표 기여 없음`, in whichever time
  group their date puts them, completed and deleted exactly like any other task row.
- **A goal with `status === "done"`** is no longer a blind spot: the old per-active-goal loop skipped it (not
  active) and the orphan section didn't apply either (the goal still resolves) — this dropped its tasks from
  every section. The rewrite filters on task state only, never goal state, so those tasks render like any other
  ([TD-02](../exec-plans/tech-debt-tracker.md), resolved 2026-09-13).
- Tab header: `실행 — 시간순 할 일` / `실행·일정·사업을 시간순으로 모아서 보여줘요. 새 실행은 목표 탭에서 만들어요.`
  plus the `도감` (catalogue) button → `CatalogModal` and a `할 일` / `완료` view toggle (component state, never
  `state.ui`). Empty state (no open row, no active goal): `실행은 목표의 실행 단위입니다 — 목표가 먼저예요.` →
  `목표 먼저 세우기 ›`. `＋ 이 목표에 실행` is gone with the per-goal sections it lived in — task creation now
  starts only from `목표`'s `＋ 실행 연결` / KR rows ([Rule 19](core-beliefs.md#rule-19)).

## Screen map (`NAV`, six tabs)
| Tab key | Label | Icon | Component | Composition |
|---|---|---|---|---|
| home | 홈 | Flag | `HomeTab` | profile card (`Portrait` 72 — photo or sprite, area grade names, `업로드`, `오늘 {n}건 완료`) · `오늘의 초점` (up to 3 active goals by nearest deadline, with 페이스 (pace)) · `오늘 할 일` (overdue + today only, tasks from `todoOf`, up to 5 rows) |
| goals | 목표 | Target | `GoalsTab` | numbers only — `목표 (OKR)` cards (progress, pace, KR rows, check-in) · `새 목표` · `＋ 실행 연결` · `달성 처리` · `기록에서 제거` · `목표 삭제`; the only surface a task is created from |
| tasks | 실행 | ClipboardList | `TaskTab` | one time-ordered list from `todoOf` — groups `기한 지남` / `오늘` / `내일` / `이번 주` / `이후` + `오늘 완료`, three row kinds (task / event / biz), `할 일` / `완료` view chips, counts + business-count lines · `도감` |
| schedule | 일정 | CalendarDays | `ScheduleTab` | `다가오는 일정` + `일정 추가` · counts line · the view toggle `목록` / `달력` (stored in `ui.scheduleView`) · **목록**: day groups `지난 마감` / `오늘` / `내일` / `이번 주` / `이후` (the last one collapsed to one row per event) · **달력**: `ScheduleCalendar` — month header (`{YYYY}년 {M}월` · `‹` · `›` · `오늘`), seven-column grid with one marker per occurrence, `선택한 날짜` panel with the same `EventRow` the groups use and its own `일정 추가` |
| biz | 사업 | Briefcase | `BizTab` | header (`이번 달 계약` / `남은 계약` lines) + per-view add button · the view toggle `계약` / `단가` / `포트폴리오` (stored in `ui.bizView`) · **계약**: groups `진행 중` / `예정` / `견적 대기` / `문의` / `종료` / `무산` by derived phase, payment chips, `최근 6개월` roll-up · **단가**: rate rows with margin, footer count · **포트폴리오**: one-column cards with links and a stored thumbnail |
| growth | 성장 | TrendingUp | `GrowthTab` | `성취의 벽` · `실력 트랙 — 영역별 승급 관문` (`관문 증명하기`) · `롤모델` (근접도, `롤모델 설정` / `롤모델 수정`, `방향 제안`) · `데이터 초기화` |

- Modals, one at a time (`modal.type`, 18 values): `addQuest` (renders `AddTaskModal`; the type string keeps the legacy name) / `addGoal` / `evidence` / `promote` / `role` / `activity` / `study` / `evidenceView` / `catalog` / `roleAdvice` / `event` / `deals` / `rates` / `folio` / `briefing` / `journal` / `bridge` / `review`.
- Overlays (`overlay.type`): `gradeup` / `achieve`. Toast: `ToastHost` holds one slot with no queue — a new `show` replaces the current message and restarts the 2600 ms timer.
- Header on every tab: `LIFE MANAGER` · `{nick}` · `{status}` · `🔥 {streak}일` · `🛡 {shieldsLeft}` (보호권, streak shield).
- Phases: `loading` (`불러오는 중...`) → `onboard` (`Onboarding`, rendered without `Shell`) → `main`.
