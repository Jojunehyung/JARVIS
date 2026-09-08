# Job-fit weighting
<!-- src: SPEC-5 -->

Certifications pay according to how much the target job actually values them. The full rule is [Rule 15](core-beliefs.md#rule-15); the live tables are generated in [../generated/weight-matrix.md](../generated/weight-matrix.md). This page explains the mechanism and the evidence policy.

## Formula
```
actual P = (certP(D) − stage-group difference already held) × TIER_MULT[tier]
tier     = CERT_W_EXC[cert.n]?.[job] ?? WEIGHT_MATRIX[job][cert.c] ?? "C"
TIER_MULT: S 1.0 · A 0.8 · B 0.5 · C 0
```
- `job` comes from the area's registered directions (`area.dir`); onboarding knowledge directions map through `DIR_ALIAS`. Several directions → **intersection**: the lowest tier across them wins and that job is shown as the basis.
- No direction on the area → ×1.0 (there is no basis to judge).
- Exams (languages) are not job-weighted; they keep the skill-bucket decay of [Rule 2](core-beliefs.md#rule-2).
- C means "not valued by the market for this job" and pays **0** — decided 2026-08-29 (the research draft had 0.25).

## Matrix (21 jobs × 15 categories)
Rows are jobs (`JOB_FIELDS`), columns are certification categories (`CERT_CATS`). Unlisted cells are C. Original 16 × 10 cells rest on the 2026-08 market research (HRD Korea posting-usage statistics, MOEL 500-company survey, per-job hiring specs and recruiter surveys), each with an evidence strength strong / medium / weak. The 보건·의료 row (2026-09-04) has one S cell: licences are legally mandatory. The five V1.3 jobs (교육·복지, 문화·예술, 운송·항공·해양, 화학·소재, 농림·식품) likewise keep S only for their own category.

## Evidence thresholds
Mention rate in job postings for that job: **S ≥ 30 %** (or statutory requirement), **A ≥ 15 %**, **B ≥ 5 %**, else C. The 150 cross cells created by V1.3 were researched per job and adversarially verified against these thresholds — all came out C, so the matrix was not widened by assumption.

## Individual exceptions (`CERT_W_EXC`)
For a single qualification that is valued by a job even though its category is not (or the reverse): e.g. 컴퓨터활용능력 = C for 개발/데이터·AI, 지게차운전기능사 = A for 영업 and 운송·항공·해양, 사회복지사 1급 = S for 교육·복지, 정신건강 전문요원 = A for 보건·의료, 한국어교원 1·2급 = A for 외국어. 47 qualifications as of V1.3, each with a source note in the code comment. A judgement that applies to most of a category belongs in the matrix, not in exceptions.

## Changing the tables
Only the data-curator agent, with a planner plan that cites sources (posting sample, statute, effective date), edits `WEIGHT_MATRIX` or `CERT_W_EXC`; it runs with `HARNESS_DATA_EDIT=1`, then `npm run smoke` (documented payouts must still hold), `npm run docs:gen`, and a decision-log entry. Re-verification cadence for mention rates: every six months (backlog).
