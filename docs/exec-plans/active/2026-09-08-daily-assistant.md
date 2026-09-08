# Daily assistant — briefing, agenda, journal, weekly review, assistant bridge
- Status: active (Phase A done, Phase B next)
- Date: 2026-09-08
- Needs approval: granted — the user approved the plan, which covers the new `migrate` block (schema v15) and the [Rule 7](../../design-docs/core-beliefs.md#rule-7) amendment
- Agents: main agent → cleanup → verifier → docs-syncer

## Goal
Make the app behave like a daily assistant: on the first open of each day it shows a factual briefing built from the saved state (today's tasks and overdue items, streak risk, goal pace and deadlines, stale metrics check-in, stagnant areas, the next recommended step, whether the weekly review is due), the user can write a journal and a weekly review, tasks and milestones carry an optional due date that drives a home agenda, and one screen exports the whole picture as text for an external chat assistant and imports its proposed tasks back through the normal task path.

## Context read
`src/LifeManager.jsx`: `ddayStr`/`paceOf`/`krRemainText` (L1781-1851), `roleGap` (L1852), `RoleAdviceModal` recommendation block (L3160-3186), `@schema` + `migrate` + `freshState` + `demoState` (L2041-2180), `HomeTab` (L2607-2710), `AddTaskModal` (L3356), `TaskTab` rows (L3282), app root (L4130-4560: `modal.type` blocks, boot effect, `saveMetrics`, `addQuest`, `completeTask` streak block). Docs: `AGENTS.md`, `core-beliefs.md` (rules 1, 4, 5, 6, 7, 8, 9, 10, 12, 13, 15, 16, 17, 18, 19), `FRONTEND.md`, `state-lifecycle.md`, `goal-engine.md`, `home.md`, `tasks.md`, `feedback-overlays.md`, `tools/e2e/README.md`, `flow4.js`.

## Prompt
Implement the approved daily-assistant plan in three phases, each ending at a full gate. Do not change payouts, D values, grade cuts, matrices, or any data table ([Rules 1, 4, 5, 6, 15](../../design-docs/core-beliefs.md#rule-1)). Everything the briefing says is derived at render from `(state, today)`; store only new facts ([Rules 8, 9](../../design-docs/core-beliefs.md#rule-8)). Imported assistant proposals become plain `daily`/`once` tasks with a `goalId` and difficulty at most C, never certification, exam, or study tasks, and they complete through `tryComplete` like any other task ([Rules 10, 16, 17, 18, 19](../../design-docs/core-beliefs.md#rule-10)). Add exactly one `if (s.v < 15)` block, bump `freshState`, update the `@schema` JSDoc, and add an E2E migration fixture ([Rule 12](../../design-docs/core-beliefs.md#rule-12)); storage keys stay. All new UI copy is Korean `해요체` stating facts and numbers only ([Rule 13](../../design-docs/core-beliefs.md#rule-13)) and doubles as an E2E selector, so every new label is listed in the plan and used verbatim in `tools/e2e/flow5.js`. Code comments and docs are English.

## Steps
- [x] **Phase A — schema v15, due dates, agenda.** `migrate` v15 block, `freshState`, `@schema`, `demoState` fixtures; date helpers (`daysBetween`, `mondayOf`, `lastDoneDate`, `doneTodayCount`), `ddayStr` off-by-one fix, `agendaOf`, `DueChip`; due-date input in `AddTaskModal` and the KR-bridge default; `HomeTab` agenda; `TaskTab` chip; E2E `setValue` helper, `flow.js` schema assertion 14 → 15, `flow4.js` v14 → v15 fixture, `flow5.js` steps 1-3; docs and regeneration.
- [ ] **Phase B — briefing, journal, check-in stamp.** Extract `roleRecommendations` from `RoleAdviceModal`; `buildBriefing`; `BriefingModal` with the boot auto-open and the `day` state; home briefing card; `JournalModal` and `saveJournal`; `saveMetrics` stamps `act.lastCheckin`; E2E `reload` gains `keepModal`, `flow5.js` steps 4-8.
- [ ] **Phase C — assistant bridge, weekly review, rule amendment.** `buildAssistantPacket`, `parseAssistantReply`, `BridgeModal`, `importTasks`, `storeReply`; `ReviewModal` and `saveReview`; Rule 7 amendment, decision log, `PRODUCT_SENSE`, `SECURITY`, new `daily-briefing.md` and `assistant-bridge.md`; `flow5.js` steps 9-16.

## Verification
Per phase: `npm run verify` (E2E grows from 67 to about 85 steps, 0 failures, 0 console errors), `npm run finish` exit 0, `npm run docs:gen && npm run docs:check`. After Phase C also `npm run build:demo` and open `release/life-demo.html` from `file://` to confirm the briefing opens and the clipboard fallback works without a secure context.

## Cleanup checklist
- [x] `npm run finish` exit 0 after Phase A (the duplicated migration fixture preamble was merged into `migrateFixture`)
- [ ] `npm run finish` exit 0 after each later phase (share `DueChip`, `agendaOf`, `doneTodayCount` rather than copying row markup; keep the modal textareas distinct or allowlist with a reason)
- [ ] allowlist additions mirrored in `tech-debt-tracker.md`

## Docs to sync
`state-lifecycle.md`, `goal-engine.md`, `home.md`, `tasks.md`, `growth.md`, `metrics-and-role-model.md`, `feedback-overlays.md`, `demo-data.md`, `information-architecture.md`, `ARCHITECTURE.md`, `RELIABILITY.md`, `PRODUCT_SENSE.md`, `SECURITY.md`, `core-beliefs.md` (Rule 7), `decision-log.md`, `backlog.md` (item 4 done, item 5 partly), `tech-debt-tracker.md` (TD-04 second half resolved), `tools/e2e/README.md`, new `docs/product-specs/daily-briefing.md` and `docs/design-docs/assistant-bridge.md` plus both index files, and `docs/generated/*` via `npm run docs:gen`.

## Proposed commits
`feat(schedule): schema v15, task due dates, home agenda` · `feat(briefing): daily briefing, journal, check-in stamp` · `feat(assistant): copy/paste assistant bridge, weekly review; Rule 7 amended`
