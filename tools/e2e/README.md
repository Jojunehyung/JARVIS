# E2E harness

Drives the app (`src/LifeManager.jsx`) end to end in a real browser. It uses the Chrome or Edge already installed on the machine (no download).

## Running

```bash
npm run build            # from the project root (add --sourcemap when you want line coverage)
npx vite preview --port 4173
cd tools/e2e && npm i    # once
node run.js --tag run    # 157-step scenario
node perf.js --tag run   # performance measurement (4× CPU throttle)
node cov_map.js out/run-coverage.json   # map never-executed source lines (needs a --sourcemap build)
node prof.js             # top CPU-profile functions
node ab.js <urlA> <urlB> 5        # interleaved A/B of two builds (single runs are too noisy to compare)
node rows.js <url> "시작하기"      # rows and DOM nodes mounted in onboarding step 4
```

`npm run verify` at the project root builds, starts a preview on a free port and runs `run.js` for you.

- `--headful` opens a visible window so you can watch.
- On failure you get `out/<tag>-NN-FAIL-<step>.png` screenshots and `out/<tag>-result.json`.

## Scenario layout

| File | Scope |
|---|---|
| `flow.js` | Onboarding, 6 steps — real name, exact birth date, an education entry and a career entry in place of the old age band and chip rows (asserts the fresh save is schema v21 with its CV records) → the profile modal opening from the home card, rejecting an empty name, a malformed e-mail and an end month before its start, and a CV edit that moves no area grade → goal (OKR) with three KR types → task registered through the count-KR bridge (`채우기 ›`, the one path that takes no activity kind) → completion → catalogue → bottom nav order → persistence across reload |
| `flow2.js` | Certification milestone with certificate photo (evidence gate block verified) · study output verification · reading activity log · promotion · role model · role-model proximity heading the growth tab · an area row collapsing into the promotion gate · the achievement wall stating its counts while collapsed |
| `flow3.js` | Profile photo registered through the profile modal, with no file input inside the modal · exam KR and score-report submission · exercise activity · a kind-less task refused under a goal · direction advice · task and goal deletion · one-day gap (streak, shields) |
| end of `flow.js` | Data reset — asserts the state and profile-photo keys are removed (runs last) |
| `flow5.js` | Due dates and the `실행` tab's time-ordered groups · the home agenda narrowed to overdue and today · the daily briefing (opens on a new day, not twice the same day, streak wording) · journal persistence · the assistant packet, the pasted reply and its import rules · the weekly review, which no longer chains to a metric check-in · the completed-task archive stating its completion date and completing nothing when tapped |
| `flow7.js` | The `실행` tab listing today's `마감` event with no checkbox, tagged `목표 기여 없음`, completable only through its own `완료 표시` button. The 일정 tab, both views. `목록`: form validation · an appointment with its time under its day group · a deadline and its D-day · a weekly repeat next week and the one-row-per-event `이후` collapse · `완료 표시` → `완료 취소` · `이번 회차 취소` on a repeat · edit · delete · the `오늘 일정` briefing section · the home card line · the packet section. `달력`: the month grid (cells, weekday header read cell by cell, markers per kind) · the view choice surviving a reload · today selected on entry · the selected-day panel rendering the same `EventRow` as the list · `이 날짜에는 일정이 없어요.` on an empty day · `일정 추가` prefilled with the selected day · `‹` / `›` paging and `오늘` · weekend and public-holiday tones read off the day numbers · a holiday naming itself on the panel · a month outside the holiday table marking nothing and stating which years it covers · back to `목록` |
| `flow8.js` | The 사업 tab, `계약` / `단가` / `포트폴리오`. Deal-form validation · a won contract's period, total and margin under `진행 중` · a boundary check that registering a deal and ticking a payment change `deals` only, never tasks, goals, streak or trophies · a payment chip toggled and un-toggled · a lead with no numbers · a quote feeding the pipeline line · the cost-missing line on a deal and on a rate · the rate view's margin and footer count · a landscape portfolio image kept at its own aspect and never upscaled · deleting a portfolio entry removing its image key · the chosen view surviving a reload · the briefing's `사업` section with its home-card and packet counterparts · the `실행` tab listing the same unpaid month as a business row with no completion control · a pasted reply naming a deal, a rate and a portfolio entry that creates none of them · the packet stating the CV at degree and role level with no name, birth date, contact, school or company · a regression step that fills the briefing section's cap with alerts and asserts the closing revenue line still renders |
| `flow9.js` | Calendar export — the `일정` header's `캘린더로 내보내기` button, run between `flow8.js` and `flow4.js`. The sheet states its snapshot limits and stores nothing · one `VEVENT` per included event, task, daily digest and goal deadline, each with its `VALARM`, checked against a planted save · a weekly repeat's `RRULE` / `UNTIL` / `EXDATE` · a clamped monthly repeat written as the app's own dates with no `RRULE` · byte-counted folding, with a Korean title unfolding back to the original · a second export keeping every UID with a non-decreasing `SEQUENCE` · the privacy boundary against CV, business, `place` / `note` and journal values · the empty-selection state |
| `flow4.js` | Goal created and taken to 100% → marked achieved → removed from the record · a second goal planted and deleted while active (its open task removed, its completed task kept and shown in `실행`'s `완료` view tagged `목표 기여 없음`) · legacy v10 save migration · save without a `v` field (asserts schema v13 trophy-kind conversion) · v13 → v14 field rename · v14 → v15 assistant fields · v15 → v16 schedule · v16 → v17 schedule view · v17 → v18 meeting task converted to a plain task · v18 → v19 life metrics removed · v19 → v20 business records added · v20 → v21 CV records added with every legacy profile value kept |
| `flow6.js` | Service worker registration and control, a first visit that does not reload itself, a page already under a worker that does not reload when a new one takes over, the precache contents, the app opening offline, and the backup export/import round-trip (runs last: it toggles offline mode) |

Steps assert outcomes rather than just clicking: `assertDone` checks the completed label, `clickInModal` scopes clicks to the open modal, `modalError` reads validation messages, `openAreaGate` opens an area row's promotion gate through the collapsed skill track. `captureDownload` takes the file a download button offers instead of letting the browser save it, and serves the backup-export step and every calendar-export step. Selector and assertion arguments are Korean UI copy on purpose and must not be translated.
