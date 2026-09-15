# Role model and streak
<!-- src: SPEC-5 -->

The recommendation logic behind 방향 제안 (direction advice) lives in `roleRecommendations`, shared with the daily briefing ([assistant-bridge.md](assistant-bridge.md)).

Two numbers describe the person behind the areas (영역): role-model (롤모델) proximity `roleGap`, and the streak with its streak shields (보호권) in `act`. Proximity is derived from area grades and never stored ([Rule 9](core-beliefs.md#rule-9), [Rule 14](core-beliefs.md#rule-14)). Field shapes: [../generated/db-schema.md](../generated/db-schema.md).

**2026-09-11:** the life-metric triple this file used to document (`metrics.asset / infl / body`, its automatic gain from achievements/promotion/goal completion, and its manual check-in) was removed by the user's decision, store and all (schema v19 drops `metrics` and `act.lastCheckin`) — see the [decision log](decision-log.md) and [Rule 8](core-beliefs.md#rule-8). What it claimed to track belongs to a goal's metric KR instead.

## Role-model proximity (`roleGap`)
`role = { name, targets{areaId: 1–8} } | null`. `RoleModelModal` offers `ROLE_PRESETS` (대기업 현직 전문가 · 월 500 1인 사업가 · 프리랜서 전문가 · 창업가·대표) or a free name (empty → `롤모델`) and, per area, `제외` (0) or a required grade from 견습 (1) to 거장 (8) — 정점 (9) cannot be required.
```
items = areas.filter(a => targets[a.id] > 0)
             .map(a => ({ area: a, need: targets[a.id], have: a.grade, gap: max(0, need - have) }))
match = round(mean(min(1, have / need) ** 2) * 100)      // null when role is null or items is empty
```
Overshoot is capped at 1. One grade short: need 5 / have 4 → 64 %, need 3 / have 2 → 44 %, need 8 / have 7 → 77 %, need 4 / have 3 → 56 % — the "about 70 %" of [Rule 14](core-beliefs.md#rule-14) describes the shape, not a constant. Demo: `완성차 1차사 하네스 설계 책임` with targets {직업·커리어 6, 기본지식 4} against grades 3 and 2 → 25 %. Proximity depends only on area grades, so it moves at promotion (or the `어학` specialisation jump); a certification payout by itself does not change it.

`롤모델 근접도` is the small line under the CV on home (2026-09-15, [home.md](../product-specs/home.md); it led the growth tab's headline before the tab was removed): `롤모델 근접도 {match}% · {name} ›`, a button into `RoleAdviceModal` — or, without a usable role, the inert line `롤모델 미설정 — 근접도 계산 대상 없음`. The number and its formula are unchanged. The segmented bar — one cell per required grade, width `((k + 1) / need)² − (k / need)²` × 100 %, filled while `k < min(have, need)`, next to `{RANKS[have].name} / 요구 {RANKS[need].name} · {gap}단계 부족` or `· 충족` — renders at `h-2` with no surrounding card as the first block of `RoleAdviceModal`, one tap away from the home line; the paragraph explaining how to read it sits once underneath, not repeated per branch.

## Direction (방향) advice (`RoleAdviceModal`)
`방향 제안 — {role.name}` opens on the per-area requirement lines and segmented bars (above), followed once by the bar-legend paragraph `칸 하나 = 등급 한 단계, 칸 너비 = 그 단계의 비중. 하위 등급은 좁고 상위 등급은 넓어, 상위 승급 없이는 근접도가 오르지 않습니다. 롤모델 요구에 없는 영역의 활동은 반영되지 않습니다.` — rendered once under the bars rather than repeated at the end of each branch below (2026-09-15; it sat there, once per branch, while this modal was reached from the growth tab). Then, per area with `gap > 0`: `{RANKS[have].name} → {RANKS[need].name} · {gap}단계`, `다음 관문: {RANKS[have + 1].name} 승급 — 이 영역의 성취·증거가 필요합니다.`, a `JOB_FIELDS` toggle row that edits `area.dir` (intersection rule, [Rule 15](core-beliefs.md#rule-15)), then up to 4 certifications from `areaCatHints(state, area).cats` with `gain = round(certGainOf × jw.mult / 10) × 10` (gain 0 dropped; sorted by multiplier desc, then D asc) and, when the area hints an exam, up to 3 next bands above the current best `p`. No match → `매칭되는 표준 성취가 없습니다 — 이 영역은 프로젝트·실적 증거로 승급을 진행하세요.`; every gap closed → `모든 요구 영역을 충족했습니다. 근접도 {match}%.`

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
