# Installable offline app (PWA) for Android, with a data backup

- Status: completed
- Date: 2026-09-09
- Needs approval: the backup **import** replaces the saved state, so it ships behind an in-app confirmation; everything else is additive
- Agents: main agent → cleanup → verifier → docs-syncer

## Goal
Turn the web build into an app the user installs on an Android phone and opens from the home screen with no browser chrome, working in airplane mode. The user chose: Android phone, hosting at an unlisted HTTPS address is acceptable, offline is required. That means a real service worker, proper icons, and a manifest that survives being served from any path. Because the app becomes the daily record and its data lives only in this browser's `localStorage`, it also gets an export/import backup so a cleared browser is recoverable.

## Context read
`index.html` (manifest link, data-URI favicon, viewport), `public/manifest.webmanifest` (SVG icon only, absolute `start_url`), `vite.config.js` (default base), `vite.demo.config.js` (single-file `file://` build that must stay unaffected), `src/main.jsx` (entry), `src/LifeManager.jsx` (`store`, `KEY`, `liferpg-img-*` keys, `resetAll`, `GrowthTab` reset row), `tools/harness/verify.js` (build → preview on localhost → E2E), `tools/e2e/run.js`, `docs/RELIABILITY.md`, `docs/SECURITY.md`, backlog items 2 and 7.

## Constraints
- Storage keys stay exactly as they are ([Rule 12](../../design-docs/core-beliefs.md#rule-12)); the backup reads and writes them but never renames them, and an imported save goes through `migrate` like any other.
- No change to payouts, data tables, or rule text ([Rules 1, 4, 5, 6, 15](../../design-docs/core-beliefs.md#rule-1)); this phase adds no scoring surface at all.
- The single-file demo (`vite.demo.config.js`) keeps working from `file://` and must not gain a service worker.
- New UI copy is Korean `해요체` stating facts ([Rule 13](../../design-docs/core-beliefs.md#rule-13)) and doubles as an E2E selector.
- Service workers need a secure context. `localhost` counts, so the E2E covers it; a phone on the same Wi-Fi over plain HTTP does not, which is why hosting is required.

## Steps
- [x] **A — installable and offline.** `vite.config.js` `base: "./"` so the build runs from any path. `tools/harness/gen-icons.js` renders `public/icon.svg` to `icon-192.png`, `icon-512.png`, `icon-maskable-512.png` and `apple-touch-icon-180.png` with the Chrome already used by the E2E (no new dependency). Manifest gains those icons, `id`, `scope: "./"`, relative `start_url`, and `orientation: "portrait"`. `index.html` gains the Apple icon and standalone meta. A build-time Vite plugin writes `dist/sw.js` with the hashed asset list and a build id: hashed assets cache-first, the entry document network-first falling back to cache, old caches deleted on activate, `skipWaiting` + `clients.claim`. `src/main.jsx` registers it in production only and reloads once when a new version takes control. First run asks for `navigator.storage.persist()`.
- [x] **B — backup.** `백업 내보내기` writes one JSON file holding the state and every `liferpg-img-*` key; `백업 불러오기` reads one back, runs it through `migrate`, and replaces the save **after an explicit confirmation** that states what will be overwritten. Both sit next to `데이터 초기화` on the growth tab.
- [x] **C — ship.** `npm run build` output is the deployable; a short deploy guide covers the unlisted-HTTPS options and the Android install steps, plus the real-device smoke walk from backlog item 2.

## Verification
`npm run verify` with new E2E steps: the service worker registers and controls the page; a reload with the network disabled still renders the app (this is the offline claim, asserted rather than assumed); export produces a file whose JSON carries the state; import restores a modified save. Plus `npm run finish`, `npm run lang:check`, `npm run docs:gen && docs:check`, `npm run smoke`, and `npm run build:demo` opened from `file://` to prove the demo is unchanged.

## Cleanup checklist
- [x] `npm run finish` exit 0
- [x] no allowlist additions were needed

## Docs to sync
New `docs/product-specs/install-and-backup.md`; updates to `RELIABILITY.md` (offline and update behaviour, new flow file), `SECURITY.md` (the backup file leaves the device and holds evidence photos), `ARCHITECTURE.md` (build outputs, service worker), `state-lifecycle.md` (import path through `migrate`), `growth.md`, `feedback-overlays.md` (new toasts), `backlog.md` (item 7 done, item 2 actionable), the indexes, and `docs/generated/*`.

## Proposed commits
`feat(pwa): installable offline build — icons, manifest, service worker` · `feat(backup): export and import the save with its evidence photos` · `docs: install and deploy guide`
