# Tasks tab
<!-- src: SPEC-4-4 -->

Open rows carry a `DueChip` when the task has a `due` date, and `AddTaskModal` offers `기한 (선택)` (a date input) for `오늘 1회` tasks and for study tasks; a milestone created from a KR defaults its `due` to the goal deadline.

`TaskTab` shows every 실행 (task) grouped under its active goal — daily rows first, then the 마일스톤 (milestone) rows for certification, exam, and study tasks — plus a 미분류 (unassigned) section for legacy tasks whose goal no longer resolves, which now also holds the completed tasks kept when their active goal was deleted through `목표 삭제` ([goals.md](goals.md)). New tasks are created only through `AddTaskModal`, opened from a goal and sized to one day ([Rule 18](../design-docs/core-beliefs.md#rule-18)); certification and exam milestones come only from the goal's KR bridge ([Rule 19](../design-docs/core-beliefs.md#rule-19)). The 도감 (catalogue) `CatalogModal` is a read-only browser of the payout tables. Hierarchy: `information-architecture.md`; payouts: `scoring-engine.md` (both under `../design-docs/`).

## `TaskTab`
Props: `state, today, onComplete (tryComplete), onRemove (removeTask), onCatalog, onGoGoals, onAddFor, onViewEvidence (opens EvidenceViewModal)`.
- Header: `실행 — 목표별 할 일` / `실행은 목표에서만 생성되고, 하루분량으로만 등록됩니다.` / button `도감`.
- Empty state (no active goal and no unassigned task): `EmptyQuestSvg`, `실행은 목표의 실행 단위입니다 — 목표가 먼저예요.`, button `목표 먼저 세우기 ›` (→ goals tab).
- One section per active goal: `🎯 {g.title}` + `{round(goalProgress·100)}%`; `dailyQ` rows, then — when any exist — the divider `마일스톤 — 자격·시험·학습 (하루분량 예외 · 증거로만 완료)` and the `mile` rows (`isMile = isCert || isExam || isStudy`); `연결된 실행이 아직 없습니다.` when the goal has no task; `＋ 이 목표에 실행` → `onAddFor(g.id)`.
- Unassigned section (`opacity-60`, only when `orphan.length > 0`): `미분류 — 목표 연결 전 항목` / `완료·삭제는 가능하지만, 새 실행은 목표에서만 만들 수 있어요.` `orphan` = tasks with no `goalId` or whose `goalId` matches no goal (including goals removed with `기록에서 제거`, or deleted with `목표 삭제` — that path removes only the goal's record-less tasks and leaves completed ones here).

### Row
`doneToday` = `daily` → `doneDates.includes(today)`, `once` → `status === "done"`; a done row is `opacity-50` with a struck-through title.
- Left control: an undone milestone shows a `Lock` icon button; every other row a check box (`Check` icon; emerald and `disabled` once done). Both call `onComplete(q)` → `tryComplete`, which opens `StudyVerifyModal` (`isStudy`), `ActivityLogModal` (`kind`), or `EvidenceModal` (`needsEvidence`: cert, exam, or pts ≥ 150) before `completeTask` — [Rule 10](../design-docs/core-beliefs.md#rule-10), [Rule 16](../design-docs/core-beliefs.md#rule-16), [Rule 17](../design-docs/core-beliefs.md#rule-17).
- Title: kind prefix `📚 ` / `💪 ` + `title`. Subtitle: done → `완료`, or `완료 · 증거 보기` (link → `onViewEvidence(q)`) when `evidence` exists; `isCert` → `직무 적합 {jw.tier}` (in `TIER_CLS`, only when `jobWeightForCert(state, areaId, certByTitle(title))` returns a tier) ` · D{certD} · 증거 필요` (violet); `isExam` → `D{band.d} · 성적표 사진 필수` (sky); otherwise `{area.name}[ · 🎯 {goal.title}][ · 매일][ · 📖 산출물검증 | · 증거 필요]` plus ` · 목표 기여 없음` when the goal is missing ([Rule 13](../design-docs/core-beliefs.md#rule-13)).
- Right badge: `isExam` → `시험` (sky); `isCert` → `CertBadge(certD != null ? achGrade(certD) : legacyCertGrade(pts))`; otherwise `DiffBadge(diff)`.
- `X` → `onRemove(id)` = `removeTask`: no confirmation, works on completed rows too, and deletes the evidence images `liferpg-img-ev-{id}` and `liferpg-img-study-{id}-1..2` together with the task.

## `AddTaskModal` — `실행 추가`
Props: `areas, exams, certBest, tasks, goalId, goal, onClose, onAdd (addQuest)`. `areaId = goal.areaId` — inherited, no area picker. Top card: `🎯 {goal.title}` / `영역: {areaName} (목표에서 상속)`. `gk = goalKinds(goal)` — the activity kinds and the study flag inferred from the goal's title, note, and KRs — scopes everything below.

### KR bridge — `이 목표의 핵심결과 — 클릭해서 바로 연결` (shown when `goal.krs` is non-empty)
| KR type | Row | Right label | Creates |
|---|---|---|---|
| `exam` | `🎓 {fam.n} {band.label} — 시험 마일스톤 · D{band.d}` | `달성` (`exams.best[famId].p ≥ band.p`) / `등록됨` (this goal already has an `isExam` task with the same `famId` + `band.label`) / `등록 ›`; disabled in the first two states | `addExamKR`: `{goalId, title: "{fam.n || "시험"} {band.label} 달성", areaId, diff: scoreTier(band.p), pts: band.p, type: "once", isExam: true, famId, band}` |
| `cert` | `📜 {c.n} — 자격 마일스톤[ · 적합 {jw.tier}] · +{gain}P`, `gain = round(certGainOf({certBest}, c) × (jw.mult ?? 1) / 10) × 10` | `취득` (`kr.done`) / `등록됨` (any `isCert` task whose title includes the name) / `등록 ›`; disabled in the first two | `addCertKR`: `{goalId, title: "{c.n} 취득", areaId, diff: scoreTier(certP(d)), pts: certP(d), certD: d, sg (when the cert has one), type: "once", isCert: true}` |
| `count` | `🔁 {kr.title} — 일일 실행으로 채우기 · {krDoneCount}/{need}` | `채우기 ›` | `fillCount`: prefills the daily form — `title = kr.title`, `kind = detectKind(title)`, `diff = "E"`, `type = "daily"`, and sets `krId = kr.id` — the one carve-out that lets `submitNormal` accept an empty kind, because a count KR is the goal's own measured action ([Rule 9](../design-docs/core-beliefs.md#rule-9), [Rule 19](../design-docs/core-beliefs.md#rule-19)); `등록` still has to be pressed |
| `metric` | `📈 {kr.title} — 목표 탭 체크인으로 관리 (운동 기록의 측정값도 자동 반영)` (dimmed, not a button) | — | nothing |

A cert KR whose `certName` resolves through neither `certOf` nor `certByTitle` renders `📜 {certName} — 도감에 없는 명칭이라 자동 연결 불가(KR 이름을 표준 명칭으로 맞춰 주세요)` instead. Tier and multiplier: [../design-docs/job-weighting.md](../design-docs/job-weighting.md).

### Modes
The chips `일일 실행` / `학습 (하루분량)` appear only when `gk.study`; otherwise the modal is the daily form alone. Selecting `학습 (하루분량)` calls `setTitle("")`, so a title typed in the daily form is lost on the switch.

### Daily form (`mode === "normal"`)
- Template chips (amber): `TASK_TEMPLATES` filtered to `tp.kind && gk.kinds.has(tp.kind)` — `아침 운동 30분` (fit · E · daily), `독서 30분` (book · E · daily). A click sets `title`, `kind`, `diff`, `type` together.
- Title input `무엇을 하나요? — 하루 안에 끝나는 크기로`.
- Activity kind — always shown in normal mode (not gated behind `gk.kinds`). Label `활동 유형 (필수) — 독서·운동만 목표에 등록돼요`, replaced by `활동 유형 (선택) — 횟수 핵심결과를 채우는 실행이에요` while `krId` is set (the count-KR carve-out). Chips `📚 독서` · `💪 운동` scoped to `gk.kinds`, falling back to both when the scoped list is empty so a goal matching no keyword is never a dead end; clicking the selected chip clears it (`kind === k ? "" : k`). The selected kind shows its note — book `완료 시 독후감(별점·한 줄 감상) 기록 — 교양 독서용. 실력 목적 독서는 '학습'으로.`, fit `완료 시 운동·측정 기록(선택). 체중·골격근량은 이 목표의 같은 이름 수치 KR에 자동 반영돼요.`
- Difficulty `난이도 — {pts}pt · 하루분량 상한 C`, buttons `E` · `D` · `C` (10 / 25 / 60 pt from `DIFFS`, default `D`) — the one-day cap keeps daily tasks under the 150-pt evidence threshold ([Rule 17](../design-docs/core-beliefs.md#rule-17)). Cadence chips `매일 반복` (`daily`, default) / `오늘 1회` (`once`). Button `등록`.
- `submitNormal`: empty title → `실행 이름을 입력해 주세요.`; `dk = detectKind(title)` (독서 / 책 읽 / 북클럽 → book; 운동 / 헬스 / 러닝 / 조깅 / 필라테스 / 요가 / 웨이트 / 수영 → fit); when `dk && kind && dk !== kind` → `제목은 {nm[dk]} 활동으로 보이는데 유형이 {nm[kind]}(으)로 선택돼 있어요 — 맞춰 주세요.` (`nm` = `📚 독서` / `💪 운동`); `ek = kind || dk`, and when `!ek && !krId` → `활동 유형을 골라 주세요 — 📚 독서·💪 운동만 목표에 등록돼요. 공부는 '학습', 자격·시험은 핵심결과, 약속·미팅은 일정 탭에서 만들어요.` (Rule 19 amendment); otherwise `onAdd({goalId, kind: ek (omitted when empty), title, areaId, diff, pts: DIFFS[diff].pts, type})`.

### Study form (`mode === "study"`)
Inputs `책·논문·강의명` and `오늘 범위 — 예: 3장, 강의 5강`; `분량 등급 — {pts}pt` with chips `E` · `D` (default `D`); notes `하루 학습 분량만: 아티클 E · 챕터/강의 1개 D. 책 한 권은 매일 챕터(D)로 쪼개고, 완독은 목표의 횟수 KR로 측정하세요.` and `완료 검증: E = 요약·새 지식 기재 · D = 기재 + 산출물 1건(정리 사진/링크).` ([Rule 16](../design-docs/core-beliefs.md#rule-16)); button `학습 실행 추가 (산출물 검증)`. `submitStudy`: empty title → `책·논문·강의명을 입력해 주세요.`; else `onAdd({goalId, title, areaId, diff: sDiff, pts: DIFFS[sDiff].pts, type: "once", isStudy: true, source: title, scope (omitted when blank)})`.

### `addQuest` (in `App`)
If `q.isCert` and a task with `isCert` and the same `title` already exists: close the modal and toast `{title} — 이미 등록된 자격입니다. 자격 지급은 영역과 무관하게 1회입니다.` Otherwise prepend `{status: "todo", doneDates: [], createdAt: dstr(), ...q, id: uid()}` to `tasks`, close, and toast `실행이 추가됐어요`.

## `CatalogModal` — `성취 도감`
Props: `state, initialCat, onClose`. Read-only. The `도감` button opens it on `전체`; `initialCat` is set only by `RoleAdviceModal`'s `도감에서 더 보기 ›`. Mode chips `자격증 {CERTS.length}` (1011) / `시험 {EXAMS.length}` (17).
- Certifications: search `자격증 검색` (case-insensitive through `CERT_NAME_LC`) + category buttons `전체` and the 15 `CERT_CATS`; `hits` is filtered by both and rendered as `slice(0, 60)`, with `{total − 60}종 더 있음 — 검색어로 좁혀요` for the remainder and `검색 결과 없음` when empty. Row: `c.n` / `{c.c} · {c.l}` / `D{c.d}` + `CertBadge(achGrade(c.d))` / status `취득 완료` (emerald; `ownedCerts` = names traced by `certByTitle` from done `isCert` tasks) | `+{gain}P` (amber, ` 차액` appended when `gain < certP(c.d)`) | `0P · 보유 단계 이하`. `gain = certGainOf(state, c)` — base P minus the stage-group step already held in `certBest` ([Rule 3](../design-docs/core-beliefs.md#rule-3)); job weighting is not applied here because it depends on the area the milestone is registered under.
- Exams: family buttons (default `EXAMS[0]`, TOEIC L&R), `{fam.cat} · 내 최고: {exams.best[fam.id].label || "없음"}`, then per band `{label} · D{d} · 보유` when `best.p ≥ band.p`, else `+{payout}P[ ×{mult}]` from `examBandGain` → `calcExamPayout` (difference plus the locked bucket decay, [Rule 2](../design-docs/core-beliefs.md#rule-2); `×{mult}` only when `mult < 1`).
- Footer: `표시된 P는 내 기록 기준 실지급액입니다(차액·감쇠 반영). 자격은 완료 시 등록 영역의 직무 가중(S/A/B = ×1.0/0.8/0.5, C 무관 = 지급 0)이 곱해집니다. 등록은 목표에 자격·시험 KR을 추가한 뒤, 실행 모달의 원클릭 연결로 합니다.` Tables: [../generated/cert-table.md](../generated/cert-table.md).
