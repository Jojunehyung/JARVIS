# Day-job records in AI packets — a settings switch, on by default

Status: completed · 2026-09-22 · Route: implementer → cleanup → docs-syncer · Needs approval: no (no migrate, no deletion; the user chose the option today)

## Goal
Since schema v28 every existing record was backfilled to the `work` (day job) track, and every packet keeps only `PACKET_TRACKS = ["biz", "personal"]`. The user's work packet (`AI로 만들기` on the `업무` tab) therefore carries none of their meetings, work items or schedule — the day-job minutes are exactly what they use it for. The user chose today: **a settings switch `직장 기록을 AI 요청문에 포함`, on by default**. When on, every packet carries all tracks as before v28; when off, the v28 exclusion applies. The per-meeting `AI에 보내지 않기` flag, the transcript exclusion and the profile-identifier exclusions are unchanged in both states.

## Context read
AGENTS.md; core-beliefs rules 7, 9, 12, 13; the completed plan `2026-09-17-business-tracks-roadmap-role-stages.md` (Phase 1 note: the exclusion, `packetEventLinkOk`, the prep-card notice, captions); `src/LifeManager.jsx` around `TRACKS` / `PACKET_TRACKS` (≈ line 2243–2247) and every `PACKET_TRACKS` reader (≈ 3302–3818, 10068, 10414); `SettingsModal` (the `사업 시간 — 주간 예산` section added in v28 Phase 3 is the pattern to follow); `settings.bizHoursPerWeek`.

## Prompt
Implement the switch in `src/LifeManager.jsx`.

1. **State.** `settings.workInAi` — boolean; **absent means `true`** (no migrate block, schema stays v28; state this in `@schema` next to `settings.bizHoursPerWeek`). Helper `packetTracks(state)` returns `TRACKS` when `state.settings?.workInAi !== false`, else `["biz", "personal"]`. Keep the literal `["biz", "personal"]` in one named constant (rename `PACKET_TRACKS` to `PACKET_TRACKS_NO_WORK` or similar) so smoke/grep can find it.
2. **Every reader.** Replace every `PACKET_TRACKS.includes(...)` with `packetTracks(state).includes(...)` — `buildAssistantPacket` (deals filter, briefing-line filter, event lines), `packetEventLinkOk` (give it `state`), `buildWorkPacket` (events, meetings, records), `buildPrepPacket` (the event-track early return, the project-track guard, meetings, documents, deals), `buildReviewPacket`, `buildRoleVerdictPacket` (deals, milestones), `milestoneTrack` consumers, and the two UI sites (≈ 10068 prep-card AI button vs notice, ≈ 10414 `PrepBridgeModal` send step). Grep afterwards: no bare `PACKET_TRACKS` left.
3. **Copy that says day-job records never leave.** Show each such caption/notice only when the switch is off: `직장 트랙은 AI 패킷에 실리지 않아요.`, `직장 트랙 — AI 패킷에 실리지 않아요`, `직장 트랙 일정 — AI 패킷에 실리지 않아요`, `직장 트랙 기록은 실리지 않아요.`, `직장 트랙 문서·계약은 실리지 않아요.` (find each; when on, drop the sentence or the notice — the AI button shows as for any track).
4. **Settings.** In `SettingsModal`, a section `AI 요청문` with one checkbox row `직장 기록을 AI 요청문에 포함` and a caption: on → `직장 트랙 회의록·업무·일정도 AI 요청문에 실려요. 회사 자료를 보내면 안 되는 날엔 꺼요. 회의록마다 'AI에 보내지 않기'는 그대로 적용돼요.`; off → `직장 트랙 기록은 AI 요청문에 실리지 않아요.`. Toggling writes `settings.workInAi` only (explicit `true`/`false`) and toasts `직장 기록 AI 포함 켜짐` / `직장 기록 AI 포함 꺼짐`.
5. **Demo.** Leave `settings.workInAi` absent (on).
6. **Unchanged:** `aiHidden` exclusion, transcripts never sent, profile identifiers never sent, lead/notice `packet: false`, payment amounts never in the calendar file, the calendar export (on-device, all tracks already). `roleStageOf`, `condValue`, parsers byte-identical.

**E2E (written, not executed — standing user instruction).** In `flow11.js`, the step `no day-job record in any packet` becomes: with `settings.workInAi = false` planted, the existing assertions hold; add a second half: with the setting absent, the day-job meeting title, work item and event appear in the work packet and the prep card offers `AI에게 회의 준비 묻기` for the day-job event. Add one step in `flow6.js` or wherever settings are exercised: the checkbox writes `settings.workInAi` only and the caption switches. Update `tools/e2e/README.md` (rows, count).

**Checks (throwaway puppeteer, scratchpad, demo build, 390 px):** (a) switch absent → the demo day-job meeting `데이터 프로파일링 — 데모기관` project's meeting, its work items and `품질 회의` event appear in the work packet; (b) switch off → they are absent and the captions/notices appear; (c) toggling writes `settings` only; (d) a hidden meeting's body stays out in both states; (e) mutation: `packetTracks` ignoring the switch fails (a) or (b). Baselines: with the switch **off**, all five packets must be byte-identical to HEAD's demo output.

**Gate:** `npm run build`, `npm run finish` exit 0, `npm run lang:check`, `npm run smoke`, `node --check` on edited E2E files, `npm run docs:gen && npm run docs:check`.

## Steps
Progress (2026-09-22, implementer): steps 1–3 done; step 4 left to docs-syncer.
- Step 1: `PACKET_TRACKS` → `PACKET_TRACKS_NO_WORK`, `workInAiOf` + `packetTracks(state)`; all 16 readers switched; no bare `PACKET_TRACKS` left. Captions/notices conditional (the track-row caption through a `workInAi` prop on `TrackRow`, passed to `EventModal`/`DealModal`/`ProjectModal` from the root). Settings section `AI 요청문` + `setWorkInAi`.
- Deviation: the role-verdict caption also named `직장 트랙 기록`; when on it reads `…고객사 이름은 실리지 않아요.` (new variant). `buildReviewPacket` read no `PACKET_TRACKS` (it is business-track only by scope, and its caption says so) and is unchanged.
- Step 2: `flow11.js` packet step split (off planted / absent), one new settings step; the four track-caption asserts in `flow7/8/10/11.js` now assert absence. 256 `await step(`; `node --check` passes; not run.
- Step 3: with the switch off all five packets (prep twice) are byte-identical to HEAD, in node and in the demo UI; checks (a)–(e) pass; 390 px clean.

1. Implement items 1–5; 2. E2E; 3. checks and baselines; 4. docs (Phase 2, docs-syncer): SECURITY.md (packet contents now depend on the switch; default on), assistant-bridge.md, business.md / daily-work.md / meetings.md where they state the exclusion, install-and-backup or settings spec, state-lifecycle (`settings.workInAi`), RELIABILITY, tools/e2e/README, tech-debt-tracker (the v28 default mismatch as a resolved row), decision-log (dated 2026-09-22: the switch, default on, reason).

## Verification
Gates above; checks (a)–(e); E2E written and `node --check`ed, not run.

## Cleanup checklist
- [ ] no bare `PACKET_TRACKS`; no unused helper; captions conditional
- [ ] `npm run finish` clean without allowlist

## Docs to sync
See step 4.

## Proposed commit
`fix(ai): day-job records go into AI packets again, behind a settings switch that is on by default`

## Completion note (2026-09-22, docs-syncer)
Code and E2E landed in `a90b9d7` (steps 1–3 of this plan). Docs phase (step 4) completed in this pass: every
`PACKET_TRACKS` mention across `docs/` updated to `packetTracks`/`PACKET_TRACKS_NO_WORK` and the switch's
default-on behaviour; `SECURITY.md` and `assistant-bridge.md` given a full rewrite of the "Tracks" sections;
`calendar-export.md`, `business.md`-adjacent specs (`meetings.md`, `schedule.md`, `documents.md`,
`daily-work.md`, `daily-briefing.md`, `home.md`), `state-lifecycle.md`, `metrics-and-role-model.md`,
`RELIABILITY.md`, `ARCHITECTURE.md` and `docs/design-docs/index.md` updated; `tools/e2e/README.md` was already
current from the implementer's commit (256 steps, verified by direct count). New tech-debt rows: TD-95 (open —
E2E day-job fixtures now enter later flows' packet assertions once the switch defaults on) and TD-96 (resolved —
the v28 default mismatch this whole plan fixes); TD-73 updated for the new global control. Decision-log entry
dated 2026-09-22 added. `npm run docs:gen` and `npm run docs:check` run clean (see docs-syncer report).
