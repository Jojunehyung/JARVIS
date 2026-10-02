# Transcript to minutes — the seventh bridge packet, `녹취록으로 정리`

- Status: completed (approved 2026-10-02; Phase 1 commit `708b13c`, Phase 2 commit `78c6117`, Phase 3 docs below)
- Date: 2026-10-02
- Needs approval: **yes** — [Rule 7](../../design-docs/core-beliefs.md#rule-7) requires explicit user approval for any new AI touchpoint, and this one **reverses, for one packet only, the 2026-09-17 decision that no packet ever carries a transcript** ([SECURITY.md](../../SECURITY.md)). No `migrate` block, no `v` bump, no `liferpg-*` key, no data row, no deletion of a user record.
- Agents: planner → implementer (Phase 1, then Phase 2) → cleanup → verifier (smoke + `node --check` only; E2E written, never executed) → docs-syncer (Phase 3)
- Phases: **1** packet + parser + smoke · **2** bridge sheet + form integration + E2E · **3** docs. Each phase ends at a gate; commits only at gates the user approves.

## Goal
The user records meetings with the Samsung voice recorder, transcribes them on the phone, and pastes the text into a meeting's `녹취록` field. Today they then type `회의 요약`, `결정 사항`, `후속 조치` and the follow-up items by hand. This plan adds a button `녹취록으로 정리 ›` to the meeting form. It builds a copy/paste packet carrying that transcript, plus a little context, for an external chat. The pasted reply comes back as **proposals**: summary, decisions, actions, follow-up items, links to existing tasks, and today's work items. Each proposal is shown beside what the form already holds. The user ticks what to apply. Applying fills the form only; nothing is recorded until the user presses `저장`/`등록`. Ticked work items register through `importWork` on confirm. The app itself still records, transcribes and summarises nothing, and makes no network call.

## Context read
- `AGENTS.md` §3/§4/§6/§7; `docs/PLANS.md`; `docs/FRONTEND.md` (one `<Modal>` per screen state, `z-40`, backdrop closes, header X, Tailwind v3 core only, clone pattern in root handlers).
- [core-beliefs](../../design-docs/core-beliefs.md): [Rule 7](../../design-docs/core-beliefs.md#rule-7) and every dated amendment (2026-09-09, 2026-09-17 ×2, 2026-09-18, 2026-09-22, 2026-09-24, 2026-09-25), [Rule 9](../../design-docs/core-beliefs.md#rule-9), [Rule 13](../../design-docs/core-beliefs.md#rule-13).
- `docs/design-docs/assistant-bridge.md` covers the six packets:
  - daily: `buildAssistantPacket`/`parseAssistantReply`, cap 4,000
  - work: `buildWorkPacket`/`parseWorkReply`, cap 20,000, `minutesReductions`
  - prep: `buildPrepPacket`/`parsePrepReply`, cap 20,000
  - review: `buildReviewPacket` with the unchanged `parseWorkReply`
  - role verdict: `buildRoleVerdictPacket`/`parseRoleVerdictReply`, cap 12,000
  - quiz: `buildQuizPacket`/`parseQuizReply`, cap 12,000

  It also covers `replyJson` (fence → whole → first `{`…last `}`). Every parser reads its own key only, and the raw reply is never stored (except the daily packet's `journal[].ai`). It also documents `packetTracks`/`workInAiOf`, `proposalTrackOf`/`linkTrackOf`/`replyTrackOf`, and `meetingPacketLines`, which never reads the transcript.
- `docs/product-specs/meetings.md`: the record shape; `MEETING_LIMITS` (`transcript: 30000`); the form (`MeetingModal`); the view (`MeetingViewModal`, where `수정` opens `{ type: "meeting", meetingId }`); follow-up items (`MEETING_FOLLOWUPS_MAX` 30; `내 담당` becomes a work item through `reconcileFollowUps` on save); training records (`kind: "training"`, reference only, labels `배운 것`/`핵심 정리`/`기억할 점`); `aiHidden`; task links (`MEETING_LIMITS.tasks` 10, `meetingTaskCandidates`); the storage arithmetic.
- `docs/SECURITY.md` — "The assistant bridge carries six packets"; "The work packet never carries `transcript` …".
- Completed plans for shape: `2026-09-17-daily-work.md`, `2026-09-22-ai-work-track-pick.md`, `2026-09-24-daily-gate-quiz.md`.
- Code (`src/LifeManager.jsx`, line numbers at HEAD `00ec1e1`):
  - UI primitives and tracks: `Modal` (1943), `TRACKS`/`TRACK_LABEL`/`TRACK_OPTIONS` (2245–2248), `workInAiOf` (2253), `packetTracks` (2260), `trackOf` (2261), `todoOf` (2790). The `Modal` card carries `anim-pop`, and its `animation … both` leaves a `transform` on the card. A `fixed` Modal rendered **inside** that card is therefore positioned against the card, not the viewport.
  - Packet helpers: `PACKET_HEAD` (3542), `WORK_PACKET_*` (3557–3576), `oneLineText` (3591), `packetSection` (3593), `minutesReductions` (3597), `replyJson` (3683), `packetEventLinkOk`, `meetingPacketLines` (3729).
  - Existing parsers and packets: `replyTrackOf` (3879), `parseWorkReply` (3883), `linkTrackOf` (3915), `proposalTrackOf` (3922), `PREP_PACKET_*`/`buildPrepPacket`/`parsePrepReply` (3926–4035), `QUIZ_*`/`buildQuizPacket`/`parseQuizReply`/`shuffleQuiz` (4040–4170).
  - Shared sheets: `QuizModal` (6483), `copyPacket`/`PacketSendPane`/`ReplyPastePane` (6804–6835), `BizChips` (9441), `TrackRow` (9451).
  - Meetings: `MEETING_LIMITS`/`MEETING_FOLLOWUPS_MAX`/`MEETING_TASK_ROWS` (10025–10028), `EVENT_CHECKS_MAX`/`EVENT_CHECK_TEXT`, `meetingOrder` (10044), `isTraining`/`followUpsOf`/`MEETING_FIELD_LABEL`/`meetingLabels`/`kindPrefix` (10049–10062), `lastMeetingOf` (10064), `followUpWorkItem`/`reconcileFollowUps` (10088/10099), `meetingTaskCandidates` (10140), `meetingTrack` (10175), `MeetingText` (10391), `MEETING_FORM_TEXT` (10503), `MeetingModal` (10515), `MeetingViewModal` (10784).
  - Work: `WORK_LIMITS` (11031), `normWorkTitle` (11035), `workOn` (11063), `workLinkText`/`workLinkOptions` (11086/11088), `WorkBridgeModal` (11402), `PrepBridgeModal` (11524).
  - Root: `recordFits` (12461), `commitMeeting` (12511), `addMeeting`/`updateMeeting` (12537/12544), `importWork` (12932, which ends with `setModal(null)`), the modal slot (`meeting` 13377, `meetingView` 13382, `prepBridge` 13421).
- E2E and smoke:
  - The `tools/e2e/flow.js` chain runs `flow10`/`flow11`/`flow12` before `flow4`, which replaces the save.
  - There are 291 `await step(` calls today: flow 38 · flow2 16 · flow3 25 · flow4 23 · flow5 19 · flow6 14 · flow7 27 · flow8 28 · flow9 10 · flow10 32 · flow11 42 · flow12 17.
  - `tools/harness/smoke-logic.js` has sections 1–10; `lift` takes column-0 declarations only.

**Rules touched**
- [Rule 7](../../design-docs/core-beliefs.md#rule-7) — a seventh packet under the 2026-09-09 terms: copy/paste, no network, the reply only proposes, the user ticks. It reverses the transcript exclusion for this packet only. The amendment text is below, verbatim.
- [Rule 9](../../design-docs/core-beliefs.md#rule-9) — the packet, the parsed reply and the confirm state are derived or component state. Nothing new is stored except what the user applies and saves.
- [Rule 13](../../design-docs/core-beliefs.md#rule-13) — every new string states a fact (a count, a length, a reason), with no praise and no softening. The head forbids encouraging copy, and uncertain content is marked, never hidden.
- Respected, not changed:
  - [Rule 1](../../design-docs/core-beliefs.md#rule-1): nothing pays.
  - [Rule 12](../../design-docs/core-beliefs.md#rule-12): no migration — every written field already exists.
  - [Rule 18](../../design-docs/core-beliefs.md#rule-18)/[Rule 19](../../design-docs/core-beliefs.md#rule-19): no task is created. Task links name existing tasks only, and work items are not tasks.
  - [Rule 17](../../design-docs/core-beliefs.md#rule-17): untouched.

## Planner decisions (recorded so the implementer does not re-decide)
1. **The bridge is not a `modal.type`.**
   - The root has one modal slot, and `MeetingModal`'s unsaved draft lives in that component's state. Opening a new slot type would unmount the form and lose the draft.
   - Nesting a second `<Modal>` inside the form's card breaks positioning, because `anim-pop` leaves a transform on the card.
   - So `MeetingModal` owns a `bridgeOpen` flag and **renders either** its form `<Modal>` **or** `<MinutesBridgeModal>`, never both. The form's hooks stay mounted, so every typed value survives.
   - The bridge's X and backdrop return to the form; they never close it.
   - The `modal.type` count and `GATE_MODAL_TYPES` are unchanged.
2. **The packet reads the form draft, not the stored record.** The signature is `buildMinutesPacket(state, draft, today)`. `draft = { id?, projectId, date, title, attendees, kind, eventId, transcript, aiHidden, track, followUps, taskIds }` is taken from the form's current state; `id` is present only when editing. A just-pasted, unsaved transcript can be sent.
3. **The transcript is never clipped under the form's own cap.**
   - `MINUTES_PACKET_MAX` = 40,000, so the header plus a full 30,000-char transcript always fits. Reductions drop context first.
   - The button is disabled while the textarea holds more than `MEETING_LIMITS.transcript`.
   - The last-resort transcript clip is a guard for direct callers; it cannot be reached from the UI.
4. **The transcript goes last in the packet**, after the context sections. The chat then reads the instructions and the vocabulary (task titles, open follow-ups) before the long text.
5. **Pure assembly is split from gathering**, so smoke can lift the pure parts.
   - `minutesPacketText(parts)` is column-0 and pure: it builds the sections and runs the reductions. `buildMinutesPacket(state, draft, today)` gathers `parts` from `state`.
   - Likewise, `parseMinutesReply(text, ctx)` is pure, and `minutesReplyCtx(state, draft, today)` builds `ctx` in the component.
6. **Applying a field replaces it** — there is no append. The confirm view shows `기존` beside `제안`, so the user sees what would be replaced. Nothing is lost until `저장`: closing the form without saving keeps the stored record as it was.
7. **Work proposals register at `적용`.**
   - They go through `importWork(list, today, { keepModal: true })`. This new option skips `setModal(null)`, which would otherwise close the form and its unsaved draft, and returns the refusal string (`""` when written).
   - A registered work item stays even if the meeting form is later abandoned. The confirm view states this before the tick.
   - Link: an edited meeting gets `{ kind: "meeting", id }`; a new meeting with a project gets `{ kind: "project", id: projectId }`; a new memo gets no link.
   - Track preselect: `proposalTrackOf(state, { ...p, link, track: p.track || (draft.projectId === null ? draft.track : null) })`.
8. **Work vs. `내 담당` follow-ups.**
   - A `mine` follow-up becomes a work item when the form is saved (`reconcileFollowUps`).
   - To avoid a double entry, the parser rejects a work proposal whose `normWorkTitle` equals a reply follow-up with `mine: true` or a draft row with `mine: true` (`후속 항목(내 담당)과 같아요`).
   - Flipping `내 담당` in the confirm view does not re-run this check. This is logged as tech debt in Phase 3.
9. **Context is minimal and track-safe.**
   - The project's last minutes come from `lastMeetingOf` over the project's meetings, **excluding the draft's own id**.
   - A memo (`projectId: null`) gets no previous-minutes context, because `lastMeetingOf(…, null)` would pick an unrelated memo.
   - Today's work and the linked event are filtered by `packetTracks(state)` and `packetEventLinkOk`. Task titles carry no track.
   - A training draft gets the meeting line and the transcript only.
10. **`parseWorkReply` is not refactored.**
    - The minutes parser builds its own work rows with `WORK_LIMITS`, `normWorkTitle` and `replyTrackOf`.
    - If `npm run finish` flags a duplicate block, lift the shared lines into one column-0 helper. Then prove `parseWorkReply`'s output is unchanged (deep-equal, same key order) against the smoke fixture.

## Prompt
You are the implementer for Life Manager: one file, `src/LifeManager.jsx`, on Vite + React 18 + Tailwind v3 core utilities. Identifiers and comments are in English; Korean appears only in UI copy, in `해요체`, facts only ([Rule 13](../../design-docs/core-beliefs.md#rule-13)).

- Start only after the user has approved this plan, and read the whole plan before editing.
- Do not touch `store` call sites, `migrate`, any `liferpg-*` key or any data table.
- **Every existing packet (daily, work, review, prep, role verdict, quiz) must keep its output byte-for-byte.** `parseWorkReply`, `parsePrepReply`, `parseQuizReply`, `parseRoleVerdictReply` and `parseAssistantReply` must keep their outputs too.
- Change no UI copy except the strings this plan spells out.
- E2E steps are **written and `node --check`ed, never executed** (standing user instruction). Say so in every report.
- Work phase by phase. After each phase, append a dated note under `### Progress` (gates run, results, deviations) and stop at the gate.

**Before any edit, capture baselines** with a scratchpad script that is not committed:
- the six existing packets built from three saves:
  - the demo save
  - the demo save with `settings.workInAi: false`
  - a heavy save: 30 meetings × 30 follow-ups with 2,000-char transcripts, a hidden meeting, training records, dated events with checks, and documents
- That makes 18 texts, plus `parseWorkReply` on the `flow11.js` reply fixtures.
- After each phase, rebuild and diff: zero bytes may change.

### Phase 1 — the packet, the parser, smoke

**P1. Constants.** Place them in the Daily assistant region, directly after the quiz block (`shuffleQuiz`/`gradeQuiz`). Write them as column-0 literals so smoke can lift them, under the banner comment `/* ── The minutes packet (rule 7 amendment 2026-10-02, the seventh packet) … ── */`:
- `MINUTES_PACKET_MAX = 40000` — the packet's own cap; a full transcript plus the header always fits.
- `MINUTES_PACKET_TRANSCRIPT = 30000` — a literal, with a comment naming `MEETING_LIMITS.transcript`. A smoke check asserts the two are equal.
- `MINUTES_PACKET_FOLLOWUPS = 30` — open follow-ups of the last minutes.
- `MINUTES_PACKET_DECISIONS = 1000` — the last minutes' decisions clip, i.e. the whole field.
- `MINUTES_PACKET_DECISIONS_TRIM = 200`, `MINUTES_PACKET_CHECKS = 30`, `MINUTES_PACKET_WORK = 30`, `MINUTES_PACKET_TASKS = 30`.
- `MINUTES_FOLLOWUPS_READ = 30` — reply follow-ups read. Also `MINUTES_TASKLINKS_READ = 30`, `MINUTES_WORK_READ = 30` and `MINUTES_NOTE_MAX = 200`.

**P2. Heads.** Two arrays, verbatim; the lines after the role line are numbered rules in `해요체`.

`MINUTES_PACKET_HEAD` (meeting kind), first the role and rule lines:
```
역할: 이 사용자의 회의 녹취록을 회의록으로 정리하는 기록 담당자예요. 아래 데이터만 근거로 써요.
규칙: 1) 녹취록에 있는 사실만 써요. 녹취록에 없는 내용은 만들지 않아요. 격려·낙관·희망 표현은 쓰지 않아요. 해요체로 써요.
2) 사람 이름은 녹취록에 나온 표기 그대로만 써요. 녹취록에서 이름을 알 수 없으면 '참석자'라고 써요.
3) 잘 들리지 않았거나 확실하지 않은 내용은 그 문장 끝에 (확인 필요)를 붙여요. 숫자·날짜·금액은 녹취록 표기 그대로 옮겨요.
4) summary는 논의한 내용을 요점으로 10000자 이내, decisions는 정해진 것만 1000자 이내, actions는 해야 할 일을 1000자 이내로 써요. 정해지지 않은 것은 decisions에 넣지 않아요.
5) followUps는 해야 할 일을 항목당 200자 이내로 30건까지 써요. 녹음한 사용자가 맡은 일이 녹취록에서 분명할 때만 mine을 true로, 아니면 false로 써요. 기한이 녹취록에 날짜로 나오면 due에 YYYY-MM-DD로, 아니면 null로 써요. '지난 회의록'의 미완료 후속과 같은 항목은 다시 쓰지 않아요.
6) taskLinks에는 '열린 할 일' 목록 중 이 회의와 관련된 항목의 제목만 표기 그대로 적어요. work에는 오늘 처리할 업무만 적되, mine이 true인 followUps와 '오늘 업무'에 이미 있는 항목은 다시 쓰지 않아요. 점수·등급·지급액·난이도 값은 평가하거나 바꾸지 않아요.
7) 답변 형식: 아래 JSON 블록 1개만 써요. 없는 항목은 빈 문자열이나 빈 배열로 둬요.
```
Then three more head lines: a json fence opener, the template below, and a closing fence, exactly as `QUIZ_PACKET_HEAD` ends:
```json
{"minutes":{"summary":"...","decisions":"...","actions":"...","followUps":[{"text":"...","mine":false,"due":null}],"taskLinks":["<할 일 제목 그대로>"],"work":[{"title":"...","note":"...","track":"직장|사업|개인"}]},"note":"한 줄"}
```

`MINUTES_PACKET_HEAD_TRAINING` (training kind):
- Role line: `역할: 이 사용자의 교육 녹취록을 교육 기록으로 정리하는 기록 담당자예요. 아래 데이터만 근거로 써요.`
- Rules 1–3 are identical to the meeting head.
- Rule 4 becomes `4) summary에는 배운 것을 요점으로 10000자 이내, decisions에는 핵심 정리를 1000자 이내, actions에는 기억할 점을 1000자 이내로 써요.`
- Rule 5 becomes `5) followUps·taskLinks·work는 빈 배열로 둬요. 점수·등급·지급액·난이도 값은 평가하거나 바꾸지 않아요.`
- Rule 6 is the format line: the meeting head's rule 7 text with the number `6)`.
- The JSON template carries `"followUps":[],"taskLinks":[],"work":[]`.

**P3. `minutesPacketText(parts)`** — pure, column 0.
- `parts = { today, training, meetingLines, last, checks, work, tasks, transcript }`, where:
  - `last` is `null` or `{ head, hidden, decisions, followUps: [{ mine, due, text }] }`
  - `checks` is `null` or `{ eventLine, open: [text] }`
  - `work` and `tasks` are title arrays
- The output is joined with `\n`:
```
[인생 관리 — 회의록 정리 요청 {today}]          (training: [인생 관리 — 교육 기록 정리 요청 {today}])
{head lines}
(blank)
## 회의                                          (training: ## 교육)
- {date} · {회의|교육} · {title | 제목 미입력} · 프로젝트 {name | 없음 (긴급 메모)}
- 참석: {attendees}                               (only when non-empty; training: - 강사·주최: …)
## 지난 회의록                                    (meeting kind only)
- {date} {kindPrefix}{title}
  결정: {oneLineText(decisions, k.decisions) | 없음}
  후속 미완료 {n}건:
  - {내 담당|타인} · {기한 YYYY-MM-DD|기한 없음} · {text}
## 연결된 일정의 확인할 것                         (meeting kind only)
- {date} {time|시간 미정} · {event title}
- {open check text}
## 오늘 업무 (이미 있음)                           (meeting kind only)
- {title}
## 열린 할 일 (연결 후보)                          (meeting kind only)
- {title}
## 녹취록 ({n}자)
{transcript, verbatim, line breaks kept}
```
- A hidden last meeting prints `- {date} {kindPrefix}{title}`, then `  내용 비공개 (AI에 보내지 않기)`, and nothing else.
- No last minutes → `- 없음`. No linked event, or no open check → `- 없음`. Empty lists get `packetSection`'s `- 없음`.
- The transcript is never folded by `oneLineText`.

**Reductions.** Rebuild and re-measure after each step, until the text is ≤ `MINUTES_PACKET_MAX` or the list is exhausted:
- (0) work 30 → 0
- (1) tasks 30 → 0
- (2) checks 30 → 0
- (3) last follow-ups 30 → 5
- (4) last decisions clip 1,000 → 200
- (5) last minutes → none (`- 없음`)
- (6) **Guard only.** The transcript keeps its first `k` characters so the text fits, followed by the line `(녹취록 {n}자 중 앞 {k}자만 실었어요)`.

The title, the head, `## 회의` and the transcript heading are never dropped.

**P4. `buildMinutesPacket(state, draft, today)`** gathers `parts` and returns `minutesPacketText(parts)`.
- Guards come first, as defence in depth (the UI disables the button for the same cases). Neither guard text carries the transcript.
  - `draft.aiHidden` → header + `## 회의` + `- 내용 비공개 (AI에 보내지 않기)`.
  - `!packetTracks(state).includes(meetingTrack(state, draft))` → header + `## 회의` + `- 직장 트랙 회의록 — AI 패킷에 실리지 않아요`.
- `meetingLines` comes from the draft; the project name comes from `state.meetingProjects`.
- `last` (meeting kind with `projectId != null` only): `lastMeetingOf((state.meetings || []).filter((m) => m.id !== draft.id), draft.projectId)`. Its open follow-ups are `followUpsOf(last).filter((f) => !f.done)`, mine first (stable).
- `checks` (meeting kind only): the event named by `draft.eventId`, when that event exists and `packetEventLinkOk(state, draft.eventId)` holds. Open checks only; never `place`/`note`.
- `work`: `workOn(state, today, today).filter((w) => !w.done && packetTracks(state).includes(trackOf(w))).map((w) => w.title)`.
- `tasks`: the titles of the open candidates of `meetingTaskCandidates(state, today)` (`!c.done`).
- **Never read**: `profile` (no `## 이력`), any other meeting's `transcript`, documents, deals, an event's `place`/`note`, `journal`, `role`.
- A comment above the function says this is the one packet that reads `transcript`, and only the draft's own.

**P5. `minutesReplyCtx(state, draft, today)`** returns:
- `training`
- `followUps`: `draft.followUps` (the form rows, texts trimmed)
- `taskIds`: `draft.taskIds`
- `tasks`: `[{ id, title }]` for every candidate of `meetingTaskCandidates`, open first and then done — the order the picker shows
- `workTitles`: `workOn(state, today, today).map((w) => w.title)`

**P6. `parseMinutesReply(text, ctx)`** — pure, column 0.

It reads the reply through `replyJson`, and reads **only `data.minutes` and `data.note`**. Every other key is ignored and not inspected: top-level `tasks`, `work`, `checks`, `quiz`, `verdict`, `stages`, `areas`, `events`, `deals`, `meetings`, and anything else.

It returns `{ raw, note, refused, fields, followUps, taskLinks, work }`:
- `refused`: when `data.minutes` is not a plain object → `회의록 정리 답변이 아니에요 — 답변을 다시 받아요`, with every list empty.
- `note`: a trimmed string of at most `MINUTES_NOTE_MAX` characters, else `""`.
- `fields.summary`, `fields.decisions` and `fields.actions` each accept a string, or an array of strings joined with `\n`; anything else becomes `""`. The text is trimmed, then clipped to the matching `MEETING_LIMITS` cap, and returned as `{ text, len, clipped }`, where `len` is the length before the clip and `clipped` is `len > cap`.
- For a training draft (`ctx.training`), `followUps`, `taskLinks` and `work` are `[]` whatever the reply carries.

`followUps`:
- Reads the first `MINUTES_FOLLOWUPS_READ` entries of `minutes.followUps` (an array, else `[]`). `dropped` counts the entries beyond that.
- Each entry becomes `{ key: "f{n}", text, clipped, mine, due, reject }`:
  - `text` is trimmed and clipped to `MEETING_LIMITS.followUp`
  - `mine` is `entry.mine === true`
  - `due` is a `YYYY-MM-DD` string that is a real calendar date, else `null`
- Rejections, in order:
  1. empty → `내용이 없어요`
  2. the normalised text (`normWorkTitle`) equals a draft row or an earlier accepted entry → `이미 후속 항목에 있어요`
  3. the entry falls beyond the room left (`MEETING_FOLLOWUPS_MAX - ctx.followUps.length`, counting accepted entries) → `후속 항목은 30건까지예요`

`taskLinks`:
- Reads the first `MINUTES_TASKLINKS_READ` strings of `minutes.taskLinks`.
- Each entry becomes `{ key: "t{n}", title (trimmed), taskId, reject }`. The title is resolved by an **exact** trimmed match against `ctx.tasks`, taking the first hit in list order; there is no substring matching.
- Rejections, in order:
  1. no match → `같은 제목의 할 일이 없어요`
  2. already in `ctx.taskIds`, or accepted earlier → `이미 연결돼 있어요`
  3. beyond the room left (`MEETING_LIMITS.tasks - ctx.taskIds.length`) → `할 일은 10개까지 연결돼요`

`work`:
- Reads the first `MINUTES_WORK_READ` entries of `minutes.work`.
- Each entry becomes `{ key: "w{n}", title, note, track, reject }`:
  - `title` is at most `WORK_LIMITS.title`
  - `note` is at most `WORK_LIMITS.note`
  - `track` is `replyTrackOf(entry.track)`
- A `link` key in an entry is ignored; the app sets the link (decision 7).
- Rejections, in order:
  1. empty → `제목이 없어요`
  2. equal (`normWorkTitle`) to a `ctx.workTitles` entry or an earlier accepted proposal → `오늘 업무에 이미 있어요`
  3. equal to an accepted reply follow-up with `mine: true`, or a draft row with `mine: true` → `후속 항목(내 담당)과 같아요`

Nothing here writes state, and the raw reply is never stored.

**P7. Smoke.** Add a new section, `// 11) the minutes packet (2026-10-02)`, to `tools/harness/smoke-logic.js`.

It lifts `MINUTES_*`, both heads, `MEETING_LIMITS`, `MEETING_FOLLOWUPS_MAX`, `WORK_LIMITS`, `TRACKS`, `TRACK_LABEL`, `replyTrackOf`, `normWorkTitle`, `oneLineText`, `packetSection`, `replyJson`, `minutesPacketText` and `parseMinutesReply`.

Constant check:
- `MINUTES_PACKET_TRANSCRIPT === MEETING_LIMITS.transcript`.

Packet checks:
- A 30,000-char transcript with 300 line breaks and empty context goes whole: the transcript appears verbatim, with no guard line.
- With full context, the reductions fire in order and stop as soon as the text fits. Full context means 30 follow-ups × 200 chars, 1,000-char decisions, 30 checks × 200 chars, and 30 work and 30 task titles. Record which reductions fired and the final length.
- A 45,000-char transcript passed directly ends ≤ `MINUTES_PACKET_MAX`, with the guard line.
- A hidden last meeting states no decision.
- Training parts print `## 교육` and no context sections.
- The head lines appear verbatim.

Parser checks:
- Reply shapes: a fenced reply; bare JSON after prose with no fence; a reply without `minutes` (refused).
- A reply whose top-level `work`/`tasks`/`checks`/`quiz`/`verdict` carry items: none are read.
- Fields: arrays are joined; over-cap fields are clipped and report `len`.
- Follow-ups:
  - 35 entries → 30 read, `dropped` 5.
  - Duplicates and draft-equal entries are rejected.
  - The room rejection fires with 28 draft rows.
  - `due` of `"2026-02-30"` becomes null; `mine: "true"` becomes false.
- Task links: exact-only (a substring title is rejected); duplicates are rejected; the room rejection fires with 9 already linked.
- Work: dedupe against today and against a `mine` follow-up; track mapping (`개인` → `personal`, `foo` → null).
- Training ignores all three lists.

Update the header comment's counts; `npm run smoke` must pass.

**Gate 1**
- Run `npm run build`, `npm run smoke`, `npm run lang:check` and `npm run finish` (exit 0).
- The baseline diff must be zero bytes for the 18 packet texts and the `parseWorkReply` fixtures.
- Measure packet lengths with a throwaway scratchpad script (not committed):
  - (a) the demo's first meeting with a 2,000-char transcript
  - (b) a 30,000-char transcript with 300 line breaks and empty context
  - (c) the same with heavy context, noting which reductions fired
  - (d) a training draft with a 30,000-char transcript
- Record all four in `### Progress`; Phase 3 copies them into the docs.
- Stop for the user's gate.

### Phase 2 — the bridge sheet, the form integration, E2E

**B1.** Change the signature to `importWork(list, date = today, { stamp = false, keepModal = false } = {})`.
- `keepModal` skips `setModal(null)`.
- The function returns the refusal string, or `""`, on every path.
- Existing callers pass nothing new and behave identically; they ignore the return.

**B2.** `MeetingModal` gains two props, `onImportWork` and `onToast`, passed on the `meeting` slot only:
- `onImportWork={(list) => importWork(list, today, { keepModal: true })}`
- `onToast={(msg) => showToast({ msg })}`

**B3. The button.**
- Place it inside the transcript block, directly under the transcript `MeetingText`, using the transcript block's border-button style.
- It shows only while `transcript.trim()` is non-empty, and reads `녹취록으로 정리 ›`.
- It is disabled in three cases, each with one caption line under the button; the first match wins:
  1. `aiHidden` (form state) → `AI에 보내지 않기가 켜져 있어 녹취록 정리를 요청할 수 없어요.`
  2. The draft's track (`meetingTrack(state, draft)`) is outside `packetTracks(state)` → `직장 트랙 회의록 — AI 패킷에 실리지 않아요`
  3. `transcript.trim().length > MEETING_LIMITS.transcript` → `녹취록은 30000자까지예요 — 지금 {n}자예요.`
- When enabled, it sets `bridgeOpen` (decision 1).
- `MeetingViewModal` is not changed; the view reaches the button through its existing `수정`.

**B4. Form copy changes** — the only copy edits in this plan:
- The note `녹취록은 붙여넣은 그대로 저장돼요 — AI 패킷에는 실리지 않아요.` becomes `녹취록은 붙여넣은 그대로 저장돼요 — '녹취록으로 정리'를 누를 때만 AI 요청문에 실려요.`
- The `AI에 보내지 않기` caption `켜면 오늘 업무 만들기 패킷에 이 회의록의 날짜와 제목만 실려요.` becomes `켜면 오늘 업무 만들기 패킷에 이 회의록의 날짜와 제목만 실리고, 녹취록 정리도 요청할 수 없어요.`

**B5. `MinutesBridgeModal({ state, today, draft, onClose, onApply, onImportWork, onToast })`**

Place it in the Meetings region, directly after `MeetingModal`. It runs `send` → `paste` → `confirm` and reuses `PacketSendPane`, `ReplyPastePane` and `copyPacket`. Following the prep bridge's pattern, the title is `녹취록으로 정리` on the send step and `AI 답변 붙여넣기` after it.

Send step captions:
- Meeting: `아래 글을 복사해 Claude·ChatGPT 채팅에 붙여넣고, 답변을 받아 다시 붙여넣어요. 앱은 네트워크를 쓰지 않아요. 이 회의의 녹취록 전체와 날짜·종류·제목·프로젝트·참석자, 지난 회의록의 결정·미완료 후속, 연결된 일정의 확인할 것, 오늘 업무와 열린 할 일의 제목이 실려요 — 녹취록에 나온 이름·숫자도 그대로 실려요. 프로필 이름·연락처·학교·직장은 실리지 않아요.`
- Training: `아래 글을 복사해 Claude·ChatGPT 채팅에 붙여넣고, 답변을 받아 다시 붙여넣어요. 앱은 네트워크를 쓰지 않아요. 이 교육의 녹취록 전체와 날짜·종류·제목·프로젝트·강사·주최가 실려요 — 녹취록에 나온 이름·숫자도 그대로 실려요. 프로필 이름·연락처·학교·직장은 실리지 않아요.`
- While `workInAiOf(state)` is false, append ` 직장 트랙 기록은 실리지 않아요.` (the existing caption convention).

When the reply is refused, the confirm step shows the rose line `parsed.refused` and a `다시 붙여넣기` border button that goes back to `paste`.

Otherwise the confirm step shows, top to bottom:
- The header `회의록 정리 제안` (training: `교육 기록 정리 제안`).
- The reply's `note` in zinc-400, when present.
- The caption `적용하면 폼의 내용이 제안으로 바뀌어요 — 저장을 눌러야 회의록에 기록돼요.`
- **Three field cards.**
  - Labels come from `MEETING_FIELD_LABEL[kind]`: `회의 요약`/`결정 사항`/`후속 조치`, or for training `배운 것`/`핵심 정리`/`기억할 점`.
  - Each card shows its label, with a checkbox labelled `적용` on the right.
  - Below that, a `grid grid-cols-2 gap-2` holds two scroll boxes (`max-h-40 overflow-y-auto whitespace-pre-wrap break-words text-xs`, `bg-zinc-950`), headed `기존 · {n}자` and `제안 · {n}자`.
  - An empty side reads `비어 있음` or `제안 없음`.
  - A clipped proposal adds the zinc-400 line `제안 {len}자 중 {cap}자만 실었어요`.
  - Default tick: on only when the form field is empty **and** the proposal is non-empty. A card with no proposal has no checkbox.
- **Follow-ups** (meeting kind only):
  - Section label `후속 항목 제안 — {n}건`, plus `제안 {total}건 중 30건만 읽었어요.` when `dropped > 0`.
  - Each row has a checkbox (on by default unless rejected), the text, a facts line `{기한 YYYY-MM-DD | 기한 없음}{ · 200자로 잘림}`, a `내 담당` `Chip` (initial value from `mine`), and the rose reject line.
  - Rejected rows are disabled and unticked.
- **Task links** (meeting kind only): `할 일 연결 제안 — {n}건`, with rows of checkbox, title and rose reject line.
- **Work** (meeting kind only):
  - Section label `업무 제안 — {n}건`, with the caption `업무는 적용할 때 바로 업무 탭에 등록돼요 — 회의록을 저장하지 않아도 남아요.`
  - Rows look like `WorkBridgeModal`'s: checkbox, title, note, rose reject line.
  - A `BizChips` `TRACK_OPTIONS` row is preselected per decision 7; a rejected row shows no chips.
- For training, the caption `교육 기록은 배운 것·핵심 정리·기억할 점만 적용해요.` and no list sections.
- When there is nothing to apply at all (three empty proposals, every list empty): `제안 없음 — 적용할 항목이 없어요.`
- The button `선택한 항목 적용`, disabled when nothing is ticked.

`적용` does, in order:
1. If any work row is ticked, call `onImportWork(rows with { title, note, link, track })`. A non-empty return is shown as a rose line above the button, and **nothing else is applied**.
2. Call `onApply({ summary?, decisions?, actions?, followUps: [{ text, mine, due? }], taskIds: [] })` with the ticked items only.
3. Call `onToast("회의록 정리 제안을 폼에 넣었어요 — 저장해야 기록돼요")`.
4. Close back to the form.

`MeetingModal`'s `onApply`:
- Sets each ticked field.
- Appends follow-up rows `{ id: uid(), text, mine, ...(due ? { due } : {}), done: false }`, never past `MEETING_FOLLOWUPS_MAX`.
- Adds task ids, never past `MEETING_LIMITS.tasks`, live tasks only.
- Shows, under the transcript block, the line `정리 제안 적용 — {applied field labels joined by ·} · 후속 {n}건 · 할 일 {k}건 · 업무 {w}건 등록. 저장해야 회의록에 기록돼요.` Fragments with a 0 count are omitted; `업무 … 등록` appears only when `w > 0`.

Nothing reaches `state.meetings` until `저장`/`등록`. Saving runs the existing `submit` → `commitMeeting` path unchanged (budget check, `reconcileFollowUps`, toasts).

The raw reply, the parsed result and the ticks live only in `MinutesBridgeModal`'s state; closing the bridge discards them.

**B6. E2E.** Add a new file, `tools/e2e/flow13.js`.
- Chain it in `flow.js` after `flow12.js` and before `flow4.js`, with the comment `// before flow4, which replaces the save`.
- Use helpers from `run.js` only. Add none unless needed; any new helper is documented in `tools/e2e/README.md`.
- Each step is one `await step(`. Step names are in English; selector and assert arguments are Korean UI copy.

Steps:
1. `the minutes button appears only with a transcript` — on a new memo form there is no `녹취록으로 정리 ›`; after pasting a transcript, it is present.
2. `the minutes button is disabled for a hidden meeting, a day-job meeting with the switch off, and an over-cap transcript` — each case shows its caption.
3. `the minutes packet carries the whole transcript and its context`.
   - Fixture: a planted project with a previous meeting (decisions, one open and one done follow-up), a linked event with one open and one done check, an open work item for today, and an open task.
   - Assert present: the transcript sentinel verbatim, the meeting line, `참석:`, the previous decisions, the open follow-up, the open check, the work title, the task title.
   - Assert absent: the done follow-up and the done check.
4. `the minutes packet carries no profile identifier, no other transcript and no event place or note`.
   - Plant sentinels on `profile.name`, `birth`, `email`, `phone`, school, employer, another meeting's transcript, the event's `place`/`note`, and a document's `source`; assert all are absent.
   - On the new fixture, re-assert the existing flow11 sentinel: the work packet still carries no transcript.
5. `a hidden previous meeting lends its date and title only`.
6. `the confirm view shows existing and proposed text and ticks only empty fields` — the form has a typed summary and empty decisions/actions. After pasting a reply, the `기존`/`제안` columns show, the summary card is unticked, and the decisions/actions cards are ticked.
7. `applying fills the form but writes nothing until save`.
   - After applying, `readState()` shows meetings unchanged, the form's textareas hold the proposals, and the follow-up rows and task link appear.
   - After `등록`, the record holds them, and a `내 담당` follow-up has created one work item (`source: "meeting"`).
8. `work proposals register on apply with the picked track and keep the form open`.
   - Fixture: four work rows — one `개인`, one changed to `사업`, one duplicate of today's work, and one equal to a `mine` follow-up. The last two are rejected.
   - After applying: two `source: "ai"` items with the picked tracks, and the form still open with its draft.
9. `a reply's other keys change nothing` — the reply carries top-level `tasks`, `work`, `checks`, `quiz` and `verdict` beside `minutes`. `tasks`, `events`, `work` (beyond the ticked rows), `journal`, `role` and `act` are unchanged (`changedKeys`).
10. `a reply without minutes is refused` — the refusal line shows, and `다시 붙여넣기` returns to the paste pane.
11. `a training record applies the three fields only` — labels `배운 것`/`핵심 정리`/`기억할 점`, no list sections even when the reply carries them, and the training caption.
12. `closing the bridge returns to the form with the draft intact`.
13. `exact task-title matching` — a reply naming a substring of a task title is rejected with `같은 제목의 할 일이 없어요`.

Update `tools/e2e/README.md`: the new file, the step count 291 → 304, and the "written, not executed" sentence. Run `node --check` on every edited E2E file.

**Gate 2**
- Run `npm run build`, `npm run smoke`, `npm run lang:check`, `npm run finish` (exit 0) and `node --check tools/e2e/flow13.js tools/e2e/flow.js`. The baseline diff must be zero bytes.
- Throwaway checks: scratchpad puppeteer against the production build at 390 px, not committed.
  - The three disabled states.
  - The two-column cards have no horizontal overflow at 390 px.
  - Copying a 40,000-char packet works through both copy paths.
  - The form keeps every typed value after a work import and after closing the bridge.
  - The toast and the applied line read as specified.
- **Mutation checks.** Each must fail at least one smoke or E2E assertion; revert each after.
  - (m1) the parser also reads top-level `work`
  - (m2) `buildMinutesPacket` ignores `draft.aiHidden`
  - (m3) the default tick ignores whether the field is empty
  - (m4) `적용` calls `onUpdate` instead of filling the form
  - (m5) task links match by substring
  - (m6) the transcript is folded through `oneLineText`
  - (m7) `importWork` ignores `keepModal`
  - (m8) the packet reads `profile.name`
  - (m9) a training reply's follow-ups are applied
- List each mutation with the assertion that caught it in `### Progress`.
- Stop for the user's gate.

### Phase 3 — docs (docs-syncer)
Update everything under "Docs to sync". Then run `npm run docs:gen` and `npm run docs:check`, and move this plan to `docs/exec-plans/completed/` with a completion note.

### Acceptance criteria
- With a transcript in the form, `녹취록으로 정리 ›` opens the send pane.
  - The packet holds the whole transcript verbatim (at most 30,000 chars, never clipped from the UI), the meeting line, and the context sections.
  - It never holds a profile identifier, another meeting's transcript, an event's place or note, or a document.
- A hidden meeting, a day-job meeting while the switch is off, and an over-cap transcript cannot be sent, and each case states why.
- The confirm view shows:
  - `기존`/`제안` per field, with per-field `적용` ticks that default to empty fields only
  - tickable follow-ups with `내 담당`
  - task-link ticks
  - work rows with track chips
  - for a training draft, the three fields only
- `적용` fills the form, and `state.meetings` changes only on `저장`/`등록`. Ticked work items register at `적용` with `source: "ai"`, `done: false` and the picked track, and the form stays open.
- The raw reply is never stored. Nothing new is stored except what the user applied and saved, and there is no schema change.
- The six existing packets and their parsers are byte-identical to the baselines.

### Finish protocol
After each phase:
1. cleanup — `npm run finish` exit 0; any allowlist entry carries a reason and is mirrored in `tech-debt-tracker.md`.
2. verifier — `npm run build`, `npm run smoke` and `node --check` on the E2E files. **`npm run verify` is not run**, per the standing instruction; say it was skipped.
3. docs-syncer — Phase 3 only.
4. report — what changed, commands run with results, findings, the proposed commit.

Commit only at a gate the user approved.

## Rule 7 amendment (verbatim)
The docs-syncer appends this in Phase 3, after the 2026-09-25 amendment. The date is the day the user approves (2026-10-02 if that is today).

**Amendment 2026-10-02 (user approval):** the bridge carries a seventh packet, `녹취록으로 정리` (`buildMinutesPacket` / `parseMinutesReply`), built for the one meeting draft open in `MeetingModal` — reversing, for this packet only, the 2026-09-17 decision that no packet carries a transcript. It carries that draft's whole `transcript` (at most 30,000 characters, never clipped from the form), its date, kind, title, project name and attendees, the project's last minutes (decisions and open follow-ups; a meeting flagged `aiHidden` contributes its date and title only), the open checks of the linked event, and the titles of today's open work items and of open tasks; never `profile.name`, `birth`, `email`, `phone`, a school or an employer, an event's place or note, a document, or any other meeting's transcript. A draft flagged `aiHidden`, or whose track is outside `packetTracks(state)`, cannot be sent: the button is disabled with a caption. A reply to it can only *propose* text for the draft's `summary`, `decisions` and `actions`, follow-up items, links to existing tasks named by their exact title, and work items. A proposal fills the form only after the user ticks `적용` per field and per item, and reaches the record only when the user then saves the form with `저장`/`등록`, through the unchanged `commitMeeting`; ticked work items register at `적용` through `importWork` with `source: "ai"`, `done: false` and the track picked per item — the app never assigns the track on the AI's word alone. A training record takes the three text fields only. Nothing in a reply creates a task, completes, pays, promotes or deletes anything. This parser reads the reply's `minutes` and `note` keys only — `tasks`, a top-level `work`, `checks`, `quiz`, `verdict` or any other key is ignored — and the six earlier parsers are unchanged. The raw reply is never stored, and nothing new is stored besides what the user applies and saves. The app itself still records, transcribes and summarises nothing, and makes no network call.

## Rule 13 copy
Every new string is a fact. There is no praise and no "done!" wording. The head forbids encouraging copy and requires `(확인 필요)` on uncertain items.

- Button and disabled captions: `녹취록으로 정리 ›`; `AI에 보내지 않기가 켜져 있어 녹취록 정리를 요청할 수 없어요.`; `직장 트랙 회의록 — AI 패킷에 실리지 않아요`; `녹취록은 30000자까지예요 — 지금 {n}자예요.`
- Confirm headers and caption: `회의록 정리 제안` / `교육 기록 정리 제안`; `적용하면 폼의 내용이 제안으로 바뀌어요 — 저장을 눌러야 회의록에 기록돼요.`
- Field cards: `기존 · {n}자` / `제안 · {n}자` / `비어 있음` / `제안 없음`; `제안 {len}자 중 {cap}자만 실었어요`
- List sections: `후속 항목 제안 — {n}건`; `제안 {total}건 중 30건만 읽었어요.`; `할 일 연결 제안 — {n}건`; `업무 제안 — {n}건`; `업무는 적용할 때 바로 업무 탭에 등록돼요 — 회의록을 저장하지 않아도 남아요.`
- Training and empty states: `교육 기록은 배운 것·핵심 정리·기억할 점만 적용해요.`; `제안 없음 — 적용할 항목이 없어요.`
- Actions and refusal: `선택한 항목 적용`; `회의록 정리 답변이 아니에요 — 답변을 다시 받아요`; `다시 붙여넣기`
- Reject lines: `내용이 없어요` / `이미 후속 항목에 있어요` / `후속 항목은 30건까지예요` / `같은 제목의 할 일이 없어요` / `이미 연결돼 있어요` / `할 일은 10개까지 연결돼요` / `제목이 없어요` / `오늘 업무에 이미 있어요` / `후속 항목(내 담당)과 같아요`
- Toast and applied line: `회의록 정리 제안을 폼에 넣었어요 — 저장해야 기록돼요`; `정리 제안 적용 — … 저장해야 회의록에 기록돼요.`

## Storage
Nothing new is stored.
- The fields an applied proposal fills (`summary`, `decisions`, `actions`, `followUps[]`, `taskIds[]`) already exist. On save they pass through the unchanged `submit` caps and the `commitMeeting` → `recordFits` budget check.
- A ticked work item is a `work[]` record of the existing shape, budget-checked by `importWork`'s `recordFits`.
- The packet, the reply, the parse and the ticks are component state, lost on close.
- No `v` bump, no `migrate` block, no new key.
- `meetings.md`'s storage arithmetic is unchanged: a minutes-filled record is still bounded by the same caps.

## Share Target (later — not in scope)
A later change could let the Samsung recorder's `텍스트로 공유` send the transcript straight into this flow, skipping the manual paste.
- **Manifest:** add a `share_target` entry to `public/manifest.webmanifest`:
  - `"action": "./?share=transcript"`, `"method": "POST"`, `"enctype": "multipart/form-data"`
  - `"params": { "title": "title", "text": "text", "files": [{ "name": "file", "accept": ["text/plain", ".txt"] }] }`
  - It must be POST, because a 30,000-char transcript does not fit a GET URL.
- **Service worker** (generated by `tools/harness/gen-sw.js`):
  - A `fetch` handler for POST to the action reads `formData()` and takes `text`, or the first `file`'s text.
  - It writes the text to a dedicated Cache entry, following the `life-check` cache pattern with a new cache name — never a `liferpg-*` key.
  - It answers with a `303` redirect to `./?open=share`.
  - On boot, the page reads and deletes that entry and opens a new `MeetingModal` with the transcript prefilled. The project chips start unpicked, so the user chooses. `OPEN_PARAM_TYPES` gains `share`.
- **Gate interaction:** while the daily gate is active, `meeting` is not in `GATE_MODAL_TYPES`. The shared text must stay in the cache until the gate passes, then open.
- **Device test first.** Find out:
  - whether the recorder shares as `EXTRA_TEXT` (→ `text`) or as a `.txt` attachment (→ `files`)
  - the size limit of each path
  - whether the installed PWA appears in the share sheet at all (Chrome WebAPK vs Samsung Internet)

  The plan for it starts from that test's result. Phase 3 records this item in `backlog.md`.

## Steps
1. Phase 1 — baselines; P1–P7; Gate 1 with measurements; stop.
2. Phase 2 — B1–B6; throwaway and mutation checks; Gate 2; stop.
3. Phase 3 — docs; `docs:gen`, `docs:check`; move to `completed/`.

### Progress
(implementer appends dated notes here)

- 2026-10-02 — **Approved by the user** (option 2, "proceed"), including the Rule 7 reversal that lets this one packet carry the draft's transcript. Phase 1 started; Phases 2 and 3 wait for their gates.
- 2026-10-02 — **Phase 1 done (implementer, not committed); stopped at Gate 1.**
  - Code: `src/LifeManager.jsx` gains one block (pure addition, one hunk) in the Daily assistant region after `shuffleQuiz`, under the banner `/* ── The minutes packet (rule 7 amendment 2026-10-02, the seventh packet) … ── */`: the twelve `MINUTES_*` constants, `MINUTES_PACKET_HEAD`, `MINUTES_PACKET_HEAD_TRAINING`, `minutesPacketHead`, `minutesPacketText`, `buildMinutesPacket`, `minutesReplyCtx`, `parseMinutesReply`. No `migrate` block, still v28; no `store` call site, `liferpg-*` key, data row or existing line touched. `tools/harness/smoke-logic.js` gains section 13 (`minutes packet: 47 checks`).
  - Gates: `npm run build` ok · `npm run smoke` all passed · `npm run finish` clean (no allowlist entry) · `npm run lang:check` clean · `node --check tools/harness/smoke-logic.js` ok · `npm run docs:gen && npm run docs:check` clean (`db-schema.md` line numbers and `symbol-index.md` regenerated). `npm run verify` and every E2E run skipped (standing user instruction). Every edited file LF.
  - Baselines: 74 outputs captured at HEAD `61d72e6` before any edit — the six packets over the demo, the demo with `settings.workInAi: false` and a heavy save (30 meetings × 30 follow-ups with 2,000-char transcripts, a hidden meeting, three training records, six dated events with 30 checks each, 20 documents, 25 work items), plus since-mode work and every event's prep packet; `parseWorkReply` on the flow11-shaped replies (fenced, bare JSON, other keys, tracks, garbage) over the three saves; the other four parsers on the same replies. After the phase: byte-identical (sha256 `91df0701…` both). No baseline packet carries a transcript sentinel.
  - Measurements (`buildMinutesPacket`, today 2026-10-02):
    - (a) the demo's first meeting (the urgent memo) with a 2,000-char transcript: 3,352 chars, no reduction (a memo has no previous minutes; 4 work titles, 6 task titles). The demo's `유지보수 범위 협의` as a new draft linked to `○○물산 주간 점검`: 3,588 chars (last minutes with 2 open follow-ups, 2 open checks).
    - (b) 30,000 chars with 300 line breaks and empty context: 31,215 chars, transcript whole, no guard line.
    - (c) the heavy save, a new draft on the heavy project linked to an event with 22 open checks: 37,131 chars; reductions (0) work, (1) tasks and (2) checks fired, then it fit (the last minutes kept whole with 24 open follow-ups). Editing that project's newest meeting instead (its previous meeting is hidden): 35,614 chars, no reduction. The smoke fixture with full context (30 × 200-char follow-ups, 1,000-char decisions, 30 × 200-char checks, 30 + 30 titles): 38,892 chars, reductions 0–2 fired.
    - (d) a training draft with a 30,000-char transcript: 30,737 chars.
  - Mutations (each reverted; source restored byte-identical): (m1) the parser also reads top-level `work` → caught by `top-level work/tasks/checks/quiz/verdict are not read` (+2 refusal checks); (m2) `buildMinutesPacket` ignores `draft.aiHidden` → `an aiHidden draft: the guard text, no transcript`; (m5) substring task match → `task links: …`; (m6) the transcript folded through `oneLineText` → 7 checks incl. `whole transcript` and `the draft's own transcript only`; (m8) the packet reads `profile.name` → `no profile identifier, event place or note, document or journal` (+2); (m9) a training reply's lists kept → `training: the three fields only`. m3, m4 and m7 concern Phase 2 code.
  - Deviations and interpretations:
    1. Smoke sections 11 and 12 already exist (storage expansion), so the new section is **13**, placed before section 11 (the async tail that ends the run). The smoke file has no count header; the section prints its own check count.
    2. `parseMinutesReply` returns one more key, `dropped` (follow-up entries beyond `MINUTES_FOLLOWUPS_READ`), which the plan names but does not place; a refused reply returns empty `fields` and `dropped: 0`.
    3. `MINUTES_PACKET_TRANSCRIPT` is the transcript's carried maximum, per the amendment's "at most 30,000 characters": a longer transcript (direct callers only) is cut there with the guard line before any context reduction; the last reduction still trims further only if the text cannot fit otherwise.
    4. A column-0 helper `minutesPacketHead(today, training)` (title, head, blank line, record heading) is shared by `minutesPacketText` and both guards; a training draft's guard text sits under `## 교육` rather than `## 회의`.
    5. The builder trims the transcript's ends, as `submit` does before storing, so the packet carries what saving would store; the interior is untouched.
    6. The work dedupe against `mine` follow-ups compares the follow-up's first `WORK_LIMITS.title` characters — the title `reconcileFollowUps` would register.
    7. `  후속 미완료 {n}건:` states the total open count and is omitted when the last minutes have none open; the reduction shrinks the listed rows only. Check texts are folded with `oneLineText(…, EVENT_CHECK_TEXT)`. The two room rejections are templates over `MEETING_FOLLOWUPS_MAX` and `MEETING_LIMITS.tasks` (same strings).
    8. `buildMinutesPacket` and `minutesReplyCtx` have no UI caller until Phase 2; smoke lifts and tests both (`liftClosure`), so `finish` is clean without an allowlist entry.
  - For Phase 2: `tools/e2e/flow13.js` already exists (storage expansion) and the step count is no longer 291, so B6 needs a new file name (e.g. `flow14.js`) and a recount. The plan's Context line numbers are from `00ec1e1` and have shifted.
  - Finding outside scope: the baseline heavy save's quiz packet is 27,045 chars, over `QUIZ_PACKET_MAX` (12,000) — its preparation section is never dropped and six events with 30 checks each fill it. Pre-existing and unchanged here.
- 2026-10-02 — **Phase 2 done (implementer, not committed); stopped at Gate 2.**
  - Code (`src/LifeManager.jsx`, no `migrate` block, still v28, nothing new stored, no `store` call site, `liferpg-*` key or data row touched):
    - B1: `importWork(list, date = today, { stamp = false, keepModal = false } = {})` — `keepModal` skips `setModal(null)`; it returns the refusal string or `""` on every path. The two existing callers are unchanged and ignore the return.
    - B2: the `meeting` slot passes `onImportWork={(list) => importWork(list, today, { keepModal: true })}` and `onToast`.
    - B3/B4: inside the open transcript block, under its `MeetingText`, the border button `녹취록으로 정리 ›` (shown while `transcript.trim()` is non-empty) with the three disabled captions (first match wins), the applied line under it, and the two form copy edits verbatim.
    - B5: `MinutesBridgeModal` directly after `MeetingModal` (send → paste → confirm, reusing `PacketSendPane`, `ReplyPastePane`, `copyPacket`), plus the column-0 list `MINUTES_FIELDS`. `MeetingModal` renders either its form `<Modal>` or the bridge (never both); the bridge's X and backdrop return to the form. `applyMinutes` fills the form only.
  - E2E (written, `node --check`ed, **never executed**, per the standing instruction): new `tools/e2e/flow14.js` (13 steps, the plan's B6 list with the plan's step names), chained in `flow.js` after `flow13.js` with `// before flow4, which replaces the save`; the file plants its own fixture and ends by writing back the save it started from. `tools/e2e/README.md`: run-line count 301 → 314, a status paragraph and a `flow14.js` table row. 314 `await step(` calls as written (flow 38 · flow2 16 · flow3 25 · flow4 23 · flow5 19 · flow6 14 · flow7 27 · flow8 28 · flow9 10 · flow10 32 · flow11 42 · flow12 17 · flow13 10 · flow14 13). No `run.js` helper added.
  - Gates: `npm run build` ok · `npm run finish` clean (no allowlist entry; one duplicate with `flow11.js`'s `pasteReply` was resolved by making `flow14.js`'s version assert the paste pane's title) · `npm run lang:check` clean · `npm run smoke` all passed · `node --check tools/e2e/flow14.js tools/e2e/flow.js` ok · `npm run docs:gen && npm run docs:check` clean (`db-schema.md` line numbers and `symbol-index.md` regenerated). `npm run verify` and every E2E run skipped (standing user instruction). Every edited file LF.
  - Baselines: the Phase 1 harness (74 outputs: six packets × three saves, since-mode work, every prep packet, `parseWorkReply` on the flow11-shaped replies, the other four parsers) is byte-identical to the pre-Phase-1 capture (sha256 `91df0701…`). DOM: the single-file demo at HEAD vs. after — all seven tabs and the six demo meeting views are byte-identical; the six edit forms and the two new-meeting forms differ only by the two copy edits; the forms with an open transcript block additionally gain the block's wrapper `div` and, when the transcript holds text, the button.
  - Throwaway checks (scratchpad puppeteer, `npm run build:demo`, 390 px; 54/54 passed, 0 console errors): no button on an empty form or empty transcript; enabled after a paste; the send pane replaces the form (one overlay) with the transcript verbatim and the context; the confirm view with `기존`/`제안` cards (ticks `[false, true, true]` with a typed summary), follow-ups with `내 담당` and due dates, task links (the substring refused), work rows with track chips and both rejections; no horizontal overflow at 390 px; `선택한 항목 적용` changes `work` only (two `source: "ai"` items, `personal` and `work` as picked, project link), the form keeps every typed value and shows the applied line `정리 제안 적용 — 결정 사항·후속 조치 · 후속 2건 · 할 일 1건 · 업무 2건 등록. 저장해야 회의록에 기록돼요.` and the toast; `등록` stores the fields, follow-ups, task link and transcript, the `내 담당` follow-up becomes exactly one `source: "meeting"` work item, no duplicate work titles, no reply text stored; X and backdrop keep the draft; the three disabled cases (and a `사업` memo enabled with the switch off, with the caption suffix); the refusal and `다시 붙여넣기`; training (caption, `## 교육`, three relabelled fields only, nothing written); editing the demo memo from `수정` (its transcript in the packet, the work item linked `{ kind: "meeting" }`, summary unticked by default, saved on `저장`); a packet over 30,000 chars (a full 30,000-char transcript plus context; no 40,000-char packet is reachable from the form) copied whole through the clipboard path and the `execCommand` fallback.
  - Mutations (each built into the demo, run through the throwaway checks, then reverted; source restored byte-identical): (m3) the default tick ignores the field → 6 checks fail, incl. `default ticks only on empty fields` and the edited-meeting tick check — the E2E step `the confirm view shows existing and proposed text and ticks only empty fields` asserts the same `[false,true,true]`; (m4) `적용` writes the record through `onUpdate`/`onAdd` → 4 checks fail, incl. `meetings unchanged after apply` and `only work changed` — E2E `applying fills the form but writes nothing until save` (`changedKeys` empty); (m7) `importWork` ignores `keepModal` → `back to the form` fails — E2E `work proposals register on apply … and keep the form open` (title `새 회의록`).
  - Deviations and interpretations:
    1. The E2E file is `flow14.js` (the plan's `flow13.js` exists); the count is 301 → 314, not 291 → 304.
    2. The "flag" is a snapshot: `MeetingModal` holds `bridgeDraft` (the draft as it stood when the button was pressed; null = the form shows) instead of a boolean `bridgeOpen`, so the packet and the reply context never shift while the bridge is open (e.g. after a work import).
    3. The draft snapshot also carries `summary`, `decisions` and `actions` (the `기존` side and the default ticks need them); `buildMinutesPacket` does not read them.
    4. `onApply` receives one more key, `work` (the count registered), for the applied line's `업무 {w}건 등록` fragment.
    5. The field-card label (`MEETING_FIELD_LABEL[kind]`) uses `zinc-400`; the cards are bordered (`border-zinc-800`) so the two `bg-zinc-950` boxes stand out; the `내 담당` chip and the track chips are hidden on rejected rows; an empty-text follow-up row shows its facts line and the reject only; a work row shows its link text (`workLinkText`, else `연결 없음`) before the note, as `WorkBridgeModal` does.
    6. The disabled captions are `text-zinc-500` lines under the button.
    7. `demoState` is unchanged: the demo memo already carries a transcript, so the feature is reachable in the demo from its `수정`.
- 2026-10-02 — **Phase 3 done (docs-syncer); plan completed.** Phases 1 (`708b13c`) and 2 (`78c6117`) were already
  committed; this phase touched docs only.
  - Rule 7 amendment appended verbatim after the 2026-09-25 amendment (`### Rule` count stays 19, verified).
  - `assistant-bridge.md`: a new `## The seventh packet — 녹취록으로 정리` section (sections, caps, the head
    verbatim, reductions with the measured lengths from the Phase 1 note, the parser table, `MinutesBridgeModal`,
    what it never carries); the packet count raised to seven in the overview line, the tracks table and the
    day-job-switch captions paragraph; a new tracks-table row; the work packet's "never a transcript" paragraph
    gained the one-exception note.
  - `SECURITY.md`: "six packets" → seven with a new bullet for `buildMinutesPacket`; the day-job-switch paragraph's
    packet count raised to six (recounted against the file's own "five" figure, which already excluded the sixth,
    quiz, packet — an existing gap left alone); the "never carries `transcript`" paragraph gained the exception.
  - `meetings.md`: the intro and record-section sentences amended for the exception; the transcript block's button
    documented inline; the `AI에 보내지 않기` caption and the transcript note's history both updated; a new
    `## Transcript to minutes (2026-10-02)` subsection (the button, the bridge, apply-then-save, training, the two
    caption edits); a new E2E coverage paragraph for `flow14.js`'s 13 steps; the "never read anywhere" bullet in
    "What a meeting never does" gained the exception.
  - `daily-work.md`: a new "A third caller of `importWork` — the minutes bridge" subsection (`keepModal`, the
    return value, the `source`/`link`/track shape of a registered item, and that it outlives an abandoned form).
  - `state-lifecycle.md`: a "2026-10-02 (transcript to minutes …)" entry confirming nothing new is stored.
  - `ARCHITECTURE.md`: the Daily assistant row gained the seventh packet's symbols; the Meetings row gained
    `MinutesBridgeModal` and `MeetingModal`'s new props/state; the App root row gained `importWork`'s `keepModal`
    option; the Current status paragraph's E2E count and flow list updated to 314 / `flow14.js`.
  - `RELIABILITY.md`: a new paragraph on both code phases' E2E/mutation coverage (matching the progress notes
    above); a new "Known limits" bullet on the risk that a registered work item outlives an abandoned form.
  - `tech-debt-tracker.md`: TD-135 (no check against the transcript, mitigated), TD-136 (the abandoned-form risk,
    cross-referenced with RELIABILITY.md), TD-137 (`내 담당` flip does not re-run the work dedupe, open), TD-138 (a
    near-cap paste may become a ChatGPT attachment, accepted) — the plan's own next numbers (129+) were already
    taken by the storage-expansion plan, so these start at TD-135 — and TD-139, a **pre-existing** finding from the
    Phase 1 baseline measurement, unrelated to this plan: the heavy-save quiz packet measures 27,045 chars, over
    `QUIZ_PACKET_MAX` (12,000), because its preparation section is never dropped by design.
  - `backlog.md`: item 11, the Share Target follow-up, with its device-test-first instruction.
  - `decision-log.md`: a dated 2026-10-02 row recording the user-approved reversal, for this packet only, of the
    2026-09-17 "no packet ever carries a transcript" decision.
  - `tools/e2e/README.md`: already carried the `flow14.js` row and the 301 → 314 narrative from the Phase 2
    commit; recounted (`grep -c "await step(" tools/e2e/flow*.js`, sums to 314) and left unchanged — no edit
    needed.
  - Grepped `docs/` for "no packet … carries a transcript" / "never … transcript" statements: the prep-packet and
    core-beliefs/decision-log occurrences are either packet-scoped (still true of that one packet) or dated
    historical records, not current-behaviour claims, and were left as written.
  - `npm run docs:gen` (no generated file changed — no schema or data touched) and `npm run docs:check` both exit
    0. `npm run verify` was **not run**, per the standing user instruction; the E2E suite stays written and
    `node --check`ed only.
  - Plan moved to `docs/exec-plans/completed/2026-10-02-transcript-to-minutes.md`.

## Verification
- `npm run build`
- `npm run smoke` (section 11)
- `npm run lang:check`
- `npm run finish`
- `node --check tools/e2e/flow13.js tools/e2e/flow.js`
- baseline diffs: six packets × three saves, plus the `parseWorkReply` fixtures
- throwaway puppeteer checks at 390 px
- mutation checks m1–m9
- `npm run docs:gen && npm run docs:check` (Phase 3)

`npm run verify` is **not** run (standing user instruction); E2E is written only.

## Cleanup checklist
- [x] `npm run finish` exit 0: no unused symbol, no duplicate block (see decision 10), no residue, no Korean outside UI copy/data
- [x] no dead prop on `MeetingModal`/`MinutesBridgeModal`; `importWork`'s existing callers unchanged
- [x] allowlist additions (with reason) mirrored in `tech-debt-tracker.md`
- [x] scratchpad scripts not committed

## Docs to sync
- `docs/design-docs/core-beliefs.md` — append the Rule 7 amendment above, verbatim, after the 2026-09-25 amendment. The heading count stays 19.
- `docs/design-docs/assistant-bridge.md`:
  - a new section `## The seventh packet — 녹취록으로 정리`: sections, caps, the head verbatim, reductions with the measured lengths, the parser table, `MinutesBridgeModal`, and "what it never carries"
  - a new row in the tracks table
  - a note in the work packet's "never a transcript" paragraph that the seventh packet is the one exception
- `docs/product-specs/meetings.md`:
  - amend the intro paragraph ("stores it verbatim and never processes it") for the seventh packet
  - amend the record section's sentence "Only the form, the view, … read it; no packet" for the seventh packet
  - update the `MeetingModal` sheet: the button, the disabled captions, the two copy changes, the applied line
  - add a subsection "Transcript to minutes (2026-10-02)"
  - add E2E coverage (`flow13.js`)
- `docs/SECURITY.md`:
  - "six packets" → seven, with a new bullet
  - the exception added to the "The work packet never carries `transcript` …" paragraph
  - the packet count in the day-job-switch paragraph
  - `buildMinutesPacket` added to the list of `transcript` readers
- `docs/product-specs/daily-work.md` — work items from the minutes bridge: `source: "ai"`, the link rule, `importWork`'s `keepModal`.
- `ARCHITECTURE.md`:
  - Daily assistant region: `MINUTES_*`, both heads, `minutesPacketText`, `buildMinutesPacket`, `minutesReplyCtx`, `parseMinutesReply`
  - Meetings region: `MinutesBridgeModal`, `MeetingModal`'s new props
  - App root: the `importWork` option
- `docs/design-docs/decision-log.md` — a dated row: by the user's decision, the transcript exclusion is reversed for this packet only.
- `docs/exec-plans/tech-debt-tracker.md` — new rows from TD-129:
  - the app cannot check proposed text against the transcript (mitigated by the side-by-side view, per-field ticks and `(확인 필요)` markers)
  - work items registered at `적용` remain if the form is abandoned (stated in the sheet)
  - flipping `내 담당` in the confirm view does not re-run the work dedupe
  - a 40,000-char paste may become a file attachment in ChatGPT
- `docs/exec-plans/backlog.md` — the Share Target item.
- `tools/e2e/README.md` — updated by the implementer in Phase 2.
- `docs/generated/*` — via `npm run docs:gen` only.

## Proposed commit
- Phase 1: `feat(meetings): the minutes packet and its parser — the seventh bridge packet (phase 1)`
- Phase 2: `feat(meetings): turn a pasted transcript into minutes through a send/paste/confirm sheet (phase 2)`
- Phase 3: `docs: the seventh packet, the Rule 7 amendment and the transcript exception`
