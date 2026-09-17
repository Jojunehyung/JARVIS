# Product specs — index
<!-- src: SPEC-3 -->

Per-screen behaviour as implemented. Rules by number → [../design-docs/core-beliefs.md](../design-docs/core-beliefs.md); visual tokens → [../DESIGN.md](../DESIGN.md).

## Screen map
Bottom tab bar (`NAV`, seven tabs since 2026-09-17, `grid-cols-7`): **프로필** `HomeTab` · **목표** `GoalsTab` · **할 일** `TaskTab` · **업무** `WorkTab` · **일정** `ScheduleTab` · **미팅** `MeetingsTab` · **사업** `BizTab`. Internal tab keys are unchanged (`home`, `tasks`, …) — only the nav labels and, for `home` and `tasks`, the everyday names in this doc set changed. Header on every tab: `LIFE MANAGER` / nickname · status / 🔥 streak · 🛡 shields. Phases: `loading` → `onboard` (`Onboarding`, six steps + title) → `main`. The former sixth tab, `성장`, was removed 2026-09-15 — home is now one CV card plus a role-model proximity line; see [home.md](home.md) and [growth.md](growth.md) (retired).

Modals (`Modal` shell, one at a time via `modal` state, 30 values since 2026-09-17): `BriefingModal`, `JournalModal`, `BridgeModal`, `ReviewModal`, `AddGoalModal`, `AddTaskModal`, `EvidenceModal`, `EvidenceViewModal`, `StudyVerifyModal`, `ActivityLogModal`, `PromoteModal`, `RoleModelModal`, `RoleAdviceModal`, `CatalogModal`, `EventModal`, `CalendarExportModal`, `DealModal`, `RateModal`, `FolioModal`, `ProfileModal`, `SettingsModal`, `AchievementWallModal`, `TaskDetailModal`, `EventDetailModal`, `BizTodoModal`, `ProjectModal`, `MeetingModal`, `MeetingViewModal`, `WorkModal`, `WorkBridgeModal`. Full-screen overlays (`Overlay`): `gradeup` (RANK UP), `achieve` (ACHIEVEMENT). One toast (`ToastHost`).

| Spec | Screen / flow |
|---|---|
| [scenario-harness-engineer.md](scenario-harness-engineer.md) | Reference scenario the demo data reproduces |
| [new-user-onboarding.md](new-user-onboarding.md) | Title → 6 steps → computed starting grades |
| [install-and-backup.md](install-and-backup.md) | Installing the app on Android, offline behaviour, and the backup file |
| [daily-briefing.md](daily-briefing.md) | Today's briefing (opened from the `할 일` header), and the journal |
| [home.md](home.md) | The CV card (identity, records, area grades → `PromoteModal`), the role-model proximity line → `RoleAdviceModal`, `SettingsModal` (role model, backup, reset), `AchievementWallModal`, `ProfileModal` (photo, personal facts, education/career records) |
| [goals.md](goals.md) | OKR cards, four KR types, KR check-in, goal status, `AddGoalModal` — the only screen showing goal progress and pace |
| [tasks.md](tasks.md) | One time-ordered list (`todoOf`) shown as compact `TodoRow`s (lead chip, title, at most one marker); tapping a row opens `TaskDetailModal` / `EventDetailModal` / `BizTodoModal`, and completion happens only inside `TaskDetailModal`; the `할 일` / `완료` views, the `브리핑 열기 ›` header button, `AddTaskModal` with the KR bridge, `CatalogModal` |
| [daily-work.md](daily-work.md) | `업무` tab (schema v25; derived carry-forward, a meeting-prep card and a third `source: "meeting"` since v26): dated work items typed by hand, proposed by the assistant bridge and confirmed per item, or mirrored from a meeting follow-up — `MeetingPrepCard`, a day pager whose today view derives carried undone items (`이월 {n}일`), `WorkModal`, `WorkBridgeModal` (`오늘 업무 만들기`), the meeting progress log and `AI에 보내지 않기` flag that feed it, what a work item never does |
| [growth.md](growth.md) | Retired 2026-09-15 — a redirect table to where each former block now lives |
| [schedule.md](schedule.md) | `일정` tab: calendar-only since 2026-09-16 — the month grid and its selected-day panel, `EventModal` (optional `projectId` picker since schema v26), the `캘린더로 내보내기` phone-calendar export (`CalendarExportModal`, per-source table), what an event never does |
| [meetings.md](meetings.md) | `미팅` tab (schema v23; progress log and `AI에 보내지 않기` schema v25; structured follow-up items mirrored to work items, and meeting-prep rows, schema v26): project-grouped, hand-written meeting minutes — `ProjectModal`, `MeetingModal`, `MeetingViewModal`, the caps and storage-budget guard, the optional link to a `일정` event, what a meeting never does |
| [business.md](business.md) | `사업` tab: contracts (`계약`), unit prices (`단가`) and the portfolio (`포트폴리오`), payment chips, the revenue roll-up, `DealModal` / `RateModal` / `FolioModal`, the image and storage guards, what a business record never does |
| [evidence-modals.md](evidence-modals.md) | `EvidenceModal`, `EvidenceViewModal`, `ActivityLogModal`, `StudyVerifyModal` |
| [feedback-overlays.md](feedback-overlays.md) | RANK UP / ACHIEVEMENT overlays and toasts |
