# Security

Life Manager is a local-only, single-user web app with no backend, no accounts, and no network calls at runtime. The threat model is small; the notes below record what is stored, what could leak, and what the harness may execute.

## Data at rest
- All state lives in the browser's `localStorage` of the origin the app is served from (`liferpg-state-v1` and `liferpg-img-*`). Anyone with access to the browser profile can read it. There is no encryption; the app does not promise confidentiality beyond the device.
- Evidence photos (certificates, score reports, study artifacts, profile picture) are stored as resized data URLs. These may contain personal identifiers (name, ID numbers on certificates). They are deleted with the task (`removeTask`) and on full reset (`resetAll`); they are never uploaded anywhere.
- The single-file demo (`release/life-demo.html`) opened from `file://` has its own origin and storage; it contains no user data at build time.

## Data in transit
None. The production build makes no fetch/XHR; fonts and icons are bundled. Manifest and favicon are inline/static.

## Code execution surfaces
- Runtime: React renders user text as text (no `dangerouslySetInnerHTML`); links entered as study artifacts are stored as strings and rendered as text.
- Harness scripts (`tools/harness/*.js`) call `eval` on `const NAME = <literal>` blocks extracted from `src/LifeManager.jsx` to read data tables. This runs only on trusted local source in the developer's shell, never in the app.
- Claude Code hooks (`.claude/settings.json`) run `node tools/harness/*.js` with the project as working directory. They read stdin JSON from Claude Code, touch only `.claude/harness-state/`, `tools/harness/out/`, and never modify `src/`. `data-guard` can only deny an edit; it cannot perform one.

## Rules that are also safety properties
- Frozen data tables and payout formulas ([Rules 1–6](design-docs/core-beliefs.md#rule-1)) prevent silent score inflation.
- Frozen storage keys and append-only migrations ([Rule 12](design-docs/core-beliefs.md#rule-12)) prevent data loss on upgrade.
- No AI or network features without explicit user approval ([Rule 7](design-docs/core-beliefs.md#rule-7)) — adding one would change this document's threat model.

## Reporting
There is no external bug bounty; open an entry in `docs/exec-plans/tech-debt-tracker.md` with severity S1 for data-loss or exposure issues.
