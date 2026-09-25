# Life Manager (인생 관리)

A local-only web app that turns life goals into OKRs, day-sized tasks, and evidence-backed achievements priced against market standards. It installs to an Android home screen and runs offline. Every record stays in the browser on the device — there is no account, no server, and no network call the app makes on its own. Since 2026-09-25 there is one narrow, opt-in exception under the user's own hand: the app's own repository can send a contentless daily Web Push (see "Deploying" below).

- **Live app:** https://jojunehyung.github.io/JARVIS/ (after Pages is switched on, below)
- **What it is and why:** [docs/PRODUCT_SENSE.md](docs/PRODUCT_SENSE.md)
- **Installing, offline behaviour, backups:** [docs/product-specs/install-and-backup.md](docs/product-specs/install-and-backup.md)
- **Working on it:** [AGENTS.md](AGENTS.md) — routing, protocols, and the 19 invariant rules in [docs/design-docs/core-beliefs.md](docs/design-docs/core-beliefs.md)

## Deploying
`.github/workflows/deploy.yml` builds the app and publishes `dist/` on every push to `main`. Switch it on once: **Settings → Pages → Build and deployment → Source → GitHub Actions**, then re-run the latest workflow (or push again).

**Daily push (2026-09-25, optional).** `.github/workflows/notify.yml` sends one contentless Web Push a day (08:00 and 20:00 Asia/Seoul) to whichever subscription is in the repository secret `PUSH_SUBSCRIPTION` — copied by hand from `설정 › 푸시 알림` once the switch is on. It also needs `VAPID_PRIVATE_KEY`, generated once alongside the app's public key with `npx --package web-push web-push generate-vapid-keys --json`; the public key is pasted into `src/LifeManager.jsx` and `tools/push/send.mjs`, the private key into the secret only — never a commit, a doc, or a log. Without either secret the workflow still succeeds and sends nothing. See [docs/product-specs/install-and-backup.md](docs/product-specs/install-and-backup.md#daily-push-2026-09-25) and [docs/SECURITY.md](docs/SECURITY.md#the-daily-push-2026-09-25).

## Local development
```bash
npm install
npm run dev             # http://localhost:5173
npm run build           # dist/ — the deployable app
npm run verify          # build + the E2E scenario as currently written, in a real browser
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
| `tools/push/` | `send.mjs` — sends the daily contentless Web Push, run by `.github/workflows/notify.yml` |

Data note: records live in `localStorage` under `liferpg-*` keys and never leave the device. Clearing the browser's site data erases them, so the `설정` button in the corner of home's CV card has `백업 내보내기` — write a backup file now and then.
