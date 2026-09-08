# Life metrics, role model, and streak
<!-- src: SPEC-5 -->

Three numbers describe the person behind the areas (영역): life metrics (인생 지표) `metrics.asset / infl / body`, role-model (롤모델) proximity `roleGap`, and the streak with its streak shields (보호권) in `act`. Metrics move only through achievements (성취), promotion (승급), goal completion and manual check-in — never with time ([Rule 8](core-beliefs.md#rule-8)); proximity is derived from area grades and never stored ([Rule 9](core-beliefs.md#rule-9), [Rule 14](core-beliefs.md#rule-14)); `metrics.risk` became `metrics.body` in schema v12 ([Rule 12](core-beliefs.md#rule-12)). Field shapes: [../generated/db-schema.md](../generated/db-schema.md).

## Life metrics (`METRICS_META`)
| k | name | colour | description |
|---|---|---|---|
| asset | 자산 | bg-amber-400 | 경제력·자본. 성취와 수익 목표로 상승 |
| infl | 영향력 | bg-violet-400 | 실력·평판·네트워크. 승급과 전문 성취로 상승 |
| body | 외형 | bg-emerald-400 | 운동·식단·컨디션 관리의 결과. 체크인으로 스스로 평가 |

Range 0–100 through `statClamp(v) = Math.max(0, Math.min(100, Math.round(v)))`. `freshState` starts at asset 10 / infl 5 / body 15; the v12 migration also sets `body` to 15 because the meaning inverted from `risk`. `demoState` uses 24 / 14 / 20.

## Automatic gain (`metricsGain`)
```
metricsGain(s, dVal, areaName):
  g  = max(1, round(dVal / 10))
  aG = areaName === "사업" ? g : areaName === "직업·커리어" ? ceil(g * 0.6) : ceil(g * 0.3)
  iG = (areaName === "사업" || areaName === "직업·커리어") ? ceil(g * 0.6) : ceil(g * 0.8)
  asset = statClamp(asset + aG);  infl = statClamp(infl + iG)     // body untouched (self-assessment only)
```
The area names `사업` and `직업·커리어` are matched as strings; a renamed or custom area gets the "other" multipliers. `dVal` per caller in `completeTask`:

| Caller | `dVal` |
|---|---|
| exam | `band.d` — the band's D, regardless of skill-bucket decay or difference payout |
| certification | `wD = round((certD ?? round(sqrt(cp * 5))) * (jw?.mult ?? 1))`, called only when `wD > 0` — a C-tier (×0) certification moves nothing |
| study with pts ≥ 150, legacy general B/A | `min(100, round(sqrt(pts * 5)))` — 150 → 27, 400 → 45 |

Fixed additions outside `metricsGain`: promotion `infl + 3` (`promoteArea`); goal completion `infl + 4` and `asset + 2` (`goalStatus(id, "done")` — moving the goal back to active does not take them back).

## Check-in (`MetricsModal` → `saveMetrics`)
`인생 지표 체크인` on the growth tab shows one 0–100 slider per metric; `저장` replaces all three keys at once (`statClamp` each) and toasts `지표를 갱신했어요`. This is the only path that changes `body`.

## Role-model proximity (`roleGap`)
`role = { name, targets{areaId: 1–8} } | null`. `RoleModelModal` offers `ROLE_PRESETS` (대기업 현직 전문가 · 월 500 1인 사업가 · 프리랜서 전문가 · 창업가·대표) or a free name (empty → `롤모델`) and, per area, `제외` (0) or a required grade from 견습 (1) to 거장 (8) — 정점 (9) cannot be required.
```
items = areas.filter(a => targets[a.id] > 0)
             .map(a => ({ area: a, need: targets[a.id], have: a.grade, gap: max(0, need - have) }))
match = round(mean(min(1, have / need) ** 2) * 100)      // null when role is null or items is empty
```
Overshoot is capped at 1. One grade short: need 5 / have 4 → 64 %, need 3 / have 2 → 44 %, need 8 / have 7 → 77 %, need 4 / have 3 → 56 % — the "about 70 %" of [Rule 14](core-beliefs.md#rule-14) describes the shape, not a constant. Demo: `완성차 1차사 하네스 설계 책임` with targets {직업·커리어 6, 기본지식 4} against grades 3 and 2 → 25 %. The growth tab draws one segment per required grade with width `((k + 1) / need)² − (k / need)²` × 100 %, filled while `k < min(have, need)`, next to `{RANKS[have].name} / 요구 {RANKS[need].name} · {gap}단계 부족` or `· 충족`. Proximity depends only on area grades, so it moves at promotion (or the `어학` specialisation jump); a certification payout by itself does not change it.

## Direction (방향) advice (`RoleAdviceModal`)
`방향 제안 — {role.name}` lists each area with `gap > 0`: `{RANKS[have].name} → {RANKS[need].name} · {gap}단계`, `다음 관문: {RANKS[have + 1].name} 승급 — 이 영역의 성취·증거가 필요합니다.`, a `JOB_FIELDS` toggle row that edits `area.dir` (intersection rule, [Rule 15](core-beliefs.md#rule-15)), then up to 4 certifications from `areaCatHints(state, area).cats` with `gain = round(certGainOf × jw.mult / 10) × 10` (gain 0 dropped; sorted by multiplier desc, then D asc) and, when the area hints an exam, up to 3 next bands above the current best `p`. No match → `매칭되는 표준 성취가 없습니다 — 이 영역은 프로젝트·실적 증거로 승급을 진행하세요.`; every gap closed → `모든 요구 영역을 충족했습니다. 근접도 {match}%.`

## Streak and shields (`applyDailyTick`, `completeTask`)
`act = { streak, lastActive, shieldMonth: "YYYY-MM", shieldsLeft }`, starting at streak 0, `lastActive: null`, `shieldsLeft: 2`.
```
applyDailyTick(s):        // on load after migrate, and inside freshState
  if (act.shieldMonth !== monthStr()) { act.shieldMonth = monthStr(); act.shieldsLeft = 2 }
  s.lastTick = dstr()
```
Nothing else happens on a tick — time never lowers the streak. The judgement lives in `completeTask`, once per day (`lastActive !== today`):
```
lastActive === shiftDay(today, -1)                     → streak += 1
lastActive === shiftDay(today, -2) && shieldsLeft > 0  → shieldsLeft -= 1; streak += 1; shield = true
otherwise                                              → streak = 1
lastActive = today
```
A consumed shield appends ` · 보호권 사용` to the completion toast (`완료 · 🎯 {goal} {from}→{to}%` or `완료 · 목표 기여 없음 · 🔥 {streak}일`). The home header shows `🔥 {streak}일` and `🛡 {shieldsLeft}`; during a gap the previous streak stays on screen until the next completion recomputes it. `lastTick` and `dModel` are written by `migrate`, `applyDailyTick` and `freshState` and read nowhere.
