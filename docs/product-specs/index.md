# Product specs — index
<!-- src: SPEC-3 -->

Per-screen behaviour as implemented. Rules by number → [../design-docs/core-beliefs.md](../design-docs/core-beliefs.md); visual tokens → [../DESIGN.md](../DESIGN.md).

## Screen map
Bottom tab bar (`NAV`, four tabs): **홈** `HomeTab` · **목표** `GoalsTab` · **실행** `TaskTab` · **성장** `GrowthTab`. Header on every tab: `LIFE MANAGER` / nickname · status / 🔥 streak · 🛡 shields. Phases: `loading` → `onboard` (`Onboarding`, six steps + title) → `main`.

Modals (`Modal` shell, one at a time via `modal` state): `BriefingModal`, `JournalModal`, `BridgeModal`, `ReviewModal`, `AddGoalModal`, `AddTaskModal`, `EvidenceModal`, `EvidenceViewModal`, `StudyVerifyModal`, `ActivityLogModal`, `PromoteModal`, `RoleModelModal`, `RoleAdviceModal`, `CatalogModal`, `MetricsModal`. Full-screen overlays (`Overlay`): `gradeup` (RANK UP), `achieve` (ACHIEVEMENT). One toast (`ToastHost`).

| Spec | Screen / flow |
|---|---|
| [scenario-harness-engineer.md](scenario-harness-engineer.md) | Reference scenario the demo data reproduces |
| [new-user-onboarding.md](new-user-onboarding.md) | Title → 6 steps → computed starting grades |
| [install-and-backup.md](install-and-backup.md) | Installing the app on Android, offline behaviour, and the backup file |
| [daily-briefing.md](daily-briefing.md) | Today's briefing, the home card, and the journal |
| [home.md](home.md) | Profile card, briefing card, today’s focus (pace), today’s agenda |
| [goals.md](goals.md) | OKR cards, four KR types, KR check-in, goal status, `AddGoalModal` |
| [tasks.md](tasks.md) | Per-goal groups, milestones, unassigned section, `AddTaskModal` with the KR bridge, `CatalogModal` |
| [growth.md](growth.md) | Achievement wall, life metrics, skill-track gates, role model, direction advice, reset |
| [evidence-modals.md](evidence-modals.md) | `EvidenceModal`, `EvidenceViewModal`, `ActivityLogModal`, `StudyVerifyModal` |
| [feedback-overlays.md](feedback-overlays.md) | RANK UP / ACHIEVEMENT overlays and toasts |
