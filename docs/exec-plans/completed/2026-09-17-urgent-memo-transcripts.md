# Urgent memos — project-less meetings with a pasted transcript, notes over time, and a way back to the minutes from a work item

- Status: completed
- Date: 2026-09-17
- Needs approval: yes — one deletion path the user decided today (`녹취록 지우기`, confirm-gated, removes exactly one optional field of one meeting record; clearing the textarea in the edit form and saving drops the same field, the way a cleared `결정 사항` already does). The user's four recorded decisions below are that approval; the implementer does not ask again. No `migrate` block (both new shapes are optional / nullable fields, schema stays **v26**), no `CERTS` / `EXAMS` / `WEIGHT_MATRIX` / `CERT_W_EXC` row, no `liferpg-*` key, no `store` call site is touched, and nothing here rewrites existing text.
- Agents: planner → implementer (two phases) → cleanup → docs-syncer. The verifier's E2E run is **not** part of this plan (standing user instruction: the suite is written, parsed with `node --check`, never executed).

## Goal

The user's words, translated: "Things I recorded urgently that belong to no project — I want to paste the transcribed text, add notes over time, and work from it while I do the tasks." Three things: (1) a meeting record may have **no project** (`projectId: null`), created and listed in the `미팅` tab under its own group `프로젝트 없음 · 긴급 메모`, with every meeting feature unchanged — progress entries, follow-up items and their mirrored work items, task links, `AI에 보내지 않기`, delete, the storage line; (2) a meeting gains an optional **transcript** (`meetings[].transcript`, `녹취록 (선택)`, at most 30,000 chars, pasted text kept as pasted), written in the form, read collapsed in the view, and cleared on its own; (3) the work sheet of an item linked to a meeting gets a `회의록 열기` button that opens that meeting's view, so the transcript and the progress notes are one tap from the work item. The transcript never leaves the device in any packet or file: the work packet, the daily packet, the calendar file and the prep card do not read it. Everything here is a record or a derivation — nothing pays, promotes, completes a task, summarises, or reaches `computeGrades` / `krProgress` / `todoOf`.

## Decisions the user made today (final — record, do not reopen)

1. **Project-less meetings.** `meetings[].projectId` may be `null`. They live in the `미팅` tab, grouped under `프로젝트 없음 · 긴급 메모`; the meeting form's project picker gains `없음 (긴급 메모)`; editing a memo later and picking a project moves the record into that project's group (and the reverse). Every meeting feature works unchanged on a memo.
2. **Transcript field.** `meetings[].transcript` (optional), `녹취록 (선택)`, cap 30,000 chars (`MEETING_LIMITS.transcript`), the pasted text stored as pasted. A textarea in `MeetingModal`; in `MeetingViewModal` a collapsed block — `녹취록 {n}자 · 펼치기` / `접기`, rendered `whitespace-pre-wrap` — and a `녹취록 지우기` button (confirm `녹취록만 지워요. 요약·결정·후속·진행사항은 남아요. 계속할까요?`) that removes only that field.
3. **The work packet never carries `transcript`** — nor does any other packet or the calendar file; `SECURITY.md` says so in those words. The prep card does not show it either (it keeps showing decisions / follow-ups / progress / tasks as now).
4. **Work sheet → minutes.** For a work item whose `link.kind === "meeting"` (a follow-up-mirrored item included), a `회의록 열기` button under the `연결` fact row opens that meeting's view (`{ type: "meetingView", meetingId }`).

## Defaults the planner set (stated so the user can change them; none is open for the implementer)

- **Group position.** The `프로젝트 없음 · 긴급 메모` section renders **after every project section**, always — even when it has no rows — because its `긴급 메모 추가` button is the only way to start a memo when no project exists (a project section's `회의록 추가` preselects that project). When no project exists it is therefore the only group and stands first, by the same code path, with the existing `프로젝트가 없어요 — 프로젝트를 먼저 만들어요.` card kept above it unchanged (`flow10.js` asserts that copy twice and `flow4.js` once; the sentence stays true for *project* minutes). Inside the group rows sort by `meetingOrder`, `MEETING_ROWS_SHOWN` / `{n}건 더 보기` apply, and the empty text is `긴급 메모가 없어요.` The tab's counts line (`회의록 {n}건`) already counts every meeting, memos included.
- **Form placement (paste-first).** The transcript block sits between the `참석자 (선택)` input and the `회의 요약` textarea — under the title, above the summary, because the transcript is usually pasted before any summary exists. Collapsed behind a border button `녹취록 붙여넣기` while the field is empty; tapping it opens the textarea (`MeetingText`, `녹취록 (선택) — 급히 녹음한 내용을 옮겨 적은 글을 그대로 붙여넣어요`, `rows={6}`, `cap={MEETING_LIMITS.transcript}`), which stays open for the life of the form; editing a meeting that already has a transcript opens it at once. Keeping it collapsed when empty also keeps `flow10.js`'s `fillMeeting` (which writes textarea index 0 as the summary) correct for new minutes.
- **Storage rule.** Trimmed at both ends only (what `MeetingText`'s counter measures, and the same as every other field); the interior — line breaks, spacing, punctuation — is byte-identical to the paste. No normalisation, no clipping: over the cap the submit refuses with `녹취록은 30000자까지예요 — 지금 30001자예요.` (built from `MEETING_LIMITS.transcript`, same shape as the other field caps, placed **last** among the field caps and before the follow-up cap). An all-whitespace transcript is an empty one and is not written. On any refusal — a cap or `recordFits` — `MeetingModal.submit` only calls `setErr(refused)`; no state is reset, so the pasted text stays in the textarea (verified against the current `submit`; the E2E step below proves it for the 30,001-char case).
- **View block.** Directly above `요약`, mirroring the form order: `SectionLabel` `녹취록` with, on the same header row, a mono button `녹취록 {n}자 · 펼치기` (`n = m.transcript.length`, plain digits) that toggles to `접기`; expanded, the text renders as `<p className="text-sm text-zinc-200 whitespace-pre-wrap break-words">` followed by the rose border button `녹취록 지우기`. Without a transcript the block reads `없음` (the same `block(label, text)` helper as `결정 사항`). The `AI 전송` fact row keeps reading `요약·진행사항 포함` (asserted twice by `flow11.js`); the transcript's exclusion is stated in the form and the bridge captions instead (below). The `프로젝트` fact row reads `없음 (긴급 메모)` for a memo.
- **Captions.** The form's `전체 녹취가 아니라 요약만 저장해요.` is now false and becomes `녹취록은 붙여넣은 그대로 저장돼요 — AI 패킷에는 실리지 않아요.` (not asserted anywhere in `tools/e2e`; quoted in `meetings.md`, synced in Phase 2). `WorkBridgeModal`'s send caption gains one sentence: `… 앱은 네트워크를 쓰지 않아요. 회의록 요약과 진행사항이 실려요 — 녹취록은 실리지 않아요. 보내지 않을 회의록은 회의록 수정에서 'AI에 보내지 않기'를 켜요.` (not asserted in E2E; quoted in `daily-work.md`). Facts only ([Rule 13](../../design-docs/core-beliefs.md#rule-13)).
- **Clearing.** A root handler `clearTranscript(meetingId)` writes the record without its `transcript` key through the existing `putMeeting` (no budget check — the record shrinks), toasts `녹취록을 지웠어요`, and leaves the view open. The confirm text is decision 2's, verbatim.
- **Work sheet.** `WorkModal` gains an `onOpenMeeting` prop; the `회의록 열기` button renders only when `work.link?.kind === "meeting"` **and** the meeting still exists (`workLinkLabel` non-null) — a link stated as `연결 대상이 삭제됐어요` shows no button. The root has a single modal slot, so opening the view **replaces the sheet**; closing the view lands on the `업무` tab (the tab underneath), not back in the sheet — the user re-opens the row; anything typed in the sheet and not saved is dropped, the same as closing it (recorded as TD-58, accepted). No new `modal.type` (the count stays 30).
- **Readers of `projectId` that must tolerate `null`** (grepped, each listed with what changes): `MeetingsTab`'s grouping (`by.get(m.projectId)?.push(m)` silently drops a memo today — **changes**: memos are collected into their own group); `MeetingViewModal`'s `프로젝트` fact (`project?.name || "없음"` — **changes** to `없음 (긴급 메모)`); `MeetingModal`'s initial `pid` (`meeting?.projectId || projectId || null` already yields `null` for a memo — the submit's `프로젝트를 골라 주세요.` guard **changes** to refuse only a non-null id that names no live project); `buildWorkPacket`'s head line (`… ?.name || "프로젝트 없음"` — tolerates, a memo prints `[프로젝트 없음]`, unchanged); `meetingPrepOf` (`liveProject(null)` → `null` → the event is skipped, and `m.projectId === project.id` never matches `null` — tolerates; a memo never yields a prep row, by design); `removeProject` and the `ProjectModal` `meetingCount` (`m.projectId === id` — tolerates); `meetingEventText`, `linkedTaskLead`, `meetingsOfTask`, `TaskDetailModal`'s `관련 회의록`, `workLinkLabel` / `workLinkText` (`회의록 · {date} {title}`), `workLinkOptions`, `parseWorkReply`'s meeting targets — none reads `projectId` (verified); `demoState` — gains one memo; `flow10.js`'s `plantMeetingRecord` forces the first project's id (**changes**: keeps an explicit `null`). Neither `migrate` nor a backfill is needed: an absent key never occurs (the form always writes `projectId`), and `null` is a value every reader above now handles.
- **Demo.** One memo, tied to the demo lead `◇◇스튜디오 예약 페이지 개편`, dated yesterday, with a ~300-char Korean transcript, one progress entry dated today and one follow-up (`mine: false`, so no work item is created and the demo `업무` counts line `남음 2건 · 이월 0건 · 완료 1건 · AI 제안 1건` is unchanged). The demo sweep's `프로젝트 2개 · 회의록 3건` becomes `회의록 4건`.
- **E2E** is written, not run: five steps in `flow10.js`, two in `flow11.js`, the demo sweep in `flow.js`; gates per phase as in the previous plan.

## Context read

- `AGENTS.md` §3 (planner → implementer → cleanup → docs-syncer), §4, §6, §7; `docs/PLANS.md`; `ARCHITECTURE.md` regions **Meetings** (`MEETING_LIMITS`, `MEETING_PROGRESS_MAX`, `MEETING_FOLLOWUPS_MAX`, `MEETING_ROWS_SHOWN`, `meetingOrder`, `meetingEventText`, `linkedTaskLead`, `meetingPrepOf`, `meetingRowMarker`, `MeetingsTab`, `MeetingModal`, `MeetingText`, `MeetingViewModal`), **Daily work** (`workLinkLabel`, `workLinkText`, `WorkModal`, `WorkBridgeModal`), **Daily assistant** (`buildWorkPacket`, `WORK_PACKET_*`, `buildAssistantPacket`, `calendarExportOf` / `buildIcs`), **State lifecycle** (`@schema`, the `v < 26` block, `freshState`, `demoState`), **App root** (`recordFits`, `putMeeting`, `commitMeeting`, `addMeeting`, `updateMeeting`, `removeMeeting`, `addProgress`, `removeProgress`, the modal switch).
- Specs: `docs/product-specs/meetings.md`, `daily-work.md`; design: `docs/design-docs/assistant-bridge.md`, `state-lifecycle.md`, `demo-data.md`; `docs/SECURITY.md`; conventions: `docs/FRONTEND.md` (clone updater, Tailwind v3 core, `font-mono` numbers, Korean `해요체` copy, every feature updates `demoState` and adds an E2E step); the completed `docs/exec-plans/completed/2026-09-17-secretary-stage-1a.md` (shape and prompt style followed here). Working tree clean at `f7e5e2d`, schema v26, 204 `await step(` calls as written.
- Rules touched, by number: [7](../../design-docs/core-beliefs.md#rule-7) (the transcript is stored, never processed — no in-app summary, no split, no judgement; the work packet and `parseWorkReply` gain nothing, the daily packet stays meeting-free), [9](../../design-docs/core-beliefs.md#rule-9) (the memo group, the `{n}자` count, the button's visibility and the `프로젝트 없음` head line are derived at render; the two stored facts are `projectId: null` and the text itself), [12](../../design-docs/core-beliefs.md#rule-12) (no new block, no edit to v11–v26, `v` stays 26, keys frozen; `@schema` annotated; a `null` needs no backfill), [13](../../design-docs/core-beliefs.md#rule-13) (the collapsed row states the length; the refusal states the count; the confirm states exactly what stays; the captions state that the transcript is not sent; nothing is softened or hidden). Rules 1, 8, 10, 11, 18 hold by construction: no payout, no metric, no evidence gate, no promotion path, no task is touched.

## Storage arithmetic (goes into the meetings-region comment, `meetings.md`, `RELIABILITY.md`, `SECURITY.md`)

Unit: string length against `STORAGE_BUDGET` = 3,672,064 chars (`storageUsedWith`), as in the meetings region.

- `,"transcript":""` = **15 chars** of overhead, only when a transcript exists; `projectId: null` is `"projectId":null` (16) against `"projectId":"xxxxxxxxxx"` (24) — a memo is 8 chars *smaller*.
- `JSON.stringify` writes every line break as `\n` (2 chars) and every `"` as `\"`, so a full 30,000-char transcript with ~300 line breaks stores as ≈ **30,315 chars**. A completely full meeting (17,050 + 15 + 8,760 = 25,825 in the v26 arithmetic) with a full transcript ≈ **56,140 chars**.
- Full transcripts alone: 3,672,064 / 30,315 ≈ **121** by the guard's own unit. The user's figure — 30,000 chars ≈ 60 KB, about **55** filling 3.5 MB — is the UTF-16 byte reading; browsers meter `localStorage` in UTF-16 units (commonly 5 MiB per origin ≈ 2.6 M chars), so the byte reading is the physical bound and the guard's count overstates the room. Record both figures; the guard is a heuristic ceiling by its own comment, and the gap is pre-existing but sharper with transcripts — TD-59, accepted, not changed here.
- Typical: a ten-minute voice memo transcribed ≈ 2,500 Korean chars ≈ 2,540 stored. Three such memos a week ≈ 0.4 M chars a year (**11 %** of the budget). If every one of three meetings a working day carried one, the v26 horizon (1,810 chars each, 37 % a year) becomes ≈ 4,350 × 750 ≈ 3.26 M a year (**89 %**), about **1 year 1 month** before `recordFits` refuses.
- `recordFits` already measures the whole record, transcript included, before any write; the `미팅` tab's `저장 공간 {mb}MB / 3.5MB` line already counts it. `clearTranscript` and `녹취록 지우기` are the in-app way to reclaim it; the backup path is the way out of a full budget.

## Prompt

You are the implementer for Life Manager (`src/LifeManager.jsx`, Vite + React 18, Tailwind v3 core utilities only). Execute this plan phase by phase; after each phase run the gates and stop for the cleanup pass before the next. Today is 2026-09-17; the schema is v26 and **stays v26**; the working tree is clean at `f7e5e2d`.

**Standing constraints (every phase).**
- Rules by number: [7](../../design-docs/core-beliefs.md#rule-7), [9](../../design-docs/core-beliefs.md#rule-9), [12](../../design-docs/core-beliefs.md#rule-12), [13](../../design-docs/core-beliefs.md#rule-13). Never touch a `store` call site, `CERTS` / `EXAMS` / `WEIGHT_MATRIX` / `CERT_W_EXC`, any `migrate` block (do not add one either), a `liferpg-*` key, `freshState`'s `v`, or the `@schema` header version. Nothing you add may pay P, create a trophy, change a grade, touch `act`, `tasks`, `goals`, `areas`, `room`, `exams`, or enter `computeGrades` / `krProgress` / `goalProgress` / `agendaOf` / `todoOf` / `calendarExportOf` / `buildIcs` / `buildAssistantPacket`. Nothing reads `transcript` except `MeetingModal`, `MeetingViewModal`, `recordFits` (through `JSON.stringify` of the whole record), `clearTranscript`, `demoState` and the E2E.
- Language: English identifiers, comments, E2E step names and log strings; Korean only in UI copy (`해요체`), E2E selector/assert arguments that match UI copy, regexes matching UI copy, and `demoState` content. Comments may name data rows in Korean; nothing else Korean in a comment.
- UI: the seven-tab `NAV` and `grid-cols-7` are unchanged; every new label fits one line at 390 px (a wrapped chip or button is a failure); numbers and counts are `font-mono`; rose is reserved for error / delete, cyan for primary; no arbitrary Tailwind values; lucide icons only from the existing import line (nothing new is needed).
- State: clone-updater pattern; derived values computed in render or `useMemo`; toasts via `showToast`; no new `modal.type` (the count stays 30).
- Copy is quoted verbatim below; use it exactly. Toasts and refusals are sentences ending in `요.` / `요` as the neighbouring ones do.
- Keep every new top-level constant a plain literal (`tools/harness/smoke-logic.js` lifts them).
- E2E: write steps to the conventions of `flow10.js` / `flow11.js` (helpers from `h`, `readState`, `dstrIn`, `boundary` / `assertBoundary`, `projectRows`, `openTodo`, `overlayText`, `modalError`, `setValue(selector, value, nth)`, `clickInModalExact`, `window.confirm = () => true` before a confirmed action), parse them with `node --check`, **never run** `npm run verify`, `node tools/e2e/run.js` or `node tools/harness/verify.js`.
- Gates per phase: `npm run build` · `npm run finish` (exit 0) · `npm run lang:check` · `npm run docs:gen && npm run docs:check` · `node --check` on each edited `tools/e2e/*.js`. `npm run smoke` is optional (no engine formula changes).
- Throwaway checks go in the session scratchpad, never in the repo: build the single-file demo (`npm run build:demo` → `release/life-demo.html`), open it over `file://` in the Chrome that `launchBrowser()` from `tools/harness/lib/source` launches (`const { ROOT, launchBrowser } = require("<repo>/tools/harness/lib/source")`), `page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 })`, tap `데모 데이터로 둘러보기`, and drive the tabs; plant extra saves through `localStorage.setItem("liferpg-state-v1", …)` + reload. A button or chip "fits one line" when its `getBoundingClientRect().height` is ≤ 32 px.

### Phase 1 — code and E2E

**Goal.** Project-less meetings, the transcript field, the packet caption, the work sheet's `회의록 열기`, the demo memo, and the E2E steps.

**Files.** `src/LifeManager.jsx`; `tools/e2e/flow10.js`, `tools/e2e/flow11.js`, `tools/e2e/flow.js`, `tools/e2e/README.md`.

**1. Schema annotations (State lifecycle region) — comments only, no block, no version change.**
- `@schema` JSDoc: on `meetings[]` change `projectId` to `projectId(string | null)` with the trailing comment *null (2026-09-17) = an urgent memo with no project, listed under `프로젝트 없음 · 긴급 메모`; no backfill — every reader tolerates null*; add `transcript?` after `actions?` with the comment *transcript (2026-09-17, optional, no migration): the pasted transcription as pasted, at most 30,000 chars; read only by the meeting form and view, never by a packet, the calendar file or the prep card (SECURITY.md)*. Keep the header at `v26` and `v: 26`. In the "Derived values" paragraph add *the memo group of the meetings tab and a transcript's `{n}자` length*.
- `demoState`: after the three demo meetings, prepend (so it sorts by `meetingOrder` like the rest — the array order is irrelevant) one memo, commented as the existing demo lines are (*an urgent memo: no project, a pasted transcript, one progress entry, one follow-up owned by someone else so the demo work list is unchanged*):
  ```js
  { id: uid(), projectId: null, date: shiftDay(today, -1), title: "긴급 메모 — ◇◇스튜디오 전화",
    summary: "예약 페이지 개편 문의 — 견적 범위와 일정 질문. 기존 예약 데이터 유지 필수.",
    transcript: "네, 예약 페이지 개편 건으로 전화드렸어요. 지금 페이지가 모바일에서 예약 버튼이 잘 안 눌린다는 얘기가 계속 나와서요.\n일단 예약 폼이랑 결제 연결까지 한 번에 바꾸고 싶은데, 기간이 얼마나 걸릴지, 그리고 견적이 어느 정도 나올지 먼저 알고 싶어요. 다음 주 수요일까지 초안이라도 받을 수 있을까요?\n아, 그리고 기존 예약 데이터는 그대로 가져가야 해요. 사진 업로드 기능도 있으면 좋겠는데 그건 나중에 얘기해도 돼요. 네, 그럼 메일로 정리해서 보내 주세요.",
    createdAt: shiftDay(today, -1), taskIds: [],
    progress: [{ id: uid(), date: today, text: "개편 범위 정리 — 예약 폼·결제 연결·데이터 이관, 사진 업로드는 2차" }], aiHidden: false,
    followUps: [{ id: uid(), text: "예약 페이지 개편 견적서 초안", mine: false, due: shiftDay(today, 3), done: false }] },
  ```
  The transcript is ~290 chars; state the exact `length` in your report. Nothing else in `demoState` changes.

**2. Constants and the region comment (Meetings region).**
- `MEETING_LIMITS` gains `transcript: 30000` (the object stays a literal). No other constant.
- The region banner comment gains the storage-arithmetic paragraph from this plan (the overhead, the escaped-newline figure, the two "how many full transcripts" figures with the reason they differ, the typical figures, and that `recordFits` already covers it).

**3. `MeetingsTab` — the memo group.**
- In the `groups` memo, collect meetings with `projectId == null` into `memos` (sorted by `meetingOrder`); keep the project groups exactly as they are. Render, **after** the project sections and always, one more section with the same shell: title row `프로젝트 없음 · 긴급 메모` (`text-sm font-bold truncate`, so `flow10.js`'s `projectRows("프로젝트 없음 · 긴급 메모")` finds it) and the mono `회의록 {n}건`; one button row with `긴급 메모 추가` (same border style as `회의록 추가`; calls `onAddMeeting(null)`); rows as `TodoRow` with `meetingRowMarker`, `MEETING_ROWS_SHOWN` and the `{n}건 더 보기` / `접기` expander keyed `"none"` in `expanded`; empty text `긴급 메모가 없어요.`; caption under the title row `프로젝트 없이 적은 회의록이에요 — 나중에 수정에서 프로젝트를 고르면 그 프로젝트로 옮겨져요.` (`text-xs text-zinc-600`). The `프로젝트가 없어요 — 프로젝트를 먼저 만들어요.` card is unchanged and still keyed on `projects.length === 0`.

**4. `MeetingModal` — the picker, the transcript block, the caption.**
- `pid` initialises as today (`meeting?.projectId || projectId || null`). The picker's chip row gets a first chip `없음 (긴급 메모)` with `on={pid === null}` → `setPid(null)`; under the row, when `pid === null`, the line `프로젝트 없이 저장돼요 — 미팅 탭의 '프로젝트 없음 · 긴급 메모'에 실려요.` (`text-xs text-zinc-600 mt-1.5`).
- Submit: replace `if (!pid || !projects.some(...))` with `if (pid !== null && !projects.some((p) => p.id === pid))` (same message `프로젝트를 골라 주세요.` — now a guard only); write `projectId: pid` (an explicit `null` for a memo, never an absent key).
- State `transcript` from `meeting?.transcript || ""`; `transcriptOpen` from `!!meeting?.transcript` (component state only). Between the `참석자 (선택)` `BizField` and the summary `MeetingText`: when `!transcriptOpen`, a border button `녹취록 붙여넣기` (`px-2.5 py-1.5 rounded-lg border border-zinc-700 text-zinc-300 text-xs font-bold`) that sets `transcriptOpen`; otherwise `<MeetingText value={transcript} onChange={setTranscript} placeholder="녹취록 (선택) — 급히 녹음한 내용을 옮겨 적은 글을 그대로 붙여넣어요" rows={6} cap={MEETING_LIMITS.transcript} />`. Comment: the block is collapsed while empty so a paste-first flow starts under the title and the summary stays the first textarea of a new form.
- Validation: add `transcript: transcript.trim()` to `v` and `transcript: "녹취록은"` as the **last** key of `names`, so the existing loop yields `녹취록은 30000자까지예요 — 지금 30001자예요.` after the other field caps and before the follow-up cap. Write `...(v.transcript ? { transcript: v.transcript } : {})` into `next` beside `actions` — only the ends are trimmed; nothing else touches the text.
- Replace the caption `전체 녹취가 아니라 요약만 저장해요.` with `녹취록은 붙여넣은 그대로 저장돼요 — AI 패킷에는 실리지 않아요.`

**5. `MeetingViewModal` — the transcript block, the clear button, the project fact.**
- New prop `onClearTranscript`. State `showTranscript` (`false`). The `프로젝트` fact reads `project?.name || "없음 (긴급 메모)"`.
- Directly above `{block("요약", m.summary)}`: when `m.transcript` is non-empty, a block whose header row holds `SectionLabel` `녹취록` on the left and, on the right, a mono border button (`text-xs font-mono`, same border style as `항목으로 나누기`, `aria-label="녹취록 펼치기"`) reading `녹취록 {m.transcript.length}자 · 펼치기` or `접기`; when `showTranscript`, `<p className="text-sm text-zinc-200 whitespace-pre-wrap break-words">{m.transcript}</p>` and under it the button `녹취록 지우기` (`px-2.5 py-1.5 rounded-lg border border-rose-800 text-rose-300 text-xs font-bold`) that runs `if (!window.confirm("녹취록만 지워요. 요약·결정·후속·진행사항은 남아요. 계속할까요?")) return; onClearTranscript(m.id);`. Without a transcript: `block("녹취록", "")` (renders `없음`). Comment: collapsed by default because a transcript is long; the length is stated so nothing is hidden (rule 13); on-device only — never in a packet.

**6. Root handler (App root, meetings block).** After `removeProgress`:
```js
// Removes only a meeting's transcript (2026-09-17); every other field stays. Confirmed in the view; the record shrinks, so no budget check.
const clearTranscript = (meetingId) => {
  const cur = (state.meetings || []).find((m) => m.id === meetingId);
  if (!cur || !cur.transcript) return;
  const { transcript, ...rest } = cur;
  putMeeting(rest);
  showToast({ msg: "녹취록을 지웠어요" });
};
```
Wire `onClearTranscript={clearTranscript}` into `<MeetingViewModal … />`. `addMeeting` / `updateMeeting` / `commitMeeting` / `reconcileFollowUps` need no change: they spread `next` / `rec`, so `transcript` and a `null` `projectId` pass through, and `recordFits` already measures the whole record.

**7. `WorkModal` — `회의록 열기`.** New prop `onOpenMeeting`; the root passes `onOpenMeeting={(meetingId) => setModal({ type: "meetingView", meetingId })}` (the same expression `MeetingPrepCard` gets). In the edit-mode facts block, after the `연결` `CvFact`, when `work.link?.kind === "meeting" && workLinkLabel(state, work.link)`, a `<div>` with the border button `회의록 열기` (same style as `항목 추가`) calling `onOpenMeeting(work.link.id)`. Comment: opens the meeting's view in place of this sheet — the root has one modal slot — so the transcript and progress notes are one tap from the item; closing the view lands on the tab (TD-58).

**8. `WorkBridgeModal` caption.** `… 앱은 네트워크를 쓰지 않아요. 회의록 요약과 진행사항이 실려요 — 녹취록은 실리지 않아요. 보내지 않을 회의록은 회의록 수정에서 'AI에 보내지 않기'를 켜요.` In `buildWorkPacket`'s `meetingLines`, add one comment line: *`transcript` is never read here — the packet states named fields only (SECURITY.md)*. No code change in either packet.

**9. E2E (written, not run).**
- `flow10.js`: change `plantMeetingRecord` to `s.meetings = [{ ...r, projectId: r.projectId === null ? null : p.id }, …]`. Add a constant block `const MEMO_TITLE = "E2E 긴급 메모", MEMO_GROUP = "프로젝트 없음 · 긴급 메모", SENTINEL = "E2E-TRANSCRIPT-SENTINEL-9f3a";` and `const TRANSCRIPT = "첫 줄 " + SENTINEL + NL + "  둘째 줄 (들여쓰기 유지)" + NL + NL + "넷째 줄";` and the helper `memo = async () => ((await readState()).meetings || []).find((m) => m.title === MEMO_TITLE)`. Append after the packet step (which ends with its own cleanup and reload):
  23. `a memo saved with no project has projectId null and lists under the project-less group after the project groups` — `clickTab("미팅")`; `expectText(MEMO_GROUP)`; `expectText("긴급 메모가 없어요.")`; `clickText("긴급 메모 추가")`, `expectText("새 회의록")`; the chip `없음 (긴급 메모)` is on (`aria`-free: read its class for `bg-cyan-400`); `fillMeeting({ title: MEMO_TITLE, summary: "긴급 메모 확인" })` (textarea 0 is still the summary — the transcript block is collapsed); `clickInModalExact("녹취록 붙여넣기")`; `setValue('.fixed.inset-0 textarea[placeholder^="녹취록"]', TRANSCRIPT)`; `등록`; `expectText("회의록을 등록했어요")`; `readState()`: the memo has `projectId === null` (strictly, `"projectId" in m`), `transcript === TRANSCRIPT` (byte-identical, `NL` and leading spaces kept), the usual keys; `assertBoundary`; `projectRows(MEMO_GROUP)` lists `MEMO_TITLE`; section order — `page.evaluate` collects `main section` titles (`.font-bold.truncate`) and asserts `PROJECT`'s index is lower than `MEMO_GROUP`'s.
  24. `the view states the transcript's length collapsed, expands and collapses it, and the packet-facing fact rows are unchanged` — `openTodo(MEMO_TITLE)`; `overlayText()` includes `녹취록 ${TRANSCRIPT.length}자 · 펼치기`, `프로젝트` … `없음 (긴급 메모)` and **not** `SENTINEL`; `clickInModalExact` on the label `녹취록 ${TRANSCRIPT.length}자 · 펼치기` (build the label with a template string); now includes `SENTINEL`, `둘째 줄 (들여쓰기 유지)` and `접기`; `clickInModalExact("접기")` → `SENTINEL` absent again; `closeModal()`.
  25. `the transcript refuses 30001 chars with the count, keeps the paste in the form, and accepts 30000` — `openTodo(MEMO_TITLE)`, `clickInModalExact("수정")`, `expectText("회의록 수정")`; the transcript textarea is already open (value `TRANSCRIPT`); `setValue(sel, "가".repeat(30001))`; `clickInModalExact("저장")`; `modalError()` === `녹취록은 30000자까지예요 — 지금 30001자예요.`; the textarea's value length is still 30001; `setValue(sel, "가".repeat(30000))`; `저장`; `expectText("회의록을 수정했어요")`; `(await memo()).transcript.length === 30000`; the tab's counts line still matches `/저장 공간 \d+\.\dMB/`.
  26. `녹취록 지우기 removes the transcript only and leaves summary, decisions, follow-ups and progress as they were` — first plant onto the memo (localStorage, reload) `decisions: "E2E 결정"`, `followUps: [{ id: "e2e-memo-fu", text: "E2E 메모 후속", mine: false, done: false }]`, `progress: [{ id: "e2e-memo-pg", date: today, text: "E2E 메모 진행" }]`; `before = await memo()`; `clickTab("미팅")`, `openTodo(MEMO_TITLE)`, expand, `window.confirm = () => true`, `clickInModalExact("녹취록 지우기")`; `expectText("녹취록을 지웠어요")`; `after = await memo()`: `!("transcript" in after)` and `JSON.stringify({ ...before, transcript: undefined })` equals `JSON.stringify({ ...after, transcript: undefined })` (every other field identical); the view now shows the `녹취록` block reading `없음` and no `펼치기` button; `assertBoundary`.
  27. `moving a memo into a project relists it under that project, and back to 없음 (긴급 메모) returns it to the group` — `openTodo(MEMO_TITLE)`, `수정`, tap the chip `PROJECT`, `저장`; `(await memo()).projectId` equals the project's id; `projectRows(PROJECT)` lists it and `projectRows(MEMO_GROUP)` does not (the group still renders, `긴급 메모가 없어요.` back on screen); `수정` again, tap `없음 (긴급 메모)`, `저장`; `projectId === null` and `projectRows(MEMO_GROUP)` lists it again. Cleanup: filter the memo out of `s.meetings` (and any `work` item linked to it — none expected) via `localStorage`, `h.reload()`.
- `flow11.js`: add `const MEMO_ID = "e2e-memo-packet", MEMO_TITLE = "E2E 패킷 메모", MEMO_WORK_ID = "e2e-memo-work", MEMO_WORK = "E2E 메모 업무", SENTINEL = "E2E-PACKET-SENTINEL-51c0";`. Append after `a work reply naming tasks, deals, events and meetings creates none of them` (before the file's end):
  18. `the work packet states a memo under 프로젝트 없음 and carries none of its transcript` — plant (localStorage) the memo `{ id: MEMO_ID, projectId: null, date: today, title: MEMO_TITLE, summary: "패킷 확인", transcript: "패킷 확인용 녹취 " + SENTINEL + NL + "둘째 줄", createdAt: today, taskIds: [], progress: [], aiHidden: false, followUps: [] }`; reload; `openWorkBridge()`; `txt = await packetText()`: includes `- ${today} [프로젝트 없음] ${MEMO_TITLE}` and `  요약: 패킷 확인`, and **not** `SENTINEL` nor `패킷 확인용 녹취`; `txt.length <= 20000`; `closeModal()`. (The daily packet never reads a meeting at all — `flow10.js`'s `the briefing, the to-do list and the packet never read a meeting` — and the calendar file's privacy boundary is `flow9.js`'s; neither is re-proven here.)
  19. `회의록 열기 on a meeting-linked work item opens that meeting's view in place of the sheet, and a goal-linked item has no such button` — plant `{ id: MEMO_WORK_ID, date: today, title: MEMO_WORK, done: false, link: { kind: "meeting", id: MEMO_ID }, source: "manual", createdAt: today }` (localStorage, reload); `clickTab("업무")`; `openTodo(MEMO_WORK)`; `overlayText()` includes `회의록 · ${today} ${MEMO_TITLE}` and `회의록 열기`; `clickInModalExact("회의록 열기")`; `sleep(500)`; exactly one `.fixed.inset-0` overlay, `overlayText().startsWith(MEMO_TITLE)`, includes `녹취록 ` and `자 · 펼치기`; `closeModal()`; no overlay left and the active nav button is `업무` (read `nav button` classes for `text-cyan-300` as `flow11.js`'s prep step does); then `openTodo(WORK_TITLE)` (the manual item linked to a project earlier in the file) — `overlayText()` lacks `회의록 열기`; `closeModal()`. Cleanup: remove `MEMO_ID` from `meetings` and `MEMO_WORK_ID` from `work`, reload.
- `flow.js` demo sweep: `if (tab === "미팅") { await expectText("프로젝트 2개 · 회의록 4건"); await expectText("프로젝트 없음 · 긴급 메모"); await expectText("긴급 메모 — ◇◇스튜디오 전화"); }` and extend the comment (*and, 2026-09-17, one project-less memo with a transcript*).
- `tools/e2e/README.md`: the `flow10.js` row (five memo/transcript steps), the `flow11.js` row (two), the `flow.js` row (demo sweep), the "written, not run" paragraph extended to this change, and the count recomputed statically (`await step(` across `tools/e2e/flow*.js` — expected **211**; state the number you count).

**Acceptance (Phase 1).**
- Gates pass; `npm run finish` exit 0 with no allowlist addition; `docs/generated/db-schema.md` regenerates still at v26 with 16 migration blocks; `git diff` shows only the one comment line inside `buildWorkPacket` and no change in `buildAssistantPacket`, `parseWorkReply`, `calendarExportOf`, `buildIcs`, `meetingPrepOf`, `MeetingPrepCard`, `migrate`, `freshState`.
- `grep -n "transcript" src/LifeManager.jsx` lists only: the `@schema` comment, `MEETING_LIMITS`, the region comment, `MeetingModal`, `MeetingViewModal`, `clearTranscript` and its wiring, the `buildWorkPacket` comment, `demoState`.
- Throwaway puppeteer on the demo build at 390 px: `미팅` shows the two project sections then `프로젝트 없음 · 긴급 메모` with `회의록 1건` and the row `긴급 메모 — ◇◇스튜디오 전화`; its view shows `프로젝트 없음 (긴급 메모)`, `녹취록 {len}자 · 펼치기` on one line (≤ 32 px), expands to the three-line text with `녹취록 지우기` under it; `수정` opens with the `없음 (긴급 메모)` chip on and the transcript textarea open; `긴급 메모 추가` opens `새 회의록` with the chip on and the summary as the first textarea; `업무` → the `회의` row `긴급 대응 기준 초안 공유` → `회의록 열기` is one line and opens `유지보수 범위 협의`; `AI로 만들기 ›` — the packet contains `[프로젝트 없음] 긴급 메모 — ◇◇스튜디오 전화` and `요약: 예약 페이지 개편 문의` but not `사진 업로드 기능도` (a substring only the transcript has); the send caption states `녹취록은 실리지 않아요.`; nothing wraps at 390 px. Plant a 30,000-char transcript on the demo memo and confirm the `미팅` counts line's `저장 공간` grows by about 0.03 MB and the view's button reads `녹취록 30000자 · 펼치기`.

### Phase 2 — docs sync (docs-syncer)

Update every document below; hand-edit nothing under `docs/generated/` (`npm run docs:gen`). Then move this plan to `docs/exec-plans/completed/` and link it from the decision log; `npm run docs:check` must pass after the move.

- `docs/product-specs/meetings.md`: shape (`projectId: string | null`, `transcript?`), the opening paragraph (the tab now also holds project-less urgent memos and pasted transcripts — the 2026-09-16 "summary only" sentence is superseded; the app still transcribes nothing), caps (`transcript: 30000`), storage table recomputed with the arithmetic above, `MeetingsTab` (the memo group — position, every string, the `"none"` expander), the no-project section note (line 128: the card stays, the memo group below it is the entry point), `MeetingModal` (the `없음 (긴급 메모)` chip and its line, the transcript block and its collapsed state, the new caption, the refusal order with `녹취록은 …` last among field caps, the `프로젝트를 골라 주세요.` guard), `MeetingViewModal` (`프로젝트` fact `없음 (긴급 메모)`, the `녹취록` block, `펼치기` / `접기`, `녹취록 지우기` and its confirm text, `없음`), handler table (`clearTranscript`, toast), `meetingPrepOf` (a memo never yields a prep row), demo, E2E, "what a meeting never does" (the transcript never leaves the device in a packet or file; the app never summarises, splits or judges it — rule 7).
- `docs/product-specs/daily-work.md`: `WorkModal` (`회의록 열기`, when shown, the replace-the-sheet behaviour, TD-58), the bridge caption (line 181), the packet paragraph (`transcript` never read; a memo prints `[프로젝트 없음]`), E2E coverage.
- `docs/design-docs/assistant-bridge.md`: the work-packet table's meeting row (`[프로젝트 없음]` also for a memo; `transcript` never read), "What the work packet never carries" (add the transcript in those words), the `WorkBridgeModal` caption.
- `docs/SECURITY.md`: data-at-rest bullet — since 2026-09-17 a meeting may carry `transcript`, a verbatim pasted transcription of up to 30,000 chars, possibly of a third party's words, the most sensitive free text the app holds, in the same key with no separate handling, deleted by `녹취록 지우기`, with the meeting, and on reset; the packets paragraph — **"The work packet never carries `transcript`; neither does the daily packet, the calendar file or the prep card"** in those words, with `flow11.js`'s sentinel step named as the proof; the backup line — transcripts travel in the backup file.
- `docs/design-docs/state-lifecycle.md`: the shape line, a field note for `meetings[].projectId` (nullable since 2026-09-17, no migration — the form always writes the key) and `meetings[].transcript` (optional, no migration, like `work[].result`), the ledger unchanged (no new row).
- `docs/design-docs/information-architecture.md`: the `meetings` screen-map row (project sections then the project-less group), the `work` row (the sheet opens a meeting view), the modal count unchanged (30).
- `docs/DESIGN.md`: screen inventory — the `미팅` entry (memo group, the transcript toggle, `녹취록 지우기` in the rose delete tone) and the `업무` sheet's `회의록 열기`.
- `ARCHITECTURE.md`: Meetings row (`projectId` nullable, `transcript`, `MEETING_LIMITS.transcript`, the memo group), Daily work row (`WorkModal` `onOpenMeeting`), App root handlers (`clearTranscript`), the `미팅` glossary row, "Current status" (schema **v26** unchanged, E2E count 211 as written).
- `docs/RELIABILITY.md`: the storage-guard paragraph (transcript arithmetic, the two figures, TD-59), the `flow10.js` / `flow11.js` / `flow.js` rows, the "written, not run" paragraph, the step-count table.
- `tools/e2e/README.md` (already edited in Phase 1; verify the count once more).
- `docs/exec-plans/tech-debt-tracker.md`: TD-44 note extended (this change's `flow10.js` / `flow11.js` / `flow.js` edits not run); **TD-58** (S3, daily work) — `회의록 열기` replaces the work sheet (single modal slot); closing the view lands on the tab, not the sheet, and unsaved sheet edits are dropped, as on close (accepted; a return path would need a modal stack); **TD-59** (S3, storage) — `STORAGE_BUDGET` counts string length while browsers meter `localStorage` in UTF-16 units, so the guard admits ≈ 121 full transcripts where the physical quota holds ≈ 55–60; pre-existing heuristic, sharper now that a single field can be 30,000 chars (accepted; the `미팅` tab's storage line and the backup path are the mitigations).
- `docs/design-docs/decision-log.md`: one 2026-09-17 row — the four user decisions (project-less memos under `프로젝트 없음 · 긴급 메모`; `transcript` ≤ 30,000 chars, verbatim, collapsed in the view, cleared on its own; the transcript never in any packet or file; `회의록 열기` on a meeting-linked work item), the planner defaults (group always rendered after the projects; paste-first placement; trimmed at the ends only; the sheet is replaced), no schema change (v26 stays, both fields optional / nullable), `modal.type` unchanged at 30, "E2E updated, not executed" — Rules 7, 9, 12, 13 · link to this plan once moved.
- `docs/design-docs/demo-data.md`: the memo (title, transcript length, the progress entry, the `mine: false` follow-up, the unchanged `업무` counts, `회의록 4건`).
- `docs/product-specs/index.md` (row descriptions for `meetings.md` and `daily-work.md` if they state counts or the "summary only" claim).

### Finish protocol (every phase)
1. cleanup → `npm run finish` exit 0; any intentional finding goes to `tools/harness/finish-allowlist.json` with a reason and a mirrored row in `docs/exec-plans/tech-debt-tracker.md` (expected: none).
2. `npm run build`, `npm run lang:check`, `npm run docs:gen && npm run docs:check`; `node --check` on every edited `tools/e2e/*.js`.
3. **Do not run** `npm run verify`, `node tools/e2e/run.js` or `node tools/harness/verify.js`.
4. docs-syncer after Phase 2 moves this plan to `docs/exec-plans/completed/` and links it from the decision log.
5. Report: what changed, commands run with results, the demo transcript's exact length, the E2E step count as written, the proposed commit message. Commit only at a user-approved gate.

## Steps

1. Phase 1 — `@schema` annotations; `MEETING_LIMITS.transcript`; the region comment; `MeetingsTab` memo group; `MeetingModal` chip, transcript block, validation, caption; `MeetingViewModal` block, clear button, project fact; root `clearTranscript` + wiring; `WorkModal` `회의록 열기` + wiring; `WorkBridgeModal` caption; `buildWorkPacket` comment; `demoState` memo; E2E (`flow10.js` steps 23–27 and the `plantMeetingRecord` change, `flow11.js` steps 18–19, `flow.js` demo sweep, README); gates; throwaway checks.
2. Phase 2 — docs sync as listed; plan moved to completed; decision-log row; TD-44 / TD-58 / TD-59.

## Verification

- Per phase: `npm run build` · `npm run finish` · `npm run lang:check` · `npm run docs:gen && npm run docs:check` · `node --check tools/e2e/flow.js tools/e2e/flow10.js tools/e2e/flow11.js`.
- `npm run smoke`: optional (no formula change; the one new constant is a literal inside an existing literal object).
- **Not run:** `npm run verify` and the E2E suite; every new or edited step parses and follows the file conventions; its green status is unverified until the user runs the suite (extend TD-44).
- Throwaway puppeteer checks per Phase 1's acceptance; scripts stay in the scratchpad.

## Cleanup checklist
- [ ] `npm run finish` exit 0 after each phase (unused symbols/imports, duplicates ≥ 6 lines, residue, language)
- [ ] no allowlist addition expected; if one is needed, mirror it in `docs/exec-plans/tech-debt-tracker.md`
- [ ] `transcript` is read nowhere but the form, the view, `clearTranscript`, `demoState` and the E2E; `buildWorkPacket` / `buildAssistantPacket` / `calendarExportOf` / `buildIcs` / `meetingPrepOf` diff only by the one comment
- [ ] no `migrate` edit, `freshState` still `v: 26`, `@schema` header still `v26`
- [ ] `modal.type` count still 30; the modal switch gained only two prop wirings
- [ ] every new Korean string appears only in JSX / template strings / `demoState` / E2E arguments, never in a comment

## Docs to sync
See Phase 2: `meetings.md`, `daily-work.md`, `assistant-bridge.md`, `SECURITY.md`, `DESIGN.md`, `information-architecture.md`, `state-lifecycle.md`, `ARCHITECTURE.md`, `RELIABILITY.md`, `tools/e2e/README.md`, `tech-debt-tracker.md` (TD-44, TD-58, TD-59), `decision-log.md`, `demo-data.md`, `product-specs/index.md`; `docs/generated/*` by `npm run docs:gen` only.

## Proposed commit

Two commits at the user's gates, or one squashed:
- `feat(meetings): urgent memos — project-less minutes under 프로젝트 없음 · 긴급 메모, a pasted transcript kept on-device, and 회의록 열기 from a linked work item`
- `docs(meetings): urgent memos and transcripts — specs, security statement, storage arithmetic, decision log`

## Completion note (docs-syncer, 2026-09-17)

Phase 1 (code, `tools/e2e`) is committed locally as `ff0deda` (`feat(meetings): project-less urgent memos with a
pasted transcript`). Every code claim in that commit was verified against `git show HEAD` before the docs below
were written: `projectId: null` with no `migrate` block and `v` still 26;
`MeetingsTab`'s `프로젝트 없음 · 긴급 메모` group, always rendered after the project sections, via the shared
`rowsBlock` helper; `MeetingModal`'s
`없음 (긴급 메모)` chip, the collapsed `녹취록 붙여넣기` block, the guard change, the reordered cap messages
ending in `녹취록은`, and the new caption; `MeetingViewModal`'s transcript block, `녹취록 지우기` and its
confirm, and the `없음 (긴급 메모)` project fact; the root `clearTranscript` handler and its wiring;
`WorkModal`'s `회의록 열기` (live-link guard) and the root's `onOpenMeeting` wiring to `{ type: "meetingView",
meetingId }`; `WorkBridgeModal`'s extended caption; the one-line comment in `buildWorkPacket`; the demo memo
(measured `transcript.length` = **259**); `flow10.js`'s five new steps and the `plantMeetingRecord` change,
`flow11.js`'s two new steps (the second uses a planted `GOAL_WORK_ID` item linked to a live goal, not an
existing fixture — a deviation from the plan's step-19 wording, which described the assertion but not the
concrete fixture), `flow.js`'s demo-sweep extension, and `tools/e2e/README.md`'s two updated rows (already
current in the commit, verified rather than re-written). Counted `await step(` myself across
`tools/e2e/flow*.js`: **211** (`flow.js` 38, `flow2.js` 16, `flow3.js` 14, `flow4.js` 21, `flow5.js` 16, `flow6.js`
6, `flow7.js` 26, `flow8.js` 19, `flow9.js` 8, `flow10.js` 27, `flow11.js` 20) — matches the commit message and
every doc below.

**Docs synced (Phase 2):** `docs/product-specs/meetings.md` (shape, opening paragraph, the superseded "full
transcripts are not stored" sentence, caps, storage arithmetic, `MeetingsTab`'s memo group, `MeetingModal`,
`MeetingViewModal`, the handler table's `clearTranscript` row, `meetingPrepOf`'s memo/title-match note, demo,
"what a meeting never does", a new "E2E coverage" section); `docs/product-specs/daily-work.md` (`WorkModal`'s
`회의록 열기` and the replace-the-sheet note, the bridge caption, the packet paragraph, the E2E-coverage
paragraph); `docs/design-docs/assistant-bridge.md` (the meeting-row table cell, "what the work packet never
carries"); `docs/SECURITY.md` (a new data-at-rest bullet, the packets paragraph with the requested quote
verbatim, the backup-file line); `docs/design-docs/state-lifecycle.md` (the shape paragraph's field notes for
`projectId` and `transcript`, no ledger row); `docs/design-docs/information-architecture.md` (the `meetings` and
`work` screen-map rows, modal count unchanged at 30); `docs/DESIGN.md` (A12/A13 screen-inventory entries);
`ARCHITECTURE.md` (Meetings row, Daily work row, App root's `clearTranscript`, the `미팅` glossary row, Current
status — schema v26 unchanged, E2E count 211); `docs/RELIABILITY.md` (a new storage-arithmetic bullet for
transcripts and TD-59, the `flow.js`/`flow10.js`/`flow11.js` row updates, the "written, not run" paragraph and
step-count table); `tools/e2e/README.md` (verified against the commit, already current); `docs/exec-plans/tech-debt-tracker.md`
(TD-44 extended; new TD-58, TD-59, TD-60); `docs/design-docs/decision-log.md` (one 2026-09-17 row, the four user
decisions, the planner defaults, no schema change, `modal.type` unchanged, E2E written not run, linking this
plan once moved); `docs/design-docs/demo-data.md` (the memo's title, transcript length, progress entry,
follow-up and unchanged work counts, `회의록 4건`); `docs/product-specs/index.md` — left unchanged: neither the
`meetings.md` nor the `daily-work.md` row states a count or the retired "summary only" claim, so nothing there
was inaccurate.

**Gates:** `npm run docs:gen` (schema v26, 16 migration blocks, 346 symbols) then `npm run docs:check` — one
failure (a broken link to this plan's not-yet-existing `completed/` path), resolved by this move; `npm run
docs:check` now exits 0.

**Screenshots:** regenerated (`npm run build:demo` then `node tools/harness/gen-screenshots.js`, all six shots
run every time) — only `public/screenshots/meetings.png` changed content, now showing `회의록 4건` and the
`프로젝트 없음 · 긴급 메모` section with its caption, `긴급 메모 추가` and the memo row with the marker
`진행 1건 · 후속 1/1`; the other five are byte-for-byte re-renders of unaffected tabs.

**Verification standing instruction (not re-run here):** per `MEMORY.md`'s "run E2E only on request" and this
plan's own standing instruction, `npm run verify` was not run; the 50/50 demo-build checks and the six
storage-mutation checks referenced in the commit message are the implementer's own Phase 1 acceptance evidence,
not reproduced by this docs pass.

**Deviations from the plan, recorded here as instructed:** (1) every E2E step name is English, per
[AGENTS.md §6](../../../AGENTS.md); (2) `flow11.js`'s second new step (step 19) asserts the no-button case
against a freshly planted item linked to a live goal (`GOAL_WORK_ID`/`goal.id`) rather than reusing an existing
fixture, since the file's earlier project-linked `WORK_TITLE` item is itself linked to a project, not a goal; (3)
the demo memo's transcript measures 259 characters, not the plan's approximate "~290".
