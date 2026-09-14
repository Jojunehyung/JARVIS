# Growth tab
<!-- src: SPEC-4-5 -->

방향 제안 (direction advice) renders `roleRecommendations(state)` — the same source the daily briefing reads.

The 성장 (growth) tab `GrowthTab` is the verified record of an account, in four blocks top to bottom: 롤모델 (role model) proximity leads as a headline, then the skill track (one row per 영역 (area), tapping straight into its promotion gate), then the achievement wall and the backup/reset controls, both collapsed by default. Props: `state, onPromote, onRoleModel, onRoleAdvice, onReset, onExport, onImport`; it computes `roleGap(state)` itself. The two collapse flags (`openWall`, `openData`) are component `useState`, never `state.ui` ([Rule 9](../design-docs/core-beliefs.md#rule-9)) — nothing here grows by itself ([Rule 8](../design-docs/core-beliefs.md#rule-8)). Three modals hang off it: `PromoteModal`, `RoleModelModal`, `RoleAdviceModal`. Mechanisms: [../design-docs/metrics-and-role-model.md](../design-docs/metrics-and-role-model.md), [../design-docs/evidence-and-promotion.md](../design-docs/evidence-and-promotion.md); tokens: [../DESIGN.md](../DESIGN.md).

## Role-model proximity (`롤모델 근접도`) — first block
`rg = roleGap(state)` ([Rule 14](../design-docs/core-beliefs.md#rule-14)) is `null` without a role, without any target > 0, or when a role exists but every one of its target areas is excluded ([TD-11](../exec-plans/tech-debt-tracker.md)).
- `rg` exists: a header row — left `「{state.role.name}」` (truncating) with `검증 기준 근접도` beneath it; right `{rg.match}%` at `font-mono font-black text-4xl text-cyan-300`. Then one line per `rg.items` entry, no `bg-zinc-950` wrapper: `{area.name}` on the left, and on the right today's `{RANKS[have].name} / 요구 {RANKS[need].name}` plus ` · {gap}단계 부족` (rose) or ` · 충족` (emerald), followed by the segmented bar at `h-2` — `need` cells, cell `k` width `(((k + 1) / need)² − (k / need)²) × 100 %`, cyan while `k < min(have, need)` (formula and fill condition byte-identical to the previous layout, [Rule 14](../design-docs/core-beliefs.md#rule-14)). The paragraph explaining how to read the bars no longer sits here — it moved into `RoleAdviceModal` (below), one tap away via `방향 제안`.
- `rg` is `null`: the right slot renders `—`; the left reads `롤모델 미설정 — 근접도 계산 대상 없음` (the wording `buildBriefing` already used elsewhere) with `목표 인물상의 영역별 요구 등급을 정하면, 검증된 등급으로만 근접도를 계산합니다.` beneath it — a fact plus what would produce the number, never an invitation ([Rule 13](../design-docs/core-beliefs.md#rule-13)).
- Buttons, at the bottom of this card: `{state.role ? "롤모델 수정" : "롤모델 설정"}` → `onRoleModel`; `방향 제안` → `onRoleAdvice`, rendered only when `state.role && rg`.

## Skill track (`실력 트랙 — 영역별 승급 관문`)
One row per `state.areas` entry, `cur = RANKS[grade]`, `next = RANKS[grade + 1]` ([`RANKS`](../generated/onboarding-tables.md#ranks)): a grade-number box, `{name}` with `등급 {cur.name} · 다음 관문 {next.name}` beneath it (or `정점 도달` at grade 9), and `{grade}/9` trailing.
- `next` exists → the row **is** the button, a `Lock` icon and `›` trailing it: `onClick={() => onPromote(area)}` opens `PromoteModal` directly. Nothing else on the tab promotes — the row is the only route in ([Rule 11](../design-docs/core-beliefs.md#rule-11)).
- Grade 9 (no `next`) → the row renders as a plain, unclickable div with a `Trophy` icon and `정점 도달`; `PromoteModal` returns `null` for that area, so it must not be tappable, and is not.
- Deleted from the row, with their facts relocated: the rank's own gate line (`next.gate`, now stated first inside `PromoteModal`), `필요 증거: {next.req}` (moved into `PromoteModal`, see below), the `관문 증명하기` button (the row itself is the control), the per-area `검증된 성취 {n}건` list (moved into the achievement wall, see below), and the `· {dir.join("·")}` direction suffix (job directions are edited and shown in `RoleAdviceModal`, one tap away via `방향 제안`, and are not a growth number).

`PromoteModal` `승급 심사 — {next.name}` (renders nothing when there is no `next`): a lead card stating `'{area.name}' 영역 · {RANKS[grade].name} → {next.name}`, `next.gate`, and `필요 증거: {next.req}` (the line the tab used to state, now here instead); `해당하는 증거를 선택하세요 (1개 이상)`; `EvidencePicker` with [`GATE_CHIPS[grade + 1]`](../generated/onboarding-tables.md#gate_chips) and memo `한 줄 메모 (선택)`; `스스로에게 정직하게. 여기서의 상향은 결국 나를 속이는 일이에요.`; button `증거 제출 · 승급`. Zero chips → `해당하는 증거가 없다면 아직 이 등급이 아닌 거예요.`; otherwise `onSubmit(composeEvidence(sel, memo))` → `promoteArea`: `grade + 1`, an achievement entry holding the evidence text, a `rank` trophy `{area} {rank}`, then the RANK UP overlay ([feedback-overlays.md](feedback-overlays.md)). This is the only promotion path ([Rule 11](../design-docs/core-beliefs.md#rule-11)).

## Achievement wall (`성취의 벽`), collapsed by default
The header states its own counts while closed — `트로피 {t}개 · 시험 {e}개 · 검증된 성취 {a}건` (`t = room.trophies.length`, `e` = the number of `exams.best` entries, `a` = the sum of `p.achievements.length` over `state.areas`) — next to a `ChevronDown` that rotates when open; collapsing never removes a number from the screen ([Rule 13](../design-docs/core-beliefs.md#rule-13)). Open panel, in order:
- No `room.trophies` and no `exams.best` entries → `EmptyWallSvg` + `아직 검증된 성취가 없습니다 — 완료는 증거로만 기록됩니다.`
- Trophies: the last 10 (`slice(-10)`) inside `WallFrame`, each `TrophySvg(kind, tier, 26)` with its label under it.
- Each language with `exams.spec[l]` true: `🎖 {LANG_KO[l]} 전문화 — 고난도 감쇠 하한 70%` (amber; [Rule 2](../design-docs/core-beliefs.md#rule-2)).
- Each `exams.best` row (`examOf(id)`): `{fam.n} {label}` · `D{d} · 누적 {p}P`.
- One block per `state.areas` entry, in area order: `{name}` and `검증된 성취 {n}건`; when `n > 0`, the last 30 newest-first in a scroll box, each Star icon + `text` + `{date} · {RANKS[grade].name} 인정`. An area with zero achievements still renders its count line alone — the number is a fact, stated even at zero.

## Data — backup and reset (`데이터 — 백업 · 초기화`), collapsed by default
Header `데이터 — 백업 · 초기화` with a `ChevronDown`. Open panel, unchanged: the line `기록은 이 기기에만 있어요. 저장소가 지워지면 복구할 수 없으니 가끔 파일로 내보내요.`, the buttons `백업 내보내기` / `백업 불러오기` → `onExport` / `onImport` (mechanics: [install-and-backup.md](install-and-backup.md)), then the reset button `RotateCcw` + `데이터 초기화` → `onReset`. The hidden `input[type=file][accept*=json]` the import button drives lives on `Shell`, outside `GrowthTab`, so collapsing this section does not affect it.

`onReset` = `resetAll`: deletes `liferpg-img-ev-{id}` and `liferpg-img-study-{id}-1` / `-2` for every task, `liferpg-img-profile`, then `KEY` (`liferpg-state-v1`); state → `null`, in-memory images cleared, phase → `onboard`, tab → `home`. No confirmation dialog.

The calendar file (`캘린더로 내보내기`) is not here: it downloads no recovery data and restores nothing, so it
lives as its own button on the `일정` tab, next to the dates it exports — see [schedule.md](schedule.md),
section "Calendar export".

## Role model modals
`RoleModelModal` `롤모델 설정`: four [`ROLE_PRESETS`](../generated/onboarding-tables.md#role_presets) chips (대기업 현직 전문가 · 월 500 1인 사업가 · 프리랜서 전문가 · 창업가·대표) and an input `직접 입력 (예: 연 매출 1억 1인 사업가)`; per area `{name} — 요구 등급: {RANKS[t].name}` or `{name} — 요구 등급 (제외)` with buttons `제외` (0) and `RANKS.slice(1, 9)` (견습 … 거장 = 1–8; 정점 cannot be required); `저장` → `onSave({ name: name.trim() || "롤모델", targets })` → `state.role` + toast `롤모델 기준 저장 — 근접도는 검증된 등급으로만 계산됩니다`. There is no control that removes a role model ([TD-11](../exec-plans/tech-debt-tracker.md)).

`RoleAdviceModal` `방향 제안 — {rg.name}` (fallback `롤모델`): `gaps = rg.items.filter(gap > 0)`; none → `모든 요구 영역을 충족했습니다. 근접도 {match}%.`, followed by the bar legend (below, in both branches). Per gap card:
- `{area.name}` · `{RANKS[have].name} → {RANKS[need].name} · {gap}단계` (rose) / `다음 관문: {RANKS[have + 1].name} 승급 — 이 영역의 성취·증거가 필요합니다.`
- 21 [`JOB_FIELDS`](../generated/onboarding-tables.md#job_fields) toggles: on = `normDirs(area).includes(d)`; switching off removes `d` and every raw direction with `DIR_ALIAS[x] === d`; → `onSetDir` → `setAreaDir`. Copy: `복수 선택 시 교집합으로 평가합니다 — 지정한 모든 직무에서 통하는 자격이 상위에 옵니다.`
- Certification picks: categories from `areaCatHints(state, area).cats` → `CERTS_BY_CAT` → `jw = jobWeightForCert(state, area.id, c)`, `gain = jw ? round(certGainOf · jw.mult / 10) · 10 : certGainOf`; keep `gain > 0`; sort `mult` desc, then `d` asc; top 4; row `{tier} {c.n}` (tier coloured by `TIER_CLS`) · `D{d} · +{gain}P` ([Rule 15](../design-docs/core-beliefs.md#rule-15), [job-weighting.md](../design-docs/job-weighting.md)).
- Exam picks when `areaCatHints(...).exam`: for each `EXAMS` family the first band with `p > exams.best[id].p` (0 if none) through `examBandGain`; up to 3; row `{e.n} {band.label} — 다음 밴드` · `D{band.d} · +{payout}P`.
- Neither list: `매칭되는 표준 성취가 없습니다 — 이 영역은 프로젝트·실적 증거로 승급을 진행하세요.`
- `cats.length > 0`: `도감에서 더 보기 ›` → `onOpenCatalog(area.dir.length === 1 ? cats[0] : null)` → `CatalogModal` (도감, catalogue) preset to that category, else 전체.
- Footer, both branches: the bar legend `칸 하나 = 등급 한 단계, 칸 너비 = 그 단계의 비중. 하위 등급은 좁고 상위 등급은 넓어, 상위 승급 없이는 근접도가 오르지 않습니다. 롤모델 요구에 없는 영역의 활동은 반영되지 않습니다.` (relocated here from the growth tab's headline card, bound once to a `legend` const), then, gap branch only, `추천은 직무 분야 매칭과 직무 가중 기준입니다.`
