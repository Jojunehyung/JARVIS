# Life Manager (인생 관리)

A local-only web app that turns life goals into OKRs, day-sized tasks, and evidence-backed achievements priced against market standards. It installs to an Android home screen and runs offline. Every record stays in the browser on the device — there is no account, no server, and no network call.

- **Live app:** enable Pages once (below), then `https://jojunehyung.github.io/JARVIS/`
- **What it is and why:** [docs/PRODUCT_SENSE.md](docs/PRODUCT_SENSE.md)
- **Installing, offline behaviour, backups:** [docs/product-specs/install-and-backup.md](docs/product-specs/install-and-backup.md)
- **Working on it:** [AGENTS.md](AGENTS.md) — routing, protocols, and the 19 invariant rules in [docs/design-docs/core-beliefs.md](docs/design-docs/core-beliefs.md)

## Deploying
`.github/workflows/deploy.yml` builds the app and publishes `dist/` on every push to `main`. It runs once the repository's **Settings → Pages → Source** is set to **GitHub Actions**.

## Local development
```bash
npm install
npm run dev             # http://localhost:5173
npm run build           # dist/ — the deployable app
npm run verify          # build + 87-step end-to-end run in a real browser
npm run finish          # dead code, duplicates, language policy
npm run docs:check      # documentation integrity
```
The end-to-end harness drives the installed Chrome through `tools/e2e` and needs `cd tools/e2e && npm i` once.

## What lives where
| Path | Contents |
|---|---|
| `src/LifeManager.jsx` | the whole app |
| `docs/` | product specs, design docs, exec plans, generated tables |
| `tools/harness/` | build, verification and documentation scripts |
| `tools/e2e/` | the end-to-end scenario |

Data note: records live in `localStorage` under `liferpg-*` keys and never leave the device. Clearing the browser's site data erases them, so the growth tab has `백업 내보내기` — write a backup file now and then.
