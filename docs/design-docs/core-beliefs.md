# Core beliefs — the 19 invariant rules
<!-- src: CL-5 -->

These rules survive every refactor. This file is the **only** place the rule text lives; everything else links here by number (`core-beliefs.md#rule-n`). Rules 1–6 protect the achievement system; rules 7–19 protect the v3 minimal identity. Korean terms are kept where they name a product concept or UI copy: `실행` (task), `영역` (area), 등급 (grade), 성취 (achievement), 마일스톤 (milestone).

## Achievement system — never change

### Rule 1 — Payouts are pure
Achievement payouts (certifications and exams) are paid **as-is**: no multipliers, bonuses, or caps of any kind are applied to the base P. (The job-fit weighting of Rule 15 is the single, documented exception for certifications and is part of the base formula, not a bonus.)

### Rule 2 — Exams: band snapshot, difference only, bucket decay, specialisation
An exam achievement is a snapshot of "exam × score band". Raising the same exam later pays only the difference (`exams.best`). Repeats within the same language skill bucket (RL / S / W) decay 100 → 70 → 50 → 30 %, and the multiplier is **locked at first registration** (`exams.dim`). Two different exams of the same language at D75+ = specialisation (`exams.spec`; decay floor 70 %; the language area counts as expert).

### Rule 3 — Certifications: full payout, except stage groups
Certifications always pay in full. Only stage groups (`sg`: e.g. `cph/acc/tax/lnx/kh/fp/cfa/cissp/cisa/pmp` and the V1.3 ladders) pay the difference from the best step already held (`certBest`).

### Rule 4 — No retroactive rescoring
When the D/P tables are updated, already-paid achievements are immutable (achievement records carry `ver`).

### Rule 5 — One grade-letter cut
Grade letters use a single cut everywhere: A ≥ 82, B ≥ 65, C ≥ 50, D ≥ 35, else E (`achGrade`).

### Rule 6 — Data tables are frozen
`CERTS` / `EXAMS` numeric tables are the approved specification — no ad-hoc edits. V1.3 (2026-09-06) added the 807 currently issued national qualifications (1,011 total; three-lens estimation + adversarial verification); existing D values did not change. A renamed qualification keeps its D and only the name changes; renames and new qualifications whose effective date has not arrived are not applied. Only the data-curator agent edits these rows, with evidence.

## v3 minimal identity

### Rule 7 — No game mechanics
XP, levels, gold, shops, criticals, random rewards, boss effects, story, and dating-sim elements are **never reintroduced**. AI features (goal coach, difficulty judgement, promotion quiz, study oral check — all removed 2026-08-29) require explicit user approval before any reintroduction.

**Amendment 2026-09-09 (user approval):** the **assistant bridge** is the one approved AI touchpoint. The app builds a text packet the user copies into an external chat and pastes the reply back (`buildAssistantPacket` / `parseAssistantReply`); there is no API key and no network call. In-app AI — generation, judgement, scoring — stays excluded. A pasted reply can only *propose* plain `daily`/`once` tasks, which enter through the normal task path and its gates; it never completes a task, promotes an area, submits evidence, or changes metrics, payouts, D values, or grades.

**Amendment 2026-09-17 (user approval):** the bridge carries a second packet, `오늘 업무 만들기` (`buildWorkPacket` / `parseWorkReply`), which — by the user's own decision, reversing the 2026-09-16 default — includes meeting minutes summaries, decisions, follow-ups and progress entries for every meeting except one whose `aiHidden` flag is set, of which only the date and title appear. A reply to it can only *propose* **work items** (`work[]`, [../product-specs/daily-work.md](../product-specs/daily-work.md)): dated records outside the goal ladder that pay nothing, move no grade, streak, KR or goal, and never enter `computeGrades`, `krProgress`, the achievement wall or an achievement log. A proposal becomes a record only when the user ticks it, arrives with `source: "ai"` and `done: false`, and nothing in a reply completes, pays, promotes or edits any existing record. This parser reads the reply's `work` key only — `tasks`, `deals`, `events` or any other key is ignored — and `parseAssistantReply` is unchanged. The packet still never carries the profile name, birth date, contact, school or employer, and still makes no network call.

### Rule 8 — No global metric store; objective measures live in a goal's metric KR
The global life-metric triple (`metrics.asset / infl / body`) — a self-assessed number that also grew automatically from achievements it did not measure — measured nothing, and was removed on 2026-09-11 by the user's decision, store and check-in together (schema v19 drops `metrics` and `act.lastCheckin`; see the decision log). What it claimed to track belongs to a goal's metric KR instead — body-fat %, a score, a count — checked in through `checkinKR`. No idle (time-based) growth for any measure. Nothing derived from achievements, promotions, or goal completion may be cached as a metric outside a goal's KR. A new global self-assessed number is a new mechanic and needs explicit user approval before it is reintroduced, the same as the Rule 7 clause on AI features.

### Rule 9 — Progress is derived, never stored
Goal progress is computed (`krProgress` / `goalProgress`); do not store progress in state. Count KRs derive from `tasks[].goalId`.

### Rule 10 — Evidence gate
`needsEvidence` (certification, exam, or pts ≥ 150) blocks completion without evidence.

### Rule 11 — Promotion only through the gate
Areas are promoted only by submitting gate evidence (`PromoteModal`). A knowledge quiz (QuizModal) existed only in planning and was never implemented; it was removed from the wording on 2026-09-07 — introducing it needs a new decision.

### Rule 12 — Migrations: version bump + sequential blocks; storage keys frozen
Each schema change adds a new `if (s.v < N)` block; existing blocks are never edited. v11 defensively converts old (≤ 10) saves once; v12 turns `metrics.risk` into `metrics.body` (meaning inverts, so the value resets to 15); v13 converts trophy `kind: "boss"` (old boss-effect residue) to `"ach"`; v14 renames fields for the terminology change — `quests → tasks`, `parts → areas`, `partId → areaId` (values unchanged). At entry, a non-numeric `v` is normalised to 0 so old saves do not skip the blocks. **Storage keys (`liferpg-*`) stay as they are for data compatibility.**

### Rule 13 — Tone: facts and numbers only
No encouraging, optimistic, or hopeful copy anywhere (UI, effects, prompts). Pace (progress vs. elapsed time, `paceOf`) and "목표 기여 없음" (no contribution to a goal) are never hidden or softened. Every state change (completion, check-in, goal creation) immediately shows the affected goal's progress change (from → to).

### Rule 14 — Role-model proximity is a squared curve
`roleGap` = `mean((have / need)²)`, designed so that being one grade below the requirement is about 70 %. Do not linearise it.

### Rule 15 — Job-fit weighting (certifications only)
Actual certification payout P = (base P − stage-group difference) × job-fit multiplier. The multiplier comes from `WEIGHT_MATRIX` (jobs × certification categories; S / A / B = 1.0 / 0.8 / 0.5; C = irrelevant = 0 — irrelevant qualifications are not valued by the market, so they pay nothing; confirmed by the user 2026-08-29, tightened from the research's initial 0.25) plus `CERT_W_EXC` (per-qualification exceptions, e.g. 컴퓨터활용능력 = C for 개발/데이터·AI, 지게차운전기능사 = A for 영업, 변리사 and 사회조사분석사 2급 = B for 개발/데이터·AI). The area's registered job directions (`dir`) decide the row; with several directions the **intersection (lowest tier)** applies — the qualification must count in every listed job — and the job that gave the lowest tier is shown as the basis. Onboarding knowledge directions map to matrix jobs through `DIR_ALIAS`. Evidence: 2026-08 market research (HRD Korea posting statistics, MOEL 500-company survey, per-job hiring specs and recruiter surveys; each cell carries evidence strength strong/medium/weak). An area with no job direction gets ×1.0 (no basis to judge). Exams (languages) keep the skill-bucket decay and are **not** job-weighted a second time. The 보건·의료 row (2026-09-04) has a single S cell for its own category — licences are legally mandatory (strong); all other cells lack evidence → C. V1.3 expanded to 15 categories × 21 jobs; the 150 new cross cells were verified against posting mention rates (S ≥ 30 % / A ≥ 15 % / B ≥ 5 %) and are **all C** (new jobs keep S only for their own category); the 47 qualifications with statutory or posting evidence are in `CERT_W_EXC`. Category-wide judgements are matrix matters, never exceptions. Do not change the matrix or exceptions without new evidence. `certByTitle` matches the **longest name first** (의사 ⊂ 치과의사, 약사 ⊂ 한약사); never revert to order-dependent partial matching.

### Rule 16 — Evidence regulations
Certification and exam tasks require a **photo** of the certificate / score report — text alone cannot complete them. Images are stored under `liferpg-img-ev-{taskId}` (viewable from the completed row's "증거 보기" → `EvidenceViewModal`; deleted together with the task and on full reset; keep this key convention if the file is ever split). Study tasks (`isStudy`) use **grade-tiered artifact verification** (`STUDY_REQ`, decided 2026-08-29): E = summary ≥ 30 chars + a new insight; D = that plus 1 artifact; C = summary ≥ 60 chars + 1 artifact; B = summary ≥ 100 chars + one line of limitation/critique + 2 artifacts. Artifacts are hand-written/organised photos (`liferpg-img-study-{taskId}-{n}`) or links (original text preserved in `evidence`). New study tasks can only be created at **E or D** (one-day size, Rule 18); the C/B definitions remain for legacy data. Do not relax the tiers or the photo requirement.

### Rule 17 — Daily activity kinds
`task.kind` ∈ book / fit (`ActivityLogModal`): 독서 (reading) requires a review (star rating + ≥ 15-char impression); 운동 (fitness) records measurements optionally on first completion, one-tap afterwards. Fitness measurements (weight, skeletal muscle) are applied **only** to a same-named metric KR of an active goal through `checkinKR` — there is no global metric store for them to fall back to any more (Rule 8). Activity records go to the area's achievement log and pay no trophy or metric. Task templates apply kind, difficulty, and cadence together; a title/kind mismatch (`detectKind`) blocks registration; kind tasks are capped at **difficulty C** (pts < 150, so they cannot bypass the evidence gate).

### Rule 18 — Goal-first structure (decided 2026-08-30)
Tasks are created only from goals: `goalId` is mandatory and the area is inherited from the goal (the task modal has no area picker). Every task is **one-day sized**: general and activity tasks cap at C, study at E/D. Certification, exam, and study tasks are "milestones" — the one-day exception — shown under their goal in the task tab. Legacy tasks without a goal appear in the "미분류" section and can only be completed or deleted. Never return to free-form task creation.

### Rule 19 — KR–task bridge (decided 2026-08-30)
Certification and exam milestones are created **only by one-click registration from the goal's KR**; the free browse mode was removed from the task modal (modes are just [일일 실행 · 학습], and templates, activity kinds, and study mode are scoped by `goalKinds` — inferred from the goal title, note, and KRs — so unrelated kinds never appear). exam KR → exam milestone (shows achieved / registered); cert KR → certification milestone (shows job fit and actual P); count KR → daily-task prefill; metric KR → check-in guidance only. The manual "취득 완료" button on cert KRs was removed — the only completion path is submitting the certificate photo on the milestone task.

**Amendment 2026-09-11 (user approval):** a normal task also requires an activity kind (book or fit) — `AddTaskModal` refuses an empty kind with `활동 유형을 골라 주세요 — 📚 독서·💪 운동만 목표에 등록돼요. 공부는 '학습', 자격·시험은 핵심결과, 약속·미팅은 일정 탭에서 만들어요.` The one exception is the count-KR bridge: a task created by tapping `채우기 ›` on a count KR stays creatable without a kind, because the count KR is itself the goal's own measured action, not an appointment. The carve-out is component state only (`AddTaskModal`'s `krId`) and is never written onto the task (Rule 9). Appointment-shaped work — including the removed `meet` kind — belongs to the `일정` tab, never a goal.
