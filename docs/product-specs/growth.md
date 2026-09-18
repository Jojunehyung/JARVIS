# Growth tab — retired
<!-- src: SPEC-4-5 -->

The `성장` tab was removed on 2026-09-15: home became one CV plus a role-model proximity line, and every block this tab used to hold moved somewhere still reachable — nothing earned became unreachable. See [home.md](home.md) for the CV, and the [decision log](../design-docs/decision-log.md) entry dated 2026-09-15 for why.

| Former block | Now lives at |
|---|---|
| `롤모델 근접도` headline, the per-area lines and the squared bars | The number moved to home's proximity line, under the CV; the per-area lines and bars are the first block of `RoleAdviceModal`, one tap away. Formula and mechanics: [metrics-and-role-model.md](../design-docs/metrics-and-role-model.md) |
| `실력 트랙 — 영역별 승급 관문` (one row per area, tap → `PromoteModal`) | The CV's `영역 등급` block, `AreaGradeRow` — same row, same tap, same `PromoteModal`. Mechanics: [evidence-and-promotion.md](../design-docs/evidence-and-promotion.md) |
| `성취의 벽` (collapsed) | `AchievementWallModal`, opened from the CV's `성취` row; the CV states the counts, the modal holds every earned item |
| `데이터 — 백업 · 초기화` (collapsed) | `SettingsModal`, opened from the `설정` button in the CV's corner. Mechanics: [install-and-backup.md](install-and-backup.md) |
| `롤모델 설정` / `롤모델 수정` button | `SettingsModal`'s `롤모델` section, which now (v28) also holds the stages editor — nine editable stages with evaluable conditions, beside the untouched proximity. Mechanics: [metrics-and-role-model.md](../design-docs/metrics-and-role-model.md#role-stages-v28) |
| `방향 제안` button | The home proximity line itself is now the entry (when a role model is set); the modal it opens, `RoleAdviceModal`, is unchanged, plus (v28) a stage block once stages exist, and (2026-09-18) an `AI 판정 기록` block with an `AI에게 판정 묻기 ›` button into `RoleVerdictModal` |

Nav order became five tabs, `홈 · 목표 · 실행 · 일정 · 사업`, `grid-cols-5`, on 2026-09-15; a further rename and a
sixth tab landed 2026-09-16 — `프로필 · 목표 · 할 일 · 일정 · 미팅 · 사업`, `grid-cols-6`; `업무` landed
2026-09-17 as the seventh tab, `프로필 · 목표 · 할 일 · 업무 · 일정 · 미팅 · 사업`, `grid-cols-7` (see
[home.md](home.md), [tasks.md](tasks.md), [meetings.md](meetings.md), [daily-work.md](daily-work.md)). `성장`
survives in the source only as an onboarding concept name (`성장시킬 영역`, `추천과 성장 방향`), not as a screen.

For the plan that made the change: [`../exec-plans/completed/2026-09-15-cv-home.md`](../exec-plans/completed/2026-09-15-cv-home.md).
