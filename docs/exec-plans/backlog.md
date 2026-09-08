# Backlog (priority order)
<!-- src: CL-7 --><!-- src: SPEC-12 -->

Items become exec plans in `active/` when picked up (planner writes the plan first — see [../PLANS.md](../PLANS.md)). Done items move to `completed/` and the decision log.

1. ~~Storage shim → `npm run dev`~~ — done 2026-09-03 ([completed](completed/2026-09-03-storage-shim-and-vite.md)).
2. **Real-device smoke** — open `release/life-demo.html` on a phone (Android: file works; iOS needs hosting) and walk: demo → task tab (per-goal groups, milestones) → goal "＋ 실행" → cert KR one-click → daily completion (delta toast) → 전기기사 milestone photo submit (S ×1.0, **+900P**) → metric check-in → reload persists. Desktop E2E covers the same path automatically (`npm run verify`).
3. **File split** — `src/data` (CERTS/EXAMS/onboarding constants), `src/engine` (achievement, goal, migrate), `src/components`; write unit tests for `calcExamPayout`, `krProgress`, `migrate` first and keep them green while splitting. Stub plan: `active/2026-09-xx-file-split.md` (created at the end of the harness restructure).
4. **Weekly review flow** — extend the metric check-in (`MetricsModal`) into a weekly screen that pairs the three sliders with a "what worked / what blocked" retrospective.
5. **Growth graphs** — metric and grade history (needs a history structure in state → new migration block); onboarding final step "first goal".
6. **Achievement v2** — unified rescaling with anchor calibration (the referenced "planning doc §41" no longer exists; re-derive from `docs/generated/cert-table.md` anchors), GRE composite, HSK 3.0 as a separate version.
7. **PWA** — favicon and manifest icon done 2026-09-07 (`public/icon.svg`, data-URI favicon, included in the single-file demo); remaining: iOS `apple-touch-icon` PNG, service worker.
8. **Job-fit v3 (evidence for the new categories)** — the 150 V1.3 cross cells (5 new categories × 16 legacy jobs, 5 new jobs × 14 categories) are all C for lack of posting evidence. Adjacent jobs (e.g. 전기·기계 × 금속재료·비파괴, 화학·소재 × 산업안전) may deserve B/A: sample ≥ 100 postings per job (occupation-code filter) and re-judge by mention rate. The 47 individual exceptions carry their evidence strength in code comments.
9. **Qualification rename tracker** — pending effective dates: 임업종묘기사 → 산림종묘기사 (2027-01-01); 기상기사 → 기상기후기사, 어로산업기사 → 어업산업기사, 건축구조기사, 피부미용장, 로봇시스템통합기사/기능사 (2028-01-01). Check the Q-Net change notice yearly.
10. **Job-fit v2** — target employer type toggle (public / private / startup) recomputing exceptions (컴퓨터활용능력, 정보처리기사, 한국사 public-sector bonus axis); per-job language pass lines (해외영업 TOEIC 800+ / OPIc IH+); six-monthly re-verification of mention rates (S ≥ 30 % / A ≥ 15 % / B ≥ 5 %).

## Smaller items (from the issue audit, see [tech-debt-tracker.md](tech-debt-tracker.md))
- Role model: allow clearing it (no way back to `null`); button label when all areas are excluded.
- Overlay/toast queues (consecutive effects overwrite each other).
- Reading/meeting tasks: one-tap after the first log (Rule 17 says so; code asks every time when `evidence` is empty).
- Evidence photo crop: `resizeImage` 256 × 320 cover crop makes landscape certificates hard to read in the viewer — keep aspect ratio for evidence.
- `AddGoalModal` validation: start = target, count need ≤ 0, past deadline, free-text cert names that cannot bridge.
- `ddayStr` off-by-one (today shows D-1).
