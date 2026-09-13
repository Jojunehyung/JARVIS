# Stop the self-reload, and simplify the `성장` tab

- Status: active
- Date: 2026-09-13
- Needs approval: **no** — no `CERTS` / `EXAMS` / `WEIGHT_MATRIX` / `CERT_W_EXC` row, no `migrate` block, no `v` bump, no `liferpg-*` key, no user data deleted. Everything Phase B adds is derived at render or component state ([Rule 9](../../design-docs/core-beliefs.md#rule-9)). Phase A changes `src/main.jsx` and one comment in `tools/harness/gen-sw.js`; the generated worker's behaviour is unchanged.
- Agents: planner → implementer → cleanup → verifier → docs-syncer

## Goal

Two user reports, one message, shipped as two independently gated phases.

**Phase A — the app reloads itself while in use.** `다른 탭 들어갔고 몇초 지나면 다시 홈화면으로 넘어가는거 고쳐줘`. `src/main.jsx` reloads the page on `controllerchange` whenever a worker was already in charge at load time, and `tools/harness/gen-sw.js` stamps `BUILD` from `String(Date.now())`, so **every deploy emits a new `sw.js`**. The first open after a deploy therefore installs a new worker, `skipWaiting()` + `clients.claim()` hand it the running page, `controllerchange` fires, and the app reloads itself a few seconds in. `tab` is `useState("home")`, so the user lands back on the home screen — four deploys in two days made it feel constant. The user's decision: **a new version applies on the next open, never while the app is in use** (`다음에 열 때 적용`). After this phase the app never reloads itself for any reason.

**Phase B — the `성장` tab is too complex.** `성장 탭 ui부분 좀더 사용자 친화적으로 해줘 / 지금 너무 복잡해서 최대한 단순화 시켜주고`. Measured on the demo save at 390 px, `<main>` is **1,963 px** — 2.3 screens. Four area cards repeat the same five blocks (grade badge, `다음 관문` line with a lock, a long `필요 증거:` line, a full-width cyan `관문 증명하기` button, the `검증된 성취 {n}건` list), so four equally loud cyan buttons compete and none reads as the next thing to do; the `롤모델` card ends with a dense grey paragraph explaining how to read its bars. The user's decisions, verbatim: `그냥 접어넣고 클릭 후 첨부파일만 넣게끔 하고 근접도 %를 메인으로 해줘`, and, for backup and reset, collapse them at the bottom. The tab becomes: proximity headline → four one-line area rows that tap straight into `PromoteModal` → a collapsed record section → a collapsed data line. Target `<main>` **≤ 900 px** on the same save.

## Context read

Code (`src/LifeManager.jsx`, ~6,700 lines — line numbers move, grep the anchors):

| Symbol | Anchor | Why |
|---|---|---|
| service-worker registration | `src/main.jsx` L12–31 | the reload this plan removes; `hadController` / `reloading` go with it |
| `swPlugin` / `swSource` | `tools/harness/gen-sw.js` L6–83 | `skipWaiting()` (install), `clients.claim()` + cache eviction (activate), `BUILD = String(Date.now())` |
| `GrowthTab` | `function GrowthTab` (~L4798) | the whole rewrite target; props `state, onPromote, onRoleModel, onRoleAdvice, onReset, onExport, onImport` |
| `roleGap` | `const roleGap =` (~L1916) | `{ name, items[{ area, need, have, gap }], match }`; `null` when `role` is null **or** every area is excluded ([Rule 14](../../design-docs/core-beliefs.md#rule-14)) |
| `RANKS` | `const RANKS = [` (~L9) | `{ name, gate, req }` ×10; `req` currently only shown by `GrowthTab` |
| `PromoteModal` | `function PromoteModal` (~L4960) | returns `null` when `RANKS[grade + 1]` is undefined — decides the grade-9 row branch |
| `RoleAdviceModal` | `function RoleAdviceModal` (~L4104), footer ~L4165 | already lists gaps and recommendations; receives the moved bar-legend paragraph |
| `BizTodoRow` | `function BizTodoRow` (~L4175) | the exact row idiom (`w-full text-left flex items-center gap-2.5 bg-zinc-950 rounded-xl px-3 py-2.5 active:opacity-70`) the area row copies |
| `SectionLabel`, `Chip`, `EmptyWallSvg`, `WallFrame`, `TrophySvg`, `LANG_KO`, `examOf` | `function SectionLabel` (~L1771), `function EmptyWallSvg` (~L1649) | atoms reused as-is |
| root wiring | `export default function LifeManager` (~L5960), growth render ~L6580 | props unchanged; the hidden `input[type=file][accept*=json]` lives on `Shell`, **not** inside `GrowthTab` |
| `demoState` | `const demoState =` (~L2829) | 4 areas (grades 2/3/2/1), `role = 완성차 1차사 하네스 설계 책임` targets {6, 4} → `match` 25 %, 1 trophy, 1 `exams.best` row |

E2E: `tools/e2e/run.js` (helpers `clickText` prefers `BUTTON` then smallest area; `clickTab`; `closeModal`), `flow.js` L109–118 + L166–187, `flow2.js` L92–118, `flow3.js` L62–83, `flow4.js` L10/L147 (`clickTab("성장")` only, to force a save), `flow6.js` L23–51 (first-visit no-reload) and L67–91 (backup export).

Docs: `AGENTS.md` §3–§8, `docs/PLANS.md`, `docs/FRONTEND.md`, `ARCHITECTURE.md`, `docs/product-specs/growth.md`, `docs/product-specs/install-and-backup.md`, `docs/design-docs/metrics-and-role-model.md`, `docs/design-docs/evidence-and-promotion.md`, `docs/design-docs/information-architecture.md`, `docs/RELIABILITY.md`, `tools/e2e/README.md`, `docs/exec-plans/tech-debt-tracker.md` (TD-11).

Rules touched: [9](../../design-docs/core-beliefs.md#rule-9), [10](../../design-docs/core-beliefs.md#rule-10), [11](../../design-docs/core-beliefs.md#rule-11), [13](../../design-docs/core-beliefs.md#rule-13), [14](../../design-docs/core-beliefs.md#rule-14), [16](../../design-docs/core-beliefs.md#rule-16). Untouched and must stay untouched: 1–8, 12, 15, 17, 18, 19.

### Rule reading (decided here, not by the implementer)

- **[Rule 9](../../design-docs/core-beliefs.md#rule-9).** Every expand/collapse flag is `useState` inside `GrowthTab` — never `state.ui`, never a `migrate` block, never a `v` bump. Proximity, grades and counts stay derived in render. If the implementation appears to need a stored field, **stop and report** instead of adding one.
- **[Rule 10](../../design-docs/core-beliefs.md#rule-10) / [11](../../design-docs/core-beliefs.md#rule-11).** Collapsing the UI must not create a second promotion route. The area row's only behaviour is `onPromote(area)` → `PromoteModal`; the chip logic, the one-chip minimum, `composeEvidence` and `promoteArea` are byte-identical after this plan. Nothing in the collapsed row promotes, and the row for an area with no next rank is not a button at all.
- **[Rule 13](../../design-docs/core-beliefs.md#rule-13).** A collapsed row still states its numbers: the grade counter `{grade}/9` stays on the row, the record section's header states its three counts while closed, and "no role model" reads as a fact (`롤모델 미설정 — 근접도 계산 대상 없음`, the phrasing `buildBriefing` already uses), never as an empty slot or an invitation. No number that the tab shows today is removed from the app — each one's new location is named in the prompt.
- **[Rule 14](../../design-docs/core-beliefs.md#rule-14).** `roleGap` is not touched. The segmented bar, whose cell widths *are* the squared curve, stays on the tab (shrunk, wrapper and legend removed); the legend paragraph moves verbatim into `RoleAdviceModal`. No linearisation, no rounding change.
- **[Rule 16](../../design-docs/core-beliefs.md#rule-16).** No evidence path is touched. Photo-mandatory completion, `STUDY_REQ` and the `liferpg-img-*` keys are outside this plan.
- **TD-11** (no way to clear a role model) is **not** fixed here; note in the report that the `rg === null` branch now also covers "a role exists but every area is excluded", and that the button in that state still reads `롤모델 수정`.

## Prompt

> Implement both phases below for Life Manager, in order, stopping at each gate. Files: `src/main.jsx`, `tools/harness/gen-sw.js` (comment only), `src/LifeManager.jsx`, `tools/e2e/`. Read `docs/design-docs/core-beliefs.md` first; obey `docs/FRONTEND.md` — Tailwind v3 **core utilities only** (no arbitrary values, no plugins), `font-mono` for numbers and system labels, lucide icons only, Korean UI copy in `해요체`, English identifiers and comments. Do not touch `CERTS`, `EXAMS`, `WEIGHT_MATRIX`, `CERT_W_EXC`, the `store` call sites, the `liferpg-*` keys, or any existing `migrate` block. **There is no schema change in this task**: if something seems to need a stored field, stop and report.
>
> ### Phase A — the running page is never reloaded by the app
>
> **A.1 Decision, already made — keep `skipWaiting()` and `clients.claim()`; remove only the reload.** `tools/harness/gen-sw.js` keeps both calls. The trade-off, both ways:
>
> | | Keep `skipWaiting()` (chosen) | Drop it, let the worker wait |
> |---|---|---|
> | Running page | keeps executing the bundle it loaded, while the new worker has already deleted the old cache on activate | never touched; the old cache stays intact until every client is gone |
> | When the new build applies | on the next document load — online or offline, from the new cache, complete and consistent | only after every client of the scope is gone; an installed app restored from the task switcher is still a client, so the update can sit unapplied for days |
> | Failure mode | the running page would break if it fetched an asset that only existed in the deleted cache | the old worker keeps serving while the network-first document already returns the **new** HTML, so the old worker fetches new hashed assets into the **old** cache — a mixed state that is then deleted when the new worker finally activates |
>
> The deciding fact is that this app ships **one bundle with no lazy chunks and no runtime asset fetches**: after load, a claimed page never asks for anything the eviction removed, so the first row's hazard has no concrete failure here, while the second column's "never activates" failure is real on a phone. Keeping claim also keeps `flow6`'s first-visit guarantee (the worker controls the page without a reload fallback). Add one line to the module header comment of `tools/harness/gen-sw.js` recording this: `skipWaiting` + `claim` stay so a new build is complete and consistent on the next open; the page is never reloaded by the app. **Do not change the emitted `swSource` string** — the generated `dist/sw.js` must stay byte-identical apart from its build id.
>
> **A.2 `src/main.jsx`.** Delete the `controllerchange` listener, `hadController` and `reloading`. Keep the `load` listener with `navigator.serviceWorker.register("./sw.js", { scope: "./" })`, keep `navigator.storage?.persist?.()`. Rewrite the comment so it describes what now happens — a new build installs and takes over in the background, the page keeps running the bundle it loaded, the new version applies the next time the app is opened, and the app never reloads itself because the running page is where the user is working. Name the report in the comment (2026-09-13: the app returned to the home tab a few seconds after a tab switch). No other file in `src/` gains a reload, and `tab` stays `useState("home")` — **do not** persist the tab; the reload was the defect, not the tab state. No toast or "new version" notice: that is new UI copy and is out of scope.
>
> **A.3 E2E — prove the update case** (`tools/e2e/flow6.js`). The existing step `a first visit does not reload itself` does not cover it and, on a fresh profile, cannot: `hadController` is `false` on a first load, so the old code passes it too. The update case needs a page that is **already controlled at load time** and then has a new worker take over. Simulate it without a second deploy like this, in a throwaway browser context so nothing leaks into the main page:
>
> New step immediately after `a first visit does not reload itself`, named `a controlled page does not reload when a new worker takes over`:
> 1. `const ctx = await page.browser().createBrowserContext(); const fresh = await ctx.newPage();`
> 2. `await fresh.goto(page.url(), { waitUntil: "domcontentloaded" })`, then poll `navigator.serviceWorker.controller` (up to ~8 s) until it is non-null — the first worker installing and claiming. Throw `the first worker never took control — the update case cannot be simulated` if it stays null.
> 3. `await fresh.reload({ waitUntil: "domcontentloaded" })`. This second load is the point of the step: a controller exists *at load time*, which is exactly the condition the old code reloaded on.
> 4. Attach the navigation counter **after** that reload, with the existing step's idiom: `let navs = 0; fresh.on("framenavigated", (f) => { if (f === fresh.mainFrame()) navs++; });`
> 5. In the page, record `navigator.serviceWorker.controller.scriptURL`, then `await navigator.serviceWorker.register("./sw.js?e2e-update=1", { scope: "./" })`. A different script URL at the same scope replaces the registration, so a new worker installs, `skipWaiting()` activates it, `clients.claim()` takes the page, and `controllerchange` fires — the real update sequence. The preview server serves the same bytes for the query-stringed path, so the worker is identical in behaviour.
> 6. Poll (up to ~8 s) until `navigator.serviceWorker.controller.scriptURL` differs from the recorded one. If it never differs, throw `the new worker never took control — this step proved nothing`: the step must fail loudly rather than pass on a simulation that did not happen.
> 7. `await sleep(3000)`, then `if (navs !== 0) throw new Error(\`the page reloaded itself ${navs} time(s) when a new worker took over\`);`
> 8. `finally { await ctx.close(); }`
>
> Confirm before moving on that this step **fails on the pre-fix code** (stash `src/main.jsx`, build, run the step, see 1 navigation) and passes after. If the takeover cannot be produced in this harness, do **not** weaken the assertion into something that cannot fail. Report it, and fall back to the strongest honest check instead: in the same step, read the built bundle through the page (`const names = await caches.keys()` → the cache's `.js` entry → `fetch(url).then(r => r.text())`) and assert the text contains no `controllerchange` listener. State plainly in the report that the fallback is a code check, not a behaviour check.
>
> **Phase A gate:** `npm run verify` — 0 failed steps, 0 console errors, **140 steps**. Then `npm run finish` exit 0. This phase ships on its own; do not start Phase B before it is green.
>
> ### Phase B — the `성장` tab
>
> Rewrite `GrowthTab` only. Props and root wiring are unchanged. Collapse state is component state:
> ```js
> const [openWall, setOpenWall] = useState(false);
> const [openData, setOpenData] = useState(false);
> ```
> New order of `<main>` children, top to bottom: **1** proximity headline · **2** skill track · **3** record section (collapsed) · **4** data line (collapsed). Four children, so three `space-y-4` gaps.
>
> **B.1 Proximity headline** — one `<section className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">`, the first thing on the tab.
> - `SectionLabel tone="text-cyan-400"` → `롤모델 근접도` (**new string**; the old `롤모델` label is gone).
> - `rg` exists: a flex row — left, `「{state.role.name}」` in `text-sm font-bold text-zinc-100` (truncating) with `검증 기준 근접도` beneath it in `text-xs text-zinc-500`; right, `{rg.match}%` in `font-mono font-black text-4xl text-cyan-300`. Both strings already exist today; keep them verbatim.
> - Then one line per `rg.items` entry, `space-y-2`, **no `bg-zinc-950` wrapper and no `p-3`**: a `flex items-center justify-between gap-2 text-xs` row with `{i.area.name}` on the left (`text-zinc-100 font-medium`, truncating) and, on the right, today's line unchanged — `{RANKS[i.have].name} / 요구 {RANKS[i.need].name}` plus ` · {i.gap}단계 부족` (`text-rose-400`) or ` · 충족` (`text-emerald-400`), `font-mono` — followed by the existing segmented bar at `h-2` (was `h-3.5`), `gap-0.5`, `mt-1`. **Keep the width formula and the fill condition exactly as they are** ([Rule 14](../../design-docs/core-beliefs.md#rule-14)): `w = (((k + 1) / need)² − (k / need)²) × 100`, cyan while `k < Math.min(i.have, i.need)`.
> - The legend paragraph `칸 하나 = 등급 한 단계, 칸 너비 = 그 단계의 비중. 하위 등급은 좁고 상위 등급은 넓어, 상위 승급 없이는 근접도가 오르지 않습니다. 롤모델 요구에 없는 영역의 활동은 반영되지 않습니다.` is **removed from the tab and added verbatim to `RoleAdviceModal`**, as the last line of the modal body in **both** branches (the gap list and the `모든 요구 영역을 충족했습니다. 근접도 {rg?.match}%.` branch), directly above the existing footer `추천은 직무 분야 매칭과 직무 가중 기준입니다.` in the gap branch. Same `className="text-xs text-zinc-600"`. It is the one surface that explains the bars, and it is one tap away via `방향 제안`.
> - `rg` is `null` (no role model, **or** a role whose areas are all excluded): the right-hand number slot renders `—` in `font-mono font-black text-4xl text-zinc-600`, the left reads `롤모델 미설정 — 근접도 계산 대상 없음` (**new to this file**, already the exact wording `buildBriefing` uses, so it is not new vocabulary) in `text-sm text-zinc-300`, and the existing sentence `목표 인물상의 영역별 요구 등급을 정하면, 검증된 등급으로만 근접도를 계산합니다.` stays beneath it in `text-xs text-zinc-500`. This must read as a fact plus what would produce the number — no encouragement.
> - Buttons, unchanged markup and unchanged strings, at the bottom of this card: `{state.role ? "롤모델 수정" : "롤모델 설정"}` → `onRoleModel`, and `방향 제안` → `onRoleAdvice` rendered only when `state.role && rg`. `clickText("롤모델")` in `flow.js` / `flow2.js` and `clickText("방향 제안")` in `flow3.js` must keep resolving to these buttons — verify, do not assume.
>
> **B.2 Skill track** — one `<section>` card: `SectionLabel tone="text-cyan-400"` → `실력 트랙 — 영역별 승급 관문` (unchanged string), then `state.areas.map` in `space-y-1.5`. Each area is **one row**, built on the `BizTodoRow` idiom (`w-full text-left flex items-center gap-2.5 bg-zinc-950 rounded-xl px-3 py-2.5 active:opacity-70`):
> - lead: the existing grade box, shrunk to `w-7 h-7` — `rounded-lg border border-zinc-700 bg-zinc-900 flex items-center justify-center font-mono font-bold text-xs text-cyan-300` holding `{p.grade}`.
> - middle (`flex-1 min-w-0`): line 1 `{p.name}` in `text-sm font-semibold truncate`; line 2 in `text-xs text-zinc-500 truncate` → `등급 {cur.name} · 다음 관문 {next.name}` (**new composite string**) when `next` exists, otherwise `정점 도달` (existing string).
> - trailing: `{p.grade}/9` in `text-xs font-mono text-zinc-600 shrink-0`, then — when `next` exists — a `Lock` icon `size={13} className="text-zinc-500 shrink-0"` and the character `›` in `text-zinc-600 shrink-0`. The lock is the gate marker the tab already used; the chevron is the app's existing "opens something" affordance (`채우기 ›`, `도감에서 더 보기 ›`).
> - `next` exists → the row is a `<button onClick={() => onPromote(p)}>`. **No `dir` chip, no `cur.gate` prose, no `필요 증거:` line, no full-width cyan button.** `next` does not exist (grade 9) → the row renders as a `<div>`, not a button, with the `Trophy size={13}` icon and `정점 도달`; `PromoteModal` returns `null` for that area, so it must not be tappable.
> - **Deleted from the tab, with their facts relocated:** `다음 관문 — {next.name} · {next.gate}` (the rank name survives on line 2; `next.gate` is already the `PromoteModal` lead line), `필요 증거: {next.req}` (**moved into `PromoteModal`**, see B.3), `관문 증명하기` (the row is the control), the per-area `검증된 성취 {n}건` block (**moved into the record section**, see B.4), and the `· {p.dir.join("·")}` suffix (job directions are edited and shown in `RoleAdviceModal`, which is one tap away, and they are not a growth number).
>
> **B.3 `PromoteModal` — one added line, nothing else.** Under the existing `{next.gate}` line inside the lead `bg-zinc-950` card, add `<div className="text-xs text-zinc-500 mt-1">필요 증거: {next.req}</div>` — the exact string the tab used to render. The modal then states both halves the tab's prose used to carry. Do not touch `EvidencePicker`, `GATE_CHIPS`, the one-chip minimum, `composeEvidence` or the submit button ([Rule 11](../../design-docs/core-beliefs.md#rule-11)).
>
> **B.4 Record section (`성취의 벽`), collapsed by default** — one `<section className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">` whose header is a `<button className="w-full text-left flex items-center justify-between gap-2" onClick={() => setOpenWall((v) => !v)}>`:
> - left: `SectionLabel tone="text-amber-400"` → `성취의 벽` (unchanged; `flow.js` asserts this text), and beneath it a `text-xs font-mono text-zinc-500` counts line — **new string** `트로피 {t}개 · 시험 {e}개 · 검증된 성취 {a}건`, where `t = state.room.trophies.length`, `e = Object.keys(state.exams?.best || {}).length`, `a` = the sum of `p.achievements.length` over `state.areas`. These three numbers are what keeps the section honest while closed ([Rule 13](../../design-docs/core-beliefs.md#rule-13)): zeros are stated, not hidden.
> - right: `ChevronDown size={14}` from lucide (add the import), `className={openWall ? "text-zinc-500 rotate-180" : "text-zinc-500"}`.
> - open panel (`mt-3 space-y-3`), in this order, every block moved verbatim from today's code:
>   1. the empty state (`EmptyWallSvg` + `아직 검증된 성취가 없습니다 — 완료는 증거로만 기록됩니다.`) under today's condition;
>   2. the `WallFrame` trophy strip (`slice(-10)`, `TrophySvg` 26);
>   3. the specialisation lines `🎖 {LANG_KO[l] || l} 전문화 — 고난도 감쇠 하한 70%`;
>   4. the `exams.best` rows `{fam?.n} {b.label}` · `D{b.d} · 누적 {b.p.toLocaleString()}P`;
>   5. **new:** one block per area, in `state.areas` order — a `flex items-center justify-between gap-2` line with `{p.name}` (`text-xs text-zinc-400 truncate`) and `검증된 성취 {p.achievements.length}건` (`text-xs font-mono text-zinc-600 shrink-0`, the existing string), followed, when the count is > 0, by today's list markup unchanged: `p.achievements.slice(-30).reverse()`, `space-y-1.5 max-h-32 overflow-y-auto pr-1`, each row `Star size={11}` + `{ac.text}` + `{ac.date} · {RANKS[ac.grade].name} 인정`. An area with zero achievements renders the count line only — the number is a fact and is stated.
>
> **B.5 Data line (`백업` + `데이터 초기화`), collapsed by default** — one `<section>` with the same header-button pattern (`ChevronDown`, `openData`): the header reads `데이터 — 백업 · 초기화` (**new string**) in `text-xs tracking-widest font-semibold text-zinc-400`. The open panel holds, verbatim and unchanged: the line `기록은 이 기기에만 있어요. 저장소가 지워지면 복구할 수 없으니 가끔 파일로 내보내요.`, the two buttons `백업 내보내기` / `백업 불러오기` → `onExport` / `onImport`, and below them today's reset button (`RotateCcw size={12}` + `데이터 초기화` → `onReset`) with its markup unchanged. The `백업` `SectionLabel` inside the panel may go, since the header already names it. Note that the hidden JSON file input lives on `Shell`, not here, so `flow6`'s import step is unaffected by the collapse.
>
> **B.6 Korean strings — the complete list for this phase** (each is an E2E selector; anything not listed must not change):
>
> | String | Change |
> |---|---|
> | `롤모델 근접도` | **added** (headline `SectionLabel`) |
> | `롤모델` | **removed** as a `SectionLabel`; the words survive in the buttons `롤모델 설정` / `롤모델 수정` |
> | `롤모델 미설정 — 근접도 계산 대상 없음` | **added** to `GrowthTab` (already used verbatim by `buildBriefing`) |
> | `등급 {cur.name} · 다음 관문 {next.name}` | **added** (area row, line 2) |
> | `트로피 {t}개 · 시험 {e}개 · 검증된 성취 {a}건` | **added** (record header counts line) |
> | `데이터 — 백업 · 초기화` | **added** (collapsed data header) |
> | `다음 관문 — {next.name} · {next.gate}` | **removed** from the tab |
> | `필요 증거: {next.req}` | **moved** tab → `PromoteModal` |
> | `관문 증명하기` | **removed** (the row itself opens the modal) |
> | `칸 하나 = 등급 한 단계, …` (full sentence above) | **moved** tab → `RoleAdviceModal` |
> | `「{role.name}」`, `검증 기준 근접도`, `{RANKS[have].name} / 요구 {RANKS[need].name}`, `· {gap}단계 부족`, `· 충족`, `목표 인물상의 영역별 요구 등급을 정하면, 검증된 등급으로만 근접도를 계산합니다.`, `롤모델 설정`, `롤모델 수정`, `방향 제안`, `실력 트랙 — 영역별 승급 관문`, `정점 도달`, `{grade}/9`, `성취의 벽`, `아직 검증된 성취가 없습니다 — 완료는 증거로만 기록됩니다.`, `🎖 … 전문화 — 고난도 감쇠 하한 70%`, `검증된 성취 {n}건`, `… 인정`, `기록은 이 기기에만 있어요. …`, `백업 내보내기`, `백업 불러오기`, `데이터 초기화` | **unchanged**, relocated only |
>
> **B.7 Height budget.** Measure `document.querySelector("main").getBoundingClientRect().height` at 390 px on the demo save, everything collapsed. Before: **1,963 px**. Target: **≤ 900 px**.
>
> | Block | Before | After |
> |---|---|---|
> | `성취의 벽` | 165 | ~60 (header + counts line, collapsed) |
> | `실력 트랙` label | 16 | folded into the card |
> | four area cards | 270 + 270 + 270 + 184 = 994 | ~250 (label + four ~52 px rows) |
> | `롤모델` | 388 | ~210, moved to the top |
> | `백업` | 138 | ~44 (one collapsed line, with reset inside) |
> | `데이터 초기화` | 38 | folded into the line above |
> | `space-y-4` gaps | 128 (8 gaps) | 48 (3 gaps) |
> | `pb-24` | 96 | 96 |
> | **`<main>`** | **1,963** | **~710, must be ≤ 900** |
>
> If the measured height exceeds 900 px, report the measurement rather than deleting a number to make the budget.
>
> **B.8 E2E** (step names in English, selector arguments in Korean UI copy). Four existing steps break on the collapse and must be fixed in the same commit; two steps are added.
>
> 1. **`tools/e2e/run.js` — new shared helper** `openAreaGate(name)` (exposed on `h`, next to `todoRows`): in the growth tab, find the buttons inside the skill-track card (those whose text matches `/\d\/9/`), pick the one whose text includes `name` or the first when `name` is omitted, scroll it into view and click it; return false when none matched. Both `flow.js` and `flow3.js` need it, and `finish-check` treats a repeated ≥ 6-line helper as a duplicate — define it once.
> 2. **`flow.js` `open promotion gate modal`** — replace `clickText("관문 증명하기")` with `await h.openAreaGate()`, then `await expectText("승급 심사")` before `h.closeModal()`. The error pushed on failure stays Korean-free in its step name; keep the existing `errors.push` idiom.
> 3. **`flow3.js` `promotion — submit after selecting evidence chips`** — same replacement for its `clickText("관문 증명하기")`; the chip selection and `clickInModal("증거 제출 · 승급")` below it are unchanged.
> 4. **`flow6.js` `backup export writes the state to a file`** — after `clickTab("성장")`, add `await clickText("데이터 — 백업 · 초기화");` before `expectText("백업")` and the anchor stub. `백업 불러오기` is not needed by the import step (its file input is on `Shell`), so `backup import restores the saved state` is unchanged — verify that.
> 5. **`flow.js` `data reset — clears evidence photo keys too`** — after `clickTab("성장")`, add `await clickText("데이터 — 백업 · 초기화");` before the `데이터 초기화` button scan. The collapsed header does not contain the substring `데이터 초기화`, so without this the scan fails — which is the intended proof that the toggle is real.
> 6. **`flow2.js` `role model proximity displayed`** — today it asserts nothing. Rewrite it as `role-model proximity leads the growth tab`: switch to `성장`, read `main`'s first element child, and assert its text contains `근접도`, the role name `시니어 하네스 설계자` and a `%` figure equal to the `match` recomputed from `localStorage` (`round(mean(min(1, have/need)²) × 100)`), so the headline cannot silently disagree with `roleGap`. Same step name slot — the count does not change.
> 7. **`flow2.js`, new step** after it: `area rows collapse to one line and open the promotion gate` — in `성장`, assert the body contains neither `관문 증명하기` nor `필요 증거:`; assert an area row states `{grade}/9` and `다음 관문`; `h.openAreaGate("기본지식")`; assert `승급 심사` and `필요 증거:` are now in the open modal; `closeModal()`.
> 8. **`flow2.js`, new step** after that: `the achievement wall states its counts while collapsed` — in `성장`, assert the closed header line matches `/트로피 \d+개 · 시험 \d+개 · 검증된 성취 \d+건/` and that `검증된 성취 0건`-style per-area rows are **not** rendered yet; click `성취의 벽`; assert a per-area line and `검증된 성취` appear. This is the [Rule 13](../../design-docs/core-beliefs.md#rule-13) guard: collapsing must not remove a number from the screen.
>
> **Phase B gate:** `npm run verify` — 0 failed, 0 console errors, **142 steps** (140 + 2). Manual 390 px check per "Verification" below.
>
> ### Phase C — finish, docs
>
> `npm run finish` exit 0 (expect no allowlist entry: every symbol added lands with its call site; confirm `EmptyWallSvg`, `WallFrame`, `TrophySvg`, `Lock`, `Trophy`, `Star`, `RotateCcw` are all still referenced and that `ChevronDown` is the only new icon import). `npm run lang:check` clean. `npm run docs:gen && npm run docs:check` exit 0. `npm run verify -- --smoke` once at the end.
>
> Report: what changed, every command with its result, the E2E count 139 → 140 → 142, the measured `<main>` height before and after, whether the Phase A step was confirmed to fail on the pre-fix code, and a proposed commit message per phase. Do not commit unless the user asks.

## Steps

1. [ ] **Phase A** — `src/main.jsx` (listener, `hadController`, `reloading` removed; comment rewritten), `tools/harness/gen-sw.js` header comment, `flow6.js` new step; confirm the step fails on the pre-fix build. Gate: `npm run verify` 140 steps green, `npm run finish` exit 0.
2. [ ] **Phase B1** — `GrowthTab` rewrite (headline, skill-track rows, record section, data line) + the `PromoteModal` `필요 증거:` line + the `RoleAdviceModal` legend paragraph.
3. [ ] **Phase B2** — `run.js` `openAreaGate`, the four existing E2E fixes, the two new `flow2.js` steps. Gate: `npm run verify` 142 steps green + the 390 px measurement.
4. [ ] **Phase C** — `npm run finish`, `npm run lang:check`, `npm run verify -- --smoke`, `npm run docs:gen`, `npm run docs:check`; hand to docs-syncer with the table below; move this plan to `docs/exec-plans/completed/`.

## Verification

- `npm run verify` at each gate — **0 failed steps, 0 console errors**. Counts: 139 today → **140** after Phase A → **142** after Phase B.
- `--smoke` is **not required**: no payout formula, `CERTS` / `EXAMS` row, matrix cell or grade cut is touched, and `tools/harness/smoke-logic.js` only mirrors the data and payout engine. Run `npm run verify -- --smoke` once at the final gate anyway — it is cheap and proves the tables are untouched.
- `npm run finish` exit 0; `npm run lang:check` clean; `npm run docs:gen && npm run docs:check` exit 0.
- **Manual 390 px check** (Chrome devtools, 390 × 844, demo save via `데모 데이터로 둘러보기`): `성장` tab — `document.querySelector("main").getBoundingClientRect().height` is **1,963 px before** and must be **≤ 900 px after** with both sections collapsed; `document.documentElement.scrollWidth === window.innerWidth === 390` (no horizontal scroll); the proximity number is above the fold; no area row wraps to a third line (`직업·커리어` is the longest demo name); expanding the record section and the data line restores every block listed in B.4/B.5.
- **Manual Phase A check**: after `npm run build` + `npx vite preview`, open the app, switch to `성장`, and leave it for 60 s — the tab must not change. Then rebuild (a new `BUILD` id) while the page stays open, reload once, and confirm the new build is served and that no second navigation happens by itself.
- `npm run build:demo` + `node tools/harness/gen-screenshots.js` — the four manifest screenshots are `home` / `tasks` / `goals` / `calendar`, **none of which is the `성장` tab**, so no regeneration is expected. Re-run both commands and commit the PNGs only if a shot actually changed (a shared atom or the bottom nav would be the only way).

## Cleanup checklist

- [ ] `npm run finish` exit 0 (unused symbols/imports, duplicates, residue, language).
- [ ] `hadController` / `reloading` fully removed from `src/main.jsx`; no `location.reload()` reachable from a service-worker event anywhere in `src/`.
- [ ] `EmptyWallSvg`, `WallFrame`, `TrophySvg`, `LANG_KO`, `examOf`, `Lock`, `Trophy`, `Star`, `RotateCcw` still referenced after the rewrite; `ChevronDown` imported and used; no other icon import added.
- [ ] `openAreaGate` defined once in `run.js` and used by both flows (no duplicated ≥ 6-line helper).
- [ ] No allowlist addition expected; any addition carries a reason and is mirrored in `docs/exec-plans/tech-debt-tracker.md`.

## Docs to sync

| File | Change |
|---|---|
| `docs/product-specs/growth.md` | Rewrite for the new order and shape: the proximity headline first (including the `rg === null` branch), the one-line area rows and the tap-to-`PromoteModal` behaviour, the collapsed record section with its counts line and the per-area achievement lists, the collapsed data line; every string in the B.6 table. |
| `docs/design-docs/metrics-and-role-model.md` | The bar now renders on the headline at `h-2` with no wrapper; the legend paragraph lives in `RoleAdviceModal`; `roleGap` itself is unchanged ([Rule 14](../../design-docs/core-beliefs.md#rule-14)). |
| `docs/design-docs/evidence-and-promotion.md` | `PromoteModal` now also states `필요 증거: {next.req}`; the promotion path is otherwise identical and the tab no longer carries a promote button ([Rule 11](../../design-docs/core-beliefs.md#rule-11)). |
| `docs/product-specs/evidence-modals.md` | Add the `필요 증거:` line if the file documents `PromoteModal`'s lead card; otherwise confirm no change and say so. |
| `docs/design-docs/information-architecture.md` | Screen-map row for `growth`: `롤모델 근접도` · `실력 트랙 — 영역별 승급 관문` (row → `PromoteModal`) · `성취의 벽` (collapsed) · `데이터 — 백업 · 초기화` (collapsed). |
| `docs/product-specs/install-and-backup.md` | The backup controls now sit behind the collapsed `데이터 — 백업 · 초기화` line; **and** the service-worker paragraph: the app no longer reloads on `controllerchange` — a new build takes over in the background and applies on the next open. |
| `docs/RELIABILITY.md` | "Offline and updates": replace `the page reloads once when the new worker takes control` with the new policy and the reason; step count 139 → 142 and the three new/changed steps. |
| `tools/e2e/README.md` | `flow6` gains the controlled-page update step; `flow2` gains two growth-tab steps; the 139-step line becomes 142; mention `openAreaGate` among the shared helpers. |
| `ARCHITECTURE.md` | Status line (E2E 142 steps); Tabs region note for `GrowthTab`'s new composition if the row names components. |
| `docs/DESIGN.md` | The A6 growth entry still describes life metrics and `관문 증명하기` — correct it to the shipped composition. |
| `docs/design-docs/decision-log.md` | Two dated entries: the update policy (`skipWaiting` kept, reload removed, with the single-bundle reasoning) and the `성장` simplification (proximity as the headline, one-line area rows into `PromoteModal`, collapsed records and data), each linking this plan. |
| `docs/exec-plans/tech-debt-tracker.md` | Note against **TD-11** that the `rg === null` branch now also covers "role set, every area excluded", and that the button still reads `롤모델 수정` — the defect is unchanged. |
| `docs/generated/*` | `npm run docs:gen` (symbol index; the schema is unchanged). Never hand-edit. |

## Proposed commit

```
fix(pwa): apply a new build on the next open instead of reloading the page
```
```
feat(growth): 근접도 leads the tab, areas collapse to one row into the gate
```
