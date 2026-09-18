# Information architecture
<!-- src: SPEC-3 -->

The app is a four-level hierarchy — 영역 (area) → 목표 (goal) → KR (key result) → 실행 (task) — shown through seven tabs, thirty-nine modals, and three overlays (seven tabs since 2026-09-17, up from six since 2026-09-16; 22 → 28 → 30 → 33 → 38 → 39 modals, [decision log](decision-log.md); the third overlay, `stage`, added 2026-09-18). The fourth tab, 업무 (daily work), the fifth, 일정 (schedule), the sixth, 미팅 (meetings), and the seventh, 사업 (business), all sit outside the hierarchy: a work item, an event, a meeting or a business record is a dated record with no goal above it ([../product-specs/daily-work.md](../product-specs/daily-work.md), [../product-specs/schedule.md](../product-specs/schedule.md), [../product-specs/meetings.md](../product-specs/meetings.md), [../product-specs/business.md](../product-specs/business.md)). Every other spec assumes this vocabulary. Field shapes are generated in [../generated/db-schema.md](../generated/db-schema.md); per-screen behaviour lives in [../product-specs/index.md](../product-specs/index.md).

The sixth tab, 성장 (growth), was removed 2026-09-15: home became one CV card — identity, education/career/certification/exam/portfolio/achievement records, and the area-grade rows that open `PromoteModal` — plus a role-model proximity line under it. Nothing the tab held became unreachable; the map is in [../product-specs/home.md](../product-specs/home.md) and, briefly, [../product-specs/growth.md](../product-specs/growth.md) (retired).

## Hierarchy: area → goal → KR → task
```
영역  areas[]   life area + optional job directions `dir`. `grade` 0–9. Achievement log `achievements[]`.
└ 목표  goals[]  OKR: title · areaId · deadline? · note? · status active|done · createdAt · krs[] (no limit, 0 allowed)
    └ KR  krs[]   four types
        metric  { title, start, target, current, unit }   → updated by KR check-in and fitness records
        count   { title, need }                            → derived from completions of tasks linked to the goal
        exam    { title, famId, band{label,d,p,conf} }     → derived from `exams.best` once the exam milestone completes
        cert    { title, certName, done? }                 → `done` is set automatically when the cert milestone completes
    └ 실행  tasks[] `goalId` required for new tasks; `areaId` inherited from the goal
        daily task   diff E/D/C · type daily|once · kind? book|fit
        study        isStudy · diff E/D · source · scope?
        milestone    isCert (certD, sg?) / isExam (famId, band) — created only by KR one-click, type once
```
Progress is never stored ([Rule 9](core-beliefs.md#rule-9)): `krProgress` computes each KR (metric = (current − start) / (target − start) clamped to 0–1; exam = `best.p / band.p` capped at 1; cert = `done ? 1 : 0`; count = completions / `need` capped at 1, where a daily task counts every entry in `doneDates` and a once task counts 1 when `status === "done"`), and `goalProgress` is the mean over the goal's KRs (0 with no KRs). `paceOf` compares that with elapsed time ([Rule 13](core-beliefs.md#rule-13)).

## KR–task bridge (`AddTaskModal`)
The modal opens from a goal (`modal.type === "addQuest"`, `goalId`) and shows `실행 추가`, a goal box `🎯 {goal.title}` / `영역: {areaName} (목표에서 상속)`, then — when the goal has KRs — the list `이 목표의 핵심결과 — 클릭해서 바로 연결` ([Rule 19](core-beliefs.md#rule-19)).

| KR type | Row label | Right-hand state | Creates |
|---|---|---|---|
| exam | `🎓 {fam.n} {band.label} — 시험 마일스톤 · D{band.d}` | `달성` (`exams.best[famId].p ≥ band.p`) / `등록됨` (an `isExam` task with the same `famId` + band label already exists in this goal) / `등록 ›` | `{ title: "{fam?.n \|\| "시험"} {label} 달성", diff: scoreTier(band.p), pts: band.p, type: "once", isExam, famId, band }` — `시험` is the fallback when the family is not found |
| cert | `📜 {c.n} — 자격 마일스톤 · 적합 {tier} · +{gain}P` | `취득` (`kr.done`) / `등록됨` (any `isCert` task anywhere whose title includes `certName`) / `등록 ›` | `{ title: "{c.n} 취득", diff: scoreTier(certP(d)), pts: certP(d), certD, sg?, type: "once", isCert }` |
| count | `🔁 {title} — 일일 실행으로 채우기 · {krDoneCount}/{need}` | `채우기 ›` | form prefill only: title, `kind = detectKind(title)`, diff E, type daily, and `krId = kr.id` — the one carve-out that lets registration go through with no kind, since a count KR is the goal's own measured action; the `등록` button still has to be pressed |
| metric | `📈 {title} — 목표 탭 체크인으로 관리 (운동 기록의 측정값도 자동 반영)` | guidance only | nothing |

- The cert row resolves `certOf(kr.certName) || certByTitle(kr.certName)`; if neither matches it renders `📜 {certName} — 도감에 없는 명칭이라 자동 연결 불가(KR 이름을 표준 명칭으로 맞춰 주세요)` and nothing can be registered.
- `tier` comes from `jobWeightForCert` for the goal's area and `gain = Math.round(certGainOf({ certBest }, c) * (jw?.mult ?? 1) / 10) * 10` ([Rule 15](core-beliefs.md#rule-15), [Rule 3](core-beliefs.md#rule-3)). Rows in the 달성 / 등록됨 / 취득 state are disabled.
- The root `addQuest` handler refuses a second `isCert` task with the same title: toast `{title} — 이미 등록된 자격입니다. 자격 지급은 영역과 무관하게 1회입니다.`

## Time groups, not goal groups (`TaskTab`, rewritten 2026-09-13; rows made compact 2026-09-16)
`할 일` (renamed from `실행` 2026-09-16) no longer mirrors the hierarchy above: it is one time-ordered list —
tasks, schedule occurrences and two dated business facts — built by the pure helper `todoOf(state, today)`, and
`목표` is the only surface left that groups by goal (as numbers, never as a task-row list). The four-level
hierarchy itself is unchanged; only this tab's *view* stopped mirroring it. Since 2026-09-16 each row is also a
single compact line — a lead chip, the title and at most one marker — with completion reachable only by tapping
into a detail sheet. Full behaviour: [../product-specs/tasks.md](../product-specs/tasks.md).

- **Milestone** — `isMile = isCert || isExam || isStudy` still names the one-day exception
  ([Rule 18](core-beliefs.md#rule-18)) and still shows a `Lock` marker instead of a checkbox until completed, but
  a milestone is just a `task`-kind row like any other: it sits wherever its `due` (or, undated, `이후`) places
  it, with no divider and no per-goal section around it. Every row — milestone or not — carries the
  `목표 기여 없음` marker when its goal is gone; the goal name itself now lives only in the row's detail sheet,
  not on the row.
- **Daily task** — everything else. Still capped at difficulty C (`DIFFS.C.pts` 60 < `EVIDENCE_MIN` 150); the
  modal still offers only E / D / C and says `하루분량 상한 C`.
- **Orphan tasks** — no `goalId`, or a `goalId` that resolves to no goal (including the completed tasks kept when
  an active goal is deleted through `목표 삭제`, and every task of a goal removed with `기록에서 제거`). There is
  no longer a section named for them: they render as ordinary rows tagged `목표 기여 없음`, in whichever time
  group their date puts them, completed and deleted exactly like any other task row.
- **A goal with `status === "done"`** is no longer a blind spot: the old per-active-goal loop skipped it (not
  active) and the orphan section didn't apply either (the goal still resolves) — this dropped its tasks from
  every section. The rewrite filters on task state only, never goal state, so those tasks render like any other
  ([TD-02](../exec-plans/tech-debt-tracker.md), resolved 2026-09-13).
- Tab header: `할 일 — 시간순` / `실행·일정·사업을 시간순으로 모아요. 항목을 누르면 상세가 열려요. 새 실행은 목표
  탭에서 만들어요.` plus the `도감` (catalogue) button → `CatalogModal` and a `할 일` / `완료` view toggle
  (component state, never `state.ui`). Empty state (no open row, no active goal): `실행은 목표의 실행 단위입니다
  — 목표가 먼저예요.` → `목표 먼저 세우기 ›`. `＋ 이 목표에 실행` is gone with the per-goal sections it lived in
  — task creation now starts only from `목표`'s `＋ 실행 연결` / KR rows ([Rule 19](core-beliefs.md#rule-19)).

## Screen map (`NAV`, seven tabs since 2026-09-17)
| Tab key | Label | Icon | Component | Composition |
|---|---|---|---|---|
| home | 프로필 | IdCard | `HomeTab` | one CV card (identity + `프로필 편집` button + a `오늘 읽을 것 ›` button, schema v27, opening the daily reader + `설정` button, records `학력`/`경력`/`자격`/`시험`/`포트폴리오`/`성취`, area-grade rows → `PromoteModal`) · a role-model proximity line under it → `RoleAdviceModal` · (v28) a second stage line `단계 {k}/{n} · 조건 {c}/{m} · {전환 조건}` when `role.stages` exist, same target modal; no date-scoped fact of any kind (2026-09-15, [../product-specs/home.md](../product-specs/home.md)) |
| goals | 목표 | Target | `GoalsTab` | numbers only — `목표 (OKR)` cards (progress, pace, KR rows, check-in) · `새 목표` · `＋ 실행 연결` · `달성 처리` · `기록에서 제거` · `목표 삭제`; the only surface a task is created from, and the only screen showing goal progress with pace |
| tasks | 할 일 | ClipboardList | `TaskTab` | one time-ordered list from `todoOf` — groups `기한 지남` / `오늘` / `내일` / `이번 주` / `이후`, with rows completed today kept in their group struck through after the open rows (the `오늘 완료` group was removed 2026-09-16), compact `TodoRow`s (lead chip, title, at most one marker) for all three row kinds, tapping opens `TaskDetailModal` / `EventDetailModal` / `BizTodoModal`, `할 일` / `완료` view chips (the `완료` archive lists completed tasks and ticked schedule dates together), counts + business-count lines, `도감`, and `브리핑 열기 ›` |
| work | 업무 | ListChecks | `WorkTab` | dated work items (schema v25; a third source, `source: "meeting"`, and derived carry-forward since v26), typed by hand, proposed by the assistant bridge and confirmed per item, or mirrored from a meeting follow-up — `MeetingPrepCard` (`오늘 회의 준비`) first — a `div` since schema v27 ([TD-64](../exec-plans/tech-debt-tracker.md)), with an explicit `회의록 열기 ›` button, the project's documents and an `<EventChecks>` checklist with `AI에게 회의 준비 묻기` — then a day pager whose today view prefixes every undone item from earlier days (`이월 {n}일`, derived, never moved), `WorkModal` (a meeting-linked item's sheet gains `회의록 열기`, 2026-09-17, replacing the sheet with that meeting's view in the single modal slot — closing it lands on the tab, [TD-58](../exec-plans/tech-debt-tracker.md)), `WorkBridgeModal` (`AI로 만들기 ›`), `PrepBridgeModal` (schema v27, `AI에게 회의 준비 묻기`); a record, never a task — see [../product-specs/daily-work.md](../product-specs/daily-work.md) |
| schedule | 일정 | CalendarDays | `ScheduleTab` | calendar-only since 2026-09-16: `다가오는 일정` header + `캘린더로 내보내기` + counts line, then `ScheduleCalendar` always — month header (`{YYYY}년 {M}월` · `‹` · `›` · `오늘`), seven-column grid with one marker per occurrence, `선택한 날짜` panel with `EventRow` and its own `일정 추가` |
| meetings | 미팅 | MessagesSquare | `MeetingsTab` | project-grouped, hand-written meeting minutes (schema v23; progress log and the `AI에 보내지 않기` flag since v25; structured follow-up items, mirrored to work items, since v26; documents and pre-meeting checks since v27); header (counts + storage-use line, now `문서 {n}건` too) + `프로젝트 추가` · one section per project (`프로젝트 수정`, `회의록 추가`, `문서 추가`, compact minutes rows with a `후속 {open}/{total}` marker, a documents block since v27) · always a project-less group `프로젝트 없음 · 긴급 메모` after every project section (2026-09-17, `긴급 메모 추가`, `projectId: null`) · a meeting's optional pasted `transcript` (≤ 30,000 chars, collapsed in the view, cleared on its own, never read by any packet) · `확인할 것 가져오기` copying a linked event's checks into follow-up rows (v27) · `ProjectModal` / `MeetingModal` / `MeetingViewModal` / `DocumentModal` (v27); a record, never a task — see [../product-specs/meetings.md](../product-specs/meetings.md), [../product-specs/documents.md](../product-specs/documents.md) |
| biz | 사업 | Briefcase | `BizTab` | header (`이번 달 계약` / `남은 계약` / (v28) `일시금 미확인` lines) + per-view add button · the view toggle `계약` / `단가` / `포트폴리오` / (v28) `로드맵` / `리드` / `공고` (stored in `ui.bizView`) · **계약**: groups `진행 중` / `예정` / `견적 대기` / `문의` / `종료` / `무산` by derived phase, payment chips, lump-sum payment chips (v28), `최근 6개월` roll-up · **단가**: rate rows with margin, footer count · **포트폴리오**: one-column cards with links and a stored thumbnail · (v28) **로드맵**: milestones by status with D-day/completion/pace and a nine-stage seed · **리드**: a hospital sales pipeline grouped by stage · **공고**: national-project notices by deadline |

**Tracks (v28).** Every project, document, event, work item and deal — and, derived, every meeting — carries a
`track`: `직장` (the day job), `사업` (the business), `개인` (private life). The reader, the briefing and the
work tab all order and label by track, `직장` first; a `직장`-track record never leaves the device through any
of the four AI packets. Vocabulary and mechanics: [../product-specs/meetings.md](../product-specs/meetings.md#tracks-v28),
[../SECURITY.md](../SECURITY.md).

The former sixth tab, 성장 (growth), is retired ([../product-specs/growth.md](../product-specs/growth.md)); its role-model headline, skill track, achievement wall and backup/reset controls are the home row above, `RoleAdviceModal` and two modals from that rewrite (`SettingsModal`, `AchievementWallModal`, below). A work item (added 2026-09-17) sits outside the hierarchy the same way an event, a meeting or a business record does — a dated record with no goal above it.

- Modals, one at a time (`modal.type`, 39 values since 2026-09-18, up from 38 at v28): `addQuest` (renders `AddTaskModal`; the type string keeps the legacy name) / `addGoal` / `evidence` / `promote` / `role` / `activity` / `study` / `evidenceView` / `catalog` / `roleAdvice` / `event` / `deals` / `rates` / `folio` / `briefing` / `journal` / `bridge` / `review` / `profile` (renders `ProfileModal`, opened from the CV's `프로필 편집` button) / `calExport` (renders `CalendarExportModal`, opened from the `일정` header's `캘린더로 내보내기` button) / `settings` (renders `SettingsModal`, opened from the CV's corner `설정` button; role model, weekly business-hours budget (v28), backup, reset) / `wall` (renders `AchievementWallModal`, opened from the CV's `성취` row; trophies, specialisations, exam bests, per-area achievements) / `taskDetail` / `eventDetail` / `bizDetail` (the `할 일` row detail sheets, [../product-specs/tasks.md](../product-specs/tasks.md)) / `project` / `meeting` / `meetingView` / `document` (v27, [../product-specs/documents.md](../product-specs/documents.md)) (the `미팅` sheets, [../product-specs/meetings.md](../product-specs/meetings.md)) / `work` / `workBridge` / `prepBridge` (v27) (the `업무` sheets, [../product-specs/daily-work.md](../product-specs/daily-work.md)) / `reader` (v27, `DailyReaderModal`, [../product-specs/daily-reader.md](../product-specs/daily-reader.md)) / `milestone` / `timeLog` / `lead` / `notice` / `reviewBridge` (five new v28 modals — `MilestoneModal`, `TimeLogModal`, `LeadModal`, `NoticeModal`, the generalised `WorkBridgeModal` rendered a second time for the `주간 회고` packet, [../product-specs/business.md](../product-specs/business.md), [../product-specs/daily-work.md](../product-specs/daily-work.md), [../design-docs/assistant-bridge.md](../design-docs/assistant-bridge.md)) / `roleVerdict` (2026-09-18, `RoleVerdictModal`, the fifth bridge packet's send/paste/confirm sheet, opened from `RoleAdviceModal`'s `AI에게 판정 묻기 ›` button; [../design-docs/metrics-and-role-model.md](../design-docs/metrics-and-role-model.md#the-story-the-verdict-and-stage-progress-2026-09-18)) — the profile tab's CV card gains the stage-progress headline (above the proximity line) on the same v28 stages, unrelated to this modal count.
- Overlays (`overlay.type`): `gradeup` / `achieve` / `stage` (2026-09-18). Toast: `ToastHost` holds one slot with no queue — a new `show` replaces the current message and restarts the 2600 ms timer.
- Header on every tab: `LIFE MANAGER` · `{displayName(profile)}` (nickname, else name, else `사용자`) · `{status}` · `🔥 {streak}일` · `🛡 {shieldsLeft}` (보호권, streak shield).
- Phases: `loading` (`불러오는 중...`) → `onboard` (`Onboarding`, rendered without `Shell`) → `main`.
