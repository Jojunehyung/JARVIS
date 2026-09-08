# Tech-debt tracker
<!-- src: SPEC-11 -->

Severity: **S1** cannot run / data loss / wrong payout · **S2** behaviour contradicts a rule or doc, logic defect · **S3** doc residue, dead code, minor UX. Status: open · resolved (date, how) · accepted (allowlisted with reason). Allowlist entries in `tools/harness/finish-allowlist.json` must appear here.

## Open
| Id | Sev | Area | Issue | Note |
|---|---|---|---|---|
| TD-01 | S1 | goal engine | `krDoneCount` / `krProgress` (count) sum **every** task with the goal's `goalId`, including cert/exam/study `once` milestones → passing `전기기사` also advances `CATIA 30회` 2→3/30. Several count KRs on one goal share the same value (no per-KR link). | Needs a KR–task link key; migration block. |
| TD-02 | S2 | tasks | `TaskTab` orphan test only checks missing/deleted goal → tasks of a **done** goal appear in no section (cannot complete or delete). | |
| TD-03 | S2 | goals | `AddGoalModal` accepts start = target (instantly 100 %), count need ≤ 0, free-text cert names (bridge cannot match), past deadlines (instantly behind). Metric check-in blur on empty input stores `Number("") = 0`. | |
| TD-04 | S2 | dates | `ddayStr` off by one (today shows D-1, tomorrow D-DAY). `today` fixed at render; `dstr` local-time dependent. | |
| TD-05 | S2 | catalog | `CatalogModal` gain ignores job-fit weighting although the caption says otherwise. | |
| TD-06 | S2 | duplicates | Three different duplicate checks: `hasCertQ` (global partial match), `addTask` (exact), catalog owned (longest-name). `hasExamQ` is goal-scoped, so the same exam can be registered under two goals. | |
| TD-07 | S2 | payouts | A cert KR with tier C (×0) can still be registered (`+0P · 등록 ›`) and on completion logs "+0P" and a trophy. Re-taking an exam at a lower band pays 0 but still logs "+0P", a trophy, and `metricsGain(band.d)`. Policy decision needed. | Rule 1/2 |
| TD-08 | S2 | goals | Cert KR auto-done scans all goals (ignores `goalId`); `applyMeasures` matches only the first KR per label with partial `includes`. Goal completion leaves no trophy/log; `removeGoal` does not clear `tasks[].goalId`. | |
| TD-09 | S2 | activity | Meeting follow-up tasks are spawned immediately (survive a cancelled modal), once only. `StudyVerifyModal` truncates insight (40) / critique (30) and does not keep the summary body. | Rule 16/17 |
| TD-10 | S2 | evidence | `resizeImage` 256 × 320 cover crop is applied to certificates/score reports → landscape documents become unreadable in the viewer. | Keep aspect for evidence. |
| TD-11 | S2 | role model | No way to clear a role model (back to `null`); saving with every area excluded gives `roleGap = null` but the button still says `롤모델 수정`. | |
| TD-12 | S2 | feedback | No overlay queue (consecutive effects are lost); `Overlay` effect depends on a new `onClose` each render (timer reset). Toasts overwrite each other. `gradeup` overlay ignores the uploaded photo. `TrophySvg` rank/spec ignore tier. | |
| TD-13 | S2 | onboarding | Re-selecting exams changes registration order → the dim decay lock lands on the last edited exam; language spec saved without the language area; `OptRow`/`Swatch` defined inside `Onboarding` (remount); no way back to the title from step 0; no feedback when `toggleDir` exceeds 3. | |
| TD-14 | S2 | streak | Completing the same daily task twice on one day is ignored silently. `applyDailyTick` handles only the monthly shield reset; during a gap the header 🔥 keeps the old value until the next completion. | naming vs behaviour |
| TD-15 | S2 | rule 2 | `exams.dim` is locked at completion (onboarding: at registration) while the rule says "first registration"; specialisation forms at D ≥ 75 but the floor applies from D ≥ 70; decay on upgrade deltas undocumented. | Clarify in scoring-engine.md |
| TD-16 | S2 | rule 4 | `ver` exists only on `exams.best`, not on `achievements`/`trophies`. | |
| TD-17 | S2 | rule 8 | Promotion (+3 influence) and goal completion (+4 influence, +2 asset) use fixed increments, not `metricsGain` (D/10). Documented here, not in the rule. | |
| TD-18 | S2 | rule 17 | Reading/meeting daily tasks ask for the log every time `evidence` is empty instead of one-tap after the first log. | |
| TD-19 | S3 | copy | `PromoteModal` `스스로에게 정직하게. 여기서의 상향은 결국 나를 속이는 일이에요.` is emotional copy (Rule 13 borderline); growth tab `…보정할 수 있어요.` | |
| TD-20 | S3 | data | `TASK_TEMPLATES` `업무 회고 작성` has `kind ""` and is filtered out everywhere; `CERTS.st` is informational only; `state.lastTick`/`dModel` written but never read; `EvidenceModal` `📎 사진 첨부` branch unreachable. | Allowlist candidates if `finish` flags them. |
| TD-21 | S3 | job fit | PMP/CISA/CISSP/CCSP sit in `클라우드·글로벌IT` → C for `기획·PM`; `한국사·물류관리사·유통관리사·직업상담사` judged on the `사무·회계` axis. Intersection ties pick the first `dir`. Areas without `지식` in the name and no `dir` get no recommendations. | Rule 6/15 review |
| TD-22 | S3 | data | D distribution skew in the original 174 (46 % between 50–69); `CAREER_OPTS`/`OUTPUT_OPTS` duplicate g values; `LEAD_OPTS.g` unused; onboarding-held non-sg certs can be re-earned later as milestones (onboarding pays no P, so impact is limited). | |
| TD-23 | S3 | scenario | Planning text "12→15 %" vs computed 3→5 %; `일일 D 프리필` vs code E; `실무자→중급` — no `중급` rank (`숙련자`); certificate completion does not recompute role proximity (only area grades do). | Kept as computed; see scenario spec |
| TD-24 | S3 | harness | E2E selectors are Korean UI strings — any copy change must update `tools/e2e` in the same plan. | By design; recorded |

| TD-25 | S2 | feedback | The RANK UP overlay always draws `PortraitSprite`, ignoring an uploaded profile photo; `TrophySvg` ignores `tier` for the `rank` and `spec` kinds, so the tier passed on goal completion has no effect. | |
| TD-26 | S2 | reset / input | `resetAll` runs without a confirmation dialog; after re-onboarding the component-level `imgs.profile` survives; an emptied metric check-in field stores `Number("") = 0` on blur. | |
| TD-27 | S3 | display | Multiplier prints as `×1` while the smoke text says `×1.0`; goal progress shows a truncated 10 % (10.5 mathematically); the completion toast drops 🔥 when it carries deltas; plain B/A task trophies use `legacyCertGrade(pts)` and land one tier low (B→C, A→B); `DiffBadge`/`CertBadge` emit `className "undefined"` for an unknown key and differ in their E tone (zinc-300 vs zinc-400); `MetricsModal` renders `value undefined` when an old state key is missing; `AddTaskModal` falls back to `areas[0]` when the goal is undefined. | |
| TD-28 | S3 | doc drift | The "one step below the requirement" proximity figure is quoted as ≈ 70 % in the docs and 60–70 % in the code comment, while the actual value ranges 44–77 % by requirement; `profile` stores fields the schema does not list (`majorName`, `examsOwned`, `certs`, `career`, `lead`, `biz`, `output`), `roleModel` is unused, and `demoState.edu` `"univ4"` is not an `EDU_OPTS` key; the `CERTS` header comments still describe the retired per-item score `s` and the pre-D grade letters. | |
| TD-29 | S3 | unreachable | Recorded so a refactor does not reintroduce them: `RoleAdviceModal` has no guard for `rg === null` (the button only appears when `state.role && rg`), no bound check on `RANKS[have + 1]` (requirements cap at 8, gaps filter `gap > 0`), and recommends the next exam band without the gain filter certifications use (payout is always ≥ 1 because of the 0.3 decay floor); `goalStatus` would re-apply +4 influence / +2 asset on a done → active → done toggle, but no UI restores an achieved goal. `areaCatHints` returns no category for a custom area with no direction, and `jobWeightForCert` breaks a tier tie by direction order (documented in [../design-docs/job-weighting.md](../design-docs/job-weighting.md)). | |

## Resolved
| Id | Sev | Issue | Resolved |
|---|---|---|---|
| R-01 | S1 | `window.storage` fallback lost state on reload | 2026-09-03 — `store` → `localStorage` adapter |
| R-02 | S1 | No Vite scaffold | 2026-09-03 |
| R-03 | S1 | Saves without `v` skipped every migration block | 2026-09-07 — `v` normalised to 0 at entry |
| R-04 | S1 | `completeTask` exam branch crashed on unknown `famId`; `needsEvidence` on unknown diff | 2026-09-07 — `examOf` lookup + guards (covered by E2E) |
| R-05 | S2 | Catalog `취득 완료` never showed (exact-title match vs `…취득`) | 2026-09-07 — `certByTitle` reverse lookup |
| R-06 | S2 | Catalog list cap not shown | 2026-09-06 — cap 60 + `N종 더 있음` |
| R-07 | S2 | Evidence/study photos were write-only; image keys leaked on delete/reset | 2026-09-07 — `EvidenceViewModal`; keys removed in `removeTask`/`resetAll` |
| R-08 | S2 | Onboarding qualification list mounted all 1,011 rows | 2026-09-07 — 60-row cap, selected first |
| R-09 | S3 | Dead constants/imports/CSS/props (`DIFF_ORDER`, `certGrade`, `CLASS_NOUN`, `FRIEND_LOOK`, `MENTOR_LOOK`, `EXAM_CATS`, `DIFF_TEXT`, 11 icons, `.plumbob`, `Shell game`, `certKrDone`, `AddGoalModal exams`, `roleMatch`) | 2026-09-07 — removed; `finish-check` guards |
| R-10 | S3 | Game residue (`kind: "boss"`, `BOSS_COLORS`, 🎲, `플레이어`, "CHARACTER CREATION", "▶", `캐릭터`, `퀘스트/파트/상태창/실드`) | 2026-09-07 — schema v13/v14, terminology rename |
| R-11 | S2 | Docs claimed `askClaude`/`QuizModal`/`coachApply` existed | 2026-09-07 — removed from CLAUDE.md §4 / Rule 11; now `check-docs` + symbol index |
| R-12 | S3 | Favicon 404 | 2026-09-07 — data-URI favicon + manifest icon |

## Allowlist mirror (`tools/harness/finish-allowlist.json`)
_None yet._
