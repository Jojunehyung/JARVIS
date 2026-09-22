# AI work proposals carry a track, chosen per proposal in the confirm sheet

Status: completed · 2026-09-22 · Route: implementer → cleanup → docs-syncer · Needs approval: no (no migrate, no deletion; the user approved today)

## Goal
With the day-job switch on (2026-09-22), the work packet carries all tracks, but `importTrackOf` still files every unlinked or goal-linked proposal under `biz` — a rule left from when day-job records never reached a packet. Day-job proposals therefore land in the `사업` section of the `업무` tab. Fix: the reply may state a track per proposal, the confirm sheet shows a track picker per proposal, and the registered item takes the picked track.

## Context read
AGENTS.md; core-beliefs rule 7 (the 2026-09-17 work-proposal amendment) and 13; `WORK_PACKET_HEAD`, `parseWorkReply`, `WorkBridgeModal` (shared by `workBridge` and `reviewBridge`, props `build`/`title`/`caption`/`importDate`/`importTrack`), `importWork(list, date, track)`, `importTrackOf`, `TRACKS`, `TRACK_LABEL` (or whatever maps `work|biz|personal` to `직장|사업|개인`), `TrackRow`, `workInAiOf`; `REVIEW_PACKET_HEAD`.

## Prompt
1. **Packet head.** In `WORK_PACKET_HEAD`, extend the JSON template of each item with `"track":"직장|사업|개인"` and add to the rule that asks for `link` one sentence: `각 항목의 track에 직장·사업·개인 중 하나를 적어요 — 근거가 된 기록의 트랙을 따라요.` Keep the rule numbering. `REVIEW_PACKET_HEAD` unchanged (its items are business by scope).
2. **Parser.** `parseWorkReply` reads an optional `track` per item: accept `직장`/`사업`/`개인` and `work`/`biz`/`personal`, map to the internal value, anything else → `null`. Still reads only `data.work` and `data.note`; no new top-level key. Each proposal gains `track` (internal value or null).
3. **Default per proposal** (new pure helper, e.g. `proposalTrackOf(state, p)`): the parsed `track` if set; else the linked project's or meeting's track (the current `importTrackOf` logic, lifted to module level taking `state`); else `work` when `workInAiOf(state)`, otherwise `biz`. Goal links have no track → fall through to the default.
4. **Confirm sheet.** In `WorkBridgeModal`'s confirm view, under each proposal row, a compact row of three chips `직장` `사업` `개인` (reuse `TrackRow` if it fits one line at 390 px without its caption, else a small inline chip row), preselected with the helper's value, or with `importTrack` when the bridge passes one (the review bridge passes `biz`). Picks live in component state keyed by proposal key; disabled (rejected) rows show no chips.
5. **Import.** `importWork` receives the ticked proposals with their picked `track` and writes it; the `track` argument stays as an override only if still needed — otherwise remove it and let the sheet's preselection carry `biz` for the review bridge. Delete `importTrackOf` once unused.
6. **Unchanged:** everything else in both packets; the prep/role/daily packets; `aiHidden`, transcript, identifier exclusions; `parseWorkReply`'s dedupe and caps.

**E2E (written, not executed — standing user instruction).** In `flow11.js`: extend the pasted-reply step (or add one) with three proposals — one with `"track":"개인"`, one linked to the day-job meeting and no track, one unlinked with no track — assert the preselected chips (`개인`, `직장`, `직장`), change the third to `사업`, register, and assert the stored `track`s (`personal`, `work`, `biz`). With `settings.workInAi = false`, an unlinked proposal preselects `사업`. The review-bridge step asserts `사업` preselected. Update `tools/e2e/README.md`.

**Checks (throwaway puppeteer, scratchpad, demo build, 390 px):** the cases above; chips on one line at 390 px; mutation: the default ignoring the parsed track fails the `개인` case. Baselines: the work packet differs from HEAD only in the head lines changed in item 1; review/prep/daily/role packets byte-identical.

**Gate:** `npm run build`, `npm run finish` exit 0, `npm run lang:check`, `npm run smoke`, `node --check` on edited E2E files, `npm run docs:gen && npm run docs:check`.

## Steps
Progress (implementer, 2026-09-22): steps 1–3 done. Items 1–6 as written — `replyTrackOf`, `linkTrackOf` and `proposalTrackOf` at module level after `parseWorkReply`; the confirm row is a `div` holding the `label` and a `BizChips` row (`TrackRow` carries its `트랙` heading, so it was not reused); `importWork(list, date)` lost its `track` argument, `importTrackOf` is gone, and `importTrack` stays a `WorkBridgeModal` prop as the preselection. Deviation: the review-bridge assertion lives in `flow5.js` (that is where the review-bridge step is), not `flow11.js`. E2E: one new `flow11.js` step (33 there, 259 in total), a shared `registerProposals` helper, not run.

1. Items 1–6; 2. E2E; 3. checks and baselines; 4. docs (docs-syncer): assistant-bridge.md (work head template, parser table, confirm sheet), daily-work.md (AI flow, track of imported items), core-beliefs rule 7 amendment only if its text states which fields a proposal may carry (verify; one appended sentence if so), tools/e2e/README, tech-debt-tracker (resolved row: unlinked AI proposals were filed under `사업`), decision-log (dated 2026-09-22).

## Verification
Gates above; checks; E2E written and `node --check`ed, not run.

## Cleanup checklist
- [ ] `importTrackOf` removed or reused; no dead prop
- [ ] `npm run finish` clean without allowlist

## Docs to sync
See step 4.

## Proposed commit
`fix(work): AI work proposals carry a track, picked per proposal before registering`

## Completion note (2026-09-22, docs-syncer)
Code and E2E landed in `715cab5` (steps 1–3 of this plan, per its own progress note). Docs phase (step 4)
completed in this pass, verified against `git show 715cab5` and the current source: `docs/design-docs/assistant-bridge.md`
(the work packet head's rule 4 sentence and JSON template, `parseWorkReply`'s field table gaining `track`, a new
`proposalTrackOf` subsection, the fourth packet's `importWork`/`WorkBridgeModal` prose); `docs/product-specs/daily-work.md`
(`importWork`'s signature, the confirm-sheet's track-pick row, the generalised-caller paragraph, an E2E-coverage
paragraph for the new `flow11.js` step); `docs/design-docs/core-beliefs.md` (one sentence appended to the
2026-09-17 work-proposal amendment — it named no field list before this — stating a proposal may carry a `track`
the user confirms per item; heading count stays 19, the amendment dated 2026-09-18 and later text left alone);
`docs/exec-plans/tech-debt-tracker.md` (TD-97, resolved: unlinked/goal-linked AI proposals were filed under
`사업` even with the day-job switch on); `docs/design-docs/decision-log.md` (dated 2026-09-22 row, after the
day-job-switch row); `ARCHITECTURE.md` (`replyTrackOf`/`linkTrackOf`/`proposalTrackOf` added to the Daily
assistant region, `importTrackOf` marked removed in the App root region, `WorkBridgeModal`'s track-chip row noted
in two regions). `tools/e2e/README.md` was already current from the implementer's commit (259 steps, `flow11.js`
33 — verified by direct `grep -c "await step("` count). `node --check` passes on `flow11.js` and `flow5.js`.
`npm run docs:gen` and `npm run docs:check` run clean (see docs-syncer report). `npm run verify`/`smoke` not
run, per the standing user instruction and this task's own scope.
