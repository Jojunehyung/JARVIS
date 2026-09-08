# Frontend conventions
<!-- src: CL-8 --><!-- src: SPEC-10 -->

Single React 18 file (`src/LifeManager.jsx`), Vite 5, Tailwind v3 **core utilities only**, `lucide-react` icons. No lint/format tooling; the conventions below are enforced by review and by `npm run finish`.

## State
- The whole app state is one object (`state`, schema in [generated/db-schema.md](generated/db-schema.md)); persisted to `localStorage` under `KEY = "liferpg-state-v1"` on every change through the `store` adapter (`store.get/set/del`, JSON built in, memory fallback). **Never change the `store` call sites.**
- Updates use the clone pattern:
  ```js
  setState((prev) => { const s = structuredClone(prev); /* mutate s */ return s; });
  ```
  Small updates may spread (`{ ...prev, goals: … }`), but never mutate `prev`.
- Derived values (goal progress, pace, role-model proximity, job fit) are computed in render or memoised — never stored ([Rule 9](design-docs/core-beliefs.md#rule-9)).
- Effects and toasts are chained with `queueMicrotask` (+ `setTimeout` when a delay is needed). Only two full-screen overlays exist (`gradeup`, `achieve`); adding a third is a design decision, not a convenience.
- Schema change = new `if (s.v < N)` block in `migrate`, `v` bump in `freshState`, `@schema` JSDoc block update, and an E2E fixture step in `tools/e2e/flow4.js` ([Rule 12](design-docs/core-beliefs.md#rule-12)).

## Data tables
`CERTS`, `EXAMS`, `WEIGHT_MATRIX`, `CERT_W_EXC`, `DIR_ALIAS`, `DIR_CATS` and the option lists are frozen data ([Rule 6](design-docs/core-beliefs.md#rule-6), [Rule 15](design-docs/core-beliefs.md#rule-15)); the `data-guard` hook denies edits unless the data-curator runs with `HARNESS_DATA_EDIT=1`. Module-level indexes (`CERT_BY_NAME`, `CERTS_LONGEST_FIRST`, `CERT_NAME_LC`, `CERTS_BY_CAT`, `EXAM_BY_ID`, `certOf`, `examOf`, `certByTitle` with a per-title cache) exist so that render paths never scan the 1,011-row table repeatedly — use them instead of `CERTS.find`.

## Rendering
- Long lists are capped: the catalog and the onboarding qualification picker render at most 60 rows and show "N종 더 있음 — 검색어로 좁혀요"; the picker keeps already-selected items in view. Measured: 1,011 → 60 mounted rows cut that screen from 4,121 to 318 DOM nodes.
- Memoise list filters with `useMemo`; do not use `useDeferredValue` on capped lists (it added a render pass without benefit).
- `ToastHost` owns toast state (ref API `show(t)`), so toasts never re-render `App`.
- Modals: `<Modal title onClose>` — backdrop click closes, inner card stops propagation, header X, `z-40` (overlays are `z-50`), `max-h-full overflow-y-auto`; mobile bottom sheet, centred from `sm:`.

## Copy and language
- UI text is Korean 해요체; identifiers, comments, commit messages, and docs are English.
- Tone: numbers and facts only; pace and "목표 기여 없음" are always visible ([Rule 13](design-docs/core-beliefs.md#rule-13)).
- E2E selectors match Korean UI copy (`tools/e2e/*`): a copy change is an E2E change. Refactors and translation tasks never touch UI strings.
- Terminology since 2026-09-07: 실행 (task), 영역 (area), 인생 관리 (the product), 보호권 (streak shield). Game words (퀘스트, 파트, 상태창, 실드, 플레이어, 캐릭터) do not come back.

## Styling
- Tailwind v3 core classes only — no arbitrary values (`w-[…]`), no plugins; `bg-opacity-*` is in use, so do not upgrade to Tailwind v4.
- Colour roles are fixed (see [DESIGN.md](DESIGN.md)): cyan = primary/goal, amber = achievement/CTA, violet = study/influence, emerald = done/S-tier, sky = exam, rose = error/behind/irrelevant.
- Numbers, D values, P, percentages, D-day, and system labels are `font-mono`.
- Icons: lucide only; import only what is used (`finish-check` flags unused imports).

## Every feature change also
- updates `demoState` so the demo reproduces the feature,
- keeps `tools/e2e` green (`npm run verify`) — add a step for new user-visible behaviour,
- ends with `npm run finish` clean and, if `src/` or data changed, `npm run docs:gen` + `npm run docs:check`.
