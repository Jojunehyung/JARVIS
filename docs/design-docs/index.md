# Design docs — index

Engine and structure decisions. Rules are canonical in `core-beliefs.md`; everything else explains mechanisms and links rules by number.

| Doc | Covers |
|---|---|
| [core-beliefs.md](core-beliefs.md) | The 19 invariant rules (achievement system 1–6, minimal identity 7–19) |
| [assistant-bridge.md](assistant-bridge.md) | Agenda buckets, the daily-briefing rules, the five bridge packets (daily check-in, `오늘 업무 만들기`, `AI에게 회의 준비 묻기` since schema v27, `주간 회고` since schema v28, and `AI에게 판정 묻기` since 2026-09-18), the track filter (`packetTracks`, gated by the day-job-in-AI-packets settings switch since 2026-09-22) every packet applies, and what the assistant never does |
| [job-weighting.md](job-weighting.md) | Job-fit multiplier: matrix, exceptions, intersection rule, evidence thresholds |
| [decision-log.md](decision-log.md) | Dated product/engineering decisions |
| [information-architecture.md](information-architecture.md) | Area → goal → KR → task hierarchy, KR–task bridge, the `실행` tab's time groups (not goal groups), screen map |
| [calendar-export.md](calendar-export.md) | The `.ics` phone-calendar file: RFC 5545 decisions (folding, escaping, floating time, `UID`/`SEQUENCE`), the monthly-clamp expansion, alarms, privacy by construction, what is guaranteed vs app-dependent |
| [scoring-engine.md](scoring-engine.md) | Difficulty D, points P, grade cuts, certification and exam payout mechanics |
| [goal-engine.md](goal-engine.md) | KR progress, goal progress, pace, deadlines, KR check-in, task creation rules |
| [evidence-and-promotion.md](evidence-and-promotion.md) | Evidence gate, study tiers, activity logs, promotion gates |
| [metrics-and-role-model.md](metrics-and-role-model.md) | Role-model requirement-gap facts (`roleAreas`), streak and shields, the optional twelve-stage model (`roleStageOf`, schema v28), and (2026-09-18) the story, the fifth bridge packet and its AI verdict, the stage-completion overlay and verdict history, the one `롤모델` screen (`RoleModal`) that replaced `RoleModelModal`'s and `RoleAdviceModal`'s user-facing roles, with story templates, per-condition `지금 할 것` landings and the `roleEdit` sub-screen; every percentage — proximity, stage progress/journey, verdict probability — is retired, same day, third role-model change of the day (the [Rule 14](core-beliefs.md#rule-14) amendment) |
| [state-lifecycle.md](state-lifecycle.md) | Load → migrate → daily tick, migration policy (v11–v28), storage keys, date/id utilities |
| [demo-data.md](demo-data.md) | What `demoState` contains and why |

Generated tables (never hand-edited): [../generated/db-schema.md](../generated/db-schema.md), [cert-table.md](../generated/cert-table.md), [exam-table.md](../generated/exam-table.md), [weight-matrix.md](../generated/weight-matrix.md), [onboarding-tables.md](../generated/onboarding-tables.md), [symbol-index.md](../generated/symbol-index.md).
