# No percentage on the role model — proximity `%`, stage progress `%`, journey `%` and the verdict probability retired; the stage and gap facts stay (schema stays v28)

- Status: completed
- Date: 2026-09-18
- Needs approval: no — the user's instruction today is the decision. **No `migrate` block, no `v` bump, no `CERTS` / `EXAMS` / `WEIGHT_MATRIX` / `CERT_W_EXC` row, no `liferpg-*` key, no `store` call site, no user record deleted or rewritten** (a `probability` value stored in an older verdict stays in the save and is simply never read). The one rule-text change — a dated amendment paragraph under Rule 14 — is the user's own request; `demoState` is not a data-guard region (`DATA_TABLES` in `tools/harness/lib/source.js` does not list it), so no `HARNESS_DATA_EDIT` is needed.
- Agents: planner → implementer (Phase 1: code + E2E + the Rule 14 amendment + demo + screenshots) → cleanup → docs-syncer (Phase 2). The verifier's E2E run is **not** part of this plan (standing user instruction: the suite is written, parsed with `node --check`, never executed).

## Goal

Every percentage the role model shows or computes leaves: the grade proximity figure (`roleGap.match`, its squared curve, the segmented bars, the legend, the `롤모델 근접도 {n}%` line, the RANK UP overlay's proximity delta), the stage progress and journey figures (`stageProgressOf.pct` / `.journey`, the per-condition ratio bars from `condRatio`), and the AI-estimated probability (the verdict's `probability` — no longer asked for in the packet template, not parsed, not stored for new verdicts, not shown anywhere; values in older verdicts are unread). Everything else about the role model stays as it is: the `원하는 모습` story, the verdict text (summary, basis, position, gaps) under its `AI 판단 · 검증되지 않음` label, the stages and their conditions with `value/min` counts (`condText`), the area requirement grades and the certificate / exam recommendations built on the gaps. What replaces the numbers beyond the existing fact lines — `단계 k/n · 조건 c/m`, `충족` / `미충족`, the `condText` values, the `{RANKS[have].name} / 요구 {RANKS[need].name} · {gap}단계 부족 | 충족` lines — is **deferred to a later plan**; this plan designs no new progress display.

## Context — what the user asked (translated, recorded in substance)

"Remove every percentage from the role model — the proximity percentage, the stage progress and journey percentages, and the AI-estimated probability. Keep the rest. What goes in their place is a later decision."

## Decisions the user made today (final — record, do not reopen)

1. **No percentage anywhere on the role model.** `roleGap.match` and its squared curve, `stageProgressOf.pct` / `journey`, the `condRatio` bars and the verdict `probability` are all retired.
2. **The facts stay**: story, verdict text, stages, conditions with `value/min`, area requirement grades, recommendations.
3. **No new progress display**: the surfaces state only the fact lines that already exist; a replacement is a later plan.
4. **Rule 14 gets a dated amendment** stating the retirement; the heading count stays 19; Rule 13 is unchanged.
5. **No schema change** (v28): older verdicts keep their `probability` field unread; nothing is migrated or deleted.

## Defaults the planner set (stated so the user can change them; none is open for the implementer)

1. **`roleGap` → `roleAreas`.** Same filter and `items` shape (`{ area, need, have, gap }`), returns `{ name, items } | null`, no `match`. `roleRecommendations` keeps working on `gap > 0` and returns `{ areas, gaps }` (the `rg` key is renamed with the function so no caller can read a `.match` by habit).
2. **`stageProgressOf`, `condRatio` and `probText` are deleted**, not stubbed. `roleStageOf` is the single source of `k`, `n`, `condsMet`, `condsTotal`, `quit`, `current`; a one-line helper `stageName(rs)` (`rs.current ? rs.current.s.name : "모든 단계 충족"`) replaces `sp.name`. `condValue`, `condText`, `roleStageOf`, `quitText`, `stageLine`, `roleVerdictDue`, `lastVerdictOf` are byte-identical.
3. **Home has exactly two blocks after the CV, as today, and no `%`**: with stages, a one-row headline button `단계 {k}/{n} {stageName} · 조건 {c}/{m} ›` (`title={stageLine(rs)}` unchanged, so the quit text stays on the title); with a role but no stages, a button `{role.name} · 단계 없음 — AI 판정에서 받거나 세부 수정에서 적어요 ›`; without a role, the inert `<p>` `롤모델 미설정 — 설정에서 롤모델을 정해요` (the reader's existing wording, replacing the `근접도` line). The verdict caption under the headline goes with the bar — "no second line" is read literally; the verdict date stays on the `롤모델` screen and in the reader's `롤모델 판정` section.
4. **The role screen's verdict lines**: the card's second line is `단계 {k}/{n}` alone; the history delta is `단계 {a} → {b} ({date a} → {date b})`; history entries print `단계 {k}/{n}`; the current timeline node's title row loses its right-hand `진행 {pct}%` span (nothing added); the journey line becomes `{stageLine(rs)}` — the exact existing fact line (`롤모델 k/n단계 · 조건 c/m · 전환 조건 …`) — so the quit text is still stated on the screen; `RoleStageLines` keeps its `stageLine(rs)` line and drops its `진행 … · 전체 …` line and every bar.
5. **`RoleGradeSection`** keeps the per-area requirement lines, drops the bars and the legend paragraph (it explains the bars and names `근접도`), and gains the `rg === null` guard TD-29 recorded: without requirement grades it prints `요구 등급 없음 — 세부 수정에서 정해요` instead of `모든 요구 영역을 충족했습니다.` (the `근접도 {match}%.` tail of that sentence is dropped).
6. **The briefing's `next` item** splits its old `!rg` branch in two so no line names `근접도`: `!state.role` → `롤모델 미설정 — 설정에서 롤모델을 정해요`; a role without requirement grades → `요구 등급 없음 — 세부 수정에서 정해요`; no gaps → `모든 요구 영역 충족`; the gap line is byte-identical. (On the demo save the item is the gap line, so the briefing text is byte-identical there.)
7. **The daily packet line**: `- 롤모델 미설정` without a role; `- 롤모델 {name} · 단계 {k}/{n} · 조건 {c}/{m}` with stages; `- 롤모델 {name} · 단계 없음` with a role and no stages (the old line printed `- 롤모델 미설정` for a role without targets; the role's name is a fact the packet may state).
8. **The role packet head** asks for four verdict lines (`요약·근거·현재 위치·부족한 것`), the JSON template loses `"probability"`, and rule 1 of the head gains one sentence — `달성 가능성을 숫자로 쓰지 않아요.` — so the AI is told not to state a likelihood figure in its free text either (the summary is shown verbatim; the app cannot strip a number the AI writes anyway — TD row). No other head line changes.
9. **The parser ignores `probability`** the way it ignores `tasks`: not inspected, not copied. `importRoleVerdict` writes no `probability` key; an older verdict already in `role.verdicts` is never touched or stripped (an E2E step proves it).
10. **The RANK UP overlay** loses its three proximity lines and the `roleFrom` / `roleTo` / `roleTargeted` data; `promoteArea` no longer computes a before/after figure. The overlay reads `RANK UP`, the area, the rank and `증거로 증명된 승급입니다.`.
11. **Copy that named `근접도` elsewhere**: `SettingsModal`'s caption → `원하는 모습을 적고 AI 판정으로 단계를 받거나, 세부 수정에서 요구 등급과 단계를 정해요.`; `saveRole`'s toast → `롤모델 기준 저장 · 단계 {m}건 · 요구 등급 {n}건` (the same shape as `AI 판정 저장 · 단계 {a}건 · 요구 등급 {b}건`); `resetRole`'s toast → `롤모델 삭제 — 단계 계산 대상 없음`; the `roleEdit` caption → `조건은 앱의 기록으로 계산돼요.`; the `영역 등급` summary → `요구 영역 {n}개 · 부족 {g}개` or `요구 등급 없음 — 세부 수정에서 정해요`.
12. **Rule 7's 2026-09-18 amendment** (which says the verdict states a probability, that `roleGap` is untouched and that the stage progress percentage is a second number) gets **one appended italic sentence** cross-referencing the Rule 14 amendment, so the canonical rule text does not contradict the code. No heading is added; Rule 13 is untouched. The user may veto this sentence; the Rule 14 paragraph then carries the whole statement.
13. **Allowed residue after the acceptance greps** (decided here so the implementer does not guess): in `src/` — the word `확률` inside the demo verdict's summary prose (`… 도달 확률은 낮아요.` — an AI-stated sentence, not a figure) and the one state-comment clause of item 7 saying a probability written before 2026-09-18 is unread; in `tools/e2e/` — `probability: 10` / `probability: 35` inside planted fixtures and the pasted reply (they prove the field is ignored and left untouched), `pct` in `run.js`'s coverage summary (not a role-model figure), and `tools/harness/verify.js`'s coverage `pct`. Nothing else.
14. **`await step(` count stays 255**: the new assertions (a legacy `probability` survives untouched and renders no `%`; the RANK UP overlay carries no proximity line; no `%` anywhere on home or the role screen) are added to existing steps.
15. **`flow8.js`'s stage-line assertion is corrected in passing**: it reads the headline's `innerText` and expects `전환 조건 미충족 (0/1)`, which has lived on the button's `title` since the story-verdict change (the suite never ran — TD-44). The helper returns `{ text, title }` and the quit text is asserted on `title`; `조건 0/2` / `조건 1/2` are asserted on the visible text, which this plan brings back.
16. **Screenshots are regenerated** (`npm run build:demo` → `node tools/harness/gen-screenshots.js`); `home.png` changes (the headline row without the bar, the caption and the proximity line); the other five are expected byte-identical and the progress note says whether they are.

## Context read

- `AGENTS.md` §3, §4, §6, §7; `docs/PLANS.md`; `docs/design-docs/core-beliefs.md` rules [7](../../design-docs/core-beliefs.md#rule-7) (the 2026-09-18 amendment names the probability), [9](../../design-docs/core-beliefs.md#rule-9), [12](../../design-docs/core-beliefs.md#rule-12), [13](../../design-docs/core-beliefs.md#rule-13), [14](../../design-docs/core-beliefs.md#rule-14); `ARCHITECTURE.md` (Goal engine, Daily assistant, Tabs, Modals, the status paragraph, glossary rows `롤모델 근접도` / `단계 (롤모델)` / `판정 (롤모델)`); `docs/FRONTEND.md` (numbers `font-mono`; derived in render); `docs/design-docs/metrics-and-role-model.md` (proximity section lines 10–19, the stage section 22–27, `stageProgressOf` section 155–176, the verdict sections 120–233, the screen section 246–353), `scoring-engine.md` (98), `assistant-bridge.md` (47, 101, 320, 337, 346, 360, 376, 381); `docs/product-specs/home.md` (4–14, 40–69, 96–97), `feedback-overlays.md` (10, 16–18, 73, 75), `evidence-modals.md` (no mention), `daily-briefing.md` (no mention — row 26 describes the `다음 단계` line's target only), `daily-reader.md` (80, 83, 165), `growth.md` (4, 8, 12, 13); the completed `docs/exec-plans/completed/2026-09-18-role-model-story-verdict.md` and `2026-09-18-role-model-screen.md` (shape, baselines and progress-note conventions followed). Working tree clean at `87ebcc0`, schema v28, **255** `await step(` calls (`flow.js` 38, `flow2.js` 16, `flow3.js` 25, `flow4.js` 23, `flow5.js` 19, `flow6.js` 6, `flow7.js` 27, `flow8.js` 28, `flow9.js` 10, `flow10.js` 32, `flow11.js` 31), `modal.type` count 39, last tech-debt row TD-90, `src/LifeManager.jsx` 12,174 lines, `Bar` used 8 times (4 of them on role surfaces; the other 4 keep the component alive).
- Code (grepped, line numbers at `87ebcc0`): `roleGap` 2049–2059; the stage-block banner comment 2513–2517 (`a second number beside roleGap … rule 14`); `condValue` 2550, `condText` 2581, `roleStageOf` 2588–2604 (its comment names `roleGap`), `quitText` / `stageLine` 2605–2606; the region banner 2608–2612 (`… a probability the app never turns into …`); `lastVerdictOf` 2622, `probText` 2623, `condRatio` 2624–2625, `stageProgressOf` 2626–2640, `roleVerdictDue` 2641–2648; `roleRecommendations` 2678–2700; `buildBriefing`'s `next` item 3072–3088 (`근접도` at 3075–3076); `buildReader`'s role section 3246–3255 (`sp`, `probText`); `buildAssistantPacket` 3334 (`rg`) and 3371–3374 (the `- 롤모델 …` line); `ROLE_PACKET_HEAD` 3793–3803 (rule 1 at 3795, rule 5 at 3799, the JSON template 3801); the packet comment 3806–3816; `buildRoleVerdictPacket` 3817–3878 (`verdictLines` 3845–3849); `parseRoleVerdictReply` 3876–3935 (`probability` 3890, 3893); the state-shape comment 4290–4323 (`role` 4290–4299, the derived-values paragraph 4306–4323); `demoState` `s.role` 4724–4749 (`probability: 30` 4734, `probability: 20` 4740, the comment 4725–4728); `HomeTab` 5354–5441 (`rg` 5354, `sp` 5355, `last` 5356, the headline 5410–5426, the proximity block 5427–5441); `RoleStageLines` 6257–6287; `RoleGradeSection` 6288–6380 (legend 6293, bars 6305–6316, `근접도` 6322); `SettingsModal` caption 7164; `RoleModelModal` caption 7408; `RoleModal` 7420–7602 (`sp` 7436, `pctText` 7444, the card line 7469, the delta 7492–7494, the history line 7499, the current node 7532–7537, the condition bars 7545–7547, the journey line 7580, the summary 7596); `RoleVerdictModal` 10511 (the probability line 10549); `Overlay` gradeup 10614–10629 (the proximity branch 10620–10627); `promoteArea` 10926–10940 (`rBefore` 10929, `rAfter` 10935, `roleTargeted` 10936, the overlay props 10937); `saveRole` toast 11122; `importRoleVerdict` 11134–11138 (the `probability` spread 11137); `resetRole` toast 11166.
- E2E surfaces (grepped): `flow.js` 246–268 (`home is one CV with the proximity line under it`: the `P` text at 261), 440–464 (the demo sweep's headline, caption, screen and reader assertions); `flow2.js` 145 (a comment naming proximity), 164–190 (`role-model proximity sits under the CV and matches roleGap`); `flow3.js` 159–205 (`the proximity line opens the role screen, whose grade-gap section expands to the squared bars`), 226–232 (`proximityFigure`), 244–300 (the stage step: `proximityFigure` before/after, `진행 0%`, `전체 0% · 전환 조건 미충족`), 317 (a planted `probability: 10`), 623 (the `P` text after the reset), 693 (a planted `probability: 10`), 736–769 (the reply step: `probability: 35` in the reply, `AI 추정 확률 35%` asserted twice, `v.probability !== 35`), 786–848 (`readHeadline`'s `cap` / `prox` / `precedes`, the progress step's `진행 0%` / `25%` / `100%`, `proximityFigure` ×4), 850–880 (the reader step — unchanged); `flow8.js` 1025–1041 (the stage-line helper — default 15); `flow5.js` 95 (`READER_SECTIONS` — unchanged); `tools/e2e/README.md` 123, 133–141, 153, 170.
- Rules touched, by number: [14](../../design-docs/core-beliefs.md#rule-14) — the proximity number and its curve are retired by the user's decision; this plan writes the dated amendment and keeps the original sentence as history (heading count 19). [7](../../design-docs/core-beliefs.md#rule-7) — no AI touchpoint is added; the fifth packet asks for *less* (no probability) and the parser reads less; one appended sentence to its 2026-09-18 amendment (default 12). [9](../../design-docs/core-beliefs.md#rule-9) — nothing new is stored; two derived figures stop being derived. [12](../../design-docs/core-beliefs.md#rule-12) — no schema change; the unread `probability` field is documented, not migrated. [13](../../design-docs/core-beliefs.md#rule-13) — untouched: every remaining line is a fact (`k/n`, `c/m`, `value/min`, grade names, dates); no copy is softened, and the removal of a number is the user's decision, not a softening. Rules 1–6, 8, 10, 11, 15–19: untouched (no payout, D value, matrix row, evidence tier, activity kind or task path changes; `certByTitle` and the recommendation tiering are byte-identical).

## Prompt

You are the implementer for Life Manager (`src/LifeManager.jsx`, Vite + React 18, Tailwind v3 core utilities only). Execute Phase 1 of this plan, then run the gates and stop for the cleanup pass; Phase 2 is the docs-syncer's. Today is 2026-09-18; the schema is v28 and **stays v28** (no `@schema` change, no `migrate` block, no `v` bump, `flow4.js` untouched); the working tree is clean at `87ebcc0`.

**Standing constraints.**
- Rules by number: [7](../../design-docs/core-beliefs.md#rule-7), [9](../../design-docs/core-beliefs.md#rule-9), [12](../../design-docs/core-beliefs.md#rule-12), [13](../../design-docs/core-beliefs.md#rule-13), [14](../../design-docs/core-beliefs.md#rule-14). Never touch a `store` call site, `CERTS` / `EXAMS` / `WEIGHT_MATRIX` / `CERT_W_EXC` / `DIR_ALIAS` / `DIR_CATS`, any `migrate` block, `freshState`, a `liferpg-*` key, `condValue`, `condText`, `roleStageOf`, `quitText`, `stageLine`, `roleVerdictDue`, `lastVerdictOf`, `ROLE_STAGE_SEED`, `seedStages`, `COND_TYPES`, `ROLE_COND_ACTIONS`, `ROLE_STORY_TEMPLATES`, `storyWithTemplate`, `stageWorkOf`, `certByTitle`, `heldCertsOf`, `buildWorkPacket`, `buildPrepPacket`, `buildReviewPacket`, `parseAssistantReply`, `parseWorkReply`, `parsePrepReply`, `parseReviewReply` (if present), the root stage-overlay effect, the `stage` branch of `Overlay`, `RoleModelModal` beyond its one caption, `saveRoleStory`, `goRoleAction`. `buildBriefing`, `buildReader`, `buildAssistantPacket`, `buildRoleVerdictPacket` and `parseRoleVerdictReply` change **only** in the lines named below. Nothing you change may pay P, create a trophy, change `areas[].grade`, or write `act`, `tasks`, `goals`, `room`, `exams`, `certBest`, `deals`, `folio`, `milestones`, `leads`, `notices`, `work`, `journal`, `profile`. The only state keys any edited handler writes are the ones it writes today (`role` in `saveRole` / `importRoleVerdict` / `resetRole`; `areas` / `room` in `promoteArea`).
- Language: English identifiers, comments, E2E step names and log strings; Korean only in UI copy (`해요체`), E2E selector/assert arguments matching UI copy, and regexes matching UI copy. Comments may name data rows in Korean and may quote UI copy in backticks as the neighbouring comments do; nothing else Korean in a comment. Rewrite — do not delete — every comment that describes a retired figure as current behaviour; a comment may say a thing was retired on 2026-09-18 in one clause, no more.
- UI: the seven-tab `NAV` is unchanged; the headline row fits one line at 390 px (`getBoundingClientRect().height` ≤ 32 px); numbers, dates and counts `font-mono`; rose for unmet, emerald for met, cyan for the current stage; no arbitrary Tailwind values; no new icon. Do not add a bar, a ring, a dot scale or any other progress drawing — the user deferred that decision.
- Copy is quoted verbatim below; use it exactly. Refusals and toasts end in `요.` / `요` as the neighbouring ones do. Facts and places only — no encouraging copy.
- Keep every top-level helper a top-level `const` (`tools/harness/smoke-logic.js` lifts by name; it lifts `ROLE_COND_ACTIONS` and `COND_TYPES` only, which do not change).
- E2E: write steps to the conventions of `flow3.js` (helpers `h.reload`, `h.overlayText`, `h.setValue`, `h.openSettings`, `clickInModal`, `clickInModalExact`, `clickText`, `clickTab`, `expectText`, `closeModal`, `modalError`, `readState`, `patchSave`, `dstrIn`; `window.confirm = () => true` before a confirmed action; a `finally` that restores every plant), parse with `node --check`, **never run** `npm run verify`, `node tools/e2e/run.js` or `node tools/harness/verify.js`.
- Gates: `npm run build` · `npm run finish` (exit 0) · `npm run lang:check` · `npm run smoke` · `npm run docs:gen && npm run docs:check` (the symbol index and `db-schema.md` regenerate — `db-schema.md` must still say v28 / 18 blocks / 14 keys, and its `role` lines must no longer name `probability?` or `roleGap`) · `node --check` on each edited `tools/e2e/*.js` · `npm run build:demo` → `node tools/harness/gen-screenshots.js`.
- Throwaway checks go in the session scratchpad, never in the repo: `npm run build:demo` → `release/life-demo.html`, opened over `file://` in the Chrome `launchBrowser()` from `tools/harness/lib/source` launches, `page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 })`, `데모 데이터로 둘러보기`, plants through `localStorage.setItem("liferpg-state-v1", …)` + reload. **Before editing, capture the baselines** from the demo save to the scratchpad: the daily packet, the work packet, the prep packet (for the demo's first meeting-project event), the review packet, the role verdict packet, the briefing text, and a **numbers baseline** — a node script that lifts `roleGap`, `roleStageOf`, `roleVerdictDue`, `roleRecommendations`, `condValue`, `condText` (with their dependencies) from `git show HEAD:src/LifeManager.jsx` and prints `JSON.stringify` of each on (a) the demo save, (b) the demo save with `role.stages` replaced by the three-stage `flow3.js` fixture, (c) the demo save with `role = null`, (d) the demo save with `role.stages` deleted. After the edit the same script lifts `roleAreas` in `roleGap`'s place. Acceptance states which outputs are byte-identical and which differ in exactly the lines this plan names.

### Phase 1 — the code, the E2E, the Rule 14 amendment, the demo, the screenshots

**Goal.** No `%` is computed, stored, asked for, parsed or shown on any role-model surface; the fact lines that exist today carry the surfaces; the E2E describes it; Rule 14 records the retirement.

**Files.** `src/LifeManager.jsx`; `docs/design-docs/core-beliefs.md` (Rule 14 amendment; one sentence under Rule 7's 2026-09-18 amendment); `tools/e2e/flow.js`, `flow2.js`, `flow3.js`, `flow8.js`, `tools/e2e/README.md`; `public/screenshots/*.png` (regenerated).

**1. Engine — `roleGap` → `roleAreas`** (in place, Goal engine region):
```js
// The role model's per-area requirement facts: the required grade, the verified grade and the steps still missing.
// The proximity percentage that used to be averaged from these items was retired on 2026-09-18 (rule 14 amendment):
// nothing here scores, weights or averages — the items are read as they are.
const roleAreas = (state) => {
  const r = state?.role;
  if (!r) return null;
  const items = (state.areas || [])
    .filter((p) => (r.targets?.[p.id] || 0) > 0)
    .map((p) => ({ area: p, need: r.targets[p.id], have: p.grade, gap: Math.max(0, r.targets[p.id] - p.grade) }));
  if (!items.length) return null;
  return { name: r.name, items };
};
```
`roleRecommendations`: `const areas = roleAreas(state); const gaps = (areas?.items || []).filter((i) => i.gap > 0).map(…)` — the map body byte-identical — `return { areas, gaps };`. Its comment: `Standard achievements that would close each role-model gap. Shared by RoleGradeSection and the briefing; the tiering and payout logic is unchanged (rule 15).`

**2. Stage helpers.** Delete `probText`, `condRatio`, `stageProgressOf` and their comments. Add beside `stageLine`:
```js
const stageName = (rs) => (rs.current ? rs.current.s.name : "모든 단계 충족");
```
Rewrite the three comments that call the stage count "a second number beside `roleGap` (rule 14)": the stage-block banner (2513–2517) ends `… are derived at render (rule 9), and nothing here pays, promotes, moves a grade or produces a percentage (rule 1; the rule 14 amendment of 2026-09-18). Storage: …`; `roleStageOf`'s comment becomes `// Derived at render, never stored (rule 9); counts and met flags only — no ratio, no percentage (rule 14 amendment).`; the region banner (2608–2612) becomes `/* ── Role story and verdicts (2026-09-18) ── */` with `… newest first, clipped text the app never turns into a grade, payout or figure; a probability field written by the pre-2026-09-18 template is unread) …` and the storage arithmetic unchanged.

**3. `buildBriefing`'s `next` item** (default 6):
```js
const { areas, gaps } = roleRecommendations(state);
let nextItem;
// Without a role model the line opens the role screen itself: on home the same fact is an inert line
if (!state.role) nextItem = { kind: "next", severity: 2, text: "롤모델 미설정 — 설정에서 롤모델을 정해요", action: { type: "role" } };
else if (!areas) nextItem = { kind: "next", severity: 2, text: "요구 등급 없음 — 세부 수정에서 정해요", action: { type: "role" } };
else if (!gaps.length) nextItem = { kind: "next", severity: 1, text: "모든 요구 영역 충족", action: { type: "role" } };
else { … byte-identical … }
```

**4. `buildReader`'s role section**: `const rs = roleStageOf(state, today);` replaces `sp`; the two changed lines and the comment above the block:
```js
/* The role verdict (2026-09-18) — the monthly re-assessment line lives in the reader, not the briefing: the briefing
   feeds the daily packet, and the verdict's text must not travel back into a packet. One derived item. */
const d = roleVerdictDue(state, today);
const rs = roleStageOf(state, today);
const lastStage = d.last ? Math.min(d.last.stageK, d.last.stageN) : 0;
const roleLine = !state.role ? "롤모델 미설정 — 설정에서 롤모델을 정해요"
  : !d.last ? "롤모델 판정 없음 — 원하는 모습을 적고 AI에게 물어요"
  : d.due ? `롤모델 재판정 — 마지막 ${d.last.date} · ${d.days}일 지남${d.stageRose && rs ? ` · 단계 ${lastStage} → ${Math.min(rs.k, rs.n)}` : ""}`
  : `롤모델 판정 · 마지막 ${d.last.date} · ${d.days}일 지남 · 단계 ${lastStage}/${d.last.stageN}`;
```

**5. `buildAssistantPacket`**: delete `const rg = roleGap(state);`; add `const rs = roleStageOf(state, today);` beside it; the second `stateLines` entry becomes
```js
!state.role ? "- 롤모델 미설정" : rs ? `- 롤모델 ${state.role.name} · 단계 ${Math.min(rs.k, rs.n)}/${rs.n} · 조건 ${rs.condsMet}/${rs.condsTotal}` : `- 롤모델 ${state.role.name} · 단계 없음`,
```
Everything else in the builder byte-identical.

**6. The role packet.** In `ROLE_PACKET_HEAD`, rule 1, rule 5 and the JSON template line become:
```js
  "규칙: 1) 사실과 숫자만 써요. 격려·낙관·희망 표현은 쓰지 않아요. 달성 가능성을 숫자로 쓰지 않아요. 해요체로 써요.",
  "5) 답변 형식: ① 판정 4줄 이내 (요약·근거·현재 위치·부족한 것) ② 마지막에 아래 JSON 블록 1개 (단계 제안이 없으면 \"stages\": [], 등급 제안이 없으면 \"areas\": {}).",
  '{"verdict":{"summary":"...","basis":"...","position":"...","gaps":["..."]},"stages":[{"name":"...","why":"...","conds":[{"type":"...","arg":"...","min":0}]}],"areas":{"<영역 이름>":1-8},"note":"한 줄"}',
```
`verdictLines` in `buildRoleVerdictPacket` becomes:
```js
const verdictLines = last
  ? [`- ${last.date} · 단계 ${Math.min(last.stageK, last.stageN)}/${last.stageN} · ${oneLineText(last.summary, ROLE_VERDICT_SUMMARY)}`]
  : [];
```
The builder comment's last sentence becomes:
```js
   counts and the last verdict are never dropped. Derived on demand, never stored (rule 9); the last verdict's text
   travels only here, as `## 지난 판정`, never into the daily packet or the briefing. */
```
`parseRoleVerdictReply`: delete the `p` line and the `probability:` property; its comment gains one sentence: `A probability key, which a reply written to the pre-2026-09-18 template may still carry, is ignored, not inspected.` `importRoleVerdict`: the record is `{ id: uid(), date: today, summary: verdict.summary, basis: verdict.basis, position: verdict.position, gaps: verdict.gaps, stageK: rs ? rs.k : null, stageN: rs ? rs.n : 0, source: "ai" }` (drop the spread).

**7. State-shape comment** (4290–4299, 4306–4323 — the source of `db-schema.md`). The `role` lines become:
```js
 *   role: { name, targets{areaId: requiredGrade(1-8)},             // requirement grades; the per-area gap facts are derived (`roleAreas`)
 *           stages?[{ id, name, conds[{ type, arg?, min }] }],      // role stages (v28, optional): fact conditions evaluated from the save
 *                                                                 // (`roleStageOf`); the current stage is derived, never stored
 *           story?, verdicts?[{ id, date, summary, basis, position, gaps[], stageK, stageN, source("ai") }],
 *                                                                 // story (2026-09-18, optional, ≤ 2,000 chars): the user's own `원하는 모습`,
 *                                                                 // sent verbatim in the role verdict packet; verdicts (optional, newest first,
 *                                                                 // ≤ 24): AI-stated, unverified — clipped text the app never turns into a grade,
 *                                                                 // payout or figure; a `probability` written before 2026-09-18 is unread; the raw
 *                                                                 // reply is never stored
```
In the derived-values paragraph: `role proximity (\`roleGap\`)` → `the role-model gap facts (\`roleAreas\`)`, and the clause `the stage progress and journey figures (\`stageProgressOf\`), ` is deleted.

**8. `demoState`**: delete `probability: 30,` and `probability: 20,`. The comment's last sentence becomes:
```js
  // no overlay fires on demo entry. Stage 1 reads `deals_active 1/1` met and `payment_paid 'deposit' 0/1` unmet → the
  // headline `단계 1/9 계약 기반 개발자 · 조건 3/14`.
```
The summary prose is unchanged (default 13).

**9. `HomeTab`** (default 3): delete `rg`, `sp`, `last`; add `const rs = roleStageOf(state, today);`. Replace both blocks after the CV `<section>` with:
```jsx
{/* The stage line (2026-09-18): the current stage and the condition count — facts from `roleStageOf`, derived at render
    (rule 9); the quit text stays on `title`. No percentage renders here since the rule 14 amendment; a role without
    stages states that, and no role model is an inert fact (the role model is set in settings). */}
{rs ? (
  <button onClick={onRole} title={stageLine(rs)} className="w-full text-left flex items-center gap-1.5 px-1 text-sm active:opacity-70">
    <span className="text-zinc-500 shrink-0">단계</span>
    <span className="font-mono font-bold text-cyan-300 shrink-0">{Math.min(rs.k, rs.n)}/{rs.n}</span>
    <span className="text-zinc-200 truncate">{stageName(rs)}</span>
    <span className="font-mono text-cyan-300 shrink-0 ml-auto">· 조건 {rs.condsMet}/{rs.condsTotal}</span>
    <span className="text-zinc-600 shrink-0">›</span>
  </button>
) : state.role ? (
  <button onClick={onRole} className="w-full text-left px-1 text-xs text-zinc-500 active:opacity-70">{state.role.name} · 단계 없음 — AI 판정에서 받거나 세부 수정에서 적어요 ›</button>
) : (
  <p className="px-1 text-xs text-zinc-500">롤모델 미설정 — 설정에서 롤모델을 정해요</p>
)}
```
`<main>` keeps exactly two children after the CV card is counted (`flow.js` asserts `count === 2`).

**10. `RoleStageLines({ state, rs, today })`**: the signature takes `rs`; the header row is unchanged; the per-condition block, the deleted line and the new comment:
```jsx
/* The current stage, its condition lines and the next milestone — printed by the `사업` gap block of `RoleGradeSection`.
   Every line is derived at render (rule 9); unmet conditions are rose, met emerald; no ratio, no bar, no percentage
   (rule 14 amendment of 2026-09-18). */
…
{(rs.current?.results || []).map((r, j) => (
  <div key={j} className={`text-xs font-mono ${r.met ? "text-emerald-400" : "text-rose-400"}`}>- {r.text}</div>
))}
{/* the `진행 … · 전체 …` line is deleted; `stageLine(rs)` and the next-milestone line stay */}
```

**11. `RoleGradeSection`** (default 5): `const { areas, gaps } = roleRecommendations(state); const rs = roleStageOf(state, today);`; delete `legend` and the `{legend}` render; per area keep the label row (its text is unchanged) and delete the `div.flex.h-2` bar and its comment; the branch after the lines and the `staged` call:
```jsx
{!areas ? (
  <p className="text-xs text-zinc-500">요구 등급 없음 — 세부 수정에서 정해요</p>
) : gaps.length === 0 ? (
  <p className="text-sm text-zinc-400">모든 요구 영역을 충족했습니다.</p>
) : ( … the gap blocks, unchanged except the two lines below … )}
…
const staged = rs && i.area.name === "사업";
…
{staged && <div className="mt-2"><RoleStageLines state={state} rs={rs} today={today} /></div>}
```
Section comment:
```jsx
/* ── The grade-gap section of the role screen (2026-09-18): the per-area requirement lines, then each gap's next gate,
   its job-field chips and the standard achievements that would close it. No bar and no figure since the rule 14
   amendment. Nothing here is stored (rule 9). ── */
```

**12. `RoleModal`** (default 4): `const rs = roleStageOf(state, today); const work = rs ? stageWorkOf(state, today, Math.min(rs.k, rs.n)) : []; const { areas, gaps } = roleRecommendations(state);` — delete `sp` and `pctText`; `!rs` replaces `!sp` in `스토리라인`; the current node's title row keeps its first two spans and loses the right-hand span and the `Bar` beneath; each condition block loses its `Bar` (the line and the `지금 할 것` button stay; the `sp.conds[j]` comment goes). The changed lines:
```jsx
{/* the newest verdict card's second line */}
<div className="text-xs font-mono text-cyan-300">{stageText(last)}</div>
{/* the history delta */}
<div className="font-mono text-xs text-cyan-300">
  단계 {Math.min(delta.a.stageK, delta.a.stageN)} → {Math.min(delta.b.stageK, delta.b.stageN)} ({delta.a.date} → {delta.b.date})
</div>
{/* each history entry's second line */}
<div className="text-xs font-mono text-zinc-300">{stageText(v)}</div>
{/* the line under the timeline, in the journey line's place */}
<div className="text-xs font-mono text-zinc-400 mt-2">{stageLine(rs)}</div>
{/* the 영역 등급 summary */}
<div className="text-xs font-mono text-zinc-500">
  {areas ? `요구 영역 ${areas.items.length}개 · 부족 ${gaps.length}개` : "요구 등급 없음 — 세부 수정에서 정해요"}
</div>
```
The component comment's last clause becomes `… the verdict stays the AI's own statement under its unverified label (rule 13); no percentage of any kind renders here (rule 14 amendment of 2026-09-18).`

**13. `RoleVerdictModal`**: delete the `{probText(v.probability)}` div. **`Overlay`**: delete the `data.roleTo != null && (…)` block (default 10). **`promoteArea`**: delete `rBefore`, `rAfter`, `roleTargeted` and the three props from the `setOverlay` call.

**14. Copy** (default 11): `SettingsModal` caption; `saveRole` toast `` `롤모델 기준 저장 · 단계 ${(rm.stages || []).length}건 · 요구 등급 ${Object.values(rm.targets || {}).filter((v) => v > 0).length}건` ``; `resetRole` toast; the `roleEdit` caption.

**15. Rule 14 amendment** — append to `docs/design-docs/core-beliefs.md` directly under Rule 14's existing sentence (no new heading; the count stays 19):
> **Amendment 2026-09-18 (user decision):** the proximity percentage and its squared curve are **retired** at the user's request — no `match` figure, no `roleGap`, no segmented bars, no `롤모델 근접도` line, no proximity delta on the RANK UP overlay, and no percentage of any kind on the role model: the stage progress and journey figures (`stageProgressOf`, `condRatio`) and the AI-stated verdict probability leave with it, and the fifth packet no longer asks for one. What remains are facts: the area requirement grades (`role.targets`) and the per-area gap items (`roleAreas` → `{ area, need, have, gap }`, the `{RANKS[have].name} / 요구 {RANKS[need].name} · {gap}단계 부족 | 충족` lines, the `요구 영역 {n}개 · 부족 {g}개` summary and the recommendations built on the gaps), and the stage facts (`단계 k/n · 조건 c/m`, `충족` / `미충족`, the `condText` values). The sentence above stays as history: reintroducing any proximity number needs a new user decision, and it must not be linear. What replaces the numbers is deferred to a later plan; nothing here changes Rule 13 (facts and numbers only).

Under Rule 7's amendment of 2026-09-18, append one italic sentence (default 12): *Later the same day (user decision): the verdict carries no probability and no proximity or stage percentage exists any more — see the Rule 14 amendment; the parser reads `summary`, `basis`, `position` and `gaps` only, and a `probability` key in a reply is ignored, not inspected.*

**16. E2E (written, not run).**
- `flow.js` 246–268 → step name `home is one CV with the role line under it`; the `P` text → `롤모델 미설정 — 설정에서 롤모델을 정해요`; add `if (/\d+%/.test(res.all)) throw new Error("home states a percentage: " + …)`.
- `flow.js` 440–464 (demo sweep): the headline `startsWith("단계 1/9 계약 기반 개발자")` and `includes("· 조건 3/14")`, the `title` unchanged, no `AI 추정 확률` caption (assert `!/\d+%/.test(headline.text)`); the screen: `롤모델`, `단계 1/9`, `1단계`, `계약 기반 개발자`, `- 입금 확인된 일시금 수 'deposit' 0/1`, `계약 목록 ›`, `연결된 업무 없음`, `롤모델 1/9단계 · 조건 3/14 · 전환 조건 미충족 (0/1)`, `2단계`, `조건 1개`, and `!/\d+%/.test(overlayText)`; `판정 기록 2건 ›` → `` `단계 1 → 1 (${demoMinus29} → ${demoToday})` `` (compute `demoMinus29` with the same date helper shifted −29 days); `펼치기 ›` → `/ 요구` present, `칸 하나` absent, `document.querySelector(".fixed.inset-0 div.flex.h-2") === null`, still no `%`; the reader line → `` `롤모델 판정 · 마지막 ${demoToday} · 0일 지남 · 단계 1/9` ``.
- `flow2.js` 145 comment → `// required grades per area are set here; the role line under the CV states the stage facts, never a percentage`; 164–190 → step name `the role line under the CV states no stages and no percentage for a role model without stages`: the last block is a `BUTTON` whose text is `시니어 하네스 설계자 · 단계 없음 — AI 판정에서 받거나 세부 수정에서 적어요 ›` (the name typed in the previous step is prefixed to whatever `input` held — keep the existing `includes("시니어 하네스 설계자")`), `main` innerText matches no `/\d+%/`, and no stage headline renders (the existing check). Drop the `sq` / `match` computation.
- `flow3.js` 159–205 → step name `the role line opens the role screen, whose grade-gap section expands to the requirement lines with no bar and no percentage`: open via `clickText("단계 없음")`; assert `startsWith("롤모델")`, no `칸 하나 = 등급 한 단계`, contains `요구 영역 `; after `펼치기 ›`: `/ 요구` present, no `div.flex.h-2` in the overlay, `!/\d+%/.test(sheet)`; keep `도감에서 더 보기` and the two `closeModal()`s. Delete the bar-width block.
- `flow3.js` 226–232: replace `proximityFigure` with `` const homePercent = () => page.evaluate(() => /\d+%/.test((document.querySelector("main")?.innerText || ""))); `` and, everywhere it was compared before/after, assert `homePercent() === false` instead (`throw new Error("a percentage renders on home: …")`).
- `flow3.js` 244–300 (the stage step): the screen list → `롤모델`, `스토리라인`, `1단계`, `E2E 첫 계약`, `- 계약 체결 수 'E2E단계고객' 0/1`, `계약 추가 ›`, `2단계`, `조건 2개`, `3단계`, `조건 1개`, `롤모델 1/3단계 · 조건 1/4 · 전환 조건 미충족 (0/1)`, plus `!/\d+%/.test(sheet)`; after one contract the visible headline `includes("· 조건 2/4")`; the `충족` count logic unchanged (the `stageLine` text's `미충족` is stripped by the existing replace).
- `flow3.js` 266–340 (the editor step): the planted `probability: 10` stays with the comment `// a legacy field from the pre-2026-09-18 template: nothing reads it, and the editor's save must leave it in place`; add after the save: `if (r.verdicts?.[0]?.probability !== 10) throw new Error("the legacy probability was stripped or moved: " + JSON.stringify(r.verdicts))`; and, with the role screen open before `closeModal()`, `clickInModalExact("판정 기록 1건 ›")` then assert the overlay text contains `단계 1/9` and matches no `/\d+%|확률/`.
- `flow3.js` 623 → the `P` text `롤모델 미설정 — 설정에서 롤모델을 정해요`.
- `flow3.js` 693–735 (the packet step): keep `probability: 10` in the fixture (same comment); add to `must`: `## 지난 판정`, `` `- ${old} · 단계 1/9 · E2E 이전 판정` ``, `"summary":"..."`; add to `never`: `"probability"` and `확률`; assert `!/\d+%/.test(packet)` explicitly.
- `flow3.js` 736–769 (the reply step): the pasted reply keeps `probability: 35` (comment: `// the pre-2026-09-18 key: the parser must ignore it`); the confirm-sheet list drops `AI 추정 확률 35%` and adds `!/\d+%|확률/.test(sheet)`; after the save the role screen states `E2E 판정 요약` and `단계 1/1` and no `%`; the record check becomes `if (v.date !== today || "probability" in v || v.summary !== …)`.
- `flow3.js` 786–848 (the progress step) → step name `the headline states the stage and the condition count, records move the condition values with no percentage anywhere, and the completion overlay shows once`: `readHeadline` returns `{ row, title, percent }` (`percent` = `homePercent()`'s test on `main`), no `cap`, no `prox`, no `precedes`; assertions: `row === "단계 1/1 E2E 제안 단계 · 조건 0/2"` and `!percent` at the start; after one contract `row` unchanged, `!percent`, and — opening the screen — the line `- 계약 체결 수 'E2E판정고객' 1/2` in rose; the overlay part unchanged; the end `row === "단계 1/1 모든 단계 충족 · 조건 2/2"` and `!percent`.
- `flow3.js` promotion step (~140–157, `증거 제출 · 승급`): before `closeModal()`, read `.fixed.inset-0.z-50` and assert it contains `RANK UP` and matches no `/근접도|\d+%/`.
- `flow8.js` 1025–1041 (default 15): the helper returns `{ text, title }`; `조건 0/2` / `조건 1/2` on `text`, `단계 1/2` / `단계 2/2` on `text`, `전환 조건 미충족 (0/1)` on `title`.
- `tools/e2e/README.md`: lines 123, 133–141, 153 and the `flow.js` row (170) rewritten to the new strings; one status paragraph for this change; the count stays **255** (recount statically).

**17. Screenshots**: `npm run build:demo` → `node tools/harness/gen-screenshots.js`; state in the progress note which of the six files changed (expected: `home.png` only).

**Acceptance (Phase 1).**
- Gates pass; `npm run finish` exit 0 with no allowlist addition; `db-schema.md` v28 / 18 blocks / 14 keys with no `probability?` and no `roleGap`; `npm run smoke` passes.
- **Greps** (run from the repo root):
  - `grep -n "근접도" src tools/e2e` → nothing.
  - `grep -n -i "proximity" src` → nothing (comments rewritten, not deleted).
  - `grep -n -E "roleGap|stageProgressOf|condRatio|probText|journey|pctText" src tools/e2e tools/harness` → nothing.
  - `grep -n -E "\bpct\b" src` → nothing; in `tools/e2e` / `tools/harness` only `run.js`'s coverage lines and `verify.js`'s coverage line (default 13).
  - `grep -n "probability" src` → exactly the one state-comment clause of item 7 and the one parser comment of item 6; in `tools/e2e` only the fixture / reply objects and their comments named in item 16.
  - `grep -n "확률" src tools/e2e` → in `src` only the demo summary prose; in `tools/e2e` only the negative regexes and the `never` list.
  - `grep -n -E "roleFrom|roleTo|roleTargeted" src tools` → nothing.
  - `grep -c "<Bar " src/LifeManager.jsx` → 4 (the non-role uses).
- **Baselines** compared against `HEAD`: the work, prep and review packets **byte-identical**; the briefing text on the demo **byte-identical** (its `next` item is the gap line); the daily packet differs in exactly one line — `- 롤모델 완성차 1차사 하네스 설계 책임 근접도 25%` → `- 롤모델 완성차 1차사 하네스 설계 책임 · 단계 1/9 · 조건 3/14` (state both lengths); the role packet differs in exactly three places — the head's rule 1, rule 5 and the JSON template line, and the `## 지난 판정` line (state both lengths); the numbers dump: `roleStageOf`, `roleVerdictDue`, `condValue`, `condText` and `roleRecommendations(...).gaps` **byte-identical** over the four saves, and `roleAreas` equals the old `roleGap` output with the `match` key deleted (assert with a deep-equal in the script; state the dump's length).
- `git diff` shows no hunk in `condValue`, `condText`, `roleStageOf`, `quitText`, `stageLine`, `roleVerdictDue`, `lastVerdictOf`, `migrate`, `freshState`, `ROLE_COND_ACTIONS`, `ROLE_STORY_TEMPLATES`, `stageWorkOf`, `buildWorkPacket`, `buildPrepPacket`, `buildReviewPacket`, any parser other than `parseRoleVerdictReply`, the `stage` branch of `Overlay`, the root stage-overlay effect (`grabBlock` on `git show HEAD:src/LifeManager.jsx` as the previous plans did). `modal.type` count 39. `await step(` count 255.
- **Throwaway puppeteer** on the demo build at 390 px (0 console errors throughout): home `main` innerText matches no `/\d+%/`; the headline is one row ≤ 32 px reading `단계 1/9 계약 기반 개발자 · 조건 3/14 ›` with the unchanged `title`; the role screen's full text matches no `/\d+%/` before and after `판정 기록 2건 ›` and `펼치기 ›`; the verdict card reads `AI 판단 · 검증되지 않음 · {today}` then `단계 1/9`; the delta reads `단계 1 → 1 ({today − 29} → {today})`; the current node has one emerald and one rose condition line, one `계약 목록 ›` button and **no** element with class `h-1` or `h-1.5` inside the node; the line `롤모델 1/9단계 · 조건 3/14 · 전환 조건 미충족 (0/1)` prints once in `스토리라인`; `펼치기 ›` shows the per-area lines shaped `{area} {have} / 요구 {need} · {gap}단계 부족` (read the exact names from the save) with no `div.flex.h-2`; a planted save with `role.targets = {}` shows `요구 등급 없음 — 세부 수정에서 정해요` twice (summary and expanded section); a planted promotion (through the `PromoteModal` path with a chip) shows a RANK UP overlay with no `근접도` and no `%`; the role packet textarea contains no `probability`, no `확률`, and does contain `판정 4줄 이내` and `## 지난 판정` with `단계 1/9`; pasting a reply that carries `"probability": 35` shows a confirm sheet with no `%`, and the saved record has no `probability` key while the two demo verdicts keep whatever they had (none, after item 8); a planted legacy verdict carrying `probability: 12` renders no `%` on the screen, the reader or home, and survives a `세부 수정 ›` save and a story save byte-identical; the reader's `롤모델 판정` line reads `롤모델 판정 · 마지막 {today} · 0일 지남 · 단계 1/9`; the daily packet's `## 연속·롤모델` section states the new line.
- **Mutation checks** (each built into a mutated demo, probed, reverted; the release demo rebuilt byte-identical to the checked build): (1) leave the `probability:` property in `parseRoleVerdictReply` → the reply step's `"probability" in v` assertion fails (and the grep catches it statically); (2) keep `· 진행 {n}%` on the headline by re-deriving a fraction inline → the `!percent` assertions of the progress step and the demo sweep fail while the numbers dump stays byte-identical — state that the numbers baseline alone cannot see a display figure, which is why the E2E `%` regexes stay; (3) make `importRoleVerdict` strip `probability` from older records → the editor step's `probability !== 10` assertion fails; (4) drop `gap` from `roleAreas` items → the numbers script's deep-equal against `roleGap` minus `match` fails and `roleRecommendations(...).gaps` differs.

### Phase 2 — docs sync (docs-syncer)

Update, each with the facts the Phase 1 progress note states:
- `docs/design-docs/metrics-and-role-model.md` — the proximity section (10–19) rewritten as a `roleAreas` section (`## Role-model requirement facts`) with the formula block replaced by the `items` shape and a dated paragraph that the percentage, the curve, the bars and the legend were retired 2026-09-18 (the old numbers kept in one sentence as history); the stage section's "second figure beside `roleGap`" sentences (22–27); the `stageProgressOf` section (155–176) rewritten as a "stage line and headline (2026-09-18, no percentage)" section; every `probText` / `probability` / `pct` / `journey` mention in the verdict and screen sections (120–233, 246–353); the demo paragraph (228–233) to the new strings; the byte-identity list (345–346).
- `docs/design-docs/assistant-bridge.md` — rows 47 and 101, the fifth-packet paragraphs (320, 337, 346, 360, 376, 381): no probability requested, parsed or stored; the `## 지난 판정` row; the daily packet's `## 연속·롤모델` line shape.
- `docs/design-docs/scoring-engine.md` — line 98.
- `docs/product-specs/home.md` — lines 4–14 (the "one small percentage" framing becomes "one stage line"), the section 40–69 rewritten as a "stage line" section (three states, no bar, no caption, `title`), rows 96–97.
- `docs/product-specs/feedback-overlays.md` — line 10 and the rows 16–18 (the RANK UP overlay's proximity lines removed), the toast rows 73 and 75, the new `롤모델 기준 저장 · 단계 {m}건 · 요구 등급 {n}건` toast.
- `docs/product-specs/daily-reader.md` — row 80, line 83, line 165. `docs/product-specs/daily-briefing.md` — row 26 (three `next` texts). `docs/product-specs/growth.md` — rows 4, 8, 12, 13. `docs/product-specs/evidence-modals.md` — verify no mention (none found).
- `docs/DESIGN.md` — A3 (the proximity line → the stage line), A16/A17 (no bar, no caption, no `%`); `docs/design-docs/information-architecture.md` — lines 6 and 71; `docs/RELIABILITY.md` — rows 28–30, a new E2E-policy sentence (255, the corrected `flow8.js` assertion), the mutation checks and baselines of this change; `docs/SECURITY.md` — lines 46 and 71 (the packet states the stage line, the verdict has no probability); `docs/design-docs/demo-data.md` — lines 161–162, 179 (the 25 % figure retired; the demo's headline and verdict lines); `docs/design-docs/state-lifecycle.md` — lines 20–27, 92–97 (the unread legacy field); `docs/design-docs/evidence-and-promotion.md` — line 78 (`promoteArea` no longer computes a proximity delta); `docs/product-specs/business.md` — line 461; `docs/product-specs/scenario-harness-engineer.md` — steps 15 and 20; `docs/PRODUCT_SENSE.md` — lines 16 and 34; `docs/QUALITY_SCORE.md` — row 34 (rule 14 amended 2026-09-18 — the figure retired; `roleAreas` gap facts verified); `docs/FRONTEND.md` — line 13; `docs/design-docs/index.md` and `docs/product-specs/index.md` — one-line updates; `ARCHITECTURE.md` — Goal engine row (`roleAreas`), Daily assistant row, Tabs (`HomeTab`'s stage line), Modals (`RoleStageLines` takes `rs`), the status paragraph, the glossary row `롤모델 근접도` replaced by `롤모델 요구 영역` (role-model requirement facts, `roleAreas`), rows `단계 (롤모델)` / `판정 (롤모델)`.
- `tools/e2e/README.md` — verify the count and the strings.
- `docs/exec-plans/tech-debt-tracker.md` — close TD-84 (the headline `pct` reset) and TD-89 (the journey figure printed twice) as retired with the figures; TD-28 (the "≈ 70 %" figure) closed — no figure exists; TD-29 updated (the `rg === null` guard now exists; the unreachable-branch note stays); TD-11 and TD-23 reworded (no proximity to recompute); new TD-91 (older verdicts keep an unread `probability` field by design — no migration; a future schema bump may drop it), TD-92 (the AI's free-text summary or basis may still state a likelihood or a percentage, shown verbatim; the head asks it not to), TD-93 (home no longer names the role model once stages exist — the headline names the stage), TD-94 (`flow8.js`'s quit-text assertion had read `innerText` where the text lives on `title` since the story-verdict change — corrected here, never caught because the suite is not run, TD-44); extend TD-44 with this change and the 255 count.
- `docs/design-docs/decision-log.md` — one row dated 2026-09-18 (fourth of the day): the user's decision, the deferral (what replaces the numbers is a later plan), planner defaults 1–16, the Rule 14 amendment and the Rule 7 sentence, the new tech-debt rows, linking this plan once moved.
- `docs/generated/*` by `npm run docs:gen` only; `npm run docs:check` exit 0; move this plan to `completed/`.

## Steps

1. Phase 1 — baselines (six texts + the numbers dump); engine (items 1–2); briefing, reader, daily packet (3–5); the role packet and parser (6); the state comment and the demo (7–8); `HomeTab` (9); `RoleStageLines`, `RoleGradeSection`, `RoleModal`, `RoleVerdictModal`, `Overlay`, `promoteArea` (10–13); copy (14); the Rule 14 amendment and the Rule 7 sentence (15); E2E rewrites and README (16); screenshots (17); gates; greps; baselines compared; puppeteer and mutation checks; progress note here.
   **Progress note — Phase 1 done (2026-09-18, implementer). `npm run verify` was not run (standing instruction).**
   - Code (`src/LifeManager.jsx`, 12,174 → 12,103 lines): `roleGap` → `roleAreas` (no `match`), `roleRecommendations` returns
     `{ areas, gaps }`; `probText` / `condRatio` / `stageProgressOf` deleted, `stageName` added beside `stageLine`; the three
     rule-14 comments rewritten as specified; `buildBriefing`'s `next` item split into the three texts; `buildReader`'s role
     section on `roleStageOf` with no probability; `buildAssistantPacket`'s state line
     `- 롤모델 {name} · 단계 k/n · 조건 c/m` | `- 롤모델 {name} · 단계 없음` | `- 롤모델 미설정`; `ROLE_PACKET_HEAD` rule 1
     (`달성 가능성을 숫자로 쓰지 않아요.`), rule 5 (`판정 4줄 이내 (요약·근거·현재 위치·부족한 것)`) and the JSON template without
     `probability`; `verdictLines` without `probText`; `parseRoleVerdictReply` without the `p` line and the property (comment
     sentence added); `importRoleVerdict` without the spread; the state-shape comment and the derived-values paragraph; the
     demo's two verdicts without `probability` and the demo comment; `HomeTab` (`rs` only: the one-row headline with
     `· 조건 c/m`, the `단계 없음` button, the `롤모델 미설정 — 설정에서 롤모델을 정해요` `P`); `RoleStageLines({ state, rs, today })`
     without bars or the `진행 … · 전체 …` line; `RoleGradeSection` without bars, legend and the `근접도` tail, with the
     `!areas` guard (`요구 등급 없음 — 세부 수정에서 정해요`); `RoleModal` (`rs`, `stageWorkOf(... Math.min(rs.k, rs.n))`, the
     card's `단계 k/n`, the delta `단계 a → b (date → date)`, history `단계 k/n`, the current node without the right-hand span
     and both `Bar`s, `stageLine(rs)` in the journey line's place, the summary `요구 영역 n개 · 부족 g개`); `RoleVerdictModal`
     without the probability line; `Overlay` gradeup without the three proximity lines; `promoteArea` without
     `rBefore` / `rAfter` / `roleTargeted`; the four copy strings of item 14. Four un-enumerated comments that named
     proximity as current behaviour (the Roadmap and Pipeline banners, the Home banner, the `RoleModelModal` stages caption
     comment) were reworded. `<Bar ` count 4; `modal.type` count 39; `await step(` 255 (per-file counts unchanged).
   - Rule text: the Rule 14 amendment paragraph and the Rule 7 italic sentence appended verbatim; `### Rule` count 19.
   - E2E (written, `node --check` clean, never run): `flow.js` home step (`롤모델 미설정 — 설정에서 롤모델을 정해요`, no `%`)
     and the demo sweep (`· 조건 3/14`, no `%` on the headline or the screen, `단계 1 → 1 ({today − 29} → {today})`, no
     `div.flex.h-2`, no `칸 하나`, the reader's `· 단계 1/9`); `flow2.js` role line as a `BUTTON` ending
     `· 단계 없음 — AI 판정에서 받거나 세부 수정에서 적어요 ›` with no `%` on home; `flow3.js` — the promotion step reads the
     RANK UP overlay (`RANK UP`, no `/롤모델|\d+%/`), the grade-gap step opens from `단계 없음` and expects the requirement
     lines with no bar, no legend, no `%`; `homePercent()` / `homeText()` replace `proximityFigure`; the stage step asserts
     `· 조건 1/4` → `2/4` → `4/4` on the visible text and `롤모델 1/3단계 · 조건 1/4 · 전환 조건 미충족 (0/1)` on the screen; the
     editor step asserts the legacy `probability: 10` survives and `판정 기록 1건 ›` shows `단계 1/9` with no `/\d+%|확률/`; the
     reset step's `P` text; the packet step's `must` (`## 지난 판정`, `- {old} · 단계 1/9 · E2E 이전 판정`, `"summary":"..."`,
     `판정 4줄 이내`) and `never` (`"probability"`, `확률`) plus `!/\d+%/`; the reply step (`판정 4줄 이내.`, no `%`/`확률` on the
     confirm sheet, `단계 1/1` on the screen, `"probability" in v` false, the older verdict's field untouched); the progress
     step renamed, `readHeadline` → `{ row, title, percent }`, `조건 0/2` → (one contract: `- 계약 체결 수 'E2E판정고객' 1/2` in
     rose on the screen) → `모든 단계 충족 · 조건 2/2`; the storyline step (not in the plan's list) dropped its `진행 0%`
     expectation for a `!/\d+%/` check. `flow8.js`'s helper returns `{ text, title }` with the quit text on `title`.
     `tools/e2e/README.md`: the listed lines plus the `flow2.js` / `flow3.js` rows and the status paragraphs at 94, 132, 146,
     155 and 161 rewritten (the `근접도` / `확률` / `%` greps cover the README), one status paragraph added, count 255.
   - Gates: `npm run build` ok · `npm run finish` clean (no allowlist) · `npm run lang:check` clean · `npm run smoke` all
     checks passed · `npm run docs:gen && npm run docs:check` clean — `db-schema.md` v28 / 18 blocks / 14 keys, its `role`
     lines name `roleAreas` and no `probability?` field · `node --check` on `flow.js`, `flow2.js`, `flow3.js`, `flow8.js` ·
     `npm run build:demo` + `node tools/harness/gen-screenshots.js`.
   - Greps: `근접도` in `src` / `tools/e2e` → nothing; `proximity` in `src` → one hit, the plan's own item 1 comment (its
     "retired" clause); `roleGap|stageProgressOf|condRatio|probText|journey|pctText` → nothing; `\bpct\b` → only `run.js`'s
     coverage lines and `verify.js`'s coverage line; `probability` in `src` → three comment clauses (items 2, 6 and 7 — the
     plan's own texts; the acceptance counted two); `확률` in `src` → the demo summary prose only, in `tools/e2e` → the
     negative regexes, the `never` list and the README sentence describing it; `roleFrom|roleTo|roleTargeted` → nothing.
   - Byte-identity to HEAD (`87ebcc0`, `grabBlock`): `condValue`, `condText`, `roleStageOf`, `quitText`, `stageLine`,
     `roleVerdictDue`, `lastVerdictOf`, `migrate`, `freshState` (no hunk in 4464–4493), `ROLE_COND_ACTIONS`,
     `ROLE_STORY_TEMPLATES`, `storyWithTemplate`, `stageWorkOf`, `buildWorkPacket`, `buildPrepPacket`, `buildReviewPacket`,
     `parseAssistantReply`, `parseWorkReply`, `parsePrepReply`, `COND_TYPES`, `ROLE_STAGE_SEED`, `seedStages`, `certByTitle`,
     `heldCertsOf` identical; the `stage` branch of `Overlay` and the root stage-overlay effect identical; `RoleModelModal`
     differs by its one caption only (`parseReviewReply` does not exist at HEAD either).
   - Baselines (HEAD demo build, captured before the first edit; recompared on the new build): work 2,652 · prep 1,337
     (the `업무` tab's prep row for `○○물산 주간 점검`) · review 1,945 · briefing 839 — **byte-identical**; the daily packet
     2,419 → 2,430 chars, differing in exactly `- 롤모델 완성차 1차사 하네스 설계 책임 근접도 25%` →
     `- 롤모델 완성차 1차사 하네스 설계 책임 · 단계 1/9 · 조건 3/14`; the role packet 2,434 → 2,408 chars, differing in exactly
     rule 1, rule 5, the JSON template and the `## 지난 판정` line. Numbers dump 17,900 → 17,773 chars over the four saves:
     `roleStageOf`, `condValue`, `condText`, `roleRecommendations(...).gaps` byte-identical; `roleAreas` deep-equals
     `roleGap` minus `match` on every save; `roleVerdictDue` differs on the saves that carry the demo verdicts by exactly the
     `probability` key those records no longer have (item 8) — the function itself is byte-identical.
   - Puppeteer (new demo build, 390 px, 0 console errors, 47/47): home states no `%`; the headline is one 20 px row
     `단계 1/9 계약 기반 개발자 · 조건 3/14 ›` with the unchanged `title`, no horizontal overflow, two blocks after the CV; the
     role screen states no `%` collapsed, after `판정 기록 2건 ›` and after `펼치기 ›`; the card reads
     `AI 판단 · 검증되지 않음 · {today}` then `단계 1/9`; the delta `단계 1 → 1 (2026-08-20 → 2026-09-18)`; the current node has
     one emerald and one rose line, one `계약 목록 ›` button and no `h-1` / `h-1.5` element; the stage line prints once in
     `스토리라인`; the expanded section shows `직업·커리어 실무자 / 요구 리더 · 3단계 부족` and `기본지식 초심자 / 요구 숙련자 · 2단계 부족`
     with no `div.flex.h-2` and no legend; the role packet has no `probability`, no `AI 추정 확률`, no `%`, `판정 4줄 이내` and
     `## 지난 판정` with `단계 1/9` (the word `확률` appears once, inside the demo summary prose — default 13); a pasted reply
     with `"probability": 35` shows a confirm sheet with no `%` / `확률`, the saved record has no `probability` key, the two
     demo verdicts are unchanged and only `role` is written; a planted legacy verdict (`probability: 12`) renders no `%` on
     home, the screen or the reader's role section and survives a `세부 수정 ›` save (toast
     `롤모델 기준 저장 · 단계 9건 · 요구 등급 2건`) and a story save byte-identical; the reader line
     `롤모델 판정 · 마지막 {today} · 0일 지남 · 단계 1/9`; the briefing names no `근접도`; the daily packet's `## 연속·롤모델`
     states the new line; `role.targets = {}` → `요구 등급 없음 — 세부 수정에서 정해요` twice and the briefing's `next` text;
     no stages → the `단계 없음` button and `- 롤모델 {name} · 단계 없음`; `role = null` → the `P`, the briefing's
     `롤모델 미설정 — 설정에서 롤모델을 정해요` and `- 롤모델 미설정`; the settings caption; a promotion through the gate with a
     chip → `RANK UP 사업 실무자 증거로 증명된 승급입니다.` with no `근접도`, `롤모델` or `%`.
   - Mutation checks (each built into its own demo, probed, reverted; the release demo rebuilt byte-identical to the
     checked build): (1) the parser keeps `probability` and the record stores it → the saved record carries
     `probability: 35`, the reply step's `"probability" in v` assertion fails; (2) `· 진행 {n}%` re-derived inline on the
     headline → `단계 1/9 계약 기반 개발자 · 진행 21% ›`, the `!percent` assertions fail while the numbers dump stays
     byte-identical — the numbers baseline cannot see a display figure, which is why the `%` regexes stay in the E2E;
     (3) `saveRole` stripping `probability` from older records → the editor step's `probability !== 10` fails;
     (3b) `importRoleVerdict` stripping it → the reply step's added `verdicts[1].probability !== 10` fails; (4) `gap`
     dropped from `roleAreas` items → the deep-equal fails and `roleRecommendations(...).gaps` becomes `[]`.
   - Screenshots: `home.png` changed (this change: the headline row without the bar, the caption and the proximity line);
     `tasks.png`, `work.png`, `calendar.png`, `meetings.png` byte-identical; `goals.png` differs from the committed file, but
     the HEAD build regenerated today produces the same `goals.png` as the new build — the committed file (a1a400c) was
     stale against HEAD's own build, not moved by this change; the regenerated file is kept.
   - Deviations: (i) the RANK UP regex is `/롤모델|\d+%/` (the plan wrote `/근접도|\d+%/`, which the `근접도` grep on
     `tools/e2e` would hit; `롤모델` catches all three retired branches); (ii) two new E2E error messages initially named
     `영역 등급` and were reworded to `grade-gap section` (lang-check); (iii) the reply step also asserts the older verdict's
     legacy field is untouched; (iv) the editor step's history check is placed before the first `closeModal()` (the save lands
     on the role screen); (v) the README sweep went beyond the plan's line list (see E2E above).
   - Plan errors found: the acceptance greps contradict the plan's own comment texts (`proximity` in item 1, `probability`
     in item 2 — one and three hits, not zero and two); the puppeteer acceptance "no `확률` in the role packet" and "no `%`
     on the reader" cannot hold on the demo (the `## 지난 판정` line quotes the summary prose; the reader's
     `뒤처진 목표 페이스` section states goal-pace percentages, rule 13) — the role-model lines were checked instead;
     mutation (3) names `importRoleVerdict` but the editor step saves through `saveRole` (both variants run); the numbers
     acceptance expected `roleVerdictDue` byte-identical although item 8 changes the demo records it returns; the
     storyline step (`flow3.js` ~455) asserting `진행 0%` was missing from the E2E list.
2. Phase 2 — docs sync as listed; `docs:gen`, `docs:check`; move to `completed/`; progress note here.
   **Progress note — Phase 2 done (2026-09-18, docs-syncer).** Verified every Phase 1 claim against `git show HEAD --stat`/`git log -1` (commit `5a056e7`, subject `feat(role): retire every role-model percentage (phase 1)`) and the current source before writing anything: `roleAreas` (no `match`), `roleRecommendations` returning `{ areas, gaps }`, `stageName` beside `stageLine`, `HomeTab`'s three-state row, `RoleGradeSection`'s `!areas` guard, `RoleModal`'s delta/summary lines, `RoleVerdictModal` without the probability line, `Overlay` gradeup without the proximity block, `promoteArea` without `rBefore`/`rAfter`/`roleTargeted`, `buildBriefing`'s three `next` texts, `buildReader`'s role line, `buildAssistantPacket`'s daily-packet role line, `ROLE_PACKET_HEAD`/`buildRoleVerdictPacket`/`parseRoleVerdictReply`, the state-shape comment, `demoState`'s two verdicts (no `probability`), Rule 14's amendment and Rule 7's appended sentence (heading count 19), and the `await step(` count (255, recounted per file: `flow.js` 38, `flow2.js` 16, `flow3.js` 25, `flow4.js` 23, `flow5.js` 19, `flow6.js` 6, `flow7.js` 27, `flow8.js` 28, `flow9.js` 10, `flow10.js` 32, `flow11.js` 31) — every fact in the task prompt matched the source.
   - Docs updated: `docs/design-docs/metrics-and-role-model.md` (the proximity section rewritten as `## Role-model requirement facts (roleAreas)`; the stage section's "second figure beside `roleGap`" sentences; `stageProgressOf`'s section rewritten as `### The stage line and headline (2026-09-18, no percentage)`; the `RoleVerdictModal`/verdict-history/re-assessment/storage-arithmetic/demo-figures/role-screen/profile-card-third-state/what-did-not-change/direction-advice sections; demo packet 2,434 → 2,408 chars, delta line, reader line), `assistant-bridge.md` (the `next` row, `roleRecommendations`'s return shape, the `## 연속·롤모델` row, the fifth-packet section's head/JSON-template/`## 지난 판정`/parser/never-carries paragraphs), `scoring-engine.md` (line 98), `home.md` (intro, admission rule, the CV-card lead-in, the stage headline/proximity section rewritten as `## The stage/role row (2026-09-18, no percentage)`, the "where everything went" rows), `feedback-overlays.md` (the RANK UP proximity block, the toast rows, the intro sentence), `daily-reader.md` (the tenth-section row, the re-assessment cross-reference, the demo-content sentence), `daily-briefing.md` (row 26, three `next` texts), `growth.md` (rows 4/8/12/13), `evidence-modals.md` (verified no mention, unedited), `DESIGN.md` (the redesign invariants line, A3, A16/A17 annotated "retired, see A18", new A18 entry, the screen-inventory header), `RELIABILITY.md` (the `flow.js`/`flow2.js`/`flow3.js` table rows, a new dated paragraph in the E2E-policy footer with the mutation/numbers-baseline summary), `SECURITY.md` (the daily-packet bullet, the fifth-packet bullet), `demo-data.md` (the `role` bullet and its 2026-09-18-additions sub-bullet, the "Derived values" line), `state-lifecycle.md` (the v28-migration paragraph, the 2026-09-18-additions paragraph, the "Progress is never stored" sentence), `evidence-and-promotion.md` (the `promoteArea` line), `business.md` (line 461), `scenario-harness-engineer.md` (steps 15 and 20), `PRODUCT_SENSE.md` (lines 16 and 34), `QUALITY_SCORE.md` (row 34), `FRONTEND.md` (line 13), `information-architecture.md` (lines 6 and 71), `design-docs/index.md` and `product-specs/index.md` (one line each), `ARCHITECTURE.md` (the file line count, the Goal-engine/Daily-assistant/Tabs/Modals rows, the state-flow point 4, the status paragraph, three glossary rows), `tools/e2e/README.md` (verified only — the implementer's own Phase 1 text already matched the source, no edit needed), `tech-debt-tracker.md` (TD-11 and TD-23 reworded; TD-28's proximity clause struck through as moot, TD-29's unguarded-branch clause struck through as fixed with its history kept; TD-84 and TD-89 moved to `## Resolved`; TD-44 extended with a new dated paragraph; four new rows TD-91–TD-94), `decision-log.md` (one dated row, fourth of the day, linking this plan).
   - Deviations from the plan's own text (found during verification, not fixed elsewhere): the plan's Rule 7 cross-reference sentence (default 12) was already landed by the implementer inside Rule 7's own 2026-09-18 amendment in `core-beliefs.md` — correct, no docs-syncer action needed there. The plan's Phase 2 list names "row 26" of `daily-briefing.md` as needing "three `next` texts" while its own Context-read line calls that same row's prior state a `다음 단계` target-only description; both readings are consistent with the table row actually present, so no correction was needed. `ARCHITECTURE.md`'s file line count (`≈ 11,983 lines`) was already stale before this change (the actual pre-change count was 12,174, not 11,983) — corrected to the post-change 12,103 as a truthfulness fix, not a claim this plan caused the earlier drift. `public/manifest.webmanifest`'s `home.png` screenshot label (`학력·경력·자격·시험 이력과 롤모델 근접도`) still names the retired proximity line; left unedited since `public/` is outside this docs-only phase's mandate and the plan's own file list does not name it — flagged in the report to the parent agent rather than fixed silently.
   - `npm run docs:gen`: `db-schema.md` v28, 18 migration blocks, 14 storage keys (no `probability?`, no `roleGap` — confirmed by grep); `symbol-index.md` 493 symbols. `npm run docs:check`: clean (0 problems) after this plan moved to `completed/`.
   - `npm run verify` was **not** run, per the standing user instruction this plan and its predecessors carry; behaviour is unverified since 2026-09-16, as `RELIABILITY.md` already states.

## Verification

`npm run build` · `npm run finish` · `npm run lang:check` · `npm run smoke` · `npm run docs:gen && npm run docs:check` · `node --check tools/e2e/flow.js tools/e2e/flow2.js tools/e2e/flow3.js tools/e2e/flow8.js` · `npm run build:demo` + `node tools/harness/gen-screenshots.js` · the greps, baselines, puppeteer and mutation checks under Acceptance. `npm run verify` is **not** run (standing instruction); say so in the report.

## Cleanup checklist
- [x] `npm run finish` exit 0 (no unused `Bar` import path, no leftover `sp` / `rg` / `last` locals, no residue comment naming a retired figure as current) — clean after Phase 1
- [x] no allowlist addition expected; if one is needed, its reason is mirrored in `tech-debt-tracker.md` — none added

## Docs to sync

Phase 2 list above: `core-beliefs.md` (Phase 1, by the implementer), `metrics-and-role-model.md`, `assistant-bridge.md`, `scoring-engine.md`, `state-lifecycle.md`, `evidence-and-promotion.md`, `demo-data.md`, `information-architecture.md`, `index.md` ×2, `home.md`, `feedback-overlays.md`, `daily-reader.md`, `daily-briefing.md`, `growth.md`, `business.md`, `scenario-harness-engineer.md`, `DESIGN.md`, `RELIABILITY.md`, `SECURITY.md`, `PRODUCT_SENSE.md`, `QUALITY_SCORE.md`, `FRONTEND.md`, `ARCHITECTURE.md`, `tools/e2e/README.md`, `tech-debt-tracker.md`, `decision-log.md`; `docs/generated/*` by `docs:gen`.

## Proposed commit

feat(role): retire every percentage on the role model — proximity, stage progress, journey and the verdict probability; stage and gap facts stay (rule 14 amendment)
