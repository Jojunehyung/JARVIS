# One `롤모델` screen — story first, a storyline timeline with `지금 할 것` buttons, the grade gaps folded away, the manual editor behind `세부 수정 ›` (schema stays v28)

- Status: completed
- Date: 2026-09-18
- Needs approval: yes — one item only: the footer button `롤모델 초기화` **deletes the `role` record** (name, targets, stages, story, verdicts, seen-stamp) behind `window.confirm("롤모델·단계·판정 기록을 모두 지워요. 계속할까요?")`; the user approved the redesign, but a handler that deletes user data is flagged by AGENTS.md §4 regardless — the caller states this once and the implementer does not ask again. **No `migrate` block, no `v` bump, no `CERTS` / `EXAMS` / `WEIGHT_MATRIX` / `CERT_W_EXC` row, no `liferpg-*` key, no `store` call site.** Nothing else deletes or rewrites user data; the `roleEdit` sub-screen writes exactly what `RoleModelModal` writes today.
- Agents: planner → implementer (Phase 1: code + E2E) → cleanup → docs-syncer (Phase 2). The verifier's E2E run is **not** part of this plan (standing user instruction: the suite is written, parsed with `node --check`, never executed).

## Goal

Today the role model is reached through two sheets that grew by accretion: `RoleModelModal` (`롤모델 설정` — presets, name, story, per-area requirement chips, the stage editor) and `RoleAdviceModal` (`방향 제안` — proximity bars, the stage block, the verdict history, gap recommendations). The user opens one and sees every control ever added. This plan replaces both user-facing surfaces with **one screen, `롤모델`** (`modal.type: "role"`), read top to bottom as a story: (1) `원하는 모습` — three template chips, the story textarea, `저장`, and the one CTA `AI에게 판정 묻기 ›` with the newest verdict card beneath it; (2) `스토리라인` — a vertical timeline of the stages, done ones compact, the current one expanded with a `지금 할 것` button per unmet condition that lands on the exact place that changes it, plus the undone work items linked to this stage's milestones; (3) `영역 등급` — everything the advice sheet shows for grade gaps today, unchanged in content, collapsed by default. The manual controls move behind `세부 수정 ›` into a sub-screen (`modal.type: "roleEdit"`), and preset chips are removed. No number changes: `roleGap`, `stageProgressOf`, `roleStageOf`, `roleRecommendations`, the packets and the briefing text stay byte-identical; the reader and briefing only change the action type they route to.

## Context — what the user asked (translated, recorded in substance)

"When I open the role model now, the features I set before are all still there. I want a complete overhaul — maximise ease of use, and let me follow the storyline I want."

## Decisions the user made today (final — record, do not reopen)

1. **One screen `롤모델`** (`modal.type: "role"`), opened from the profile card's headline and proximity lines, from the settings `롤모델` button, from the reader's `롤모델 판정` section, and from the briefing's `다음 단계` line. `RoleAdviceModal`'s and `RoleModelModal`'s current user-facing roles end; `modal.type: "roleAdvice"` is retired. (The `단계 완료` overlay has no follow-up action — it auto-closes and a tap closes it — so nothing there changes.)
2. **Manual settings** (name, per-area requirement chips, the stage/condition editor) move behind `세부 수정 ›` into `modal.type: "roleEdit"` — the old editor minus presets and minus the story field. Preset chips are removed entirely (see default 1 for what happens to `ROLE_PRESETS` and the nine-stage seed; `ROLE_STAGE_SEED` stays).
3. **`지금 할 것`** inside the current stage: one button per unmet condition to the place that changes it, then the undone work items linked to this stage's milestones, each opening its work sheet.
4. **Story templates**: three tap-to-fill chips above the story field — `취업`, `창업`, `전문가` — with the exact template texts in Phase 1 item 3.

## Defaults the planner set (stated so the user can change them; none is open for the implementer)

1. **`ROLE_PRESETS` is removed.** Its only readers are `RoleModelModal`'s chip row (deleted by decision 2) and the name list in `tools/harness/gen-cert-stats.js` (line 73, which lifts option lists into `docs/generated/onboarding-tables.md`); nothing in the engine, the smoke harness, `data-guard`, `finish-check` or `demoState` reads it. Remove the constant, the `ROLE_STAGE_PRESET` literal beside `stageDraft`, and the `"ROLE_PRESETS"` entry of that harness list (the generated table regenerates without the section). **The nine-stage seed stays reachable**: `ROLE_STAGE_SEED` is still read by `demoState` and is the one offline way to a full ladder without an AI reply, so the `roleEdit` sub-screen gets a single button `기본 9단계 채우기` in the stages section (same confirm as the preset had, `단계를 기본 9단계로 바꿔요. 계속할까요?`, asked only when stages already exist). It no longer sets the role name.
2. **Template insertion rule**: a chip inserts its template when the trimmed story is empty; otherwise it appends `"\n\n" + template` (no confirm, no replacement — the user's text is never overwritten); the result is clipped to `ROLE_STORY_MAX`. The chips never write state — only `저장` does.
3. **`modal.type` count stays 39**: `roleAdvice` leaves, `roleEdit` arrives. The new screen component is `RoleModal`; the existing `RoleModelModal` becomes the `roleEdit` sub-screen (component name kept, title `롤모델 세부 수정`); `RoleAdviceModal` is deleted and its grade-gap JSX moves verbatim into a module-level `RoleGradeSection` rendered by `RoleModal` (section 3). `RoleStageLines` stays, used only by the `사업` gap block inside `RoleGradeSection`.
4. **Story-only save**: `저장` in section 1 calls a new root handler `saveRoleStory(story)` that writes `role.story` and nothing else (creates `{ name: "롤모델", targets: {}, story }` when `role` is null; deletes the key when the trimmed text is empty). It never touches `stages`, `targets`, `verdicts` or `seenStageK`.
5. **Every role write returns to the screen, not to nothing**: `saveRole` (the sub-screen's save), `importRoleVerdict` and `RoleVerdictModal`'s close all `setModal({ type: "role" })` instead of `setModal(null)`, so the user lands back on the story with the new verdict card or the edited timeline. `resetRole` closes everything (`setModal(null)`).
6. **A met date is never derived or stored** ([Rule 9](../../design-docs/core-beliefs.md#rule-9)): a done stage reads `충족`, nothing more. Section collapse state (`영역 등급`, `판정 기록`, an upcoming stage's peek) is component `useState`, never written to `state`.
7. **`cert_held` lands on the catalogue search for that name**: `CatalogModal` gains an optional `initialQuery` prop (seeds its `q` state); the root passes `{ type: "catalog", cat: certByTitle(arg)?.c || null, q: arg }`. It cannot create the certification task — that path is the goal's KR ([Rule 19](../../design-docs/core-beliefs.md#rule-19)); a tech-debt row records the gap.
8. **`payment_paid` lands on the deal list** (`biz` tab, `deals` view, no add modal): payments are ticked on a deal card, and a new contract does not change the count. `deals_won` / `deals_active` / `monthly_revenue` open the add modal on top of the deals view.
9. **The profile card's third state**: when `state.role` exists but `roleGap` is null (a story saved with no requirement grades — now a normal state, since the story is saved first), the inert `<p>` becomes a button `근접도 계산 대상 없음 — 세부 수정에서 요구 등급을 정해요 ›` opening `role`. Without any `role` the `<p>` `롤모델 미설정 — 근접도 계산 대상 없음` stays as today (`flow.js:261` asserts a `P`).
10. **The demo is not re-linked**: the demo's current stage is 1, whose milestone is done and links no work, so the demo's `이 단계의 업무` reads its empty line; the E2E plants a stage-2 milestone with a linked work item on the main save instead. Re-linking the demo's milestones would move the reader's and roadmap's `업무 0/1` lines that `flow.js` asserts.
11. **Settings copy unchanged**: the button still reads `롤모델 수정` / `롤모델 설정` and the caption stays; only the target changes (it already opens `role`).
12. **The journey figure** now prints in the timeline's journey line and, when a `사업` grade gap exists, once more inside that gap's `RoleStageLines` — the "printed once" statement in `metrics-and-role-model.md` becomes "printed on the `롤모델` screen only, never on the CV" (Phase 2).

## Context read

- `AGENTS.md` §3, §4, §6, §7; `docs/PLANS.md`; `docs/design-docs/core-beliefs.md` rules [7](../../design-docs/core-beliefs.md#rule-7), [9](../../design-docs/core-beliefs.md#rule-9), [10](../../design-docs/core-beliefs.md#rule-10), [11](../../design-docs/core-beliefs.md#rule-11), [13](../../design-docs/core-beliefs.md#rule-13), [14](../../design-docs/core-beliefs.md#rule-14); `ARCHITECTURE.md` (Tabs, Modals, App root rows, the status paragraph, glossary); `docs/FRONTEND.md`; `docs/design-docs/metrics-and-role-model.md`, `assistant-bridge.md` (the fifth packet); `docs/product-specs/home.md`, `growth.md`, `feedback-overlays.md`, `daily-reader.md`, `daily-briefing.md`; `docs/DESIGN.md` (A3, A6, A10, A15, A16); `docs/design-docs/information-architecture.md` (`modal.type` list); the completed `docs/exec-plans/completed/2026-09-18-role-model-story-verdict.md` (shape and progress notes followed). Working tree clean at `a1a400c`, schema v28, **250** `await step(` calls (`flow.js` 38, `flow2.js` 16, `flow3.js` 20, `flow4.js` 23, `flow5.js` 19, `flow6.js` 6, `flow7.js` 27, `flow8.js` 28, `flow9.js` 10, `flow10.js` 32, `flow11.js` 31), `modal.type` count 39, last tech-debt row TD-85, `src/LifeManager.jsx` 11,983 lines.
- Code (grepped, line numbers at `a1a400c`): `ROLE_PRESETS` 1094 (+ `tools/harness/gen-cert-stats.js:73`); `roleGap` 2050; `COND_TYPES` 2526, `ROLE_STAGE_SEED` 2538, `seedStages` 2549, `condValue`, `condText` 2582, `roleStageOf` 2590, `quitText`, `stageLine` 2607; `lastVerdictOf` 2623, `probText` 2624, `condRatio` 2626, `stageProgressOf` 2631, `roleVerdictDue` 2644, `roleRecommendations` 2653; `milestoneOrder` 2412, `milestoneWork` 2420, `milestoneLine` 2453; `TAB_ACTIONS` 2874 and its comment 2872–2873 (names `roleAdvice`); `buildBriefing`'s `next` item 3048–3060 (two `{ type: "roleAdvice" }`); `buildReader`'s `role` section 3228 (`state.role ? { type: "roleAdvice" } : { type: "role" }`); `demoState` `s.role` 4702; `HomeTab` 5320 (`onRoleAdvice` at 5388 and 5403, the inert `<p>` at 5411); `BriefingModal` 5815 / `DailyReaderModal` 5860 (`onAction` → `closeBriefing`, which opens any non-tab type as `setModal({ type })`); `CatalogModal` 6141 (`initialCat`, `q` state); `RoleStageLines` 6224; `RoleAdviceModal` 6257–6404; `SettingsModal` 7162 (`onRoleModel` 7178); `stageDraft` 7314, `ROLE_STAGE_PRESET` 7315, `RoleModelModal` 7317–7445; `BIZ_ADD_LABEL` / `BIZ_ADD_MODAL` 7928–7930; `BizTab` 8277 (views `deals` / `rates` / `folio` / `roadmap` / `leads` / `notices`); `workOn` 9860; `WorkModal` 10078 (root: `{ type: "work", workId }` 11921); `RoleVerdictModal` 10349; `Overlay` 10445 (`stage` branch 10493 — no action); root: `saveRole` 10946, `importRoleVerdict` 10964, `setBizView` 11076, `closeBriefing` 11531, `setAreaDir` 11612, `HomeTab` props 11735, `BizTab` props 11783–11785, the `role` / `catalog` / `roleAdvice` / `roleVerdict` / `work` / `settings` modal entries 11820–11972.
- E2E surfaces touched (grepped): `flow.js:273` (`the settings button holds role model, backup and reset` — `clickInModal("롤모델")` then expects `요구 등급`), `flow.js:320` (`the no-role briefing line opens the role model form` — expects `요구 등급`), `flow.js:415–433` (demo sweep: the headline tap expects `확률 20% → 30%`, `단계 1 → 1`, `진행 50% · 전체 6%`); `flow2.js:136` (`save role model settings` — settings → `롤모델` → first `input` → grade chips → `저장`); `flow3.js:161` (`the proximity line opens direction advice with the squared bars` — expects `방향 제안 —`, `/ 요구`, `칸 하나 = 등급 한 단계`, `div.flex.h-2`, `도감에서 더 보기`), `flow3.js:228` (the stage step — the headline tap expects `방향 제안 —`, `1/3단계 · E2E 첫 계약`, `- 계약 체결 수 'E2E단계고객' 0/1`, `로드맵 열기 ›`), `flow3.js:266` (`the medical-AI preset seeds nine editable stages…` — `openEditor` = settings → `롤모델 수정`; taps `의료 AI 솔루션 대표`; first `input` = the name), `flow3.js:343` (`openVerdictSheet` — headline tap → `AI에게 판정 묻기 ›`), `flow3.js:395` (the reply step — after `선택한 항목 저장` it `closeModal()`s), `flow3.js:536–540` (the reader step — `롤모델 판정 열기` expects `방향 제안 —`); `flow5.js:94` (`READER_SECTIONS` — unchanged); `tools/e2e/README.md`.
- Rules touched, by number: [7](../../design-docs/core-beliefs.md#rule-7) — no new AI touchpoint and no mechanic: "story" here is the user's own text and a timeline is a reading of derived facts (no chapter, quest, reward or narration copy); the templates are static strings the user edits; the verdict CTA opens the existing sheet. [9](../../design-docs/core-beliefs.md#rule-9) — the timeline, the `지금 할 것` list, the linked work items, the collapse states and the `충족` mark are all derived at render or held in component state; no met date, no "current stage", no progress is written. [10](../../design-docs/core-beliefs.md#rule-10) / [11](../../design-docs/core-beliefs.md#rule-11) hold by construction — a `지금 할 것` button navigates (tab, view, add modal, catalogue, work sheet) and completes, submits, pays or promotes nothing; the only writes any new handler makes are `role.story` (`saveRoleStory`), `role = null` (`resetRole`) and `ui.bizView` (through the existing `setBizView`). [13](../../design-docs/core-beliefs.md#rule-13) — every label names a place or a fact (`계약 추가 ›`, `충족`, `진행 {pct}%`, `연결된 업무 없음 — …`); the verdict stays verbatim under `AI 판단 · 검증되지 않음`; no encouraging copy anywhere, and the empty states state what is missing. [14](../../design-docs/core-beliefs.md#rule-14) — `roleGap` byte-identical; the proximity bars, legend and gap blocks move as-is; the stage figures remain a second number never merged with it. Rule [12](../../design-docs/core-beliefs.md#rule-12): no schema change. Rules 1–6, 8, 15–19: untouched (no payout, D value, matrix row, evidence tier, activity kind or task path changes; the catalogue landing creates no task).

## Prompt

You are the implementer for Life Manager (`src/LifeManager.jsx`, Vite + React 18, Tailwind v3 core utilities only). Execute Phase 1 of this plan, then run the gates and stop for the cleanup pass; Phase 2 is the docs-syncer's. Today is 2026-09-18; the schema is v28 and **stays v28** (no `@schema` change, no `migrate` block, no `v` bump, `flow4.js` untouched); the working tree is clean at `a1a400c`.

**Standing constraints.**
- Rules by number: [7](../../design-docs/core-beliefs.md#rule-7), [9](../../design-docs/core-beliefs.md#rule-9), [10](../../design-docs/core-beliefs.md#rule-10), [11](../../design-docs/core-beliefs.md#rule-11), [13](../../design-docs/core-beliefs.md#rule-13), [14](../../design-docs/core-beliefs.md#rule-14). Never touch a `store` call site, `CERTS` / `EXAMS` / `WEIGHT_MATRIX` / `CERT_W_EXC` / `DIR_ALIAS` / `DIR_CATS`, any `migrate` block, `freshState`, a `liferpg-*` key, `roleGap`, `roleRecommendations`, `condValue`, `condText`, `condRatio`, `roleStageOf`, `stageProgressOf`, `roleVerdictDue`, `lastVerdictOf`, `probText`, `quitText`, `stageLine`, `ROLE_STAGE_SEED`, `seedStages`, `COND_TYPES`, `certByTitle`, `heldCertsOf`, `buildRoleVerdictPacket`, `parseRoleVerdictReply`, any other packet builder or parser, `RoleVerdictModal`'s three steps, the `Overlay` component, the root stage-overlay effect, `demoState`. `buildBriefing` and `buildReader` change **only** in the action objects named in item 8 — their text is byte-identical. Nothing you add may pay P, create a trophy, change `areas[].grade`, or touch `act`, `tasks`, `goals`, `room`, `exams`, `certBest`, `deals`, `folio`, `milestones`, `leads`, `notices`, `work`, `journal`, `profile`. The keys any new handler writes: `role` (`saveRoleStory`, `resetRole`) and `ui.bizView` (via the existing `setBizView`) — nothing else.
- Language: English identifiers, comments, E2E step names and log strings; Korean only in UI copy (`해요체`), E2E selector/assert arguments matching UI copy, and regexes matching UI copy. Comments may name data rows in Korean; nothing else Korean in a comment.
- UI: the seven-tab `NAV` is unchanged; every new chip or button fits one line at 390 px (`getBoundingClientRect().height` ≤ 32 px, except the two-line CTA card and the timeline nodes which are stacked by design); numbers, dates, counts and percentages `font-mono`; rose for unmet, emerald for met, cyan for primary / the current stage / the stage bar, zinc for the AI-stated label and upcoming stages; no arbitrary Tailwind values; lucide icons from the existing import line only (`X`, `Check` cover this plan — add nothing). Long stage names `truncate` on a node's title row.
- State: clone-updater pattern; derived values in render or `useMemo`; toasts via `showToast`; `modal.type` count stays **39** (`roleAdvice` retired, `roleEdit` added). Collapse / peek states are component `useState` only.
- Copy is quoted verbatim below; use it exactly. Refusals and toasts end in `요.` / `요` as the neighbouring ones do. Facts and places only — no encouraging copy.
- Keep every new top-level constant a plain literal and every new pure helper a top-level `const` (`tools/harness/smoke-logic.js` lifts by name); `ROLE_COND_ACTIONS` and `ROLE_STORY_TEMPLATES` are literals.
- E2E: write steps to the conventions of `flow3.js` (helpers `h.reload`, `h.overlayText`, `h.setValue`, `h.openSettings`, `clickInModal`, `clickInModalExact`, `clickText`, `clickTab`, `expectText`, `closeModal`, `modalError`, `readState`, `patchSave`, `dstrIn`; `window.confirm = () => true` before a confirmed action; a `finally` that restores every plant), parse with `node --check`, **never run** `npm run verify`, `node tools/e2e/run.js` or `node tools/harness/verify.js`. Extend each file's closing cleanup for new plants (`role`, `milestones`, `work`, `deals`, `folio`, `leads`, `notices`, `profile.certs`).
- Gates: `npm run build` · `npm run finish` (exit 0) · `npm run lang:check` · `npm run smoke` · `npm run docs:gen && npm run docs:check` (the symbol index and `onboarding-tables.md` regenerate; `db-schema.md` must be unchanged at v28 / 18 blocks) · `node --check` on each edited `tools/e2e/*.js`.
- Throwaway checks go in the session scratchpad, never in the repo: `npm run build:demo` → `release/life-demo.html`, opened over `file://` in the Chrome `launchBrowser()` from `tools/harness/lib/source` launches, `page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 })`, `데모 데이터로 둘러보기`, plants through `localStorage.setItem("liferpg-state-v1", …)` + reload. **Before editing, capture five baselines** from the demo save to the scratchpad: the daily packet, the work packet, the review packet, the briefing text (as the previous plan did — 2,408 / 2,650 / 1,945 / 837 chars), and a **numbers baseline** — a node script that lifts `roleGap`, `roleStageOf`, `stageProgressOf`, `roleVerdictDue`, `roleRecommendations` (with their dependencies) from `git show HEAD:src/LifeManager.jsx` and prints `JSON.stringify` of each on (a) the demo save, (b) the demo save with `role.stages` replaced by the three-stage E2E fixture of `flow3.js:233`, (c) the demo save with `role = null`. Acceptance compares all five against the working tree: **byte-identical**.
- **Mutation checks** (throwaway, on the built bundle, each reverted): listed under Acceptance.

### Phase 1 — the screen, the sub-screen, the wiring, the E2E

**Goal.** One `롤모델` screen replaces the two sheets; every entry lands on it; the manual editor is one link away; the E2E describes it.

**Files.** `src/LifeManager.jsx`; `tools/harness/gen-cert-stats.js` (one name removed from a list); `tools/e2e/flow.js`, `flow2.js`, `flow3.js`, `tools/e2e/README.md`.

**1. Removals.** Delete `ROLE_PRESETS` (line 1094) and `ROLE_STAGE_PRESET` (7315); remove `"ROLE_PRESETS"` from the `names` array at `tools/harness/gen-cert-stats.js:73`. Delete `RoleAdviceModal` whole (its JSX moves in item 5). Remove the `roleAdvice` modal entry at the root and the word from the `TAB_ACTIONS` comment (2872–2873: `…the modal of that name, which the root must render: \`bridge\`, \`journal\`, \`review\` and \`role\`.`). After this phase `grep -n roleAdvice src/ tools/` returns nothing.

**2. Vocabulary** (Role stages block, after `roleVerdictDue`, under a banner `/* ── The role screen (2026-09-18): story templates and the place each condition is changed ── */`):
```js
// Tap-to-fill story templates: static text the user edits; a chip never writes state (only 저장 does).
const ROLE_STORY_TEMPLATES = [
  ["취업", "[회사] [직무]로 [시기]까지 입사하고 싶어요. 지금은 [현재 상황]이에요."],
  ["창업", "[시기]까지 [분야] 회사를 세워 [규모] 규모의 대표가 되고 싶어요. 지금은 [현재 상황]이에요."],
  ["전문가", "[분야]에서 [수준]의 전문가로 인정받고 싶어요 — [기준, 예: 연봉·직급·자격]. 지금은 [현재 상황]이에요."],
];
// The one place that changes each condition type: a business view (and the add modal that opens over it) or the
// certificate catalogue. Navigation only — nothing here completes, pays or promotes (rules 10, 11).
const ROLE_COND_ACTIONS = {
  deals_won:       { label: "계약 추가 ›",       view: "deals",    modal: "deals" },
  deals_active:    { label: "계약 추가 ›",       view: "deals",    modal: "deals" },
  monthly_revenue: { label: "계약 추가 ›",       view: "deals",    modal: "deals" },
  payment_paid:    { label: "계약 목록 ›",       view: "deals" },
  folio_match:     { label: "포트폴리오 추가 ›", view: "folio",    modal: "folio" },
  milestone_done:  { label: "로드맵 열기 ›",     view: "roadmap" },
  leads_stage:     { label: "리드 추가 ›",       view: "leads",    modal: "lead" },
  notice_status:   { label: "공고 추가 ›",       view: "notices",  modal: "notice" },
  cert_held:       { label: "도감에서 찾기 ›",   catalog: true },
};
// The story after a template tap: inserted when the story is empty, appended after a blank line otherwise; clipped.
const storyWithTemplate = (story, tpl) => (story.trim() ? `${story}\n\n${tpl}` : tpl).slice(0, ROLE_STORY_MAX);
// Undone work items linked to the milestones of stage `k`, in `workOn`'s carried-first order (derived at render, rule 9).
const stageWorkOf = (state, today, k) => {
  const ids = new Set((state.milestones || []).filter((m) => m.stage === k).flatMap((m) => m.workIds || []));
  return workOn(state, today, today).filter((w) => !w.done && ids.has(w.id));
};
```
`storyWithTemplate` and `stageWorkOf` are pure; `workOn` is declared later in the file (work region) — a `const` arrow referencing it at call time is fine, but if `smoke-logic.js`'s lifter needs it, place `stageWorkOf` after `workOn` in the work region instead and say so in the progress note.

**3. `RoleModal({ state, today, onClose, onSaveStory, onAskVerdict, onEdit, onReset, onGo, onOpenWork, onOpenCatalog, onSetDir })`** — a new component beside the old `RoleModelModal`; `modal.type: "role"`; title `롤모델`. Local state: `story` (initial `state.role?.story || ""`), `savedStory` (same, to disable `저장` when unchanged), `showHistory` (false), `showGrades` (false), `peek` (a `Set` of stage indexes). Layout, top to bottom:

- **Section 1 — `SectionLabel` `원하는 모습`.**
  - The template row: `ROLE_STORY_TEMPLATES.map(([label, tpl]) => <Chip on={false} onClick={() => setStory((s) => storyWithTemplate(s, tpl))}>{label}</Chip>)` inside `flex gap-1.5 mb-2`, preceded by a caption `text-xs text-zinc-600 mb-1`: `탭하면 틀이 들어가요 — 괄호를 내 상황으로 바꿔요.`
  - The textarea exactly as `RoleModelModal` renders it today (`aria-label="원하는 모습"`, `rows={5}`, `maxLength={ROLE_STORY_MAX}`, the same placeholder and classes), the mono counter `{story.length} / {ROLE_STORY_MAX}`, the caption `여기 적은 글은 그대로 AI 패킷에 실려요 — 이름·연락처는 적지 않아요.`
  - `저장` — `px-3 py-1.5 rounded-lg border border-zinc-700 text-xs font-bold text-zinc-200 disabled:opacity-30`, `disabled={story.trim() === savedStory.trim()}`, `onClick={() => { onSaveStory(story.trim()); setSavedStory(story.trim()); }}`.
  - The CTA: `<button onClick={onAskVerdict} disabled={!state.role?.story} className="w-full py-3 rounded-xl bg-cyan-500 text-zinc-950 font-black text-sm mt-3 disabled:opacity-30">{last ? "다시 판정 ›" : "AI에게 판정 묻기 ›"}</button>` where `last = lastVerdictOf(state)`; when disabled, the caption `text-xs text-zinc-600 mt-1`: `먼저 원하는 모습을 적고 저장해요 — 적은 글이 패킷에 실려요.` (the CTA reads the **saved** story, so an unsaved edit does not enable it).
  - The newest verdict card (`bg-zinc-950 rounded-xl p-3 mt-3 space-y-1`, when `last`): `AI 판단 · 검증되지 않음 · {last.date}` (`text-xs font-mono text-zinc-500`), `{probText(last.probability)} · 단계 {min(last.stageK, last.stageN)}/{last.stageN}` (`text-xs font-mono text-cyan-300`), `{last.summary || "요약 없음"}` (`text-sm text-zinc-200 break-words`), `현재 위치: {last.position || "없음"}` (`text-xs text-zinc-400 break-words`), then `부족한 것` as one `- {gap}` line each (`text-xs text-zinc-400 break-words`) or `부족한 것 없음`. Without a verdict, under the CTA: `AI 판정 없음` (`text-xs text-zinc-500 mt-2`).
  - `판정 기록 {n}건 ›` (`text-xs text-cyan-300 mt-2`, rendered when `n = (state.role?.verdicts || []).length ≥ 1`; toggles `showHistory`; reads `판정 기록 접기` when open). Open: the delta line exactly as `RoleAdviceModal` prints it today (`확률 {a} → {b} ({date a} → {date b}) · 단계 {ka} → {kb}`, `font-mono text-xs text-cyan-300`, when two or more) and the list newest first, each entry `AI 판단 · 검증되지 않음 · {date}` / `{probText} · 단계 {k}/{n}` / `{summary || "요약 없음"}` — the newest entry's basis, position and gaps are already on the card, so the list prints summaries only. Capped at `ROLE_VERDICTS_MAX`.

- **Section 2 — `SectionLabel` `스토리라인`** (`mt-4`). `sp = stageProgressOf(state, today)`, `rs = sp?.rs`.
  - Without stages (`!sp`): `<p className="text-xs text-zinc-500">단계 없음 — AI 판정에서 단계를 받거나 세부 수정에서 직접 적어요</p>` and two links on one row (`text-xs text-cyan-300`): `AI에게 판정 묻기 ›` (→ `onAskVerdict`, disabled like the CTA) and `세부 수정 ›` (→ `onEdit`).
  - With stages: a vertical list (`space-y-1.5`), one node per `rs.stages[i]` with `i + 1 === sp.k` marking the current node (when `rs.k > rs.n` every node is done and the list ends with the line `모든 단계 충족` in emerald mono):
    - **done** (`i + 1 < rs.k`): one row `flex items-center gap-1.5 text-xs text-zinc-500` — `<Check size={13} className="text-emerald-400 shrink-0" />`, `<span className="font-mono shrink-0">{i + 1}단계</span>`, `<span className="truncate">{st.s.name}</span>`, `<span className="font-mono text-emerald-400 shrink-0 ml-auto">충족</span>`. No date (none is stored — rule 9).
    - **current**: a card `bg-zinc-950 border border-cyan-800 rounded-xl p-3 space-y-2`: the title row `flex items-center gap-1.5 text-sm` — `<span className="font-mono font-bold text-cyan-300 shrink-0">{sp.k}단계</span>`, `<span className="text-zinc-100 font-bold truncate">{sp.name}</span>`, `<span className="font-mono text-cyan-300 shrink-0 ml-auto">진행 {sp.pct}%</span>`; `<Bar ratio={sp.pct / 100} color="bg-cyan-400" h="h-1.5" />`; then `SectionLabel` `지금 할 것` and one block per `sp.conds[j]` (`sp.conds` aligns with `rs.current.results[j]`, whose `c` carries the type and arg): the line `- {r.text}` (`text-xs font-mono`, emerald when met, rose when unmet), `<Bar ratio={r.ratio} color={met ? "bg-emerald-400" : "bg-rose-400"} h="h-1" />`, and — **only when unmet** — `<button onClick={() => onGo(c)} className="mt-1 px-2.5 py-1 rounded-lg border border-cyan-800 text-xs text-cyan-300 active:opacity-70">{ROLE_COND_ACTIONS[c.type].label}</button>` (a type missing from the table renders no button). When every condition is met but the stage is current (cannot happen — a met stage is not current — so no branch). Then `SectionLabel` `이 단계의 업무` and `stageWorkOf(state, today, sp.k)` as rows: `<button onClick={() => onOpenWork(w.id)} className="w-full text-left flex items-center gap-1.5 text-xs active:opacity-70"><span className="font-mono text-zinc-500 shrink-0">{w.date}</span><span className="text-zinc-200 truncate">{w.title}</span><span className="text-zinc-600 shrink-0 ml-auto">›</span></button>`; empty → `<p className="text-xs text-zinc-500">연결된 업무 없음 — 로드맵에서 마일스톤에 업무를 연결해요</p>`.
    - **upcoming** (`i + 1 > rs.k`): `<button onClick={togglePeek(i)} className="w-full text-left flex items-center gap-1.5 text-xs text-zinc-500 active:opacity-70"><span className="font-mono shrink-0">{i + 1}단계</span><span className="truncate">{st.s.name}</span><span className="font-mono shrink-0 ml-auto">조건 {st.results.length}개</span><span className="shrink-0">{peek.has(i) ? "▾" : "›"}</span></button>`; when peeked, `- {r.text}` per condition (`text-xs font-mono text-zinc-600 pl-4`).
  - The journey line under the list (`text-xs font-mono text-zinc-400 mt-2`): `전체 {sp.journey}% · 전환 조건 {rs.quit ? "충족" : "미충족"}`; then the next-milestone line as `RoleStageLines` prints it (`다음 마일스톤: {milestoneLine(state, next, today)}` or `다음 마일스톤 없음 — 로드맵에서 추가해요`, `text-xs text-zinc-500`) and `로드맵 열기 ›` (border button, → `onGo({ type: "milestone_done" })`).

- **Section 3 — `영역 등급`** (`mt-4`): the label row `flex items-center justify-between` — `SectionLabel` `영역 등급` and a button `펼치기 ›` / `접기` (`text-xs text-cyan-300`, toggles `showGrades`); a one-line summary always visible (`text-xs font-mono text-zinc-500`): `근접도 {rg.match}% · 요구 영역 {rg.items.length}개 · 부족 {gaps.length}개` when `rg`, else `요구 등급 없음 — 세부 수정에서 정해요`. Open: `<RoleGradeSection state={state} today={today} onOpenCatalog={onOpenCatalog} onSetDir={onSetDir} />`.

- **Footer** (`mt-5 flex items-center justify-between`): `세부 수정 ›` (`px-3 py-2 rounded-xl border border-zinc-700 text-xs font-bold text-zinc-200`, → `onEdit`) and, only when `state.role`, `롤모델 초기화` (`text-xs text-rose-400`, → `onReset`).

**4. `RoleGradeSection({ state, today, onOpenCatalog, onSetDir })`** — module-level, the body of today's `RoleAdviceModal` from `const { rg, gaps } = roleRecommendations(state)` down, **minus** the `verdictBlock`, the `AI 판정 기록` code, the `sp &&` stage block and the `Modal` shell: the per-area bars with the legend, then the gap blocks unchanged (`다음 관문: …`, the `JOB_FIELDS` chips → `onSetDir`, the `staged` `RoleStageLines` for `사업`, the certificate and exam recommendation rows, `도감에서 더 보기 ›` → `onOpenCatalog`, the closing `추천은 직무 분야 매칭과 직무 가중 기준입니다.`), and `모든 요구 영역을 충족했습니다. 근접도 {match}%.` when no gap. Copy byte-identical to today's. `RoleStageLines` keeps its signature and is called from here only.

**5. `RoleModelModal` → the `roleEdit` sub-screen.** Title `롤모델 세부 수정`. Remove the story section (state `story`, the textarea, counter, caption; `save` no longer spreads `story` — `saveRole` keeps `role.story` because it spreads `s.role` first; change `saveRole`'s `if (rm.story) … else delete next.story` to leave `story` untouched when `rm.story === undefined`: `if ("story" in rm) { if (rm.story) next.story = rm.story; else delete next.story; }`). Remove the chip row and `pickPreset`; the name input stays first with `placeholder="롤모델 이름 (예: 연 매출 1억 1인 사업가)"`; the `SectionLabel` `세부 수정` line goes (the title says it). In the stages section header row add `<button onClick={seedNine} className="text-xs text-cyan-300">기본 9단계 채우기</button>` where `seedNine = () => { if (stages.length && !window.confirm("단계를 기본 9단계로 바꿔요. 계속할까요?")) return; setStages(seedStages().map(stageDraft)); }`. Everything else (area rows, stage cards, validation messages, `저장`) unchanged. Its `onClose` and `saveRole`'s exit both return to `role` (`setModal({ type: "role" })`).

**6. `CatalogModal`** gains `initialQuery` (`useState(initialQuery || "")` for `q`); root: `<CatalogModal state={state} initialCat={modal.cat} initialQuery={modal.q} …>`.

**7. `HomeTab`.** Rename the prop `onRoleAdvice` → `onRole` (both buttons; the root passes `() => setModal({ type: "role" })`). Content of the headline and proximity buttons unchanged. Third state (default 9): `rg ? <button …proximity…> : state.role ? <button onClick={onRole} className="w-full text-left px-1 text-xs text-zinc-500 active:opacity-70">근접도 계산 대상 없음 — 세부 수정에서 요구 등급을 정해요 ›</button> : <p className="px-1 text-xs text-zinc-500">롤모델 미설정 — 근접도 계산 대상 없음</p>`.

**8. Actions — exact references.** `buildBriefing` 3049 and 3060: `action: { type: "roleAdvice" }` → `action: { type: "role" }` (text untouched). `buildReader` 3228: `state.role ? { type: "roleAdvice" } : { type: "role" }` → `{ type: "role" }`. `closeBriefing` needs no change (`setModal({ type: next.type })` already opens `role`). `SettingsModal`'s `onRoleModel` already opens `role`. `RoleVerdictModal`'s `onClose` → `setModal({ type: "role" })`; `importRoleVerdict`'s `setModal(null)` → `setModal({ type: "role" })`.

**9. Root handlers** (beside `saveRole`):
```js
// Writes role.story alone — never stages, targets, verdicts or the seen-stamp (the story is the one text sent verbatim).
const saveRoleStory = (story) => {
  setState((prev) => {
    const s = structuredClone(prev);
    const next = { ...(s.role || { name: "롤모델", targets: {} }) };
    if (story) next.story = story; else delete next.story;
    s.role = next;
    return s;
  });
  showToast({ msg: story ? `원하는 모습 저장 · ${story.length}자` : "원하는 모습 지움" });
};
// Deletes the whole role record on the user's explicit confirm — name, targets, stages, story, verdicts, seen-stamp.
const resetRole = () => {
  if (!window.confirm("롤모델·단계·판정 기록을 모두 지워요. 계속할까요?")) return;
  setState((prev) => ({ ...prev, role: null }));
  setModal(null);
  showToast({ msg: "롤모델 삭제 — 근접도·단계 계산 대상 없음" });
};
// The place a condition is changed: a business view with its add modal over it, or the catalogue for a certificate name.
const goRoleAction = (c) => {
  const a = ROLE_COND_ACTIONS[c?.type];
  if (!a) return;
  setModal(null);
  if (a.catalog) { const arg = c.arg == null ? "" : String(c.arg).trim(); setModal({ type: "catalog", cat: certByTitle(arg)?.c || null, q: arg }); return; }
  setBizView(a.view); setTab("biz");
  if (a.modal) setModal({ type: a.modal });
};
```
Root entries: `{modal?.type === "role" && <RoleModal state={state} today={today} onClose={() => setModal(null)} onSaveStory={saveRoleStory} onAskVerdict={() => setModal({ type: "roleVerdict" })} onEdit={() => setModal({ type: "roleEdit" })} onReset={resetRole} onGo={goRoleAction} onOpenWork={(workId) => setModal({ type: "work", workId })} onOpenCatalog={(cat) => setModal({ type: "catalog", cat })} onSetDir={setAreaDir} />}` and `{modal?.type === "roleEdit" && <RoleModelModal state={state} onClose={() => setModal({ type: "role" })} onSave={saveRole} />}`. The overlay effect and `role.seenStageK` are untouched; `resetRole` removes the stamp with the record, and the effect's `!state?.role?.stages?.length` guard covers it.

**10. E2E (written, not run).** Rewrites:
- `flow.js:273` — after `clickInModal("롤모델")` assert the sheet starts with `롤모델` and contains `원하는 모습`, `스토리라인`, `영역 등급`, `세부 수정 ›`; then `clickInModalExact("세부 수정 ›")` and assert `롤모델 세부 수정` and `요구 등급`; `closeModal()` twice (the sub-screen's close returns to `role`).
- `flow.js:320` — expect `원하는 모습` and `단계 없음 — AI 판정에서 단계를 받거나 세부 수정에서 직접 적어요` instead of `요구 등급`.
- `flow.js` demo sweep (427–433) — after the headline tap: `expectText` for `롤모델`, `AI 추정 확률 30% · 단계 1/9`, `1단계`, `계약 기반 개발자`, `진행 50%`, `- 입금 확인된 일시금 수 'deposit' 0/1`, `계약 목록 ›`, `연결된 업무 없음`, `전체 6% · 전환 조건 미충족`, `2단계`, `조건 1개`; `clickInModalExact("판정 기록 2건 ›")` → `확률 20% → 30%` and `단계 1 → 1`; `clickInModalExact("펼치기 ›")` → `/ 요구` and `칸 하나 = 등급 한 단계`; `closeModal()`.
- `flow2.js:136` — after `clickInModal("롤모델")`, `clickInModalExact("세부 수정 ›")`, `sleep(400)`; the first `.fixed.inset-0 input` is still the name input; after `저장` the `role` screen is open — `closeModal()` once (drop the second if it throws, as today's `try`).
- `flow3.js:161` → rename `the proximity line opens the role screen, whose 영역 등급 section expands to the squared bars` — after the tap assert the sheet starts with `롤모델` and **does not** contain `칸 하나 = 등급 한 단계` (collapsed) but does contain `근접도 `; `clickInModalExact("펼치기 ›")`; then the existing `/ 요구`, legend, `div.flex.h-2` and squared-width assertions unchanged; `도감에서 더 보기` as today.
- `flow3.js:228` — the headline tap now expects `롤모델`, `스토리라인`, `1단계`, `E2E 첫 계약`, `진행 0%`, `- 계약 체결 수 'E2E단계고객' 0/1`, `계약 추가 ›`, `2단계`, `조건 2개`, `3단계`, `조건 1개`, `전체 0% · 전환 조건 미충족`; after the first contract the timeline reads `충족` once and `2단계` current with `- 보유 자격 '{held}' 1/1` emerald and `- 포트폴리오 항목 수 'E2E단계포트폴리오' 0/1` with `포트폴리오 추가 ›`.
- `flow3.js:266` → rename `the editor's 기본 9단계 채우기 seeds nine editable stages, the editor saves only role, and removing every stage drops the key`; `openEditor` = `h.openSettings()` → `clickInModalExact("롤모델 수정")` → `clickInModalExact("세부 수정 ›")`; replace `clickInModalExact("의료 AI 솔루션 대표")` with `clickInModalExact("기본 9단계 채우기")`; `h.setValue(".fixed.inset-0 input", original.name, 0)` still hits the name input; after each `저장` the `role` screen remains — `closeModal()` it. Keep every assertion (story and verdict survive, `seenStageK`, no other key).
- `flow3.js:343` `openVerdictSheet` — after the headline tap, `clickInModalExact` on `AI에게 판정 묻기 ›` **or** `다시 판정 ›` (the save carries verdicts in some steps): find the CTA by regex `/^(AI에게 판정 묻기|다시 판정) ›$/` on `.fixed.inset-0 button`.
- `flow3.js:395` — after `선택한 항목 저장` the `role` screen is open: assert `h.overlayText()` starts with `롤모델` and contains `AI 추정 확률 35%` and `E2E 판정 요약`; then `closeModal()`.
- `flow3.js:536–540` — the reader's `›` opens `롤모델` (`startsWith("롤모델")`), not `방향 제안 —`.
- New `flow3.js` steps (after the editor step):
  - `the role screen fills a story template, appends a second one after a blank line, and 저장 writes role.story only` — open via settings → `롤모델 수정`; `h.setValue(".fixed.inset-0 textarea[aria-label='원하는 모습']", "")`; `clickInModalExact("취업")` → the textarea value equals the `취업` template; `clickInModalExact("창업")` → value equals `취업 + "\n\n" + 창업`; the counter shows `{len} / 2000`; `before = readState()`; `clickInModalExact("저장")` → `after.role.story === value`, every other `role` key (`name`, `targets`, `stages`, `verdicts`, `seenStageK`) deep-equal, every other top-level key unchanged (`lastTick` excepted); the CTA button is now enabled; restore `role` in `finally`.
  - `the storyline shows done, current and upcoming stages, and each unmet condition's 지금 할 것 button lands on its view, sheet or catalogue` — plant A: `role.stages = [ { id: "e2e-rs1", name: "E2E 완료 단계", conds: [{ type: "cert_held", arg: held, min: 1 }] }, { id: "e2e-rs2", name: "E2E 현재 단계", conds: [{ type: "deals_won", arg: "E2E화면고객", min: 1 }, { type: "folio_match", arg: "E2E화면포폴", min: 1 }, { type: "milestone_done", arg: "E2E화면", min: 1 }, { type: "leads_stage", arg: "demo", min: 1 }, { type: "notice_status", arg: "submitted", min: 1 }] }, { id: "e2e-rs3", name: "E2E 다음 단계", conds: [{ type: "payment_paid", arg: "deposit", min: 1 }, { type: "cert_held", arg: "정보보안기사", min: 1 }, { type: "monthly_revenue", min: 1000000 }] } ]` with `seenStageK: 2`; open from the headline; assert the done row `1단계 … E2E 완료 단계 … 충족` with an emerald `충족`, the current card `2단계 E2E 현재 단계 · 진행 0%`, five `지금 할 것` buttons in order `계약 추가 ›`, `포트폴리오 추가 ›`, `로드맵 열기 ›`, `리드 추가 ›`, `공고 추가 ›`, the upcoming row `3단계 E2E 다음 단계 조건 3개`, tap it → `- 입금 확인된 일시금 수 'deposit' 0/1` appears; then for each of the five buttons: reopen the screen, tap, and assert the landing — `계약 추가 ›`: `readState().ui.bizView === "deals"`, the nav `사업` button has `text-cyan-300`, an overlay exists whose title is the deal form's (`BIZ_ADD_LABEL.deals` = `계약 추가`); `포트폴리오 추가 ›`: `bizView === "folio"` + the portfolio form; `로드맵 열기 ›`: `bizView === "roadmap"`, no overlay, the page shows `로드맵`; `리드 추가 ›`: `bizView === "leads"` + the lead form; `공고 추가 ›`: `bizView === "notices"` + the notice form. Plant B: swap stages so `e2e-rs3` is current (`e2e-rs2` with a single met condition `cert_held held`): assert `계약 목록 ›` lands on `bizView === "deals"` with **no** overlay, `도감에서 찾기 ›` opens `성취 도감` with the search input's value `정보보안기사` and a result row `정보보안기사`, `계약 추가 ›` for `monthly_revenue` opens the deal form. Restore `role` and `ui.bizView` in `finally`.
  - `the current stage lists the undone work items linked to its milestones, and a tap opens the work sheet` — with plant A's stages: plant `work.push({ id: "e2e-rs-work", date: today, title: "E2E 단계 업무", done: false, source: "manual", track: "biz", createdAt: today })` (copy the field set of an existing manual item from the save) and `milestones.push({ id: "e2e-rs-ms", stage: 2, title: "E2E 단계 마일스톤", status: "active", dealIds: [], documentIds: [], workIds: ["e2e-rs-work"], createdAt: today })`; open → under `이 단계의 업무` the row `{today} E2E 단계 업무 ›`; tap → the work sheet opens with `E2E 단계 업무` in its title input; mark `work` done through the save → reopen → `연결된 업무 없음 — 로드맵에서 마일스톤에 업무를 연결해요`. Restore `work`, `milestones`, `role`.
  - `롤모델 초기화 asks once and removes the role record only` — open the screen; `window.confirm = () => false`; tap `롤모델 초기화` → `role` unchanged and the screen still open; `window.confirm = () => true`; tap → `readState().role === null`, no overlay open, every other top-level key unchanged (`lastTick` excepted); the CV shows `롤모델 미설정 — 근접도 계산 대상 없음` as a `P`; restore `role` in `finally`.
  - `the briefing's next-step line and the reader's role section open the role screen` — `할 일` → `브리핑 열기` → tap the `다음 단계` item (find the button whose text starts with the first area name of `roleRecommendations`' first gap, or `모든 요구 영역 충족`) → `h.overlayText().startsWith("롤모델")`; close; `프로필` → `오늘 읽을 것 ›` → `button[aria-label='롤모델 판정 열기']` → `startsWith("롤모델")`.
- `tools/e2e/README.md`: the `flow.js`, `flow2.js`, `flow3.js` rows, a status paragraph for this change, the count (recount statically: 250 + 5 = **255** expected — `flow3.js` 25).

**Acceptance (Phase 1).**
- Gates pass; `npm run finish` exit 0 with no allowlist addition; `docs/generated/db-schema.md` unchanged (v28, 18 blocks); `onboarding-tables.md` loses its `ROLE_PRESETS` section; `npm run smoke` passes.
- The five baselines are **byte-identical** (four packets/briefing texts; the numbers dump of `roleGap` / `roleStageOf` / `stageProgressOf` / `roleVerdictDue` / `roleRecommendations` on the three saves). State the four lengths and the numbers dump's length.
- `git diff` shows no hunk in `roleGap`, `roleRecommendations`, `condValue`, `condText`, `condRatio`, `roleStageOf`, `stageProgressOf`, `roleVerdictDue`, `stageLine`, `migrate`, `freshState`, `demoState`, `Overlay`, the root overlay effect, any packet builder or parser, `RoleVerdictModal`; `buildBriefing` and `buildReader` diff in exactly the three action objects of item 8 (`grabBlock` on `git show HEAD:src/LifeManager.jsx` as the previous plan did). `grep -n "roleAdvice\|ROLE_PRESETS\|ROLE_STAGE_PRESET\|RoleAdviceModal" src tools` → nothing. `modal.type` count 39.
- Throwaway node checks on `storyWithTemplate` / `stageWorkOf` / `ROLE_COND_ACTIONS`: (a) empty story → the template; `"  "` → the template (trimmed empty); non-empty → `story + "\n\n" + tpl`; a 1,990-char story + template → clipped to 2,000; (b) every `COND_TYPES` type has a `ROLE_COND_ACTIONS` entry (a smoke-style assertion you may add to `smoke-logic.js` beside the `COND_TYPES` checks); (c) `stageWorkOf` on the demo → `[]` for `k = 1`, the one manual undone business item for `k = 2`, `[]` for `k = 9`; a done linked item is excluded; a dangling `workIds` id is skipped.
- Throwaway puppeteer on the demo build at 390 px: the screen's three sections in order with `영역 등급` collapsed and no `칸 하나` text until `펼치기 ›`; the template chips on one row ≤ 32 px; the CTA reads `다시 판정 ›` (the demo has verdicts) and the card shows `AI 추정 확률 30% · 단계 1/9`; the timeline: node 1 current (`진행 50%`, one emerald and one rose condition, one button `계약 목록 ›`), nodes 2–9 upcoming with `조건 n개`, no horizontal overflow, a planted 40-char stage name truncating on the current card and on an upcoming row; `판정 기록 2건 ›` opens the delta line; `세부 수정 ›` opens `롤모델 세부 수정` with no chip row, the name input first, `기본 9단계 채우기` present, and its X returns to `롤모델`; each `지금 할 것` landing as the E2E states (tab, `ui.bizView`, modal or none, the catalogue search value); `롤모델 초기화` declined writes nothing, accepted writes `role: null` only; 0 console errors throughout.
- **Mutation checks** (each built into a mutated demo, checked, reverted; the release demo rebuilt and byte-identical to the checked build): (1) leave `buildReader`'s action as `{ type: "roleAdvice" }` → the reader's `›` opens nothing (no branch renders it) and the E2E-shaped `startsWith("롤모델")` check fails, while the grep check catches it statically; (2) make `goRoleAction` for `deals_won` also push a deal into `state.deals` → the key-diff check on the landing step fails (`deals` changed); (3) initialise `showGrades` to `true` → the collapsed assertion (no `칸 하나` before `펼치기 ›`) fails; (4) feed `sp.journey` into the headline's `pct` span → the numbers baseline still passes (it is a render change) but the `flow.js` demo headline assertion `· 진행 50%` fails — state that the numbers dump alone would not catch a display swap, which is why the E2E headline assertions stay.

### Phase 2 — docs sync (docs-syncer)

Update, each with the facts the Phase 1 progress note states:
- `docs/design-docs/metrics-and-role-model.md` — a `## The role screen (2026-09-18, second change of the day)` section: the three sections and the footer, `ROLE_STORY_TEMPLATES` and the insertion rule, `ROLE_COND_ACTIONS` (a table: type → label → landing), `stageWorkOf`, `saveRoleStory` / `resetRole` / `goRoleAction`, the `roleEdit` sub-screen and `기본 9단계 채우기`, `ROLE_PRESETS` removed (line 11 and "The preset and the seed" rewritten), the journey-figure statement (default 12), the `RoleAdviceModal` section (line 228) rewritten as `RoleGradeSection` inside the screen.
- `docs/design-docs/assistant-bridge.md` — line 56 (`roleAdvice` → `role`), line 312 (opened from the `롤모델` screen's CTA); `roleRecommendations` "extracted from `RoleAdviceModal`" → "shared by the briefing and `RoleGradeSection`".
- `docs/product-specs/home.md` — props (`onRole`), the headline/proximity targets, the third-state button, `SettingsModal`'s `롤모델` section (opens the screen; the story lives there), the "Where everything went" rows 91–93.
- `docs/product-specs/growth.md` — rows 8, 12, 13 point at the screen and `roleEdit`.
- `docs/product-specs/feedback-overlays.md` — the toast table: `원하는 모습 저장 · {n}자`, `원하는 모습 지움`, `롤모델 삭제 — 근접도·단계 계산 대상 없음`; the `stage` overlay paragraph notes it has no follow-up action (unchanged).
- `docs/product-specs/daily-reader.md` — row 80's action `{ type: "role" }` always; line 184 (`롤모델`, not `방향 제안 —`).
- `docs/product-specs/daily-briefing.md` — row 26: the `다음 단계` line opens the `롤모델` screen in every case.
- `docs/DESIGN.md` — A3 (the proximity line opens the `롤모델` screen), A6 (`SettingsModal`'s `롤모델` button target), A15/A16 (`RoleAdviceModal` → the screen), a new A17 `롤모델 화면` entry (template chips, the CTA card, the timeline nodes, `지금 할 것` buttons, the collapsed `영역 등급`, the footer, the `roleEdit` sub-screen — zero new icons, zero new colours).
- `docs/design-docs/information-architecture.md` — row 71 and the `modal.type` list (line 87): `roleAdvice` out, `roleEdit` in, count 39; the `role` entry describes the screen.
- `ARCHITECTURE.md` — Tabs (`HomeTab`'s `onRole`), Modals (`RoleModal`, `RoleGradeSection`, `RoleModelModal` as `roleEdit`, `RoleAdviceModal` deleted, `CatalogModal`'s `initialQuery`), App root (`saveRoleStory`, `resetRole`, `goRoleAction`), the status paragraph (`modal.type` 39 with the swap, the E2E count), the glossary rows `단계 (롤모델)` / `판정 (롤모델)`.
- `docs/RELIABILITY.md` — the E2E-policy paragraph and count; the mutation checks of this change.
- `docs/SECURITY.md` — line 60: the caption now lives on the `롤모델` screen.
- `docs/design-docs/demo-data.md` — line 161: the screen on the demo save (current node 1, `계약 목록 ›`, the empty work line, default 10).
- `tools/e2e/README.md` — verify the count.
- `docs/exec-plans/tech-debt-tracker.md` — TD-86 (the demo's current stage links no work item — default 10); TD-87 (`payment_paid` lands on the deal list, not on a specific payment row); TD-88 (`cert_held` lands on the catalogue search, which cannot create the certification task — the KR path of rule 19 — so the button shows the name but the task is still made from a goal); TD-89 (the journey figure prints twice on the screen when a `사업` grade gap exists); TD-44 extended (E2E not run, 255).
- `docs/design-docs/decision-log.md` — one row dated 2026-09-18 (second of the day) with the user's four decisions and the planner defaults 1–12, linking this plan once moved.
- `docs/product-specs/index.md`, `docs/design-docs/index.md` — one-line updates (`RoleAdviceModal` → `RoleModal`, `roleEdit`).
- `docs/generated/*` by `npm run docs:gen` only; `npm run docs:check` exit 0; move this plan to `completed/`.

## Steps

1. Phase 1 — baselines; removals (item 1); vocabulary (2); `RoleModal` (3) and `RoleGradeSection` (4); the `roleEdit` sub-screen (5); `CatalogModal` (6); `HomeTab` (7); the three action objects and the two return-to-screen edits (8); root handlers and entries (9); E2E rewrites and five new steps, README (10); gates; baselines compared; node and puppeteer checks; mutation checks; progress note here.
   **Progress note — Phase 1 done (2026-09-18, implementer; not committed; E2E written, not run).**
   - Landed as written: `ROLE_PRESETS`, `ROLE_STAGE_PRESET` and `RoleAdviceModal` removed and the `roleAdvice` modal entry
     retired (`grep roleAdvice|ROLE_PRESETS|ROLE_STAGE_PRESET|RoleAdviceModal src tools` → nothing, `modal.type` count 39
     with `roleEdit` added); the vocabulary block (`ROLE_STORY_TEMPLATES`, `ROLE_COND_ACTIONS`, `storyWithTemplate`,
     `stageWorkOf`) under its banner after `roleVerdictDue`; `RoleModal` (title `롤모델`, the three sections and the footer)
     placed before the schedule-tab banner; `RoleGradeSection` in `RoleAdviceModal`'s place, carrying its bars, legend and
     gap blocks verbatim; `RoleModelModal` as the `roleEdit` sub-screen (title `롤모델 세부 수정`, no presets, no story,
     `기본 9단계 채우기` in the stages header, the name input first with its new placeholder); `saveRole`'s
     `if ("story" in rm)` guard and its return to `{ type: "role" }`; `CatalogModal.initialQuery`; `HomeTab`'s `onRole`
     and the third-state button; the three action objects (`buildBriefing` ×2, `buildReader` ×1) and the two
     return-to-screen edits (`importRoleVerdict`, `RoleVerdictModal`'s close); `saveRoleStory` / `resetRole` /
     `goRoleAction` beside `saveRole`; both root modal entries. `tools/harness/gen-cert-stats.js` lost its
     `"ROLE_PRESETS"` list entry. E2E: `flow.js` three steps rewritten, `flow2.js` routed through `세부 수정 ›`,
     `flow3.js` six steps rewritten plus five new ones, `tools/e2e/README.md` (250 → **255**, `flow3.js` 25).
   - Gates: `npm run build` ok · `npm run finish` clean (no allowlist) · `npm run lang:check` clean · `npm run smoke`
     all checks passed (now 5 groups: the new `role conditions: 9 types, each with a landing`) ·
     `npm run docs:gen && npm run docs:check` clean — `db-schema.md` still v28 / 18 blocks / 14 keys (line numbers only),
     `onboarding-tables.md` lost its `ROLE_PRESETS` section, `symbol-index.md` reindexed ·
     `node --check` on `flow.js`, `flow2.js`, `flow3.js`.
   - Byte-identity to HEAD (`a1a400c`, `grabBlock`): 35 of 37 checked blocks identical — `roleGap`,
     `roleRecommendations`, `condValue`, `condText`, `condRatio`, `roleStageOf`, `stageProgressOf`, `roleVerdictDue`,
     `stageLine`, `quitText`, `lastVerdictOf`, `probText`, `migrate`, `freshState`, `demoState`, `Overlay`, every packet
     builder and parser, `RoleVerdictModal`, `RoleStageLines`, `COND_TYPES`, `ROLE_STAGE_SEED`, `seedStages`,
     `certByTitle`, `heldCertsOf`, `milestoneLine`, `milestoneOrder`, `workOn`. `buildBriefing` differs in its two
     action objects and `buildReader` in its one — nothing else.
   - Baselines (captured from HEAD before the first edit, recompared after): daily packet 2,408 · work packet 2,650 ·
     review packet 1,945 · briefing 837 — byte-identical; the numbers dump of `roleGap` / `roleStageOf` /
     `stageProgressOf` / `roleVerdictDue` / `roleRecommendations` over the demo save, the demo save with the three-stage
     `flow3.js` fixture and the demo save with `role = null` is **17,788 chars, byte-identical**.
   - Node checks: an empty and a blank story take the template, a non-empty one appends after a blank line, a
     1,990-char story plus a template clips to 2,000; every `COND_TYPES` type has a `ROLE_COND_ACTIONS` landing and no
     landing names an unknown type (also asserted in `smoke-logic.js`); `stageWorkOf(demo)` is `[]` at k=1, the one
     undone linked business item at k=2, `[]` at k=9, excludes a done linked item and skips a dangling `workIds` id.
   - Puppeteer (demo build, 390 px, 0 console errors): the three sections in order with `영역 등급` collapsed (no
     `칸 하나` until `펼치기 ›`), the summary `근접도 25% · 요구 영역 2개 · 부족 2개`, the CTA `다시 판정 ›`, the card
     `AI 추정 확률 30% · 단계 1/9`, node 1 current (`진행 50%`, one emerald and one rose condition, the single button
     `계약 목록 ›`), `연결된 업무 없음 — …`, `전체 6% · 전환 조건 미충족`, nodes 2–9 with `조건 n개`, no horizontal
     overflow; the three template chips 30 px on one row, the story `저장` 30 px, every landing button ≤ 32 px and the
     footer `세부 수정 ›` 34 px on one line; a planted 40-char stage name truncates on the current card (560 → 189 px)
     and on an upcoming row (480 → 222 px) with no overflow; `판정 기록 2건 ›` opens
     `확률 20% → 30% (2026-08-20 → 2026-09-18) · 단계 1 → 1` and folds back; `세부 수정 ›` opens `롤모델 세부 수정`
     (no chip row, the name input first, `기본 9단계 채우기` present, no story field) and its X returns to `롤모델`;
     every landing — `계약 추가 ›` → `deals` + `새 계약`, `포트폴리오 추가 ›` → `folio` + `새 포트폴리오`,
     `로드맵 열기 ›` → `roadmap` with no sheet, `리드 추가 ›` → `leads` + `리드 추가`, `공고 추가 ›` → `notices` +
     `공고 추가`, `계약 목록 ›` → `deals` with no sheet, `도감에서 찾기 ›` → `성취 도감` with the search value
     `정보보안기사`, `monthly_revenue`'s `계약 추가 ›` → the deal form — each on the `사업` tab; a planted stage-linked
     work item lists as `{today} UI 단계 업무 ›` and opens the `업무` sheet; the story save writes `role.story` only
     (no other `role` key, no other top-level key); `롤모델 초기화` declined writes nothing and keeps the screen open,
     confirmed leaves `role: null` with every other key unchanged, closes everything and restores the CV's
     `롤모델 미설정 — 근접도 계산 대상 없음` as a `P`; the third state renders as a button opening the screen; the
     briefing's `다음 단계` line and the reader's `롤모델 판정 열기` both land on `롤모델`.
   - Mutation checks (each built into a mutated demo, probed, reverted; the release demo rebuilt byte-identical to the
     checked build): (1) `buildReader`'s action left as `roleAdvice` → the reader's `›` opens **0 overlays**, so the
     E2E `startsWith("롤모델")` assertion fails and the static grep catches it too; (2) `goRoleAction` pushing a deal for
     `deals_won` → the landing step's record-boundary diff reports `deals` (4 → 5); (3) `showGrades` initialised `true`
     → `칸 하나 = 등급 한 단계` is present before `펼치기 ›`, failing the collapsed assertion; (4) `sp.journey` fed into
     the headline's percentage → the headline reads `진행 6%` and the `flow.js` demo assertion `· 진행 50%` fails while
     the numbers dump stays byte-identical — a display swap is invisible to the numbers baseline, which is why the
     headline assertions stay in the E2E.
   - Deviations: (i) **step names and error messages are English** (`lang-check` rejects Hangul there) — the plan's
     Korean step titles became `the editor's nine-stage seed button …`, `… and the save writes role.story only`,
     `… each unmet condition's action button lands on its view, sheet or catalogue`, `the role reset asks once …`, and
     the grade-gap step title says `grade-gap section`; Korean survives only in selector and assertion arguments.
     (ii) The plan's `BIZ_ADD_LABEL.deals` = `계약 추가` is **not** the deal form's title: `DealModal` is `새 계약` and
     `FolioModal` is `새 포트폴리오` (`LeadModal` / `NoticeModal` are `리드 추가` / `공고 추가`), so the landing
     assertions name the real titles, and the roadmap landing is asserted through `마일스톤 추가` in the header with no
     sheet open. (iii) A work row's spans are flex items, so its `innerText` carries line breaks — the row is tapped by
     whitespace-normalised text, not `clickInModalExact`. (iv) `"ROLE_PRESETS"` was also removed from
     `tools/harness/lib/source.js`'s `DATA_TABLES` name list (a region-skip list, no data row), without which the
     plan's `grep … src tools` acceptance would still hit. (v) The landing step gained a record-boundary diff (only
     `ui` and `lastTick` may move across the five landings) so mutation 2 fails a written assertion, as the plan
     assumes. (vi) `stageWorkOf` stayed in the vocabulary block before `workOn` (a `const` arrow resolving at call
     time); `smoke-logic.js` lifts `ROLE_COND_ACTIONS` and `COND_TYPES` only, so no ordering problem arose.
     (vii) The footer `세부 수정 ›` measures 34 px with the plan's own `px-3 py-2` classes — one line, not a wrap.
   - Plan errors found: the deal/portfolio form titles (deviation ii); everything else matched the source.

2. Phase 2 — docs sync as listed; `docs:gen`, `docs:check`; move to `completed/`; progress note here.
   **Progress note — Phase 2 done (2026-09-18, docs-syncer).**
   - Verified every Phase 1 claim against `git show cc00d03` and the current `src/LifeManager.jsx` before writing
     anything: `grep roleAdvice|ROLE_PRESETS|ROLE_STAGE_PRESET|RoleAdviceModal src tools` → nothing; `modal?.type ===`
     render lines → 39, `roleEdit` in, `roleAdvice` out; `RoleModal`/`RoleGradeSection`/`RoleModelModal` (now
     `roleEdit`) all read as described; `ROLE_STORY_TEMPLATES`/`ROLE_COND_ACTIONS`/`storyWithTemplate`/`stageWorkOf`
     byte-match the plan's listing; `saveRoleStory`/`resetRole`/`goRoleAction` byte-match; `CatalogModal.initialQuery`
     confirmed; `HomeTab`'s `onRole` and the third-state button confirmed; `db-schema.md` diff (`git show cc00d03 --
     docs/generated/db-schema.md`) is line-number-only, v28/18 blocks unchanged; `await step(` counts per file
     (38/16/25/23/19/6/27/28/10/32/31) sum to **255**; `smoke-logic.js`'s `role conditions: 9 types, each with a
     landing` group confirmed; `tools/harness/gen-cert-stats.js` and `tools/harness/lib/source.js` both lost their
     `"ROLE_PRESETS"` entry (deviation iv confirmed); `DealModal`/`FolioModal` titles are `새 계약`/`새 포트폴리오`
     (deviation ii confirmed) — `LeadModal`/`NoticeModal` are `리드 추가`/`공고 추가` as the plan assumed.
   - Updated: `metrics-and-role-model.md` (new `## The role screen (2026-09-18, second change of the day)` section;
     `ROLE_PRESETS`/preset-and-seed rewrite; the journey-figure statement; `RoleAdviceModal` → `RoleGradeSection`
     rewrite; every stale `RoleModelModal`/`RoleAdviceModal` mention in the older same-day sections corrected in
     place, dated as history rather than deleted), `assistant-bridge.md`, `home.md`, `growth.md`,
     `feedback-overlays.md` (toast rows, the `stage` overlay's unaffected note), `daily-reader.md`, `daily-briefing.md`,
     `DESIGN.md` (A3, A6, A15, A16 corrected + new A17), `information-architecture.md` (row 71, the `modal.type` list,
     the `roleVerdict` entry's opener), `ARCHITECTURE.md` (option-data row, the Daily-assistant region bullet, Tabs,
     Modals, App root, the status paragraph, the glossary's `단계 (롤모델)` row), `RELIABILITY.md` (a new E2E-policy
     sentence for this change with the 255 count and the `smoke-logic.js` group, plus a new mutation-tested paragraph
     and the numbers-baseline note), `SECURITY.md` (the story caption's current home), `demo-data.md` (the screen's
     current-node reading, `계약 목록 ›`, the empty work line, [TD-86](../tech-debt-tracker.md)), `tools/e2e/README.md`
     (verified only — already correct, 255 confirmed by independent recount), `product-specs/index.md` and
     `design-docs/index.md` (modal list and role-model row). Two files outside the plan's own list also carried stale
     `RoleAdviceModal` mentions describing *current* behaviour (not history) and were corrected:
     `design-docs/scoring-engine.md` (the display-formula line, the `cert_held`/`heldCertsOf` line) and
     `product-specs/tasks.md` (`CatalogModal`'s prop list, now including `initialQuery`).
   - Tech-debt-tracker: added TD-86 (demo's current stage links no work item), TD-87 (`payment_paid` lands on the
     deal list, not a payment row), TD-88 (`cert_held` cannot create the task itself, Rule 19), TD-89 (the journey
     figure can print twice on the screen), and TD-90 (two of this plan's own assumptions — the deal/portfolio form
     titles, the footer button's height ceiling — did not match the source, per the implementer's deviations ii/vii);
     extended TD-44 with this change's phase and the 255 count. Extended TD-29 separately (not plan-listed, found
     during the docs pass): `RoleGradeSection` still has no `rg === null` guard, and the 2026-09-18 screen adds one
     reachable path to it (the CV's new third state opens `펼치기 ›` regardless of `rg`) where TD-29's previous
     "always gated" claim no longer held.
   - `decision-log.md`: one row dated 2026-09-18 after the story-verdict row, recording the user's four decisions,
     the planner defaults, the one AGENTS.md §4 approval, and the five tech-debt rows, linking this plan once moved.
   - `npm run docs:gen`: `db-schema.md` v28, 18 blocks, 14 keys — unchanged; `onboarding-tables.md` and
     `symbol-index.md` regenerated (495 symbols). `npm run docs:check`: found two pre-existing-style link defects
     introduced by this pass itself (two `tech-debt-tracker.md` rows used `core-beliefs.md` instead of
     `../design-docs/core-beliefs.md`) — fixed, then **exit 0**.
   - Screenshots: `npm run build:demo` → `release/life-demo.html`, then `node tools/harness/gen-screenshots.js` —
     all shots regenerated; `home.png` is byte-unaffected (the role screen is reached by a tap, never shown on the
     home screenshot itself).
   - Not run (standing instruction, unchanged by this pass): `npm run verify`, `node tools/e2e/run.js`.

## Verification

- Phase 1: `npm run build` · `npm run finish` · `npm run lang:check` · `npm run smoke` · `npm run docs:gen && npm run docs:check` · `node --check tools/e2e/flow.js tools/e2e/flow2.js tools/e2e/flow3.js`.
- **Not run:** `npm run verify` and the E2E suite (standing user instruction) — every new or edited step parses and follows the file conventions; its green status is unverified until the user runs the suite (extend TD-44).
- Throwaway puppeteer / node checks as listed under Acceptance; scripts and the five baselines stay in the scratchpad.

## Cleanup checklist
- [ ] `npm run finish` exit 0 (unused symbols/imports, duplicates ≥ 6 lines, residue, language) — `RoleAdviceModal`, `ROLE_PRESETS`, `ROLE_STAGE_PRESET` gone; `RoleStageLines` has one caller; the verdict card and the history list share no duplicated block with `RoleVerdictModal`'s confirm view (if `finish` flags one, lift a `VerdictLines` helper rather than allowlisting)
- [ ] no allowlist addition expected; if one is needed, mirror it in `docs/exec-plans/tech-debt-tracker.md`
- [ ] `roleGap`, `roleRecommendations`, `condValue`, `condText`, `roleStageOf`, `stageProgressOf`, `roleVerdictDue`, `stageLine`, `migrate`, `freshState`, `demoState`, every packet builder and parser byte-identical; `buildBriefing` / `buildReader` differ in the three action objects only
- [ ] schema stays v28; no `@schema` or `migrate` edit; `db-schema.md` unchanged
- [ ] `modal.type` count 39 — `roleEdit` in, `roleAdvice` out, nothing else; `grep roleAdvice src tools` empty
- [ ] the only state keys new handlers write: `role` and `ui.bizView`
- [ ] every new Korean string appears only in JSX / template strings / the two literal tables / E2E arguments, never in a comment — `lang-check` clean

## Docs to sync
See Phase 2: `metrics-and-role-model.md`, `assistant-bridge.md`, `home.md`, `growth.md`, `feedback-overlays.md`, `daily-reader.md`, `daily-briefing.md`, `DESIGN.md`, `information-architecture.md`, `ARCHITECTURE.md`, `RELIABILITY.md`, `SECURITY.md`, `demo-data.md`, `tools/e2e/README.md`, `tech-debt-tracker.md` (TD-44, TD-86–89), `decision-log.md`, `product-specs/index.md`, `design-docs/index.md`; `docs/generated/*` by `npm run docs:gen` only.

## Proposed commit

Two commits at the user's gates, or one squashed:
- `feat(role): one 롤모델 screen — story templates, a storyline timeline with 지금 할 것 buttons, grade gaps folded away, the editor behind 세부 수정 (roleAdvice retired, roleEdit added)`
- `docs: sync the role screen — specs, IA, architecture, decision log, tech debt`
