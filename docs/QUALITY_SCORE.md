# Quality score
<!-- src: SPEC-9 -->

How we know the app is right: gates that must be green at every phase end, and a rule-compliance ledger.

## Gates (all must pass before a commit)
| Gate | Command | Passing means |
|---|---|---|
| Build | `npm run build` | Vite production build succeeds |
| E2E | `npm run verify` | every scenario step passes, 0 console errors, coverage reported (67 steps, ≈ 80 % of `LifeManager.jsx` lines executed as of 2026-09-08) |
| Engine smoke | `npm run smoke` / `npm run verify -- --smoke` | table integrity (1,011 / 17 / 21 × 15 / 47), stage-group payouts sum to the top step, longest-name matching, documented payouts (전기·기계 × 전기기사 = S, 900 P) |
| Finish gate | `npm run finish` | 0 unused symbols/imports, 0 duplicate blocks (≥ 4 logic lines), 0 game-term residue, 0 Korean comments (once `lang` is enabled) — or allowlisted with a reason |
| Docs | `npm run docs:check` | links resolve, exactly 19 rules in `core-beliefs.md`, agents listed in `AGENTS.md`, indexes complete, every source id has its `<!-- src -->` marker, generated files fresh |
| Demo | `npm run build:demo` | `release/life-demo.html` is a single file and opens from `file://` |

## Rule compliance ledger
Verdicts against the current code, last refreshed 2026-09-08 against the Phase 4 specs (every rule re-read against its implementing symbols). `verified` = confirmed by smoke/E2E; `by-review` = confirmed by reading; `partial` = known gap listed in tech-debt-tracker.

| Rule | Where | Verdict |
|---|---|---|
| 1 pure payouts | `completeTask` (cert/exam branches), `certGainOf`, `examBandGain` | verified (smoke payouts) |
| 2 exam snapshot / decay / spec | `calcExamPayout`, `exams.best/dim/spec` | by-review; dim lock timing differs between onboarding (register) and completion — see tech-debt |
| 3 stage-group difference | `certGainOf`, `certBest` | verified (80 ladders sum to top step) |
| 4 no rescoring | `exams.best[].ver`, `state.dModel`; `saveProfile` (CV edits never touch `profile.edu`/`career` or `areas[].grade`) | partial — `achievements`/`trophies` carry no `ver`; the CV-edit path is separately verified (E2E, mutation-tested: planting a `profile.edu` rewrite plus a grade bump in `saveProfile` fails the step) |
| 5 grade cuts | `achGrade` | verified |
| 6 frozen tables | `data-guard` hook, data-curator only | verified (hook denies) |
| 7 no game mechanics | code and copy scan (`finish-check` residue) | verified |
| 8 no global metric store | `migrate` v19 (drops `metrics`, `act.lastCheckin`), `checkinKR` | verified — the global store and its check-in were removed 2026-09-11; objective measures live only in a goal's metric KR |
| 9 derived progress | `krProgress`, `goalProgress`, `ageText`, `careerMonths`, `calendarExportOf`/`buildIcs` (reads `events`/`tasks`/`goals`, writes nothing) | verified — the calendar export's read-only boundary is proven twice: smoke check (g) builds from a state whose `profile`/`deals`/`rates`/`folio`/`journal`/`reviews` and every event's `place`/`note` throw when read, and E2E (`tools/e2e/flow9.js`) confirms `liferpg-state-v1` and the storage key list are byte-identical after opening the sheet, changing its options, and exporting |
| 10 evidence gate | `needsEvidence`, `tryComplete` | verified (E2E: submit disabled without photo) |
| 11 promotion by evidence | `PromoteModal`, `promoteArea` | verified (E2E) — a CV edit through `ProfileModal` is confirmed not to be an alternate path (E2E, mutation-tested) |
| 12 migrations | `migrate` v11–v14, `v` normalisation | verified (E2E: v10, no-`v`, v13 fixtures → v14) |
| 13 tone | copy review | by-review; `PromoteModal` line "스스로에게 정직하게…" is borderline (tech-debt) |
| 14 squared proximity | `roleGap` | verified (formula) |
| 15 job-fit weighting | `jobWeightForCert`, `WEIGHT_MATRIX`, `CERT_W_EXC` | verified (smoke: S/A/C cases, exception 사회복지사 1급) |
| 16 evidence regulations | `EvidenceModal`, `StudyVerifyModal`, `STUDY_REQ`, image keys | verified (E2E: photo gate, study artifact, viewer, key cleanup) |
| 17 activity kinds | `ActivityLogModal`, `detectKind`, `applyMeasures` | verified (E2E: reading, fitness) |
| 18 goal-first | `AddTaskModal` (no area picker), `goalId` required | verified |
| 19 KR bridge | `AddTaskModal` bridge rows | verified (E2E: cert and exam one-click registration) |

## Scoring
A change is **shippable** when all gates are green and no rule verdict regresses. A change is **blocked** when `finish` or `verify` fails, or when a rule verdict would move from verified to partial without a decision-log entry.
