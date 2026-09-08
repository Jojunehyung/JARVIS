# English-only plans, prompts and edits
- Status: completed
- Date: 2026-09-08
- Needs approval: no (process rules and harness scripts only; no rule data, no `migrate` block, no storage key)
- Agents: main agent (harness rules) → cleanup → docs-syncer

## Goal
The user asked that a request phrased as a task produce its prompt and plan **in English**, and that every edit that follows be written in English except where Korean is mandatory. The policy already existed in prose; this plan makes it explicit at each place an agent reads it, and enforceable by `npm run docs:check`.

## Context read
`tools/harness/prompt-first.js` (the injected protocol), `docs/PLANS.md` (canonical protocol + exec-plan template), `AGENTS.md` §4 (prompt-first) and §6 (language policy), `.claude/agents/planner.md` (already says plans are English), `.claude/agents/implementer.md`, `tools/harness/check-docs.js` (checks 1–7). No rule from `core-beliefs.md` is touched; [Rule 13](../../design-docs/core-beliefs.md#rule-13) and the UI-copy exemption in AGENTS.md §6 stay exactly as they are.

## Prompt
Make the English-first rule explicit and mechanical. In `prompt-first.js`, state in the injected protocol that the plan file, its Prompt section and the summary shown to the user are written in English, and that the executing agent's output is English except UI copy, the frozen data tables, E2E selector arguments, regexes matching UI text, and storage keys. Mirror the same sentence in `docs/PLANS.md` (step 2 and the template) and in `AGENTS.md` §4 and §6. Add check 8 to `check-docs.js`: a file under `docs/exec-plans/` fails when Hangul appears outside a fenced code block or a backtick span, so quoted UI copy and data names stay legal while prose must be English. Fix any existing plan that violates it. Do not change UI copy, data tables, E2E selectors, or any rule text. Acceptance: `npm run docs:check` fails on a planted Korean prose line in a plan and passes once it is quoted or translated; `npm run finish` and `npm run lang:check` stay clean.

## Steps
1. `prompt-first.js` — add the language line to `PROTOCOL`.
2. `docs/PLANS.md` — step 2 and the template carry the rule; the example section keeps "Korean requests are fine".
3. `AGENTS.md` §4 step 2 and §6 — one sentence each.
4. `.claude/agents/implementer.md` — same sentence as `planner.md` already has.
5. `check-docs.js` — check 8, exec plans are English outside backticks; fix violations found.

## Verification
`npm run docs:check` clean after quoting 21 pre-existing Korean strings in the plans; a planted Korean prose line made it fail with one problem and it went clean again when removed. `npm run finish` clean, `npm run lang:check` clean. No build or E2E impact: nothing under `src/` changed.

## Cleanup checklist
- [x] `npm run finish` exit 0
- [x] no allowlist additions needed

## Docs to sync
`docs/PLANS.md`, `AGENTS.md`, `docs/design-docs/decision-log.md` (one row). Generated docs unaffected (`src/` untouched).

## Proposed commit
`chore(harness): require English plans, prompts and edits; enforce it in docs:check`
