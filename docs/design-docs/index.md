# Design docs — index

Engine and structure decisions. Rules are canonical in `core-beliefs.md`; everything else explains mechanisms and links rules by number.

| Doc | Covers |
|---|---|
| [core-beliefs.md](core-beliefs.md) | The 19 invariant rules (achievement system 1–6, minimal identity 7–19) |
| [job-weighting.md](job-weighting.md) | Job-fit multiplier: matrix, exceptions, intersection rule, evidence thresholds |
| [decision-log.md](decision-log.md) | Dated product/engineering decisions |
| information-architecture.md | Area → goal → KR → task hierarchy, KR–task bridge, milestone/daily/unassigned sections, screen map (Phase 4) |
| scoring-engine.md | Difficulty D, points P, grade cuts, certification and exam payout mechanics (Phase 4) |
| goal-engine.md | KR progress, goal progress, pace, deadlines, KR check-in (Phase 4) |
| evidence-and-promotion.md | Evidence gate, study tiers, activity logs, promotion gates (Phase 4) |
| metrics-and-role-model.md | Life metrics sources, role-model proximity curve, streak and shields (Phase 4) |
| state-lifecycle.md | Load → migrate → daily tick, migration policy, storage keys, date/id utilities (Phase 4) |
| demo-data.md | What `demoState` contains and why (Phase 4) |

Generated tables (never hand-edited): [../generated/db-schema.md](../generated/db-schema.md), [cert-table.md](../generated/cert-table.md), [exam-table.md](../generated/exam-table.md), [weight-matrix.md](../generated/weight-matrix.md), [onboarding-tables.md](../generated/onboarding-tables.md), [symbol-index.md](../generated/symbol-index.md).
