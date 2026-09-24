# The daily gate — `오늘의 관문`

Added 2026-09-24 (schema stays v28, no migration — `act.gate?` is an optional block of user-action stamps; [decision log](../design-docs/decision-log.md)). From the first run of every day, weekends included, the app shows one full-screen layer, `오늘의 관문 — {today}`, in place of every tab and every sheet, until the user has (1) read both `오늘 읽을 것` and `이슈 목록` to their very end, (2) passed a locally graded, multiple-choice quiz built from that same content, and (3) refreshed today's work (at least one `work[]` item created today). `통과` then closes the gate and restores the app; closing and reopening the app the same day lands in the app, the next day in the gate again. **There is no close, no skip and no settings access while the gate is open** — the user's own decision, stated on the gate itself and restated below.

Everything the gate stores is a stamp of a user action (a time, a score); every step line and the `통과` button's enabled state are derived at render ([Rule 9](../design-docs/core-beliefs.md#rule-9)). The gate pays nothing, promotes nothing, completes no task and moves no grade, streak, KR or goal — it is a precondition on the app's use, not a mechanic ([Rule 7](../design-docs/core-beliefs.md#rule-7) amendment, 2026-09-24).

## The gate layer — `gateActiveOf(state, today)`

`gateActiveOf(state, today) = !!state?.profile && !gateEntryOf(state, today).passedAt`, where `gateEntryOf(state, today) = state?.act?.gate?.[today] || {}`. A profile-less state (onboarding) never shows the gate; a restored backup or a save re-dated to a day with no `passedAt` opens it at once; a day change while the gate stands re-evaluates by itself, since `today` is derived from the clock, not stored.

The root derives `gateActive` once, right after its state hooks, from `state` and `today` — never from a ref: `const gateActive = phase === "main" && !!state && gateActiveOf(state, today);`. While it holds, `<main>` and `<nav>` are not rendered at all — replaced by `GateModal` — so no tab handler and no route inside the app can fire; this is the primary defence, not a visual overlay on top of a live app.

**The gate is a layer, not a `modal.type`.** The app's one modal slot still exists — the gate's own five flows (the reader, the issue list, the quiz, the work bridge, the work-add sheet) render *in* that slot, above the gate. Every other `setModal` call, from anywhere in the app, is dropped by one derived line rather than by touching each of the ~80 call sites:
```js
const modal = gateActive && modalRaw && !GATE_MODAL_TYPES.includes(modalRaw.type) ? null : modalRaw;
```
`GATE_MODAL_TYPES = ["reader", "issues", "quiz", "workBridge", "work"]`. Every existing `modal?.type === …` check in the render tree keeps its name and now reads this filtered value. `passGate` clears the raw slot (`setModal(null)`) so nothing stale surfaces the instant `<main>`/`<nav>` return. `modal.type` count: 40 → **41** (`quiz` is the one new value this feature adds).

## The three steps — `gateStepsOf(state, today)`

Pure, derived at render:
```
{ read: { reader: stamp | null, issues: stamp | null, done }, quiz: { total, score, passed, attempts, at } | null,
  quizDone, refresh: { count, done }, ready }
```
`read.done = !!(reader && issues)`; `quizDone = !!quiz?.passed`; `refresh.count` is `(state.work || []).filter((w) => w.createdAt === today).length` (the same rule `checkSummaryOf`'s `notRefreshed` reason already used — now the one definition, `gateRefreshedOf`); `refresh.done = count > 0`; `ready = read.done && quizDone && refresh.done`. `통과` is `disabled` unless `ready`.

## `GateModal({ state, today, held, onOpenReader, onOpenIssues, onQuiz, onRetry, onBridge, onAddWork, onPass })`

A `div.fixed.inset-0.z-40.bg-zinc-950.overflow-y-auto` — the same layer `Modal` uses, painted beneath the modal slot so a gate flow renders over it. **No X, no icon-only button, no `onClick` on the backdrop, no key handler** — the background and `Escape` are both inert. Content, top to bottom:

- `오늘의 관문 — {today}`; caption `세 단계를 마쳐야 앱이 열려요. 닫기와 건너뛰기는 없어요.`; a second caption stating the lockout as a fact on screen: `퀴즈는 외부 AI 채팅의 답변을 붙여넣어야 해요. AI를 쓸 수 없는 날은 통과할 수 없어요.`
- **Step 1 — 읽기**: `1 읽기 — 오늘 읽을 것 {완료 HH:MM | 미완료} · 이슈 목록 {완료 HH:MM | 미완료}`; two always-enabled buttons, `오늘 읽을 것 열기 ›` and `이슈 목록 열기 ›`, opening the two screens above the gate in read mode (below).
- **Step 2 — 퀴즈**: `2 퀴즈 — {통과 {score}/{total} · 시도 {attempts} | 미통과 {score}/{total} · 시도 {attempts} | 아직}`. With no quiz yet: one button, `퀴즈 요청문 만들기 ›` (enabled once `read.done`). After a fail (`quiz && !quiz.passed`): two buttons, `같은 문제 다시 풀기` (enabled when `read.done && held` — the parsed items are still in memory) and `새 퀴즈 요청 ›` (enabled once `read.done`); while `held` is `null` (the app was reloaded since the fail), a caption states the fact: `앱을 다시 열면 문제가 지워져요 — 새 퀴즈를 요청해요.` After a pass: no button, nothing left to do here.
- **Step 3 — 업무 갱신**: `3 업무 갱신 — {오늘 만든 업무 {n}건 | 없음}`; two buttons, `AI로 만들기 ›` and `업무 추가 ›`, both enabled once `quizDone` — the gate reaches the same work bridge and the same add sheet the `업무` tab uses, unchanged (below).
- `통과` — full-width, cyan, disabled unless `ready`.

Every disabled button carries the `disabled` attribute and `opacity-40` — **never hidden** — so the order of the three steps is always visible, whichever step the user is on ([Rule 13](../design-docs/core-beliefs.md#rule-13)).

## Reading to the end — `useReadEnd(enabled)` and gate-read mode

`useReadEnd(enabled)` returns `[endRef, seen]`. When `enabled`, it observes a sentinel element (`endRef.current`) with an `IntersectionObserver` (`root: null, threshold: 0`) and sets `seen` the moment the sentinel enters the viewport — content that already fits on screen at mount fires immediately, so `다 읽었어요` enables at once rather than requiring an empty scroll. Without `IntersectionObserver`, it falls back to a `scroll` listener on the sentinel's closest `.overflow-y-auto` ancestor, checking `scrollTop + clientHeight >= scrollHeight - 4` once at mount and on every scroll. Not enabled (outside the gate): nothing is observed, `seen` stays `false`, and no DOM cost is added.

Both `DailyReaderModal` and `IssueListModal` gain a `gateRead` prop (default `false`) and an `onRead` prop. **Inside the gate, `gateRead` replaces every route on both screens at once — it does not disable them one by one:**

- **`오늘 읽을 것` (the reader)**: no section `›` buttons, no `이슈 목록 ›`, no `브리핑 ›`, no `닫기`. After the last section, a sentinel `<div data-read-end="reader">`, then a caption `끝까지 내려야 눌러져요` while `!seen`, then the one footer button `다 읽었어요` (`disabled={!seen}`) → `onRead`.
- **`이슈 목록` (the issue list)**: every row's tap is a no-op (`onOpen` becomes `() => {}`), and the training section's `{n}건 더 ›` button becomes plain text `{n}건 더` — the list is content to read here, not a route; `이전 {n}건 ›`/`접기` still toggles, since expanding a project's earlier minutes is reading, not navigation. The same sentinel-plus-caption-plus-`다 읽었어요` footer replaces `닫기`.
- The header X and the backdrop of either sheet return to the gate **without a stamp** (`setModal(null)`, never `closeBriefing`) — leaving early records nothing.
- `다 읽었어요` on the reader stamps `act.gate[today].readReaderAt` **and** `act.briefingSeen` (the one daily "seen" marker `checkSummaryOf`, `readerSince` and the boot/day-change auto-open guard already agree on — no second field for the same fact); on the issue list it stamps `readIssuesAt` only.
- **Outside the gate, both screens render byte-identically to before this feature** — `gateRead` defaults to `false`, and every branch above is additive.

**The reader's 2026-09-17 refusal of a per-item tick still stands**: `다 읽었어요` is one stamp per screen per day, never a mark against an individual section, decision or row. The reader outside the gate is unchanged in every other respect.

## The quiz — the sixth bridge packet, local grading

**Step 2's flow** (`QuizModal`, `modal.type: "quiz"`): `send` → `paste` → `solve` → `result`.

- **`send`** (`오늘의 퀴즈 — 요청문`): the packet from `buildQuizPacket(state, today)` in a read-only textarea, `복사` and `AI 답변 붙여넣기 ›` — shared `PacketSendPane`/`copyPacket` with the other five bridge screens. Caption: `아래 글을 복사해 Claude·ChatGPT 채팅에 붙여넣고, 답변을 받아 다시 붙여넣어요. 앱은 네트워크를 쓰지 않아요. 오늘 읽을 것과 이슈 목록에 실린 내용이 실려요 — 녹취록·이름·연락처는 실리지 않아요.`, plus, only while the day-job-in-AI-packets switch is off, ` 직장 트랙 기록은 실리지 않아요.`
- **`paste`** (`AI 답변 붙여넣기`): a textarea and `답변 확인`, which runs `parseQuizReply`. A refused reply shows the refusal text under the pane in rose and stays on this view; an accepted one holds the items (`onHold({ items })`, the root's `quizHeld`) and moves to `solve`.
- **`solve`** (`오늘의 퀴즈 — {total}문제`): a line `기준 {need}개 이상 정답`; every question at once, each a radio group of its four choices; a footer `{answered}/{total} 답함` and `제출`, `disabled` until every question is answered — no per-question feedback before submit.
- **`result`** (`퀴즈 결과`): a headline `{score}/{total} · {통과 | 미통과} (기준 {need}개)`; for each wrong item, its question, `내 답: {picked}`, `정답: {correct}` and, when present, `근거: {basis}`; on a fail, one more line, `읽기 완료 표시가 지워졌어요 — 두 화면을 다시 끝까지 읽어야 해요.`; one button, `관문으로 ›`. `onResult` (root `recordQuiz`) fires exactly once, at submit, before this view renders — nothing here is graded twice. No colour, no icon and no praise word marks a pass beyond the numbers themselves ([Rule 13](../design-docs/core-beliefs.md#rule-13)).

`retry` (`같은 문제 다시 풀기`) opens straight at `solve` with `shuffleQuiz(held.items)` — a fresh Fisher–Yates order of each item's four choices, the correct answer remapped to its new index, so the same questions do not simply repeat their original layout. The header X and the backdrop always return to the gate through `onClose` (`setModal(null)`); leaving at any point before submit stamps nothing.

### The packet — `buildQuizPacket(state, today)`

Built from exactly the content the reader and the issue list state that day — never more: today's and tomorrow's meeting preparation, the open work items, the two-week schedule, the last seven days' decisions, the minutes (since-mode when `act.workRefreshedAt` exists, else the newest), the newest training records as content, and the documents. A meeting flagged `aiHidden` contributes its date and title only, in every section. **Never** a `## 이력` line, a profile field of any kind, a transcript, an event's `place`/`note`, or a document's `source`. Capped at 12,000 characters, trimmed in the same order the work packet uses for its shared reductions plus this packet's own steps. Full section list, parser rules, caps and measured sizes: [assistant-bridge.md](../design-docs/assistant-bridge.md#the-sixth-packet--오늘의-관문-퀴즈).

### The reply and local grading

`parseQuizReply(text)` reads only the reply's `quiz` key (`tasks`, `work`, `checks`, `verdict` or anything else is ignored, like every earlier parser ignores every other one's key). An item is kept whole or dropped, never repaired: a non-empty question, exactly four distinct non-empty choices, an integer answer index 0–3, an optional basis. The first 10 valid items are kept in reply order; fewer than 5 valid refuses the whole reply with the exact text `퀴즈 문제가 5개 미만이에요 — 답변을 다시 받아요`.

Grading never leaves the device: `gradeQuiz(items, answers)` marks an unanswered item wrong and needs `quizNeed(total) = Math.ceil(0.8 × total)` correct to pass — the user's own decision, 7 questions → 6 correct, 5 → 4, 6 → 5, 8 → 7, 10 → 8. `recordQuiz` (root) stamps the attempt (`e.quiz = { total, score, passed, attempts: attempts + 1, at: hhmm() }`) and, **on a fail, deletes both read stamps** (`readReaderAt`, `readIssuesAt`) — the user's own decision that a failed attempt means re-reading both screens before another try, and the retry offer reflects it (`같은 문제 다시 풀기`/`새 퀴즈 요청 ›` stay enabled only once both reads are stamped again). A pass touches neither read stamp.

**The parsed quiz never reaches the save.** `quizHeld` lives only in the root's own component state — needed because the reader, the issue list and the quiz share the app's one modal slot, so a re-read after a fail unmounts `QuizModal` and `같은 문제 다시 풀기` must survive that unmount without a second network round trip. It is cleared on `passGate`, on a day change, and by a new paste; **a reload of the app loses it**, which is why the gate states the fact on screen (above) rather than silently disabling the button.

## Stamps — `act.gate[date]`

```
act.gate?: { [date]: { readReaderAt?, readIssuesAt?, quiz?: { total, score, passed, attempts, at }, passedAt? } }
```
`HH:MM` local times (`hhmm()`, a two-line utility beside `dstr`); `quiz` a locally graded score, never a percentage. Every gate write (`writeGate`) prunes entries older than `GATE_KEEP_DAYS` (60) before today — the app's **own** stamps, by the user's own decision; never a user record, so this prune is not subject to the "never delete a record silently" concern that guards `tasks`/`goals`/etc. Schema stays v28; no `if (s.v < N)` block, no `v` bump — `gate?` is optional and absent on every save that predates it and on `freshState`.

`통과` (`passGate`) writes only when `gateStepsOf(state, today).ready` holds: stamps `passedAt`, empties the raw modal slot, clears `quizHeld`, and toasts `오늘의 관문 통과 · 퀴즈 {score}/{total}` — the one line stated after a pass, a fact and nothing more.

## The settings line

`SettingsModal` gains a section, `오늘의 관문`, between `확인 알림` and `데이터 — 백업 · 초기화`: `gateMonthLine(state, today)`, computed by `gateMonthOf` over this month's `act.gate` entries — `passed` = entries carrying `passedAt`, `failed` = entries without one, `quiz` = the average score and the average total (each rounded to one decimal) over entries that carry a `quiz`, or nothing when none do. Text: `이번 달 관문 통과 {n}일 · 미통과 {m}일 · 퀴즈 평균 {s}/{t}` or, with no quiz entries this month, `… · 퀴즈 없음`. Caption: `관문은 매일 첫 실행에 열려요. 끄는 설정은 없어요.` A day with no `act.gate` entry at all counts nowhere in the average.

**Settings, and therefore backup export/import, sit behind the gate.** `settings` is not in `GATE_MODAL_TYPES`, so `SettingsModal` cannot open while `gateActive` — a user who has not yet passed today's gate cannot reach `백업 내보내기`/`백업 불러오기`/`데이터 초기화` either. This is a direct consequence of the no-escape decision (below), not a separate feature.

## Boot-param routing

The boot effect's reader auto-open and the day-change effect both gain a `!gateActiveOf(...)` guard, so neither opens `오늘 읽을 것` over a standing gate — the gate itself is the first screen a day without a passed stamp shows. The `?open=issues|reader` boot param and the service worker's `postMessage({ open })` are **unchanged**: they still call `setModal({ type })`, and because both `"issues"` and `"reader"` are in `GATE_MODAL_TYPES`, that call opens the named screen **in gate-read mode, above the gate** — the boot param "routes into the read step" with no new routing code, purely because the derived `modal` filter (above) already lets those two types through. `history.replaceState` still strips the query the same way it always has.

## What the gate never does

- No reward of any kind: no XP, level, badge, streak of its own, sound or praise — the numbers on the result view are the whole of the feedback ([Rule 7](../design-docs/core-beliefs.md#rule-7) amendment, [Rule 13](../design-docs/core-beliefs.md#rule-13)).
- Completes no task, promotes no area, submits no evidence, and moves no grade, streak, KR or goal. A work item created inside the gate goes through the same `addWork`/`importWork` path the `업무` tab uses, unchanged.
- Stores nothing but stamps: every step line, every button's enabled state and the settings month line are computed at render from `act.gate`, `state.work` and `act.briefingSeen` — never cached separately ([Rule 9](../design-docs/core-beliefs.md#rule-9)).
- Never edits `migrate`, bumps `v`, or touches a `liferpg-*` key — `act.gate?` is one optional field inside the existing state object.

### The no-escape lockout risk, stated plainly

**There is no way out of the gate except passing it.** No close button, no skip, no settings access, and no key closes it. The user chose this explicitly (decision 2, 2026-09-24) and the consequences are recorded, not softened: a day with no access to an external AI chat (Claude, ChatGPT, or similar) **cannot be passed**, because the quiz step requires a pasted reply from one; a bug in `buildQuizPacket`/`parseQuizReply`, or a model that never returns five valid questions, locks the user out of the entire app — including the backup export that would otherwise let them recover — until either the day passes (tomorrow's gate starts over) or a new deploy lands. See [RELIABILITY.md](../RELIABILITY.md#known-limits) for the full statement and the recovery paths (a new deploy, or a hand edit of `localStorage`), and [tech-debt-tracker.md](../exec-plans/tech-debt-tracker.md) for the tracked rows.

## Demo content

`demoState` opens with today's gate already passed, so the demo and its screenshots show the app, not the gate: `s.act.gate = { {yesterday}: { readReaderAt: "08:31", readIssuesAt: "08:37", quiz: { total: 7, score: 5, passed: false, attempts: 1, at: "08:52" } }, {today}: { readReaderAt: "08:12", readIssuesAt: "08:19", quiz: { total: 7, score: 6, passed: true, attempts: 1, at: "08:33" }, passedAt: "08:40" } }`. Yesterday's failed quiz and today's passed one, sharing a month, make the settings line read `이번 달 관문 통과 1일 · 미통과 1일 · 퀴즈 평균 5.5/7`. See [demo-data.md](../design-docs/demo-data.md).

## E2E coverage (written, not run — standing user instruction)

`tools/e2e/flow12.js` (11 steps, run after `flow11.js` and before `flow4.js`, which replaces the save) covers: the gate opening alone on a save without today's stamp (no `nav`, no `main`, no icon-only button, an inert background and `Escape`, the three step lines, the later-step buttons `disabled`); the reader in gate-read mode (no route, `다 읽었어요` disabled on an overflowing sheet until the sentinel is scrolled into view, then stamping `readReaderAt` and `briefingSeen`); the issue list in gate-read mode (a row tap opening nothing, no `건 더 ›` button, stamping `readIssuesAt`); the quiz packet's content and privacy (a sentinel planted on a transcript, a hidden meeting, an event's place/note, a document's source — none reach the packet text); a four-item reply refused with its `work` key ignored; a seven-item reply failing 5/7 with both read stamps cleared and the numbers stated; the same-questions retry after a re-read passing 6/7 with a reshuffled but set-identical choice list; `업무 추가 ›` completing step 3 and `통과` closing the gate, stamping `passedAt` and restoring the tab bar; a same-day reload landing in the app while a save re-dated to yesterday reopens the gate; `?open=issues` routing into the gate's read step with the query stripped and the settings sheet stating the month's facts computed from the save; onboarding showing no gate. `run.js` gained `plantGate()` (writes a **synthetic** `passedAt: "00:00"`, never a time the app itself wrote), `passGate()` (plant, then reload) and `reload(opts, { keepGate })`; `closeModal` cannot close the gate (no X, an inert backdrop) and must not be called while it stands. `tools/harness/smoke-logic.js` section 9 (50 checks) covers `quizNeed`, `gradeQuiz`, `shuffleQuiz`, `parseQuizReply`'s validation and caps, `gateActiveOf`, `gateStepsOf`, `gateMonthOf`/`gateMonthLine` including the rounding and the no-quiz wording. See [tools/e2e/README.md](../../tools/e2e/README.md) for the full step-by-step account and the exact `await step(` totals.
