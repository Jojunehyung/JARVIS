# ARCHITECTURE.md — Life Manager
<!-- src: CL-2 --><!-- src: CL-3 --><!-- src: CL-4 --><!-- src: SPEC-10 -->

Single-page React app in one file. This document is the map: where things are, how state flows, how it is built and verified. Rules live in [docs/design-docs/core-beliefs.md](docs/design-docs/core-beliefs.md); the generated symbol index is [docs/generated/symbol-index.md](docs/generated/symbol-index.md).

## Stack
Vite 5 · React 18 · Tailwind v3 (core utilities only) · lucide-react. Node 24 at `C:\Program Files\nodejs` (add it to PATH in Git Bash: `export PATH="/c/Program Files/nodejs:$PATH"`). No backend, no network at runtime.

## Files
```
src/LifeManager.jsx    the app (≈ 4,600 lines) — see "File regions"
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
| Onboarding option data | `AGE_OPTS … OUTPUT_OPTS`, `MAJOR_FIELDS`, `KNOWLEDGE_FIELDS`, `gFromD`, `computeGrades`, `GATE_CHIPS`, `AREA_PRESETS`, `ROLE_PRESETS`, `TASK_TEMPLATES`, `detectKind`, `goalKinds` | `초기 설정 선택지` |
| Storage adapter | `KEY`, `store` (`get/set/del`, JSON, memory fallback) — **call sites are frozen** | `const store =` |
| Illustrations & utils | `PortraitSprite`, `Portrait`, `resizeImage`, `TrophySvg`, `TIER_COLORS`, empty-state SVGs, `uid`, `dstr`, `shiftDay`, `monthStr`, `Bar`, `Chip`, `DiffBadge`, `CertBadge`, `Modal` | `function TrophySvg` |
| Exam engine | `EXAMS` (17 families), `EXAM_BY_ID`, `examOf`, `LANG_KO`, `DIM_STEPS`, `calcExamPayout`, `POINT_POLICY_VERSION` | `function calcExamPayout` |
| Goal engine | `needsEvidence`, `METRICS_META`, `ddayStr`, `krProgress`, `krDoneCount`, `goalProgress`, `elapsedRatio`, `paceOf`, `krRemainText`, `roleGap`, `certGainOf`, `examBandGain` | `const paceOf =` |
| Job-fit weighting | `DIR_CATS`, `JOB_FIELDS`, `areaCatHints`, `TIER_MULT`, `TIER_CLS`, `WEIGHT_MATRIX`, `CERT_W_EXC`, lookup indexes (`CERT_BY_NAME`, `CERTS_LONGEST_FIRST`, `CERT_NAME_LC`, `CERTS_BY_CAT`, `certOf`, `certByTitle`), `DIR_ALIAS`, `normDirs`, `jobWeightForCert` | `const WEIGHT_MATRIX = {` |
| Daily assistant | `daysBetween`, `mondayOf`, `doneTodayCount`, `agendaOf`, the event helpers (`occurrencesOf`, `eventsOn`, `upcomingEvents` + `EVENT_*` constants), `buildBriefing`, `PACKET_HEAD`, `buildAssistantPacket`, `parseAssistantReply` | `const agendaOf =` |
| State lifecycle | `migrate` (v11 → v17 blocks, `@schema` JSDoc above it), `applyDailyTick`, `freshState`, `demoState` | `const migrate =` |
| Onboarding | `Onboarding` (6 steps: basics → appearance → areas & directions → qualifications/exams → experience → computed grades) | `function Onboarding` |
| Tabs | `HomeTab`, `GoalsTab`, `TaskTab`, `GrowthTab` (the fifth tab, `ScheduleTab`, has its own region below) | `function GoalsTab` |
| Schedule | `EventRow` (the occurrence row both views render), `ScheduleCalendar` (month grid, markers, day-number tones, selected-day panel, `CAL_RANGE_MONTHS`, `WEEKDAY_LABEL`, `HOLIDAYS`, `HOLIDAY_YEARS`), `ScheduleTab` (`목록` / `달력` toggle, day groups) and `EventModal` — appointments and deadlines, never tasks | `function ScheduleTab` |
| Modals | `AddGoalModal`, `MetricsModal`, `EvidenceViewModal`, `CatalogModal`, `RoleAdviceModal`, `AddTaskModal`, `EvidenceModal`, `ActivityLogModal`, `StudyVerifyModal`, `PromoteModal`, `RoleModelModal` | `function AddTaskModal` |
| Feedback | `ToastHost` (ref API), `Overlay` (`gradeup` / `achieve`) | `const ToastHost =` |
| App root | `LifeManager`: load → migrate → render; handlers `completeTask`, `tryComplete`, `promoteArea`, `addGoal`, `goalStatus`, `checkinKR`, `saveMetrics`, `setAreaDir`, `spawnTask`, `applyMeasures`, `removeTask`, `removeGoal`, `resetAll`; `Shell`, `NAV` | `export default function LifeManager` |

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

Current status (2026-09-11): schema **v17**, difficulty table **V1.3** (`DIFF_RAW_VERSION "1.3"`, 1,011 certifications, 17 exam families, 21 jobs × 15 categories), E2E 114 steps green, real-device smoke still pending (backlog 2).

## Platform notes
- The app was originally an artifact that used `window.storage`; it was shimmed to `localStorage` on 2026-09-03 behind the same `store` interface — that interface is the seam if a different backend is ever needed.
- `askClaude` and all AI features were removed on 2026-08-29; nothing in the code calls a model.

## Glossary
| Korean (UI/data) | English (docs/code) |
|---|---|
| 실행 | task (`tasks`, `TaskTab`, `AddTaskModal`) |
| 영역 | area (`areas`, `areaId`, `AREA_PRESETS`) |
| 목표 / 핵심결과 (KR) | goal / key result (`goals`, `krs`, types `metric` `count` `exam` `cert`) |
| 마일스톤 | milestone — a certification, exam, or study task exempt from the one-day size rule |
| 등급 (0–9) | area grade (`RANKS`) |
| 성취 · 성취의 벽 | achievement · achievement wall (`room.trophies`, kinds `ach` `rank` `spec`) |
| 관문 · 승급 | gate · promotion (`GATE_CHIPS`, `PromoteModal`, `promoteArea`) |
| 인생 지표 (자산·영향력·외형) | life metrics (`metrics.asset / infl / body`) |
| 롤모델 근접도 | role-model proximity (`roleGap`) |
| 스트릭 · 보호권 | streak · streak shield (`act.streak`, `act.shieldsLeft`) |
| 직무 적합 (S/A/B/C) | job fit tier (`WEIGHT_MATRIX`, `TIER_MULT`) |
| 증거 | evidence (`task.evidence`, `liferpg-img-ev-*`) |
| 도감 | catalog (`CatalogModal`) |
| 일정 (약속 · 마감) | schedule event — appointment / deadline (`events`, `ScheduleTab`, `EventModal`); a record, never a task |
