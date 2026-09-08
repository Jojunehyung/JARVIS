# Dead-code cleanup, game residue removal, terminology rename, E2E harness
- Status: completed
- Date: 2026-09-07
- Agents: (pre-harness) main agent + review workflow with adversarial verification

## Goal
User request: remove every game/arcade element, verify dead code with an end-to-end run before removing it, optimise — then (after a follow-up decision) rename the remaining game vocabulary in code and UI.

## What was done
- **E2E harness** (`tools/e2e`, puppeteer-core on the installed Chrome): full scenario with outcome assertions; it caught two regressions during the work (`LinkIcon` removed while in use; `RoleAdviceModal`'s `rg` deleted by a first-match replace).
- **Dead code**: 7 unused constants, 11 unused icons, orphan section comments, dead CSS (`.plumbob`, `.anim-shake`), `Shell game` prop, `certKrDone` wiring, unused `exams`/`roleMatch` props, duplicate `roleGap` computation.
- **Game residue**: trophy `kind: "boss"` → `"ach"` (schema v13 migration), `BOSS_COLORS` → `TIER_COLORS`, 🎲/`플레이어`/"CHARACTER CREATION"/"▶"/`캐릭터` copy replaced.
- **Bugs fixed on the way**: saves without `v` skipped all migrations; catalog `취득 완료` never matched; image keys leaked on task delete.
- **Performance**: lookup indexes (`CERT_BY_NAME`, `CERTS_LONGEST_FIRST`, `CERT_NAME_LC`, `CERTS_BY_CAT`, `EXAM_BY_ID`), `certByTitle` cache, `useMemo` on list filters, onboarding qualification list capped at 60 rows (DOM 4,121 → 318 nodes; keystroke median 204 → 143 ms at 4× CPU throttle). Interleaved A/B measurement showed tab switching and catalog open within ±10 % noise — earlier single-run "improvements" were retracted; `useDeferredValue` removed.
- **Terminology rename** (user decision `코드까지 전면 개명`): `퀘스트` → `실행` (task), `파트` → `영역` (area), `인생 상태창` → `인생 관리`, `실드` → `보호권`; identifiers, component names, `LifeRPG.jsx` → `LifeManager.jsx`, docs; schema v14 (`quests→tasks`, `parts→areas`, `partId→areaId`); storage keys unchanged.
- **Remaining items delivered**: evidence viewer (`EvidenceViewModal`), `ToastHost`, favicon + manifest icon (data URI, included in the single-file demo), image-key cleanup on reset.

## Verification
E2E 68 steps green (0 console errors), coverage ≈ 80 %; `vite build`; single-file demo opened from `file://` (schema v14); engine smoke.
