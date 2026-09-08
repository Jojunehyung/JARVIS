# Vite scaffold and storage shim
- Status: completed
- Date: 2026-09-03
- Agents: (pre-harness; done in a single session)

## Goal
Turn the artifact-era single JSX file into a runnable local app: Vite + React scaffold, Tailwind v3, and replace the artifact-only `window.storage` with a `localStorage` adapter behind the same `store` interface so that state survives reloads.

## What was done
- `npm create vite` (react template), Tailwind v3 core config, `lucide-react`; the JSX moved whole to `src/LifeManager.jsx` (then `LifeRPG.jsx`, renamed 2026-09-07), rendered from `src/main.jsx`.
- `store.get/set/del` re-implemented over `localStorage` with JSON serialisation and an in-memory fallback; **call sites untouched** (the interface is the seam).
- Single-file demo build (`vite.demo.config.js` → `release/life-demo.html`, IIFE script inlined before `</body>`) verified on desktop Chrome from `file://`; iOS cannot execute JS from a local file, so phones need hosting.
- Node LTS installed; `npm run build` green.

## Verification
Manual smoke of the reference scenario; reload persistence confirmed. (The automated E2E harness came later, 2026-09-07.)

## Follow-ups
Real-device smoke remains backlog item 2.
