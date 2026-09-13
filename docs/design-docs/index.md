# Design docs — index

Engine and structure decisions. Rules are canonical in `core-beliefs.md`; everything else explains mechanisms and links rules by number.

| Doc | Covers |
|---|---|
| [core-beliefs.md](core-beliefs.md) | The 19 invariant rules (achievement system 1–6, minimal identity 7–19) |
| [assistant-bridge.md](assistant-bridge.md) | Agenda buckets, the daily-briefing rules, and what the assistant never does |
| [job-weighting.md](job-weighting.md) | Job-fit multiplier: matrix, exceptions, intersection rule, evidence thresholds |
| [decision-log.md](decision-log.md) | Dated product/engineering decisions |
| [information-architecture.md](information-architecture.md) | Area → goal → KR → task hierarchy, KR–task bridge, the `실행` tab's time groups (not goal groups), screen map |
| [scoring-engine.md](scoring-engine.md) | Difficulty D, points P, grade cuts, certification and exam payout mechanics |
| [goal-engine.md](goal-engine.md) | KR progress, goal progress, pace, deadlines, KR check-in, task creation rules |
| [evidence-and-promotion.md](evidence-and-promotion.md) | Evidence gate, study tiers, activity logs, promotion gates |
| [metrics-and-role-model.md](metrics-and-role-model.md) | Role-model proximity curve, streak and shields |
| [state-lifecycle.md](state-lifecycle.md) | Load → migrate → daily tick, migration policy, storage keys, date/id utilities |
| [demo-data.md](demo-data.md) | What `demoState` contains and why |

Generated tables (never hand-edited): [../generated/db-schema.md](../generated/db-schema.md), [cert-table.md](../generated/cert-table.md), [exam-table.md](../generated/exam-table.md), [weight-matrix.md](../generated/weight-matrix.md), [onboarding-tables.md](../generated/onboarding-tables.md), [symbol-index.md](../generated/symbol-index.md).
