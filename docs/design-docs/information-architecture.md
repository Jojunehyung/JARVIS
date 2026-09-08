# Information architecture
<!-- src: SPEC-3 -->

The app is a four-level hierarchy — 영역 (area) → 목표 (goal) → KR (key result) → 실행 (task) — shown through four tabs, eleven modals, and two overlays. Every other spec assumes this vocabulary. Field shapes are generated in [../generated/db-schema.md](../generated/db-schema.md); per-screen behaviour lives in [../product-specs/index.md](../product-specs/index.md).

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
        daily task   diff E/D/C · type daily|once · kind? book|fit|meet
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
| count | `🔁 {title} — 일일 실행으로 채우기 · {krDoneCount}/{need}` | `채우기 ›` | form prefill only: title, `kind = detectKind(title)`, diff E, type daily — the `등록` button still has to be pressed |
| metric | `📈 {title} — 목표 탭 체크인으로 관리 (운동 기록의 측정값도 자동 반영)` | guidance only | nothing |

- The cert row resolves `certOf(kr.certName) || certByTitle(kr.certName)`; if neither matches it renders `📜 {certName} — 도감에 없는 명칭이라 자동 연결 불가(KR 이름을 표준 명칭으로 맞춰 주세요)` and nothing can be registered.
- `tier` comes from `jobWeightForCert` for the goal's area and `gain = Math.round(certGainOf({ certBest }, c) * (jw?.mult ?? 1) / 10) * 10` ([Rule 15](core-beliefs.md#rule-15), [Rule 3](core-beliefs.md#rule-3)). Rows in the 달성 / 등록됨 / 취득 state are disabled.
- The root `addQuest` handler refuses a second `isCert` task with the same title: toast `{title} — 이미 등록된 자격입니다. 자격 지급은 영역과 무관하게 1회입니다.`

## Milestone / daily / unassigned sections (`TaskTab`)
- **Milestone** — `isMile = isCert || isExam || isStudy`. The one-day exception ([Rule 18](core-beliefs.md#rule-18)); listed inside the goal section under the divider `마일스톤 — 자격·시험·학습 (하루분량 예외 · 증거로만 완료)`, with a Lock icon instead of a checkbox until completed.
- **Daily task** — everything else. Capped at difficulty C (`DIFFS.C.pts` 60 < `EVIDENCE_MIN` 150); the modal offers only E / D / C and says `하루분량 상한 C`.
- **Unassigned (미분류)** — tasks with no `goalId`, or whose goal is not in `goals`. Section `미분류 — 목표 연결 전 항목` with `완료·삭제는 가능하지만, 새 실행은 목표에서만 만들 수 있어요.`; complete and delete only.
- Tasks of a goal with `status === "done"` appear nowhere: the goal is not active, and it still exists so the task is not an orphan. Current behaviour, not a design intent.
- Tab header: `실행 — 목표별 할 일` / `실행은 목표에서만 생성되고, 하루분량으로만 등록됩니다.` plus the `도감` (catalogue) button → `CatalogModal`. Empty state: `실행은 목표의 실행 단위입니다 — 목표가 먼저예요.` → `목표 먼저 세우기 ›`. Each goal section shows `{progress}%`, `연결된 실행이 아직 없습니다.` when empty, and `＋ 이 목표에 실행`.

## Screen map (`NAV`, four tabs)
| Tab key | Label | Icon | Component | Composition |
|---|---|---|---|---|
| home | 홈 | Flag | `HomeTab` | profile card (`Portrait` 72 — photo or sprite, area grade names, `업로드`, `오늘 {n}건 완료`) · `오늘의 초점` (up to 3 active goals by nearest deadline, with 페이스 (pace)) · `오늘 할 일` (5 rows) |
| goals | 목표 | Target | `GoalsTab` | `목표 (OKR)` cards (progress, pace, KR rows, check-in) · `새 목표` · `＋ 실행 연결` · `달성 처리` · `기록에서 제거` |
| tasks | 실행 | ClipboardList | `TaskTab` | per-goal groups (daily + milestones) · 미분류 · `도감` · `＋ 이 목표에 실행` |
| growth | 성장 | TrendingUp | `GrowthTab` | `성취의 벽` · `인생 지표` + `체크인` · `실력 트랙 — 영역별 승급 관문` (`관문 증명하기`) · `롤모델` (근접도, `롤모델 설정` / `롤모델 수정`, `방향 제안`) · `데이터 초기화` |

- Modals, one at a time (`modal.type`, 11 values): `addQuest` (renders `AddTaskModal`; the type string keeps the legacy name) / `addGoal` / `evidence` / `promote` / `role` / `activity` / `study` / `evidenceView` / `catalog` / `roleAdvice` / `metrics`.
- Overlays (`overlay.type`): `gradeup` / `achieve`. Toast: `ToastHost` holds one slot with no queue — a new `show` replaces the current message and restarts the 2600 ms timer.
- Header on every tab: `LIFE MANAGER` · `{nick}` · `{status}` · `🔥 {streak}일` · `🛡 {shieldsLeft}` (보호권, streak shield).
- Phases: `loading` (`불러오는 중...`) → `onboard` (`Onboarding`, rendered without `Shell`) → `main`.
