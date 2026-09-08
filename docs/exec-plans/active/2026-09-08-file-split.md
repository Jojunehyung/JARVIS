# File split — `src/data`, `src/engine`, `src/components`
- Status: active (stub — not started; backlog item 3)
- Date: 2026-09-08
- Needs approval: yes (touches every region of the single file; the user decides when)
- Agents: planner (writes the real plan) → implementer → cleanup → verifier → docs-syncer

## Goal
Split `src/LifeManager.jsx` (≈ 4,560 lines) into `src/data` (`CERTS`, `EXAMS`, onboarding option lists, `WEIGHT_MATRIX`, `CERT_W_EXC`), `src/engine` (payouts, goal maths, `migrate`) and `src/components` (screens and modals), with unit tests for `calcExamPayout`, `krProgress` and `migrate` written **before** the move so the split is verified by tests, not by inspection.

## Why it is still open
The single file is the reason every task pays a large context cost, and `docs/generated/symbol-index.md` plus the file-region table in [../../../ARCHITECTURE.md](../../../ARCHITECTURE.md) are the workaround. The split is deferred, not abandoned: it is a behaviour-preserving refactor that touches every rule surface at once, so it needs its own plan and its own gate.

## Constraints the real plan must carry
- No behaviour change, no UI copy change, no E2E selector change — `npm run verify` must produce the same 67 steps with 0 failures before and after.
- Data tables move verbatim; the data-guard hook still refuses row edits ([Rule 6](../../design-docs/core-beliefs.md#rule-6), [Rule 15](../../design-docs/core-beliefs.md#rule-15)).
- `store` call sites stay untouched, storage keys stay `liferpg-*` ([Rule 12](../../design-docs/core-beliefs.md#rule-12)).
- `migrate` blocks move as a whole; no block is edited on the way.
- `tools/harness/lib/source.js` reads `src/LifeManager.jsx` by path (`grabBlock`, `dataRegions`, `collectDecls`). Every generator, `finish-check` and `smoke-logic` must be updated in the same plan, or the docs and the finish gate break.
- `vite.demo.config.js` must still produce a single-file `release/life-demo.html`.

## Suggested order
1. Unit-test harness (no new runtime dependency; a plain node test file under `tools/harness` is enough) covering `calcExamPayout`, `krProgress`, `goalProgress`, `certGainOf`, `jobWeightForCert`, `migrate` v10 → v14.
2. `src/data` first (pure data, no imports), regenerate docs, verify.
3. `src/engine` second, verify.
4. `src/components` last, one region per commit, verify after each.

## Verification
`npm run verify` after every step, `npm run smoke` after the engine move, `npm run finish` and `npm run docs:check` at the end.
