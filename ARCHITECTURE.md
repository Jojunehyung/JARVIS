# ARCHITECTURE.md — Life Manager
<!-- src: CL-2 --><!-- src: CL-3 --><!-- src: CL-4 --><!-- src: SPEC-10 -->

Single-page React app in one file. This document is the map: where things are, how state flows, how it is built and verified. Rules live in [docs/design-docs/core-beliefs.md](docs/design-docs/core-beliefs.md); the generated symbol index is [docs/generated/symbol-index.md](docs/generated/symbol-index.md).

## Stack
Vite 5 · React 18 · Tailwind v3 (core utilities only) · lucide-react. Node 24 at `C:\Program Files\nodejs` (add it to PATH in Git Bash: `export PATH="/c/Program Files/nodejs:$PATH"`). No backend, no network at runtime.

## Files
```
src/LifeManager.jsx    the app (≈ 7,820 lines) — see "File regions"
src/main.jsx           React root
src/index.css          Tailwind directives
index.html             shell; data-URI favicon; manifest link
public/                icon.svg, manifest.webmanifest
vite.config.js         dev/prod build → dist/
vite.demo.config.js    single-file demo build → release/life-demo.html (IIFE script inlined before </body>; opens from file://)
tools/e2e/             puppeteer-core E2E harness (see docs/RELIABILITY.md)
tools/harness/         finish gate, verify, docs generation (see AGENTS.md §8)
docs/                  product, design, engine, plans, generated tables
```

## File regions (`src/LifeManager.jsx`, banner comments `/* ── … ── */`)
| Region | What lives there | Grep anchor |
|---|---|---|
| Constants & rules | `RANKS`, `DIFFS`, `EVIDENCE_MIN`, `certP`, `achGrade`, `GRADE_*`, `CERT_CATS`, **`CERTS` (1,011 rows)**, `DIFF_RAW_VERSION` | `const CERTS = [` |
| Onboarding option data | `AGE_OPTS … OUTPUT_OPTS`, `MAJOR_FIELDS`, `KNOWLEDGE_FIELDS`, `gFromD`, `computeGrades`, the CV chip lists `EDU_LEVELS` / `EDU_STATUS` / `EMP_KINDS` (deliberately not in `DATA_TABLES`), the CV → starting-grade helpers `ageOf`, `ageText`, `careerMonths`, `careerText`, `eduKeyOf`, `careerKeyOf`, `displayName`, `topEdu`, `latestCareer`, the home-CV helpers `cvSummaryOf` (shared with `buildAssistantPacket`'s `## 이력` line) and `heldCertsOf` (declared + earned certifications, shared with `ProfileModal`'s `보유 기록`), `GATE_CHIPS`, `AREA_PRESETS`, `ROLE_PRESETS`, `TASK_TEMPLATES`, `detectKind`, `goalKinds` | `초기 설정 선택지` |
| Storage adapter | `KEY`, `store` (`get/set/del`, JSON, memory fallback) — **call sites are frozen** — plus the image-storage guards `persisted`, `storageUsedBytes`, `storageUsedWith` (`state`-aware, one render ahead of `storageUsedBytes()` alone — read by the meetings storage guard and its counts line), `saveImageChecked` and their constants `IMG_FILE_MAX`, `THUMB_MAX_EDGE`, `THUMB_MAX_CHARS`, `STORAGE_BUDGET` | `const store =` |
| Illustrations & utils | `PortraitSprite`, `Portrait`, `resizeImage`, `resizeImageFit` (aspect-preserving sibling resize, never upscales), `TrophySvg`, `TIER_COLORS`, empty-state SVGs, `uid`, `dstr`, `shiftDay`, `monthStr`, `Bar`, `Chip`, `DiffBadge`, `CertBadge`, `Modal` | `function TrophySvg` |
| Exam engine | `EXAMS` (17 families), `EXAM_BY_ID`, `examOf`, `LANG_KO`, `DIM_STEPS`, `calcExamPayout`, `POINT_POLICY_VERSION`, plus the display-only exam score helpers `EXAM_LABEL_NUM`, `EXAM_SCORE_MAX_LEN`, `examScoreNumeric`, `examScoreError`, `examScoreBetter`, `examBestText` (2026-09-16, schema v22 — read/write payout unchanged, [scoring-engine.md](docs/design-docs/scoring-engine.md)) | `function calcExamPayout` |
| Goal engine | `needsEvidence`, `ddayStr`, `krProgress`, `krDoneCount`, `goalProgress`, `elapsedRatio`, `paceOf`, `krRemainText`, `roleGap`, `certGainOf`, `examBandGain` | `const paceOf =` |
| Job-fit weighting | `DIR_CATS`, `JOB_FIELDS`, `areaCatHints`, `TIER_MULT`, `TIER_CLS`, `WEIGHT_MATRIX`, `CERT_W_EXC`, lookup indexes (`CERT_BY_NAME`, `CERTS_LONGEST_FIRST`, `CERT_NAME_LC`, `CERTS_BY_CAT`, `certOf`, `certByTitle`), `DIR_ALIAS`, `normDirs`, `jobWeightForCert` | `const WEIGHT_MATRIX = {` |
| Business | Records, never tasks: `wonText`, `monthAdd`, `monthsBetween`, `dealMonths`, `dealEnd`, `dealTotal`, `dealCostTotal`, `marginOf`, `dealPhase`, `monthRevenue`, `dealBacklog`, `billedMonths`, `revenueByMonth`, `bizSummary` — the one object the tab header, the briefing, the `실행` header's business button and the packet all read — plus `RATE_UNIT`, `DEAL_STATUS`, `DEAL_PHASE_LABEL` and the constants `BIZ_REVENUE_MONTHS`, `QUOTE_STALE_DAYS`, `DEAL_END_SOON`, `DEAL_MAX_MONTHS`, `BIZ_ALERT_MAX` (shared by `buildBriefing` and `todoOf`, so both name the same three unpaid months) | `const BIZ_REVENUE_MONTHS =` |
| Daily assistant | `daysBetween`, `mondayOf`, `agendaOf`, the event helpers (`occurrencesOf`, `eventsOn`, `upcomingEvents` + `EVENT_*` constants), `TAB_ACTIONS` (the tab-switch whitelist `closeBriefing` checks; `["home", "goals", "schedule", "biz"]` since 2026-09-15, `"growth"` retired), `buildBriefing` (returns `{ sections }` only — its `counts` field went with the home briefing card), `PACKET_HEAD`, `PACKET_BIZ_LINES`, `buildAssistantPacket`, `parseAssistantReply`, `todoOf` (the single time-ordered expansion of tasks + events + business rows, read only by the `실행` tab since home stopped showing any date-scoped fact) with `TODO_GROUPS`, `TODO_KIND_RANK`, `todoKey`, `todoSort`, `monthEndDate` | `const agendaOf =` |
| Calendar export | The `.ics` phone-calendar file (RFC 5545): eight `ICS_*` constants, the `ics*` helpers (`icsText`, `icsFold`, `icsDate`, `icsLocal`, `icsAddMinutes`, `icsUtcStamp`, `icsDuration`, `icsUid`), `calendarExportOf` (selects and shapes entries from `events`/`tasks`/`goals` only), `buildIcs` (serialises to text) — reads records, stores nothing; see [docs/design-docs/calendar-export.md](docs/design-docs/calendar-export.md) | `const buildIcs =` |
| State lifecycle | `migrate` (v11 → v23 blocks, `@schema` JSDoc above it), `applyDailyTick`, `freshState`, `demoState` | `const migrate =` |
| Onboarding | `OptRow` (shared chip row) and the shared CV entry components `CvEntryRow` / `CvAddForm` / `CvSection` (education and career add-and-list forms, reused by `ProfileModal`), then `Onboarding` (6 steps: basics + education record → appearance → areas & directions → qualifications/exams → career record + experience → computed grades) | `function Onboarding` |
| Tabs | `HomeTab` (rewritten 2026-09-15 into one CV card plus a role-model proximity line, nav-renamed `home`/`프로필` and its `자격`/`시험` rows stopped printing `D{n}` 2026-09-16; module-level `CvFact` (gained an optional `wrap` prop 2026-09-16) and `AreaGradeRow` rows, helpers `cvSummaryOf`/`heldCertsOf`/`examBestText` above), `GoalsTab`, `TaskTab` (rewritten 2026-09-13 into one time-ordered list over `todoOf`; rewritten again 2026-09-16 into compact `TodoRow`s — the shared row shell `TodoRow`, lead-chip helper `todoLeadOf`, tone map `TODO_TONE`, archive cap `TODO_DONE_MAX`; `BizTodoRow` and `DueChip` deleted, `EventRow`'s `tail` prop deleted; three sibling detail-sheet modals `TaskDetailModal`/`EventDetailModal`/`BizTodoModal` hold what the old row printed, completion moved entirely into `TaskDetailModal`'s `완료하기`; nav-renamed `tasks`/`할 일`; gained the `브리핑 열기 ›` header button 2026-09-15) — the fourth tab, `ScheduleTab` (calendar-only since 2026-09-16, its `목록` view and `setScheduleView` deleted), the fifth, `MeetingsTab` (new 2026-09-16, own region below), and the sixth, `BizTab`, each have their own region below. The former sixth tab, `GrowthTab`, was deleted 2026-09-15: its role-model headline, skill track, wall and data panel became the home CV, `RoleAdviceModal` and two modals from that rewrite (below) | `function GoalsTab` |
| Schedule | `EventRow` (the occurrence row the calendar's selected-day panel **and** `할 일`'s `EventDetailModal` both render; its `tail` prop deleted 2026-09-16), `ScheduleCalendar` (month grid, markers, day-number tones, selected-day panel, `CAL_RANGE_MONTHS`, `WEEKDAY_LABEL`, `HOLIDAYS`, `HOLIDAY_YEARS`), `ScheduleTab` (calendar-only since 2026-09-16 — the `목록`/`달력` toggle, its day groups and the header's own `일정 추가` button are all deleted; only the counts header and `ScheduleCalendar` remain) and `EventModal` — appointments and deadlines, never tasks — plus `CalendarExportModal`, which reads `calendarExportOf` for its preview and writes a file, never state | `function ScheduleTab` |
| Meetings (new 2026-09-16, schema v23; task links v24) | `MeetingsTab` (project sections of compact `TodoRow`-shaped minutes rows, `{n}건 더 보기` expansion), `ProjectModal`, `MeetingModal` (score field-free; caps `MEETING_LIMITS`/`PROJECT_LIMITS`, textarea counter `MeetingText`), `MeetingViewModal`, helpers `meetingOrder`, `meetingEventText`, `mbText`, `taskClosedOn`, `meetingTaskCandidates`, `meetingsOfTask`, `linkedTaskLead`, constants `MEETING_ROWS_SHOWN`, `MEETING_TASK_PAST_DAYS`, `MEETING_TASK_ROWS` — `meetings[].taskIds` links up to 10 existing tasks, listed on the meeting view and, derived, on the task sheet's `관련 회의록`; hand-written minutes grouped by project, a record never a task; see [docs/product-specs/meetings.md](docs/product-specs/meetings.md) | `function MeetingsTab` |
| Business tab | `BizTab` (`계약` / `단가` / `포트폴리오` views), `DealsView`, `RatesView`, `FolioView` (its own thumbnail-loading effect), row components (`BizRowHead`, `MoneyLine`, `DealRow`), `DealModal`, `RateModal`, `FolioModal` — contracts, unit prices and the portfolio, never tasks | `function BizTab` |
| Modals | `AddGoalModal`, `EvidenceViewModal`, `CatalogModal`, `RoleAdviceModal`, `AddTaskModal`, `EvidenceModal` (gained a `점수` field for exam tasks 2026-09-16), `ActivityLogModal`, `StudyVerifyModal`, `PromoteModal`, `RoleModelModal`, `ProfileModal` (the CV screen — photo, personal facts, education/career records, read-only held records), `SettingsModal` (role model, backup, reset — behind home's corner `설정` button, 2026-09-15), `AchievementWallModal` (trophies, specialisations, exam bests, per-area achievements, exam score since 2026-09-16 — behind the CV's `성취` row, 2026-09-15), `TaskDetailModal`, `EventDetailModal`, `BizTodoModal` (the `할 일` row detail sheets, new 2026-09-16), `ProjectModal`, `MeetingModal`, `MeetingViewModal` (the `미팅` sheets, above) | `function AddTaskModal` |
| Feedback | `ToastHost` (ref API), `Overlay` (`gradeup` / `achieve`) | `const ToastHost =` |
| App root | `LifeManager`: load → migrate → render; handlers `completeTask` (gained an optional third `score` argument 2026-09-16), `tryComplete`, `promoteArea`, `addGoal`, `goalStatus`, `checkinKR`, `setAreaDir`, `applyMeasures`, `removeTask`, `removeGoal`, `resetAll`, `saveProfile`, `addBiz`, `updateBiz`, `removeBiz`, `toggleDealPaid`, `addProject`, `updateProject`, `removeProject`, `addMeeting`, `updateMeeting`, `removeMeeting`, `meetingFits` (new 2026-09-16, `docs/product-specs/meetings.md`), `downloadBlob` (the one shared create-URL/anchor/revoke download path), `exportCalendar` (builds with `buildIcs`, downloads, toasts — reads state, writes nothing); `Shell`, `NAV` (`grid-cols-6` since 2026-09-16); `setScheduleView` deleted 2026-09-16 | `export default function LifeManager` |

The data regions (`CERTS`, `EXAMS`, matrices, option lists) are about a quarter of the file; the harness skips them for duplicate detection and the `data-guard` hook protects them. Splitting the file into `src/data`, `src/engine`, `src/components` is backlog item 3 (`docs/exec-plans/backlog.md`), to be done with unit tests for `calcExamPayout`, `krProgress`, `migrate`.

## State flow
1. Mount: `store.get(KEY)` → `migrate` → `applyDailyTick` (monthly shield reset) → `setState`; missing state → onboarding.
2. Every `setState` persists the whole object (`useEffect` on `state`). Images are separate keys.
3. Handlers mutate a `structuredClone` of the previous state and return it; effects (toasts, overlays) are queued with `queueMicrotask`.
4. Derived numbers (progress, pace, role proximity, job fit, payouts) are recomputed in render from state + frozen tables.

Schema and storage keys: [docs/generated/db-schema.md](docs/generated/db-schema.md). Engine formulas: [job-weighting.md](docs/design-docs/job-weighting.md) (scoring-engine.md follows in Phase 4 — see [docs/design-docs/index.md](docs/design-docs/index.md)). Screens: [docs/product-specs/index.md](docs/product-specs/index.md).

## Builds and commands
| Command | Effect |
|---|---|
| `npm run dev` / `build` / `preview` | Vite dev server / production build to `dist/` / static preview |
| `npm run build:demo` | single-file demo `release/life-demo.html` (JS + CSS inlined, favicon as data URI; `release/` is git-ignored). iOS cannot run JS from `file://` — host it for phones |
| `npm run verify` | build → preview on a free port → E2E → report (add `-- --smoke` for engine checks) |
| `npm run finish` | dead code / duplicates / residue / language gate (also the Stop hook) |
| `npm run smoke` | pure-function engine checks |
| `npm run docs:gen` / `docs:check` / `lang:check` | regenerate generated docs / doc integrity / language policy |
| `node tools/harness/gen-icons.js` | re-render the app icons from `public/icon.svg` (after an icon change) |

Current status (2026-09-16): schema **v23** (v22 exam scores, v23 meeting records — [docs/design-docs/state-lifecycle.md](docs/design-docs/state-lifecycle.md)), difficulty table **V1.3** (`DIFF_RAW_VERSION "1.3"`, 1,011 certifications, 17 exam families, 21 jobs × 15 categories), **six tabs** (`프로필 · 목표 · 할 일 · 일정 · 미팅 · 사업`, `성장` retired 2026-09-15, `미팅` added 2026-09-16 — home is one CV plus a role-model proximity line, `modal.type` 22 → 28), E2E steps **updated, not run**: `tools/e2e/flow*.js` was edited in every phase (new `flow10.js`, renamed tabs, compact-row helpers, the exam score field) and counts 170 `await step(` calls as written, but the standing user instruction for this change means the suite was not executed after the edits — see [docs/RELIABILITY.md](docs/RELIABILITY.md). Real-device smoke still pending (backlog 2, now including the calendar-file import and alarm check).

## Platform notes
- The app was originally an artifact that used `window.storage`; it was shimmed to `localStorage` on 2026-09-03 behind the same `store` interface — that interface is the seam if a different backend is ever needed.
- `askClaude` and all AI features were removed on 2026-08-29; nothing in the code calls a model.

## Glossary
| Korean (UI/data) | English (docs/code) |
|---|---|
| 실행 | task (`tasks`, `TaskTab`, `AddTaskModal`) — task created under a goal; the `할 일` tab (below) shows tasks alongside events and business rows |
| 할 일 (tab) | to-do — the time-ordered list of tasks, events and business rows on the `tasks` tab (`TaskTab`, nav label `할 일` since 2026-09-16, renamed from `실행`); not a data type of its own |
| 영역 | area (`areas`, `areaId`, `AREA_PRESETS`) |
| 목표 / 핵심결과 (KR) | goal / key result (`goals`, `krs`, types `metric` `count` `exam` `cert`) |
| 마일스톤 | milestone — a certification, exam, or study task exempt from the one-day size rule |
| 등급 (0–9) | area grade (`RANKS`) |
| 성취 · 성취의 벽 | achievement · achievement wall (`room.trophies`, kinds `ach` `rank` `spec`) |
| 관문 · 승급 | gate · promotion (`GATE_CHIPS`, `PromoteModal`, `promoteArea`) |
| 롤모델 근접도 | role-model proximity (`roleGap`) |
| 스트릭 · 보호권 | streak · streak shield (`act.streak`, `act.shieldsLeft`) |
| 직무 적합 (S/A/B/C) | job fit tier (`WEIGHT_MATRIX`, `TIER_MULT`) |
| 증거 | evidence (`task.evidence`, `liferpg-img-ev-*`) |
| 도감 | catalog (`CatalogModal`) |
| 일정 (약속 · 마감) | schedule event — appointment / deadline (`events`, `ScheduleTab`, `EventModal`); a record, never a task |
| 미팅 (프로젝트 · 회의록) | meeting minutes — project (`meetingProjects`) and its hand-written minutes (`meetings`, `MeetingsTab`, `ProjectModal`/`MeetingModal`/`MeetingViewModal`, schema v23; `taskIds` links existing tasks, schema v24); a record, never a task, no time of its own — see 일정 above |
| 사업 (계약 · 단가 · 포트폴리오) | business — contract (deal) · rate · portfolio piece (`deals`, `rates`, `folio`, `BizTab`); a record, never a task |
