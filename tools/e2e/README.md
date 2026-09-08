# E2E harness

Drives the app (`src/LifeManager.jsx`) end to end in a real browser. It uses the Chrome or Edge already installed on the machine (no download).

## Running

```bash
npm run build            # from the project root (add --sourcemap when you want line coverage)
npx vite preview --port 4173
cd tools/e2e && npm i    # once
node run.js --tag run    # 85-step scenario
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
| `flow.js` | Onboarding, 6 steps (asserts the fresh save is schema v14) → goal (OKR) with three KR types → task registered through the KR bridge → completion → catalogue → metrics check-in → persistence across reload |
| `flow2.js` | Certification milestone with certificate photo (evidence gate block verified) · study output verification · reading activity log · promotion · role model |
| `flow3.js` | Profile photo · exam KR and score-report submission · exercise/meeting activities · direction advice · task and goal deletion · one-day gap (streak, shields) |
| end of `flow.js` | Data reset — asserts the state and profile-photo keys are removed (runs last) |
| `flow5.js` | Due dates and the home agenda · the daily briefing (opens on a new day, not twice the same day, streak wording) · journal persistence · the assistant packet, the pasted reply and its import rules · the weekly review chained to the metric check-in |
| `flow4.js` | Goal created and taken to 100% → marked achieved → removed from the record · legacy v10 save migration · save without a `v` field (asserts schema v13 trophy-kind conversion) · v13 → v14 field rename |

Steps assert outcomes rather than just clicking: `assertDone` checks the completed label, `clickInModal` scopes clicks to the open modal, `modalError` reads validation messages. Selector and assertion arguments are Korean UI copy on purpose and must not be translated.
