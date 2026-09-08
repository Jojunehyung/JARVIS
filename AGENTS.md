# AGENTS.md — Life Manager harness routing table

Life Manager (인생 관리) is a local-only Vite + React app that turns life goals into OKRs, daily tasks, and evidence-backed achievements graded against market standards. `CLAUDE.md` imports this file; **this is the single place that says which agent runs when.**

## 1. Start here (reading order)
1. This file (routing, protocols, language policy, never-do list).
2. `docs/design-docs/core-beliefs.md` — the 19 invariant rules. The only canonical copy; everything else links by number.
3. `ARCHITECTURE.md` — module map with grep anchors, storage adapter, builds, glossary.
4. `docs/PLANS.md` — prompt-first protocol and the exec-plan template.

Then per task: UI/copy → `docs/FRONTEND.md`, `docs/DESIGN.md`, `docs/product-specs/<screen>.md` · engine/data → `docs/design-docs/scoring-engine.md`, `job-weighting.md`, `docs/generated/*` · storage/migration → `docs/design-docs/state-lifecycle.md`, `docs/generated/db-schema.md`, `docs/RELIABILITY.md`.

## 2. Repo map
```
CLAUDE.md                 entry point — imports this file
AGENTS.md                 this routing table
ARCHITECTURE.md           module map, storage adapter, builds, file regions, glossary
.claude/settings.json     hooks (prompt-first, data-guard, lang-check, finish) + permission allowlist
.claude/agents/           planner · implementer · verifier · cleanup · reviewer · data-curator · docs-syncer
src/LifeManager.jsx       the whole app (data tables → storage → engine → tabs/modals → root); src/main.jsx entry
docs/
  PRODUCT_SENSE.md DESIGN.md FRONTEND.md PLANS.md QUALITY_SCORE.md RELIABILITY.md SECURITY.md
  design-docs/            core-beliefs (rules), engine and IA design docs, decision-log
  product-specs/          per-screen specs, onboarding, the harness-engineer scenario
  exec-plans/             active/ completed/ backlog.md tech-debt-tracker.md
  generated/              db-schema, cert-table, exam-table, weight-matrix, onboarding-tables, symbol-index — NEVER hand-edited
  references/             curated third-party notes (*-llms.txt)
tools/e2e/                puppeteer-core E2E harness (run.js + flow*.js), own package.json
tools/harness/            finish-check · lang-check · verify · check-docs · gen-* · smoke-logic · data-guard · prompt-first
public/ index.html vite.config.js vite.demo.config.js (single-file demo → release/life-demo.html)
```

## 3. Agent routing table
| Situation | Agent | Reads | Writes | Must end with |
|---|---|---|---|---|
| Any task request — contains 해줘 or an imperative (implement, add, fix, change, refactor, translate, optimize) | **planner** (first) | AGENTS, core-beliefs, ARCHITECTURE, PLANS, relevant spec | `docs/exec-plans/active/<date>-<slug>.md` | hand-off to implementer / data-curator |
| Executing an exec plan — code, docs, tests, translations | **implementer** | the plan + files it lists, FRONTEND | `src/`, `tools/`, `docs/` | cleanup → verifier |
| Any change to `CERTS`, `EXAMS`, `WEIGHT_MATRIX`, `CERT_W_EXC`, `DIR_ALIAS`, `DIR_CATS`, cert renames, new exam family | **data-curator** (planner first; runs with `HARNESS_DATA_EDIT=1`) | job-weighting, scoring-engine, rules 4/6/15, sources | data rows, `finish.config.json` counts, decision-log | smoke → cleanup → verifier → docs-syncer |
| Bug report, "why does X happen", pre-commit review, translation fidelity | **reviewer** (read-only) | diff, core-beliefs, FRONTEND | nothing | ranked findings or "no findings" |
| After every code change (mandatory; the Stop hook enforces it) | **cleanup** | `finish-check --json` | `src/`, `tools/` removals/merges, allowlist | `npm run finish` exit 0 |
| Build + E2E + smoke, "does it still work" | **verifier** | `tools/harness/out`, `tools/e2e/out` | nothing | PASS/FAIL report |
| Docs after code/data change, schema change, plan completion, docs-only requests | **docs-syncer** | source, generated/, exec plan | `docs/**`, ARCHITECTURE, decision-log, tech-debt-tracker; moves active → completed | `npm run docs:check` exit 0 |
| New state field / schema change | planner (plan must add a new `if (s.v < N)` block and bump `v`) → implementer → verifier (flow4 migration steps) → docs-syncer (db-schema regen) | | | |

Main-agent responsibilities that are not delegated: choosing the route, showing the plan summary, running the finish protocol, writing the final report, and committing only at phase gates the user approved.

## 4. Prompt-first protocol (canonical: `docs/PLANS.md`)
1. **Detect** — the `UserPromptSubmit` hook injects this protocol when the prompt contains 해줘; imperatives without it are treated the same way by the main agent.
2. **Plan before edit** — planner writes `docs/exec-plans/active/<YYYY-MM-DD>-<slug>.md`. Its **Prompt** section is the exact, program-specific prompt the executing agent runs (goal, files/symbols, rules by number, conventions, acceptance criteria, verification, finish protocol). Trivial task (≤1 file, ≤20 lines, no rule touched) → 3-line inline plan, still before any edit.
3. **Show** a ≤10-line summary of the plan.
4. **Execute immediately** — ask the user first only when the plan touches rules 1–19 data (CERTS/EXAMS/matrix rows), `migrate` blocks, `liferpg-*` storage keys, or deletes user data.
5. **Finish protocol** (§5).

## 5. Finish protocol (mandatory, in this order)
1. **cleanup** → `npm run finish` exit 0 (dead code, duplicates, residue, language). Intentional findings go to `tools/harness/finish-allowlist.json` with a reason and are mirrored in `docs/exec-plans/tech-debt-tracker.md`.
2. **verifier** → `npm run verify` (build, preview, full E2E, 0 console errors); `npm run verify -- --smoke` when engine or data changed.
3. **docs-syncer** when `src/` or data changed → `npm run docs:gen`, `npm run docs:check`; move the plan to `completed/`.
4. **Report**: what changed, commands run with results, findings, proposed commit message. Commit only when the user asked or at an approved phase gate.

## 6. Language policy
English everywhere — code comments, identifiers, docs, commit messages, E2E step names and log strings — **except**: UI copy (Korean, 해요체), the data tables (`CERTS`, `EXAMS`, `JOB_FIELDS`, `KNOWLEDGE_FIELDS`, option lists, `TASK_TEMPLATES`, `GATE_CHIPS`), `demoState` content, E2E selector/assert arguments that must match UI copy, regexes that match Korean UI text, and storage keys (ASCII, frozen).
Glossary for English prose: `실행` task · `영역` area · 등급 grade · 성취 achievement · 마일스톤 milestone · 관문 gate · 보호권 streak shield · 인생 지표 life metrics. Quote Korean UI copy verbatim in backticks.

## 7. What agents must never do (rule numbers → `docs/design-docs/core-beliefs.md`)
- Add multipliers, bonuses, or caps to achievement payouts (R1); change the exam band snapshot / skill-bucket decay / specialisation logic (R2); pay stage-group certs at full instead of the difference (R3).
- Rescore already-paid achievements when D/P tables change (R4); move the grade cuts A82 / B65 / C50 / D35 (R5).
- Edit numbers in `CERTS`/`EXAMS`, apply a rename before its effective date, or add rows without data-curator evidence (R6).
- Reintroduce XP, levels, gold, shops, criticals, random rewards, bosses, stories, dating-sim mechanics, or any AI feature without explicit user approval (R7).
- Create automatic sources for `metrics.body`, idle growth, or store derived progress in state (R8, R9).
- Bypass `needsEvidence`, or promote without the evidence gate (R10, R11).
- Edit an existing `migrate` block, skip a version bump, or change `liferpg-*` keys (R12).
- Write encouraging or optimistic copy, or hide pace and "목표 기여 없음" (R13); linearise `roleGap` (R14).
- Change `WEIGHT_MATRIX`/`CERT_W_EXC` without new evidence, route category-wide judgments through exceptions, or revert `certByTitle` longest-name matching (R15).
- Relax photo-mandatory evidence or `STUDY_REQ` tiers, or change the `liferpg-img-*` key convention (R16).
- Break activity-kind rules, let kind tasks exceed difficulty C, or feed fitness measures anywhere but the same-name metric KR (R17).
- Allow tasks without `goalId`, free-form cert/exam task creation, or a manual cert "done" button (R18, R19).
- Hand-edit `docs/generated/*`; change UI copy in a translation or refactor task; touch `store` call sites; commit outside an approved gate; use Tailwind beyond v3 core utilities.

## 8. Commands
`npm run verify` (build + E2E; `-- --smoke` adds engine smoke) · `npm run finish` · `npm run smoke` · `npm run docs:gen` · `npm run docs:check` (`-- --final` after migration) · `npm run lang:check` · `npm run build:demo`.

## 9. Hooks (`.claude/settings.json`)
`UserPromptSubmit` → prompt-first reminder · `PreToolUse Edit` → data-guard (denies data-row edits without `HARNESS_DATA_EDIT=1`) · `PostToolUse Edit/Write` → lang-check warning · `Stop` → finish-check (blocks at most twice per session, then writes `tools/harness/out/finish-report.md` and lets the session end).
