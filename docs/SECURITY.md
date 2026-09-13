# Security

Life Manager is a local-only, single-user web app with no backend, no accounts, and no network calls at runtime. The threat model is small; the notes below record what is stored, what could leak, and what the harness may execute.

## Data at rest
- All state lives in the browser's `localStorage` of the origin the app is served from (`liferpg-state-v1` and `liferpg-img-*`). Anyone with access to the browser profile can read it. There is no encryption; the app does not promise confidentiality beyond the device.
- Since schema v21 (2026-09-13), `profile` holds a real name, an exact birth date, and optional e-mail and phone, alongside the education (`edus[]`: school, department, degree, dates) and career (`careers[]`: company, role, dates) records the `프로필` screen collects and edits. These are personal facts by definition. They sit in the same unencrypted `liferpg-state-v1` key as everything else, with no separate handling — the "no confidentiality beyond the device" statement above covers them exactly as it covers the rest of the save.
- Evidence photos (certificates, score reports, study artifacts, profile picture) are stored as resized data URLs. These may contain personal identifiers (name, ID numbers on certificates). They are deleted with the task (`removeTask`) and on full reset (`resetAll`); they are never uploaded anywhere.
- The single-file demo (`release/life-demo.html`) opened from `file://` has its own origin and storage; it contains no user data at build time — `demoState`'s profile is entirely synthetic (a placeholder name, a birth date computed from the build date, no e-mail or phone), so sharing a demo build cannot leak a real person's CV ([demo-data.md](design-docs/demo-data.md)).

## Data in transit
None by the app. The production build makes no fetch/XHR; fonts and icons are bundled. Manifest and favicon are inline/static.

The assistant bridge (`AI에게 보내기`) is the one place data leaves deliberately: it renders a text packet — goals, open tasks, the last seven journal entries, the last weekly review, the streak and role-model proximity, and, since schema v21, one `## 이력` line stating degree, department/field, total months of practice and the most recent role — into a textarea and the clipboard; never photos. That CV line is built from `topEdu` / `latestCareer` and is deliberately the only place the CV is summarised for an outside reader: it never carries `profile.name`, the birth date, the e-mail, the phone number, the school name or the employer name — a school or an employer identifies a person nearly as well as a name does. Copying the packet is a user action, and pasting it into a third-party chat puts that text outside this threat model. The reply the user pastes back is stored as text in `journal[].ai` and rendered as text; it can only propose tasks, never change a score ([Rule 7](design-docs/core-beliefs.md#rule-7)).

## The backup file
`백업 내보내기` writes the whole save — profile (including the exact name, birth date, optional e-mail/phone and every education and career record since schema v21), goals, tasks, achievements and every evidence photo — to a JSON file the user chooses where to keep. Carrying the CV here is correct and unchanged from how every other field has always been handled: the file is local, it is the only way back from a cleared browser, and the file is as sensitive as the device itself — once it is in a downloads folder, a cloud-synced directory or a chat, it is outside this threat model. Import replaces the current records and asks for confirmation naming the export date first.

## Code execution surfaces
- Runtime: React renders user text as text (no `dangerouslySetInnerHTML`); links entered as study artifacts are stored as strings and rendered as text.
- Harness scripts (`tools/harness/*.js`) call `eval` on `const NAME = <literal>` blocks extracted from `src/LifeManager.jsx` to read data tables. This runs only on trusted local source in the developer's shell, never in the app.
- Claude Code hooks (`.claude/settings.json`) run `node tools/harness/*.js` with the project as working directory. They read stdin JSON from Claude Code, touch only `.claude/harness-state/`, `tools/harness/out/`, and never modify `src/`. `data-guard` can only deny an edit; it cannot perform one.

## Rules that are also safety properties
- Frozen data tables and payout formulas ([Rules 1–6](design-docs/core-beliefs.md#rule-1)) prevent silent score inflation.
- Frozen storage keys and append-only migrations ([Rule 12](design-docs/core-beliefs.md#rule-12)) prevent data loss on upgrade.
- No in-app AI and no network calls ([Rule 7](design-docs/core-beliefs.md#rule-7)); the approved assistant bridge moves text only through the clipboard, under user action, and is described under "Data in transit".

## Reporting
There is no external bug bounty; open an entry in `docs/exec-plans/tech-debt-tracker.md` with severity S1 for data-loss or exposure issues.
