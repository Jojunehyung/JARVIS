# Growth tab — retired
<!-- src: SPEC-4-5 -->

The `성장` tab was removed on 2026-09-15: home became one CV plus, once the role model has stages, a one-row stage line, and every block this tab used to hold moved somewhere still reachable — nothing earned became unreachable. See [home.md](home.md) for the CV, and the [decision log](../design-docs/decision-log.md) entry dated 2026-09-15 for why.

| Former block | Now lives at |
|---|---|
| `롤모델 근접도` headline, the per-area lines and the squared bars | The headline retired entirely 2026-09-18 (third role-model change of the day, [Rule 14](../design-docs/core-beliefs.md#rule-14) amendment) — home's row under the CV states the stage facts (`단계 k/n · 조건 c/m`) instead, no percentage; the per-area lines are `RoleGradeSection`, collapsed by default under the `롤모델` screen's `영역 등급` section (moved verbatim from `RoleAdviceModal`, retired 2026-09-18 — the squared bars and their legend paragraph were themselves retired the same day, second change). Mechanics: [metrics-and-role-model.md](../design-docs/metrics-and-role-model.md) |
| `실력 트랙 — 영역별 승급 관문` (one row per area, tap → `PromoteModal`) | The CV's `영역 등급` block, `AreaGradeRow` — same row, same tap, same `PromoteModal`. Mechanics: [evidence-and-promotion.md](../design-docs/evidence-and-promotion.md) |
| `성취의 벽` (collapsed) | `AchievementWallModal`, opened from the CV's `성취` row; the CV states the counts, the modal holds every earned item |
| `데이터 — 백업 · 초기화` (collapsed) | `SettingsModal`, opened from the `설정` button in the CV's corner. Mechanics: [install-and-backup.md](install-and-backup.md) |
| `롤모델 설정` / `롤모델 수정` button | `SettingsModal`'s `롤모델` section, opening the `롤모델` screen (`RoleModal`, 2026-09-18); the stages editor (twelve editable stages with evaluable conditions, since v28) moved behind the screen's `세부 수정 ›` into the `roleEdit` sub-screen (`RoleModelModal`). Mechanics: [metrics-and-role-model.md](../design-docs/metrics-and-role-model.md#the-role-screen-2026-09-18-second-change-of-the-day) |
| `방향 제안` button | The home stage/role row itself is the entry, opening the `롤모델` screen (`RoleModal`, replacing `RoleAdviceModal` 2026-09-18): `원하는 모습` with story templates and the verdict CTA/history, a `스토리라인` timeline of every stage with `지금 할 것` landings, and the collapsed `영역 등급` (`RoleGradeSection`, `RoleAdviceModal`'s old body — its bars and legend retired 2026-09-18, third role-model change of the day) |

Nav order became five tabs, `홈 · 목표 · 실행 · 일정 · 사업`, `grid-cols-5`, on 2026-09-15; a further rename and a
sixth tab landed 2026-09-16 — `프로필 · 목표 · 할 일 · 일정 · 미팅 · 사업`, `grid-cols-6`; `업무` landed
2026-09-17 as the seventh tab, `프로필 · 목표 · 할 일 · 업무 · 일정 · 미팅 · 사업`, `grid-cols-7` (see
[home.md](home.md), [tasks.md](tasks.md), [meetings.md](meetings.md), [daily-work.md](daily-work.md)). `성장`
survives in the source only as an onboarding concept name (`성장시킬 영역`, `추천과 성장 방향`), not as a screen.

For the plan that made the change: [`../exec-plans/completed/2026-09-15-cv-home.md`](../exec-plans/completed/2026-09-15-cv-home.md).
