# Business tab — `사업` portfolio, unit prices and period contracts
- Status: completed
- Date: 2026-09-12
- Needs approval: yes — already granted 2026-09-12 (one new `if (s.v < 20)` block, schema v20, plus a new `liferpg-img-folio-{id}` key shape: [Rule 12](../../design-docs/core-beliefs.md#rule-12), [Rule 16](../../design-docs/core-beliefs.md#rule-16) key convention). No data table row is touched and no user data is deleted.
- Agents: planner → implementer → cleanup → verifier → docs-syncer

## Goal
The user is preparing a software and AI development business sold on period-based contracts (monthly engagements) and is pre-revenue. Everything that business needs to be judged by — what has been built (portfolio), what it is sold for (unit prices), what is contracted and what has actually been collected (deals) — lives in scattered files today. Add a sixth bottom tab `사업` that holds all three in one place, "at a glance, like an assistant": the tab header states this month's contracted revenue, the confirmed collection, the remaining backlog, the quote pipeline and the number of billed months whose payment is unconfirmed; the daily briefing, the home card and the assistant packet repeat those same numbers so no two surfaces can disagree. A period contract is stored as a **billing rule** (start month, length, monthly amount) plus the user's own `paidMonths` stamps — exactly as `events[].repeat` is a recurrence rule that `occurrencesOf` expands at render — and every total is derived ([Rule 9](../../design-docs/core-beliefs.md#rule-9)). A business record is a record, never a `실행` (task): it pays no P, creates no trophy, moves no goal and touches no streak.

## Context read
`src/LifeManager.jsx` (5,661 lines): storage adapter `KEY` / `store` L1219-1239 (the only place `window.localStorage` is touched); `Bar` L1244, `DiffBadge` L1255, `SectionLabel` L1714, `Chip` L1718, `Modal` L1749; `resizeImage` L1504-1519; `uid`/`dstr`/`shiftDay`/`monthStr` L1211-1217, `daysBetween`/`mondayOf` L1783-1784; `jobWeightForCert` ends L2044; Daily assistant banner L2046; `agendaOf` L2076, the event helpers and `EVENT_*` constants L2088-2144, `CAP` L2150, `buildBriefing` L2154-2274, `PACKET_MAX`/`PACKET_EVENT_DAYS`/`PACKET_HEAD` L2278-2289, `buildAssistantPacket` L2291-2332, `parseAssistantReply` L2337-2360; `@schema` JSDoc L2363-2396, `migrate` L2397-2466 (last block `if (s.v < 19)` L2457-2464), `applyDailyTick` L2468, `freshState` L2475-2492, `demoState` L2494-2555; `HomeTab` L2984 with the briefing card and its schedule line L3017-3032; `BriefingModal` L3387-3422; `EvidenceViewModal` image reader L3604-3639; `EvidenceModal` own-`fileRef` pattern L4115-4182; schedule region L4604-4979 (`EventRow` L4675, `ScheduleTab` L4821 with the full-width counts line L4869-4872 and the `Chip` view row L4873-4876, `EventModal` L4908); app root L5034 — persist effect L5085-5088, `onFile`/`clearImg` L5092-5104, `removeTask` L5121-5126, `removeGoal` L5293-5310 (the `window.confirm` precedent), schedule handlers L5336-5392 (`toggleEventDone` L5369, `setScheduleView` L5392), `closeBriefing` L5396-5403, `exportBackup` L5468-5485, `importBackup` L5486-5498, `resetAll` L5501-5510, `NAV` L5528-5534, `<main>` L5553-5590, `nav grid-cols-5` L5592, the fifteen `modal?.type` blocks L5601-5655.
Harness: `tools/e2e/run.js` helpers (`clickTab`, `clickText`, `clickInModal`, `clickInModalExact`, `modalError`, `expectText`, `hasText`, `typeInto`, `setValue`, `attach`, `closeModal`, `reload`), `flow.js` L31-34 (fresh-save schema), L125-129 (nav order), L146-148 (the flow chain), L159-161 (demo sweep); `flow4.js` L6-15 `migrateFixture` and L124/L148 version checks; `flow6.js` L87 backup version; `flow7.js` (the record-not-task boundary assertions and the structural row reader); `tools/harness/gen-schema.js` L29-40 (the ledger scrape reads at most three `//` lines after `if (s.v < N) {`); `tools/harness/finish-allowlist.json`, `finish.config.json`, `gen-screenshots.js` (four manifest shots, all showing the nav bar).
Rules touched: [9](../../design-docs/core-beliefs.md#rule-9), [12](../../design-docs/core-beliefs.md#rule-12), [13](../../design-docs/core-beliefs.md#rule-13), [16](../../design-docs/core-beliefs.md#rule-16) (key convention only — the evidence path is untouched). Rules kept untouched by construction: [1](../../design-docs/core-beliefs.md#rule-1), [2](../../design-docs/core-beliefs.md#rule-2), [3](../../design-docs/core-beliefs.md#rule-3), [4](../../design-docs/core-beliefs.md#rule-4), [5](../../design-docs/core-beliefs.md#rule-5), [6](../../design-docs/core-beliefs.md#rule-6), [7](../../design-docs/core-beliefs.md#rule-7), [8](../../design-docs/core-beliefs.md#rule-8), [10](../../design-docs/core-beliefs.md#rule-10), [11](../../design-docs/core-beliefs.md#rule-11), [14](../../design-docs/core-beliefs.md#rule-14), [15](../../design-docs/core-beliefs.md#rule-15), [17](../../design-docs/core-beliefs.md#rule-17), [18](../../design-docs/core-beliefs.md#rule-18), [19](../../design-docs/core-beliefs.md#rule-19). Conventions: [FRONTEND.md](../../FRONTEND.md) (clone updater, derived-never-stored, Tailwind v3 core utilities only, `font-mono` for numbers, modal shape, E2E selectors are UI copy), [DESIGN.md](../../DESIGN.md) colour roles, AGENTS §6 language policy. Specs read for shape: [../../product-specs/schedule.md](../../product-specs/schedule.md), [../../product-specs/home.md](../../product-specs/home.md), [../../product-specs/daily-briefing.md](../../product-specs/daily-briefing.md), [../../design-docs/assistant-bridge.md](../../design-docs/assistant-bridge.md), [../../design-docs/state-lifecycle.md](../../design-docs/state-lifecycle.md), [../../design-docs/information-architecture.md](../../design-docs/information-architecture.md).

## Prompt
Implement the `사업` (business) feature in three phases. Every phase ends at its own full gate (`npm run verify` 0 failed / 0 console errors, `npm run finish` exit 0; Phase C adds `npm run docs:gen && npm run docs:check`). Do not start a later phase before the previous gate is green.

### Invariants that hold in every phase
A business record is a **record, never a `실행` (task)**, exactly as an event is. Registering a contract, ticking a payment, adding a rate or a portfolio entry must never: pay P, write into `areas[].achievements`, add to `room.trophies`, touch `act.streak` / `act.shieldsLeft` / `act.lastActive`, create or modify a `tasks[]` entry, carry a `goalId`, or pass through `completeTask`, `tryComplete`, `needsEvidence`, `detectKind`, `certByTitle`, `jobWeightForCert`, `calcExamPayout`, `krProgress`, `goalProgress`, `paceOf`, `agendaOf` or `doneTodayCount` ([Rule 1](../../design-docs/core-beliefs.md#rule-1), [Rule 10](../../design-docs/core-beliefs.md#rule-10), [Rule 18](../../design-docs/core-beliefs.md#rule-18), [Rule 19](../../design-docs/core-beliefs.md#rule-19)). A certification name inside a deal or portfolio title stays plain text.
Nothing derived is stored ([Rule 9](../../design-docs/core-beliefs.md#rule-9)): state holds the billing rule (`startMonth`, `months`, `monthly`, `costMonthly`) plus the user's own `paidMonths` stamps, and every month, total, margin, phase and roll-up is computed at render. There is **no** business score, no readiness percentage and no new global self-assessed number ([Rule 8](../../design-docs/core-beliefs.md#rule-8)).
Copy is Korean `해요체`, facts and numbers only; a zero is printed, never hidden, and a negative margin is printed in rose rather than softened ([Rule 13](../../design-docs/core-beliefs.md#rule-13)). Identifiers, comments, commit messages and docs are English (AGENTS §6); Korean UI copy named inside a code comment must sit in backticks, because `lang-check` strips backticked spans before testing for Hangul. Tailwind v3 core utilities only, no arbitrary values; numbers, amounts, months and percentages are `font-mono`; icons come from `lucide-react` and only imported when used.
Existing `migrate` blocks are never edited and `liferpg-*` keys never change ([Rule 12](../../design-docs/core-beliefs.md#rule-12)). No existing `store.get` / `store.set` / `store.del` call site changes (AGENTS §7); the new storage helpers are added **inside** the Storage region, which is the only place `window.localStorage` is touched today. `resizeImage` keeps byte-identical output — the evidence path of [Rule 16](../../design-docs/core-beliefs.md#rule-16) is untouched; the new fit-resize is a separate sibling function, not a flag on the old one.

### Phase A — schema v20, the Business engine region, the image pipeline, storage guards, demo data. No UI.

**A1. Schema v20 ([Rule 12](../../design-docs/core-beliefs.md#rule-12)).** Append exactly one block after the `if (s.v < 19)` block (L2457-2464); do not touch any earlier block. The ledger comment is the first thing inside the `if`, at most three `//` lines, because `tools/harness/gen-schema.js` scrapes only those three:
```js
if (s.v < 20) {
  // v20: business records — folio[] portfolio entries, rates[] unit prices, deals[] period contracts. A contract is a billing rule (startMonth, months, monthly) plus the user's own paidMonths stamps; every month, total and margin stays derived at render.
  // Records, never tasks: nothing here pays P, creates a trophy, moves a goal or touches the streak.
  // ui.bizView is a preference, exactly like ui.scheduleView.
  s = { ...s, v: 20, folio: s.folio || [], rates: s.rates || [], deals: s.deals || [],
        ui: { ...(s.ui || {}), bizView: ["rates", "folio"].includes(s.ui?.bizView) ? s.ui.bizView : "deals" } };
}
```
Update the `@schema` JSDoc header to `v20` and its `v: 20` line, add the three array shapes and extend the `ui` line; add the new pure helpers to the derived-values sentence at the bottom of the block. Field shapes, exactly:
```js
folio: [{ id, title, summary?, role?, stack?: [string], period?: { from: "YYYY-MM", to: "YYYY-MM" },
          links: [{ label, url }], createdAt }],
rates: [{ id, name, unit: "month" | "day" | "project", price, cost?, note?, createdAt }],
deals: [{ id, client, title, status: "lead" | "quote" | "won" | "lost",
          monthly?, costMonthly?, months?, startMonth?: "YYYY-MM", paidMonths?: ["YYYY-MM"], note?, createdAt }],
ui: { scheduleView, bizView: "deals" | "rates" | "folio" }
```
`freshState` becomes `v: 20` with `folio: []`, `rates: []`, `deals: []` and `ui: { scheduleView: "list", bizView: "deals" }`.
Four statuses, not five: `예정` / `진행` / `종료` is derived by `dealPhase` and never stored. `lead` and `quote` may carry no numbers at all. `cost` / `costMonthly` is optional and **never defaults to 0**. A deal carries no `unit` (a lump sum is `months: 1`) and no `rateId` — it snapshots its own numbers so a later rate edit cannot rewrite history. There is no `hasThumb` flag.

**A2. The Business region.** New region banner immediately **above** the `/* ───────── Daily assistant — agenda · briefing · bridge ───────── */` banner (today L2046), after `jobWeightForCert` ends (L2044). The region comment must state, in English: business records are records, never tasks ([Rules 1](../../design-docs/core-beliefs.md#rule-1), [18](../../design-docs/core-beliefs.md#rule-18)) — a signed contract pays no P, creates no trophy, moves no goal and touches no streak; every total is computed at render ([Rule 9](../../design-docs/core-beliefs.md#rule-9)).
Constants: `BIZ_REVENUE_MONTHS = 6`, `QUOTE_STALE_DAYS = 7`, `DEAL_END_SOON = 2`, `DEAL_MAX_MONTHS = 120`, `RATE_UNIT = { month: "월", day: "일", project: "건" }`, `DEAL_STATUS = { lead: "문의", quote: "견적", won: "계약", lost: "무산" }`.
Pure helpers, all of them derived-only:
- `wonText(n)` — the single money formatter, so every surface prints the same figure and no digit is ever dropped. `0` → `0원`; `|n| < 10000` → `{n.toLocaleString()}원` (`8,000원`); otherwise `만 = Math.floor(|n| / 10000)`, `rest = |n| % 10000`, printing `{만.toLocaleString()}만원` when `rest === 0` (`350만원`) and `{만.toLocaleString()}만 {rest.toLocaleString()}원` otherwise (`1,234만 5,600원`). A negative amount keeps a leading `-` and is formatted from its absolute value.
- `monthAdd(month, n)` → `"YYYY-MM"`; `monthsBetween(a, b)` → `(y2 - y1) * 12 + (m2 - m1)`. Both string-based, never `Date#toISOString`.
- `dealMonths(d)` → `Math.min(DEAL_MAX_MONTHS, Math.max(0, Math.floor(Number(d.months) || 0)))`.
- `dealEnd(d)` → `monthAdd(d.startMonth, dealMonths(d) - 1)` when `startMonth` and `dealMonths(d) > 0`, else `null`.
- `dealTotal(d)` → `(Number(d.monthly) || 0) * dealMonths(d)`; `dealCostTotal(d)` → `null` when `costMonthly == null`, else `Number(d.costMonthly) * dealMonths(d)`.
- `marginOf(price, cost)` → `null` when `cost == null`; else `{ amount: price - cost, rate: price > 0 ? (price - cost) / price : null }`. Negative is a legal result.
- `dealPhase(d, month)` → `"lead" | "quote" | "lost"` for those statuses; for `won`: `"upcoming"` when `startMonth > month`, `"ended"` when `dealEnd(d) < month`, else `"active"` (a `won` deal with no period, only reachable from hand-edited data, is `"active"`).
- `monthRevenue(d, month)` → `Number(d.monthly) || 0` when `d.status === "won"` and `month` lies in `[startMonth, dealEnd(d)]`, else `0`.
- `revenueByMonth(state, fromMonth, n)` → `[{ month, amount }]` for `n` consecutive months, summed over all deals; a month with nothing contracted still appears with `amount: 0`.
- `bizSummary(state, today)` → `{ month, thisMonth, collected, backlog, pipeline, unpaid, counts }`. `month = today.slice(0, 7)`. `thisMonth` = Σ `monthRevenue(d, month)`. `collected` = Σ `monthly` over `won` deals whose billed months include `month` and whose `paidMonths` contains `month`. `backlog` = Σ `monthly ×` (billed months strictly after `month` and up to `dealEnd`). `pipeline` = Σ `dealTotal(d)` over `status === "quote"`. `unpaid` = `[{ deal, month, amount }]` for every `won` billed month `≤ month` missing from `paidMonths`, month-ascending. `counts` = `{ lead, quote, won, lost, active, upcoming, ended, unpaid }`. **This is the single object the tab header, the briefing, the home card and the packet all read**, so they cannot disagree.

**A3. Image pipeline.** Extract the shared loader out of `resizeImage` (L1504) — one helper that creates the `Image`, holds the object URL, calls a draw callback on load, revokes the URL and rejects with `new Error("img")` on error. `resizeImage` keeps the same signature, the same cover-crop maths and the same `toDataURL("image/jpeg", 0.82)`, so its output stays byte-identical; prove it by diffing the produced data URL for one fixture before and after if anything about the body changes. Add the sibling:
`resizeImageFit(file, max = THUMB_MAX_EDGE, q = 0.72)` — scale `Math.min(1, max / Math.max(img.width, img.height))`, so the longest edge is at most 640 and a smaller image is **never** upscaled; canvas sized to the scaled dimensions, one `drawImage`, `toDataURL("image/jpeg", q)`; when the result is longer than `THUMB_MAX_CHARS` retry **once** at `0.55`, and when it is still too long reject with `new Error("too-big")`. A separate function, not a `fit` flag, so the evidence path stays untouched ([Rule 16](../../design-docs/core-beliefs.md#rule-16)).

**A4. Storage guards**, added inside the Storage region (L1219-1239) — the only place `window.localStorage` is touched, so no existing `store` call site changes. Constants `IMG_FILE_MAX = 8 * 1024 * 1024`, `THUMB_MAX_EDGE = 640`, `THUMB_MAX_CHARS = 300000`, `STORAGE_BUDGET = 3.5 * 1024 * 1024`. Helpers:
- `persisted(k)` → `try { return window.localStorage.getItem(k) != null; } catch { return false; }`.
- `storageUsedBytes()` → sum of `key.length + value.length` over `window.localStorage`, `0` on throw.
- `saveImageChecked(k, v)` → `{ ok: true }` or `{ ok: false, reason: "budget" | "quota", usedMB }`. Order: budget check first (`storageUsedBytes() + v.length > STORAGE_BUDGET` → `budget`), then `await store.set(k, v)`, then the verified write `persisted(k)`; when the verification fails, `store.del(k)` (so the memory fallback does not show an image this session that a reload would lose) and return `quota`.
The write path order is: file-size cap **before decode** → fit-resize → output cap with one retry → budget check → verified write. **At every failure the portfolio record still saves, without its image**, and its card renders `대표 이미지 없음`.

**A5. `demoState`.** Add three rates, two portfolio entries (no image data, so the placeholder shows) and four deals, with content that fits the existing demo persona (`하네스 지망생`, who already has a `사업` area). Required properties, all of them asserted later: this month's contracted revenue is **zero** (`이번 달 계약 0원`) because the finished contract ended two months ago and the signed one starts next month; exactly one past billed month is deliberately left out of `paidMonths`, so the severity-3 unpaid briefing line, the rose home-card count and the packet's `미수` line all render; the quote was created 9 days ago, so the stale-quote line fires (`QUOTE_STALE_DAYS = 7`); one of the three rates has no `cost`, so the cost-missing line renders; one deal is a `lead` carrying no numbers. Recommended rows: a `won` contract `{ client: "○○물산", title: "재고 관리 자동화 도구", monthly: 1200000, costMonthly: 300000, months: 3, startMonth: monthAdd(month, -4), paidMonths: [month-4, month-3] }`; a `won` contract `{ client: "△△테크", title: "사내 문서 검색 AI 구축", monthly: 3000000, costMonthly: 800000, months: 4, startMonth: monthAdd(month, 1) }`; a `quote` `{ client: "□□랩스", title: "리드 수집 크롤러", monthly: 1500000, months: 2, createdAt: shiftDay(today, -9) }`; a `lead` `{ client: "◇◇스튜디오", title: "예약 페이지 개편" }`; rates `웹 앱 개발 (월)` / `AI 도입 컨설팅 (일)` / `랜딩 페이지 제작 (프로젝트)` with the third carrying no cost; folio entries `사내 문서 검색 AI 프로토타입` and `스마트스토어 주문 자동 집계` with one or two links each.

**A6. E2E, 116 → 117 steps.** Change the version assertions from 19 to 20 in exactly five places: `flow.js` L33 (fresh save), `flow4.js` L13 (`migrateFixture`), `flow4.js` L124 and L148 (the two inline checks), `flow6.js` L87 (exported backup). Add one new step to `flow4.js` after the `v18 save → v19 life metrics removed` step: `v19 save → v20 business`, planting a complete v19 fixture (including `ui: { scheduleView: "calendar" }`, a journal and a review entry) and asserting `folio` / `rates` / `deals` are empty arrays, `ui.bizView === "deals"`, `ui.scheduleView` still `calendar`, and that no earlier record was lost or invented.

**A7. Allowlist.** Symbols that only Phase B or C renders will be reported by `finish-check` (it counts references corpus-wide). Add exactly what it reports to `tools/harness/finish-allowlist.json` with a reason naming this plan and the phase that removes the entry, and mirror every entry in `docs/exec-plans/tech-debt-tracker.md`. Expected set: `wonText`, `bizSummary`, `revenueByMonth`, `RATE_UNIT`, `DEAL_STATUS`, `BIZ_REVENUE_MONTHS`, `QUOTE_STALE_DAYS`, `DEAL_END_SOON`, `resizeImageFit`, `saveImageChecked`, `IMG_FILE_MAX` (`persisted`, `storageUsedBytes`, `THUMB_MAX_EDGE`, `THUMB_MAX_CHARS`, `STORAGE_BUDGET` are referenced by `saveImageChecked` / `resizeImageFit` and should not be flagged). Never invent a fake reference to silence the gate.

**Acceptance A (observable).** A fresh save is `v: 20` with three empty arrays and `ui.bizView === "deals"`; a planted v19 save migrates to v20 keeping every other field; `npm run verify` reports 117 steps, 0 failed, 0 console errors; `npm run finish` exit 0 with the allowlist entries above and their tracker rows; no UI change anywhere — no tab, no modal, no nav entry.

### Phase B — the `사업` tab, its three views and three modals.

**B1. `ui.bizView` follows the `ui.scheduleView` precedent exactly.** Root setter beside `setScheduleView` (L5392): `const setBizView = (v) => setState((prev) => ({ ...prev, ui: { ...(prev.ui || {}), bizView: v } }));`, with the one-line comment that the chosen view is a preference, not derived data (schema v20). `BizTab` takes two props `view` / `onView` and defends itself: any value other than `"rates"` or `"folio"`, including a save written before v20, renders `계약`.

**B2. `BizTab({ state, today, view, onView, onAdd, onEdit, onTogglePaid })`**, new region placed immediately before the `/* ───────── Overlay effects ───────── */` banner (today L4981), after `EventModal`. Header section, in this order and no other: a `SectionLabel` reading `사업` (tone `text-cyan-400`) with the per-view add button on the same row (`계약 추가` / `단가 추가` / `포트폴리오 추가`), then **two full-width `font-mono text-xs` lines under the header, never beside the button** — the schedule feature measured that a line sharing the header row wraps mid-word at 390 px — then the three view `Chip`s:
```
이번 달 계약 {won} · 입금 확인 {won}
남은 계약 {won} · 견적 대기 {won} · 입금 미확인 {n}건
[계약] [단가] [포트폴리오]
```
Both lines read one `bizSummary(state, today)` call. The `입금 미확인 {n}건` fragment is wrapped in `text-rose-400` when `n > 0`. The zero is always rendered; there is no absence phrase on these lines ([Rule 13](../../design-docs/core-beliefs.md#rule-13)).

**B3. `계약` view.** Groups rendered like `ScheduleTab`'s day groups (a group with no row is not rendered at all), in this order with these headings: `진행 중` (`text-cyan-400`) / `예정` (`text-zinc-400`) / `견적 대기` (`text-amber-300`) / `문의` (`text-zinc-400`) / `종료` (`text-zinc-500`) / `무산` (`text-zinc-600`), mapped from `dealPhase`. Row anatomy: client and title on the first line, the `DEAL_STATUS[d.status]` chip and a `수정` button beside them; then the period line `{startMonth} ~ {endMonth} · {n}개월 · 월 {won}` or `기간 미정`; then the totals line `총 {won} · 마진 {won} ({n}%)` — rose when the margin amount is negative — or, when `costMonthly` is absent, `원가 미입력 — 마진은 계산하지 않아요`. Percentages are `Math.round(rate * 100)`.
For `won` deals the row adds an `입금 확인` chip row: one button per **billed** month (`≤` this month), month-ascending, at most 12 with `외 {n}개월 더 있어요` stating the remainder; each button reads its `YYYY-MM` in `font-mono`, is emerald (`border-emerald-700 text-emerald-300`) when paid and zinc otherwise, and toggles `paidMonths` exactly as `toggleEventDone` toggles `doneDates` — the stamp and nothing else.
Below the groups, a `최근 6개월` section: `revenueByMonth(state, monthAdd(month, -(BIZ_REVENUE_MONTHS - 1)), BIZ_REVENUE_MONTHS)` rendered with the existing `Bar` component (ratio against the largest month, `1` as the divisor floor) plus the month in `font-mono` and `wonText(amount)`. A month with nothing contracted still renders its zero row.
Empty state when every group is empty: `등록한 계약이 없어요 — 문의·견적부터 기록해요.`

**B4. `단가` view.** One row per rate: name, the `RATE_UNIT[r.unit]` chip, `수정`, then `청구 {won} · 원가 {won} · 마진 {won} ({n}%)`, or `원가 미입력 — 마진은 계산하지 않아요` when `cost` is absent. Footer line `단가 {n}건 · 원가 입력 {m}건`. **No average-margin figure** — averaging unrelated rate rows means nothing. Empty state: `등록한 단가가 없어요 — 청구가와 원가를 넣으면 마진이 계산돼요.`

**B5. `포트폴리오` view.** A **single column**, not a grid: at 390 px a 2-up grid gives 170 px thumbnails, unreadable for a landscape diagram. Card: title, summary, role, `stack` chips, the period `{from} ~ {to}` in `font-mono` when present, the links as `<a target="_blank" rel="noreferrer">` chips, and the image as `className="w-full max-h-64 object-contain bg-zinc-950 rounded-xl border border-zinc-800"` — the `EvidenceViewModal` pattern — or the line `대표 이미지 없음`. Thumbnails are loaded by **one effect on view entry** (the `EvidenceViewModal` `alive` guard pattern), keyed on the item ids, reading `liferpg-img-folio-{id}`; the same effect records `storageUsedBytes()` so the footer does not rescan `localStorage` on every render. Footer: `포트폴리오 {n}건 · 대표 이미지 {m}장 · 저장 공간 {x}MB 사용 중 (약 5MB 한도)` with `{x}` as `(bytes / 1048576).toFixed(1)`. Empty state: `등록한 포트폴리오가 없어요 — 링크와 대표 이미지 1장을 넣어요.`

**B6. Three modals**, so `modal.type` grows 15 → 18: `deals`, `rates`, `folio`, each carrying `modal.item` in edit mode. No portfolio viewer modal and no payment modal — the card shows the image inline and the chips toggle in place. All three use `<Modal title onClose>`, a `등록` / `저장` submit and, in edit mode, a `삭제` button, exactly like `EventModal`.
- `DealModal` — `고객사 — 예: ○○테크`, `일감 이름 — 예: 사내 문서 검색 AI 구축`, status chips `문의` / `견적` / `계약` / `무산`, `시작 월` (`input type="month"`, label span in the `시간 (선택)` pattern), `개월 수` (number), `월 청구액 (원)`, `월 원가 (원, 선택)`, `메모 (선택)`. Validation, in this order: `고객사를 입력해 주세요.` → `일감 이름을 입력해 주세요.` → `계약 상태에서는 시작 월과 개월 수가 필요해요.` (status `won` only) → `개월 수는 1 이상 120 이하로 입력해 주세요.` → `월 청구액은 0 이상 숫자로 입력해 주세요.` → `월 원가는 0 이상 숫자로 입력해 주세요.`. A blank number field on a `lead` or `quote` is legal and stores nothing; a non-empty invalid one errors.
- `RateModal` — `단가 이름 — 예: 웹 앱 개발 (월)`, unit chips `월` / `일` / `건`, `청구가 (원)`, `원가 (원, 선택)`, `메모 (선택)`. Errors: `단가 이름을 입력해 주세요.` → `청구가는 0 이상 숫자로 입력해 주세요.` → `원가는 0 이상 숫자로 입력해 주세요.`
- `FolioModal` — `제목 — 예: 사내 문서 검색 AI`, `한 줄 설명 (선택)`, `역할 (선택) — 예: 기획·개발 단독`, `기술 (선택, 쉼표로 구분) — 예: React, FastAPI, pgvector`, two bare `input type="month"` controls for the period (no label copy is invented), the link row, and the image attachment. Links: type a URL into `링크 주소 — https://…` and tap one of the label chips `GitHub` / `Notion` / `Figma` / `배포` / `기타` to append `{ label, url }` and clear the input; added links render as removable chips. Errors: `제목을 입력해 주세요.`, `링크는 http:// 또는 https:// 로 시작해야 해요.`, `링크는 4개까지 등록돼요.`, `이미지가 너무 커요 — 8MB 이하 파일만 등록돼요. (선택한 파일 {n}MB)`, `이미지를 읽지 못했어요.`, `이미지를 줄이지 못했어요 — 더 작은 이미지를 골라 주세요.` (the `too-big` rejection). Attachment button: dashed border with `Paperclip`, `📎 대표 이미지 1장 (선택)` and the sub-line `JPG·PNG · 가로세로 비율 그대로 저장돼요`; the preview carries a `✕` remove button.
  `FolioModal` owns **its own** `fileRef`, like `EvidenceModal`, and nothing outside the modal touches that ref — the root's `fileRef` / `slotRef` / `onFile` stay exactly as they are (R-14 in the tracker is the reason). The image is written **only on submit**, under `liferpg-img-folio-{id}` where `id` is `folio?.id || uid()` computed at submit and passed inside the record, so a cancelled modal leaves no orphan key. On a storage failure the record is still submitted, with the failure reason handed to the root.

**B7. Root handlers — one generic trio, not nine.**
- `addBiz(list, item, imgWarn)` / `updateBiz(list, id, next)` / `removeBiz(list, id)`, with `list` one of `"folio" | "rates" | "deals"`, all using the `structuredClone` updater pattern; `addBiz` prepends `{ id: uid(), createdAt: today, ...item }` (the `addEvent` shape, so an id supplied by `FolioModal` wins), `updateBiz` replaces the record while keeping `id`, `createdAt` and, for deals, `paidMonths`.
- `removeBiz` asks first through `window.confirm`, the `removeGoal` precedent: `{title} 포트폴리오를 삭제해요. 등록한 대표 이미지도 함께 사라져요. 계속할까요?` and `{client} {title} 계약 기록을 삭제해요. 입금 확인 표시 {n}건도 함께 사라져요. 계속할까요?`. A rate carries neither an image nor a stamp, so it is deleted without a confirmation. Deleting a folio entry also calls `store.del(\`liferpg-img-folio-${id}\`)`.
- `toggleDealPaid(id, month)` — adds or removes `month` in `paidMonths` (kept sorted), exactly as `toggleEventDone` handles `doneDates`, and nothing else.
- Toasts, with the Korean particles matched: `포트폴리오를 등록했어요` / `포트폴리오를 수정했어요` / `포트폴리오를 삭제했어요` / `단가를 등록했어요` / `단가를 수정했어요` / `단가를 삭제했어요` / `계약을 등록했어요` / `계약을 수정했어요` / `계약을 삭제했어요` / `{YYYY-MM} 입금 확인으로 표시했어요` / `{YYYY-MM} 입금 확인을 취소했어요`. When `imgWarn` is present the record toast still fires first and the image toast follows after `2700` ms, the `specGain` pattern in `completeTask`, so the two do not overwrite each other: `대표 이미지를 저장하지 못했어요 — 저장 공간이 가득 찼어요. 포트폴리오 이미지를 지우고 다시 시도해요.` (`quota`) or `저장 공간이 부족해요 — 현재 {x}MB 사용 중이라 이미지를 추가하지 않았어요. 기존 이미지를 지운 뒤 다시 시도해요.` (`budget`).
- Key registration: the writer is `FolioModal`'s submit, the reader is the folio view effect, and `removeBiz`, `resetAll` and `exportBackup` must each iterate `state.folio` for `liferpg-img-folio-{id}`. `importBackup` is already generic (it writes back every key in `data.images`) and needs no change; `removeTask` / `removeGoal` need no change.

**B8. Navigation.** `NAV` gains `["biz", "사업", Briefcase]` **before** the `성장` entry — final order `홈 · 목표 · 실행 · 일정 · 사업 · 성장`; `Briefcase` is present in the installed `lucide-react@0.460.0` and is added to the existing import. The nav wrapper becomes `grid-cols-6`; `<main>`'s `pb-24` and the toast's `bottom-16` are unaffected. Add the `tab === "biz"` branch to `<main>`, wired `view={state.ui?.bizView} onView={setBizView} onAdd={(list) => setModal({ type: list })} onEdit={(list, item) => setModal({ type: list, item })} onTogglePaid={toggleDealPaid}`.

**B9. E2E, 117 → 130 steps.** New `tools/e2e/flow8.js`, required from `tools/e2e/flow.js` **between the `flow7.js` and `flow4.js` lines** (today L146-147), so it runs on a real session before `flow4.js` starts planting legacy fixtures. Update the nav-order step in `flow.js` (L125-129) to `["홈", "목표", "실행", "일정", "사업", "성장"]` and add `사업` to the demo sweep loop (L160) — both are rewrites, not new steps. Thirteen steps, all boundary-aware:
1. `business tab opens on the 계약 view and states its zeros` — `clickTab("사업")`, both header lines present, empty state `등록한 계약이 없어요 — 문의·견적부터 기록해요.`
2. `the deal form refuses a contract without a client, a title or a period` — the three error strings read back through `modalError()`, and `deals` still empty afterwards.
3. `a won contract registers under 진행 중 with its period, total and margin` — the period and totals lines asserted verbatim through a structural row read (the `flow7.js` reader: every row carries a `수정` button and the card is its grandparent).
4. `registering a contract changes deals and nothing else` — snapshot the whole state before and after and assert: no new `room.trophies` entry, no new `areas[].achievements` entry, `act.streak` / `act.shieldsLeft` / `act.lastActive` unchanged, `tasks.length` unchanged, and no `goalId` / `pts` / `diff` key on the stored deal.
5. `a payment chip stores only its month stamp` — tap a billed month, assert it turns emerald, `paidMonths` contains exactly that month, and the same untouched-state assertions as step 4.
6. `un-ticking removes the stamp` — the chip returns to zinc and `paidMonths` is empty.
7. `a lead registers with no numbers` — lands under `문의`, no totals line.
8. `a quote feeds 견적 대기` — the header line's amount changes by the quote total.
9. `a contract without a cost prints the cost-missing line` — `원가 미입력 — 마진은 계산하지 않아요`.
10. `the 단가 view lists rates and counts the ones with a cost` — footer `단가 {n}건 · 원가 입력 {m}건`.
11. `a landscape image keeps its aspect in the stored thumbnail` — upload a landscape fixture and read `liferpg-img-folio-{id}` back into an `Image` in the page, asserting `naturalWidth > naturalHeight` and that a source smaller than 640 px was not upscaled. Build the fixture in `flow8.js` the way `run.js` writes `shot.png`: a 24 × 8 24-bit BMP assembled with a `Buffer` (rows are 72 bytes, already 4-byte aligned) written to `tools/e2e/out/`, or an inlined base64 PNG of the same dimensions.
12. `deleting a portfolio item removes its image key` — stub `window.confirm` the way `flow4.js` does, then assert both the record and `liferpg-img-folio-{id}` are gone.
13. `the chosen business view survives a reload` — switch to `포트폴리오`, reload, assert the tab reopens there and `ui.bizView === "folio"`.
Selector discipline: the view chips are the only page buttons whose **exact** text is `계약` / `단가` / `포트폴리오` (the add buttons read `계약 추가` and so on), so select them with an exact-text click helper like `flow7.js`'s `clickExact`, never a bare `clickText("계약")`. Address `input type="month"` with `setValue` as `flow7.js` does for the date input.

**Acceptance B (observable).** The bottom bar shows six tabs in the order above and does not wrap at 390 px; the `사업` tab opens on `계약`, states both header lines, groups contracts by derived phase, toggles payment chips, rolls up `최근 6개월` including zero months, lists rates with their margins and portfolio entries in one column with a working image; all three modals validate with the exact strings above; a portfolio deletion removes its image key; `deals` / `rates` / `folio` are the only state arrays any of it writes. `npm run verify`: 130 steps, 0 failed, 0 console errors; `npm run finish` exit 0 with the Phase B allowlist entries and their tracker rows removed.

### Phase C — assistant surfaces, the state-write guard, docs.

**C1. Briefing section `biz`.** Title `사업`, inserted **after** `goals` and before `areas`, built through the existing `add()` so `CAP` 5 applies. Items, in order: severity 3 for each unpaid billed month, at most 3; severity 2 for a `won` contract ending within `DEAL_END_SOON` months; severity 2 for a `quote` older than `QUOTE_STALE_DAYS` days; and always a final severity-1 line. Every item carries `action: { type: "biz" }`. **No absence branch** — the summary line always renders, so the section is never empty. Exact strings:
```
{client} {title} — {YYYY-MM} 입금 미확인 {won}            (severity 3)
{client} {title} — {YYYY-MM} 종료 · 남은 계약 {won}        (severity 2)
{client} {title} — 견적 {n}일 경과 · {won}                 (severity 2)
이번 달 계약 매출 {won} · 입금 확인 {won} · 남은 계약 {won}  (severity 1)
```
`buildBriefing`'s returned `counts` gains `bizMonth` (`bizSummary.thisMonth`) and `bizUnpaid` (`bizSummary.unpaid.length`).

**C2. `closeBriefing` tab whitelist must grow**, or every business line is a dead click: replace the `goals || growth || schedule` chain (L5401) with a module-level `TAB_ACTIONS = ["goals", "growth", "schedule", "biz"]` declared in the Daily assistant region beside `CAP`, and the branch `if (TAB_ACTIONS.includes(next.type)) { setTab(next.type); return; }`.

**C3. Home.** One clickable `font-mono` line **inside the existing briefing card**, directly under the schedule line, with a comment beside it recording that this is the same call the schedule line made (date facts belong beside the other today numbers; a fifth card would push `오늘의 초점` below the fold). Copy: `이번 달 계약 {won} · 입금 미확인 {n}건 ›`, with the `입금 미확인` fragment rose when the count is above zero. New prop `onGoBiz`, wired from the root as `onGoBiz={() => setTab("biz")}`.

**C4. Packet.** `## 사업 (계약·매출)` between the schedule section and `## 최근 일지 (7일)`, at most `PACKET_BIZ_LINES = 6` lines, built **before** the journal-trim loop so `PACKET_MAX` and the trim behaviour are unchanged. Line order: the summary line `- 이번 달 계약 {won} · 입금 확인 {won} · 남은 계약 {won} · 견적 대기 {won}`, then `- 미수 {YYYY-MM} {client} {title} {won}` per unpaid month, then `- {진행 중|예정} {client} {title} · {startMonth} ~ {endMonth} · 월 {won}`, truncated at the cap. Amend `PACKET_HEAD` rule 3 **in place**, so the numbering and the JSON block do not shift, to: `"3) 제안은 목표에 연결된 하루분량 실행만 가능해요 (난이도 E/D/C). 자격·시험 실행과 계약·단가·포트폴리오는 제안하지 않아요.",`. `parseAssistantReply` is **not** touched — it reads `tasks` and nothing else, so a pasted reply can never create a deal, a rate or a portfolio entry ([Rule 7](../../design-docs/core-beliefs.md#rule-7) amendment holds).

**C5. State-write guard.** One added sibling line in the persist effect (L5085-5088), after the existing call and without modifying it: `if (!persisted(KEY)) showToast({ msg: "저장에 실패했어요 — 저장 공간이 가득 찼어요. 백업을 내보낸 뒤 사진을 지워요." });`. Do **not** add an `await`: `store.set` has no `await` in its body, so its `localStorage` write has already happened when the next line runs.

**C6. E2E, 130 → 134 steps** — four steps appended to `flow8.js`:
14. `the briefing states 사업 after 목표 페이스` — the section exists, sits between `목표 페이스` and `영역·활동`, and carries the unpaid line at severity 3.
15. `the business briefing line opens the tab` — tapping it closes the briefing and lands on the `사업` tab.
16. `the home card line states the month and the unpaid count and opens the tab`.
17. `the packet carries the business section and a pasted reply creates nothing` — `## 사업 (계약·매출)` sits between `## 다가오는 일정 (14일)` and `## 최근 일지 (7일)`; then paste a reply whose JSON names a deal title and business fields, import it, and assert `deals` / `rates` / `folio` are unchanged in length and content.

**C7. Allowlist back to empty.** Every Phase A entry is now referenced; delete the file's entries and the mirrored tracker rows.

**Acceptance C (observable).** The briefing shows `사업` after `목표 페이스`, every line of it navigates to the tab, the home briefing card carries the business line with a rose unpaid count, the packet carries `## 사업 (계약·매출)` in the right place and its rule 3 mentions that contracts, rates and portfolio entries are never proposed, a pasted reply creates no business record, and a state write that cannot reach `localStorage` surfaces the storage toast. `npm run verify`: 134 steps, 0 failed, 0 console errors; `npm run finish` exit 0 with an empty allowlist; `npm run docs:gen && npm run docs:check` exit 0.

### Verbatim Korean copy (every string is an E2E selector — use these exactly)
```
tab · header            사업 / 사업 / 계약 추가 · 단가 추가 · 포트폴리오 추가
header lines            이번 달 계약 {won} · 입금 확인 {won}
                        남은 계약 {won} · 견적 대기 {won} · 입금 미확인 {n}건
view chips              계약 · 단가 · 포트폴리오
deal groups             진행 중 · 예정 · 견적 대기 · 문의 · 종료 · 무산
deal status chips       문의 · 견적 · 계약 · 무산
deal row lines          {시작월} ~ {종료월} · {n}개월 · 월 {won}  /  기간 미정
                        총 {won} · 마진 {won} ({n}%)  /  원가 미입력 — 마진은 계산하지 않아요
payment row             입금 확인  ·  {YYYY-MM} chips  ·  외 {n}개월 더 있어요
revenue roll-up         최근 6개월
rate row · footer       청구 {won} · 원가 {won} · 마진 {won} ({n}%)  /  단가 {n}건 · 원가 입력 {m}건
rate unit chips         월 · 일 · 건
folio card · footer     대표 이미지 없음  /  포트폴리오 {n}건 · 대표 이미지 {m}장 · 저장 공간 {x}MB 사용 중 (약 5MB 한도)
empty states            등록한 계약이 없어요 — 문의·견적부터 기록해요.
                        등록한 단가가 없어요 — 청구가와 원가를 넣으면 마진이 계산돼요.
                        등록한 포트폴리오가 없어요 — 링크와 대표 이미지 1장을 넣어요.
modal titles            새 계약 · 계약 수정 · 새 단가 · 단가 수정 · 새 포트폴리오 · 포트폴리오 수정
modal buttons           등록 · 저장 · 삭제
deal placeholders       고객사 — 예: ○○테크 · 일감 이름 — 예: 사내 문서 검색 AI 구축 · 시작 월 · 개월 수
                        월 청구액 (원) · 월 원가 (원, 선택) · 메모 (선택)
rate placeholders       단가 이름 — 예: 웹 앱 개발 (월) · 청구가 (원) · 원가 (원, 선택) · 메모 (선택)
folio placeholders      제목 — 예: 사내 문서 검색 AI · 한 줄 설명 (선택) · 역할 (선택) — 예: 기획·개발 단독
                        기술 (선택, 쉼표로 구분) — 예: React, FastAPI, pgvector · 링크 주소 — https://…
                        📎 대표 이미지 1장 (선택) · JPG·PNG · 가로세로 비율 그대로 저장돼요
link label chips        GitHub · Notion · Figma · 배포 · 기타
deal errors             고객사를 입력해 주세요. · 일감 이름을 입력해 주세요.
                        계약 상태에서는 시작 월과 개월 수가 필요해요.
                        개월 수는 1 이상 120 이하로 입력해 주세요.
                        월 청구액은 0 이상 숫자로 입력해 주세요. · 월 원가는 0 이상 숫자로 입력해 주세요.
rate errors             단가 이름을 입력해 주세요. · 청구가는 0 이상 숫자로 입력해 주세요. · 원가는 0 이상 숫자로 입력해 주세요.
folio errors            제목을 입력해 주세요. · 링크는 http:// 또는 https:// 로 시작해야 해요. · 링크는 4개까지 등록돼요.
                        이미지가 너무 커요 — 8MB 이하 파일만 등록돼요. (선택한 파일 {n}MB)
                        이미지를 읽지 못했어요. · 이미지를 줄이지 못했어요 — 더 작은 이미지를 골라 주세요.
toasts                  포트폴리오를 등록했어요 · 포트폴리오를 수정했어요 · 포트폴리오를 삭제했어요
                        단가를 등록했어요 · 단가를 수정했어요 · 단가를 삭제했어요
                        계약을 등록했어요 · 계약을 수정했어요 · 계약을 삭제했어요
                        {YYYY-MM} 입금 확인으로 표시했어요 · {YYYY-MM} 입금 확인을 취소했어요
                        대표 이미지를 저장하지 못했어요 — 저장 공간이 가득 찼어요. 포트폴리오 이미지를 지우고 다시 시도해요.
                        저장 공간이 부족해요 — 현재 {x}MB 사용 중이라 이미지를 추가하지 않았어요. 기존 이미지를 지운 뒤 다시 시도해요.
                        저장에 실패했어요 — 저장 공간이 가득 찼어요. 백업을 내보낸 뒤 사진을 지워요.
confirms                {title} 포트폴리오를 삭제해요. 등록한 대표 이미지도 함께 사라져요. 계속할까요?
                        {client} {title} 계약 기록을 삭제해요. 입금 확인 표시 {n}건도 함께 사라져요. 계속할까요?
briefing section 사업    {client} {title} — {YYYY-MM} 입금 미확인 {won}          (sev 3)
                        {client} {title} — {YYYY-MM} 종료 · 남은 계약 {won}      (sev 2)
                        {client} {title} — 견적 {n}일 경과 · {won}               (sev 2)
                        이번 달 계약 매출 {won} · 입금 확인 {won} · 남은 계약 {won} (sev 1)
home card line          이번 달 계약 {won} · 입금 미확인 {n}건 ›
packet section          ## 사업 (계약·매출)
                        - 이번 달 계약 {won} · 입금 확인 {won} · 남은 계약 {won} · 견적 대기 {won}
                        - 미수 {YYYY-MM} {client} {title} {won}
                        - {진행 중|예정} {client} {title} · {startMonth} ~ {endMonth} · 월 {won}
packet head rule 3      3) 제안은 목표에 연결된 하루분량 실행만 가능해요 (난이도 E/D/C). 자격·시험 실행과 계약·단가·포트폴리오는 제안하지 않아요.
```

## Steps
1. **Phase A — schema and engine, no UI.** A1 `@schema` v20 + the `if (s.v < 20)` block + `freshState`; A2 the Business region (constants and the eleven pure helpers); A3 the shared image loader plus `resizeImageFit`; A4 the storage guards and their four constants; A5 `demoState`; A6 the five version-assertion sites and the new `v19 save → v20 business` fixture step (116 → 117); A7 the allowlist and its tracker mirror. **Gate.**
2. **Phase B — the tab.** B1 `setBizView` and the defensive default; B2 `BizTab` header; B3-B5 the three views; B6 the three modals (`modal.type` 15 → 18); B7 the generic `addBiz` / `updateBiz` / `removeBiz` trio, `toggleDealPaid`, the toasts, the confirms and the image-key registration in `removeBiz` / `resetAll` / `exportBackup`; B8 the sixth `NAV` entry, `grid-cols-6` and the `<main>` branch; B9 `tools/e2e/flow8.js` hooked between the `flow7.js` and `flow4.js` lines of `flow.js`, plus the nav-order and demo-sweep rewrites (117 → 130). **Gate.**
3. **Phase C — assistant surfaces and docs.** C1 the `biz` briefing section and the two new counts; C2 `TAB_ACTIONS`; C3 the home line and `onGoBiz`; C4 the packet section, `PACKET_BIZ_LINES` and the in-place `PACKET_HEAD` rule 3 amendment; C5 the state-write guard; C6 the four `flow8.js` steps (130 → 134); C7 the emptied allowlist; then every doc below. **Gate**, then re-run `npm run build:demo` and `node tools/harness/gen-screenshots.js`.

**E2E step accounting.** 116 today; A `+1` (the v19 → v20 fixture); B `+13` (`flow8.js`); C `+4` (`flow8.js` tail) = **134**. Rewritten in place and not counted: the five version assertions, the `flow.js` nav-order step and its demo sweep loop.

## Verification
- Each phase gate: `npm run verify` (build, preview, full E2E, 0 failed steps, 0 console errors) and `npm run finish` exit 0. Expected step counts 117 / 130 / 134.
- Phase C also: `npm run docs:gen && npm run docs:check` exit 0 (`-- --final` is not required).
- **`--smoke` is explicitly not needed**: no data table row, no payout formula, no grade cut and no weighting matrix is touched, so `tools/harness/smoke-logic.js` has nothing new to check. Running it is optional reassurance only.
- Manual check at **390 × 844** (Chrome device emulation, one-off probe, not an E2E step): the six-tab bar does not wrap and no label is clipped; both header summary lines break between tokens, never mid-word; a landscape portfolio diagram is readable at full card width.
- After Phase C: `npm run build:demo` then `node tools/harness/gen-screenshots.js` — the nav bar appears in all four manifest screenshots, so every one of them is stale until it is re-captured. `SHOTS` in `gen-screenshots.js` needs no change.

## Cleanup checklist
- [ ] `npm run finish` exit 0 at every gate (dead code, duplicates, residue, language)
- [ ] Watch two duplicate risks `finish-check` is likely to raise: the three modals' form scaffolding (extract a shared input/number-parse helper rather than copying blocks — never by changing UI copy) and the row markup shared by the deal, rate and folio cards
- [ ] `lang-check` clean: Korean UI copy named in a comment sits in backticks
- [ ] No unused `lucide-react` import; `Briefcase` is imported once and used once
- [ ] Allowlist additions carry a reason naming this plan and the removing phase, are mirrored in `docs/exec-plans/tech-debt-tracker.md`, and are back to empty after Phase C

## Docs to sync
`docs/design-docs/information-architecture.md` (five tabs and fifteen modals → six and eighteen, screen map), `docs/product-specs/index.md` (six tabs, the new spec row — `check-docs` fails if the index does not list the new file), `docs/product-specs/schedule.md` (its `fifth entry of NAV (grid-cols-5)` line), **new `docs/product-specs/business.md`** shaped like `schedule.md`, `docs/product-specs/home.md`, `docs/product-specs/daily-briefing.md`, `docs/design-docs/assistant-bridge.md`, `docs/design-docs/state-lifecycle.md`, `docs/design-docs/demo-data.md`, `docs/design-docs/decision-log.md` (a dated row linking this plan), `docs/exec-plans/tech-debt-tracker.md`, `ARCHITECTURE.md` (file regions, tab list, status line: schema v20, E2E 134 steps), `docs/DESIGN.md`, `docs/RELIABILITY.md` (step count, `flow8.js`, the migration list), `tools/e2e/README.md` (`116-step scenario` → `134-step`, a `flow8.js` row), `README.md` (its `87-step` line is stale at 116 and must read 134), `docs/generated/*` via `npm run docs:gen`.
`docs/design-docs/core-beliefs.md` needs **no change**: no rule is amended — business records are simply not tasks, exactly as events are not.
Tech-debt rows to add: **TD-10 rewritten, not resolved** (`resizeImageFit` now exists and is proven by `flow8.js`, but the two evidence call sites still use the 256 × 320 cover crop — that is [Rule 16](../../design-docs/core-beliefs.md#rule-16) behaviour and belongs in its own plan); a row for the remaining storage exposure (the `STORAGE_BUDGET` heuristic is a guess, the quota is per-origin and shared with the state blob, and `persisted` reports a browser with `localStorage` blocked as a failed write on every state change); a row recording that `deals[].months` is the **billing** period and the work period is not stored; a row for the un-cached folio thumbnail reads (every entry into the `포트폴리오` view re-reads every image key); a row recording the deliberate absence of a deal → rate and deal → folio link (a deal snapshots its numbers on purpose).

## Proposed commit
`feat(biz): schema v20 business records, engine helpers, image and storage guards` · `feat(biz): 사업 tab with contracts, rates and portfolio, six-tab nav` · `feat(biz): business in the briefing, home card and assistant packet`
