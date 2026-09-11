# Goal deletion, tab order, and the removal of `인생 지표`
- Status: completed
- Date: 2026-09-11
- Needs approval: **yes — already granted.** The request is the approval: `목표설정한거 지울 수 있게해줘 / 그리고 메뉴 순서를 관련성 있게 해줘 / 인생지표 없애줘`, plus the three settled answers recorded below. Phase C deletes stored user data (`metrics`, `act.lastCheckin`) through a new migration block, the case [Rule 12](../../design-docs/core-beliefs.md#rule-12) and AGENTS.md §4 require approval for. Do **not** re-ask and do not re-litigate the three decisions.
- Agents: planner → implementer → cleanup → verifier → docs-syncer

## Goal
Three independent changes the user has already decided, phased so each gates on its own.

**A — a goal can be deleted.** Today only an achieved goal can leave the record (`기록에서 제거`, rendered when `st === "done"`). An active goal has no delete or abandon path, so a goal created by mistake stays forever. An active goal becomes deletable; deleting it also deletes the tasks under it that were never completed, and keeps every task that carries a completion record (evidence, paid points, achievement entries), which then surfaces in the existing `미분류` section of the `실행` tab.

**B — tab order** becomes `홈` `목표` `실행` `일정` `성장` (today `홈` `목표` `실행` `성장` `일정`). Only the last two swap. Rationale to record: decide, do, when, look back — the three tabs used every day sit together and the record tab goes last.

**C — `인생 지표` is removed entirely, including the stored numbers.** A single self-assessed triple that also grew automatically from unrelated achievements measures nothing; what it claimed to measure belongs to a goal's metric KR. Display, check-in, automatic gains, the briefing line, the packet line and the stored fields all go, through a new `if (s.v < 19)` migration block.

## Context read
- `AGENTS.md` §3 routing, §4 prompt-first, §5 finish protocol, §6 language policy, §7 never-do; `docs/PLANS.md` (template); `ARCHITECTURE.md` (file regions, state flow, status line); `docs/FRONTEND.md` (clone pattern, schema-change checklist, copy rules, Tailwind v3 core only).
- `src/LifeManager.jsx` regions: goal engine (`METRICS_META`), daily assistant (`buildBriefing`, `buildAssistantPacket`), state lifecycle (`@schema`, `migrate`, `freshState`, `demoState`), tabs (`GoalsTab`, `TaskTab`, `GrowthTab`), modals (`MetricsModal`, `ReviewModal`, `BriefingModal`), app root (`removeGoal`, `removeTask`, `metricsGain`, `saveMetrics`, `promoteArea`, `goalStatus`, `checkinKR`, `applyMeasures`, `NAV`).
- `tools/e2e/`: `run.js` (`clickTab`, `openTaskModalFor`), `flow.js`, `flow3.js`, `flow4.js`, `flow5.js`, `flow6.js`, `README.md`.
- `docs/design-docs/`: `core-beliefs.md`, `metrics-and-role-model.md`, `information-architecture.md`, `assistant-bridge.md`, `state-lifecycle.md`, `scoring-engine.md`, `evidence-and-promotion.md`, `decision-log.md`. `docs/product-specs/`: `growth.md`, `goals.md`, `tasks.md`, `home.md`, `daily-briefing.md`, `feedback-overlays.md`, `evidence-modals.md`, `scenario-harness-engineer.md`, `index.md`. `docs/DESIGN.md`, `docs/RELIABILITY.md`, `docs/QUALITY_SCORE.md`, `docs/exec-plans/tech-debt-tracker.md`.
- `tools/harness/check-docs.js` (19 rule headings in order, no `### Rule N` heading outside core-beliefs, links resolve, no Korean prose in exec plans), `smoke-logic.js` (data tables and payout formulas only), `gen-screenshots.js`, `public/manifest.webmanifest`.

### Rules touched (linked, never restated)
| Rule | Why it is in scope |
|---|---|
| [7](../../design-docs/core-beliefs.md#rule-7) | Nothing is added; a feature is removed. No new mechanic, no AI. |
| [8](../../design-docs/core-beliefs.md#rule-8) | **Rewritten in place** (not deleted, not renumbered) — this rule is entirely about the life-metric store Phase C removes. |
| [9](../../design-docs/core-beliefs.md#rule-9) | The delete handler and the briefing store nothing derived; the counts in the copy are computed at call time. |
| [12](../../design-docs/core-beliefs.md#rule-12) | New `if (s.v < 19)` block, `freshState` bump, `@schema` update, `flow4.js` fixture. Existing blocks and `liferpg-*` keys untouched. |
| [13](../../design-docs/core-beliefs.md#rule-13) | Every new string states facts and numbers only; the removed briefing fallback is replaced by a factual one. |
| [16](../../design-docs/core-beliefs.md#rule-16) | Deleting a goal's tasks clears their `liferpg-img-ev-*` and `liferpg-img-study-*` keys with the convention `removeTask` uses. |
| [17](../../design-docs/core-beliefs.md#rule-17) | The fitness-measurement path stays exactly as it is; the clause pointing at the appearance metric needs new wording. |
| [18](../../design-docs/core-beliefs.md#rule-18) | Kept tasks of a deleted goal land in `미분류` and can only be completed or deleted — unchanged behaviour, now reachable on purpose. |
| [19](../../design-docs/core-beliefs.md#rule-19) | Metric-KR check-in guidance, `checkinKR` and the count-KR bridge are **not** touched. |

Not touched, which is why `--smoke` is not required: rules [1](../../design-docs/core-beliefs.md#rule-1) to [6](../../design-docs/core-beliefs.md#rule-6) and [15](../../design-docs/core-beliefs.md#rule-15) — no payout formula, no `CERTS` / `EXAMS` / `WEIGHT_MATRIX` / `CERT_W_EXC` row, no grade cut. `metricsGain` is not part of any payout and `tools/harness/smoke-logic.js` never evaluates it.

### Four traps, decided here
1. **`statClamp` (currently L1528) must survive Phase C.** The frozen v12 block (L2441) calls it and a migrate block is never edited ([Rule 12](../../design-docs/core-beliefs.md#rule-12)); v12 still builds `metrics` when an old save loads and v19 then removes it. After Phase C `statClamp` has exactly one reference — the v12 block — so `finish-check` will not flag it. Do not delete it, do not allowlist it, do not inline it.
2. **`act.lastCheckin` goes with the metrics.** It exists only to date the check-in. The frozen v15 block (L2461) still writes it, so the v19 block removes it from `act` as well as removing `metrics`. `act.briefingSeen` and `act.lastReview` stay — they date the briefing and the weekly review, both of which remain.
3. **`tools/e2e/flow4.js:112`** (`typeof st.metrics?.body !== "number"`) asserts the end state of the whole chain, not v12 in isolation. After v19, nothing v12 produced is observable in an end state, by design. **Decision: re-scope the step.** Replace that line with two assertions the chain does preserve — the v11 `profile.persona` deletion, and the absence of `metrics` (which proves the v19 block ran on a save whose metrics the v11 and v12 blocks had just built). Add a one-line English comment in the step saying why. The other `flow4.js` fixtures (L123, L139, L157, L176, L196) keep `metrics: {...}` as *input* data — an old save really did carry it — but no assertion about it may remain.
4. **`checkinKR` and metric KRs are not life metrics.** `checkinKR` (L5370), the `kr.type === "metric"` branch in `krProgress` and `applyMeasures` (L5186), `AddGoalModal`'s `지표명 — 예: 체지방률` and `지표명·시작값·목표값을 입력해 주세요.`, `AddTaskModal`'s metric-KR guidance line, and the whole `ActivityLogModal` measurement flow stay byte-identical. So does everything in the `일정` tab.

### Line numbers (current tree, 2026-09-11 — re-grep before editing; the file moves)
| Symbol or site | L | Phase |
|---|---|---|
| `statClamp` | 1528 | C (keep) |
| `METRICS_META` | 1771-1775 | C (delete) |
| `CHECKIN_STALE_DAYS` | 2154 | C (delete — its last reader goes) |
| briefing check-in item and section `add("metrics", …)` | 2218-2228, 2249-2250 | C |
| packet `const m = state.metrics`, `stateLines[0]`, `sec("지표·연속", …)` | 2310, 2333-2334, 2343 | C |
| `@schema` JSDoc (`v18`, `v: 18`, `act` line, `metrics` line) | 2382-2404 | C |
| `migrate` — append after the v18 block | 2472-2476 | C |
| `freshState` (`v: 18`, `act`, `metrics`) | 2486-2504 | C |
| `demoState` (`s.act.lastCheckin`, `s.metrics`) | 2561-2562 | C |
| `GoalsTab` props and card footer (`기록에서 제거` under `st === "done"`) | 3120, 3225-3237 | A |
| `MetricsModal` | 3395-3416 | C (delete) |
| `BriefingModal` | 3420-3455 | C (no edit expected — verify) |
| `ReviewModal` (`onCheckin` prop, `submit(thenCheckin)`, second button) | 3585-3613 | C |
| `TaskTab` orphan filter | 3834 | A (read only) |
| `GrowthTab` signature and metrics card | 4403, 4446-4461 | C |
| `removeTask` (image-key pattern to mirror) | 5172-5177 | A (read only) |
| `metricsGain` and its four call sites | 5199-5206, 5267, 5286, 5296, 5309 | C |
| `promoteArea` influence bump | 5338 | C |
| `removeGoal` | 5356 | A |
| `goalStatus` influence and asset bumps | 5362-5366 | C |
| `saveMetrics` | 5442-5450 | C (delete) |
| `saveReview` `thenCheckin` | 5491-5503 | C |
| `NAV` | 5586-5592 | B |
| `GrowthTab` render prop `onMetrics` | 5640 | C |
| `modal?.type === "metrics"` render branch | 5702-5704 | C |

---

## Prompt

Execute this plan in three phases, in order: **A** (goal deletion), **B** (tab order), **C** (remove `인생 지표`). Each phase ends at its own gate; do not start the next phase before the current gate is green. The user has already decided all three — do not ask questions, do not widen the scope, do not change any UI string this plan does not list.

Repo conventions: single file `src/LifeManager.jsx`; state updates use `setState((prev) => { const s = structuredClone(prev); /* mutate s */ return s; })`; nothing derived is stored ([Rule 9](../../design-docs/core-beliefs.md#rule-9)); Tailwind v3 core utilities only, no arbitrary values; colour roles from `docs/DESIGN.md` (rose = error and destructive, cyan = primary and goal, violet = study); identifiers, comments, step names and log strings in English, UI copy in Korean `해요체` with facts and numbers only ([Rule 13](../../design-docs/core-beliefs.md#rule-13)); every Korean string added or removed is an E2E selector, so `tools/e2e/*` changes in the same phase. Never touch `CERTS`, `EXAMS`, `WEIGHT_MATRIX`, `CERT_W_EXC`, the `store` call sites, the `liferpg-*` key names, or any existing `if (s.v < N)` block.

### Phase A — an active goal can be deleted

**A1.** `GoalsTab` (around L3225-3237): keep the `st === "done"` branch exactly as it is (`기록에서 제거`, `className="mt-3 text-xs text-zinc-600"`, no confirmation). Add a sibling branch for `st === "active"` in the same slot below the action row:

```jsx
{st === "active" && (
  <button onClick={() => onRemoveGoal(g.id)} className="mt-3 text-xs text-rose-400">목표 삭제</button>
)}
```

The copy `기록에서 제거` is deliberately not reused: that path destroys nothing, this one does. Rose is the destructive and error role.

**A2.** Rewrite `removeGoal` (L5356) as one handler with two documented paths. The done path stays behaviourally identical to today (filter `goals` only, no confirmation, no toast, no task deletion). The active path confirms first with `window.confirm`, matching the app's only precedent (`importBackup`, L5550: state what disappears, then ask `계속할까요?`), then deletes the goal together with the tasks under it that carry no completion record:

```js
// `기록에서 제거` (done) removes a record and destroys nothing. `목표 삭제` (active) is the destructive path:
// the work that never happened goes with the goal, and anything already completed stays — it carries evidence,
// paid points and an achievement entry (rules 4, 16), and shows up in 미분류 afterwards (rule 18).
const removeGoal = (id) => {
  const g = (state.goals || []).find((x) => x.id === id);
  if (!g) return;
  if (g.status !== "active") { setState((prev) => ({ ...prev, goals: prev.goals.filter((x) => x.id !== id) })); return; }
  const mine = (state.tasks || []).filter((q) => q.goalId === id);
  const drop = mine.filter((q) => q.status !== "done" && !(q.doneDates || []).length);
  const kept = mine.length - drop.length;
  if (!window.confirm(`${g.title} 목표를 삭제해요. 연결된 미완료 실행 ${drop.length}건도 함께 사라져요. 완료 기록 ${kept}건은 미분류로 남아요. 계속할까요?`)) return;
  for (const q of drop) { store.del(`liferpg-img-ev-${q.id}`); for (let n = 1; n <= 2; n++) store.del(`liferpg-img-study-${q.id}-${n}`); }
  const dropIds = new Set(drop.map((q) => q.id));
  setState((prev) => {
    const s = structuredClone(prev);
    s.goals = (s.goals || []).filter((x) => x.id !== id);
    s.tasks = (s.tasks || []).filter((q) => !dropIds.has(q.id));
    return s;
  });
  showToast({ msg: `목표를 삭제했어요 · 미완료 실행 ${drop.length}건 삭제 · 완료 기록 ${kept}건 유지` });
};
```

Decisions baked into that code: "completed" means `status === "done"` **or** at least one `doneDates` entry, so a daily task that was ever completed is kept; the image-key deletion repeats the three keys `removeTask` uses and invents no convention ([Rule 16](../../design-docs/core-beliefs.md#rule-16)); kept tasks keep their `goalId` on purpose, because the unassigned section is their home; one `structuredClone` updater, nothing derived stored.

**A3.** `tools/e2e/flow4.js`: after the existing step `remove the achieved goal from the record` (L51-61), add two steps. Seed the fixture through `localStorage` and a reload rather than the task modal — `openTaskModalFor` is known-broken (TD-32) and would attach the tasks to the wrong goal.

```js
await step("plant a goal with one completed and one open task", async () => {
  await page.evaluate(() => {
    const k = "liferpg-state-v1";
    const s = JSON.parse(localStorage.getItem(k));
    const areaId = s.areas[0].id;
    s.goals = [{ id: "gdel", title: "E2E 삭제 목표", areaId, status: "active", createdAt: "2026-01-01",
      krs: [{ id: "kdel", type: "count", title: "정리 작업", need: 2 }] }, ...s.goals];
    s.tasks = [
      { id: "tkeep", title: "남길 실행", areaId, goalId: "gdel", diff: "D", type: "once", status: "done", doneAt: "2026-01-02", doneDates: [], createdAt: "2026-01-01", evidence: "정리 완료" },
      { id: "tdrop", title: "삭제될 실행", areaId, goalId: "gdel", diff: "D", type: "once", status: "todo", doneDates: [], createdAt: "2026-01-01" },
      ...s.tasks];
    localStorage.setItem(k, JSON.stringify(s));
  });
  await h.reload();
  await sleep(700);
  await clickTab("목표");
  await expectText("E2E 삭제 목표");
  await expectText("목표 삭제");
});
await step("delete an active goal — open task removed, completed task kept", async () => {
  // the confirmation is a real window.confirm; stub it the way flow6 does for the backup import
  await page.evaluate(() => { window.confirm = () => false; });
  await clickText("목표 삭제"); await sleep(500);
  if (!(await hasText("E2E 삭제 목표"))) throw new Error("cancelling the confirmation still deleted the goal");
  await page.evaluate(() => { window.confirm = () => true; });
  await clickText("목표 삭제"); await sleep(800);
  if (await hasText("E2E 삭제 목표")) throw new Error("goal survived the confirmed deletion");
  const st = await page.evaluate(() => { try { return JSON.parse(localStorage.getItem("liferpg-state-v1")); } catch { return null; } });
  if (!st) throw new Error("no state");
  if ((st.goals || []).some((g) => g.id === "gdel")) throw new Error("goal record remains");
  if ((st.tasks || []).some((q) => q.id === "tdrop")) throw new Error("open task of the deleted goal remains");
  const keep = (st.tasks || []).find((q) => q.id === "tkeep");
  if (!keep) throw new Error("completed task was deleted with its goal");
  if (keep.goalId !== "gdel" || keep.evidence !== "정리 완료") throw new Error("completed task was rewritten: " + JSON.stringify(keep));
  await clickTab("실행");
  await expectText("미분류");
  await expectText("남길 실행");
});
```

**Acceptance A (observable).** Every active goal card shows `목표 삭제`; tapping it opens a confirmation naming the goal and both counts; cancelling changes nothing; confirming removes the goal, removes only its record-less tasks, leaves completed tasks under `미분류 — 목표 연결 전 항목` on the `실행` tab, and shows the toast with both counts. An achieved goal still shows `기록에서 제거`, still asks nothing and still deletes no task. `npm run verify`: 116 steps, 0 failed, 0 console errors.

### Phase B — tab order

**B1.** `NAV` (L5586-5592): move the `["schedule", "일정", CalendarDays]` entry above `["growth", "성장", TrendingUp]`. Nothing else changes — same keys, same components, same icons, same `grid-cols-5`, same render order in `<main>`.

**B2.** `tools/e2e/flow.js`: add one step beside the existing tab sweep (English step name, Korean only in the assert data):

```js
await step("bottom nav order (home, goals, tasks, schedule, growth)", async () => {
  const labels = await page.evaluate(() => [...document.querySelectorAll("nav button")].map((b) => (b.innerText || "").trim()));
  const want = ["홈", "목표", "실행", "일정", "성장"];
  if (labels.join("·") !== want.join("·")) throw new Error("nav order: " + labels.join("·"));
});
```

**Acceptance B (observable).** The bottom bar reads, left to right, `홈` `목표` `실행` `일정` `성장`; every tab still opens its own screen. `npm run verify`: 117 steps green at this gate.

### Phase C — remove `인생 지표`

C1 and C2 land together. Do **not** build or run the app between them: once the v19 block deletes `metrics`, any surviving reader (`metricsGain`, `GrowthTab`, `MetricsModal`) reads `undefined`.

**C1. Schema v19.** Append after the v18 block in `migrate` (never edit an existing block):

```js
if (s.v < 19) {
  // v19: life metrics are gone (user decision 2026-09-11). A global self-assessed triple that also grew from
  // unrelated achievements measured nothing; objective measures belong to a goal's metric KR (rule 8). The stored
  // numbers and the check-in stamp are dropped; every other act stamp, record and payout is kept untouched.
  const { metrics, ...rest } = s;
  const { lastCheckin, ...act } = rest.act || {};
  s = { ...rest, v: 19, act };
}
```

`freshState`: `v: 18` becomes `v: 19`, drop the `metrics: { … }` line and `lastCheckin: null` from `act`. `@schema` JSDoc: header `v18` to `v19`, the `v: 18` field line to `v: 19`, delete the whole `metrics: { asset, infl, body }` line, drop `lastCheckin?` from the `act` line and keep its trailing comment. `demoState`: drop `lastCheckin: shiftDay(today, -10)` from `s.act` and delete the `s.metrics = { … }` line. Keep `statClamp`.

**C2. Remove the feature from the app.** Delete: `METRICS_META`; `MetricsModal` and its render branch (`modal?.type === "metrics"`); `saveMetrics`; `metricsGain` and its four call sites in `completeTask` (exam, certification, study, legacy plain task), including any local that becomes unused, such as the `wD` computation if nothing else reads it; the influence bump in `promoteArea`; the influence and asset bumps in `goalStatus` (the status flip, the overlay and the rest of that handler stay); the whole `인생 지표` card in `GrowthTab` together with the `onMetrics` prop, its `체크인` button, the `METRICS_META` rows and the `마지막 체크인` footer line; `onMetrics={() => setModal({ type: "metrics" })}` at the `GrowthTab` call site; `CHECKIN_STALE_DAYS`. In `ReviewModal`: delete the `저장하고 지표 체크인 ›` button, collapse `submit(thenCheckin)` to `submit()`, drop the already-unused `onCheckin` prop from the signature, and drop the `thenCheckin` parameter from `saveReview` so it always calls `setModal(null)`. Confirm `closeBriefing` needs no edit once no briefing item carries `action: { type: "metrics" }`.

**C3. Briefing** (`buildBriefing`, around L2218-2250). Delete `const m = state.metrics || {}`, `ci`, `ciDays`, `metricItems` and the check-in item; keep `act` (streak, review) and keep the stagnant-area and activity-gap logic exactly as it is. The section is renamed because its old title and fallback both stop being true:

```js
const areaAll = [...stale, ...drops.slice(0, 3)];
add("areas", "영역·활동", areaAll.length ? areaAll : [{ kind: "none", severity: 1,
  text: `최근 ${AREA_STALE_DAYS}일 정체 영역 없음 · 최근 ${ACTIVITY_GAP_DAYS}일 활동 공백 없음` }]);
```

The section `key` is internal (a React key only). Grep before and after to confirm nothing looks a section up by key.

**C4. Assistant packet** (`buildAssistantPacket`). Delete `const m = state.metrics || {}` and the first entry of `stateLines`; the remaining two lines (streak and shields, role-model proximity) stay verbatim. Rename that section title from `지표·연속` to `연속·롤모델`. `PACKET_HEAD`, `PACKET_MAX`, the truncation loop and `parseAssistantReply` are untouched.

**C5. E2E.** Exactly these edits, nothing else:
- `flow.js:33`: fresh-save assertion `18` to `19`, message text included.
- `flow.js:109`: keep the step, change the assertion to `await expectText("성취의 벽")`, and update the section comment above it so it no longer mentions a metrics check-in.
- `flow.js:110-113`: delete the step `save metrics check-in`.
- `flow4.js:13, 85, 109`: `st.v !== 18` becomes `!== 19`, expected-version text included.
- `flow4.js:112`: replace the `metrics.body` assertion with the two lines below, plus a one-line English comment saying v12 is no longer observable in an end state.

```js
if (st.profile?.persona) throw new Error("v11 persona deletion skipped");
if ("metrics" in st) throw new Error("v19 left the life-metric store the v11/v12 blocks had built");
```

- `flow4.js`: after the v17 to v18 step, add the fixture step `v18 save → v19 life metrics removed`. Input: a v18 save carrying `metrics: { asset: 40, infl: 30, body: 20 }`, `act` with `lastCheckin: "2026-01-02"`, `streak: 3`, `shieldsLeft: 1`, `briefingSeen`, `lastReview`, one journal entry, one review entry and `ui: { scheduleView: "calendar" }`. Assert: `"metrics" in st` is false; `"lastCheckin" in st.act` is false; `streak`, `shieldsLeft`, `briefingSeen` and `lastReview` unchanged; `ui.scheduleView`, `journal.length` and `reviews.length` unchanged. Leave the `metrics` input on the other fixtures.
- `flow5.js:192-210`: rename the step to `weekly review saves and stamps its date`; keep everything up to the `lastReview` assertion; delete the chain (the click on `저장하고 지표 체크인`, the `인생 지표 체크인` expectation, the second `저장`, the `lastCheckin` assertion); with the review modal open, assert the removed button is gone — `if (await hasText("저장하고 지표 체크인")) throw new Error("review still offers the removed check-in")` — then `closeModal()`.
- `flow5.js:218-226`: delete the step `metrics check-in stamps its date`.
- `flow6.js:87`: backup schema `18` to `19`.
- Afterwards grep `tools/e2e` for `지표` and `체크인`: only the goal-KR wording may remain (`flow.js:61`, `지표명`).

**C6. Screenshots.** After C5 is green: `npm run build:demo`, then `node tools/harness/gen-screenshots.js`. The nav bar is visible in all four manifest screenshots, so Phase B invalidated every one of them; the growth tab is not among the four, so Phase C alone would not have. Commit the regenerated `public/screenshots/*.png` and do not edit `public/manifest.webmanifest`.

**Acceptance C (observable).** The `성장` tab shows `성취의 벽`, the skill track and the role model, with no `인생 지표` card and no `체크인` button; no modal titled `인생 지표 체크인` can be opened from anywhere; `주간 리뷰` offers only `리뷰 저장`; the briefing section is titled `영역·활동` and never mentions a check-in; the packet carries `## 연속·롤모델` with two lines; a fresh save is `v: 19` with no `metrics` key and no `act.lastCheckin`; a v18 save loses exactly those two and nothing else; goal metric KRs, `checkinKR`, the `채우기 ›` bridge and the fitness measurement flow behave exactly as before. `npm run verify`: 116 steps, 0 failed, 0 console errors.

### Finish protocol (after the last phase)
1. `npm run finish` exit 0. These must be gone from the corpus: `METRICS_META`, `MetricsModal`, `saveMetrics`, `metricsGain`, `CHECKIN_STALE_DAYS`, the `metrics` modal type, `GrowthTab`'s `onMetrics`, `ReviewModal`'s `onCheckin`, `saveReview`'s `thenCheckin`. `statClamp` stays with one reference (the frozen v12 block); if `finish-check` flags it, that is a harness finding to report, not a licence to delete or allowlist it. No allowlist entry is expected; if one becomes unavoidable, mirror it in `docs/exec-plans/tech-debt-tracker.md` with a reason.
2. `npm run verify`: 116 steps, 0 failed, 0 console errors. `-- --smoke` is not needed (no data table, payout formula or grade cut changed); running it is optional reassurance.
3. `npm run docs:gen && npm run docs:check` exit 0, then hand the doc list below to docs-syncer.
4. Report: what changed per phase, commands with results, the new step count, and the proposed commit messages.

---

## Steps
1. **Phase A — goal deletion.** A1, A2, A3. Gate: `npm run verify` (116 steps, 0 failed, 0 console errors) and `npm run finish` exit 0. Commit 1.
2. **Phase B — tab order.** B1, B2. Gate: `npm run verify` (117 steps) and `npm run finish` exit 0. Commit 2. Screenshots are regenerated once, at the end of Phase C, so the committed images match the final build.
3. **Phase C — remove `인생 지표`.** C1 and C2 together (never build in between), then C3, C4, C5, C6. Gate: `npm run verify` (116 steps), `npm run finish` exit 0, `npm run docs:gen && npm run docs:check` exit 0. Commit 3.
4. **Docs.** docs-syncer applies the table below, moves this plan to `docs/exec-plans/completed/`, and re-runs `npm run docs:check`.

**E2E step accounting.** 114 today, A `+2`, B `+1`, C `-1` (`save metrics check-in`) `-1` (`metrics check-in stamps its date`) `+1` (v19 fixture) = **116** final. Rewritten in place and not counted: the `flow.js` growth-tab assertion, the `flow4.js` chain assertions and its three version numbers, the `flow5.js` weekly-review step, the `flow6.js` backup version.

## Verification
- `npm run verify` at each gate: build, preview, full E2E, 0 failed steps, 0 console errors. Final expected count 116.
- `npm run finish` exit 0 at each gate.
- `npm run docs:gen && npm run docs:check` after Phase C. `docs:check` also enforces 19 rule headings in order, so Rule 8 is rewritten in place and no other file may introduce a `### Rule N` heading.
- `--smoke`: not required, see "Rules touched". Optional at the final gate.
- Manual pass in `npm run dev`, once: delete an active goal holding one open and one completed task and confirm the unassigned section shows the completed one; load a v18 save (the `flow4.js` fixture shape) and confirm the app opens with no metrics anywhere; read the `성장` tab, the briefing modal and the assistant packet for leftover `지표` wording.
- `npm run build:demo` then `node tools/harness/gen-screenshots.js` after Phase C: four images written, each showing the new tab order.

## Cleanup checklist
- [ ] `npm run finish` exit 0 (dead symbols, duplicates, residue, language gate)
- [ ] `METRICS_META`, `MetricsModal`, `saveMetrics`, `metricsGain`, `CHECKIN_STALE_DAYS`, the `metrics` modal type, `GrowthTab`'s `onMetrics`, `ReviewModal`'s `onCheckin` and `saveReview`'s `thenCheckin` are all gone
- [ ] `statClamp` still present, still referenced only by the frozen v12 block, not allowlisted
- [ ] `grep -n "metrics" src/LifeManager.jsx` returns only the v12 and v19 migration blocks and their comments
- [ ] `grep -n "지표" src/LifeManager.jsx` returns only goal-KR copy (`지표명 — 예: 체지방률`, `지표명·시작값·목표값을 입력해 주세요.`)
- [ ] `grep -rn "지표\|체크인" tools/e2e/*.js` returns only the `flow.js` `지표명` line
- [ ] no unused lucide import after the metrics card and `MetricsModal` are gone
- [ ] no new allowlist entry; an unavoidable one is mirrored in `docs/exec-plans/tech-debt-tracker.md` with a reason

## Docs to sync
| File | Change |
|---|---|
| `docs/design-docs/core-beliefs.md` | Rule 8 rewritten in place (19 headings, no renumbering). Keep what still holds: objective measures belong to a goal's metric KR; no idle or time-based growth; nothing derived is stored. Add: the global life-metric store, its check-in and its automatic gains were removed on 2026-09-11 by user decision (schema v19), and a new global self-assessed number needs a new decision (same shape as the Rule 7 clause). Give the rule a title matching its new content. Rule 17: replace the clause pointing at the appearance metric — measurements go only to the same-named metric KR of an active goal, and there is no global metric store any more. Rule 12's historical v12 sentence stays as written, because it describes a frozen block. |
| `docs/design-docs/decision-log.md` | One row dated 2026-09-11, newest last, covering all three changes: active-goal deletion with its record-less tasks (completed tasks kept, unassigned); tab order `홈 · 목표 · 실행 · 일정 · 성장` with the decide, do, when, look back rationale; life metrics removed including the stored numbers (schema v19), rules 8 and 17 amended. Ref column: rules 8, 9, 12, 13, 16, 17, 18 plus a link to this plan under `completed/`. |
| `docs/design-docs/metrics-and-role-model.md` | Rewrite: drop the life-metric sections (the `METRICS_META` table, `metricsGain`, the check-in, the lead paragraph's `saveMetrics` sentence, the `risk` to `body` note) and retitle to role model and streak. Keep the file path and its `<!-- src: SPEC-5 -->` marker: `docs/exec-plans/completed/2026-09-08-daily-assistant.md` links to this path and completed plans are history, so a rename would break `docs:check`. Add one line recording the 2026-09-11 removal, linking the decision log. |
| `docs/design-docs/state-lifecycle.md` | Shape heading `(v18)` to `(v19)`; the state-shape line loses `metrics`; the migration table gains the `v < 19` row; the `freshState` paragraph and the `flow4.js` coverage sentence gain the v18 to v19 fixture. |
| `docs/design-docs/information-architecture.md` | Screen map reordered; the goals row gains `목표 삭제`; the growth row loses `인생 지표` and `체크인`; the modal-type list drops `metrics` (16 values become 15); the unassigned bullet notes that a deleted goal's completed tasks land there. |
| `docs/design-docs/assistant-bridge.md` | Packet table: `## 지표·연속` becomes `## 연속·롤모델`, 3 lines become 2, and the description loses the metrics and last check-in. |
| `docs/design-docs/scoring-engine.md` | Remove the `metricsGain` line from the completion pipeline and the second mention. Payout formulas do not change. |
| `docs/design-docs/evidence-and-promotion.md` | Promotion no longer raises influence; drop that clause. |
| `docs/product-specs/growth.md` | Delete the life-metrics section and its table, the lead sentence about the metrics footer, `onMetrics` from the props list, and `MetricsModal` from the modal list (four become three). |
| `docs/product-specs/goals.md` | Card footer: active goals get `목표 삭제` with the confirmation text, the two counts, what is deleted and what is kept; done goals keep `기록에서 제거` unchanged; remove the sentence saying there is no delete path for an active goal; `달성 처리` no longer moves any metric. |
| `docs/product-specs/tasks.md` | The unassigned bullet: orphans now also come from tasks kept when their active goal was deleted. |
| `docs/product-specs/home.md` | Tab order where mentioned; no metrics content expected — verify with a grep. |
| `docs/product-specs/daily-briefing.md` | Section table row `지표·영역` becomes `영역·활동` with the new description and fallback; the `ReviewModal` paragraph loses `저장하고 지표 체크인 ›`; delete the metrics check-in section. |
| `docs/product-specs/feedback-overlays.md` | Overlay table loses every `metricsGain` mention; the toast list loses `지표를 갱신했어요` and gains the goal-deletion toast. |
| `docs/product-specs/evidence-modals.md` | The `applyMeasures` sentence keeps its meaning but loses the phrasing tied to the removed store. |
| `docs/product-specs/index.md` | `MetricsModal` out of the modal list; the growth row description loses life metrics. |
| `docs/product-specs/scenario-harness-engineer.md` | Step 5 loses the sentence about metrics rising by D/10. |
| `docs/DESIGN.md` | Violet role becomes study and grade B; drop the metric-bar clause from the colour paragraph; delete the life-metric bars token row; the rose row gains the destructive action (`목표 삭제`). |
| `docs/QUALITY_SCORE.md` | The rule 8 row: its sources `metricsGain` and `saveMetrics` no longer exist — rewrite for the new Rule 8. |
| `ARCHITECTURE.md` | Status line: schema v19, E2E 116 steps; state-lifecycle region `v11 → v19`; `saveMetrics` out of the handler list; `MetricsModal` out of the modal list; the life-metrics glossary row removed. |
| `docs/RELIABILITY.md` | L9 migration sentence gains v18 to v19; L19 `flow.js` row loses the metrics check-in; L29 step count 114 becomes 116. |
| `tools/e2e/README.md` | `114-step scenario` becomes `116-step scenario`; `flow.js` row (fresh save v19, no metrics check-in, nav order); `flow4.js` row (goal deletion, v18 to v19 fixture); `flow5.js` row (the review no longer chains to a check-in). |
| `docs/exec-plans/tech-debt-tracker.md` | TD-08: strike the `removeGoal` clause (record-less tasks are now deleted; kept tasks keep `goalId` by design) and leave the rest open. TD-03 and TD-26: drop the emptied metric-field clauses only where they refer to the removed life-metric modal — the goal metric-KR blur in `GoalsTab` has the same defect and stays. TD-17 and the `metricsGain` clause of TD-07: resolved by removal — move or strike with the date. TD-19: the growth-tab copy it names is gone. |
| `docs/generated/*` | `npm run docs:gen` only (db-schema v19 and its migration row, symbol index, onboarding tables). Never hand-edited. |
| this plan | Moved from `docs/exec-plans/active/` to `docs/exec-plans/completed/` when the last gate is green. |

## Proposed commit
Three commits, one per phase gate:

```
feat(goals): let an active goal be deleted with its unfinished tasks

The delete button on an active goal card asks for confirmation, removes the goal and
tasks under it that were never completed, and keeps completed tasks — they carry
evidence, paid points and achievement records and move to the unassigned section.
Evidence image keys of the deleted tasks are cleared the way removeTask does.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
```

```
refactor(nav): order the tabs decide, do, when, look back

The schedule tab moves ahead of the growth tab, so the three tabs used every day
sit together and the record tab is last. Keys, components and icons are
unchanged; one E2E step pins the order.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
```

```
feat(state)!: remove life metrics, including the stored numbers (schema v19)

A global self-assessed triple that also grew from unrelated achievements measured
nothing; objective measures belong to a goal's metric KR. Display, check-in,
automatic gains, the briefing line and the packet line are gone, and a v19
migration drops metrics and act.lastCheckin from saved state. Rules 8 and 17
rewritten; goal metric KRs and the fitness flow are untouched.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
```
