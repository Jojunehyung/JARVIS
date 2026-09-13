# Reliability
<!-- src: E2E --><!-- src: SPEC-10 -->

Reliability for a local-only app means: the user's state survives every version, the build never ships a broken flow, and measurements are believed only when they are reproducible.

## Persistence and migrations
- State is one JSON object under `localStorage["liferpg-state-v1"]` (adapter `store`, memory fallback when storage is unavailable). Images are separate keys: `liferpg-img-profile`, `liferpg-img-ev-{taskId}`, `liferpg-img-study-{taskId}-{n}`, `liferpg-img-folio-{id}` — removed with the task/portfolio entry and on full reset.
- Every schema change adds a sequential `if (s.v < N)` block; existing blocks are frozen and a non-numeric `v` is normalised to 0 first ([Rule 12](design-docs/core-beliefs.md#rule-12)). The ledger is generated in [generated/db-schema.md](generated/db-schema.md).
- The E2E harness asserts migration from a v10 save, a save without `v`, a v13 save, a v14 save, a v15 save, a v16 save, a v17 save, a v18 save and a v19 save to the current version (v20), including field renames, trophy-kind conversion, the empty `events[]` a v15 save gains, the `ui.scheduleView: "list"` a v16 save gains with its events, journal and reviews intact, a v17 save's `kind: "meet"` task converting to a plain task with its title, difficulty, status and minutes `evidence` kept, a v18 save losing its life-metric store and check-in stamp while every other `act` stamp and record survives, and a v19 save gaining empty `folio[]` / `rates[]` / `deals[]` and `ui.bizView: "deals"` while its `ui.scheduleView` and every other record survive (`tools/e2e/flow4.js`).
- Storage keys are never renamed; they are the compatibility contract.
- Writing a portfolio image goes through its own guard, independent of the state save: a file-size cap before decoding, an aspect-preserving resize (`resizeImageFit`, never upscales) with one quality retry over an output-length cap, a budget check against a 3.5 MB heuristic ceiling, then a write that is read back to confirm it survived (`saveImageChecked`). Every failure still saves the record without its image and toasts why, and the state-save effect itself now runs the same read-back check (`persisted(KEY)`) and toasts `저장에 실패했어요` when a state write did not reach `localStorage`.

## Verification pipeline (`npm run verify`)
`tools/harness/verify.js`: `vite build` → `vite preview` on a free port → `tools/e2e/run.js` (puppeteer-core driving the installed Chrome/Edge; no browser download) → parse `tools/e2e/out/<tag>-result.json`. Exit 1 on any failed step or console error. `--smoke` runs the pure-function engine checks first (`tools/harness/smoke-logic.js`: table integrity, longest-name matching, stage-group differential payouts, documented scenario payouts).

### E2E harness (`tools/e2e`)
| File | Scope |
|---|---|
| `run.js` | runner, shared helpers (`clickTab`, `clickInModal*`, `completeQuest`, `assertDone`, `attach`, `openTaskModalFor`, `addKindTask`, `submitPhotoEvidence`, `logActivity`, `rows`, `clickExact`, `todoRows`), coverage capture across reloads, screenshots on failure |
| `flow.js` | onboarding (6 steps) → goal with metric/count/cert KRs → KR bridge → daily completion → catalog → bottom nav order → reload persistence → schema version assert; ends with data reset (image keys cleared) |
| `flow2.js` | certification milestone with the photo gate (blocked without photo), evidence viewer, study artifact verification, reading log, role model |
| `flow3.js` | profile photo, exam KR → score report, fitness activity log, the kind-less-task refusal under a goal, promotion with evidence chips, direction advice, task deletion, streak after a day gap |
| `flow4.js` | goal completion and removal (task registered through the count-KR bridge), an active goal's deletion with its record-less tasks — the kept task now surfaces in `실행`'s `완료` archive tagged `목표 기여 없음`, not a `미분류` section — v10 / no-version / v13 / v14 / v15 / v16 / v17 / v18 / v19 migrations |
| `flow6.js` | service worker registers and controls the page, the app opens with the network disabled, backup export and import round-trip |
| `flow5.js` | due dates and the `실행` tab's time groups, the home agenda narrowed to overdue + today (with the D-3 item confirmed still listed in a later group), the daily briefing (new day, same day, streak line), journal persistence, the assistant packet and reply import, the weekly review, and the completed-task archive stating its completion date and completing nothing when tapped |
| `flow7.js` | the 일정 tab, both views: form validation, an appointment with its time, a deadline D-day, a weekly repeat (and the one-row-per-event `이후` collapse), completion mark, one cancelled occurrence, edit, delete, the briefing section, the home card line, the packet section, and — via the `실행` tab — that today's `마감` event lists there with `목표 기여 없음` and no checkbox and completes only through its own `완료 표시` button; then the `달력` view — the month grid and its markers, the view choice surviving a reload, the selected-day panel rendering the list's own row, the empty-day line, the prefilled `일정 추가`, month paging and `오늘`; imports the shared `rows` / `clickExact` / `todoRows` helpers from `run.js` instead of defining its own |
| `flow8.js` | the 사업 tab: a contract's period/total/margin under `진행 중`, a boundary check that registering a deal and ticking a payment change `deals` only (never tasks, goals, streak or trophies), a lead with no numbers, a stale quote, the cost-missing line, the rate view's margin and footer count, a landscape portfolio image kept at its own aspect and never upscaled, a portfolio deletion removing its image key, the chosen view surviving a reload, the briefing section and its home-card and packet counterparts, the `실행` tab listing the same unpaid month as a business row with no completion control, a pasted reply naming a deal/rate/portfolio entry that creates none of them, and a regression step planting enough alerts to fill the briefing section's cap and asserting the closing revenue line still renders |
| `cov_map.js` | maps V8 coverage back to `src/LifeManager.jsx` lines (needs `vite build --sourcemap`) |
| `perf.js`, `prof.js`, `ab.js`, `ab_onboard.js`, `rows.js` | performance probes (see below) |

Selectors match Korean UI copy on purpose — a copy change must update the harness in the same plan. Steps assert outcomes (completion marks, stored schema, image data URLs, calendar markers and day-number tones read from the grid, activity-kind refusal text read from the modal error), not just clicks; 139 steps as of 2026-09-13.

## Performance measurement rule
Single-run timings on this machine swing by ±50 % with background load. Compare builds only with `tools/e2e/ab.js` (two builds, one browser, interleaved rounds, medians). Structural counts (mounted rows, DOM nodes via `rows.js`) are reliable; wall-clock deltas under ±10 % are noise.

## Offline and updates
The production build ships a generated service worker (`dist/sw.js`): hashed assets cache-first, the document network-first with a cache fallback, and every non-current cache deleted on activate. A new deploy is picked up on the next online load, and the page reloads once when the new worker takes control. `navigator.storage.persist()` is requested at start so the records are not evicted under storage pressure. The E2E asserts both halves — that the worker controls the page, and that a reload with the network disabled still renders the app.

## Known limits
- No unit-test runner; engine checks are `smoke-logic.js` and the E2E. The planned file split (backlog 3) adds unit tests for `calcExamPayout`, `krProgress`, `migrate`.
- Dates use local time (`dstr`); a timezone change can shift streak boundaries.
- A session crossing midnight now re-reads the date on focus and on a 60-second tick, so `today` follows the clock; only a timezone change still shifts streak boundaries.
- Photos are stored as resized data URLs; very large evidence sets are bounded by `localStorage` quota (≈ 5 MB per origin). The backup file is the recovery path, and it is the user's job to write it out now and then.
- Installing from a different address creates a different origin, so the records do not follow; move them with a backup file.
- The portfolio image budget (`STORAGE_BUDGET`, 3.5 MB) is a heuristic guess at a slice of the same per-origin quota the state save also shares; a browser that blocks `localStorage` outright (private mode, disabled site data) fails the read-back check on every state change, not only on an image write, and surfaces the `저장에 실패했어요` toast every time rather than once (tracked in [exec-plans/tech-debt-tracker.md](exec-plans/tech-debt-tracker.md)).
