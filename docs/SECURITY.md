# Security

Life Manager is a local-only, single-user web app with no backend and no accounts. The production build makes no network call of its own; since 2026-09-25 there is one narrow exception, entirely under the user's own hand — the app's own repository sends a contentless daily Web Push to a subscription the user copies into a repository secret ("The daily push", below). The threat model is small; the notes below record what is stored, what could leave the device, and what the harness may execute.

## Data at rest
- All state lives in the browser's `localStorage` of the origin the app is served from (`liferpg-state-v1` and `liferpg-img-*`). Anyone with access to the browser profile can read it. There is no encryption; the app does not promise confidentiality beyond the device.
- Since schema v21 (2026-09-13), `profile` holds a real name, an exact birth date, and optional e-mail and phone, alongside the education (`edus[]`: school, department, degree, dates) and career (`careers[]`: company, role, dates) records the `프로필` screen collects and edits. These are personal facts by definition. They sit in the same unencrypted `liferpg-state-v1` key as everything else, with no separate handling — the "no confidentiality beyond the device" statement above covers them exactly as it covers the rest of the save.
- Evidence photos (certificates, score reports, study artifacts, profile picture) are stored as resized data URLs. These may contain personal identifiers (name, ID numbers on certificates). They are deleted with the task (`removeTask`) and on full reset (`resetAll`); they are never uploaded anywhere.
- Since schema v23 (2026-09-16), `meetingProjects[]` and `meetings[]` hold hand-written or pasted meeting minutes — titles, attendee names, a summary, decisions and follow-up actions ([product-specs/meetings.md](product-specs/meetings.md)). This may name real clients and record what they said. It sits in the same unencrypted `liferpg-state-v1` key as everything else, with no separate handling — as sensitive as the device, exactly like the rest of the save. Nothing here is generated or transcribed by the app; the user types or pastes it. Since schema v25 (2026-09-17), each meeting also carries `progress[]` (dated entries of the work that followed) and `aiHidden` (a boolean the user sets per meeting); since schema v26 (2026-09-17), each meeting also carries `followUps[]` — structured follow-up items (an owner flag, an optional due date, a done state, and the text itself), the same class of data as the free-text follow-up actions it sits beside; `work[]` holds dated work items — typed by hand, proposed by the assistant bridge and confirmed per item, or mirrored from a `mine` follow-up (`source: "meeting"`) — with an optional title, note and a reference link to a goal, meeting or project ([product-specs/daily-work.md](product-specs/daily-work.md)). All of it sits in the same unencrypted key, at the same sensitivity as the rest of the save.
- Since 2026-09-17, a meeting may also carry `projectId: null` (an urgent memo with no project, listed under `프로젝트 없음 · 긴급 메모`) and `transcript` — a verbatim pasted transcription of up to 30,000 characters, possibly of a third party's own words, likely **the most sensitive free text the app holds**. It sits in the same `transcript` key on the same unencrypted meeting record, with no separate handling or encryption of its own — as sensitive as the rest of the save, exactly like the summary it sits beside. Nothing about it is generated, recorded or transcribed by the app; the user pastes text they transcribed themselves. It is deleted with the meeting (`removeMeeting`), on its own through `녹취록 지우기` (`clearTranscript`, which removes only that key), and on full reset (`resetAll`); it travels in the backup file exactly as every other field does (below).
- The single-file demo (`release/life-demo.html`) opened from `file://` has its own origin and storage; it contains no user data at build time — `demoState`'s profile is entirely synthetic (a placeholder name, a birth date computed from the build date, no e-mail or phone), so sharing a demo build cannot leak a real person's CV ([demo-data.md](design-docs/demo-data.md)).
- Since schema v27 (2026-09-17), `documents[]` holds top-level document summaries — up to 5,000 characters of a
  third party's document, in the user's own words, attached to a meeting project or to none — and `events[].checks`
  holds a pre-meeting checklist per event, at most 30 items of 200 characters. Neither is a file: no file upload
  or file content is ever stored, only the summary text and, optionally, a file name or link as text (`source`).
  Both sit in the same unencrypted `liferpg-state-v1` key as everything else, with no separate handling.
- Since 2026-09-24 (no schema bump): `act.gate?` holds the daily gate's own user-action stamps — `HH:MM` local
  times for the read/pass moments and a locally graded quiz score (`{ total, score, passed, attempts, at }`),
  keyed by date, pruned to the newest 60 days on the app's own write. None of it is free text of any kind — no
  question, choice or reply is ever stored, only the numbers a local comparison produced. It sits in the same
  unencrypted `liferpg-state-v1` key as everything else, with no separate handling. See
  [product-specs/daily-gate.md](product-specs/daily-gate.md).
- Since schema v28 (2026-09-17/18): `leads[]` holds a hospital sales pipeline — a name, a contact string, a
  next-action description and note, up to 400 characters each, which may name a real person's role and a
  hospital; `notices[]` holds national-project notice titles, agencies and notes; `deals[].payments` holds
  lump-sum amounts and dates; `role.stages` holds the user's own stage names and fact-condition arguments (which
  may include a client-name substring or a certification name); `milestones[]` and `timeLog[]` hold roadmap and
  time-tracking records with no personal-identifier field of their own. Every project, document, event, work
  item, memo and deal also carries a `track` (`직장`/`사업`/`개인`) — see "Tracks" below. All of it sits in the
  same unencrypted `liferpg-state-v1` key, with no separate handling.
- Since 2026-09-25 (no schema bump): `act.opened?` holds the day's first-open stamp — one `HH:MM` per date,
  pruned to the newest 60 days on the app's own write, a record of a user action only, never progress
  ([Rule 9](design-docs/core-beliefs.md#rule-9)). `settings.pushNotify?` is a boolean, absent = off, the daily
  Web Push switch; it is written `true` only once a browser push subscription exists. The subscription itself —
  an opaque `endpoint` and two keys — is **never** written here: it lives only in the browser's `pushManager`
  and in `SettingsModal`'s own component state, read back with `pushSubscriptionGet()` whenever the sheet needs
  it, so it is absent from both the raw `localStorage` string and the backup file. Both fields sit in the same
  unencrypted `liferpg-state-v1` key as everything else, with no separate handling. See "The daily push" below
  and [product-specs/notifications.md](product-specs/notifications.md#the-daily-push-2026-09-25).

## The `확인 필요` notification (2026-09-22)

`settings.checkNotify` (optional, absent = off) is the only new state field; the notification's own text is
never stored in `state` — it is derived at render (`checkSummaryOf`/`checkNotificationOf`) and mirrored into one
Cache API entry, `life-check` (request `./__check-summary`), so the service worker — which cannot read
`localStorage` — can re-show it on Chrome's own Periodic Background Sync. The entry holds `{ title, body,
counts, ts }`: meeting and work item **titles** (from the carried-work and missing-minutes lists), never a
summary, a decision, a transcript or a profile identifier. It is rebuilt on every open, deleted when the switch
is turned off, and may be evicted by the browser at any time with no consequence
([Rule 9](design-docs/core-beliefs.md#rule-9)) — the app rebuilds it on the next open regardless. See
[product-specs/notifications.md](product-specs/notifications.md).

**Data in transit: the notification's own re-display is still local.** Whether it is Periodic Background Sync or
the daily push below that wakes the service worker, the handler itself makes no request of its own — it only
reads the Cache API entry the page already wrote and calls `showNotification`. **Android may show the
notification's title and body on the lock screen** while the phone is locked — the settings caption states this
explicitly before either switch is turned on (`Android는 잠금 화면에 제목이 보일 수 있어요.`). The notification's
`data.open` value (`"issues"`) and the tap routing it drives are the only other facts it carries; tapping it
opens the on-device [`이슈 목록`](product-specs/issue-list.md) screen, itself making no network call.

- Since 2026-09-22: `meetings[].kind?` (`"training"`, absent = a meeting) reuses every meeting field under
  different labels — a training record carries no field a meeting record does not already carry, so it adds no
  new sensitivity of its own, only a different set of labels on the same unencrypted key. `act.workRefreshedAt?`
  (a date) is a user-action stamp, not free text.

## The daily push (2026-09-25)

The app's own repository (`.github/workflows/notify.yml`, cron `0 23 * * *` and `0 11 * * *` UTC — 08:00 and
20:00 Asia/Seoul — plus `workflow_dispatch`, `permissions: contents: read` only) sends one **contentless** Web
Push a day through `tools/push/send.mjs`. What leaves the device, once, by the user's own hand: the push
subscription — an opaque `endpoint` and two keys (`keys.p256dh`, `keys.auth`) — shown in `설정 › 푸시 알림`
behind `구독 정보 보기 ›` and pasted by the user into the repository secret `PUSH_SUBSCRIPTION`; the private
signing key (`VAPID_PRIVATE_KEY`) the user pastes into a second secret, which never touches the repository, a
commit, a log, or this app's own storage — the app carries the matching **public** key only
(`PUSH_VAPID_PUBLIC`), which is public by design. The subscription itself is never written to `state`, so it is
absent from the backup file too — it lives only in the browser's `pushManager`, read back by
`pushSubscriptionGet()` when the settings sheet needs it. `send.mjs` prints status codes only — `sent (201)`,
`secrets not set — nothing sent`, `failed (…)`, or, on a 404/410, `subscription expired — copy it again from the
app` — and never the endpoint, the keys, a response body or a stack, because the repository and its Actions
logs are public (smoke section 7(f) pins this with a regex over every `console.` call in the file). The push
payload it sends, `{ "open": "issues" }`, carries no record, title or identifier, and the service worker's
`push` handler never reads it — it shows the `확인 필요` text the page already mirrored into the `life-check`
cache (or the generic pair), through the same `showCheck` the periodic-sync path uses. See
[product-specs/notifications.md](product-specs/notifications.md#the-daily-push-2026-09-25) for the switch and
every string, and [RELIABILITY.md](RELIABILITY.md#known-limits) for delivery limits.

## Tracks — the day-job switch (2026-09-22)

Every project, document, event, work item and deal carries a `track` (a project meeting derives its own from
its project; a project-less memo carries its own field); the safe default is `"work"` (the day job). Whether a
`직장`-track record enters an AI packet is now a settings switch, **`settings.workInAi`, on by default**
(absent reads as `true`; no schema migration, still v28) — `직장 기록을 AI 요청문에 포함` in `설정 › AI 요청문`.
`packetTracks(state)` (`workInAiOf(state) ? TRACKS : PACKET_TRACKS_NO_WORK`) is the single source every packet
reads: `TRACKS = ["work", "biz", "personal"]` while the switch is on, `PACKET_TRACKS_NO_WORK = ["biz",
"personal"]` while it is off. **With the switch on (the default), a `직장`-track record goes into every one of
the five AI packets that would otherwise carry it** — the daily check-in, `오늘 업무 만들기`, `AI에게 회의 준비 묻기`,
and (through the count-only fields it touches) `AI에게 판정 묻기`; `주간 회고` stays business-track only regardless
of the switch, by scope, not by the filter (below). **With the switch off, a `직장`-track record never leaves the
device through any of the five AI packets**, exactly as it did before this switch existed: the meeting-prep card
states everything about a day-job event on-device (project name, last meeting, follow-ups, progress) but replaces
its `AI에게 회의 준비 묻기` button with the line `직장 트랙 — AI 패킷에 실리지 않아요`, and every form's track-row caption
(`직장 트랙은 AI 패킷에 실리지 않아요.`) reappears. There is **no per-record override**: the switch is the only control,
global, not per meeting or per event — the app still gives the user no "send this one only" toggle
([TD-73](exec-plans/tech-debt-tracker.md), backlog if the user asks). The per-meeting `AI에 보내지 않기` flag
(`aiHidden`), the transcript exclusion and the profile-identifier exclusions apply unconditionally, in both
states of the switch. The calendar file (below) is the one surface that always includes every track regardless
of the switch, because the phone calendar is the user's own device, not an external chat.

Reasoning for the default ([decision-log](design-docs/decision-log.md), 2026-09-22): since schema v28 backfilled
every existing record to the `work` track, the v28 default silently excluded exactly the records — day-job
meetings, work items, schedule — that `AI로 만들기` on the `업무` tab exists to summarise; the switch defaults
on so the feature works out of the box, and a user who must keep a specific day's company data off the clipboard
turns it off for that session.

## Data in transit
The production build makes no fetch/XHR of its own; fonts and icons are bundled; manifest and favicon are
inline/static. Since 2026-09-25 there are exactly two contacts with anything outside the device, both under the
user's own hand or the browser's own push service, never the app fetching or polling anything: (1) turning
`매일 푸시 알림` on registers the subscription with the browser's push service (`pushManager.subscribe`), and (2)
the repository's cron delivers the contentless wake-up to that subscription twice a day ("The daily push",
above). Nothing about the user's records — no title, no name, no state — is ever in either contact; what
crosses is the opaque subscription (copied by hand into a secret) and the fixed payload `{ "open": "issues" }`.
The calendar export ("The calendar file", below) is the one other place item titles leave the app, through a
file the user hands to their own calendar app.

The assistant bridge carries **six** packets, all text, all copy/paste only, all making no network call ([Rule 7](design-docs/core-beliefs.md#rule-7)):

- **The daily check-in** (`AI에게 보내기`, `buildAssistantPacket`): goals, open tasks, the last seven journal entries, the last weekly review, the streak and the role-model's stage line (`단계 k/n · 조건 c/m`, or `단계 없음`/미설정 — no percentage since the [Rule 14](design-docs/core-beliefs.md#rule-14) amendment of 2026-09-18), and, since schema v21, one `## 이력` line stating degree, department/field, total months of practice and the most recent role — into a textarea and the clipboard; never photos. It never carries a meeting or a work item: `buildAssistantPacket` does not read `meetingProjects`, `meetings` or `work` ([product-specs/meetings.md](product-specs/meetings.md)). The reply the user pastes back is stored as text in `journal[].ai` and rendered as text; it can only propose tasks, never change a score.
- **`오늘 업무 만들기`** (`buildWorkPacket`, schema v25, 2026-09-17): the same goals/tasks/schedule/business facts, plus what the daily packet never carries — the newest meeting minutes (summary, decisions) and their progress entries, and every undone work item carried into today plus yesterday's and today's own items, so the assistant does not repeat a proposal. Since schema v26 (2026-09-17), each visible meeting's follow-up items are also stated in full — owner flag, due date, done state and text, one line per item (open ones first). This is the user's own decision, reversing the 2026-09-16 default that the packet never reads a meeting: **every meeting is included by default**, except one flagged `aiHidden` (a per-meeting checkbox in `MeetingModal`, `AI에 보내지 않기`), whose line states only its date and title — no summary, decisions, follow-ups, progress, or project name (unchanged by v26). A project-less urgent memo (2026-09-17) is included the same way, printing `[프로젝트 없음]` in place of a project name. The reply's `work` array is read by `parseWorkReply`; each proposal becomes a work item, `source: "ai"`, only once the user ticks it in the confirm view. The raw reply is never stored (unlike the daily packet's `journal[].ai`). Since 2026-09-22, once `act.workRefreshedAt` exists the send pane offers a `지난 갱신 이후` chip that carries **less**, not more, than the default: only meetings, progress and documents dated on or after the stamp, plus older meetings' qualifying progress/follow-up lines — the same exclusions (no `transcript`, no profile identifier, `aiHidden` honoured) apply in both modes; `전체` restores the byte-identical full packet. A training record (2026-09-22) states the same fields as a meeting under different labels and is subject to the identical exclusions.
- **`AI에게 회의 준비 묻기`** (`buildPrepPacket`, schema v27, 2026-09-17): built for one schedule event that belongs to a meeting project — the event line, the project's newest meetings (a hidden one contributing date and title only), the project's document title and summary (never `source`), the open tasks those meetings link, the contracts of the same client when derivable, and the event's existing checks so they are not re-proposed. **Never** the profile identifiers, a transcript, an event's `place`/`note`, or a document's `source`. While the day-job switch (above) is off, a document or a contract on the `직장` track is filtered out even when the event's own track is on a packet track, and an event on the `직장` track produces only `## 회의` with the line `직장 트랙 일정 — AI 패킷에 실리지 않아요` in place of everything else; while the switch is on (the default), a day-job event's project, meetings, documents and contracts are stated the same way a business-track event's are. The reply's `checks` array is read by `parsePrepReply`; each proposal becomes a check item, `source: "ai"`, only once ticked. The raw reply is never stored. See [design-docs/assistant-bridge.md](design-docs/assistant-bridge.md) (the third packet) and `tools/e2e/flow11.js` for the proof that the exclusions hold in both states of the switch.
- **`주간 회고`** (`buildReviewPacket`, schema v28, 2026-09-18): opened from `ReviewModal`'s `AI에게 회고 묻기 ›`
  button, enabled only once the current week's review is saved, so it always reads the **stored** review, never
  a draft. Business track (`사업`) of the current week only, by the function's own scope (every filter tests
  `=== "biz"` directly) — **unaffected by the day-job switch above, in either state**: the week's completed and
  open work items and open follow-ups of non-hidden business meetings, the roadmap (open milestones on the
  business track, by `milestoneTrack`), the sales pipeline, open notices, unpaid and paid lump-sum payment lines
  of business-track deals, and the saved review's `잘된 것`/`막힌 것` text. **Never** the day-job or private track, a transcript,
  a profile identifier, or `## 이력`. Its reply is read by the **unchanged** `parseWorkReply` (the same `work`
  key `오늘 업무 만들기` reads); confirming registers next Monday's business work items through the same
  `importWork` path, now generalised to take a date and a track. No new stored key, no network call — this
  needed no [Rule 7](design-docs/core-beliefs.md#rule-7) amendment.
- **`AI에게 판정 묻기`** (`buildRoleVerdictPacket`, 2026-09-18): the **only packet that carries user-written free
  text** — `role.story`, the `원하는 모습` the user types, sent verbatim. The caption warning this explicitly
  (`여기 적은 글은 그대로 AI 패킷에 실려요 — 이름·연락처는 적지 않아요.`) lived on `RoleModelModal` that day and now
  lives on the `롤모델` screen's `원하는 모습` section (`RoleModal`, since the role-screen rewrite a few hours
  later the same day) and `RoleVerdictModal`'s send caption repeats it; the app itself never appends an
  identifier to the story — the only fields it adds around
  the story are the CV line, area grades and requirements, held certifications and exam bests, record
  counts (deals and milestones filtered by `packetTracks(state)` — every track while the day-job switch above is
  on, business/private only while it is off; portfolio, leads and notices carry no track
  and are counted whole — counts only, never a name, [TD-78](exec-plans/tech-debt-tracker.md)), the current
  stages' condition values, and the last verdict's own text. **Never** `profile.name`, `birth`, `email`,
  `phone`, a school or an employer, a client or lead name, or a transcript; a day-job record's own name/text
  never enters either — only its count, and only while the switch is on. The reply's
  `verdict`/`stages`/`areas`/`note` keys are read by `parseRoleVerdictReply`; a stage or an area change is
  written only once the user ticks it, and the verdict (summary, basis, position, gaps — **no probability**,
  retired 2026-09-18, third change of the day, [Rule 14](design-docs/core-beliefs.md#rule-14) amendment) is
  stored clipped, labelled `AI 판단 · 검증되지 않음` — the raw reply itself is never stored; a `probability` key
  a reply still carries is ignored, not inspected, and a `probability` value already stored on an older verdict
  is left in the save, simply unread. See
  [design-docs/assistant-bridge.md](design-docs/assistant-bridge.md#the-fifth-packet--ai에게-판정-묻기).
- **`오늘의 관문 퀴즈`** (`buildQuizPacket`, 2026-09-24): built for the [daily gate](product-specs/daily-gate.md) —
  the full-screen layer that opens once a day until the user reads both `오늘 읽을 것` and `이슈 목록` to their
  end, passes a quiz on that content and refreshes today's work. Carries exactly the content those two screens
  state that day, on the packet tracks: today's and tomorrow's meeting preparation, the open work items, the
  two-week schedule, the last seven days' decisions, the minutes (since-mode when `act.workRefreshedAt` exists),
  the newest training records as content, and the documents. **Never** `profile.name`, `birth`, `email`, `phone`,
  a school or an employer name (no `## 이력` line at all, like the prep packet), a transcript, an event's
  `place`/`note`, or a document's `source`; a hidden meeting contributes its date and title only. Capped at
  12,000 characters. The reply's `quiz` array is read by `parseQuizReply` — `tasks`, `work`, `checks`, `verdict`
  or any other key is ignored — and graded **locally**, on the device, never by a network call: `gradeQuiz`
  compares the user's own picks against the parsed `answer` index and stores only the resulting score
  (`act.gate[date].quiz = { total, score, passed, attempts, at }`), never the questions, the choices or the raw
  reply. See [design-docs/assistant-bridge.md](design-docs/assistant-bridge.md#the-sixth-packet--오늘의-관문-퀴즈).

**The work packet never carries `transcript`; neither does the daily packet, the calendar file or the prep card** (2026-09-17) — a meeting's optional pasted transcript (up to 30,000 characters, [product-specs/meetings.md](product-specs/meetings.md)) is read only by `MeetingModal`, `MeetingViewModal`, `clearTranscript` and `recordFits` (which measures the whole record's string length, transcript included, against the storage budget, never inspecting its content); `buildWorkPacket`, `buildAssistantPacket`, `calendarExportOf`/`buildIcs` and `meetingPrepOf` never read the key. `tools/e2e/flow11.js`'s sentinel step (`the work packet states a memo under the no-project head and carries none of its transcript`) plants a marker string inside a transcript and asserts it is absent from the built packet text.

Both packets share the same CV line (`cvSummaryOf`, built from `topEdu` / `latestCareer`) and it is deliberately the only place the CV is summarised for an outside reader: neither packet ever carries `profile.name`, the birth date, the e-mail, the phone number, the school name or the employer name — a school or an employer identifies a person nearly as well as a name does. Neither carries a photo, evidence text, or a journal entry (the journal line is the daily packet's own domain). Copying either packet is a user action, and pasting it into a third-party chat puts that text outside this threat model. `tools/e2e/flow11.js` asserts the work packet excludes every one of those identifying fields, and excludes a hidden meeting's summary and project name, the same way `flow8.js` proves it for the daily packet.

## The backup file

**Since 2026-09-24, backup export and import sit behind the [daily gate](product-specs/daily-gate.md).**
`SettingsModal` (where both live) is not one of the gate's own reachable sheets (`GATE_MODAL_TYPES`), so a user
who has not yet passed today's gate cannot reach `백업 내보내기`, `백업 불러오기` or `데이터 초기화` either — a
direct, accepted consequence of the gate having no close, no skip and no settings access while it stands (the
user's own decision 2, 2026-09-24; see [RELIABILITY.md](RELIABILITY.md#known-limits)).

`백업 내보내기` writes the whole save — profile (including the exact name, birth date, optional e-mail/phone and every education and career record since schema v21), goals, tasks, achievements, meeting minutes since schema v23 (project names, attendees, summaries, decisions and actions), each meeting's progress log and `AI 전송` flag and every work item since schema v25, each meeting's structured follow-up items since schema v26, and every evidence photo — to a JSON file the user chooses where to keep. Since 2026-09-17, a meeting's `transcript` — up to 30,000 characters, the most sensitive free text the app holds — and a project-less memo's `projectId: null` travel in this file the same way: no separate handling, no encryption, exported and imported exactly like every other field. Since schema v28 (2026-09-17/18), every record's `track`, the four new arrays (`milestones`, `timeLog`, `leads`, `notices` — hospital contact strings and next-action text included) and `settings.bizHoursPerWeek` travel the same way, with no code of their own — the whole state is one JSON tree. Since 2026-09-18, `role.story` (the user's own written text, sent verbatim in the fifth packet) and `role.verdicts` (the dated AI-stated summaries, never the raw reply) travel the same way too — the same "one JSON tree, no separate handling" rule as everything above. Carrying the CV, the minutes and the work items here is correct and unchanged from how every other field has always been handled: the file is local, it is the only way back from a cleared browser, and the file is as sensitive as the device itself — once it is in a downloads folder, a cloud-synced directory or a chat, it is outside this threat model. Import replaces the current records and asks for confirmation naming the export date first.

## The calendar file
`캘린더로 내보내기` (일정 tab) writes `life-manager-calendar-{date}.ics`: a snapshot of dated **item titles** —
event titles, dated-task titles, the daily-task digest, goal-deadline titles, and a task's linked goal title
inside its own description line — and their dates, built in memory and handed to the browser exactly like the
backup file. Since schema v28 it also carries: an open meeting follow-up's due date and text (never the
minutes); an open pre-meeting check reminder the day before its occurrence (the check text, never the
project); a roadmap milestone's due day and its D-7 (the title only — never progress or pace); an unpaid
contract payment line's due day, kind and client/title — **the amount is never written, on any calendar
entry, ever**; and an open national-project notice's deadline, title and agency. **Every track is included** —
the phone calendar is the user's own device and already carries day-job event titles, so the calendar file does
not apply the `packetTracks` filter the five AI packets do, and is unaffected by the day-job switch above. Mechanics:
[design-docs/calendar-export.md](design-docs/calendar-export.md); the sheet:
[product-specs/schedule.md](product-specs/schedule.md).

Importing the file is the user's own action, and it carries those titles **out of the app sandbox into
whatever calendar the user imports it into**: a calendar tied to a synced account (a Google account, for
example) stores the imported titles on that provider's servers — outside this app's threat model the moment the
import happens, exactly as pasting the assistant packet into a third-party chat is (above). The app makes this
explicit in the export sheet itself before anything is exported, and it still makes no network call of its own
to produce or send the file — the request, if any, is the calendar app's, after import, not this app's.

**What it never carries**: `profile` / the CV (name, birth date, e-mail, phone, school and employer names),
portfolio, unit prices, a contract's `monthly`/`costMonthly`/`note`/`paidMonths` or **any payment amount**, an
event's `place` or `note`, hospital leads (a prospect's name and next-action text are person-adjacent and stay
device-only), documents, meeting transcripts, the journal, reviews, evidence, grades, exam bands, or any
progress or pace number. `calendarExportOf` reads `state.events`, `state.tasks`, `state.goals` and, since v28,
`meetings[].followUps`, `events[].checks`, `state.milestones`, `deals[].payments` and `state.notices` — and
nothing else; `tools/harness/smoke-logic.js` proves the boundary by building from a state whose `profile`,
`folio`, `journal`, `reviews`, `leads` and `documents` are getters that throw, whose deals and meetings have
their own privacy-bearing fields (amount, summary, decisions, transcript, and so on) trapped individually, and
whose events carry throwing `place`/`note` getters too — the build must still complete. `tools/e2e/flow9.js`
mirrors the proof end to end: it plants a real CV, business records, an event `place`/`note`, a journal entry
and a payment amount, exports, and asserts none of their values — including the amount, in either its digit or
만원 form — appears anywhere in the file's `SUMMARY` or `DESCRIPTION` lines.

## Code execution surfaces
- Runtime: React renders user text as text (no `dangerouslySetInnerHTML`); links entered as study artifacts are stored as strings and rendered as text.
- Harness scripts (`tools/harness/*.js`) call `eval` on `const NAME = <literal>` blocks extracted from `src/LifeManager.jsx` to read data tables. This runs only on trusted local source in the developer's shell, never in the app.
- Claude Code hooks (`.claude/settings.json`) run `node tools/harness/*.js` with the project as working directory. They read stdin JSON from Claude Code, touch only `.claude/harness-state/`, `tools/harness/out/`, and never modify `src/`. `data-guard` can only deny an edit; it cannot perform one.
- Since 2026-09-25, `.github/workflows/notify.yml` runs `web-push` (installed from a committed lockfile via
  `npm ci --prefix tools/push`, no other dependency) with two repository secrets in its environment and
  `permissions: contents: read` only — no write scope, no deploy step. It runs on GitHub's own infrastructure,
  never on this machine.

## Rules that are also safety properties
- Frozen data tables and payout formulas ([Rules 1–6](design-docs/core-beliefs.md#rule-1)) prevent silent score inflation.
- Frozen storage keys and append-only migrations ([Rule 12](design-docs/core-beliefs.md#rule-12)) prevent data loss on upgrade.
- No in-app AI and no network calls the app makes on its own ([Rule 7](design-docs/core-beliefs.md#rule-7)); the
  approved assistant bridge moves text only through the clipboard, under user action; the one exception, since
  2026-09-25, is the contentless daily push subscription — under the user's own hand, described under "The
  daily push" and "Data in transit" above.

## Reporting
There is no external bug bounty; open an entry in `docs/exec-plans/tech-debt-tracker.md` with severity S1 for data-loss or exposure issues.
