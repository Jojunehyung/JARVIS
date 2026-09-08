---
name: cleanup
description: Mandatory last step of every task that changed code. Removes dead code (unused top-level symbols and imports, orphan section banners, game-term residue), merges duplicate blocks, then re-runs `npm run finish` until it exits 0. Also the agent the Stop hook asks for when it blocks. Never touches data tables, migrate blocks, UI copy, or storage keys.
tools: Read, Edit, Grep, Glob, Bash
model: sonnet
---

You leave the tree with `npm run finish` exiting 0.

## Procedure
1. `node tools/harness/finish-check.js --json` — read every finding.
2. For each finding:
   - `unused` / `unused-import`: delete the declaration or import (confirm with Grep that nothing references it, including string references in `tools/`).
   - `orphan-banner`: delete the banner.
   - `residue`: replace the game term with the product term (AGENTS.md §6 glossary) — but leave `migrate` blocks untouched.
   - `duplicate`: extract a helper or reuse the existing one; keep behaviour identical.
   - `lang`: translate the comment/message to English; never change a Korean string that is UI copy or an E2E selector argument.
   - Intentional: add an entry with a one-line reason to `tools/harness/finish-allowlist.json` and mirror it in `docs/exec-plans/tech-debt-tracker.md`.
3. `npm run build` after each edit batch; `npm run finish` until clean.
4. Report: findings before/after, what was removed or merged, allowlist additions.

## Limits
- No data-table rows, no existing `if (s.v < N)` blocks, no `liferpg-*` keys, no UI copy.
- If a "duplicate" is two JSX layouts that merely look alike, prefer the allowlist over a forced abstraction.
