# Daily work — meeting progress log, a seventh `업무` tab, and an AI-proposed work list through the bridge

- Status: completed
- Date: 2026-09-17
- Needs approval: yes — a new `migrate` block (v25) and a dated amendment to Rule 7. The user's four recorded decisions below (copy/paste bridge, judge from goals + minutes + progress + everything else, a seventh tab, client minutes in the packet by default with a per-meeting opt-out) are that approval; the implementer does not ask again. No existing `migrate` block, no `CERTS` / `EXAMS` / `WEIGHT_MATRIX` / `CERT_W_EXC` row, no `liferpg-*` key, no `store` call site, no user data deleted.
- Agents: planner → implementer (three phases) → cleanup → docs-syncer. The verifier's E2E run is **not** part of this plan (standing user instruction, below).

## Goal

The user asked, verbatim: `각 회의 후 어떤 업무를 이어서 진행했는지 진행사항 적고 모든일에 대한 요약을 해서 ai를 돌려 어플 내 모든 내용을 분석 후 오늘 할일을 만들어주고(오늘업무사항 탭 만듬) 수기로 추가도 가능하게끔 하고싶어 / 상세한 기획 도와줘`. Four things: (1) each meeting gets a dated **progress log** of the work that followed it; (2) the app summarises everything it holds, the user runs that through an external AI, and the reply proposes **today's work**; (3) a **seventh bottom tab** shows today's work; (4) work items can also be **added by hand**.

Decisions the user made (final):
1. The AI runs through the existing copy/paste bridge — a text packet out, a pasted reply in; no key, no network, no server.
2. The packet carries the existing goals, the meeting minutes and their progress logs, what has been done, and the rest of the app's facts (`기존목표 + 회의록들과 한 일들분석 후 판단 + 기타 등등`).
3. A seventh tab.
4. Client meetings go into the packet **by default**, with a per-meeting `AI에 보내지 않기` flag — reversing the 2026-09-16 default that the packet never reads a meeting (backlog item "Whether the assistant packet may ever summarise meeting minutes" closes with this plan).

Design decision this plan builds on (made by the main agent): **a work item is a new record kind, not a goal task.** Rule 19's amendment restricts goal tasks to reading, exercise, certifications and study, so `견적서 송부` cannot be a task. A work item is a dated record — title, optional note, a done flag, an optional link to a goal, a meeting or a project, and a `source` of `manual` or `ai`. It pays nothing, moves no grade, streak, KR or goal, and never enters `computeGrades`, `krProgress`, `goalProgress`, `agendaOf`, `todoOf`, `buildBriefing`, the trophy wall or an achievement log ([Rule 1](../../design-docs/core-beliefs.md#rule-1), [Rule 8](../../design-docs/core-beliefs.md#rule-8), [Rule 9](../../design-docs/core-beliefs.md#rule-9), [Rule 18](../../design-docs/core-beliefs.md#rule-18)).

**E2E policy for this plan:** every E2E step below is written and must parse (`node --check`), but `npm run verify` / `node tools/e2e/run.js` are **not executed** in any phase (standing user instruction). The gates are `npm run build`, `npm run finish`, `npm run lang:check`, `npm run docs:gen && npm run docs:check`. `npm run smoke` is not required (no engine formula changes) and is harmless to run.

## Context read

- `AGENTS.md` §3 (routing), §4 (prompt-first), §6 (language), §7 (never-do); `docs/PLANS.md`; `docs/FRONTEND.md` (clone pattern, schema-change checklist, Tailwind v3 core only, `Modal` shell, list caps, demoState rule); `ARCHITECTURE.md` (file regions, anchors).
- `src/LifeManager.jsx` (7,982 lines today; every line number below is approximate — re-grep the anchor): imports (lines 1–5: `IdCard, ClipboardList, CalendarDays, MessagesSquare, Briefcase` from lucide-react 0.460.0, which ships `list-checks`); `SectionLabel` (~1907); `todoOf` / `TODO_TONE` / `TodoRow({ lead, title, done, marker, onOpen })` / `NO_GOAL_MARKER` (~2466, ~4848–4885); `PACKET_MAX` / `PACKET_EVENT_DAYS` / `PACKET_BIZ_LINES` / `PACKET_HEAD` / `buildAssistantPacket` / `IMPORT_MAX` / `parseAssistantReply` (~2728–2840); `@schema` JSDoc + `migrate` v23/v24 blocks + `freshState` (`v: 24`) + `demoState` (~3026–3330, demo meetings at ~3310); `CvFact` (~3892); `BridgeModal` (~4488); meetings region banner + storage arithmetic comment + `MEETING_LIMITS` / `PROJECT_LIMITS` / `MEETING_ROWS_SHOWN` / `mbText` / `meetingOrder` / `meetingEventText` / `meetingsOfTask` (~6658–6710); `MeetingsTab` (~6715), `MeetingModal` (~6845, `eventId` chips at ~6971), `MeetingViewModal` (~6992); root: `addMeeting` / `updateMeeting` / `removeMeeting` / `meetingFits` (~7521–7600), `importTasks` / `storeReply` (~7610–7645), `exportBackup` / `importBackup` (~7701–7760), `NAV` (~7771), `<nav … grid-cols-6>` (~7845), modal switch for `meeting` / `meetingView` / `bridge` (~7935–7955).
- `tools/e2e/run.js` (helpers, `h` object at ~413; `flow.js` is the only file it requires), `tools/e2e/flow.js` (chain at lines 332–341; nav step at ~291 with `want = ["프로필","목표","할 일","일정","미팅","사업"]` and `grid-cols-6`; tab sweeps at ~288 and ~369; fresh-save `v !== 24` at line 72), `flow4.js` (`SCHEMA_V`; the `v23 save → v24 meeting task links` fixture at ~441 is the template), `flow6.js` (backup `v !== 24` at line 117), `flow10.js` (structure, `recordBoundary`, `readState`, `dstrIn`), `tools/e2e/README.md`.
- `tools/harness/finish.config.json` (`duplicatesBlock: true`, window 6 — two modals sharing a copy-pasted six-line block fail the gate), `tools/harness/gen-screenshots.js` (`SHOTS`), `public/manifest.webmanifest` (`screenshots`).
- Docs: `docs/product-specs/meetings.md` (caps, storage arithmetic table, sheets, handlers), `docs/design-docs/assistant-bridge.md` (packet sections, parser rules), `docs/design-docs/core-beliefs.md` (Rule 7 and its 2026-09-09 amendment), `docs/design-docs/information-architecture.md` (screen map, modal list of 28), `docs/DESIGN.md` (six-tab invariant, lucide icons in use), `docs/SECURITY.md` (packet never carries a meeting — to be rewritten), `docs/design-docs/state-lifecycle.md` (shape v24, ledger), `docs/RELIABILITY.md`, `docs/design-docs/demo-data.md`, `docs/product-specs/index.md`, `docs/design-docs/index.md`, `docs/exec-plans/backlog.md` (item 27), `docs/exec-plans/tech-debt-tracker.md` (last id TD-48), `docs/design-docs/decision-log.md`.
- Rules touched by number: [1](../../design-docs/core-beliefs.md#rule-1), [7](../../design-docs/core-beliefs.md#rule-7) (amended), [8](../../design-docs/core-beliefs.md#rule-8), [9](../../design-docs/core-beliefs.md#rule-9), [12](../../design-docs/core-beliefs.md#rule-12), [13](../../design-docs/core-beliefs.md#rule-13), [18](../../design-docs/core-beliefs.md#rule-18), [19](../../design-docs/core-beliefs.md#rule-19). Not touched: 2–6, 10, 11, 14–17.

## Decisions fixed by this plan (the implementer does not re-decide)

| Item | Decision | Why |
|---|---|---|
| Array name and shape | `work: [{ id, date("YYYY-MM-DD"), title, note?, done(boolean), link?{ kind("goal"\|"meeting"\|"project"), id }, source("manual"\|"ai"), createdAt }]` | Short like `deals` / `meetings`; the reply's JSON key is also `work`. `done` is a stored fact, nothing derived is stored |
| Carry-over | Items stay on their date. When viewing today, a `지난 미완료 {n}건` section lists every undone item dated before today with an `오늘로 옮기기` button that sets `date = today` on all of them | Widened from the recommended "yesterday only": an undone item from three days ago would otherwise be stranded out of sight, which [Rule 13](../../design-docs/core-beliefs.md#rule-13) forbids |
| Per-day cap | `WORK_LIMITS = { title: 60, note: 200, perDay: 20 }` — manual adds, AI imports and moves all count against the viewed/target day | Bounds storage without a second budget guard |
| Progress entry | `meetings[].progress: [{ id, date, text }]`, `MEETING_LIMITS.progress = 300` chars, `MEETING_PROGRESS_MAX = 30` entries per meeting; added and deleted **only** in `MeetingViewModal` (not from the task sheet) | One place; the task sheet already shows `관련 회의록` and opens the view |
| AI flag | `meetings[].aiHidden: boolean` (always present, backfilled `false`), a checkbox `AI에 보내지 않기` in `MeetingModal` | The user's decision 4 |
| Seventh tab | `NAV` entry `["work", "업무", ListChecks]` inserted after `["tasks", "할 일", ClipboardList]`: `프로필 · 목표 · 할 일 · 업무 · 일정 · 미팅 · 사업`; `<nav>` becomes `grid-cols-7` | Label: at 390 px the bar is 390 − 24 (`inset-x-3`) − 8 (`px-1`) = 358 px, so seven cells are ≈ 51 px; `프로필` (3 glyphs at `text-xs`) is ≈ 36 px, `오늘 업무` (4 glyphs + a space) is ≈ 51 px and would clip, `업무` ≈ 24 px fits. Position: next to `할 일` so the two "today" lists sit together and the first three tabs keep their positions. `ListChecks` is distinct from `ClipboardList` and `Briefcase` |
| Viewed date | Component state (`viewDate`) in `WorkTab`, paged with `‹` / `›` / `오늘`; never stored, no `ui.workDate` | [Rule 9](../../design-docs/core-beliefs.md#rule-9); same pattern as `ScheduleCalendar` |
| Sheets | `modal.type` gains `work` (`WorkModal` — one form for add, edit, complete, delete) and `workBridge` (`WorkBridgeModal`); 28 → 30 values | One modal for the item keeps the count low |
| Storage guard | `meetingFits(next, prevLen)` is renamed `recordFits(next, prevLen, noun = "회의록")` with the same body; `addWork`, `importWork`, `addProgress` call it with the right noun. No other change to its logic | Progress entries grow an existing meeting record; work items are tiny but the guard is free |
| Dangling links | A work item whose linked goal/meeting/project was deleted keeps its `link`; `workLinkText` states `연결 대상이 삭제됐어요` at render. `removeGoal` / `removeMeeting` / `removeProject` do not touch `work` | Same policy as `eventId` (TD-46); records are never edited by another record's deletion |
| Reply storage | The work reply's raw text is **not** stored anywhere (unlike the goal-task bridge, which writes `journal[].ai`); only ticked items become records | Storing it would overwrite the day's journal reply; nothing derived is stored |
| Icon import | `ListChecks` added to the lucide import; nothing removed | `finish-check` flags unused imports |

## Prompt

The prompt below is what the implementer runs, one phase at a time. Each phase ends with its gates green before the next begins. E2E files are edited and syntax-checked, never executed.

### Phase 1 — schema v25, the meeting progress log, work records, the `업무` tab (manual only)

**Goal.** Add schema v25 (`work[]`, `meetings[].progress[]`, `meetings[].aiHidden`), the progress log in the meeting view, the `AI에 보내지 않기` flag in the meeting form, the work record kind with its handlers, the seventh tab `업무` with a day pager, an add/edit sheet, in-place completion and the past-undone mover. No packet or parser in this phase.

**Files.** `src/LifeManager.jsx` only, plus `tools/e2e/flow.js`, `flow4.js`, `flow6.js`, new `flow11.js`, `tools/e2e/README.md`.

**Constraints.** Rules [1](../../design-docs/core-beliefs.md#rule-1), [7](../../design-docs/core-beliefs.md#rule-7), [8](../../design-docs/core-beliefs.md#rule-8), [9](../../design-docs/core-beliefs.md#rule-9), [12](../../design-docs/core-beliefs.md#rule-12), [13](../../design-docs/core-beliefs.md#rule-13), [18](../../design-docs/core-beliefs.md#rule-18), [19](../../design-docs/core-beliefs.md#rule-19). `docs/FRONTEND.md` conventions: clone pattern, `Modal` shell, Tailwind v3 core utilities only, lucide only, `font-mono` for dates/counts, capped lists, `demoState` updated in the same phase. Korean UI copy exactly as quoted here, `해요체`, facts only; identifiers, comments and E2E step names in English. Do not touch `CERTS` / `EXAMS` / `WEIGHT_MATRIX` / `CERT_W_EXC`, any existing `migrate` block, `store` call sites, `liferpg-*` keys, `buildAssistantPacket`, `parseAssistantReply`, `todoOf`, `agendaOf`, `buildBriefing`, `computeGrades`, `krProgress`, `completeTask`, `tryComplete`, `calendarExportOf`. No horizontal scroll at 390 px.

**1. Schema v25** (`@schema` JSDoc, `migrate`, `freshState`, `demoState`):
- New block appended after v24, nothing else edited:
  ```js
  if (s.v < 25) {
    // v25: daily work items — work[], dated records outside the goal ladder (typed by hand or proposed by the assistant
    // and confirmed by the user) — and two meeting fields: progress[] (dated entries of the work that followed the
    // meeting) and aiHidden (true = the work packet carries this meeting's date and title only). Records, never tasks:
    // no payout, trophy, goal, KR or streak (rules 1, 7, 9, 18). Every existing field passes through untouched.
    s = { ...s, v: 25, work: Array.isArray(s.work) ? s.work : [],
      meetings: (s.meetings || []).map((m) => ({ ...m, progress: Array.isArray(m.progress) ? m.progress : [], aiHidden: m.aiHidden === true })) };
  }
  ```
- `freshState`: `v: 25`, `work: []` after `meetings: []`.
- `@schema` header `v25`, `v: 25`; `meetings` line gains `progress: [{ id, date("YYYY-MM-DD"), text }], aiHidden` with a trailing comment (progress = the work that followed, at most 30 entries of 300 chars; aiHidden = excluded from the work packet body); a new `work: [{ id, date("YYYY-MM-DD"), title, note?, done, link?{ kind("goal"|"meeting"|"project"), id }, source("manual"|"ai"), createdAt }]` line with the comment "daily work items (v25): records outside the goal ladder — no payout, trophy, goal, KR or streak (rules 1, 7, 9, 18); `done` is a stored fact; the day view, the past-undone list and the link label are derived". The derived-values list gains `workOn` / `workPastOpen` / `workLinkText` (and, in Phase 2, `buildWorkPacket`).
- `demoState`: every demo meeting gets `progress: []` and `aiHidden: false`, except `유지보수 범위 협의` gets one entry `{ id: uid(), date: shiftDay(today, -2), text: "월 10시간 한도를 반영한 유지보수 견적서 초안 작성" }` and `요구사항 1차 회의` gets `aiHidden: true` (so the demo shows the flag). `s.work` = two items dated `today`: `{ title: "○○물산 유지보수 견적서 송부", note: "월 10시간 · 초과분 시간 단가", done: false, link: { kind: "project", id: mp1.id }, source: "manual" }` and `{ title: "전기기사 필기 기출 1회분 채점", done: true, link: { kind: "goal", id: gHarness.id }, source: "ai" }`, each with `id: uid()`, `date: today`, `createdAt: today`.

**2. Constants and pure helpers** (new region banner `/* ───────────────────────── Daily work — dated work items (schema v25) ───────────────────────── */` placed after the meetings region and before the business-tab region; its header comment carries the storage arithmetic from §"Storage arithmetic" below):
- `WORK_LIMITS = { title: 60, note: 200, perDay: 20 }`; `WORK_LINK_MEETINGS = 20` (meetings offered by the link picker, newest first).
- `MEETING_LIMITS.progress = 300` (added to the existing object) and `MEETING_PROGRESS_MAX = 30` in the meetings region.
- `normWorkTitle(t) = String(t || "").trim().replace(/\s+/g, "").toLowerCase()`.
- `workOn(state, date)` → items with that `date`, `createdAt` ascending then array order (a done item keeps its position — the user's stated preference that a completed row never vanishes).
- `workPastOpen(state, today)` → undone items with `date < today`, date descending.
- `workLinkText(state, item)` → `""` with no link; `목표 · {title}` / `회의록 · {date} {title}` / `프로젝트 · {name}` when the target exists; `연결 대상이 삭제됐어요` when it does not.
- `workLinkOptions(state)` → the picker rows: active goals (`goal`), the newest `WORK_LINK_MEETINGS` meetings by `meetingOrder` (`meeting`), every project (`project`), each `{ kind, id, label }` with the same label text as `workLinkText`.
- `recordFits(next, prevLen = 0, noun = "회의록")` — the renamed `meetingFits`; message `저장 공간이 부족해요 — 현재 {mb}MB 사용 중이라 {noun}을 저장하지 않았어요. 백업을 내보낸 뒤 오래된 회의록이나 사진을 지워요.` (the existing sentence with the noun substituted; for `업무` the particle reads `업무를` — build the object-marked noun in the caller: pass `"회의록을"` / `"업무를"` / `"진행사항을"` so the helper does no grammar).

**3. Meeting progress log.**
- `MeetingsTab` row: `TodoRow` gains `marker={m.progress?.length ? <span className="text-xs text-zinc-500 shrink-0">진행 {m.progress.length}건</span> : null}`.
- `MeetingModal`: below the `일정 연결 (선택)` chips, a `<label className="flex items-start gap-2">` with `<input type="checkbox">` and the text `AI에 보내지 않기`, caption under it (`text-xs text-zinc-600`): `켜면 오늘 업무 만들기 패킷에 이 회의록의 날짜와 제목만 실려요.` State `aiHidden` initialised from the record (`meeting?.aiHidden === true`); the saved record always carries `aiHidden` (boolean) and keeps `progress: meeting?.progress || []` on an edit (the form never edits entries).
- `MeetingViewModal`: `CvFact label="AI 전송"` after `일정`: `보내지 않음` when `aiHidden`, else `요약·진행사항 포함`. New block after `후속 조치` and before `연결된 할 일`: `SectionLabel` `진행사항` with a mono `{n}건` on the right; entries newest first (`date` desc, then array order desc), each a `div` with `<span className="font-mono text-xs text-zinc-500">{date}</span>`, the text `whitespace-pre-wrap break-words text-sm`, and an `X` icon button `aria-label="진행사항 삭제"` calling `onRemoveProgress(m.id, entry.id)` after `window.confirm("진행사항을 삭제해요. 계속할까요?")`; empty state `진행사항이 없어요.`; then a `MeetingText` textarea (`rows=2`, `cap={MEETING_LIMITS.progress}`, placeholder `진행사항 추가 — 이 회의 뒤에 이어간 업무를 적어요`) and a `추가` button. Refusals shown in a `text-xs text-rose-400` line: `진행사항을 입력해 주세요.`, `진행사항은 300자까지예요 — 지금 {n}자예요.`, `진행사항은 30건까지예요.`, or the storage message returned by `onAddProgress`. New props: `onAddProgress(meetingId, text) → error string ("" = saved)`, `onRemoveProgress(meetingId, entryId)`.
- Root handlers beside the meeting handlers: `addProgress(meetingId, text)` builds `{ ...cur, progress: [{ id: uid(), date: today, text }, ...cur.progress] }`, runs `recordFits(rec, JSON.stringify(cur).length, "진행사항을")`, refuses over `MEETING_PROGRESS_MAX`, writes with the clone pattern, toast `진행사항을 추가했어요`; `removeProgress(meetingId, entryId)` filters, toast `진행사항을 삭제했어요`. Neither touches `tasks`, `goals`, `act`, `room`, `events`, `work`.

**4. Work handlers** (root, after the meeting handlers, all clone-pattern, writing `work` only):
- `addWork(next)` → refuses with `업무는 하루 20건까지예요.` when `workOn(state, next.date).length >= WORK_LIMITS.perDay`, then `recordFits(rec, 0, "업무를")`; prepends `{ id: uid(), ...next, done: false, source: "manual", createdAt: today }`; returns the error string (`""` = saved); toast `업무를 등록했어요`.
- `updateWork(id, next)` → replaces title/note/link keeping `id`, `date`, `done`, `source`, `createdAt`; toast `업무를 수정했어요`.
- `toggleWork(id)` → flips `done`; toast `완료로 표시했어요` / `완료를 취소했어요`. Nothing else changes — no `act.streak`, no `lastActive`, no trophy, no KR ([Rule 1](../../design-docs/core-beliefs.md#rule-1), [Rule 9](../../design-docs/core-beliefs.md#rule-9)).
- `removeWork(id)` → `window.confirm("{title} 업무를 삭제해요. 계속할까요?")`, then filters; toast `업무를 삭제했어요`.
- `moveWorkToToday(ids)` → sets `date = today` on those items; refuses (toast only) with `업무는 하루 20건까지예요 — {n}건만 옮길 수 있어요.` when the move would exceed the cap, moving the newest `n` that fit; toast `미완료 {n}건을 오늘로 옮겼어요`.

**5. `WorkTab({ state, today, onAdd, onOpen, onBridge })`** — `onBridge` is wired in Phase 2 (pass a no-op until then and do **not** render its button in Phase 1, so `finish` sees no dead prop; simplest: add the prop and the button together in Phase 2):
- `viewDate` component state (initial `today`); header section: `SectionLabel tone="text-cyan-400"` reading `오늘 업무 — {today}` when `viewDate === today`, else `업무 — {viewDate}`; on the right a `업무 추가` button (same style as `프로젝트 추가`); under it a row of three small chips `‹` / `오늘` / `›` (the calendar header's pattern; `오늘` disabled when already today); caption `업무는 기록이에요 — 목표·실행·점수에 반영되지 않아요.`; counts line (`font-mono text-xs text-zinc-400`, fragments `whitespace-nowrap`): `남음 {open}건 · 완료 {done}건 · AI 제안 {ai}건 · 저장 공간 {mb}MB / 3.5MB` (`storageUsedWith(state)` memoised on `state`, like `MeetingsTab`).
- When `viewDate === today` and `workPastOpen` is non-empty: a section titled `지난 미완료 {n}건` with an `오늘로 옮기기` button and one `TodoRow` per item (lead `{date.slice(5)}` with `TODO_TONE.overdue` and `border-zinc-700`, marker = link kind word as below, `onOpen`).
- The day's list: one `TodoRow` per `workOn(state, viewDate)` item — lead chip `AI` (`text-violet-300 border-violet-700`) for `source === "ai"`, `수기` (`text-zinc-400 border-zinc-700`) for manual; `done` prop from the item; marker: `<span className="text-xs text-zinc-600 shrink-0">{목표|회의록|프로젝트}</span>` when linked (the kind word only — at most one marker per row), none otherwise. Empty: `오늘 업무가 없어요.` (today) / `이 날짜에는 업무가 없어요.` (other days).
- Every row calls `onOpen(id)` → `setModal({ type: "work", workId })`; `업무 추가` → `setModal({ type: "work", date: viewDate })`.

**6. `WorkModal({ state, work, date, today, onClose, onAdd, onUpdate, onToggle, onRemove })`**, `modal: { type: "work", workId?, date? }`, title `업무 추가` / `업무`:
- Edit mode facts first (`CvFact` rows): `날짜` (mono), `출처` (`수기` / `AI 제안`), `상태` (`완료` / `미완료`), `연결` (`workLinkText` or `연결 없음`).
- Fields: input placeholder `업무 제목 — 예: 견적서 송부` (no `maxLength`; the submit refuses), `MeetingText` textarea `메모 (선택)` (`rows=3`, `cap={WORK_LIMITS.note}`), a `<select>` labelled `연결 (선택)` with `연결 안 함` plus `workLinkOptions` rows (the `<option>` text is the label; value `{kind}:{id}`).
- Submit refuses in order: `업무 제목을 입력해 주세요.`, `업무 제목은 60자까지예요 — 지금 {n}자예요.`, `메모는 200자까지예요 — 지금 {n}자예요.`, then whatever `onAdd` returns (the cap or storage line). The record is built with only non-empty optional fields (`note`, `link`).
- Buttons: add mode `등록`; edit mode `저장`, then a full-width `완료로 표시` / `완료 취소` (calls `onToggle(id)` and closes), then `삭제` (rose text). The submit passes `{ date, title, note?, link? }`.

**7. Root wiring.** `NAV` and `grid-cols-7` as decided; `tab === "work"` renders `WorkTab`; the modal switch renders `WorkModal` for `modal.type === "work"`; `MeetingViewModal` gets `onAddProgress={addProgress}` `onRemoveProgress={removeProgress}`. `TAB_ACTIONS` is unchanged (no briefing line routes to `업무`).

**8. Meetings region comment and `recordFits` rename.** Update the storage-arithmetic banner comment in the meetings region (progress figures from §"Storage arithmetic"); rename `meetingFits` → `recordFits` at its definition and its two call sites; no logic change.

**9. E2E (written, not run).**
- `flow.js`: line ~72 fresh-save assertion 24 → 25; the nav step renamed `bottom nav order and one-line labels (profile, goals, to-do, work, schedule, meetings, business)` with `want = ["프로필","목표","할 일","업무","일정","미팅","사업"]` and `grid-cols-7` (error text `the nav bar is not a seven-column grid`); both tab sweeps gain `업무` (after `할 일`); the demo sweep, when `tab === "업무"`, expects `남음 1건 · 완료 1건 · AI 제안 1건`. Add `await require("./flow11.js")(h);` between `flow10.js` and `flow4.js` with the comment `// before flow4, which replaces the save`.
- `flow4.js`: `SCHEMA_V` 24 → 25; new step `v24 save → v25 work items and meeting progress` modelled on the v24 fixture: a v24 save with one meeting carrying `taskIds: ["tz"]` and no `progress` / `aiHidden` and no `work` key; after `migrateFixture`: `st.work` is `[]`, `st.meetings[0]` equals `{ ...meeting, progress: [], aiHidden: false }`, every other key byte-equal (`same`), and no key added beyond `work`; then `clickTab("업무")` and `expectText("오늘 업무가 없어요.")`.
- `flow6.js`: backup version 24 → 25.
- New `tools/e2e/flow11.js` (header comment in English: the `업무` tab and the meeting progress log — a work item is a record, never a task; runs after `flow10.js` and before `flow4.js`). Uses `h.recordBoundary`, `readState` and `dstrIn` copied by reference from the `flow10.js` pattern (define the same tiny local helpers; they are under the six-line duplicate window). Phase 1 steps:
  1. `the work tab starts empty, states today's date and its counts, and pages to another day` — `clickTab("업무")`, `expectText("오늘 업무 — " + today)`, `expectText("오늘 업무가 없어요.")`, counts line contains `남음 0건 · 완료 0건 · AI 제안 0건` and `저장 공간`; click `‹`, expect `업무 — {yesterday}` and `이 날짜에는 업무가 없어요.`; click `오늘`, expect `오늘 업무 — {today}`.
  2. `a progress entry is added to a meeting, listed newest first with its date, and the list row counts it` — open the `미팅` tab, tap the first minutes row of the first project (plant one meeting via `readState`/`localStorage` + reload if `flow10.js` left none — plant explicitly to be safe: one project and one meeting dated `dstrIn(-1)` with `aiHidden: false`, `progress: []`), type `견적서 초안 작성` into the `진행사항 추가` textarea, click `추가`; assert the entry text and today's date render inside the view, `readState().meetings[i].progress.length === 1` with `date === today`; close, assert the row's marker `진행 1건`. Then `recordBoundary` before/after the add must be identical.
  3. `the progress textarea refuses an empty and an over-cap entry` — click `추가` with nothing typed → `진행사항을 입력해 주세요.`; type 301 chars → `진행사항은 300자까지예요 — 지금 301자예요.`; the save's progress count is still 1.
  4. `the AI flag is saved from the meeting form and stated in the view` — `수정`, tick `AI에 보내지 않기`, `저장`; `readState()` meeting has `aiHidden === true`; view shows `AI 전송` `보내지 않음`; untick again in the same step and assert `false` + `요약·진행사항 포함` (leaves it visible for the packet step, which plants its own hidden meeting).
  5. `a manual work item registers under today with source manual and changes no task, goal, streak or trophy` — `clickTab("업무")`, `업무 추가`, empty submit → `업무 제목을 입력해 주세요.`; type `견적서 송부`, note `○○물산`, pick the project option in `연결 (선택)`, `등록`; the row shows lead `수기`, title, marker `프로젝트`; `readState().work` has one item `{ date: today, done: false, source: "manual", link: { kind: "project" } }`; `recordBoundary` unchanged; `tasks` byte-identical.
  6. `a work item completed from its sheet stays in place struck through and counts as done` — tap the row, `완료로 표시`; the row is still in today's list, has `line-through`, counts line reads `남음 0건 · 완료 1건`; `readState().work[0].done === true`; `act.streak` / `act.lastActive` / trophies unchanged. Tap again, `완료 취소`, assert `done === false`.
  7. `an undone item from a past date is listed under 지난 미완료 and moves to today` — plant via `localStorage` an item dated `dstrIn(-3)` (`done: false`, `source: "manual"`) and reload; `clickTab("업무")`; expect `지난 미완료 1건` and the row with lead `MM-DD`; click `오늘로 옮기기`; expect the section gone, the item under today, `readState()` item `date === today`; toast text `미완료 1건을 오늘로 옮겼어요`.
  8. `the per-day cap refuses a twenty-first item` — plant 20 items dated today, reload, `업무 추가` → title `스물한 번째` → `등록` → `업무는 하루 20건까지예요.`; count still 20; remove the planted 20 afterwards (write `work` back to the two items this file created).
  9. `work items and meeting progress travel in the backup file` — `openSettings()`, `captureDownload(() => clickInModal("백업 내보내기"))`, parse; `data.state.v === 25`, `data.state.work.length >= 1`, the planted meeting's `progress.length === 1`.
  The file ends by deleting the items and the meeting it planted (restore `work: []`, remove the planted project/meeting) so `flow4.js` starts from the save it used to.
- `tools/e2e/README.md`: a `flow11.js` row and the updated `flow.js` / `flow4.js` / `flow6.js` descriptions; the status note gains a 2026-09-17 sentence (steps written under the standing instruction, not run).
- `node --check` on every edited E2E file.

**Acceptance (Phase 1).**
- `npm run build` passes; `npm run finish` exit 0 (no unused import, no duplicate ≥ 6 lines, no residue, no Korean outside UI copy); `npm run lang:check` clean; `npm run docs:gen && npm run docs:check` clean (db-schema regenerates at v25 with 15 migration blocks; the symbol index lists `WorkTab`, `WorkModal`, `workOn`, `workPastOpen`, `workLinkText`, `workLinkOptions`, `normWorkTitle`, `recordFits`, `WORK_LIMITS`, `MEETING_PROGRESS_MAX`).
- Throwaway puppeteer check on `npm run build:demo` output at 390 × 844 (script in the session scratchpad, not the repo): the demo save is v25; the nav has seven labels, each span `height ≤ 18` and `scrollWidth ≤ clientWidth`; `document.documentElement.scrollWidth === 390` on the `업무` tab, the work sheet, the meeting view with the progress block open; the demo `업무` tab shows one `수기` row and one struck-through `AI` row; the demo meeting `유지보수 범위 협의` shows `진행 1건`; no console errors.
- `readState()`-level checks in the same throwaway script: toggling a work item changes `work` only (deep-compare every other top-level key before/after).

### Phase 2 — the work packet, the parser, the confirmation flow, and the Rule 7 amendment

**Goal.** A second bridge packet `오늘 업무 만들기`, a parser that reads only `work`, a confirmation sheet that imports ticked proposals as `source: "ai"` items dated today, and the Rule 7 amendment.

**Files.** `src/LifeManager.jsx`; `docs/design-docs/core-beliefs.md` (Rule 7 only); `tools/e2e/flow11.js`, `tools/e2e/README.md`.

**Constraints.** As Phase 1, plus: `buildAssistantPacket`, `PACKET_HEAD`, `parseAssistantReply`, `importTasks`, `storeReply` and `journal[].ai` handling are byte-identical after this phase (the goal-task bridge is untouched). The packet never carries `profile.name`, `birth`, `email`, `phone`, a school or an employer name — the CV line is `cvSummaryOf` only, exactly as the existing packet. No photo, no evidence text, no journal entry text (the journal is the daily briefing packet's domain).

**1. Constants** (assistant-bridge region, after `PACKET_HEAD`):
- `WORK_PROPOSAL_MAX = 8`, `WORK_PACKET_MEETINGS = 6` (newest meetings by `meetingOrder`), `WORK_PACKET_PROGRESS = 3` (newest entries per meeting), `WORK_PACKET_SUMMARY = 200` (chars of `summary` per meeting; `decisions` / `actions` / progress text clip at 100 each), `WORK_PACKET_TASKS = 10`, `WORK_PACKET_EVENTS = 8` (reuse `PACKET_EVENT_DAYS` = 14 for the window), `WORK_PACKET_RECORDS = 20` (yesterday's + today's items).
- `WORK_PACKET_HEAD` lines (each a Korean string, verbatim):
  - `역할: 이 사용자의 목표·회의록·진행사항·기록을 근거로 오늘 처리할 업무를 제안하는 비서예요. 아래 데이터만 근거로 답해요.`
  - `규칙: 1) 사실과 숫자만 써요. 격려·낙관·희망 표현은 쓰지 않아요. 해요체로 써요.`
  - `2) 점수·등급·지급액·난이도 값은 평가하거나 바꾸지 않아요.`
  - `3) 제안은 오늘 처리할 업무 항목만이에요 — 최대 8건, 제목 60자·메모 200자 이내. 실행·일정·계약·회의록을 만들거나 바꾸지 않아요. '업무 기록'에 이미 있는 항목은 다시 제안하지 않아요.`
  - `4) 각 항목의 근거가 된 목표·회의록·프로젝트 이름을 link.title에 아래 데이터의 표기 그대로 적어요. 근거가 없으면 link를 생략해요.`
  - `5) 답변 형식: ① 회의록·진행사항·목표를 근거로 한 분석 5줄 이내 ② 마지막에 아래 JSON 블록 1개 (제안이 없으면 "work": []).`
  - the fence line, then the template `{"work":[{"title":"...","note":"근거 한 줄","link":{"kind":"goal|meeting|project","title":"<이름 그대로>"}}],"note":"한 줄"}`, then the closing fence.

**2. `buildWorkPacket(state, today)`** — a pure function beside `buildAssistantPacket`, sharing its `sec()` shape (extract `packetSection(title, lines)` to module level and have both packets call it, so the two do not carry the same six lines). First line `[인생 관리 — 오늘 업무 제안 요청 {today}]`, then `WORK_PACKET_HEAD`, a blank line, then the sections in this order:

| Heading | Lines | Cap |
|---|---|---|
| `## 이력` | `- {cv.edu} / {cv.career}` from `cvSummaryOf(state.profile, today)`; `- 없음` when `!cv.any` | 1 |
| `## 목표` | the same line shape as the daily packet's goals section (title · deadline + D-day · progress % · pace label · up to 4 KR remainders) | 5 goals |
| `## 열린 할 일` | task rows of `todoOf(state, today)` with `kind === "task"` and not `done`, in list order: `- {group label} · {title} · {goal title \| 목표 없음} · 기한 {due \| 없음}` (group label from `TODO_GROUPS`) | `WORK_PACKET_TASKS` |
| `## 다가오는 일정 (14일)` | the daily packet's event line shape | `WORK_PACKET_EVENTS` |
| `## 사업 (계약·매출)` | the daily packet's business lines (same construction — extract `bizPacketLines(state, today)` to module level and call it from both packets) | `PACKET_BIZ_LINES` |
| `## 최근 회의록 ({n}건)` | newest `WORK_PACKET_MEETINGS` meetings by `meetingOrder`. A visible meeting: `- {date} [{project name \| 프로젝트 없음}] {title}` then indented lines `  요약: {summary clipped, newlines → " / "}`, `  결정: {decisions}` and `  후속: {actions}` only when present, then `  진행 {entry.date}: {text}` for the newest `WORK_PACKET_PROGRESS` entries. A meeting with `aiHidden`: the title line followed by `  내용 비공개 (AI에 보내지 않기)` and nothing else. `- 없음` with no meeting | 6 meetings |
| `## 업무 기록 (어제·오늘)` | items dated `shiftDay(today, -1)` and `today`, date then `createdAt` ascending: `- {date} {완료 \| 미완료} {title}{ · 메모: note clipped 60}` | `WORK_PACKET_RECORDS` |

Trim order when the text exceeds `PACKET_MAX` (4,000), applied one step at a time, rebuilding after each, until it fits: (1) meetings 6 → 5 → 4 → 3 → 2, dropping the oldest; (2) `summary` clip 200 → 100 and progress entries 3 → 1 per meeting; (3) event lines 8 → 0; (4) business lines to the first line only; (5) open task lines 10 → 0; (6) work-record lines 20 → 0 (last — the parser dedupes by title on its own, so the packet can lose them and still be safe); (7) meetings 2 → 0. The CV line, the goals and the header are never dropped: at ≈ 40 chars per goal line and ≈ 800 chars of header, the floor is far under 4,000, so the packet always fits. Implement as an array of reduction closures iterated in order, not nested loops, so the order is readable and testable.

**3. `parseWorkReply(text, state, today)`** — beside `parseAssistantReply`:
- Reads the first fenced ```` ```json ```` block; `data.work` must be an array; only `data.work` and `data.note` (≤ 200 chars) are read — `tasks`, `deals`, `events`, `rates`, `folio`, `meetings` or any other key is ignored entirely (not merged, not stored).
- At most `WORK_PROPOSAL_MAX` proposals; each `{ key: "w{n}", title, note, link, linkText, reject }`:
  - `title = String(t?.title || "").trim().slice(0, 60)`; empty → `reject = "제목이 없어요"`.
  - `note = String(t?.note || "").trim().slice(0, 200)` (`""` when absent).
  - `link`: when `t.link?.kind` ∈ `goal` / `meeting` / `project` and `t.link.title` is a non-empty string, resolve against active goals (`title`), all meetings (`title`, newest first by `meetingOrder`), all projects (`name`): exact match first, then substring either way; the first hit wins; no hit → `link = null`, `linkText = "연결 없음 — {wanted}"`; a resolved link renders `workLinkText`. A bad kind → `null`.
  - Duplicate: `reject = "오늘 업무에 이미 있어요"` when `normWorkTitle(title)` equals that of any item in `workOn(state, today)` or of an earlier proposal in the same reply.
  - Returns `{ raw, note, proposals }`. Nothing here writes state.

**4. `WorkBridgeModal({ state, today, onClose, onImport, onToast })`**, `modal: { type: "workBridge" }`, title `오늘 업무 만들기` in send mode, `AI 답변 붙여넣기` otherwise. Refactor `BridgeModal` first so both share two module-level pieces (no six-line duplicate):
- `copyPacket(taRef, text, onToast)` — the existing `copy` body lifted out (clipboard first, `select()` + `execCommand("copy")` fallback, the two toasts unchanged).
- `PacketSendPane({ packet, caption, taRef, onCopy, onPaste })` — caption paragraph, the read-only textarea (`rows=9`, `font-mono`), the `복사` and `AI 답변 붙여넣기 ›` buttons.
- `ReplyPastePane({ reply, setReply, onCheck })` — the paste textarea (`AI 답변을 여기에 붙여넣어요`) and `답변 확인`.
`BridgeModal`'s UI copy and behaviour stay byte-identical from the user's side (`flow5.js` steps unchanged).
- Send mode caption: `아래 글을 복사해 Claude·ChatGPT 채팅에 붙여넣고, 답변을 받아 다시 붙여넣어요. 앱은 네트워크를 쓰지 않아요. 회의록 요약과 진행사항이 실려요 — 보내지 않을 회의록은 회의록 수정에서 'AI에 보내지 않기'를 켜요.`
- Confirm view: `제안 업무 확인 — {n}건`, `parsed.note` under it, one row per proposal: checkbox (disabled when rejected; pre-ticked when not rejected), `{title}` bold, second line `{linkText || "연결 없음"}{note ? " · " + note : ""}`, a rose reason line when rejected; `제안 업무 없음 — 등록할 항목이 없어요.` when empty; button `선택한 업무 등록`. The confirm calls `onImport(list)` with the ticked, non-rejected proposals.
- Root `importWork(list)`: refuses beyond the cap with the toast `업무는 하루 20건까지예요 — {n}건만 등록했어요.` (registers the first `n` that fit), runs `recordFits` on the batch (`"업무를"`), prepends items `{ id: uid(), date: today, title, note?, link?, done: false, source: "ai", createdAt: today }` (an unresolved link is simply omitted), toast `AI 제안 업무 {n}건 등록`; the raw reply is not stored.
- `WorkTab` gains the `AI로 만들기 ›` button (header, next to `업무 추가`, `border` style) → `setModal({ type: "workBridge" })`; the root renders `WorkBridgeModal` for that type.

**5. Rule 7 amendment** — append this paragraph to Rule 7 in `docs/design-docs/core-beliefs.md`, after the 2026-09-09 amendment, heading count unchanged (19):

> **Amendment 2026-09-17 (user approval):** the bridge carries a second packet, `오늘 업무 만들기` (`buildWorkPacket` / `parseWorkReply`), which — by the user's own decision, reversing the 2026-09-16 default — includes meeting minutes summaries, decisions, follow-ups and progress entries for every meeting except one whose `aiHidden` flag is set, of which only the date and title appear. A reply to it can only *propose* **work items** (`work[]`, `docs/product-specs/daily-work.md` (written as a relative markdown link from core-beliefs.md, `../product-specs/daily-work.md`)): dated records outside the goal ladder that pay nothing, move no grade, streak, KR or goal, and never enter `computeGrades`, `krProgress`, the achievement wall or an achievement log. A proposal becomes a record only when the user ticks it, arrives with `source: "ai"` and `done: false`, and nothing in a reply completes, pays, promotes or edits any existing record. This parser reads the reply's `work` key only — `tasks`, `deals`, `events` or any other key is ignored — and `parseAssistantReply` is unchanged. The packet still never carries the profile name, birth date, contact, school or employer, and still makes no network call.

**6. E2E (written, not run)** — `flow11.js` continues with:
  10. `the work packet carries a meeting's summary and progress, only the title and date of a hidden meeting, and no profile identifier` — plant two meetings under the planted project: A (`aiHidden: false`, `summary: "검색 범위 협의 완료"`, one progress entry `색인 스크립트 초안 작성`) and B (`aiHidden: true`, `title: "비공개 단가 협의"`, `summary: "단가 3% 인하 합의"`); reload, `clickTab("업무")`, `AI로 만들기 ›`; read the textarea: contains `## 최근 회의록`, `검색 범위 협의 완료`, `진행 ` + today + `: 색인 스크립트 초안 작성`, `비공개 단가 협의`, `내용 비공개 (AI에 보내지 않기)`; does **not** contain `단가 3% 인하 합의`; does not contain the profile name, birth date, e-mail, phone, school or company typed in `flow.js` / `flow3.js` (read them from `readState().profile` and assert each absent, as `flow8.js`'s privacy step does); length ≤ 4000; contains `## 이력`, `## 목표`, `## 업무 기록`, and the item `견적서 송부` from step 5 with `미완료`.
  11. `a pasted work reply imports the ticked proposals with source ai and refuses the duplicate` — `AI 답변 붙여넣기 ›`, paste a reply whose JSON block has three proposals: `견적서 송부` (duplicate of step 5 → reason `오늘 업무에 이미 있어요`, checkbox disabled), `전기기사 기출 채점` with `link: { kind: "goal", title: <the active goal's title read from the save> }` (row states `목표 · {title}`), and `회의록 정리` with no link (`연결 없음`); `답변 확인`; untick nothing; `선택한 업무 등록`; toast `AI 제안 업무 2건 등록`; `readState().work` gained exactly two items dated today with `source: "ai"`, `done: false`, the goal-linked one carrying `link.kind === "goal"` and the goal's id; `journal` byte-identical (no reply stored); `recordBoundary` unchanged.
  12. `a work reply naming tasks, deals and events creates none of them` — paste a reply whose JSON block is `{"tasks":[{"goal":"x","title":"독서 30분"}],"deals":[{"client":"c"}],"events":[{"title":"e"}],"work":[]}`; `답변 확인` shows `제안 업무 없음 — 등록할 항목이 없어요.`; `tasks`, `deals`, `events`, `work` byte-identical before/after.
  Then the file's cleanup (Phase 1's last paragraph) also removes the two planted meetings and the imported items.
- `tools/e2e/README.md` `flow11.js` row extended.

**Acceptance (Phase 2).**
- Gates as Phase 1. `git diff` shows no change inside `buildAssistantPacket`, `PACKET_HEAD`, `parseAssistantReply`, `importTasks`, `storeReply` beyond the extraction of `packetSection` / `bizPacketLines` / `copyPacket` / the two panes (behaviour-preserving; the demo packet text for the goal-task bridge is byte-identical before/after — check with a throwaway script that calls both builds on the demo save via the built bundle, or by diffing the textarea text at 390 px).
- Throwaway puppeteer check on the demo build: the work packet ≤ 4,000 chars, contains `## 최근 회의록 (3건)`, the hidden demo meeting's title with `내용 비공개`, none of its summary text, the visible meetings' summaries, `진행 {date}: 월 10시간 한도를 반영한 유지보수 견적서 초안 작성`, `## 업무 기록 (어제·오늘)` with both demo items; a pasted reply with one duplicate and one new item imports one item with `source: "ai"`; a reply with `tasks` creates no task; `docs:check` accepts the Rule 7 edit (heading count 19).

### Phase 3 — screenshots, manifest, docs

**Goal.** Ship the docs and the store assets for the seventh tab; close the backlog item; record the decisions.

**Files.** `tools/harness/gen-screenshots.js` (`SHOTS` gains `{ file: "work.png", tab: "업무" }` after `tasks.png`), `public/manifest.webmanifest` (a sixth `screenshots` entry `./screenshots/work.png`, `430x932`, `narrow`, label `오늘 업무 — 수기 등록과 AI 제안`), `public/screenshots/work.png` (generated: `npm run build:demo && node tools/harness/gen-screenshots.js`), and every doc in §"Docs to sync".

**Acceptance (Phase 3).** `npm run docs:gen && npm run docs:check` clean; `npm run finish` exit 0; `public/screenshots/work.png` exists and the manifest references exactly the six files present; `ARCHITECTURE.md` "Current status" reads schema v25, seven tabs, `modal.type` 30, E2E step count as written (count `await step(` across `tools/e2e/flow*.js` and state the number as a static count, not a green run).

### Finish protocol (every phase)
1. cleanup → `npm run finish` exit 0; any intentional finding goes to `tools/harness/finish-allowlist.json` with a reason and a mirrored row in `docs/exec-plans/tech-debt-tracker.md` (expected: none — Phase 1 renders every constant it declares; `WORK_PROPOSAL_MAX` and the packet constants are declared and read in Phase 2 together).
2. `npm run build`, `npm run lang:check`, `npm run docs:gen && npm run docs:check`; `node --check` on every edited `tools/e2e/*.js`.
3. **Do not run** `npm run verify`, `node tools/e2e/run.js` or `node tools/harness/verify.js`.
4. docs-syncer after Phase 3 moves this plan to `docs/exec-plans/completed/` and links it from the decision log.
5. Report: what changed, commands run with results, the E2E step count as written, the proposed commit message. Commit only at a user-approved gate.

## Steps

1. Phase 1 — schema v25 (`migrate` block, `freshState`, `@schema`, `demoState`); progress log (`MeetingViewModal`, `MeetingModal` flag, `MeetingsTab` marker, `addProgress` / `removeProgress`); `recordFits` rename; work constants and helpers; `addWork` / `updateWork` / `toggleWork` / `removeWork` / `moveWorkToToday`; `WorkTab`, `WorkModal`; `NAV` + `grid-cols-7` + `ListChecks` import; root wiring; E2E edits (`flow.js`, `flow4.js`, `flow6.js`, new `flow11.js` steps 1–9, README); gates; throwaway 390 px check.
2. Phase 2 — `packetSection` / `bizPacketLines` extraction; `WORK_PACKET_*` constants and `WORK_PACKET_HEAD`; `buildWorkPacket` with the reduction list; `parseWorkReply`; `copyPacket` / `PacketSendPane` / `ReplyPastePane` extraction from `BridgeModal`; `WorkBridgeModal`; `importWork`; `AI로 만들기 ›` on `WorkTab`; Rule 7 amendment; `flow11.js` steps 10–12; gates; byte-identity check of the goal-task packet.
3. Phase 3 — screenshots, manifest, all docs, backlog item closed, tech-debt rows, decision-log entry; gates; plan moved to completed.

## Verification

- Per phase: `npm run build` · `npm run finish` · `npm run lang:check` · `npm run docs:gen && npm run docs:check` · `node --check tools/e2e/flow.js tools/e2e/flow4.js tools/e2e/flow6.js tools/e2e/flow11.js`.
- `npm run smoke`: optional (no engine formula, table or `calcExamPayout` / `krProgress` / `migrate`-logic change beyond the appended block; `smoke-logic.js` lifts top-level consts, so the new constants must be plain literals or it may warn — keep `WORK_LIMITS` and the packet constants as literals).
- **Not run:** `npm run verify` and the E2E suite. Every new or edited step is written to the same conventions as `flow10.js` and parses; its green status is unverified until the user runs the suite (extend TD-44's note).
- Manual/throwaway checks at 390 px are listed under each phase's acceptance; scripts stay in the session scratchpad.

## Cleanup checklist
- [ ] `npm run finish` exit 0 after each phase (unused symbols/imports, duplicates ≥ 6 lines, residue, language)
- [ ] no allowlist addition expected; if one is needed, its reason is mirrored in `docs/exec-plans/tech-debt-tracker.md`
- [ ] `meetingFits` no longer exists (renamed `recordFits`); no reference to it remains in `src/`, `tools/` or `docs/`
- [ ] `BridgeModal` and `WorkBridgeModal` share `copyPacket` / `PacketSendPane` / `ReplyPastePane`; `buildAssistantPacket` and `buildWorkPacket` share `packetSection` / `bizPacketLines`

## Storage arithmetic (goes into the meetings-region comment, the new work-region comment, and `meetings.md` / `daily-work.md`)

- Meeting record base grows by `,"progress":[]` (14) + `,"aiHidden":false` (17) = **31 chars** on every record. A progress entry is `{"id":"…10…","date":"YYYY-MM-DD","text":""}` ≈ 45 chars + text (+ 1 comma): typical 80-char text → ≈ 125; a full 300-char entry ≈ 345. Thirty full entries ≈ 10,380 chars, so a completely full meeting with ten task links and thirty full entries ≈ 3,142 + 31 + 10,380 ≈ **13,550 chars**. Typical minutes (~850) with three typical entries ≈ 850 + 31 + 375 ≈ **1,260 chars** → 3 a working day ≈ 0.95 M chars a year (26 % of the 3.5 MB budget per year; ≈ 3 years 10 months before the guard applies). `recordFits` measures the whole serialised record, `progress` included.
- Work item `{"id":"…","date":"…","title":"","done":false,"source":"manual","createdAt":"…"}` ≈ 100 chars of overhead; with a 20-char title, a 30-char note (`,"note":""` + 30) and a link (`,"link":{"kind":"meeting","id":"…"}` ≈ 45) ≈ **≈ 200 chars; ≈ 150 without a link**. Eight items a day for a year ≈ 2,920 × 150 ≈ **0.44 M chars (12 % of the budget a year)**; at the cap of 20 a day with every field full (60 + 200 + link ≈ 400 chars) ≈ 2.9 M a year — the `업무` tab's own `저장 공간` line and the backup path cover that, and `recordFits` refuses a save over the budget.

## Docs to sync (Phase 3; docs-syncer)

- **New** `docs/product-specs/daily-work.md`: the record shape, what a work item never does (no payout, trophy, goal, KR, streak, evidence gate, `todoOf`, briefing, calendar file), the tab (header, pager, counts line, `지난 미완료`, rows, empty states), `WorkModal`, `WorkBridgeModal` (send / paste / confirm, every Korean string), handlers + toasts table, caps, storage arithmetic, backup (both new arrays travel in `exportBackup` / `importBackup` with no code change; an older backup gains them through `migrate`), demo content, the E2E steps as written.
- `docs/product-specs/meetings.md`: shape (`progress[]`, `aiHidden`), caps (`progress` 300 / 30 entries), the storage table recomputed as above, `MeetingModal` flag, `MeetingViewModal` `진행사항` block and `AI 전송` row, the `진행 {n}건` marker, handlers `addProgress` / `removeProgress`, `recordFits` rename, the "what a meeting never does" list rewritten: the **daily briefing packet** (`buildAssistantPacket`) still never reads a meeting; the **work packet** does, by the user's decision, unless `aiHidden`.
- `docs/design-docs/assistant-bridge.md`: a second packet section (`buildWorkPacket` table, caps, the trim order) and a second parser section (`parseWorkReply`), plus the shared helpers; "What the assistant never does" gains the work-item clause.
- `docs/design-docs/core-beliefs.md`: Rule 7 amendment (Phase 2, exact text above).
- `docs/design-docs/information-architecture.md`: seven tabs, the `work` row in the screen map (`업무` · `ListChecks` · `WorkTab`), modal list 28 → 30 (`work`, `workBridge`), a sentence that a work item sits outside the hierarchy like an event, a meeting or a business record.
- `docs/DESIGN.md`: the seven-tab invariant (`grid-cols-7`, ≈ 51 px per cell at 390 px, `업무` chosen because `오늘 업무` would clip), `ListChecks` added to the icons in use, screen inventory `A13 업무`.
- `docs/SECURITY.md`: "Data in transit" rewritten — two packets; the work packet carries meeting summaries, decisions, follow-ups and progress by default, a per-meeting `AI에 보내지 않기` flag excludes a meeting's body (title and date remain), and neither packet ever carries `profile.name`, birth date, e-mail, phone, school or employer (`cvSummaryOf`); the E2E step that asserts those absences for the work packet; work items in "Data at rest" and in the backup paragraph.
- `docs/design-docs/state-lifecycle.md`: shape v25, the `v < 25` ledger row, `freshState` v25, the `flow4.js` fixture sentence.
- `docs/RELIABILITY.md`: migration list to v25, the `flow11.js` row, the E2E status note (written, not run — 2026-09-17), the storage line for progress entries and work items.
- `ARCHITECTURE.md`: new "Daily work" region row, the meetings row (progress, `aiHidden`, `recordFits`), the daily-assistant row (`buildWorkPacket`, `parseWorkReply`, shared helpers), modals row (`WorkModal`, `WorkBridgeModal`), app-root handlers, `NAV` `grid-cols-7`, "Current status" (v25, seven tabs, `modal.type` 30, E2E count as written), glossary row `업무` → work item (`work`, `WorkTab`) — a record, never a task.
- `docs/design-docs/demo-data.md`: the two demo work items, the demo progress entry, the hidden demo meeting.
- `docs/product-specs/index.md` (seven tabs, modal list, `daily-work.md` row) and `docs/design-docs/index.md` (unchanged rows; `assistant-bridge.md` description gains "two packets").
- `tools/e2e/README.md` (Phases 1–2).
- `docs/exec-plans/backlog.md`: the item "Whether the assistant packet may ever summarise meeting minutes" is closed by this plan (state the decision and link the decision log); a new item "work-item search / filter by link" is optional, not added unless the user asks.
- `docs/exec-plans/tech-debt-tracker.md`: TD-44 note extended (flow11 and the Phase 1–2 edits not run); **TD-49** (S3, work) — a work item's `link` may point at a deleted goal/meeting/project and is stated as `연결 대상이 삭제됐어요` at render, never cleaned up (accepted, same policy as TD-46); **TD-50** (S3, bridge) — the work reply's raw text is not stored, so a mis-tick cannot be recovered without re-pasting (accepted; storing it would collide with `journal[].ai`).
- `docs/design-docs/decision-log.md`: one 2026-09-17 row quoting the user's request verbatim, the four decisions, the "work item is a record, not a task" design, the tab label measurement, the reversal of the 2026-09-16 packet default with the per-meeting flag, the Rule 7 amendment, schema v25, `modal.type` 28 → 30, and "E2E updated, not executed" — Rules 1, 7, 8, 9, 12, 13, 18, 19 · link to this plan once completed.
- `docs/generated/*` via `npm run docs:gen` only (never hand-edited).

## Proposed commit

Three commits at the user's gates, or one squashed:
- `feat(work): schema v25 — meeting progress log, AI-hidden flag, work records and the 업무 tab`
- `feat(bridge): 오늘 업무 만들기 packet and parser; work items proposed by the assistant, confirmed per item (Rule 7 amended)`
- `docs(work): daily-work spec, seven-tab docs, security and reliability notes, work.png screenshot`

## Completion note (docs-syncer, 2026-09-17)

Phases 1 and 2 (schema v25, the meeting progress log, the `업무` tab, the assistant work packet and parser) were
already implemented in the working tree when this pass started. Phase 3 (docs) is what this note records.

**Gates run.**
- `npm run build` — pass (build was already green before this pass; unaffected by doc-only changes).
- `npm run finish` — exit 0, `finish-check: clean`.
- `npm run lang:check` — clean (implicit in `finish-check`; no Korean prose introduced outside UI copy quotes).
- `npm run docs:gen` — `db-schema.md` regenerated at v25 (15 migration blocks, 14 storage keys); symbol index 326 symbols.
- `npm run docs:check` — clean after the plan moved to `completed/` (the decision-log link to this file only resolves once moved).
- `npm run build:demo` then `node tools/harness/gen-screenshots.js` — regenerated all six screenshots (`home.png`, `tasks.png`, `work.png`, `goals.png`, `calendar.png`, `meetings.png`); `work.png` now shows the `AI로 만들기 ›` button on the pager row, which did not exist when Phase 1's screenshot pass ran.
- `npm run verify` and `node tools/e2e/run.js` — **not run**, per the standing user instruction; every edited `tools/e2e/*.js` file parses (`node --check`), and the total step count across `tools/e2e/flow*.js` is **189** (`await step(` occurrences, counted directly: `flow.js` 38, `flow2.js` 16, `flow3.js` 14, `flow4.js` 20, `flow5.js` 16, `flow6.js` 6, `flow7.js` 25, `flow8.js` 19, `flow9.js` 8, `flow10.js` 15, `flow11.js` 12).

**Docs written or updated.** New `docs/product-specs/daily-work.md`. Updated: `docs/product-specs/meetings.md` (progress log, `aiHidden`, `recordFits`/`putMeeting`, caps, storage arithmetic, sheets, handlers, migration, demo, "what a meeting never does"), `docs/design-docs/assistant-bridge.md` (the second packet and parser section, shared helpers), `docs/design-docs/core-beliefs.md` (converted the Rule 7 amendment's plain-text reference to `docs/product-specs/daily-work.md` into a relative markdown link now that the file exists), `docs/design-docs/information-architecture.md`, `docs/DESIGN.md`, `docs/SECURITY.md`, `docs/design-docs/state-lifecycle.md`, `ARCHITECTURE.md` (region map, App root handlers, glossary, Current status), `docs/RELIABILITY.md` (migration ledger, `flow11.js` row, storage line, step-count paragraph), `docs/PRODUCT_SENSE.md` (screens list — also closed a pre-existing gap where it never mentioned the `미팅` tab), `docs/product-specs/index.md`, `docs/design-docs/index.md`, `tools/e2e/README.md` (fixed the pre-existing inaccurate step counts in the same edit — the file already understated `flow10.js` at 10 steps when it has 15, and after this change wrote "186-step"/nine-step figures that didn't match the file it was describing; both are now 189/twelve), `docs/exec-plans/tech-debt-tracker.md` (TD-44 extended; new TD-49, TD-50 as the plan named, plus TD-51 for the packet's duplicated goal-lines block, flagged in the task but not required by the plan's own acceptance criteria), `docs/exec-plans/backlog.md` (closed the "may the packet ever summarise minutes" item), `docs/design-docs/decision-log.md` (one 2026-09-17 row), `docs/design-docs/demo-data.md` (the two demo work items, the progress entry, the hidden meeting).

**`docs/FRONTEND.md`**: not changed — it does not enumerate tabs or modals, so nothing there was stale.

**Deviations from the plan found in the code, not introduced by this pass** (recorded here since the plan's Prompt section did not anticipate them): the hidden meeting's work-packet line states no project name, only date and title (stricter than a literal reading of "date and title" might allow, i.e. it also omits `[project]`); `AI로 만들기 ›` sits on the pager row next to `‹ 오늘 ›` rather than beside `업무 추가` in the header (a code comment explains the 390 px width constraint); `normWorkTitle` is declared in the same source region as the other Phase 1 work helpers, even though it is only read by `parseWorkReply` in Phase 2; `updateWork` runs `recordFits` on every edit, not only `addWork`; a storage-budget refusal from any of `addWork`/`updateWork`/`addProgress`/`importWork` keeps the sheet open with the typed fields intact rather than closing it.

**Verified inconsistency found between code and docs, fixed in this pass**: `docs/product-specs/meetings.md` and `ARCHITECTURE.md` still named the pre-rename `meetingFits` function; both now read `recordFits`. `docs/exec-plans/tech-debt-tracker.md`'s TD-45 also named `meetingFits` and was updated the same way.
