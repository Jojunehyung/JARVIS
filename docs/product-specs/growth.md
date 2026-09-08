# Growth tab
<!-- src: SPEC-4-5 -->

The metrics footer ends with ` · 마지막 체크인 {date or 없음}`, and 방향 제안 (direction advice) renders `roleRecommendations(state)` — the same source the daily briefing reads.

The 성장 (growth) tab `GrowthTab` is the verified record of an account: the achievement wall, the three 인생 지표 (life metrics), one card per 영역 (area) on the skill track with its next 승급 (promotion) 관문 (gate), 롤모델 (role model) proximity, and the reset button. Props: `state, onPromote, onRoleModel, onRoleAdvice, onReset, onMetrics`; it computes `roleGap(state)` itself. Four modals hang off it: `MetricsModal`, `PromoteModal`, `RoleModelModal`, `RoleAdviceModal`. Mechanisms: [../design-docs/metrics-and-role-model.md](../design-docs/metrics-and-role-model.md), [../design-docs/evidence-and-promotion.md](../design-docs/evidence-and-promotion.md); tokens: [../DESIGN.md](../DESIGN.md). Nothing here grows by itself ([Rule 8](../design-docs/core-beliefs.md#rule-8)).

## Achievement wall (`성취의 벽`)
- No `room.trophies` and no `exams.best` entries → `EmptyWallSvg` + `아직 검증된 성취가 없습니다 — 완료는 증거로만 기록됩니다.`
- Trophies: the last 10 (`slice(-10)`) inside `WallFrame`, each `TrophySvg(kind, tier, 26)` with its label under it.
- Each language with `exams.spec[l]` true: `🎖 {LANG_KO[l]} 전문화 — 고난도 감쇠 하한 70%` (amber; [Rule 2](../design-docs/core-beliefs.md#rule-2)).
- Each `exams.best` row (`examOf(id)`): `{fam.n} {label}` · `D{d} · 누적 {p}P`.

## Life metrics (`인생 지표`)
Header button `체크인` → `onMetrics` (opens `MetricsModal`). Rows come from `METRICS_META`, each `Bar(value / 100, m.c)` plus the value (tooltip `{value} / 100`); footer `성취·승급 시 자동 반영되고, 체크인으로 직접 보정할 수 있어요.`

| key | label | description (`m.d`) |
|---|---|---|
| `asset` | 자산 | 경제력·자본. 성취와 수익 목표로 상승 |
| `infl` | 영향력 | 실력·평판·네트워크. 승급과 전문 성취로 상승 |
| `body` | 외형 | 운동·식단·컨디션 관리의 결과. 체크인으로 스스로 평가 |

`MetricsModal` `인생 지표 체크인`: three `range` inputs 0–100 (mono value + `m.d`), `저장` (violet) → `saveMetrics` → `statClamp` on `asset` / `infl` / `body` → toast `지표를 갱신했어요`.

## Skill track (`실력 트랙 — 영역별 승급 관문`)
One card per `state.areas` entry with `cur = RANKS[grade]`, `next = RANKS[grade + 1]` ([`RANKS`](../generated/onboarding-tables.md#ranks)):
- Header: grade number in a box · `{name}[ · {dir.join("·")}]` · `등급 {cur.name} · {cur.gate}` · mono `{grade}/9`.
- `next` exists: Lock icon `다음 관문 — {next.name} · {next.gate}`, `필요 증거: {next.req}`, button `관문 증명하기` → `onPromote(area)`.
- Grade 9 (no `next`): Trophy icon `정점 도달`.
- `achievements.length > 0`: `검증된 성취 {n}건`, then the last 30 newest-first in a scroll box, each Star icon + `text` + `{date} · {RANKS[grade].name} 인정`.

`PromoteModal` `승급 심사 — {next.name}` (renders nothing when there is no `next`): card `'{area.name}' 영역 · {RANKS[grade].name} → {next.name}` + `next.gate`; `해당하는 증거를 선택하세요 (1개 이상)`; `EvidencePicker` with [`GATE_CHIPS[grade + 1]`](../generated/onboarding-tables.md#gate_chips) and memo `한 줄 메모 (선택)`; `스스로에게 정직하게. 여기서의 상향은 결국 나를 속이는 일이에요.`; button `증거 제출 · 승급`. Zero chips → `해당하는 증거가 없다면 아직 이 등급이 아닌 거예요.`; otherwise `onSubmit(composeEvidence(sel, memo))` → `promoteArea`: `grade + 1`, an achievement entry holding the evidence text, a `rank` trophy `{area} {rank}`, `metrics.infl + 3`, then the RANK UP overlay ([feedback-overlays.md](feedback-overlays.md)). This is the only promotion path ([Rule 11](../design-docs/core-beliefs.md#rule-11)).

## Role model (`롤모델`)
`rg = roleGap(state)` ([Rule 14](../design-docs/core-beliefs.md#rule-14)) is `null` without a role or without any target > 0. Header shows `근접도` `{rg.match}%` when `rg` exists.
- `state.role && rg`: `「{role.name}」 검증 기준 근접도`, then per item `{area.name}` and `{RANKS[have].name} / 요구 {RANKS[need].name}` followed by ` · {gap}단계 부족` (rose) or ` · 충족` (emerald), plus a segmented bar of `need` cells where cell `k` has width `(((k + 1) / need)² − (k / need)²) · 100 %` and is cyan when `k < min(have, need)`. Footer: `칸 하나 = 등급 한 단계, 칸 너비 = 그 단계의 비중. 하위 등급은 좁고 상위 등급은 넓어, 상위 승급 없이는 근접도가 오르지 않습니다. 롤모델 요구에 없는 영역의 활동은 반영되지 않습니다.`
- Otherwise: `목표 인물상의 영역별 요구 등급을 정하면, 검증된 등급으로만 근접도를 계산합니다.`
- Buttons: `롤모델 설정` (no role) / `롤모델 수정` → `onRoleModel`; `방향 제안` → `onRoleAdvice`, only when `state.role && rg`.

`RoleModelModal` `롤모델 설정`: four [`ROLE_PRESETS`](../generated/onboarding-tables.md#role_presets) chips (대기업 현직 전문가 · 월 500 1인 사업가 · 프리랜서 전문가 · 창업가·대표) and an input `직접 입력 (예: 연 매출 1억 1인 사업가)`; per area `{name} — 요구 등급: {RANKS[t].name}` or `{name} — 요구 등급 (제외)` with buttons `제외` (0) and `RANKS.slice(1, 9)` (견습 … 거장 = 1–8; 정점 cannot be required); `저장` → `onSave({ name: name.trim() || "롤모델", targets })` → `state.role` + toast `롤모델 기준 저장 — 근접도는 검증된 등급으로만 계산됩니다`. There is no control that removes a role model.

`RoleAdviceModal` `방향 제안 — {rg.name}` (fallback `롤모델`): `gaps = rg.items.filter(gap > 0)`; none → `모든 요구 영역을 충족했습니다. 근접도 {match}%.` Per gap card:
- `{area.name}` · `{RANKS[have].name} → {RANKS[need].name} · {gap}단계` (rose) / `다음 관문: {RANKS[have + 1].name} 승급 — 이 영역의 성취·증거가 필요합니다.`
- 21 [`JOB_FIELDS`](../generated/onboarding-tables.md#job_fields) toggles: on = `normDirs(area).includes(d)`; switching off removes `d` and every raw direction with `DIR_ALIAS[x] === d`; → `onSetDir` → `setAreaDir`. Copy: `복수 선택 시 교집합으로 평가합니다 — 지정한 모든 직무에서 통하는 자격이 상위에 옵니다.`
- Certification picks: categories from `areaCatHints(state, area).cats` → `CERTS_BY_CAT` → `jw = jobWeightForCert(state, area.id, c)`, `gain = jw ? round(certGainOf · jw.mult / 10) · 10 : certGainOf`; keep `gain > 0`; sort `mult` desc, then `d` asc; top 4; row `{tier} {c.n}` (tier coloured by `TIER_CLS`) · `D{d} · +{gain}P` ([Rule 15](../design-docs/core-beliefs.md#rule-15), [job-weighting.md](../design-docs/job-weighting.md)).
- Exam picks when `areaCatHints(...).exam`: for each `EXAMS` family the first band with `p > exams.best[id].p` (0 if none) through `examBandGain`; up to 3; row `{e.n} {band.label} — 다음 밴드` · `D{band.d} · +{payout}P`.
- Neither list: `매칭되는 표준 성취가 없습니다 — 이 영역은 프로젝트·실적 증거로 승급을 진행하세요.`
- `cats.length > 0`: `도감에서 더 보기 ›` → `onOpenCatalog(area.dir.length === 1 ? cats[0] : null)` → `CatalogModal` (도감, catalogue) preset to that category, else 전체.
- Footer: `추천은 직무 분야 매칭과 직무 가중 기준입니다.`

## Reset (`데이터 초기화`)
RotateCcw button → `onReset` = `resetAll`: deletes `liferpg-img-ev-{id}` and `liferpg-img-study-{id}-1` / `-2` for every task, `liferpg-img-profile`, then `KEY` (`liferpg-state-v1`); state → `null`, in-memory images cleared, phase → `onboard`, tab → `home`. No confirmation dialog.
