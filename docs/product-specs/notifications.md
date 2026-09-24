# The `확인 필요` notification

Added 2026-09-22 (schema stays v28, no migration — [decision log](../design-docs/decision-log.md)). A local
notification, off by default, that lists three facts the app already knows from its own state: whether today's
work was refreshed, which past project appointments have no meeting minutes, and which work items are carried
over. No network, no AI, no push server — the app decides everything from `state` and mirrors the rendered text
into the Cache API so the service worker can re-show it without reading `localStorage`
([Rule 7](../design-docs/core-beliefs.md#rule-7), [Rule 9](../design-docs/core-beliefs.md#rule-9)). Tapping it
opens the [이슈 목록](issue-list.md) screen, where all three facts live in full.

## What it is, and is not

Not a reminder the user sets, not a per-item alert, not a schedule notification of any kind — one notification,
re-rendered from scratch on every open and, once installed, on Chrome's own periodic sync schedule. Nothing about
its three facts is judged or summarised by an AI; every string is a count, a date or a title
([Rule 13](../design-docs/core-beliefs.md#rule-13)). The only state it ever writes is the settings switch itself,
`settings.checkNotify` — the Cache API entry is a rebuildable mirror, never read back into `state`
([Rule 9](../design-docs/core-beliefs.md#rule-9)).

## The three facts — `checkSummaryOf(state, today)`

Pure, module-level, derived at render, in the Daily assistant region after `readerSince`. Constants above it:
`CHECK_MINUTES_DAYS = 14`, `CHECK_LIST_MAX = 3` (names per body line before `외 {n}건`), `CHECK_TAG =
"life-check"` (the notification tag and the periodic-sync tag), `CHECK_CACHE = "life-check"` (the Cache API cache
the worker keeps across builds), `CHECK_CACHE_REQ = "./__check-summary"` (relative, so a subpath deploy and a
root deploy resolve the same entry), `CHECK_STALE_MS = 48 × 3600 × 1000` (an entry older than this no longer
suppresses a re-alert — the worker shows generic text past it), `CHECK_SYNC_MIN_MS = 12 × 3600 × 1000` (the
floor asked of Chrome), `CHECK_DEBOUNCE_MS = 1500` (a burst of edits writes the entry once).

Returns:
```
{ date: today,
  notRefreshed: string | null,   // "오늘 만든 업무 없음", "오늘 읽을 것 안 봄", or both joined by " · "; null when refreshed
  workRefreshedAt: string | null, // act.workRefreshedAt (the incremental work packet's stamp) or null
  minutesMissing: [{ date, title, eventId }],   // newest first, uncapped
  carried: [{ id, date, title }],               // workOn's carried order (oldest first), uncapped
  counts: { notRefreshed: 0 | 1, minutes: n, carried: n, total } }
```

- **`notRefreshed`** — reason 1 (`오늘 만든 업무 없음`) when no `work[]` item has `createdAt === today`; reason 2
  (`오늘 읽을 것 안 봄`) when `act.briefingSeen !== today`; both, joined ` · `, when neither ran today.
- **`minutesMissing`** — for every event with `kind === "appt"`, every occurrence in
  `[today − 14, today − 1]` whose `eventProjectOf(state, ev)` is non-null (a project appointment, matched by the
  event's own `projectId` or the title-match fallback [meetings.md](meetings.md) already uses) and for which no
  meeting has `m.eventId === ev.id && m.date === occurrence`. `doneDates` is ignored on purpose — a done
  appointment is exactly one that happened and should have minutes. All tracks: the notification never leaves the
  device, so `packetTracks` does not apply to it (the day-job AI switch is about outgoing packets only).
- **`carried`** — `workOn(state, today, today).filter((w) => w.date < today)`, the same set and order the `업무`
  tab's carried rows show.
- **`counts.total`** — the number of body lines, stated in the title as `{n}가지`.

## The rendered text — `checkNotificationOf(summary)`

Pure, right after `checkSummaryOf`. Returns `null` when `counts.total === 0` (every count-only, so an empty
summary shows no notification and clears the cache entry and any shown notification — see below). Otherwise:

- **Title**: `인생 관리 — 확인 필요 {counts.total}가지`.
- **Body**, one line per non-empty fact, joined `\n`:
  - `오늘 할 일 미갱신 · {notRefreshed}` — appends ` · AI 갱신 {workRefreshedAt}` only when the [incremental work
    packet](daily-work.md#오늘-업무-만들기와-주간-회고--workbridgemodal-generalised-v28)'s stamp exists — a fact
    the user can see, changing nothing about the definition of "refreshed".
  - `회의록 없는 지난 일정 {n}건: {M}/{D} {title} · {M}/{D} {title} · {M}/{D} {title} 외 {k}건` — the first
    `CHECK_LIST_MAX` (3) rows, month/day with no leading zeros, then the remainder count when more exist.
  - `이월 업무 {n}건: {title} · {title} · {title} 외 {k}건` — same cap and remainder shape, titles only.
- **`counts`** carried alongside (`{ notRefreshed, minutes, carried }`) for the `renotify` comparison below.

## The setting — `settings.checkNotify?`

Optional boolean, absent reads as **off** (`checkNotifyOf(state) = state?.settings?.checkNotify === true`). No
other field is stored for this feature — no last-shown time, no counts, no cached summary in `state`; the Cache
API entry (below) is the mirror, and it is not state.

`SettingsModal` gains a section between `AI 요청문` and `데이터 — 백업 · 초기화`: `SectionLabel` `확인 알림`, a
checkbox row `확인 필요 알림` (`checked={checkNotifyOf(state)}`), then:
- a capability caption from a `caps` state the sheet fills on mount (`Notification` in `window` and
  `serviceWorker` in `navigator`, plus a registered worker and, for the periodic-sync half,
  `navigator.permissions.query({ name: "periodic-background-sync" })` reading `"granted"` — desktop Chrome
  exposes `periodicSync` on every registration but grants the permission to an installed app only, so both are
  read; the single-file demo and the dev server have no registered worker, so `caps.api` is false there too):
  `이 브라우저에서는 알림을 쓸 수 없어요` (checkbox disabled) when the app cannot use the APIs at all, else
  `설치된 앱에서만 주기 갱신이 돼요` when only periodic sync is unavailable.
- a refusal notice, shown only after a refused `Notification.requestPermission()` in this sheet (component
  state, never stored): `알림 권한이 꺼져 있어요 — 폰 설정에서 허용해요`.
- the fact caption (always shown): `켜면 앱을 열 때마다 세 가지를 확인해 알림 하나로 보여줘요 — 오늘 할 일
  미갱신, 회의록 없는 지난 일정(14일), 이월 업무. 내용은 이 기기에만 있어요. Android는 잠금 화면에 제목이
  보일 수 있어요. 앱을 닫아 둔 동안은 Chrome이 약 12시간마다 한 번까지만 갱신하고, 시점은 Chrome이 정해요.`

**Root handler `setCheckNotify(on)`** — writes `settings` only:
- **off** → `settings.checkNotify = false`, toast `확인 필요 알림 꺼짐`, then teardown (below).
- **on** → `Notification.requestPermission()` (guarded; a rejected promise or anything but `"granted"` counts as
  refused, returning `"denied"` and writing nothing — the sheet then shows the refusal notice and the checkbox
  stays unchecked); granted → `settings.checkNotify = true`, toast `확인 필요 알림 켜짐`, then
  `checkSyncRegister()` (below) — the refresh effect itself runs from the state change, not from this handler.

## The page-side refresh

One root `useEffect` on `[state, today]`, debounced `CHECK_DEBOUNCE_MS` (a burst of edits writes the entry once),
skipped before the boot load finishes. Every browser call is guarded (`typeof`/`?.`/`try`) and never throws into
React:
1. `!checkNotifyOf(state)` → return (teardown is `setCheckNotify`'s job, not this effect's).
2. `Notification.permission !== "granted"` or no registered worker (`getRegistration()` returns null) → return —
   covers a switch left on from an earlier session on a device that has since lost the worker.
3. Build `checkNotificationOf(checkSummaryOf(state, today))`.
4. Read the previous cache entry (`caches.open(CHECK_CACHE)` → `match(CHECK_CACHE_REQ)` → `.json()`, or `null`).
5. **Nothing to state** (`text === null`): delete the cache entry and close every notification carrying
   `CHECK_TAG` (`reg.getNotifications({ tag: CHECK_TAG })`), then return.
6. **Otherwise**: write `{ title, body, counts, ts: Date.now() }` to the cache entry, then
   `reg.showNotification(text.title, { body: text.body, tag: CHECK_TAG, data: { open: "issues" }, icon:
   "./icons/icon-192.png", renotify })`. `renotify` compares the new `counts` against the **previous** entry's
   `counts` (read before the write) — a re-render with the same facts never buzzes the phone again; an entry
   older than `CHECK_STALE_MS` (48 h — the worker may have shown its generic pair meanwhile) always renotifies.

## Periodic sync registration and teardown

Both module-level, root-level helpers, all guarded:
- **`checkSyncRegister()`** — `reg.periodicSync.register(CHECK_TAG, { minInterval: CHECK_SYNC_MIN_MS })` in a
  `try`; Chrome refuses outside an installed app, silently — the settings caption already states this. Called
  after a granted switch-on and once at boot when `checkNotifyOf(state)` is true and permission is already
  granted (idempotent).
- **`checkNotifyTeardown()`** — unregisters the periodic sync, closes every tagged notification, deletes the
  `life-check` cache. Called from `setCheckNotify(false)` only.

## The service worker

`tools/harness/gen-sw.js`'s `swSource` template repeats the app's `CHECK_*` literals (the worker is a plain
string and imports nothing; a smoke check pins the two sets to agree):
```js
const CHECK_CACHE = "life-check";
const CHECK_REQ = "./__check-summary";
const CHECK_TAG = "life-check";
const CHECK_STALE_MS = 48 * 3600 * 1000;
const CHECK_ICON = "./icons/icon-192.png";
```
- **`activate`** keeps the `life-check` cache across builds: `if (k !== CACHE && k !== CHECK_CACHE) await
  caches.delete(k);` — the summary cache belongs to the app, not to a build; without this exception every deploy
  would evict it. The precache list and the fetch handler are unchanged.
- **`notificationclick`** — closes the notification, then focuses an open client and posts
  `{ open: "issues" }` to it (`clients.matchAll({ type: "window", includeUncontrolled: true })`, take the first);
  with no open client, `clients.openWindow("./?open=issues")`.
- **`periodicsync`** — ignores any tag but `CHECK_TAG`; reads the cached entry, and when it exists and is younger
  than `CHECK_STALE_MS` re-shows its own title/body, else shows a generic pair (`인생 관리 — 오늘 읽을 것을
  확인해요` / `앱을 열면 목록이 갱신돼요`) — no `renotify`, since Chrome decides when the sync fires and the same
  tag replaces the shown notification silently either way.
- **No reload, ever** — unchanged from the 2026-09-13 decision
  ([install-and-backup.md](install-and-backup.md#the-service-worker)): neither handler calls
  `location.reload()` or reacts to `controllerchange`.

## Boot param and the in-app message

`OPEN_PARAM_TYPES = ["issues", "reader"]` — the only `modal.type` values the boot param and the service worker's
message may name. At boot, after the phase settles to `main`, the root reads `?open=` from the URL; when it
names one of the two types, `setModal({ type })` opens it regardless of `act.briefingSeen`, and
`history.replaceState` strips the query so a reload does not reopen it. A second effect listens on
`navigator.serviceWorker`'s `message` event and opens the same way when the worker posts `{ open: "issues" }` (a
tap on the notification while the app is already open, the `notificationclick` path above). `reader` is kept as
a second accepted value so a notification shown before this screen existed still lands somewhere sensible.

**With the [daily gate](daily-gate.md) active (2026-09-24):** this routing is unchanged code, but both accepted
types are in `GATE_MODAL_TYPES`, so the call opens the named screen **in gate-read mode, above the gate** instead
of over `<main>` — a tap on the notification before today's gate is passed lands on the gate's own read step,
not on a bare reader or issue list floating over a hidden app.

## What the notification never does

- No network request of its own — Periodic Background Sync wakes the worker, which reads the cache and shows a
  notification; nothing is fetched, sent or synced to a server ([Rule 7](../design-docs/core-beliefs.md#rule-7),
  [SECURITY.md](../SECURITY.md#tracks--the-day-job-switch-2026-09-22)).
- No AI, no judgement — every line is a count, a date or a title read straight from `state`
  ([Rule 13](../design-docs/core-beliefs.md#rule-13)).
- Writes no state beyond `settings.checkNotify` — the Cache API entry is a rebuildable mirror, not a save
  ([Rule 9](../design-docs/core-beliefs.md#rule-9)).
- Applies no track filter — the notification is on-device only, so `packetTracks`/`workInAiOf` (the AI-packet
  day-job switch) do not apply to it.
- Never reloads the page, in either service-worker handler.
- Completes nothing, ticks nothing, promotes nothing — tapping it only opens [이슈 목록](issue-list.md).

## E2E coverage (written, not run — standing user instruction)

`tools/e2e/flow6.js` adds three steps before `the app opens with the network disabled` (they need the worker
controlling the page): the switch writes `settings.checkNotify` only and, with `notifications` permission
granted, the `life-check` cache entry matches the expected title/body shape and its `ts` advances, then unticking
clears the entry (the number of notifications `getNotifications({ tag: "life-check" })` reports is logged, not
asserted — headless Chrome may not surface them); a denied permission leaves the switch off and writes nothing,
showing the refusal notice; `?open=issues` opens the issue list, `?open=reader` opens the reader, both strip the
query, and the served `sw.js` carries `periodicsync`, `notificationclick`, `k !== CHECK_CACHE` and no reload. See
[tools/e2e/README.md](../../tools/e2e/README.md) for the exact step count.
