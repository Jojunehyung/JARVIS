# E2E harness

Drives the app (`src/LifeManager.jsx`) end to end in a real browser. It uses the Chrome or Edge already installed on the machine (no download).

## Running

```bash
npm run build            # from the project root (add --sourcemap when you want line coverage)
npx vite preview --port 4173
cd tools/e2e && npm i    # once
node run.js --tag run    # 116-step scenario
node perf.js --tag run   # performance measurement (4× CPU throttle)
node cov_map.js out/run-coverage.json   # map never-executed source lines (needs a --sourcemap build)
node prof.js             # top CPU-profile functions
node ab.js <urlA> <urlB> 5        # interleaved A/B of two builds (single runs are too noisy to compare)
node rows.js <url> "시작하기"      # rows and DOM nodes mounted in onboarding step 4
```

`npm run verify` at the project root builds, starts a preview on a free port and runs `run.js` for you.

- `--headful` opens a visible window so you can watch.
- On failure you get `out/<tag>-NN-FAIL-<step>.png` screenshots and `out/<tag>-result.json`.

## Scenario layout

| File | Scope |
|---|---|
| `flow.js` | Onboarding, 6 steps (asserts the fresh save is schema v19) → goal (OKR) with three KR types → task registered through the count-KR bridge (`채우기 ›`, the one path that takes no activity kind) → completion → catalogue → bottom nav order → persistence across reload |
| `flow2.js` | Certification milestone with certificate photo (evidence gate block verified) · study output verification · reading activity log · promotion · role model |
| `flow3.js` | Profile photo · exam KR and score-report submission · exercise activity · a kind-less task refused under a goal · direction advice · task and goal deletion · one-day gap (streak, shields) |
| end of `flow.js` | Data reset — asserts the state and profile-photo keys are removed (runs last) |
| `flow5.js` | Due dates and the home agenda · the daily briefing (opens on a new day, not twice the same day, streak wording) · journal persistence · the assistant packet, the pasted reply and its import rules · the weekly review, which no longer chains to a metric check-in |
| `flow7.js` | The 일정 tab, both views. `목록`: form validation · an appointment with its time under its day group · a deadline and its D-day · a weekly repeat next week and the one-row-per-event `이후` collapse · `완료 표시` → `완료 취소` · `이번 회차 취소` on a repeat · edit · delete · the `오늘 일정` briefing section · the home card line · the packet section. `달력`: the month grid (cells, weekday header read cell by cell, markers per kind) · the view choice surviving a reload · today selected on entry · the selected-day panel rendering the same `EventRow` as the list · `이 날짜에는 일정이 없어요.` on an empty day · `일정 추가` prefilled with the selected day · `‹` / `›` paging and `오늘` · weekend and public-holiday tones read off the day numbers · a holiday naming itself on the panel · a month outside the holiday table marking nothing and stating which years it covers · back to `목록` |
| `flow4.js` | Goal created and taken to 100% → marked achieved → removed from the record · a second goal planted and deleted while active (its open task removed, its completed task kept under `미분류`) · legacy v10 save migration · save without a `v` field (asserts schema v13 trophy-kind conversion) · v13 → v14 field rename · v14 → v15 assistant fields · v15 → v16 schedule · v16 → v17 schedule view · v17 → v18 meeting task converted to a plain task · v18 → v19 life metrics removed |
| `flow6.js` | Service worker registration and control, a first visit that does not reload itself, the precache contents, the app opening offline, and the backup export/import round-trip (runs last: it toggles offline mode) |

Steps assert outcomes rather than just clicking: `assertDone` checks the completed label, `clickInModal` scopes clicks to the open modal, `modalError` reads validation messages. Selector and assertion arguments are Korean UI copy on purpose and must not be translated.
