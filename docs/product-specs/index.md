# Product specs — index
<!-- src: SPEC-3 -->

Per-screen behaviour as implemented. Rules by number → [../design-docs/core-beliefs.md](../design-docs/core-beliefs.md); visual tokens → [../DESIGN.md](../DESIGN.md).

## Screen map
Bottom tab bar (`NAV`, five tabs): **홈** `HomeTab` · **목표** `GoalsTab` · **실행** `TaskTab` · **일정** `ScheduleTab` · **사업** `BizTab`. Header on every tab: `LIFE MANAGER` / nickname · status / 🔥 streak · 🛡 shields. Phases: `loading` → `onboard` (`Onboarding`, six steps + title) → `main`. The former sixth tab, `성장`, was removed 2026-09-15 — home is now one CV card plus a role-model proximity line; see [home.md](home.md) and [growth.md](growth.md) (retired).

Modals (`Modal` shell, one at a time via `modal` state): `BriefingModal`, `JournalModal`, `BridgeModal`, `ReviewModal`, `AddGoalModal`, `AddTaskModal`, `EvidenceModal`, `EvidenceViewModal`, `StudyVerifyModal`, `ActivityLogModal`, `PromoteModal`, `RoleModelModal`, `RoleAdviceModal`, `CatalogModal`, `EventModal`, `CalendarExportModal`, `DealModal`, `RateModal`, `FolioModal`, `ProfileModal`, `SettingsModal`, `AchievementWallModal`. Full-screen overlays (`Overlay`): `gradeup` (RANK UP), `achieve` (ACHIEVEMENT). One toast (`ToastHost`).

| Spec | Screen / flow |
|---|---|
| [scenario-harness-engineer.md](scenario-harness-engineer.md) | Reference scenario the demo data reproduces |
| [new-user-onboarding.md](new-user-onboarding.md) | Title → 6 steps → computed starting grades |
| [install-and-backup.md](install-and-backup.md) | Installing the app on Android, offline behaviour, and the backup file |
| [daily-briefing.md](daily-briefing.md) | Today's briefing (opened from the `실행` header), and the journal |
| [home.md](home.md) | The CV card (identity, records, area grades → `PromoteModal`), the role-model proximity line → `RoleAdviceModal`, `SettingsModal` (role model, backup, reset), `AchievementWallModal`, `ProfileModal` (photo, personal facts, education/career records) |
| [goals.md](goals.md) | OKR cards, four KR types, KR check-in, goal status, `AddGoalModal` — the only screen showing goal progress and pace |
| [tasks.md](tasks.md) | One time-ordered list (`todoOf`): task / event / business rows, the `할 일` / `완료` views, the `브리핑 열기 ›` header button, `AddTaskModal` with the KR bridge, `CatalogModal` |
| [growth.md](growth.md) | Retired 2026-09-15 — a redirect table to where each former block now lives |
| [schedule.md](schedule.md) | `일정` tab: the `목록` / `달력` views, day groups, occurrence rows, the month grid and its selected-day panel, `EventModal`, the `캘린더로 내보내기` phone-calendar export (`CalendarExportModal`, per-source table), what an event never does |
| [business.md](business.md) | `사업` tab: contracts (`계약`), unit prices (`단가`) and the portfolio (`포트폴리오`), payment chips, the revenue roll-up, `DealModal` / `RateModal` / `FolioModal`, the image and storage guards, what a business record never does |
| [evidence-modals.md](evidence-modals.md) | `EvidenceModal`, `EvidenceViewModal`, `ActivityLogModal`, `StudyVerifyModal` |
| [feedback-overlays.md](feedback-overlays.md) | RANK UP / ACHIEVEMENT overlays and toasts |
