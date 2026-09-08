# Decision log
<!-- src: SPEC-0 --><!-- src: SPEC-13 -->

Dated product and engineering decisions, newest last. Rule numbers refer to [core-beliefs.md](core-beliefs.md). Korean originals of the pre-2026-09-08 documents are preserved at git tag `ko-docs-final`.

| Date | Decision | Ref |
|---|---|---|
| (undated, pre-v3) | Game effects (XP, levels, gold, criticals, bosses, story, dating-sim) abandoned completely, no backup; reintroduction would be a redesign. | Rule 7 |
| 2026-08 | Job-fit matrix evidence fixed: HRD Korea posting-usage statistics, MOEL 500-company survey, per-job hiring specs and recruiter surveys; evidence strength per cell (strong/medium/weak). | Rule 15 |
| 2026-08-29 | No AI: `askClaude`, goal coach, difficulty judgement, promotion quiz, study oral check removed; reintroduction requires explicit user approval. Custom certification D is manual (20–100); study uses a self-report mode. | Rule 7 |
| 2026-08-29 | Job-fit tier C (irrelevant) pays ×0 (research draft: 0.25). 개발/데이터·AI rows: 사무·회계 and 전문직 demoted to C; exceptions 변리사, 사회조사분석사 2급 = B. | Rule 15 |
| 2026-08-29 | Study verification tiers `STUDY_REQ` fixed: E 30 chars / D + 1 artifact / C 60 chars + 1 / B 100 chars + critique + 2. | Rule 16 |
| 2026-08-30 | Goal-first structure: tasks only from goals, `goalId` mandatory, area inherited, one-day size (general/activity ≤ C, study E/D), milestones exempt, legacy tasks in 미분류 can only be completed or deleted. | Rule 18 |
| 2026-08-30 | KR–task bridge: certification/exam milestones only by one-click from the KR; free browse mode removed; modes [일일 실행 · 학습]; `goalKinds` scoping; manual cert "done" button removed. | Rule 19 |
| 2026-08-30…09-01 | Schema v12: `metrics.risk` → `metrics.body` (appearance), reset to 15; body is self-assessment only. | Rules 8, 12 |
| 2026-09-01 | Master specification written by reverse-engineering the 3,338-line code and three docs. | — |
| 2026-09-02 | Design handoff applied: `PortraitSprite` v3, `TrophySvg` v2, five empty-state illustrations, per-screen style deltas; onboarding title copy chosen: "지금 위치를 숫자로 확인하세요. 평가는 시장 기준입니다." (game copy dropped). | DESIGN |
| 2026-09-03 | Vite scaffold + `store` shimmed to `localStorage` (call sites unchanged); single-file demo build. | [completed plan](../exec-plans/completed/2026-09-03-storage-shim-and-vite.md) |
| 2026-09-04 | CERTS V1.2: 30 health/medical qualifications added; 보건·의료 row S for its own category only; `certByTitle` longest-name matching; 전문의 not listed (D cap). | Rule 6, 15 |
| 2026-09-06 | CERTS V1.3: all 807 currently issued national qualifications added (1,011 total; three-lens estimation + adversarial verification; existing D unchanged). Categories 15, jobs 21, directions 18. The 150 new cross cells verified against mention rates → all C; 47 evidenced exceptions in `CERT_W_EXC`. Four renames applied; 2027/2028 renames deferred. Catalog cap 40 → 60. | [completed plan](../exec-plans/completed/2026-09-06-certs-v1.3.md) |
| 2026-09-07 | Dead-code cleanup, game residue removed (trophy kind boss → ach, schema v13), lookup indexes, onboarding list capped at 60 rows (DOM 4,121 → 318); useDeferredValue removed after measurement; E2E harness (`tools/e2e`) introduced and caught two regressions. | [completed plan](../exec-plans/completed/2026-09-07-rename-and-cleanup.md) |
| 2026-09-07 | Terminology rename: 실행 (task) · 영역 (area) · 인생 관리 · 보호권; identifiers, component names, file name (`LifeManager.jsx`), and docs updated; schema v14 (`quests→tasks`, `parts→areas`, `partId→areaId`, `v` normalisation); storage keys `liferpg-*` kept. | Rule 12 |
| 2026-09-07 | Evidence viewer (`EvidenceViewModal`), `ToastHost`, favicon/manifest icon; image keys cleaned on task delete and reset. | Rule 16 |
| 2026-09-08 | Harness-engineering layout: `AGENTS.md` routing, seven subagents, hooks (prompt-first, data-guard, lang-check, finish-check), `tools/harness`, English documentation; Korean originals retired after tag `ko-docs-final`. Prompt-first protocol and mandatory cleanup pass adopted. | [active plan](../exec-plans/completed/2026-09-08-harness-restructure.md) |
| 2026-09-08 | Code and E2E comments, step names and log strings translated to English (UI copy, data tables, selectors untouched; app code proven byte-identical outside comments). Language gate enabled in `finish.config.json`; `lang-check` allows Korean data vocabulary (cert/exam/job/category names from the tables) inside comments. | AGENTS.md §6 |
| 2026-09-08 | Master spec decomposed into `docs/product-specs/*` and `docs/design-docs/*`; chapters 8 and 10–13 folded into DESIGN, FRONTEND, QUALITY_SCORE, backlog and the tech-debt tracker. The four Korean source documents (product plan, kickoff procedure, master spec, design prompt) were deleted; they remain readable at git tag `ko-docs-final`. | [completed plan](../exec-plans/completed/2026-09-08-harness-restructure.md) |
| 2026-09-08 | English-first rule made explicit and enforceable: a task request produces its plan, prompt, summary and edits in English whatever language the request used; Korean stays only where AGENTS.md §6 requires it, quoted in backticks. `check-docs` now fails on Korean prose under `docs/exec-plans/`. | [completed plan](../exec-plans/completed/2026-09-08-english-plan-language.md) |
