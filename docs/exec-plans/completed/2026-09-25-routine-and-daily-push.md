# Auto-open — a Samsung routine guide with the day's first-open stamp (A), and a contentless daily Web Push from the repository's own cron (B)

- Status: completed
- Date: 2026-09-25
- Needs approval: no — the design was approved by the user today (`C:\Users\조준형\.claude\plans\flickering-knitting-snowglobe.md`, "Design (decided)"); no `CERTS`/`EXAMS`/matrix row, no `migrate` block, no `v` bump, no `liferpg-*` key, no deletion of a user record (the only removal is the app's own `act.opened` stamps older than 60 days, by the user's decision, the same treatment `act.gate` already gets). The one thing that crosses a line the docs drew — a push server — is the user's own reversal of the 2026-09-14/2026-09-22 records and lands as a dated Rule 7 amendment (Phase 3).
- Agents: planner → implementer (Phases 1–2; the main agent generates the VAPID pair before Phase 2) → cleanup → verifier → docs-syncer (Phase 3) → main agent (one push, live-bundle check, Korean report)

Three phases, three commits, **one push**. **Phase 1** — Bundle A (the first-open stamp, the `자동 실행` settings section, the gate line, the demo entries), the worker's `showCheck` + `push` handler, the two E2E fixes, smoke. **Phase 2** — Bundle B (the app's push side and the `푸시 알림` settings section, `tools/push`, `notify.yml`, smoke 7(f), three E2E steps, the real desktop proof). **Phase 3** — docs, the Rule 7 amendment, the decision-log reversal, the plan's move to `completed/`.

Standing constraints, restated so no phase re-decides them: messages to the user in Korean, every artifact in English; **`npm run verify` is never run** (E2E steps are written and `node --check`ed only — say so in every report); commit only at a phase gate; verify each deploy on the live bundle; no schema bump and no migrate block (`act.opened?` and `settings.pushNotify?` are optional fields absent in every existing save, in `freshState` and — for `pushNotify` — in `demoState`).

## Goal
The user asked whether the app can open itself at fixed times. A web app cannot launch itself on Android, so the user chose two things. **A** — an in-app guide, in `설정`, for a Samsung `모드 및 루틴` routine that opens the app at fixed times, with the day's first-open time recorded as proof (`act.opened[date] = "HH:MM"`, shown in settings as `오늘 첫 실행 08:03 · 이번 달 실행 12일` and under the daily gate's title). **B** — a daily Web Push at 08:00 and 20:00 Asia/Seoul sent by a GitHub Actions cron in the app's own repository, so a notification reaches the phone even on a day the app was never opened; tapping it opens the app on the `이슈 목록` screen exactly as the local `확인 필요` notification's tap does. The push carries **no content**: the service worker never reads the payload and shows the `확인 필요` text the page last mirrored into the `life-check` cache (or the generic pair). The only thing that ever leaves the device is the push subscription — an opaque endpoint and two keys — which the **user copies once, by hand,** from the settings sheet into a repository secret. Every string is a time, a count, a step or a fact ([rule 13](../../design-docs/core-beliefs.md#rule-13)); nothing here pays, grades, streaks or praises ([rule 7](../../design-docs/core-beliefs.md#rule-7)).

## User decisions (final, 2026-09-25 — from the approved design)
1. **The first-open stamp** lives in its own map, `act.opened[date] = "HH:MM"`, never under `act.gate` (`gateMonthOf` counts every gate entry as a day, so a stamp there would inflate `미통과`). Pruned to the newest 60 days. Written by **one root effect** on `[phase, state, today]` when absent — covering boot, a day change while open, onboarding's finish, the demo entry and a backup import.
2. **`자동 실행`** is a settings section between `AI 요청문` and `확인 알림`: the stamp line, the five routine steps as an `<ol>`, and two fact captions — the app cannot open itself, and the stamp cannot tell a routine open from a manual one. `GateModal` shows `오늘 첫 실행 HH:MM` under its title.
3. **The worker** lifts the periodicsync body into `showCheck(renotify)`; `periodicsync` → `showCheck(false)`; a new `push` handler → `showCheck(true)`; the payload is never read.
4. **The push is contentless and the switch is honest**: `settings.pushNotify` is written `true` only after `pushManager.subscribe` resolved; off unsubscribes first. The subscription is component state only — never in `state`, never in the backup file.
5. **`푸시 알림`** is a settings section after `확인 알림`: the checkbox, two capability lines, two rose notices, a status line with the endpoint's last 12 characters, a read-only textarea behind `구독 정보 보기 ›`, `복사`, the four GitHub-secret steps, and the fact caption.
6. **The repository sends it**: `tools/push/send.mjs` (`web-push` only, subject `https://github.com/Jojunehyung/JARVIS`, payload `{ "open": "issues" }`, `TTL` 6 h, `urgency: "high"`, `topic: "life-check"`; missing secrets → log and exit 0; 404/410 → exit 2 `subscription expired — copy it again from the app`; never prints the subscription, the endpoint or a response body — the repository and its Actions logs are public) and `.github/workflows/notify.yml` (`0 23 * * *` and `0 11 * * *` UTC, `workflow_dispatch`, `permissions: contents: read`, `concurrency: group: push`, Node 20).
7. **Keys**: the VAPID pair is generated once in the scratchpad by the main agent (`npx --package web-push web-push generate-vapid-keys --json`, output redirected to a file, never printed). **The public key is pasted into both sources** (`PUSH_VAPID_PUBLIC` in `src/LifeManager.jsx` and in `tools/push/send.mjs`); **the private key never enters the repository, a commit, a doc, a log or the conversation transcript** — the user pastes it into the secret `VAPID_PRIVATE_KEY` through the GitHub web UI (`gh` is not installed on this PC) and then deletes the scratchpad file.
8. **Two E2E defects are fixed in passing**: `tools/e2e/flow6.js`'s `restore` helper is declared inside one step and used by two others (a `ReferenceError` in their `finally`, unseen because the suite is not run); `tools/e2e/flow4.js:298–299` asserts an exact `act` key set that `plantGate` already breaks (`gate`) and the stamp would break again (`opened`).

## Context read
AGENTS.md §3/§4/§6/§7; `docs/PLANS.md`; core-beliefs [rule 7](../../design-docs/core-beliefs.md#rule-7) with its six amendments (the last dated 2026-09-24; the count of `### Rule` headings is 19 and stays 19 — the new amendment is a paragraph), [rule 9](../../design-docs/core-beliefs.md#rule-9) (`act.opened` is a stamp of a user action, `settings.pushNotify` a setting; the month count, the status line and the capability lines are derived at render; the subscription is browser state the app reads back, never stores), [rule 13](../../design-docs/core-beliefs.md#rule-13) (every new string below is a time, a count, a step, a status or a fact — no `%`, no praise, no nag); ARCHITECTURE.md (Files, Daily assistant, Modals, App root rows, the current-status paragraph — E2E **280** `await step(` as written; `tools/harness/gen-sw.js` in the Files table); `docs/FRONTEND.md` (clone pattern, `queueMicrotask`, StrictMode's double effect run — "keep what is scheduled idempotent", the `Modal` and checkbox-row conventions, Tailwind v3 core only); `docs/product-specs/notifications.md` (the `확인 필요` notification, its cache mirror, `OPEN_PARAM_TYPES`, "What the notification never does"), `home.md` (`SettingsModal` section order and the `확인 알림` checkbox/caption pattern), `install-and-backup.md` (the worker's handlers, "Deploying", the WebAPK note), `daily-gate.md` (the gate layer; `GateModal` has `state`/`today` props); `docs/SECURITY.md` ("Data in transit: still none" — to be rewritten), `docs/RELIABILITY.md` ("Known limits"), `docs/PRODUCT_SENSE.md` (the non-goal "The app still sends none of its own — there is no push server" — to be rewritten), `docs/design-docs/decision-log.md` (rows 2026-09-14 and 2026-09-22: "no push server" — reversed here), `docs/design-docs/state-lifecycle.md` ("2026-09-24 additions" paragraph shape), `demo-data.md` (`act.gate` bullet), `tools/e2e/README.md` (the count paragraphs and the `flow6.js` row); the completed plans `2026-09-24-daily-gate-quiz.md` and `2026-09-22-check-notification-incremental-packet-issue-list.md` (shape, prompt style, planner decisions, progress notes, throwaway and mutation checks).

Code — every line number below was **verified against HEAD `3b6b067`** on 2026-09-25 (the design's numbers hold; the two small deviations are noted):
- `src/LifeManager.jsx` (13,179 lines): `dstr` 1321, `hhmm` 1326, `shiftDay` 1327, `monthStr` 1328; `SectionLabel` 1908; `workInAiOf` 2253, `checkNotifyOf` 2255; the `CHECK_*` constants 3123–3130; the gate block 3132–3179 with `gateMonthOf` 3168 and `gateMonthLine` 3176–3179 — **the new helpers go directly after 3179**; `checkSummaryOf` 3181; the `@schema` JSDoc `act` block 4708–4719 (`gate?` at 4715) and `settings` block 4733–4737 (`checkNotify?` at 4736); `demoState` 4945, its `s.act = …` line 5159 and `s.act.gate = {…}` 5162–5165; `GateModal` 6325 (the `<h3>` `오늘의 관문 — {today}` at 6333, the first caption at 6334); `copyPacket` 6687–6696 (two success toasts `복사했어요 — AI 채팅에 붙여넣어요`, the failure toast `자동 복사 불가 — 글을 길게 눌러 복사해요`); `SettingsModal` 7843–7944 (`hasApi` 7849, `caps` state 7850, `denied` 7851, the `caps` effect 7852–7863, `toggleCheck` 7864–7867, the `AI 요청문` section 7898–7909, the `확인 알림` section 7911–7923, the `오늘의 관문` section 7925–7929, `데이터` 7930); the browser-side helpers above the root 11505–11558 (`checkRegistration` 11508, `checkSyncRegister` 11524, `checkNotifyTeardown` 11530, `checkRefresh` 11539–11558) — **the push helpers go after 11558**; `LifeManager` 11560; the boot effect 11583–11605; the day-change effect 11617–11623; the `quizHeld` day-change effect 11625 — **the first-open effect goes after it**; the worker `message` effect 11628–11634; the debounced `checkRefresh` effect 11638–11642; `setWorkInAi` 12605–12608; `setCheckNotify` 12611–12625 (`Notification.requestPermission()` inside a `try` at 12620–12621 — the part `askNotificationPermission` extracts); the `GateModal` render 12901; the `settings` slot 13165–13170.
- `tools/harness/gen-sw.js`: the header comment 1–11; the `CHECK_*` literals 21–26; `notificationclick` 82–91; the `periodicsync` handler **93–105** (the body 98–103 is what `showCheck` lifts); `module.exports = { swPlugin, swSource }` 124.
- `tools/harness/smoke-logic.js` (673 lines): `lift` 95 (column-0 declarations only); section 7 396–468 — `(e)` at **457–466** (the design said ~459–466), `console.log(`check summary: …`)` 467; section 9 553–670; the summary lines 672–673 — **section 10 goes before line 672**. Section 7's `new Function` lift list (400–402) is where `PUSH_VAPID_PUBLIC` is added in Phase 2.
- `tools/e2e/flow6.js` (299 lines): the takeover step 53–97 declares `restore` at **64–68** and an inner `until` at 69–73 inside its callback; the file-level helpers start at 102 (`KEY`), `readState` 103, **`writeState` 104**, `dstrIn` 105, `changedKeys` 111, `origin` 113, `checkEntry` 114, `checkBox` 118, the outer `until` 126; `restore(saved)` is called at **176** and **198** — outside its scope; the `?open=` step 202–230 with the served-`sw.js` string list at **222**; the offline step 232. **Fix**: move the four-line `restore` (with its comment at 63) to directly after `writeState` at 104; leave the inner `until`.
- `tools/e2e/flow4.js`: `migrateFixture` 17–26 writes the fixture then calls `h.reload()`, which runs `plantGate()` first — so the migrated `act` already carries `gate`; the v18 → v19 step's exact key-set assertion at **298–299** (`"briefingSeen,lastActive,lastReview,shieldMonth,shieldsLeft,streak"`) is therefore already false and will gain `opened` too. **Fix**: filter `gate` and `opened` out of the key list. Every other `act` assertion in the suite reads named fields (`flow4.js` 297/300/301/330/331/386) or diffs `act` within one step with no reload between its two reads (`flow11.js` 217, 1658) — unaffected, since the stamp lands at boot before any step's first read.
- `tools/e2e/run.js`: `closeModal` 173–189, `plantGate` 345–356, `reload(opts, { keepModal, keepGate })` 361–365, `passGate` 367, the `h` object 435 (`overlayText`, `openSettings`, `metrics` present).
- `.github/workflows/deploy.yml` (the shape `notify.yml` follows: `actions/checkout@v4`, `actions/setup-node@v4` with `node-version: 20`); root `package.json` (`"type": "module"`, scripts `finish`/`smoke`/`lang:check`/`docs:gen`/`docs:check`); `.gitignore` (eight lines, `tools/e2e/node_modules/` the precedent); `public/manifest.webmanifest` (`display: standalone`, `start_url: "./"`, `scope: "./"`).
- Harness facts that decide where the new files are checked: `tools/harness/lib/source.js` `listSourceFiles` walks `src`, `tools/e2e`, `tools/harness` for `.js`/`.jsx` only and skips `node_modules`/`out` — so `tools/push/send.mjs`, `tools/push/node_modules/` and `notify.yml` are **outside** `npm run finish` and `npm run lang:check`; smoke 7(f) pins them, and the implementer keeps their comments English by hand. `tools/harness/check-docs.js` walks `docs/` and the root `.md` files, skipping dot-directories, and fails on Hangul outside backticks or fences in any file under `docs/exec-plans/`.
- Reuse: `hhmm`, `dstr`, `shiftDay`, `SectionLabel`, the `확인 알림` checkbox-row pattern, `checkRegistration`, `checkNotifyTeardown` (the unsubscribe slot pattern), `copyPacket`, flow6's `checkBox`/`checkEntry`/`until`/`changedKeys`/`origin`, run.js's `plantGate`/`reload`/`openSettings`/`overlayText`.

**Rules touched:** 7 (a push server, reversing two recorded decisions — the amendment text is in Phase 3, dated 2026-09-25; the push is contentless, the app itself still makes no network call, the subscription is copied by hand; the first-open stamp and the routine guide are a record and a guide, not a mechanic — no streak, score or reward attached), 9 (two optional fields, a stamp and a setting; the month count, the status line, the capability lines and the notification text are derived; the subscription lives in the browser's push manager and in component state only), 13 (facts only: times, counts, steps, statuses; the cron-lateness caption states a limit rather than promising a schedule). **Not touched:** 12 (no `v` bump, no `migrate` block, no key — both fields optional and absent in every existing save and in `freshState`), 1/10/11/18/19 (nothing completes, pays, promotes or creates a task), 16 (no image key), 8 (no measure), 4/5/6/15 (no data row).

## Planner decisions (recorded here so the implementer does not re-decide)
1. **`stampOpened(s, today, at)` returns the same object when today is stamped** — that is what makes the root effect idempotent under StrictMode's double run and stops the effect from re-firing on its own write (`setState` with an identical reference is a no-op). The prune runs only on a write, so a day on which the app is not opened prunes nothing — the same as `writeGate`.
2. **The first-open effect gates on `phase === "main" && !!state`**, never on `readyRef` — onboarding has no state and must stamp nothing; the demo entry, a backup import and `resetAll` all pass through `phase`/`state`, so one effect covers every path. A save whose `act.opened[today]` already exists (the demo's, a reload's) is left untouched — the demo therefore shows its own seeded time, not the E2E's.
3. **The gate line renders only once the stamp exists** (`{opened && <p>…</p>}`) — the effect fires after the gate's first paint and the line appears on the re-render; no placeholder text, no `기록 중`.
4. **`openedLine` states both wordings** because the settings sheet is unreachable before the stamp only in theory (the effect runs at boot), but smoke exercises the pure helper on an unstamped save; `오늘 아직 열지 않음` is the honest reading of a save with no stamp.
5. **`askNotificationPermission()` is extracted from `setCheckNotify` and shared** — `setPushNotify` must not duplicate the `try`/`requestPermission` lines (a `finish` duplicate window), and the two switches must read a refusal identically.
6. **`setPushNotify` never touches `checkNotify`, and writes `pushNotify: true` only after `subscribe` resolved with a subscription** (mutations 4 and 5). A rejected `subscribe` returns `"failed"` and writes nothing; a refused permission returns `"denied"` and writes nothing. Off: `pushUnsubscribe()` first, then `pushNotify: false` — a save that says off with a live subscription would still receive pushes.
7. **The subscription is read from `pushManager.getSubscription()` every time the sheet needs it** (mount, after a toggle) and held in `pushSub` component state; it is never written to `state`, so the backup file and the raw `localStorage` string never contain an endpoint (asserted in E2E and throwaway).
8. **`copyPacket` gains a fourth parameter `msg` with the current success text as its default** — every existing caller is unchanged and byte-identical in behaviour; the push section passes `복사했어요 — 저장소 비밀에 붙여넣어요`.
9. **`caps` grows two flags, `push` and `standalone`**, read in the same mount effect as `api`/`periodic`: `push = !!reg && "pushManager" in reg && typeof PushManager !== "undefined"`; `standalone = matchMedia("(display-mode: standalone)").matches || navigator.standalone === true` (guarded). A tab is not an installed app; the caption says what a tap will do in that case.
10. **The worker's `push` handler always shows a notification** (`showCheck` shows the cached text or the generic pair), because the subscription is `userVisibleOnly: true` and Chrome otherwise shows its own "updated in the background" text. `renotify: true` on the push (the phone was woken on purpose), `false` on the periodic sync (unchanged behaviour — the key was simply absent before).
11. **`send.mjs` catches everything and exits with a code** — `web-push`'s `WebPushError` carries `endpoint`, `body` and `headers`, so an uncaught rejection would print the endpoint into a public log. The four `console.log` lines are the only output and each is a fixed string or a template interpolating a status code only; smoke 7(f) enforces this with a regex, since `finish`/`lang-check` do not scan `.mjs`.
12. **The push E2E stubs `pushManager` and delivers a push through CDP** — headless Chrome has no push service and does not surface shown notifications reliably (RELIABILITY, 2026-09-22), so the E2E asserts what the app controls: the `subscribe` options and key bytes, the write order, the settings copy, the raw save, the cache entry, no navigation and no request on delivery. The **real** path is proven once, on desktop, in Phase 2's throwaway (f), and on the phone by the user's manual `Daily push` run after the secrets are set.
13. **`tools/push` is its own npm package** (`web-push` only, a committed lockfile, `node_modules` git-ignored) so the app's root `package.json` stays free of a server-side dependency and `npm ci --prefix tools/push` is the whole install in CI.
14. **Cron minutes stay at `0`** as decided; the Phase 3 RELIABILITY note states that on-the-hour slots are GitHub's busiest and a run may start minutes to over an hour late — an offset minute is a one-line follow-up if it bothers the user, not a decision to make here.

## Prompt
You are the implementer for Life Manager (`src/LifeManager.jsx`, one file; Vite + React 18 + Tailwind v3 core utilities; English identifiers and comments; Korean only in UI copy, `해요체`, facts only — [rule 13](../../design-docs/core-beliefs.md#rule-13)). Read this plan whole before editing. Do not change UI copy outside what this plan spells out, do not touch `store` call sites, `migrate`, `liferpg-*` keys or any data table. Every existing packet (daily, work, since-mode work, review, prep, role, quiz), the reader, the briefing, the issue list and the `확인 필요` summary/text must keep their current output byte-for-byte — none of them reads `act.opened` or `settings.pushNotify`. E2E steps are **written and `node --check`ed, not executed** (standing user instruction) — say so in your report. `npm run verify` is never run. Work phase by phase; append a dated progress note under `### Progress` after each phase with the gates run and their results, measurements, deviations and plan errors. Commit at the end of each phase only when the main agent says the gate is approved. **Never write, print, echo or commit a VAPID private key**; Phase 2's P0 is the main agent's, not yours — you receive the public key only.

### Phase 1 — Bundle A, the worker, the E2E fixes, smoke

**A1. Pure helpers** — directly after `gateMonthLine` (line 3179), a new banner block of plain column-0 declarations (smoke lifts them; `hhmm` and `shiftDay` are their only dependencies):
```js
/* ── The first-open stamp (2026-09-25) — `act.opened[date] = "HH:MM"`: the day's first open, written once by the root
   effect on every path that brings the app up (boot, a day change while open, onboarding's finish, the demo entry, a
   backup import). Its own map, never under `act.gate` — `gateMonthOf` counts every gate entry as a day. A stamp of a
   user action, never progress (rule 9); pruned like the gate's stamps (user decision). The settings sheet's `자동 실행`
   section states it beside the routine steps; the app cannot open itself, a phone routine can. ── */
const OPENED_KEEP_DAYS = 60; // stamps older than this are dropped on the next stamp write — the app's own stamps, never a record
const openedOf = (state, today) => state?.act?.opened?.[today] || null;
// Days this month with a first-open stamp — `act.opened` only, never `act.gate`.
const openedMonthOf = (state, today) => Object.keys(state?.act?.opened || {}).filter((d) => d.startsWith(today.slice(0, 7))).length;
const openedLine = (state, today) => {
  const at = openedOf(state, today);
  return `${at ? `오늘 첫 실행 ${at}` : "오늘 아직 열지 않음"} · 이번 달 실행 ${openedMonthOf(state, today)}일`;
};
// Returns the same object when today is already stamped (the root effect's idempotence under StrictMode's double run);
// otherwise a shallow copy with today's stamp and every key older than OPENED_KEEP_DAYS before today dropped. `at` is
// injectable so smoke can pin the time.
const stampOpened = (s, today, at = hhmm()) => {
  if (s?.act?.opened?.[today]) return s;
  const floor = shiftDay(today, -OPENED_KEEP_DAYS);
  const opened = Object.fromEntries(Object.entries(s?.act?.opened || {}).filter(([d]) => d >= floor));
  opened[today] = at;
  return { ...s, act: { ...(s?.act || {}), opened } };
};
```

**A2. Schema.** In the `@schema` JSDoc `act` block, after the `gate?` lines (4715–4719), add (comment lines wrapped the way the neighbours are):
```
 *          opened?: { [date]: "HH:MM" } },                    // (2026-09-25, still v28, no migrate block) the day's first-open time,
 *                                                              // stamped once by the root effect on every path that brings the app up;
 *                                                              // its own map, never under `gate` (`gateMonthOf` counts entries as days);
 *                                                              // newest `OPENED_KEEP_DAYS` days; a user-action stamp, never progress (rule 9)
```
(the closing `},` of the `act` line moves from the `gate?` line to this one). No change to `freshState`.

**A3. The root effect** — directly after the `quizHeld` day-change effect (line 11625):
```js
  // The first-open stamp (2026-09-25): once per day, on whatever brought the app up — boot, a day change while open,
  // onboarding's finish, the demo entry, a backup import. `stampOpened` returns `prev` when today is stamped, so
  // StrictMode's double run and the re-render this write causes stamp once and stop; a save that already carries
  // today's stamp (the demo's, a reload's) is left as it is.
  useEffect(() => {
    if (phase !== "main" || !state || openedOf(state, today)) return;
    setState((prev) => stampOpened(prev, today));
  }, [phase, state, today]);
```

**A4. The gate line.** In `GateModal`, directly under the `<h3>` at 6333: `const opened = openedOf(state, today);` at the top of the component and `{opened && <p className="font-mono text-xs text-zinc-400">오늘 첫 실행 {opened}</p>}` between the `<h3>` and the first caption. Nothing else in the gate changes.

**A5. Demo.** In `demoState`, directly after the `s.act.gate = {…};` block (5165): `s.act.opened = { [shiftDay(today, -1)]: "08:01", [today]: "08:04" };` with the comment `// The first-open stamp (2026-09-25): yesterday and today, before each day's gate reads — the settings line reads both days when they share a month.` The demo enters with today's stamp already present, so the effect leaves it (planner decision 2).

**A6. Settings — `자동 실행`.** `SettingsModal`: a new section **between `AI 요청문` and `확인 알림`** (after line 7909):
- `SectionLabel tone="text-cyan-400"` `자동 실행`.
- A `font-mono text-xs text-zinc-300` line: `{openedLine(state, today)}`.
- An `<ol className="text-xs text-zinc-400 mt-1.5 space-y-1 list-decimal list-inside">` with exactly five `<li>` (each text exact):
  1. `설정 › 모드 및 루틴 › 루틴 › + 를 눌러요`
  2. `조건: 시간 — 08:00, 매일 (두 번째 루틴은 20:00)`
  3. `실행: 앱 열기 — 인생 관리를 골라요`
  4. `저장하고 루틴을 켜요`
  5. `배터리 › 백그라운드 사용 제한 › 절전 예외 앱에 인생 관리를 더해요`
- Two captions, `text-xs text-zinc-500 mt-1.5`: `앱은 스스로 열리지 않아요 — 정해진 시각에 여는 것은 폰의 루틴이에요.` and `첫 실행 시각은 앱이 열릴 때 기록돼요. 루틴이 연 것인지 직접 연 것인지는 구분하지 못해요.`
No checkbox, no state write; `today` is already a prop.

**A7. The worker — `tools/harness/gen-sw.js`.** Replace lines 93–105 (the `periodicsync` comment and handler) with:
```js
// The check notification's text: what the app last rendered into the cache, or a generic pair when it is missing or
// older than CHECK_STALE_MS. One routine for both wake-ups — the periodic sync (Chrome's own moment, no re-alert) and
// the daily push (2026-09-25; a wake-up on purpose, so it re-alerts). The same tag replaces the shown notification.
const showCheck = async (renotify) => {
  let entry = null;
  try { const r = await (await caches.open(CHECK_CACHE)).match(CHECK_REQ); entry = r ? await r.json() : null; } catch {}
  const fresh = entry && Date.now() - (entry.ts || 0) < CHECK_STALE_MS;
  const title = fresh ? entry.title : "인생 관리 — 오늘 읽을 것을 확인해요";
  const body = fresh ? entry.body : "앱을 열면 목록이 갱신돼요";
  await self.registration.showNotification(title, { body, tag: CHECK_TAG, renotify, data: { open: "issues" }, icon: CHECK_ICON });
};

// Chrome's periodic sync (installed app only; Chrome picks the moment).
self.addEventListener("periodicsync", (e) => {
  if (e.tag !== CHECK_TAG) return;
  e.waitUntil(showCheck(false));
});

// The daily push (2026-09-25): sent by the repository's cron (.github/workflows/notify.yml) with no content the worker
// reads — the payload is ignored on purpose; the text is what the app last cached. Nothing is fetched, nothing reloads.
self.addEventListener("push", (e) => {
  e.waitUntil(showCheck(true));
});
```
Update the header comment (lines 7–10) to name the push handler and the shared `showCheck`. Constraints smoke pins: constants only (the `"life-check"` literal appears **exactly twice**, `CHECK_CACHE` and `CHECK_TAG`, as today); the new required strings `addEventListener("push"`, `const showCheck`, `showCheck(true)`, `showCheck(false)`; the push block (from `addEventListener("push"` to its closing `});`) contains none of `e.data`, `fetch(`, `.json(`; no `location.reload`/`controllerchange`/`.navigate(` anywhere (unchanged). The lifted `showCheck` is what keeps `npm run finish` free of a duplicate window between the two handlers.

**A8. E2E (written, `node --check`ed, not run).**
- `tools/e2e/flow6.js` **fix**: move the `restore` helper (63–68, comment included) to directly after `writeState` (104), so the two check steps' `finally` blocks (176, 198) can reach it; leave the takeover step's inner `until` where it is. Add a one-line comment naming why (`used by the check steps' finally; it must live at file level — 2026-09-25`).
- `tools/e2e/flow4.js` **fix** (298–299): `const actKeys = Object.keys(st.act || {}).filter((k) => k !== "gate" && k !== "opened").sort().join(",");` with a comment: the harness's `plantGate` writes `gate` before every reload and the app stamps `opened` at boot (2026-09-24/25); both are stamps, not migration output. Re-read the v10 and no-`v` fixture steps (123–180): the v11 block rebuilds `act`, so the stamp is re-written at boot — assert nothing about `opened` there.
- `tools/e2e/flow6.js` **two new steps**, placed after the `a denied permission …` step and before the `?open=` step (they need the worker controlling the page and reload through `h.reload`):
  1. `the first open of a day stamps act.opened[today] once as HH:MM, prunes keys older than 60 days, keeps a same-day stamp on reload, and the settings sheet states the line and the five routine steps` — `saved = readState()`; plant `planted.act = { ...planted.act, opened: { [await dstrIn(-61)]: "07:00", [await dstrIn(-60)]: "07:00" } }` (today's key deleted); `writeState(planted)`; `h.reload()`; `after = readState()`: `after.act.opened[today]` matches `/^\d\d:\d\d$/`, the `-61` key is absent, the `-60` key is `"07:00"`, `changedKeys(planted, after)` equals `["act"]`, and every other `act` key equals `planted.act`'s (`JSON.stringify` of `act` minus `opened`). Then set `after.act.opened[today] = "00:01"`, `writeState(after)`, `h.reload()` → the stamp still reads `"00:01"` (no overwrite). `h.openSettings()`; the overlay text contains `자동 실행`, then `오늘 첫 실행 00:01 · 이번 달 실행 {n}일` where `n` is computed from the save's `opened` keys of this month; the section's `ol` has exactly five `li` whose texts are the five A6 strings in order; both captions present; the section label order in the sheet is `AI 요청문` → `자동 실행` → `확인 알림` (assert by `indexOf`). `closeModal`; `finally` → `restore(saved)`.
  2. `the gate states today's first-open time under its title, from the stamp the same load wrote` — plant `delete planted.act.gate?.[today]; delete planted.act.opened?.[today];` `writeState`; `h.reload({}, { keepModal: true, keepGate: true })`; the first `.fixed.inset-0`'s text starts with `오늘의 관문 — {today}` and its second line matches `/^오늘 첫 실행 \d\d:\d\d$/`; `readState().act.opened[today]` equals the shown time; `finally` → `writeState(saved); await h.reload();`.
- `tools/e2e/flow6.js` `?open=` step: extend the served-`sw.js` string list at 222 with `'addEventListener("push"'`, `"const showCheck"`, `"showCheck(true)"`.
- `tools/e2e/README.md`: the status paragraph (a 2026-09-25 paragraph in the file's style: the two fixes, the two steps, the extended string list), the `flow6.js` row, the count **280 → 282** (`flow6.js` 9 → 11), recounted with `grep -o "await step(" tools/e2e/flow*.js | wc -l`.

**A9. Smoke — `tools/harness/smoke-logic.js`.**
- Section 7(e) (457–466): add `check(sw.includes('addEventListener("push"') && sw.includes("const showCheck") && sw.includes("showCheck(true)") && sw.includes("showCheck(false)"), "the push handler and the periodic sync share showCheck; the push re-alerts");` and `const pushBlock = sw.slice(sw.indexOf('addEventListener("push"'), sw.indexOf("});", sw.indexOf('addEventListener("push"'))); check(!/e\.data|fetch\(|\.json\(/.test(pushBlock), "the push handler reads no payload and makes no request");` — the existing "exactly two `"life-check"` literals" check stays and must still pass.
- New **section 10** before the summary lines (672): `// 10) the first-open stamp (2026-09-25) — …`, lifting `dstr`, `hhmm`, `shiftDay`, `OPENED_KEEP_DAYS`, `openedOf`, `openedMonthOf`, `openedLine`, `stampOpened`; `today = "2026-09-25"`. Cases: (a) on a save with `act: { briefingSeen: "2026-09-24", gate: { "2026-09-25": { passedAt: "08:40" } } }` and no `opened`, `stampOpened(s, today, "08:05")` returns a new object whose `act.opened` is `{ "2026-09-25": "08:05" }`, whose `act.gate` is the same reference as the input's and whose `briefingSeen` is kept, and leaves the input without an `opened` key (no mutation); (b) idempotent: `stampOpened(stamped, today, "09:00") === stamped` (same reference) and the value stays `"08:05"`; (c) prune: keys at `shiftDay(today, -61)` and `"2026-01-01"` are dropped, keys at `shiftDay(today, -60)`, `-1` and today kept; (d) `openedMonthOf` counts this month's `opened` keys only — with `opened` `{ "2026-09-01", "2026-09-25", "2026-08-31" }` → 2, and with three `act.gate` entries this month and one `opened` key → 1; (e) `openedLine`: `오늘 첫 실행 08:05 · 이번 달 실행 2일`, an unstamped today with one earlier key this month → `오늘 아직 열지 않음 · 이번 달 실행 1일`, an empty `act` → `오늘 아직 열지 않음 · 이번 달 실행 0일`; (f) `OPENED_KEEP_DAYS === 60`. Print `first-open stamp: n checks`.

**Phase 1 gates:** `npm run build` · `npm run finish` exit 0 (no allowlist entry) · `npm run lang:check` · `npm run smoke` (10 sections; 7(e) extended, section 10 new) · `node --check tools/e2e/flow4.js tools/e2e/flow6.js tools/harness/gen-sw.js tools/harness/smoke-logic.js` · `npm run docs:gen && npm run docs:check` (`db-schema.md` picks up `opened?`). Baselines: every packet, the reader, the briefing, the issue list and the check summary/text byte-identical to HEAD `3b6b067` over the usual states (the demo, the demo with `workInAi: false`, the flow11-shaped heavy save, a fresh-shaped save), each with and without `act.opened` planted. Every edited file LF. Commit at the gate.

### Phase 2 — the VAPID pair, the app's push side, `tools/push`, `notify.yml`, smoke 7(f), three E2E steps, the desktop proof

**P0 (main agent, before the implementer starts).** In the scratchpad: `npx --package web-push web-push generate-vapid-keys --json > <scratchpad>/vapid.json` (output redirected — never printed), then print **only** the public key with `node -e "console.log(JSON.parse(require('fs').readFileSync(process.argv[1], 'utf8')).publicKey)" <scratchpad>/vapid.json`. Hand that one string to the implementer as `PUSH_VAPID_PUBLIC`. **The public key is pasted into both sources** (`src/LifeManager.jsx` and `tools/push/send.mjs`, P1 and P5). **The private key never enters the repository, a commit, a doc, a log or the transcript**: the user pastes it into the repository secret `VAPID_PRIVATE_KEY` through the GitHub web UI (`gh` is not installed on this PC) and deletes `vapid.json` afterwards. Throwaway (f) below reads the file from disk inside a scratchpad runner and never echoes it.

**P1. Constants and helpers.**
- `const PUSH_VAPID_PUBLIC = "<the public key>";` beside the `CHECK_*` constants (after 3130) with the comment `// The daily push (2026-09-25): the app's VAPID public key — the same string tools/push/send.mjs signs with (smoke 7(f) pins them equal); the private key lives only in the repository secret VAPID_PRIVATE_KEY`.
- `const pushNotifyOf = (state) => state?.settings?.pushNotify === true;` beside `checkNotifyOf` (2255) with the comment `// Whether the daily push is on (2026-09-25): absent reads as off — no migrate block; true is written only after a subscription exists.`
- Browser-side helpers, module level, after `checkRefresh` (11558), every call guarded and none throwing:
```js
/* The daily push's browser side (2026-09-25). The subscription is browser state (`pushManager`), read back when the
   settings sheet needs it and never written to the save; the app makes no request of its own — the browser's push
   service does, on subscribe. `askNotificationPermission` is shared with the `확인 필요` switch. */
const askNotificationPermission = async () => {
  try { return (await Notification.requestPermission()) === "granted"; } catch { return false; }
};
// base64url → bytes, the shape `applicationServerKey` takes (a 65-byte uncompressed P-256 point).
const pushKeyBytes = (key) => {
  const pad = "=".repeat((4 - (key.length % 4)) % 4);
  const raw = atob((key + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
};
const pushSubscriptionGet = async () => {
  const reg = await checkRegistration();
  try { return (await reg?.pushManager?.getSubscription?.()) || null; } catch { return null; }
};
// Subscribes with the app's own key; null when the browser refuses (a tab that is not an installed app may).
const pushSubscribe = async () => {
  const reg = await checkRegistration();
  if (!reg?.pushManager?.subscribe) return null;
  try { return await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: pushKeyBytes(PUSH_VAPID_PUBLIC) }); } catch { return null; }
};
const pushUnsubscribe = async () => {
  const sub = await pushSubscriptionGet();
  try { await sub?.unsubscribe?.(); } catch { /* already gone */ }
};
// The last 12 characters of the endpoint — enough to compare with the secret by eye, never the whole address on screen.
const pushEndpointTail = (sub) => `…${String(sub?.endpoint || "").slice(-12)}`;
```
- `setCheckNotify` (12611): replace lines 12619–12622 (`let res = "denied"; try {…} catch {…} if (res !== "granted") return "denied";`) with `if (!(await askNotificationPermission())) return "denied";` — behaviour unchanged, the duplicate avoided.
- Root `setPushNotify(on)` beside `setCheckNotify`, returning `""` | `"denied"` | `"failed"`:
```js
  // The daily push switch (2026-09-25): on asks the notification permission, subscribes with the app's key and writes
  // `settings.pushNotify: true` only once the subscription exists — a refusal or a failed subscribe writes nothing and
  // returns what the sheet states; off unsubscribes first, then writes false. `checkNotify` is never touched.
  const setPushNotify = async (on) => {
    const write = (v) => setState((prev) => { const s = structuredClone(prev); s.settings = { ...(s.settings || {}), pushNotify: v }; return s; });
    if (!on) {
      await pushUnsubscribe();
      write(false);
      showToast({ msg: "매일 푸시 알림 꺼짐" });
      return "";
    }
    if (!(await askNotificationPermission())) return "denied";
    const sub = await pushSubscribe();
    if (!sub) return "failed";
    write(true);
    showToast({ msg: "매일 푸시 알림 켜짐" });
    return "";
  };
```
- `copyPacket(taRef, text, onToast, msg = "복사했어요 — AI 채팅에 붙여넣어요")` — both success branches call `onToast(msg)`; the failure toast unchanged; every existing caller unchanged.
- Schema, in the `settings` block after `checkNotify?` (4736–4737):
```
 *               pushNotify? },       // (2026-09-25, still v28, no migrate block) the daily Web Push switch; absent reads as off
 *                                    // (`pushNotifyOf`); written true only after `pushManager.subscribe` resolved. The subscription
 *                                    // itself is browser state — never in the save, never in the backup file
```
(the closing `},` moves from the `checkNotify?` line).

**P2. Settings — `푸시 알림`.** `SettingsModal` gains props `onSetPushNotify` and `onToast`; the root passes `onSetPushNotify={setPushNotify} onToast={showToast}` (13166–13169). Component state: `caps` becomes `{ api: hasApi, periodic: false, push: false, standalone: false }`; the mount effect (7852–7863) also computes `push = !!reg && "pushManager" in reg && typeof PushManager !== "undefined"` and `standalone` (guarded `matchMedia("(display-mode: standalone)").matches || navigator.standalone === true`), sets them with the others, and when `push` also `setPushSub(await pushSubscriptionGet())`. New state `const [pushSub, setPushSub] = useState(null)`, `const [pushErr, setPushErr] = useState("")`, `const [showSub, setShowSub] = useState(false)`, and a `subRef = useRef(null)` for the textarea. `const togglePush = async (e) => { const res = await onSetPushNotify(e.target.checked); setPushErr(res); setPushSub(await pushSubscriptionGet()); };` A new section **after `확인 알림`** (after line 7923, before `오늘의 관문`):
- `SectionLabel tone="text-cyan-400"` `푸시 알림`.
- A checkbox row in the `확인 알림` pattern: `<input type="checkbox" checked={pushNotifyOf(state)} disabled={!caps.push} onChange={togglePush} …/>` with the label `매일 푸시 알림` (`text-zinc-200` when `caps.push`, else `text-zinc-500`).
- Capability lines (`text-xs text-zinc-500 mt-1.5`): when `!caps.push` → `이 브라우저에서는 푸시를 쓸 수 없어요`; else when `!caps.standalone` → `설치된 앱이 아니에요 — 알림을 누르면 Chrome 탭으로 열려요`.
- Rose notices (`text-xs text-rose-400 mt-1.5`): `pushErr === "denied"` → `알림 권한이 꺼져 있어요 — 폰 설정에서 허용해요`; `pushErr === "failed"` → `푸시 구독에 실패했어요 — 설치된 앱(Chrome)에서 다시 켜요`.
- While `pushNotifyOf(state)`: a `font-mono text-xs text-zinc-300 mt-1.5` status line — with `pushSub`: `구독 등록됨 · {pushEndpointTail(pushSub)}`; without: `구독 없음 — 껐다 켜면 다시 등록돼요`. With `pushSub`: a button `구독 정보 보기 ›` (`text-xs text-cyan-400`) toggling `showSub`; when shown, a read-only `<textarea ref={subRef} readOnly aria-label="푸시 구독 정보" value={JSON.stringify(pushSub.toJSON())} className="w-full h-24 bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-2 text-xs font-mono" />`, then a `복사` button (the `저장` button's classes) → `copyPacket(subRef, JSON.stringify(pushSub.toJSON()), onToast, "복사했어요 — 저장소 비밀에 붙여넣어요")`, then an `<ol className="text-xs text-zinc-400 mt-1.5 space-y-1 list-decimal list-inside">` with exactly four `<li>`:
  1. `GitHub 저장소의 Settings › Secrets and variables › Actions를 열어요`
  2. `New repository secret을 누르고 Name에 PUSH_SUBSCRIPTION을 적어요`
  3. `Secret 칸에 복사한 구독 정보를 그대로 붙여넣고 Add secret을 눌러요`
  4. `Actions › Daily push › Run workflow로 한 번 보내 봐요`
- The fact caption (`text-xs text-zinc-500 mt-1.5`, always shown): `이 기기를 떠나는 것은 구독 정보(주소와 키 두 개)뿐이고, 저장소 비밀에 직접 붙여넣을 때만 나가요. 알림에는 내용이 실리지 않아요 — 앱이 마지막으로 남긴 확인 필요 문구를 보여줘요. 매일 08:00·20:00에 보내지만 GitHub 사정으로 몇 분에서 수십 분 늦을 수 있어요. 알림을 누르면 앱이 열려요.`
Nothing here writes state but `onSetPushNotify`; the subscription never enters `state`.

**P3. `tools/push/package.json`** (new; then `npm install --prefix tools/push` once to produce `tools/push/package-lock.json`, which is committed):
```json
{
  "name": "life-manager-push",
  "private": true,
  "type": "module",
  "description": "Sends the daily contentless Web Push from GitHub Actions (.github/workflows/notify.yml). No app code lives here.",
  "dependencies": {
    "web-push": "^3.6.7"
  }
}
```
**`.gitignore`** gains one line after `tools/e2e/node_modules/`: `tools/push/node_modules/`.

**P4. `tools/push/send.mjs`** (new; the exact text, with the public key pasted in):
```js
// The daily push (2026-09-25). Run by .github/workflows/notify.yml at 08:00 and 20:00 Asia/Seoul from two repository
// secrets: PUSH_SUBSCRIPTION (the subscription JSON the user copied from 설정 › 푸시 알림) and VAPID_PRIVATE_KEY.
// PUSH_VAPID_PUBLIC below is the key the app subscribes with (src/LifeManager.jsx); smoke 7(f) pins the two equal.
// The payload is never read by the worker — it shows the text the app last cached — so nothing about the user's
// records is here. This script prints status codes only: the repository and its Actions logs are public, and
// web-push's error object carries the endpoint, so every failure is caught and turned into an exit code.
import webPush from "web-push";

const PUSH_VAPID_PUBLIC = "<the public key>";
const SUBJECT = "https://github.com/Jojunehyung/JARVIS";
const TTL_SECONDS = 6 * 3600; // a phone that is off longer than this misses the wake-up rather than getting it late

const sub = process.env.PUSH_SUBSCRIPTION;
const priv = process.env.VAPID_PRIVATE_KEY;
if (!sub || !priv) {
  console.log("daily push: secrets not set — nothing sent");
  process.exit(0);
}
let parsed = null;
try {
  parsed = JSON.parse(sub);
  if (!parsed?.endpoint || !parsed?.keys?.p256dh || !parsed?.keys?.auth) parsed = null;
} catch {
  parsed = null;
}
if (!parsed) {
  console.log("daily push: PUSH_SUBSCRIPTION is not a subscription JSON — copy it again from the app");
  process.exit(1);
}
let code = null;
try {
  webPush.setVapidDetails(SUBJECT, PUSH_VAPID_PUBLIC, priv);
  const res = await webPush.sendNotification(parsed, JSON.stringify({ open: "issues" }), { TTL: TTL_SECONDS, urgency: "high", topic: "life-check" });
  console.log(`daily push: sent (${res.statusCode})`);
  process.exit(0);
} catch (err) {
  code = err?.statusCode || null;
}
if (code === 404 || code === 410) {
  console.log("daily push: subscription expired — copy it again from the app");
  process.exit(2);
}
console.log(`daily push: failed (${code || "no status"})`);
process.exit(1);
```

**P5. `.github/workflows/notify.yml`** (new; the exact text):
```yaml
# The daily push (2026-09-25): two contentless wake-ups a day, 08:00 and 20:00 Asia/Seoul (23:00 and 11:00 UTC), sent by
# tools/push/send.mjs to the one subscription the user pasted into the repository secret PUSH_SUBSCRIPTION, signed with
# VAPID_PRIVATE_KEY. The service worker shows the text the app last cached; nothing about the records travels.
# GitHub's cron may start minutes to over an hour late, and GitHub disables a schedule after 60 days without
# repository activity — a manual run (Run workflow) re-enables it. Without the secrets the run logs and succeeds.
name: Daily push

on:
  schedule:
    - cron: "0 23 * * *"
    - cron: "0 11 * * *"
  workflow_dispatch:

permissions:
  contents: read

concurrency:
  group: push
  cancel-in-progress: false

jobs:
  send:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm ci --prefix tools/push
      - run: node tools/push/send.mjs
        env:
          PUSH_SUBSCRIPTION: ${{ secrets.PUSH_SUBSCRIPTION }}
          VAPID_PRIVATE_KEY: ${{ secrets.VAPID_PRIVATE_KEY }}
```

**P6. Smoke.**
- Section 7's lift list gains `PUSH_VAPID_PUBLIC` and `pushKeyBytes` (returned from the `new Function`). New **7(f)** after 7(e), before the `console.log`:
  - `const push = fs.readFileSync(path.join(__dirname, "..", "push", "send.mjs"), "utf8");` `const wf = fs.readFileSync(path.join(__dirname, "..", "..", ".github", "workflows", "notify.yml"), "utf8");` `const ignore = fs.readFileSync(path.join(__dirname, "..", "..", ".gitignore"), "utf8");` (require `fs`/`path` at the top if the file does not already).
  - **Public-key equality**: `const keyOf = (t) => (t.match(/PUSH_VAPID_PUBLIC = "([^"]+)"/) || [])[1]; check(keyOf(push) === CHECK.PUSH_VAPID_PUBLIC, "send.mjs signs with the app's public key");` `check(/^[A-Za-z0-9_-]{87}$/.test(CHECK.PUSH_VAPID_PUBLIC), "a base64url P-256 public key, 87 chars");` `const kb = CHECK.pushKeyBytes(CHECK.PUSH_VAPID_PUBLIC); check(kb.length === 65 && kb[0] === 4, "decodes to a 65-byte uncompressed point");` `check(Array.from(CHECK.pushKeyBytes("AQID")).join() === "1,2,3", "base64url padding is restored");`
  - **Script strings**: each of `"secrets not set"`, `"subscription expired — copy it again from the app"`, `'urgency: "high"'`, `'topic: "life-check"'`, `"TTL: TTL_SECONDS"`, `"process.exit(0)"`, `"process.exit(2)"`, `'JSON.stringify({ open: "issues" })'`, `"https://github.com/Jojunehyung/JARVIS"` is present in `push`.
  - **The no-print rule** (regex): every `console.` call in `send.mjs` is a `console.log` whose single argument is a string literal or a template interpolating only a status code — `const calls = push.match(/console\.\w+\([^\n]*\)/g) || []; const plain = /^console\.log\(("[^"]*"|`(?:[^`$]|\$\{(?:code \|\| "no status"|res\.statusCode)\})*`)\)$/; check(calls.length >= 4 && calls.every((c) => plain.test(c)), "send.mjs prints fixed strings and status codes only");` plus `check(!/\bthrow\b/.test(push) && !/console\.(dir|table|error|warn)/.test(push) && !/process\.env\.\w+\s*\)/.test(push.replace(/process\.env\.(PUSH_SUBSCRIPTION|VAPID_PRIVATE_KEY);/g, "")), "no throw, no error dump, no env echo");`.
  - **Workflow strings**: each of `'cron: "0 23 * * *"'`, `'cron: "0 11 * * *"'`, `"workflow_dispatch"`, `"contents: read"`, `"group: push"`, `"npm ci --prefix tools/push"`, `"node tools/push/send.mjs"`, `"secrets.PUSH_SUBSCRIPTION"`, `"secrets.VAPID_PRIVATE_KEY"`, `"node-version: 20"` is present in `wf`; `!wf.includes("pages: write")`.
  - `check(ignore.includes("tools/push/node_modules/"), …)`; `check(JSON.parse(fs.readFileSync(path.join(__dirname, "..", "push", "package.json"), "utf8")).dependencies && Object.keys(…dependencies).join() === "web-push", "tools/push depends on web-push only")`; `check(fs.existsSync(path.join(__dirname, "..", "push", "package-lock.json")), "the lockfile is committed")`.
- Section 10 extension: lift `PUSH_VAPID_PUBLIC`, `pushNotifyOf`, `pushEndpointTail`; check `pushNotifyOf({})`/`{ settings: { pushNotify: false } }` → `false`, `{ settings: { pushNotify: true } }` → `true`; `pushEndpointTail({ endpoint: "https://push.example/send/abcdefghijklmnop" })` → `…efghijklmnop`; `pushEndpointTail(null)` → `…`.

**P7. E2E — `tools/e2e/flow6.js`, three new steps** after the two Phase 1 steps and before the `?open=` step (written, `node --check`ed, not run). A file-level helper `installPushStub(page, { refuse = false } = {})` calls `page.evaluateOnNewDocument` with a script that, before the app loads, defines `window.PushManager = window.PushManager || function PushManager() {}` and `Object.defineProperty(ServiceWorkerRegistration.prototype, "pushManager", { configurable: true, get() { return stub; } })` where `stub` keeps `window.__pushSub` (null at first) and records every call into `window.__pushCalls`: `getSubscription()` → `Promise.resolve(window.__pushSub)`; `subscribe(opts)` → records `{ userVisibleOnly: opts.userVisibleOnly, key: Array.from(new Uint8Array(opts.applicationServerKey)) }`, then either rejects with `new Error("e2e refuse")` when `refuse`, or after 800 ms resolves with `window.__pushSub = { endpoint: "https://push.example/send/e2e-abcdef123456", toJSON() { return { endpoint: this.endpoint, expirationTime: null, keys: { p256dh: "e2e-p256dh", auth: "e2e-auth" } }; }, unsubscribe() { window.__pushCalls.push({ unsubscribe: true }); window.__pushSub = null; return Promise.resolve(true); } }`. The 800 ms delay is what lets the step assert the write order. The expected key bytes come from `tools/push/send.mjs` read from disk: `const sendKey = (fs.readFileSync(path.join(__dirname, "..", "push", "send.mjs"), "utf8").match(/PUSH_VAPID_PUBLIC = "([^"]+)"/) || [])[1]` decoded with the same base64url routine written inline in the flow.
  1. `the push switch subscribes with the app's public key, writes settings.pushNotify only after the subscription resolved, states the subscription, copies it, and never lets it into the save` — `overridePermissions(origin(), ["notifications"])`; `installPushStub(page)`; `page.evaluateOnNewDocument(() => { navigator.clipboard.writeText = (t) => { window.__copied = t; return Promise.resolve(); }; })`; `saved = readState()`; delete `settings.pushNotify` from a planted copy, `writeState`, `h.reload()`; `openSettings`; the sheet lists `확인 알림` then `푸시 알림` then `오늘의 관문` (by `indexOf`); the caption `설치된 앱이 아니에요 — 알림을 누르면 Chrome 탭으로 열려요` is present (headless is a tab) and `이 브라우저에서는 푸시를 쓸 수 없어요` is absent; a `pushBox(click)` helper like `checkBox` finds the label `매일 푸시 알림` — enabled, unchecked. `before = readState()`; `pushBox(true)`; **`sleep(400)`** → `readState().settings.pushNotify` is still absent (the write waits for `subscribe`); `sleep(900)` → `after = readState()`: `after.settings.pushNotify === true`, `changedKeys(before, after)` equals `["settings"]`, `after.settings.checkNotify === before.settings.checkNotify`, `after.settings.workInAi === before.settings.workInAi`; `window.__pushCalls[0].userVisibleOnly === true` and its `key` equals the decoded `sendKey` (65 bytes, first byte 4); the sheet states `구독 등록됨 · …abcdef123456`; click `구독 정보 보기 ›` → the `textarea[aria-label="푸시 구독 정보"]` value parses to JSON with `endpoint`, `keys.p256dh`, `keys.auth`; the `ol` after it has exactly four `li` with the four P2 strings; click `복사` → `window.__copied` equals the textarea value and the sheet's toast text contains `복사했어요 — 저장소 비밀에 붙여넣어요`; `localStorage.getItem("liferpg-state-v1")` does **not** contain `push.example` nor `e2e-p256dh`. Untick → `sleep(600)` → `pushNotify === false`, `changedKeys` `["settings"]`, `__pushCalls` ends with `{ unsubscribe: true }`, the status line is gone. `closeModal`; `finally` → `restore(saved)`.
  2. `a refused subscribe leaves the push switch off and writes nothing; a denied permission does the same and never touches checkNotify` — `installPushStub(page, { refuse: true })`, permission granted; `h.reload()`; `openSettings`; `before = readState()`; `pushBox(true)`; `sleep(600)`; `after`: no `pushNotify` key, `changedKeys` `[]`; the notice `푸시 구독에 실패했어요 — 설치된 앱(Chrome)에서 다시 켜요`; the box reads unchecked. Then `overridePermissions(origin(), [])` and `page.evaluate(() => { Notification.requestPermission = () => Promise.resolve("denied"); })`; `pushBox(true)`; `sleep(600)`; the notice `알림 권한이 꺼져 있어요 — 폰 설정에서 허용해요`; nothing written; `checkNotify` equals `before.settings.checkNotify`; `__pushCalls` has no new `subscribe` record after the denial. `closeModal`; `finally` → `restore(saved)`.
  3. `a delivered push shows the cached text only: no payload read, no request, no navigation, the cache entry unchanged` — plant `settings.checkNotify: true`, a carried item `E2E 푸시 이월` dated `dstrIn(-1)` and `act.briefingSeen = today` with permission granted (no push stub needed — `evaluateOnNewDocument` scripts from the earlier steps are harmless); `h.reload()`; `sleep(2500)`; `entryBefore = await until(4000, checkEntry)` (must exist); `const cdp = await page.createCDPSession(); const regs = []; cdp.on("ServiceWorker.workerRegistrationUpdated", (e) => regs.push(...e.registrations)); await cdp.send("ServiceWorker.enable"); await sleep(500);` pick `registrationId` of the registration whose `scopeURL` starts with `origin()`; counters: `let navs = 0; page.on("framenavigated", …)`, `let reqs = 0; page.on("request", …)` (attached right before delivery); `await cdp.send("ServiceWorker.deliverPushMessage", { origin: origin(), registrationId, data: JSON.stringify({ open: "issues", secret: "PUSH-PAYLOAD-SENTINEL" }) })`; `sleep(1500)`; assert `navs === 0`, `reqs === 0`, `JSON.stringify(await checkEntry()) === JSON.stringify(entryBefore)`; soft (recorded in `h.metrics.pushNotificationsShown`, not asserted): `getNotifications({ tag: "life-check" }).length`; **when that number is > 0**, hard-assert the first's `title === entryBefore.title`, `body === entryBefore.body`, `data.open === "issues"`, and that neither contains `PUSH-PAYLOAD-SENTINEL`; the served `sw.js` push block (the text from `addEventListener("push"` to the next `});`) contains none of `e.data`, `fetch(`, `.json(`. `cdp.detach()`; `finally` → `restore(saved)`.
  `tools/e2e/README.md`: a Phase 2 paragraph, the `flow6.js` row, the count **282 → 285** (`flow6.js` 11 → 14), recounted.

**P8. Throwaway checks (scratchpad only, against the production build; do not commit)** — the full list is under "Throwaway checks" below: (a) Phase 1's and (a)–(g) here, including **(f) the real desktop end-to-end**.

**Phase 2 gates:** the Phase 1 gates plus `npm run smoke` (7(f) and the section 10 extension pass), `node --check tools/e2e/flow6.js tools/push/send.mjs tools/harness/smoke-logic.js`, `node tools/push/send.mjs` with no env → exit 0 and `daily push: secrets not set — nothing sent`; the packet/reader/issue-list baselines byte-identical (none reads `settings.pushNotify`); `git status` shows `tools/push/node_modules/` ignored and `tools/push/package-lock.json` tracked; `grep -r` of the private key's first eight characters over the working tree and `git diff --cached` finds nothing (the main agent runs this with the key read from the scratchpad file, never pasted into a command line that is echoed). Commit at the gate.

### Phase 3 — docs (docs-syncer)
Verify both phase commits against source first (`git log -2`, `git show --stat`), then:
- **`docs/design-docs/core-beliefs.md`** — insert after the 2026-09-24 amendment paragraph, before `### Rule 8` (a paragraph, not a heading; the `### Rule` count stays **19**, verify), this exact text:
  "**Amendment 2026-09-25 (user decision):** the app's repository sends one **contentless** Web Push a day at two fixed times (08:00 and 20:00 Asia/Seoul) from a GitHub Actions cron (`.github/workflows/notify.yml`, `tools/push/send.mjs`) — reversing the 2026-09-14 and 2026-09-22 records that the app has no push server. What the push carries is nothing the app knows: the service worker never reads the payload and shows the `확인 필요` text the page last mirrored into the `life-check` cache, or the generic pair. What leaves the device is the push subscription alone — an opaque endpoint and two keys, shown in `설정 › 푸시 알림` and copied by the user, by hand, into a repository secret; no record, no title, no identifier and no state is ever sent, and the app itself still makes no network call (the browser's push service registers the subscription and delivers the wake-up). The switch (`settings.pushNotify`, absent = off) asks the notification permission, subscribes with the app's own VAPID public key and writes `true` only once the subscription exists; off unsubscribes first. A tap opens the `이슈 목록` screen exactly as the local notification's tap does. No content, no AI, no judgement, no schedule the app decides beyond the two cron times, no nag copy — one wake-up, and on screen only facts the device already holds ([Rule 13](#rule-13)). The first-open stamp that lands the same day (`act.opened[date]`, an `HH:MM` the root writes once on the day's first open, shown as `오늘 첫 실행 HH:MM` beside a guide to a phone routine that opens the app) is a record of a user action and nothing else — never a streak, a score or a reward."
- **`docs/SECURITY.md`**: rewrite "Data in transit: still none" (the `확인 필요` section) and the "Data in transit" heading paragraph — one thing leaves the device, once, by hand: the push subscription (`endpoint`, `keys.p256dh`, `keys.auth`), shown in the settings sheet and pasted by the user into the repository secret `PUSH_SUBSCRIPTION`; the app makes no request of its own — the browser's push service does on `subscribe`, and the push itself carries `{ "open": "issues" }` that the worker never reads; the notification shown is the cached on-device text; the Actions log prints status codes only (the no-print rule, smoke 7(f)); the VAPID private key lives in a repository secret and nowhere in the tree; the public key is public by design; "Data at rest" gains `act.opened?` (times) and `settings.pushNotify?` (a boolean; the subscription is browser state, never in the save or the backup file); "Code execution surfaces" gains the workflow (`web-push` from a committed lockfile via `npm ci`, run with the two secrets, `permissions: contents: read`).
- **`docs/product-specs/notifications.md`**: a new section "The daily push (2026-09-25)" — the switch and its every string, `caps.push`/`caps.standalone`, `setPushNotify`'s three returns and the write order, the subscription display/copy/secret steps, the worker's `showCheck(renotify)` shared by `periodicsync` (`false`) and `push` (`true`), `send.mjs`'s behaviour and exit codes, `notify.yml`'s two crons; "What the notification never does" extended (never reads a push payload; the push carries no content); the E2E coverage paragraph (the three stubbed steps, written not run; the desktop proof). Also a short "The first-open stamp" cross-reference to home.md.
- **`docs/product-specs/install-and-backup.md`**: "Offline — the service worker" gains the third handler (`push`) and the lifted `showCheck`; a new "Opening the app at fixed times — a Samsung routine (2026-09-25)" section with the five `<ol>` steps verbatim, the two captions, the stamp and its line; "Deploying" gains `notify.yml`, the two secrets and how they are set (web UI, no `gh`), key generation (public key in two sources, private key in the secret only), the manual `Daily push` run.
- **`README.md`**: "Deploying" gains a "Daily push" paragraph — `notify.yml`, the two secrets, key generation (`npx --package web-push web-push generate-vapid-keys --json`, the public key into `src/LifeManager.jsx` and `tools/push/send.mjs`, the private key into `VAPID_PRIVATE_KEY` only), `tools/push` in "What lives where"; the stale `157-step` note may be corrected to "the E2E scenario as written" while there.
- **`docs/PRODUCT_SENSE.md`**: the non-goal bullet rewritten — the app never sends nag copy; since 2026-09-25 the repository sends a contentless wake-up push twice a day by the user's decision, which carries nothing and shows the on-device `확인 필요` facts; the calendar file stays the reminder path for schedule alarms.
- **`ARCHITECTURE.md`**: Files (`.github/workflows/notify.yml`, `tools/push/`, the `gen-sw.js` line gains the `push` handler); Stack line ("No backend, no network at runtime" → the app makes no request; the browser's push service delivers a repository-sent wake-up, 2026-09-25); the Daily assistant row (`OPENED_KEEP_DAYS`/`openedOf`/`openedMonthOf`/`openedLine`/`stampOpened` after `gateMonthLine`; `PUSH_VAPID_PUBLIC` beside `CHECK_*`; `pushNotifyOf` beside `checkNotifyOf`); the Modals row (`SettingsModal`'s `자동 실행` and `푸시 알림` sections, `onSetPushNotify`/`onToast`; `GateModal`'s first-open line; `copyPacket`'s `msg`); the App root row (`askNotificationPermission`, `pushKeyBytes`, `pushSubscriptionGet`, `pushSubscribe`, `pushUnsubscribe`, `pushEndpointTail`, `setPushNotify`, the first-open effect); the current-status paragraph (two more optional fields, E2E **285**, `flow6.js` 14); glossary rows `자동 실행` and `푸시 알림`.
- **`docs/RELIABILITY.md`**: "Offline and updates" (the `push` handler, `showCheck`); "Known limits" bullets — GitHub cron lateness (minutes to over an hour, on-the-hour slots busiest; planner decision 14); the 60-day schedule disable and the manual re-enable; subscription expiry/rotation with **no `pushsubscriptionchange` handler** — the app learns nothing, `send.mjs` exits 2 and the user re-copies; Chrome only, and the installed WebAPK for a tap that lands in the app rather than a tab; Android doze can delay a high-urgency push and the 6-hour `TTL` drops one to a phone that is off longer; headless E2E stubs the push manager and delivers through CDP — the real path was proven once on desktop (Phase 2 (f)) and on the phone by the user's manual run; the `flow6.js` `restore` defect that the not-run suite hid since 2026-09-22 (fixed here); the E2E table row for `flow6.js`.
- **`docs/design-docs/decision-log.md`**: one dated 2026-09-25 row — the reversal of "no push server" (2026-09-14/2026-09-22), the contentless design, what leaves the device, the hand-copied secret, the Rule 7 amendment; and the routine guide plus the first-open stamp (the app cannot open itself; the stamp is proof, not a mechanic) — linking this plan's `completed/` path.
- **`docs/product-specs/home.md`**: the two new `SettingsModal` sections in order (`자동 실행` between `AI 요청문` and `확인 알림`; `푸시 알림` between `확인 알림` and `오늘의 관문`) with every string.
- **`docs/design-docs/state-lifecycle.md`**: a "2026-09-25 additions" paragraph — `act.opened?` and `settings.pushNotify?`, no migrate, `freshState` unchanged, the prune, the subscription outside the save.
- **`docs/design-docs/demo-data.md`**: the `act.opened` bullet (`08:01` yesterday, `08:04` today; the settings line reads `이번 달 실행 2일` when both share a month).
- **`docs/product-specs/daily-gate.md`**: the first-open line under the title.
- **`docs/exec-plans/tech-debt-tracker.md`**: rows from TD-115 — no `pushsubscriptionchange` handler; the secret is a manual copy with no in-app match check beyond the endpoint tail; the stamp cannot tell a routine open from a manual one; the push E2E is stubbed and the phone path is manual; cron lateness and the 60-day disable have no in-app signal; the public Actions log is guarded by a smoke regex, not a sandbox; `caps.standalone` is read at mount only; key loss means regenerate, re-paste both sources, deploy and re-subscribe; the 6-hour `TTL`.
- **`tools/e2e/README.md`** (verify Phases 1–2 left it complete; recount).
- `npm run docs:gen && npm run docs:check`; move this plan to `docs/exec-plans/completed/` with a completion note; commit at the gate.

### Acceptance criteria
- A save with a profile and no `act.opened[today]` carries an `HH:MM` stamp after the first paint, on boot, on a day change, after onboarding, after the demo entry and after a backup import; a same-day reload never overwrites it; keys older than 60 days are gone after the next stamp; `freshState` has no `opened` key.
- `설정` states `오늘 첫 실행 HH:MM · 이번 달 실행 n일` (or `오늘 아직 열지 않음 · …`), the five routine steps in order and both captions, between `AI 요청문` and `확인 알림`; the gate states `오늘 첫 실행 HH:MM` under its title.
- The served `sw.js` handles `push` through the same `showCheck` the periodic sync uses, reads no payload, fetches nothing, reloads nothing, and still names `"life-check"` exactly twice.
- The push switch writes `settings.pushNotify` only, `true` only after `subscribe` resolved with `{ userVisibleOnly: true, applicationServerKey: <the app's key bytes> }`, `false` after `unsubscribe`; a refused permission or a failed subscribe writes nothing and shows the named notice; `checkNotify` is never touched; the subscription never enters the save or the backup file; the sheet states the endpoint tail, shows the subscription JSON on request, copies it with the named toast, and lists the four secret steps and the fact caption.
- `send.mjs`: no secrets → exit 0; a malformed secret → exit 1; a sent push → exit 0; 404/410 → exit 2 with the named line; every other failure → exit 1; the log never carries the endpoint, the keys, a body or a stack; its public key equals the app's.
- `notify.yml` runs at 23:00 and 11:00 UTC and on dispatch, reads the two secrets, has `contents: read` only, and a dispatch without secrets succeeds with `secrets not set`.
- Every packet, the reader, the briefing, the issue list and the check summary/text are byte-identical to HEAD `3b6b067`; no `%`, no praise, no nag in any new string.
- No schema bump, no migrate block, no `liferpg-*` key, no data row; `npm run finish` clean without an allowlist entry.

### Throwaway checks (scratchpad puppeteer against the production build at 390 px unless stated; do not commit)
(a) **Settings order and fit** — Phase 1: `자동 실행` between `AI 요청문` and `확인 알림`; Phase 2: `푸시 알림` between `확인 알림` and `오늘의 관문`; no horizontal overflow; the `ol`s render five and four numbered lines; screenshots.
(b) **The stamp** on the demo build: the demo enters with `act.opened[today] === "08:04"` kept (not overwritten) and the line `오늘 첫 실행 08:04 · 이번 달 실행 {1|2}일` by the calendar; a save without the stamp gets `HH:MM` within one paint; the gate on an un-passed planted save shows the line; a 61-day-old key is pruned on the next stamp and a 60-day-old one kept; onboarding after `localStorage.clear()` stamps nothing until `이 설정으로 시작`.
(c) **Baselines** (node, the bundled builders): every packet, `buildReader`, `buildBriefing`, `issueListOf`, `checkSummaryOf`/`checkNotificationOf` byte-identical to HEAD `3b6b067` over the demo, the demo with `workInAi: false`, the flow11-shaped heavy save and a fresh-shaped save, each with and without `act.opened`/`settings.pushNotify` planted.
(d) **The stubbed push path** on `vite preview` (the flow6 stub script run by hand): the `subscribe` options and key bytes; the write order with the 800 ms delayed stub (`pushNotify` absent at 400 ms, `true` at 1300 ms); a rejecting stub → `failed` notice, nothing written; a denied permission → `denied` notice, nothing written, `checkNotify` untouched; the textarea/copy/toast; the raw save free of the endpoint; the demo build (`file://`, no worker) → the box disabled with `이 브라우저에서는 푸시를 쓸 수 없어요`.
(e) **`send.mjs` by hand**: no env → exit 0 and `secrets not set`; `PUSH_SUBSCRIPTION='{"endpoint":"https://push.example/x","keys":{"p256dh":"a","auth":"b"}}'` with the real private key (read from the scratchpad file by a runner, never typed) → exit 1 and a log with no `push.example`, no key material, no stack; `PUSH_SUBSCRIPTION=not-json` → exit 1 with the named line.
(f) **The real desktop end-to-end** (headful Chrome on `vite preview`): open `설정 › 푸시 알림`, switch on (a real `subscribe` with the real public key on `localhost`), `구독 정보 보기 ›`, copy the JSON into `<scratchpad>/sub.json`; run `send.mjs` through the scratchpad runner with the real pair → exit 0 `sent (201)`; the desktop notification appears with the cached `확인 필요` title (or the generic pair); clicking it focuses the app (or opens `?open=issues`) and lands on `이슈 목록`; then switch off (a real `unsubscribe`) and run `send.mjs` again → exit 2 `subscription expired — copy it again from the app`. Record the status codes in the progress note; never the endpoint.
(g) **CDP delivery on `vite preview`** (headful, so `getNotifications` is observable): `ServiceWorker.deliverPushMessage` with a sentinel payload → one notification whose title/body equal the cache entry and carry no sentinel, `data.open === "issues"`, no navigation, no request, the cache entry unchanged; the served `sw.js` push block free of `e.data`.

### Mutation checks (each must fail at least one smoke or E2E assertion; apply, run, revert; the source hash equal before and after)
1. **Stamp overwrite** — `stampOpened` always writing `at` (drop the early return) → smoke 10(b) (same reference, value kept) and flow6 step 1 (`00:01` survives a reload) fail.
2. **Prune floor** — `d >= floor` → `d > floor`, or the filter removed → smoke 10(c) (`-60` kept / `-61` dropped) and flow6 step 1 fail.
3. **Month count reading `act.gate`** — `openedMonthOf` counting `act.gate` keys → smoke 10(d) and throwaway (b) on the demo (`3일`) fail.
4. **`setPushNotify` flipping `checkNotify`** (writing both keys) → flow6 step P7-1 (`checkNotify` equality) and throwaway (d) fail.
5. **Writing before `subscribe` resolves** (`write(true)` moved above `await pushSubscribe()`) → flow6 step P7-1's 400 ms read and step P7-2's refused subscribe (`pushNotify` present) fail; throwaway (d)'s delayed stub fails.
6. **The push handler reading `e.data`** (a `const p = e.data?.json()` line in the push block) → smoke 7(e)'s push-block regex and flow6 step P7-3's served-worker check fail.
7. **Public key mismatch** (one character changed in `send.mjs`) → smoke 7(f)'s equality check fails; flow6 step P7-1's key-bytes comparison fails.
8. **`send.mjs` printing the error object** (`console.log(err)` in the catch) → smoke 7(f)'s no-print rule fails; throwaway (e) shows the endpoint in the log.
9. **`showCheck(false)` in `push`** → smoke 7(e)'s `showCheck(true)` requirement fails.

### Open risks (stated, not softened — the docs-syncer carries them into RELIABILITY and the tracker)
- **Delivery is Chrome's and Google's, not the app's**: Android delivers through FCM; doze and battery optimisation can delay a high-urgency push; a phone off longer than the 6-hour `TTL` misses that wake-up entirely; a phone whose Chrome notification channel is muted shows nothing. Samsung Internet or another browser is a different subscription — the guide and the secret are for Chrome.
- **GitHub's cron is best-effort**: on-the-hour slots run minutes to over an hour late; a schedule is disabled after 60 days without repository activity and must be re-enabled by hand; Actions minutes are free on a public repository — this repository is public, which is also why the log must never carry the endpoint.
- **Expiry and rotation are silent on the phone**: the app has no `pushsubscriptionchange` handler; when the browser rotates or drops the subscription the secret goes stale, `send.mjs` exits 2 on the next run, and the user notices only by looking at Actions or by the silence — then re-copies the subscription.
- **Two hand-pasted secrets**: a typo yields exit 1 with, by design, no echo of what was pasted; the only diagnosis is "copy it again".
- **The stamp cannot tell a routine open from a manual one**, and a routine that opens the app while the phone is locked stamps the moment the app painted, not the moment the user looked.
- **Key loss**: if the scratchpad file is deleted before the secret is set, the pair is regenerated, the public key re-pasted into both sources, a deploy pushed and the phone re-subscribed (the old subscription is bound to the old key).
- **Every push shows a notification**: `userVisibleOnly` requires it, so a phone with no cached entry (never opened since install) sees the generic pair `인생 관리 — 오늘 읽을 것을 확인해요` / `앱을 열면 목록이 갱신돼요` — a fact, stated in the caption.
- **The E2E is written, not run, and the push steps are stubbed**: the `flow6.js` `restore` defect (2026-09-22) went unnoticed for three days for exactly this reason; the real path is proven once on desktop and by the user's manual run.
- **The Actions log guard is a regex**, not a sandbox: it pins the four `console.log` lines; a future edit that prints through another path must be caught by review.

### Gates
`npm run build` · `npm run finish` exit 0 (no allowlist entry; if one is unavoidable, a reason and a tracker row) · `npm run lang:check` · `npm run smoke` · `node --check` on every edited/new `.js`/`.mjs` · `npm run docs:gen && npm run docs:check` · `node tools/push/send.mjs` with no env → exit 0. `npm run verify` is **not** run (standing user instruction) — say so. Every file LF. Commit only at an approved phase gate; **Phases 1–3 are pushed together as one push** (Step 4).

### Finish protocol
cleanup → verifier (build, smoke, `node --check`; E2E written, not run) → docs-syncer (Phase 3) → report with the commands run, the measurements, the throwaway and mutation results, the real-desktop status codes (never the endpoint), the open risks restated, and the proposed commit messages.

## Steps
1. Phase 1 (implementer): A1–A9; gates; baselines; throwaway (a)(b)(c); mutations 1–3; progress note; commit at the gate.
2. Phase 2: P0 (main agent — the VAPID pair in the scratchpad; the public key only to the implementer), then P1–P8 (implementer); gates; throwaway (a)(d)(e)(f)(g); mutations 4–9; progress note; commit at the gate.
3. Phase 3 (docs-syncer): the list above; `docs:gen` + `docs:check`; move this plan to `completed/`; commit at the gate.
4. Main agent: **push all three commits together**; wait for the Pages deploy; grep the live bundle for `자동 실행`, `매일 푸시 알림`, `구독 정보 보기`, and the live `sw.js` for `addEventListener("push"`; confirm `Daily push` appears under Actions and that a `workflow_dispatch` run without secrets logs `daily push: secrets not set — nothing sent` and succeeds.
5. Main agent: report in Korean what the user does once — (1) create the two routines on the phone from the `자동 실행` steps, (2) open `설정 › 푸시 알림` in the installed app, switch on, `구독 정보 보기 ›` → `복사`, add the repository secret `PUSH_SUBSCRIPTION`, (3) add `VAPID_PRIVATE_KEY` from the scratchpad file and delete the file, (4) run `Daily push` by hand once and watch the phone — plus the caveats (cron minutes late, expiry → re-copy, install from Chrome, E2E written not run).

### Progress
_(append one dated note per phase: what landed, gates and results, measurements, deviations, plan errors)_
- [x] **Phase 1 done (implementer, 2026-09-25, not committed).** A1–A9 landed. `src/LifeManager.jsx`: the first-open block after `gateMonthLine` (`OPENED_KEEP_DAYS` 60, `openedOf`, `openedMonthOf`, `openedLine`, `stampOpened` — plain column-0 declarations, `hhmm`/`shiftDay` their only dependencies); the `@schema` `act` block documents `opened?` (still v28, no migrate block, `freshState` unchanged); the root effect on `[phase, state, today]` after the `quizHeld` day-change effect; `GateModal` reads `openedOf` and renders `오늘 첫 실행 HH:MM` under its title once the stamp exists; `demoState` seeds `act.opened` (`08:01` yesterday, `08:04` today) after the gate block; `SettingsModal` gains the `자동 실행` section between `AI 요청문` and `확인 알림` (the `openedLine`, the five-item `<ol>`, the two captions — no switch, no write). `tools/harness/gen-sw.js`: the periodic-sync body lifted into `showCheck(renotify)`, `periodicsync` → `showCheck(false)`, a new `push` handler → `showCheck(true)`, the header comment names both; the `"life-check"` literal still appears exactly twice. `tools/harness/smoke-logic.js`: 7(e) extended by the two push checks; section 10 new (`first-open stamp: 13 checks`). `tools/e2e/flow6.js`: `restore` moved to file level after `writeState` (the takeover step's inner `until` left where it was); two new steps between the denied-permission step and the `?open=` step; the served-`sw.js` list gains the three push strings. `tools/e2e/flow4.js`: the v18 → v19 `act` key set read without `gate` and `opened`. `tools/e2e/README.md`: the 2026-09-25 paragraph, the `flow6.js` row, `280` → `282` (`flow6.js` 9 → 11, recounted).
  - Gates: `npm run build` ok · `npm run finish` clean (no allowlist entry) · `npm run lang:check` clean · `npm run smoke` all checks passed — 10 sections (`check summary: 22 checks`, was 20; `first-open stamp: 13 checks`) · `node --check` on `flow4.js`, `flow6.js`, `gen-sw.js`, `smoke-logic.js` · `npm run docs:gen` (`db-schema.md` picks up `opened?`; `symbol-index.md` 589 symbols, was 584 — the five new declarations) and `npm run docs:check` clean · every edited file LF (`git ls-files --eol`). `npm run verify` and every E2E run **not run** (standing instruction): the two `flow6.js` steps are written and parse only; 282 `await step(` calls as written.
  - Baselines against HEAD `3b6b067`: 134 of 134 node outputs byte-identical (the work, since-mode work, review, daily, role and quiz packets, every prep packet, `buildReader`, `buildBriefing`, `issueListOf`, `meetingPrepOf`, `checkSummaryOf`, `checkNotificationOf`, `gateStepsOf` over the demo, the demo with `workInAi: false`, the flow11-shaped heavy save and a fresh-shaped save, each with and without `act.opened` planted). Rendered on the demo build (puppeteer, `innerHTML` of the sheet): the reader, the issue list, the briefing and the settings sheet minus the new section byte-identical between the HEAD demo build and the new one. `demoState()` differs from HEAD by `act.opened` alone (the other `act` keys, the top-level key set and every record count equal).
  - Throwaway (scratchpad puppeteer at 390 × 844; not committed). The demo build (`file://`), 41 of 41, 0 console errors: the demo enters with a `nav`, no gate and its seeded `act.opened` kept (`08:04` today, `08:01` yesterday — not overwritten); the settings sheet states `자동 실행` between `AI 요청문` and `확인 알림` (the full order `AI 요청문` → `자동 실행` → `확인 알림` → `오늘의 관문` → `데이터 — 백업 · 초기화`), the line `오늘 첫 실행 08:04 · 이번 달 실행 2일`, the five steps as a `decimal`/`inside` list on five separate lines, both captions, no `%`, no horizontal overflow (document 390, sheet `scrollWidth` ≤ `clientWidth`, every `li` inside 390); a save without the stamp carries `HH:MM` 91–118 ms after `domcontentloaded`, equal to the clock, `act` the only changed key (`lastTick` excepted), the other `act` keys byte-equal, today the only `opened` key; a planted `00:01` survives a reload; a save with today's stamp alone reads `이번 달 실행 1일` beside the demo's two gate entries (the count never reads `act.gate`); a 61-day key is dropped and a 60-day key kept on the next stamp; with today's gate entry and stamp removed the gate opens alone with `오늘 첫 실행 HH:MM` as its second line (`font-mono text-zinc-400`, directly under the `h3`), equal to the stamp the same load wrote, kept across a reload with the gate still standing; a backup import of a save stamped yesterday only is stamped for today after the import (`백업을 불러왔어요` shown); onboarding after `localStorage.clear()` writes no state, so nothing is stamped. `vite preview` of the production build, 27 of 27, 0 console errors: the worker controls the page; with `checkNotify` planted and permission granted the `life-check` entry exists; the served `sw.js` contains `addEventListener("push"`, `const showCheck`, `showCheck(true)`, `showCheck(false)`, `renotify`, one `showNotification(` call, exactly two `"life-check"` literals, a push block free of `e.data`/`fetch(`/`.json(`, no `location.reload`/`controllerchange`/`.navigate(`; `ServiceWorker.deliverPushMessage` (CDP, twice, with a sentinel payload) → no navigation, no request, no overlay, the save unchanged, the cache entry byte-identical, no worker error, the worker `activated` and `running` afterwards; `getNotifications` reports 0 in headless (as on 2026-09-22 — not asserted); a worker `message` `{ open: "issues" }` still opens the issue list; the http boot stamps `HH:MM`.
  - Mutations (each applied, run, reverted; both source hashes equal before and after): 1 stamp overwrite → smoke 10(b) fails (same reference / first time kept); 2 prune floor `>` → smoke 10(c) fails (the 60-day key dropped); 3 month count reading `act.gate` → smoke 10(d) fails and the demo throwaway fails 2 (`4일` on the demo — two gate entries plus two stamps — and `3일` with today's stamp alone); 6 `const p = e.data?.json()` in the push block → smoke 7(e)'s push-block regex fails; 9 `showCheck(false)` in `push` → smoke 7(e)'s `showCheck(true)` requirement fails. `flow6.js` step 1 as written would fail 1 and 2 (`00:01` overwritten; the 60-day key) — not run.
  - Deviations: (1) the gate's first-open line was placed directly after `const st = gateStepsOf(…)` (the top of the component, as A4 says) — nothing else in `GateModal` moved. (2) flow6 step 2 sleeps 400 ms after `h.reload({}, { keepModal: true, keepGate: true })` — `{}` reloads on `load` only and the boot is async. (3) flow6 step 1's `changedKeys(planted, after) === ["act"]` relies on `saved` being read after a `restore` reload (so `plantGate`'s `passedAt: "00:00"` is already in the save before the plant); every earlier check step ends in `restore`, so the assumption holds in the suite's order. (4) Throwaway (b)'s onboarding case was verified up to the clear (no state, nothing stamped); the six-step onboarding was not driven — the finish path is the same `phase`/`state` gate the demo entry and the backup import take, both verified. (5) The day-change path was not exercised in a browser (the clock is not moved); smoke pins `stampOpened` for an unstamped `today`. (6) The E2E README's `flow6.js` row was extended rather than rewritten.
  - Plan errors: (a) mutation 3's "throwaway (b) on the demo (`3일`)": the demo reads `4일` under that mutation (two gate entries + two stamps); `3일` is the today-only plant. (b) The A2 line as spelled in the plan has 20 spaces before its `//`; the neighbours' comment column needs 20 there too once the shorter head is measured — written aligned. (c) Nothing else; every line number the plan gave held at HEAD `3b6b067`.
  - Korean strings added (all in `src/LifeManager.jsx`, none elsewhere): `자동 실행`, `오늘 첫 실행 {HH:MM}`, `오늘 아직 열지 않음`, `이번 달 실행 {n}일`, the five routine steps and the two captions as A6 spells them; `gen-sw.js` adds no string (the two generic-pair strings moved into `showCheck` unchanged).
  - Screenshots (scratchpad, not committed): `r1-settings-390-new.png` (the `자동 실행` section between `AI 요청문` and `확인 알림`), `r1-gate-390-new.png` (`오늘 첫 실행 23:38` under the gate's title).

- [x] **Phase 2 done (implementer, 2026-09-26 — the work ran past midnight from 2026-09-25; not committed).** P1–P7 landed. `src/LifeManager.jsx`: `PUSH_VAPID_PUBLIC` after `CHECK_DEBOUNCE_MS`; `pushNotifyOf` after `checkNotifyOf`; the six browser-side helpers after `checkRefresh` (`askNotificationPermission`, `pushKeyBytes`, `pushSubscriptionGet`, `pushSubscribe`, `pushUnsubscribe`, `pushEndpointTail`); `setCheckNotify` now calls `askNotificationPermission` (behaviour unchanged); `setPushNotify` beside it; `copyPacket(taRef, text, onToast, msg = …)` with every existing caller unchanged; the `@schema` `settings` block documents `pushNotify?` (still v28, no migrate block, `freshState` and `demoState` unchanged); `SettingsModal` gains `onSetPushNotify`/`onToast`, `caps.push`/`caps.standalone`, `pushSub`/`pushErr`/`showSub`/`subRef`, `togglePush`, and the `푸시 알림` section between `확인 알림` and `오늘의 관문`. New files: `tools/push/package.json` (+ `package-lock.json` from one `npm install --prefix tools/push`; `npm ci --prefix tools/push` succeeds), `tools/push/send.mjs`, `.github/workflows/notify.yml`; `.gitignore` gains `tools/push/node_modules/`. `tools/harness/smoke-logic.js`: `fs`/`path` required, section 7 lifts `PUSH_VAPID_PUBLIC`/`pushKeyBytes`, 7(f) added (`check summary: 51 checks`, was 22), section 10 lifts `PUSH_VAPID_PUBLIC`/`pushNotifyOf`/`pushEndpointTail` and gains (g) (`first-open stamp: 17 checks`, was 13). `tools/e2e/flow6.js`: `fs`/`path` required, `switchBox(label, click)` shared by `checkBox` and `pushBox`, `installPushStub`, the three push steps between the gate step and the `?open=` step. `tools/e2e/README.md`: the Phase 2 paragraph, the `flow6.js` row, `282` → `285` (`flow6.js` 11 → 14, recounted with `grep -o "await step(" tools/e2e/flow*.js | wc -l`).
  - Gates: `npm run build` ok · `npm run finish` clean (no allowlist entry) · `npm run lang:check` clean · `npm run smoke` all checks passed (10 sections) · `node --check` on `flow4.js`, `flow6.js`, `gen-sw.js`, `smoke-logic.js`, `send.mjs` · `npm run docs:gen` (`db-schema.md` picks up `pushNotify?`; `symbol-index.md` 597 symbols, was 589 — the eight new declarations) and `npm run docs:check` clean · every edited and new file LF (`git ls-files --eol`; the untracked four checked by hand) · `git status`: `tools/push/node_modules/` ignored (`git check-ignore`), `tools/push/package-lock.json` untracked-new, to be committed · a private-key sweep (the prefix read from the scratchpad file inside node, never printed) over 174 tracked + untracked files: 0 hits · `node tools/push/send.mjs` with no env → exit 0 `daily push: secrets not set — nothing sent`. `npm run verify` and every E2E run **not run** (standing instruction): the three `flow6.js` steps are written and parse only; 285 `await step(` calls as written.
  - `send.mjs` by hand (a scratchpad runner reads the private key from `vapid.json` at runtime and scans the output for the key, its prefix, the endpoint and a stack): no env → exit 0, one line; `{"endpoint":"https://push.example/x","keys":{"p256dh":"a","auth":"b"}}` with the real key → exit 1 `daily push: failed (no status)`, one line, no `push.example`, no key, no stack; `not-json` → exit 1 `daily push: PUSH_SUBSCRIPTION is not a subscription JSON — copy it again from the app`; a JSON without `keys` → the same exit 1 line.
  - Baselines against HEAD `b756b78`: 272 of 272 node outputs byte-identical (the work, since-mode work, review, daily, role and quiz packets, every prep packet, `buildReader`, `buildBriefing`, `issueListOf`, `meetingPrepOf`, `checkSummaryOf`, `checkNotificationOf`, `gateStepsOf` over the demo, the demo with `workInAi: false`, the flow11-shaped heavy save and a fresh-shaped save, each × {nothing planted, `act.opened`, `settings.pushNotify`, both}; `demoState()`'s key set, `settings`, `act` and every record count equal to HEAD's).
  - Throwaway (scratchpad puppeteer, not committed). (a)(d) `vite preview` of the production build at 390 × 844, headless, 57 of 57, 0 console errors: the section order `AI 요청문` → `자동 실행` → `확인 알림` → `푸시 알림` → `오늘의 관문` → `데이터 — 백업 · 초기화`; the tab caption present, the no-push caption absent, the fact caption present, no `%`; no horizontal overflow with the switch off and with the textarea shown; the stubbed switch: nothing written at 400 ms, `pushNotify: true` at 1300 ms, `settings` the only changed key, `checkNotify`/`workInAi`/`bizHoursPerWeek` untouched, one `subscribe` with `userVisibleOnly: true` and the 65-byte key equal to `send.mjs`'s (first byte 4), the toast `매일 푸시 알림 켜짐`, `구독 등록됨 · …abcdef123456`, the read-only textarea (a subscription JSON) behind `구독 정보 보기 ›` with the four steps as a `decimal/inside` list, `복사` → the stubbed clipboard equals the textarea and the toast `복사했어요 — 저장소 비밀에 붙여넣어요`, the raw save free of the endpoint and keys, the button hides the textarea again, off → `false`, `{ unsubscribe: true }` the last call, the status line gone, the toast `매일 푸시 알림 꺼짐`; a rejecting stub → nothing written, `푸시 구독에 실패했어요 — 설치된 앱(Chrome)에서 다시 켜요`, one `subscribe` call; a denied permission → nothing written, `알림 권한이 꺼져 있어요 — 폰 설정에서 허용해요` replacing the failed notice, `checkNotify` untouched, no further `subscribe`. (g) CDP `ServiceWorker.deliverPushMessage` with a sentinel payload → no navigation, no page request, the cache entry and the save byte-identical, no worker error, the served push block free of `e.data`/`fetch(`/`.json(`; `getNotifications` 0 in headless (as on 2026-09-22). The demo build (`file://`, no worker), 10 of 10: the box disabled and `text-zinc-500`, `이 브라우저에서는 푸시를 쓸 수 없어요`, no tab caption, no status line, the order and the fact caption, no overflow. (f) **the real desktop end-to-end** (headful Chrome on `vite preview`, a real profile whose content settings grant the notification permission): a real `pushManager.subscribe` on `http://localhost:4174/` with the app's key resolved and `pushNotify: true` was written with `settings` the only changed key; the sheet's tail equals the real endpoint's last 12 characters; the textarea equals `getSubscription().toJSON()`; the raw save carries neither the endpoint nor a key; `send.mjs` with the real pair → exit 0 `daily push: sent (201)` (three runs); Chrome's `chrome://gcm-internals` logged `Data msg received` for the app id within a second of every send; the worker, instrumented over CDP, recorded the `push` event (`hasData: true`, never read) and `showNotification("인생 관리 — 확인 필요 2가지", { tag: "life-check", renotify: true })` resolving `ok` — the cached title, not the payload; the real `unsubscribe` emptied the push manager and `send.mjs` → exit 2 `daily push: subscription expired — copy it again from the app`. **Not observed**: `getNotifications()` returned `[]` for the pushed notification and also for a direct `showNotification` probe from the page and from the worker (a property of this Chrome/Windows, not of the app), and a screen capture 2.5 s after the send showed no Windows toast in frame; a tap on an OS notification is not scriptable — the `notificationclick` route stands verified through the worker's `{ open: "issues" }` message (2026-09-22/25). Status codes recorded: 201, 201, 201; 410-class → exit 2. Never the endpoint.
  - Mutations (each applied, run, reverted; the three source hashes equal before and after): 4 `setPushNotify` writing `checkNotify` too → throwaway (d) fails (`checkNotify and workInAi untouched`; `flow6.js` P7-1 asserts the same); 5 `write(true)` before `pushSubscribe` → (d) fails 5 (nothing written at 400 ms, the refused subscribe wrote `true`, the box read checked, the denial wrote `false`, the denied notice missing); 6 `const p = e.data?.json()` in the push block → smoke 7(e) fails; 7 one character of `send.mjs`'s key → smoke 7(f)'s equality and (d)'s key-bytes comparison fail; 8 `console.log(err)` in the catch → smoke 7(f)'s no-print rule fails and the runner's bogus-endpoint run prints a nine-line stack (`leak=true`); 9 `showCheck(false)` in `push` → smoke 7(e) fails. `dist/` rebuilt from the clean tree afterwards; `release/` untouched by the mutations.
  - Deviations: (1) the root passes `onToast={(msg) => showToast({ msg })}` — the file's convention for `copyPacket`'s string-taking `onToast`; the plan's literal `onToast={showToast}` would have rendered an empty toast pill (`showToast` takes `{ msg }`). (2) `checkBox` became a thin wrapper over a shared `switchBox(label, click)` that `pushBox` reuses — a verbatim twin would have sat one line under `finish`'s 6-line duplicate window. (3) `flow6.js` step P7-2 plants a copy with `settings.pushNotify` deleted before its reload, as P7-1 does, so its "no key" assertion does not rest on the previous step's restore. (4) The `구독 정보 보기 ›` button and the textarea/`복사`/`<ol>` sit in `mt-1.5` wrappers; the textarea's own classes are the plan's. (5) The `caps` effect reads the subscription as `if (push) { const sub = await pushSubscriptionGet(); if (live) setPushSub(sub); }` so an unmounted sheet is never set. (6) Section 10(g) also pins the key's leading `B` (the 0x04 point byte encoded); 7(f)'s messages carry the measured values.
  - Plan errors: (a) `onToast={showToast}` (deviation 1). (b) Throwaway (f) as written could not observe delivery: `overridePermissions` is a DevTools override that Chrome's push service does not consult at delivery, so the first headful passes received the push (GCM log) but never woke the worker — a profile whose `Preferences` grant the permission was needed; and a `--user-data-dir` under the Korean-character scratchpad path made `CacheStorage.open` fail so the worker could not install — the profile went to an ASCII path and was deleted afterwards. (c) "headful, so `getNotifications` is observable" does not hold on this machine even for a direct `showNotification`; the worker instrumentation stands in. (d) Nothing else; every anchor the plan named held after Phase 1's shifts.
  - Korean strings added (all in `src/LifeManager.jsx`): `푸시 알림`, `매일 푸시 알림`, `이 브라우저에서는 푸시를 쓸 수 없어요`, `설치된 앱이 아니에요 — 알림을 누르면 Chrome 탭으로 열려요`, `알림 권한이 꺼져 있어요 — 폰 설정에서 허용해요` (the `확인 알림` wording, repeated), `푸시 구독에 실패했어요 — 설치된 앱(Chrome)에서 다시 켜요`, `구독 등록됨 · …{tail}`, `구독 없음 — 껐다 켜면 다시 등록돼요`, `구독 정보 보기 ›`, `푸시 구독 정보` (the textarea's `aria-label`), `복사`, the four secret steps and the fact caption as P2 spells them, the toasts `매일 푸시 알림 켜짐` / `매일 푸시 알림 꺼짐` / `복사했어요 — 저장소 비밀에 붙여넣어요`. `send.mjs`'s header comment names `설정 › 푸시 알림` (the plan's exact text; outside `lang-check`'s walk). No `%`, no praise, no nag.
  - Screenshots (scratchpad, not committed): `r2-settings-push-390-new.png` (the section, switch off), `r2-settings-sub-390-new.png` (on: the status line, the textarea, `복사`, the four steps, the toast), `r2-settings-failed-390-new.png`, `r2-settings-denied-390-new.png`, `r2-demo-settings-390-new.png` (`file://`, the box disabled).

- [x] **Phase 3 done (docs-syncer, 2026-09-26).** Both phase commits verified against source (`git log -2`: `b756b78`
  Phase 1, `ce7f35b` Phase 2; `git show --stat` for both) before editing. Updated: `core-beliefs.md` (the Rule 7
  amendment paragraph, dated 2026-09-25, inserted verbatim after the 2026-09-24 amendment and before `### Rule 8`
  — `### Rule` heading count verified at 19 both before and after); `SECURITY.md` (intro line, two new "Data at
  rest" bullets for `act.opened?`/`settings.pushNotify?`, a new "The daily push" section, the `확인 필요`
  section's local-transit paragraph reworded, the top-level "Data in transit" paragraph rewritten around the two
  contacts, "Code execution surfaces" gained the workflow, the Rule-7 safety-property bullet reworded);
  `notifications.md` (the service-worker section rewritten around the shared `showCheck(renotify)`, a new "The
  daily push" section — switch/strings, `setPushNotify`'s three returns and write order, why the payload is
  ignored, the secrets model, the routine and the first-open stamp cross-reference to `home.md` — "What the
  notification never does" gained the no-payload bullet and the `pushNotify` line, a new E2E-coverage paragraph
  for the first-open stamp and the three stubbed push steps plus the real desktop proof); `install-and-backup.md`
  (the third worker handler, a new "Opening the app at fixed times" section with the five routine steps
  verbatim, "Deploying" gained `notify.yml`/the two secrets/key generation/the manual run); `README.md` (line 3,
  the stale "157-step" note corrected, a "Daily push" paragraph under Deploying, `tools/push/` in "What lives
  where"); `PRODUCT_SENSE.md` (the non-goal bullet reworded around the 2026-09-25 reversal); `ARCHITECTURE.md`
  (Stack line, Files block — both workflows, `tools/push/`, the `gen-sw.js` line — the Daily assistant row's five
  new helpers plus `PUSH_VAPID_PUBLIC`/`pushNotifyOf`, the Modals row's two settings sections/`GateModal`
  line/`copyPacket`'s `msg`, the App root row's six push helpers/`setPushNotify`/the first-open effect, two new
  glossary rows plus the `확인 필요` row reworded, Current status — E2E **285**, `flow6.js` 14, two more optional
  fields); `RELIABILITY.md` (storage-arithmetic bullet for the stamp/setting, the third handler in "Offline and
  updates", a new narrative paragraph for both phases including the real desktop end-to-end and what was *not*
  observed on this machine, the `flow6.js` E2E-table row extended, four new "Known limits" bullets — cron
  lateness/60-day disable/no-`pushsubscriptionchange`/WebAPK-only/doze/the stamp's routine-vs-manual gap/headless
  notifications unobservable); `decision-log.md` (one 2026-09-25 row — the reversal, under contentless/
  subscription-only terms, linking this plan's `completed/` path); `home.md` (the `자동 실행` and `푸시 알림`
  sections inserted in order with every string, the `오늘의 관문` section's position note updated); `state-lifecycle.md`
  (a "2026-09-25 additions" paragraph for `act.opened?`/`settings.pushNotify?`); `demo-data.md` (the `act.opened`
  bullet); `daily-gate.md` (the gate's first-open line, the settings-section position note); `calendar-export.md`
  (line 3 reworded to state the daily push is contentless and not a scheduling mechanism); `tech-debt-tracker.md`
  (TD-115 through TD-121 — no `pushsubscriptionchange`, the 60-day schedule disable, the stamp's routine-vs-manual
  gap, a push tap in a tab opening a tab, GitHub's own failure e-mails on an expired subscription, the `flow4.js`
  latent key-set defect fixed in Phase 1, and the `onToast` signature plan error fixed in Phase 2); `tools/e2e/README.md`
  (verified only — both phases had already brought it to 285, `flow6.js` 14; recounted with
  `grep -o "await step(" tools/e2e/flow*.js | wc -l` → 285, matching). Grepped `docs/` and `README.md` for `no
  network`, `no push server`, `no subscription` and `network call`: fixed every current-behaviour claim found —
  `docs/PRODUCT_SENSE.md`, `docs/design-docs/calendar-export.md`, `docs/product-specs/notifications.md`'s intro,
  `docs/SECURITY.md`'s three spots, `ARCHITECTURE.md`'s Stack line and `확인 필요` glossary row, `README.md`'s
  line 3 — the 2026-09-14/2026-09-22 `decision-log.md` rows and every packet-scoped "makes no network call"
  statement (the assistant bridge, the daily reader, the calendar file) were left untouched, since each remains
  true of that one feature on its own. `information-architecture.md` and `backlog.md` were checked and need no
  edit (neither enumerates the settings sections in full, and neither restates the no-push position). Gates:
  `npm run docs:gen` (`db-schema.md` v28/18 blocks/14 keys, `symbol-index.md` 597 symbols — unchanged from Phase
  2, confirming no source drift since) and `npm run docs:check` exit 0. Screenshots regenerated
  (`npm run build:demo`, `node tools/harness/gen-screenshots.js`) — six files (home, tasks, work, goals,
  calendar, meetings); `home.png` came back byte-identical to what was already tracked, the other five differ
  only in the relative dates the demo renders against today's real system date (2026-09-26 — expected drift of
  any regeneration, not a content regression) and remain unstaged, not committed. Visually confirmed (`home.png`
  inspected directly): the CV card and bottom nav render with no `오늘의 관문` layer in frame — today's seeded
  `act.gate` entry carries `passedAt`, so the demo still opens straight into the app. `npm run verify` was **not
  run**, per the standing user instruction restated at the top of this plan.

## Verification
`npm run build`, `npm run finish`, `npm run lang:check`, `npm run smoke`, `node --check` on every edited or new `.js`/`.mjs`, `npm run docs:gen && npm run docs:check`, `node tools/push/send.mjs` (no env → exit 0); the throwaway (a)–(g) and mutation 1–9 lists above; the live-bundle greps after the one push. `npm run verify` skipped per the standing instruction (state it in every report). Real proof: the desktop end-to-end in Phase 2 (f); the phone proof after the user sets the secrets (a manual `Daily push` run).

## Cleanup checklist
- [x] `npm run finish` exit 0 (unused symbols/imports, duplicates — `showCheck` and `askNotificationPermission` are the two lifts that prevent duplicate windows — residue, language) — Phase 1: clean (`showCheck` lifted; no duplicate window between the two handlers) — Phase 2: clean (`askNotificationPermission` shared by both switches; `switchBox` shared by `checkBox`/`pushBox` in `flow6.js`)
- [x] allowlist additions (with reason) mirrored in tech-debt-tracker.md — expected: none — Phase 1: none — Phase 2: none
- [x] `tools/push/send.mjs` and `notify.yml` comments in English by hand (outside `lang-check`'s walk); `tools/push/node_modules/` ignored; `package-lock.json` tracked — Phase 2: both files English (`send.mjs` names `설정 › 푸시 알림` as the plan's text); `git check-ignore` confirms `tools/push/node_modules/`; the lockfile is untracked-new and goes into the Phase 2 commit
- [x] no private key, no `vapid.json`, no `sub.json`, no throwaway script, no mutated source, no regenerated PNG in the tree; `git grep` for the private key's first eight characters finds nothing — Phase 1: every throwaway lives in the scratchpad; both source hashes verified equal after every mutation; `dist/` and `release/` rebuilt from the clean tree after the mutated demo build; `public/screenshots` untouched — Phase 2: the prefix sweep over 174 tracked + untracked files finds 0 hits; the scratchpad `sub.json` and the headful profile (`C:/Users/Public/lm-push-profile`) deleted; the three source hashes equal after every mutation; `dist/` rebuilt clean
- [x] every UI string exactly as this plan spells it; no `%`, no praise, no nag — Phase 1: the five steps, the two captions and the line asserted verbatim by the throwaway and by `flow6.js`; no `%` in the section — Phase 2: the label, both captions, both notices, the status line, the four steps, the fact caption and the three toasts asserted verbatim by the throwaway and by `flow6.js`; no `%` in the section

## Docs to sync
Phase 3 list: core-beliefs (the Rule 7 amendment, 19 headings), SECURITY, notifications.md, install-and-backup, README, PRODUCT_SENSE, ARCHITECTURE, RELIABILITY, decision-log (the reversal), home.md, state-lifecycle, demo-data, daily-gate.md (one line), tech-debt-tracker, tools/e2e/README; `docs/generated/*` by `docs:gen` only.

## Proposed commit
Phase 1: `feat(open): the day's first-open stamp and the 자동 실행 routine guide; the worker's push handler shares showCheck; two E2E fixes`
Phase 2: `feat(push): a contentless daily Web Push from the repository's cron — the 푸시 알림 switch, tools/push/send.mjs, notify.yml (phase 2)`
Phase 3: `docs: the routine guide, the first-open stamp and the daily push — Rule 7 amendment, security, reliability, decisions`
