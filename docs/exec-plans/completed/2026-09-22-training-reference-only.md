# `교육` records are reference only — no to-dos come from them

Status: completed · 2026-09-22 · Route: implementer → cleanup → docs-syncer · Needs approval: no (no migrate; nothing stored is deleted; the user decided today)

## Goal
The user: "`교육` is not for adding to the to-do list — just for grasping the content." A `kind: "training"` record (added today, commit 9147f6f) currently behaves like a meeting: follow-up items that mirror into work items, task links, a progress log, `확인할 것 가져오기`, the split panel, and its follow-ups appear in every to-do surface and in the AI packets. Make a training record a read-only knowledge note.

## Context read
The completed plan `2026-09-22-check-notification-incremental-packet-issue-list.md` (Bundle C1, decisions 14–17, the Phase 3 progress note); `src/LifeManager.jsx`: `MEETING_KIND`, `isTraining`, `MEETING_FIELD_LABEL`, `MEETING_FORM_TEXT`, `meetingLabels`, `MeetingModal` (follow-up editor, task-link picker, `확인할 것 가져오기`), `MeetingViewModal` (progress log, `후속 항목`, split panel, `연결된 할 일`), `commitMeeting`/`reconcileFollowUps`, `meetingRowMarker`, `meetingPacketLines`, `buildWorkPacket` (+ `workSinceOf`), `buildPrepPacket`, `buildReader`, `issueListOf`, `checkSummaryOf`, `meetingPrepOf`/`lastMeetingOf`, `buildIcs` follow-up dues, `condValue` (does any condition count follow-ups? verify), `demoState`'s training record.

## Prompt
1. **Labels.** For training, `적용할 것` → `기억할 점` (field label, placeholder `기억할 점 (선택)`, refusal `기억할 점은 …`, packet/body label `기억할 점:`). Other training labels unchanged.
2. **Form (`MeetingModal`, kind = training).** Hide the follow-up item editor, the task-link picker and `확인할 것 가져오기`. On save, a training record keeps whatever `followUps`/`taskIds` it already has **unchanged** (nothing stored is deleted, no mirrored work item is removed); a new training record writes `followUps: []`, `taskIds: []`. `commitMeeting` must not create work items for a training record (skip `reconcileFollowUps` creation when `isTraining`). Switching an existing meeting to `교육` shows a caption `교육으로 바꾸면 후속 항목·연결된 할 일은 목록에서 빠지고 기록만 남아요.` (facts only).
3. **View (`MeetingViewModal`, training).** Show only the content: facts (date, project, `강사·주최`, schedule link, AI flag), transcript block, `배운 것`, `핵심 정리`, `기억할 점`; hide the progress log, `후속 항목` + split panel, `연결된 할 일`. Keep `수정` and delete.
4. **Every to-do surface ignores training records:** `issueListOf` `할 일` (mine follow-ups), `buildReader` (overdue/mine follow-ups, `이월`-irrelevant), `checkSummaryOf` (unaffected unless it reads follow-ups — verify), `meetingPrepOf`/`MeetingPrepCard` follow-up lines (training is already never the last meeting while a meeting exists — when it is the stand-in, show no follow-ups), `buildIcs` follow-up dues, `meetingRowMarker` (no `진행`/`후속` fragments for training), briefing follow-up counts, role-stage conditions if any read follow-ups. A training record's already-mirrored work items stay as ordinary work items (they are the user's records).
5. **AI packets.** `buildWorkPacket` and its since-mode (`workSinceOf`) exclude training records entirely (the AI must not turn them into tasks); `buildPrepPacket` keeps them as content (labels `배운 것:` / `핵심 정리:` / `기억할 점:`, no follow-up lines) — they help meeting preparation; review/daily/role packets unchanged. The `교육` section of the issue list and the reader's rows stay.
6. **Demo.** The training record: no follow-ups, no progress, no task links; rename its `actions` label content only if it reads as a to-do.
7. **Unchanged:** meeting-kind records byte-identical in every surface; no schema change (v28), no migrate; `condValue`/`roleStageOf` byte-identical unless a condition counts training follow-ups (report).

**E2E (written, not executed — standing user instruction).** Update the Phase 3 training steps in `flow11.js` (the form hides the three controls for training, the view hides the three sections, a training record with a planted mine follow-up does not appear in the issue list `할 일` nor create a work item on save, the work packet omits the training record, the prep packet keeps it with `기억할 점:`). Update `tools/e2e/README.md`.

**Checks (throwaway puppeteer, scratchpad, demo build, 390 px):** the cases above; baselines: with no training record every packet/surface byte-identical to HEAD; with the demo training record the work packet loses exactly its lines and the prep packet changes only `적용할 것:` → `기억할 점:`; mutation: `commitMeeting` creating a work item for training fails; the work packet including training fails.

**Gate:** `npm run build`, `npm run finish` exit 0, `npm run lang:check`, `npm run smoke` (update section 8 cases if labels change), `node --check` on edited files, `npm run docs:gen && npm run docs:check`.

## Steps
1. Items 1–7; 2. E2E; 3. checks; 4. docs (docs-syncer): meetings.md (training section), issue-list.md, daily-reader.md, assistant-bridge.md (work packet excludes training; prep keeps it), notifications.md if affected, calendar-export.md (follow-up dues exclude training), demo-data.md, tools/e2e/README, decision-log (dated 2026-09-22: training is reference only), tech-debt-tracker if anything is left.

Progress (2026-09-22, implementer): steps 1–3 done; step 4 is the docs-syncer's.
- One helper, `followUpsOf(m)` (`[]` for a training record), feeds the briefing count, `issueListOf` (`할 일`, markers, the
  stand-in's lines), the reader's follow-up section, `calendarExportOf`, `meetingRowMarker` and `meetingPrepOf`;
  `meetingPacketLines` states no follow-up, progress or linked-task line for a training record; `buildWorkPacket` and
  `workSinceOf` filter training records out; the prep packet's linked-task section skips them; `commitMeeting` skips
  `reconcileFollowUps` for a training record; `MeetingModal` hides the task-link picker and the follow-up editor
  (incl. check import) and writes the stored lists back; `MeetingViewModal` and `MeetingPrepCard` hide the three blocks.
- Left as they were (literal reading of item 5/7): the review packet and `weekFacts` still read a training record's stored
  follow-ups; the reader's `이후 새로 들어온 것` still lists a training record's stored progress entries;
  `meetingsOfTask` (the task sheet's reverse list) still names a training record that stores task links. None applies
  to a record saved after this change. `condValue`/`roleStageOf`/`checkSummaryOf` read no follow-up — unchanged.
- Demo: the training record's `actions` now reads `완전성은 결측률, 유효성은 코드값 위반율로 측정해요` (the old text read
  as a to-do). A mutation of the `commitMeeting` guard cannot create an item through the UI (the form passes the stored
  list, so no follow-up turns mine); it shows as a deleted linked item and a dropped `workId`, which the checks and the
  new E2E step catch.

## Verification
Gates above; checks; E2E written and `node --check`ed, not run.

## Cleanup checklist
- [x] no dead label keys; `npm run finish` clean without allowlist

## Docs to sync
See step 4.

## Proposed commit
`fix(meetings): 교육 records are reference only — no follow-ups, task links or progress, and never a source of to-dos`

## Completion note (2026-09-22, docs-syncer)
Verified against `git log -1` (commit `2350fc2`, tree clean) and the source directly: `isTraining`, `followUpsOf`,
`commitMeeting`'s `isTraining` branch, `MeetingModal`/`MeetingViewModal`'s `training` gates, the switch caption,
`buildWorkPacket`/`workSinceOf`'s `!isTraining` filters, `buildPrepPacket`'s unchanged inclusion, `meetingPrepOf`,
`meetingRowMarker`, `issueListOf`, `buildReader`'s `followups`/`decisions`/`since` sections, `buildIcs`'s
`followup` entries, `checkSummaryOf` (unaffected — reads no follow-up), and `demoState`'s training record
(`followUps: []`, `taskIds: []`, `progress: []`, the new `actions` text). Confirmed the three literal-reading
leftovers the progress note names: `buildReviewPacket`'s `fuLines` and `weekFacts` still read `m.followUps`
directly; the reader's `이후 새로 들어온 것` still reads `m.progress` directly; `meetingsOfTask` is not gated by
`isTraining` — recorded as [TD-103](../tech-debt-tracker.md)/[TD-104](../tech-debt-tracker.md)/[TD-105](../tech-debt-tracker.md).

Docs updated: `meetings.md` (training section rewritten, demo paragraph, E2E note, three stale
`#교육-as-a-meeting-kind`/old-anchor cross-references fixed), `issue-list.md` (the `할 일` section's follow-up
bullet, the dependency list, three anchor fixes), `daily-reader.md` (`followups`/`decisions`/`since` rows),
`daily-briefing.md` (the `회의 준비` follow-up count, the `weekFacts` leftover note), `assistant-bridge.md` (the
work packet's `최근 회의록` row rewritten to state the exclusion, `workSinceOf`'s description, the prep packet's
`최근 회의록`/`열린 할 일` rows), `calendar-export.md` (the `followup` row), `demo-data.md` (the training
record's own paragraph), `state-lifecycle.md` (the `kind?` sentence), `ARCHITECTURE.md` (`followUpsOf`,
`MeetingModal`/`MeetingViewModal`/`commitMeeting`/`buildWorkPacket`/`workSinceOf` parentheticals),
`tools/e2e/README.md` (step count corrected 268 → 269, matching a fresh `await step(` count across `flow*.js`),
`tech-debt-tracker.md` (TD-103/104/105 added), `decision-log.md` (new 2026-09-22 row). `notifications.md` needed
no change — `checkSummaryOf` reads no follow-up. Ran `npm run docs:gen` then `npm run docs:check`, both clean.
`npm run verify` was not run (skipped per standing user instruction; the exec plan's own E2E was written, not
run, before this pass). 15 steps executed for this docs pass (10 doc files + tracker + log + 2 gen/check commands
+ this note); see the report handed to the caller for the itemised list.
