# Harness-engineering layout
- Status: completed
- Date: 2026-09-08
- Needs approval: no (approved as a plan by the user; commits at phase gates approved)
- Agents: main agent (bootstrapping the harness itself) → reviewer per translation batch → cleanup → verifier → docs-syncer

## Goal
Restructure the repo into `AGENTS.md` / `ARCHITECTURE.md` / `docs/**` with four mandatory behaviours: agents routed from `AGENTS.md` and implemented as `.claude/agents/*`; prompt-first execution for every task request; English everywhere except UI copy and Korean data; every change ends with a dead/duplicate-code cleanup enforced by a Stop hook. Korean originals are retired after tag `ko-docs-final`.

## Prompt (for the executing agent)
Follow `AGENTS.md`. Do not change runtime behaviour of `src/LifeManager.jsx` (comments and the `@schema` JSDoc block only), do not change UI copy or E2E selectors, keep `npm run verify` green and `npm run finish` clean at every phase gate. Translate faithfully: keep Korean domain terms in code font with a gloss on first use, quote UI copy verbatim, copy numbers and dates exactly, link rules as `core-beliefs.md#rule-n`, and log doc-vs-code mismatches in `tech-debt-tracker.md` instead of silently fixing them. Mark every migrated section with `<!-- src: ID -->` per `tools/harness/docs-manifest.json`.

## Steps
- [x] Phase 0 — snapshot commit + tag `ko-docs-final`; `.gitignore`/`.gitattributes`; E2E deps installed.
- [x] Phase 1 — `tools/harness/*`, npm scripts, `.claude/settings.json` hooks, seven agents, `AGENTS.md`, thin `CLAUDE.md`; E2E helpers de-duplicated; hooks tested (prompt-first injection, Stop block ×2 then allow, data-guard deny).
- [x] Phase 2 — English core docs (`core-beliefs`, `ARCHITECTURE`, `PRODUCT_SENSE`, `FRONTEND`, `PLANS`, `RELIABILITY`, `SECURITY`, `DESIGN`, `QUALITY_SCORE`, `job-weighting`, `decision-log`, backlog, tech-debt, completed plans, references), `@schema` block, `docs:gen`, `CLAUDE.md` without inline rules.
- [x] Phase 3 — translate comments in `src/LifeManager.jsx` and `tools/e2e/*` (selectors untouched); enable `lang` in `finish.config.json`.
- [x] Phase 4 — decompose the master spec (ch1–3, ch4, ch5, ch6–8, ch9–13) into `product-specs/` and `design-docs/`; reviewer fidelity pass per batch; refresh `QUALITY_SCORE.md` verdicts.
- [x] Phase 5 — delete the four Korean originals, create the file-split stub plan, move this plan to `completed/`, decision-log entry.

## Verification
Per phase: `npm run verify`, `npm run finish`, `npm run docs:check` (`--no-links` until Phase 2, `--final` after Phase 5), `npm run smoke`, `npm run build:demo`.

## Cleanup checklist
- [x] `npm run finish` exit 0 after Phase 1 (E2E duplicates merged into `run.js` helpers and `bench-lib.js`)
- [x] after Phase 2 (`finish` clean, `verify` 67/67, `docs:check` clean)
- [x] after Phase 3 (`finish` clean with `lang: true`, `lang:check` clean)
- [x] after Phase 4 (`finish` clean, `docs:check` clean)
- [x] after Phase 5 (`finish` clean, `docs:check --final` clean, `verify` green, `build:demo` single file)

## Docs to sync
All of them — this plan is the docs restructure. Generated tables via `npm run docs:gen`.

## Proposed commits
`chore: snapshot before harness restructure` (done) · `feat(harness): agents, hooks, finish-check/verify scripts, AGENTS.md routing` (done) · `docs: English core docs + generated tables` · `refactor: translate comments and E2E harness to English` · `docs(spec): …` ×5 · `docs: retire Korean originals; harness restructure complete`.
