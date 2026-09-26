# E2E harness

Drives the app (`src/LifeManager.jsx`) end to end in a real browser. It uses the Chrome or Edge already installed on the machine (no download).

## Running

```bash
npm run build            # from the project root (add --sourcemap when you want line coverage)
npx vite preview --port 4173
cd tools/e2e && npm i    # once
node run.js --tag run    # 291-step scenario as currently written (`await step(` count across flow*.js — not a claim of a recent green run; see the note below)
node perf.js --tag run   # performance measurement (4× CPU throttle)
node cov_map.js out/run-coverage.json   # map never-executed source lines (needs a --sourcemap build)
node prof.js             # top CPU-profile functions
node ab.js <urlA> <urlB> 5        # interleaved A/B of two builds (single runs are too noisy to compare)
node rows.js <url> "시작하기"      # rows and DOM nodes mounted in onboarding step 4
```

`npm run verify` at the project root builds, starts a preview on a free port and runs `run.js` for you.

- `--headful` opens a visible window so you can watch.
- On failure you get `out/<tag>-NN-FAIL-<step>.png` screenshots and `out/<tag>-result.json`.

**Status note (2026-09-16).** The `meetings-and-simplify` change (renamed tabs, compact `할 일` rows and detail
sheets, calendar-only `일정`, the exact exam score, and the new `미팅` tab) edited this suite in every phase —
new steps, renamed steps, new helpers in `run.js`, and a new `flow10.js` — under a standing user instruction that
the suite is run only when the user asks. Every edited file parses (`node --check`), but **the suite has not been
executed since these edits landed**; treat any step count here as a count of what is written, not a report that
it passed. The `meeting-task-links` change (2026-09-16, schema v24) added six steps under the same instruction —
five in `flow10.js` and one in `flow4.js` — and moved the version assertions in `flow.js`, `flow4.js` and `flow6.js`
to 24; they parse, and they have not been run either. The `daily-work` change (2026-09-17, schema v25) added
thirteen more steps under the same instruction — twelve in the new `flow11.js` (nine for Phase 1, three for
Phase 2's packet and parser) and one in `flow4.js` — widened the nav assertions in `flow.js` to seven tabs,
extended the demo sweep with the `업무` tab, and moved the version assertions to 25; every edited file parses
(`node --check`), and none of it has been executed. The `reply-json-fence` fix (2026-09-17) added one more
`flow11.js` step, also written and not run: a work reply pasted as bare JSON after analysis lines still lists its proposal. The `secretary-stage-1a` change
(2026-09-17, schema v26) Phase 1 added seven steps under the same instruction — six in `flow10.js` (follow-up items)
and one in `flow4.js` (the v26 fixture) — moved the version assertions in `flow.js`, `flow4.js`, `flow6.js` and
`flow11.js` to 26, fixed the older v23/v24 fixture steps for the fields later blocks add on the same load, and moved
the demo sweep's `업무` counts line to `남음 2건`; every edited file parses (`node --check`), and none of it has been executed. Phase 2
(derived carry-forward) added two `flow11.js` steps — completing a carried item, and the briefing's `이월 업무` line —
rewrote the past-undone step to the carry-forward behaviour, extended the select-mode step to the carried row, added
the `이월 0건` fragment to every today-view counts assertion (`flow.js` demo sweep, `flow11.js`), and wrote a packet
assertion for the carried record line that Phase 3 renders; parsed, not run. Phase 3 (event `projectId`, the meeting-prep card, the
briefing's `회의 준비` section, follow-up lines in the work packet) added three steps — one in `flow7.js`, one in
`flow10.js` (which now also runs that file's closing cleanup), one in `flow11.js` — and pinned the packet's carried
record line and its `업무 기록 (이월·어제·오늘)` heading; parsed, not run. The `urgent-memo-transcripts` change (2026-09-17,
schema still v26) Phase 1 added seven steps under the same instruction — five in `flow10.js` (project-less memos and the
transcript field) and two in `flow11.js` (the packet's memo line without the transcript, `회의록 열기` from a work
sheet) — changed `plantMeetingRecord` to keep an explicit `projectId: null`, and extended the demo sweep's `미팅` line
to `회의록 4건` with the memo group; every edited file parses (`node --check`), and none of it has been executed.
The `documents-prep-checks-daily-reader` change (2026-09-17, schema v27) Phase 1 added five steps under the same
instruction — four in `flow10.js` (documents) and one in `flow4.js` (the v27 fixture) — moved the version assertions
in `flow.js`, `flow4.js`, `flow6.js` and `flow11.js` to 27, let the older v23–v26 fixture steps accept the
`documents` key the v27 block adds on the same load, added `문서 0건` to `flow10.js`'s empty counts-line assertion,
and extended the demo sweep's `미팅` checks with `문서 2건` and the two demo document titles; 216 `await step(` calls
as written across `flow*.js`; every edited file parses (`node --check`), and none of it has been executed.
Phase 2 added five `flow11.js` steps under the same instruction (pre-meeting checks on the prep card and the event
sheet, the prep packet, the prep reply, `확인할 것 가져오기`), changed that file's prep step to tap the block's
`회의록 열기 ›` button (the block is a `div` since v27), and pointed `flow7.js`'s header at `flow11.js` for the event
sheet's checklist; 221 `await step(` calls as written; every edited file parses, and none of it has been executed.
Phase 3 (the daily reader `오늘 읽을 것`, which took over the briefing's once-a-day auto-open) rewrote three `flow5.js`
steps (a new day opens the reader with every section and closing it stamps the day; the same day reopens neither
screen; the streak line is reached through the reader's `브리핑 ›`), added one `flow5.js` step (the reader from the
profile card and from the briefing, a section's `›` landing on its tab) and one `flow11.js` step (the reader's content
over the prep fixtures, placed before the import-checks step), and opened the reader from the CV card in the demo
sweep; 223 `await step(` calls as written; every edited file parses (`node --check`), and none of it has been executed.
The `business-tracks-roadmap-role-stages` change (2026-09-17, schema v28) Phase 1 (tracks) added seven steps under the
same instruction — one in `flow4.js` (the v28 fixture), one in `flow7.js` (the event form's track chips), one in
`flow8.js` (a contract defaults to `사업`), one in `flow10.js` (a project's and a memo's own track, a project meeting
storing none) and three in `flow11.js` (the work tab grouped by track, the reader and the briefing stating each track in
order, no day-job record in the work, daily or prep packet) — moved the version assertions in `flow.js`, `flow4.js`,
`flow6.js` and `flow11.js` to 28, let the older v22–v27 fixture steps accept the `track` stamps and the five keys the
v28 block adds on the same load (`untracked`, `V28_KEYS`), put the fixtures the packet steps read on the business
track (`flow10.js`'s packet step, `flow11.js`'s planted project, carried item, memo and prep fixtures, `flow7.js`'s
repeating appointment and deadline), added the track to the stored-key and marker assertions (`flow10.js` project and
document keys, `flow11.js` `사업 · 프로젝트` marker, the prep card's `· 직장` line and the briefing's per-track prep
line), and moved the demo sweep to `프로젝트 3개 · 회의록 5건 · 문서 2건`, `남음 4건 · 이월 0건 · 완료 1건 · AI 제안 1건` and the
heads `직장 2건` / `사업 3건`; 230 `await step(` calls as written; every edited file parses (`node --check`), and none of
it has been executed.
Phase 2 (the roadmap, 2026-09-18) added three `flow8.js` steps under the same instruction — the nine-milestone seed and
its counts line, a milestone registered with links and moved through done and planned with the stage-order note, and
milestone pace with the reader's `사업 로드맵` section — and a `로드맵` check in the demo sweep
(`예정 7 · 진행 중 1 · 완료 1`); 233 `await step(` calls as written; every edited file parses (`node --check`), and none of
it has been executed.
Phase 3 (time budget, time log and payment lines, 2026-09-18) added two `flow11.js` steps under the same instruction — a
completion with minutes writing one time-log entry, and the quick entry with the settings budget — and two `flow8.js`
steps — a contract's payment line with its paid stamp, header line and briefing line, and the form's payment refusal —
extended the backup round-trip in `flow6.js` to `timeLog` and `settings`, and added the demo sweep's
`이번 주 사업 4.5h/20h` and `일시금 미확인 1건 · 이번 달 일시금 입금 …` checks; 237 `await step(` calls as written; every
edited file parses (`node --check`), and none of it has been executed.
Phase 4 (role-model stages, 2026-09-18) added two `flow3.js` steps under the same instruction — planted stages whose CV
stage line moves `단계 1/3` → `2/3` → `3/3` with `전환 조건 미충족 (0/1)` → `전환 조건 충족 (1/1)` as won contracts and a
portfolio entry are planted, with no percentage on home and direction advice listing the unmet condition; and
the `의료 AI 솔루션 대표` preset seeding nine stage cards (`9 / 12`), the empty-name refusal, a saved edit writing `role`
only, and removing every stage dropping the `stages` key — plus an assertion in `flow2.js` that a role model without
stages renders no stage line, and the demo sweep's `단계 1/9 · 조건 3/14 · 전환 조건 미충족 (0/1)` check; 239
`await step(` calls as written; every edited file parses (`node --check`), and none of it has been executed.
Phase 5 (sales pipeline and notices, 2026-09-18) added three `flow8.js` steps under the same instruction — a lead
registered with an overdue next action and stated by the view, the reader and the briefing, its stage change stamping
`stageAt`; a quote-stage lead opening a prefilled contract form whose registration links the lead (`deals` and `leads`
only); a notice with a document link and a deadline in 5 days stated by the view, the briefing and the reader, kept out
of the daily packet, and a submitted notice moving a planted stage line from `단계 1/2` to `2/2` — plus the demo sweep's
`리드 2건 · 다음 액션 기한 지남 1건` and `데모 AI 바우처 공고` checks; 242 `await step(` calls as written; every edited file
parses (`node --check`), and none of it has been executed.
Phase 6 (calendar alarms and the weekly review packet, 2026-09-18) added two `flow9.js` steps under the same
instruction — a planted follow-up, check, milestone, payment line and notice written as `후속 1 · 확인 1 · 마일스톤 2 ·
입금 1 · 공고 1` with the check reminder the day before, the two milestone UIDs and no trace of the amount `7654321`; and
past-dated items counted as skipped with a check whose meeting is today not written — and two `flow5.js` steps — the
review's three per-track lines with `AI에게 회고 묻기 ›` disabled until the review is saved; and the `주간 회고` packet
(business week and saved review, no day-job title, profile name or `## 이력`) whose reply registers `E2E 다음 주 업무`
dated next Monday on the business track, leaving `tasks`, `journal` and `reviews` unchanged. `flow9.js`'s existing
export steps strip the v28 alarm sources from their plant (`stripAlarmSources`) and read the new excluded and skipped
lines; `flow11.js`'s work-packet step asserts the generalised bridge keeps the `오늘 업무 만들기` title and caption; 246
`await step(` calls as written (the four new steps — two in `flow9.js`, two in `flow5.js` — bring the running total
from 242 to 246; a prior progress note in the exec plan said +6/248, an arithmetic slip corrected here after a fresh
count); every edited file parses (`node --check`), and none of it has been executed.
The role story and verdict change (2026-09-18, Phase 1, schema still v28) added two `flow3.js` steps under the same
instruction — the `AI에게 판정 묻기 ›` packet opened from the CV stage button carrying the planted story, `## 이력`, every
area's grade name, the record counts, the planted stages with their condition values and the `조건 종류:` list, and none
of the profile name, birth date, a planted e-mail, phone, school, employer, client name or a day-job deal's sentinel
title, with the daily packet not carrying the story; and a pasted verdict reply whose confirm sheet states
`AI 판단 · 검증되지 않음 · {today}` (no percentage and no probability since 2026-09-18), three proposed stages of which two are rejected
(`알 수 없는 조건 종류예요: unknown_type`, `자격 표에 없는 이름이에요: 존재하지않는자격증`) and an unknown area
(`없는 영역이에요: 없는영역`), and whose confirmed save replaces `role.stages` with the one ticked stage, prepends a dated
verdict (`stageK 1`, `stageN 1`, `source "ai"`) ahead of the planted older one, moves one requirement grade and stamps
`seenStageK`, writing `role` only and no journal entry. The editor step now plants a story and an older verdict and asserts
both survive the editor's save with `seenStageK` stamped, and the earlier stage step reads the condition count and the
quit text from the stage button's `title`; 248 `await step(` calls as written; every edited file parses (`node --check`),
and none of it has been executed.
Phase 2 of the same change (the stage headline, the completion overlay, the verdict history and the reader's tenth
section, 2026-09-18) added two `flow3.js` steps under the same instruction — the headline `단계 1/1 E2E 제안 단계 · 조건 0/2`
with no percentage anywhere on home, one planted contract moving the role screen's condition line to
`- 계약 체결 수 'E2E판정고객' 1/2` (rose), the second contract plus `profile.certs = ["정보보안기사"]` raising the `STAGE` / `단계 완료` /
`모든 단계 충족` overlay once (`seenStageK` stamped 2) and not again on reload, then `단계 1/1 모든 단계 충족 · 조건 2/2`; and the reader's
`롤모델 판정` section between `뒤처진 목표 페이스` and `브리핑 ›` reading `롤모델 재판정 — 마지막 {today − 31} · 31일 지남`
for a re-dated verdict, `롤모델 판정 없음 — 원하는 모습을 적고 AI에게 물어요` without one, and its `›` opening
`방향 제안 —`. `flow5.js`'s section list gained `롤모델 판정`; the `flow.js` demo sweep asserts no overlay on entry, the
headline `단계 1/9 계약 기반 개발자 · 조건 3/14` with the `title` `롤모델 1/9단계 · 조건 3/14 · 전환 조건 미충족 (0/1)`
and no caption, the role screen's `단계 1 → 1 ({today − 29} → {today})` delta and its stage line
`롤모델 1/9단계 · 조건 3/14 · 전환 조건 미충족 (0/1)`, and the reader's `롤모델 판정 · 마지막 {today} · 0일 지남 · 단계 1/9`; 250 `await step(` calls as
written; every edited file parses (`node --check`), and none of it has been executed.
The one `롤모델` screen (2026-09-18, third change of the day, schema still v28) added five `flow3.js` steps under the same
instruction — the story templates (`취업` filling the empty textarea, `창업` appending after a blank line, the counter, and
`저장` writing `role.story` alone with every other `role` key and every other top-level key unchanged and the verdict CTA
enabled); the storyline over planted stages (`1단계 E2E 완료 단계 충족` in emerald, the current `2단계 E2E 현재 단계`
with its five `지금 할 것` buttons in the order `계약 추가 ›` / `포트폴리오 추가 ›` / `로드맵 열기 ›` / `리드 추가 ›` /
`공고 추가 ›`, the upcoming `3단계 … 조건 3개` peeking its conditions on tap), each button's landing (`ui.bizView`, the
highlighted `사업` tab, the sheet `새 계약` / `새 포트폴리오` / none over the roadmap / `리드 추가` / `공고 추가`), and on a
second plant `계약 목록 ›` landing on the deal list with no sheet and `도감에서 찾기 ›` opening `성취 도감` with the search
value `정보보안기사`; the current stage's linked work item (`{today} E2E 단계 업무 ›` opening the `업무` sheet, a done item
leaving `연결된 업무 없음 — 로드맵에서 마일스톤에 업무를 연결해요`); `롤모델 초기화` declined writing nothing and confirmed
leaving `role: null` with every other key unchanged and the CV's `롤모델 미설정 — 설정에서 롤모델을 정해요` back as a `P`; and the
briefing's `다음 단계` line and the reader's `롤모델 판정 열기` both opening the screen. The earlier `flow3.js` steps were
rewritten for it: the role line opens `롤모델` with `영역 등급` collapsed until `펼치기 ›`,
the stage step reads the timeline instead of the advice sheet, the editor step reaches the sub-screen through
`롤모델 수정` → `세부 수정 ›` and seeds with `기본 9단계 채우기`, the verdict CTA is found by
`/^(AI에게 판정 묻기|다시 판정) ›$/`, and a saved verdict lands back on the screen. `flow.js`'s settings step asserts the
screen's four sections and the `롤모델 세부 수정` sub-screen, its no-role briefing step expects `원하는 모습` and
`단계 없음 — …`, and its demo sweep reads the verdict card, the timeline, `계약 목록 ›`, `연결된 업무 없음`,
the stage line, the history delta behind `판정 기록 2건 ›` and the requirement lines behind `펼치기 ›`; `flow2.js`'s role
step passes through `세부 수정 ›`. 255 `await step(` calls as written (`flow.js` 38, `flow2.js` 16, `flow3.js` 25,
`flow4.js` 23, `flow5.js` 19, `flow6.js` 6, `flow7.js` 27, `flow8.js` 28, `flow9.js` 10, `flow10.js` 32, `flow11.js` 31);
every edited file parses (`node --check`), and none of it has been executed.
The no-percent change (2026-09-18, fourth of the day, schema still v28) rewrote the role-model assertions in place under the
same instruction, adding no step: every `%` figure left the role model (the proximity line, the stage progress and
storyline figures, the verdict probability), so `flow.js`'s home step expects the `P` `롤모델 미설정 — 설정에서 롤모델을 정해요`
and no `\d+%` on home, and its demo sweep expects the headline `단계 1/9 계약 기반 개발자 · 조건 3/14`, the role screen's
`단계 1/9` card, the stage line `롤모델 1/9단계 · 조건 3/14 · 전환 조건 미충족 (0/1)`, the delta
`단계 1 → 1 ({today − 29} → {today})`, the requirement lines with no `div.flex.h-2` bar and no legend, and the reader's
`롤모델 판정 · 마지막 {today} · 0일 지남 · 단계 1/9`; `flow2.js` expects the role line
`{name} · 단계 없음 — AI 판정에서 받거나 세부 수정에서 적어요 ›` as a button; `flow3.js` opens the screen from `단계 없음`,
asserts no `%` on home, on the role screen, on the confirm sheet and on the RANK UP overlay, expects the packet head's
`판정 4줄 이내`, `## 지난 판정` with `- {old} · 단계 1/9 · E2E 이전 판정` and neither `"probability"` nor `확률` in the
packet, a pasted reply's `probability: 35` ignored (`"probability" in v` false) while a planted legacy `probability: 10`
survives the editor's save and the verdict save untouched and renders no `%`, and the headline moving
`단계 1/1 E2E 제안 단계 · 조건 0/2` → `조건 2/2`; `flow8.js`'s stage-line helper returns `{ text, title }` and asserts the quit
text on `title` (it had read the visible text, which never carried it — never caught because the suite is not run).
255 `await step(` calls as written (per-file counts unchanged); every edited file parses (`node --check`), and none of it
has been executed.
The day-job AI switch (2026-09-22, schema still v28, no migrate block) edited the suite under the same instruction and
added one step: `settings.workInAi` absent reads as on, so day-job records go into the packets again and the track
caption `직장 트랙은 AI 패킷에 실리지 않아요.` shows only while the switch is off — the four form steps that expected it
(`flow7.js` event form, `flow8.js` contract form, `flow10.js` project form, `flow11.js` work sheet) now assert it is absent;
`flow11.js`'s packet step (renamed `with day-job records switched off none enters a packet; with the switch absent they do`)
plants `workInAi: false` for the v28 assertions, then removes it and expects the day-job meeting, work item and event in
the work packet and `AI에게 회의 준비 묻기` on the day-job event's prep block; a new last `flow11.js` step (`the day-job AI
switch writes settings.workInAi only and its caption follows`) toggles `직장 기록을 AI 요청문에 포함` off and on, asserting
`settings` is the only changed key, the explicit `false` / `true`, both toasts and both captions. 256 `await step(` calls
as written (`flow11.js` 32, the others unchanged); every edited file parses (`node --check`), and none of it has been executed.
The work-proposal track pick (2026-09-22, schema still v28, no migrate block) added one `flow11.js` step under the same
instruction, after the day-job switch packet step: a planted project-less day-job meeting, the work packet head asking for
`"track":"직장|사업|개인"`, and a pasted reply of three proposals — one stating `"track":"개인"`, one linked to the day-job
meeting, one unlinked — whose confirm rows preselect `개인`, `직장`, `직장`; the third is switched to `사업`, and the
registered items store `personal`, `work`, `biz`. With `settings.workInAi` false an unlinked proposal preselects `사업`.
The `flow5.js` review-bridge step asserts its row preselects `사업`. 259 `await step(` calls as written (`flow11.js` 33,
the others unchanged); every edited file parses (`node --check`), and none of it has been executed.
The incremental work packet (2026-09-22, Phase 1 of the check-notification plan, schema still v28, no migrate block) added
three `flow11.js` steps under the same instruction, after the day-job AI switch step: registering one proposal from the work
bridge stamps `act.workRefreshedAt` with today (`act` and `work` the only changed keys, `briefingSeen` unmoved; no scope
chip and no `마지막 갱신` line without a stamp); with a stamp three days back the send pane preselects `지난 갱신 이후`,
line 2 reads `마지막 갱신 {date} · 그 뒤 회의록 {n}건 · 진행사항 {n}건 · 문서 {n}건`, the pre-stamp meeting appears only in
`## 이전 회의록의 새 기록` (its post-stamp progress and its open mine follow-up), the post-stamp document is listed without
its `source`, and `전체` gives the full packet with the pre-stamp meeting line and the `전체 회의록이 실려요 · 마지막 갱신
{date}.` caption; the review bridge shows no scope chip even with a stamp and registers next Monday's item without
stamping. 260 `await step(` calls as written (`flow11.js` 36, the others unchanged — a recount with
`grep -o "await step(" tools/e2e/flow*.js | wc -l`; the 259 above was a miscount of 257); every edited file parses
(`node --check`), and none of it has been executed.
The local check notification (2026-09-22, Phase 2 of the same plan, schema still v28, no migrate block) added three
`flow6.js` steps under the same instruction, before the offline step: with `notifications` granted through
`overridePermissions` and a save planted with one carried item `E2E 이월 확인` and the reader seen today, the settings
sheet's `확인 알림` section states `설치된 앱에서만 주기 갱신이 돼요`, ticking `확인 필요 알림` writes `settings.checkNotify: true`
and nothing else, and after the debounce the `life-check` cache entry reads a `인생 관리 — 확인 필요 {n}가지` title, a body
with `이월 업무 1건: E2E 이월 확인` and without `오늘 읽을 것 안 봄`, and a numeric `ts` (the number of shown notifications is
recorded in `metrics`, not asserted — headless Chrome may not surface them); unticking writes `false` only and deletes
the entry · a refused permission (every permission denied, `requestPermission` stubbed to `"denied"`) writes nothing,
leaves the box unchecked and shows `알림 권한이 꺼져 있어요 — 폰 설정에서 허용해요` · on a seen-today save `?open=reader` and
`?open=issues` each open the reader (`issues` falls back to the reader until the `이슈 목록` screen lands in Phase 3, which
moves that assertion to `이슈 목록`) and strip the query, a plain reload opens nothing, and the served `sw.js` carries
`open: "issues"`, `./?open=issues`, `periodicsync`, `notificationclick` and `k !== CHECK_CACHE` and no reload. 263
`await step(` calls as written (`flow6.js` 9, the others unchanged); every edited file parses (`node --check`), and none
of it has been executed.
Training records and the issue list (2026-09-22, Phase 3 of the same plan, schema still v28, no migrate block) added five
`flow11.js` steps under the same instruction, after the review-bridge step: the meeting form's `교육` chip switching the
placeholders (`교육 이름 — 예: 데이터 품질 지표 교육`, `강사·주최 (선택) — 예: ○○협회`, `배운 것 — 핵심 내용을 요점으로 적어요`,
`핵심 정리 (선택)`, `적용할 것 (선택)`) and the refusal `교육 이름을 입력해 주세요.`, the saved training record carrying
`kind: "training"` while a meeting-kind record saved the same way carries no `kind` key and otherwise the same keys, the
list row's marker leading with `교육` and the view titled `교육 · {title}` with `강사·주최` / `배운 것` / `핵심 정리` /
`적용할 것` · the work packet's `- {date} [{project}] 교육 · {title}` head line with `  배운 것: ` and no `  요약: ` in its
body, the meeting-kind line unchanged, and the prep block naming the older meeting-kind record, not the newer training
record, as `마지막 회의` · the issue list opened from the profile card's `이슈 목록 ›` and the reader's `이슈 목록 ›` (which
stamps the day) with its four sections `할 일 (`, `일정 (14일) (`, `교육 (`, `프로젝트별 최신 회의록 (` in order and no `%` ·
a carried business item leading the `사업` group as `이월 2일`, the training record first under `교육`, the project's
latest row being the meeting-kind record with its `요약:` line, `이전 3건 ›` expanding `교육 · {title}` and two older
meetings (`후속 1/2` on one) and reading `접기`, the latest row opening its minutes, and no key changed · a work row and
an event row opening `WorkModal` and `EventDetailModal` with no key changed (the step also removes the two records).
`flow6.js`'s routing step now expects `이슈 목록` for `?open=issues`, and the `flow.js` demo sweep expects
`프로젝트 3개 · 회의록 6건 · 문서 2건` and `데이터 품질 지표 교육`. 268 `await step(` calls as written (`flow11.js` 41, the
others unchanged); every edited file parses (`node --check`), and none of it has been executed.
Training records are reference only (2026-09-22, same day, schema still v28, no migrate block): the first training step
now expects `기억할 점 (선택)` in place of `적용할 것 (선택)`, a meeting form stating `할 일 연결` / `후속 항목` / `항목 추가`
and a training form stating none of them (nor `확인할 것 가져오기`), a new training record saved with empty `followUps`,
`taskIds` and `progress`, the view stating `기억할 점`, `녹취록` and `수정` but not `후속 항목`, `진행사항이 없어요.`,
`연결된 할 일` or a progress textarea, and an existing meeting's edit form stating
`교육으로 바꾸면 후속 항목·연결된 할 일은 목록에서 빠지고 기록만 남아요.` only while `교육` is picked, writing nothing
until saved · the packet step now expects the work packet to state no line of the training record (the meeting-kind head
line unchanged) and the planted event's prep packet to keep it — `교육 · {title}` head line, `  배운 것: `,
`  기억할 점: {text}`, no `  요약:` / `  적용할 것:` / `  후속` / `  진행` line · a new step plants on the training record a mine follow-up
with no work item and a follow-up owned by someone else linked to a live undone work item, and expects the mine one
absent from the issue list's `할 일`, the meetings-tab marker to read `교육` only, and a form save to leave every work
item as it was and write both follow-ups back unchanged (the step restores the meetings and the work items). 269 `await step(` calls as written (`flow11.js` 42, the others unchanged); every edited file parses
(`node --check`), and none of it has been executed.
The daily gate (2026-09-24, schema still v28, no migrate block — `act.gate?` is optional) added `flow12.js`, six steps
under the same instruction, run after `flow11.js` and before `flow4.js`: the gate opening alone on a save without
today's `act.gate[today].passedAt` (no `nav` / `main`, no icon-only button, an inert background and Escape, the three
step lines `1 읽기 — …`, `2 퀴즈 — 아직`, `3 업무 갱신 — 없음`, the later steps' buttons `disabled`); the reader in
gate-read mode (no section `›`, no `브리핑 ›` / `이슈 목록 ›` / `닫기`; `다 읽었어요` `disabled` on an overflowing sheet until
`[data-read-end]` is scrolled into view; the tap stamps `readReaderAt` and `briefingSeen` and returns to the gate); the
issue list in gate-read mode (a row tap opens nothing, no `건 더 ›` button, `readIssuesAt` stamped, `퀴즈 요청문 만들기 ›`
enabled after both reads); a same-day reload after the pass landing in the app and a save re-dated to yesterday
reopening the gate (the clock is not moved); `?open=issues` opening the issue list above the gate with the query
stripped and its header X returning to the gate without a stamp, then the settings sheet's `오늘의 관문` section stating
the month line computed from the save; and onboarding showing no gate. Phase 2 of the plan inserts the quiz steps
between them. `run.js` gained `plantGate()` — writes today's **synthetic** `passedAt: "00:00"` into the save (a harness
stamp, never a time the app wrote; the rest of the entry is kept; false without a save or a profile) — `reload(opts,
{ keepModal, keepGate })`, which plants that stamp before every reload unless `keepGate` is set, and `passGate()` (plant,
then reload); `closeModal` cannot close the gate (no X, an inert background) and must not be called while it is active.
`flow.js`'s step 6 expects `오늘의 관문 —` right after `이 설정으로 시작` and passes it through `passGate()`, and both demo
entries assert a `nav` and no `오늘의 관문` (the demo stamps today as passed); `flow6.js`'s `?open=` step plants the stamp
by hand because it navigates with `page.goto`; `flow4.js`'s v10 and no-`v` fixtures reload with `keepModal` and pass the
gate afterwards, because the v11 block rebuilds `act` from its four fields and drops the planted stamp. 275 `await step(`
calls as written (`flow12.js` 6, the others unchanged); every edited file parses (`node --check`), and none of it has
been executed.
Phase 2 of the gate (the quiz, 2026-09-24, schema still v28) inserted five `flow12.js` steps (4–8) between the read steps and
the reload step, under the same instruction: the quiz packet opened from `퀴즈 요청문 만들기 ›` (`[인생 관리 — 오늘의 관문 퀴즈 요청
{today}]`, `"quiz"`, `정확히 7개`, the planted `DECISION-E2E-LINE`, `E2E 관문 일정`, `E2E 관문 문서`, `TRAINING-E2E-LINE` and `내용 비공개`,
none of `TRANSCRIPT-SENTINEL` / `HIDDEN-SENTINEL` / `PLACE-SENTINEL` / `NOTE-SENTINEL` / `SOURCE-SENTINEL` / `E2E테스터` / `E2E대학교` /
`E2E전장` / `## 이력`, at most 12,000 chars — step 1's fixture gained those sentinel records); a reply with four valid items and a
three-choice fifth refused with `퀴즈 문제가 5개 미만이에요 — 답변을 다시 받아요` on the paste view, its `work` key registering nothing and
no quiz stamped; a fenced seven-item reply solved 5/7 by choice text (`오늘의 퀴즈 — 7문제`, `기준 6개 이상 정답`, `제출` disabled until
`7/7 답함`) → `5/7 · 미통과 (기준 6개)` with two `정답:` and two `근거:` lines and the cleared-stamps line, the save's `quiz`
`{ 7, 5, false, attempts 1, HH:MM }`, both read stamps gone, `briefingSeen` kept, the gate reading `2 퀴즈 — 미통과 5/7 · 시도 1` with
`같은 문제 다시 풀기` / `새 퀴즈 요청 ›` disabled and no first-quiz button; after re-reading both screens the retry's question 1 carrying
the pasted choice set (order not asserted — a shuffle may repeat it) and 6/7 → `6/7 · 통과 (기준 6개)`, `attempts 2`, both read
stamps intact, the gate `2 퀴즈 — 통과 6/7 · 시도 2` with the work buttons enabled and `통과` still disabled; `업무 추가 ›` → `등록` of
`E2E 관문 업무` → `3 업무 갱신 — 오늘 만든 업무 1건`, `통과` → no overlay, seven tabs, the toast `오늘의 관문 통과 · 퀴즈 6/7`, `passedAt`
`HH:MM`, the item `createdAt` today with `source: "manual"`, the record boundary unchanged. Step 9 no longer plants the harness stamp
(step 8 passed the gate through the app). 280 `await step(` calls as written (`flow12.js` 11, the others unchanged); every edited
file parses (`node --check`), and none of it has been executed.
The first-open stamp (2026-09-25, schema still v28, no migrate block — `act.opened?` is optional) fixed two defects in
passing and added two `flow6.js` steps under the same instruction, between the denied-permission step and the `?open=`
step. The fixes: `flow6.js`'s `restore` helper was declared inside the takeover step's callback and called from two
later steps' `finally` blocks (a `ReferenceError` the not-run suite never surfaced) — it now lives at file level after
`writeState`; `flow4.js`'s v18 → v19 step asserted an exact `act` key set that the harness's own `plantGate` (`gate`) already
broke and the boot stamp (`opened`) would break again — both stamps are filtered out before the comparison. The steps:
a planted save with stamps 61 and 60 days back and no key for today is loaded and, after the load, carries an `HH:MM`
stamp for today, has lost the 61-day key and kept the 60-day one, differs from the plant in `act` alone and in
`act.opened` alone within it; a same-day reload keeps a planted `00:01`; the settings sheet states `자동 실행` between
`AI 요청문` and `확인 알림` with `오늘 첫 실행 00:01 · 이번 달 실행 {n}일` (`n` computed from the save), the five routine steps
as the section's `<ol>` items in order, and both fact captions · with today's gate entry and stamp removed, the gate
opens alone (`keepGate`) and its second line reads `오늘 첫 실행 HH:MM`, equal to the stamp the same load wrote. The
`?open=` step's served-`sw.js` string list gained `addEventListener("push"`, `const showCheck` and `showCheck(true)`
(the worker's push handler shares the periodic sync's routine). 282 `await step(` calls as written (`flow6.js` 11, the
others unchanged); every edited file parses (`node --check`), and none of it has been executed.
The daily push (2026-09-25, Phase 2; schema still v28, no migrate block — `settings.pushNotify?` is optional) added three
`flow6.js` steps under the same instruction, between the first-open steps and the `?open=` step. Headless Chrome has no
push service, so a `pushManager` stub is installed at document start (`installPushStub`: `getSubscription`, a `subscribe`
that records its options and resolves after 800 ms — or rejects when `refuse` — and an `unsubscribe` that records itself)
and a push is delivered through CDP (`ServiceWorker.deliverPushMessage`). The steps: with `notifications` granted, the
`푸시 알림` section sits between `확인 알림` and `오늘의 관문` with the tab caption `설치된 앱이 아니에요 — 알림을 누르면 Chrome 탭으로 열려요`;
ticking `매일 푸시 알림` writes nothing at 400 ms and `settings.pushNotify: true` at 1300 ms (`settings` the only changed key,
`checkNotify` and `workInAi` untouched), the one `subscribe` call carries `userVisibleOnly: true` and the 65-byte key decoded
from `tools/push/send.mjs`'s `PUSH_VAPID_PUBLIC` (first byte 4), the sheet states `구독 등록됨 · …abcdef123456`,
`구독 정보 보기 ›` opens a read-only textarea whose value parses to a subscription JSON followed by the four secret steps,
`복사` hands that value to the stubbed clipboard with the toast `복사했어요 — 저장소 비밀에 붙여넣어요`, the raw save never carries
the endpoint or a key, and unticking unsubscribes, writes `false` and drops the status line · a rejecting `subscribe` writes
nothing and shows `푸시 구독에 실패했어요 — 설치된 앱(Chrome)에서 다시 켜요`, then a denied permission writes nothing, shows
`알림 권한이 꺼져 있어요 — 폰 설정에서 허용해요`, leaves `checkNotify` as it was and reaches `subscribe` no further time · with
`checkNotify` on and a carried item cached, a CDP-delivered push with a sentinel payload navigates nothing, requests nothing
from the page and leaves the cache entry byte-identical; the shown-notification count is recorded as
`metrics.pushNotificationsShown` and, when it is above zero, the first notification must carry the cached title and body,
`data.open === "issues"` and no sentinel; the served `sw.js` push block is free of `e.data`, `fetch(` and `.json(`. The
`checkBox` reader became a thin wrapper over a shared `switchBox(label)` that `pushBox` reuses. 285 `await step(` calls as
written (`flow6.js` 14, the others unchanged); every edited file parses (`node --check`), and none of it has been executed.
The gate deferrals (2026-09-26, Phase 1; schema still v28, no migrate block — `act.gate[date].deferredUntil?` is optional)
made the gate depend on the time of day, so `run.js` gained an E2E clock: `setClock("HH:MM" | null)` hooks `Date` once
per page (`evaluateOnNewDocument`) and pins the hours and minutes to the sessionStorage key `e2e-clock` (seconds and the
date stay real); without the key every `new Date()` passes through to the real clock, so flows that never call it are
unaffected. `tickClock()` dispatches `focus`, which the app's tick listens to, so a live page re-reads the pinned time
without a reload. `flow12.js` pins `22:30` before step 1 (an appointment an earlier flow left for today cannot hold the
gate back), adds `· 미룸 {n}회` to step 10's computed month line, and gained three steps before the restore step (which
clears the key first): 12 a morning appointment (a done `appt` at 09:30 and a daily `appt` at 11:59 cancelled today count;
an untimed `appt`, a `due` at 08:00 and an `appt` at 12:00 do not) — at `21:59` no overlay, `nav` and
`오늘의 관문 22:00부터 — 오전 약속 2건` on home; at `22:00` after `tickClock()` the gate alone with
`오전 약속으로 22:00까지 미뤄졌어요` and no stamp written; without the two counting events the gate stands at `08:00` without the
line · 13 at `10:07` `3시간 미루기` lifts the gate, stores `deferredUntil: "13:07"` and home states
`오늘의 관문 13:07부터 — 미룸`; at `13:06` still no overlay, at `13:07` the gate with `13:07까지 미뤘어요 · 오늘 1회 사용` and no
button, the same after a reload · 14 at `21:30` the tap stores `23:59`, home states `오늘의 관문 23:59부터 — 미룸`, and the
settings line computed from the save ends `· 미룸 {n}회` with `n ≥ 1`. Each new step restores `events` and deletes today's
entry before it ends. 288 `await step(` calls as written (`flow12.js` 14, the others unchanged); every edited file parses
(`node --check`), and none of it has been executed.

Phase 2 of the deferrals (read-only viewing, 2026-09-26, schema still v28) lets the gate's issue list open minutes,
follow-up and event rows as read-only sheets. Step 1's fixture also plants a carried work item `E2E 관문 업무 행` (created
yesterday, so the gate's step 3 still reads `없음`); step 3 now taps that work row and asserts that it opens nothing. Three
steps before the restore step, at the pinned `22:30`, each plant on the current save (the memo group holds only the
planted minutes, the work list only the carried row) and restore `events`, `meetings`, `meetingProjects` and `work`: 15 the
minutes row inside `[data-issue-project]` opens `E2E 읽기 전용 회의` above the gate (two overlays) with its decisions,
follow-up and progress, no `textarea`, no field, every checkbox `disabled`, no `수정` / `추가` / `항목으로 나누기` /
`녹취록 지우기` / `내 담당` / `삭제` button and no `진행사항 삭제`; the transcript toggle still opens `E2E 녹취` without
`녹취록 지우기`; the raw save is unchanged; the header X returns to `이슈 목록` · 16 the row `약속 · E2E 읽기 전용 일정` opens
`일정 — E2E 읽기 전용 일정` with `확인할 것`, `E2E 확인` and `목표 기여 없음`, one `disabled` checkbox, no `완료 표시` /
`완료 취소` / `이번 회차 취소` / `수정` / `추가`, no `확인할 것 삭제`, the raw save unchanged, the X back to the list · 17 the
follow-up row `E2E 읽기 전용 회의 · E2E 후속` opens the same read-only minutes, and the work row still opens nothing. No step
reaches the document sheet's read-only variant (the issue list has no document row). 291 `await step(` calls as written
(`flow12.js` 17, the others unchanged); every edited file parses (`node --check`), and none of it has been executed.

## Scenario layout

| File | Scope |
|---|---|
| `flow.js` | Onboarding, 6 steps — real name, exact birth date, an education entry and a career entry in place of the old age band and chip rows (asserts the fresh save is schema v28 with its CV records) → the home CV (identity, records, area grade rows) with the profile modal opening from it, rejecting an empty name, a malformed e-mail and an end month before its start, and a CV edit that moves no area grade → goal (OKR) with three KR types → task registered through the count-KR bridge (`채우기 ›`, the one path that takes no activity kind) → completion → catalogue → the seven-tab bottom nav order and one-line labels (`프로필 · 목표 · 할 일 · 업무 · 일정 · 미팅 · 사업`, updated 2026-09-17) → persistence across reload; the demo sweep expects the `업무` tab's counts line `남음 2건 · 이월 0건 · 완료 1건 · AI 제안 1건` (the v26 demo adds a work item registered from a meeting follow-up) and the `미팅` tab's `프로젝트 2개 · 회의록 4건` with the `프로젝트 없음 · 긴급 메모` group and its row `긴급 메모 — ◇◇스튜디오 전화` (2026-09-17), and (v27) `문서 2건` with the demo documents `요구사항 정의서 v1` and `◇◇스튜디오 예약 페이지 현황 메모`; on `프로필` the CV card's `오늘 읽을 것 ›` opens the daily reader with `어제 완료 · ○○물산 월 리포트 양식 회신` (entering the demo opens nothing by itself); (v28) the demo's day-job project moves the lines to `남음 4건 · 이월 0건 · 완료 1건 · AI 제안 1건` with the heads `직장 2건` and `사업 3건`, and to `프로젝트 3개 · 회의록 5건 · 문서 2건` with `데이터 프로파일링 — 데모기관` tagged `직장`; (v28 Phase 2) `사업` → `로드맵` states `예정 7 · 진행 중 1 · 완료 1` and `계약금 입금 확인 — ETL 고도화 계약`; (v28 Phase 3) `업무` states `이번 주 사업 4.5h/20h` and `사업` `일시금 미확인 1건 · 이번 달 일시금 입금 {0원 | 60만원}` — the demo's paid final line is stamped 18 days back, so the figure depends on the day of the month; (v28 Phase 4) `프로필` states the stage line `단계 1/9 · 조건 3/14 · 전환 조건 미충족 (0/1)` — since 2026-09-18 the stage headline `단계 1/9 계약 기반 개발자 · 조건 3/14` with that line on its `title`, no caption and no percentage, no overlay on entry, the `롤모델` screen it opens (the verdict card `단계 1/9`, the timeline `1단계 계약 기반 개발자` with `- 입금 확인된 일시금 수 'deposit' 0/1` and its `계약 목록 ›`, `연결된 업무 없음`, the stage line `롤모델 1/9단계 · 조건 3/14 · 전환 조건 미충족 (0/1)`, `2단계 … 조건 1개`, the `단계 1 → 1 ({today − 29} → {today})` delta behind `판정 기록 2건 ›` and the per-area requirement lines with no bar behind `펼치기 ›`, no `%` anywhere) and the reader's `롤모델 판정 · 마지막 {today} · 0일 지남 · 단계 1/9`; (v28 Phase 5) `사업` → `리드` states `리드 2건 · 다음 액션 기한 지남 1건` and `공고` lists `데모 AI 바우처 공고` with `공고 1건 · 마감 14일 이내 1건` |
| `flow2.js` | Certification milestone with certificate photo (evidence gate block verified) · study output verification · reading activity log · promotion · the role model, saved on the `roleEdit` sub-screen reached through the settings `롤모델` button and its `세부 수정 ›` (2026-09-18) · the role line under the home CV reading `{name} · 단계 없음 — AI 판정에서 받거나 세부 수정에서 적어요 ›` with no stage line and no percentage for a role model without stages (v28, rewritten 2026-09-18) · a CV area grade row opening the promotion gate · the achievement wall opening from the CV's `성취` row with its counts · to-do rows showing a lead chip, the title and at most one marker (2026-09-16) |
| `flow3.js` | Profile photo registered through the profile modal, with no file input inside the modal · exam KR and score-report submission (now also typing the exact score, validated against the band, 2026-09-16) · exercise activity · a kind-less task refused under a goal · the `롤모델` screen — the role line opening it with `영역 등급` collapsed until `펼치기 ›`, expanding to the per-area requirement lines with no bar, no legend and no percentage · (v28) role-model stages — the CV stage line with its condition count and no percentage on home, the storyline's unmet conditions and its `충족` mark, the `기본 9단계 채우기` seed and the `roleEdit` stages editor (which keeps a planted story and verdict and stamps `seenStageK`) · (2026-09-18) the story templates and the story-only save, the storyline's `지금 할 것` landings, the linked work items, `롤모델 초기화`, and the briefing and reader lines opening the screen · (2026-09-18) the role verdict packet with the story, the CV line, the grades, the counts and the stages and no identifier, and a pasted verdict reply's confirm sheet, rejects and confirmed save (`role` only) · (2026-09-18, Phase 2) the stage headline `단계 k/n {name} · 조건 c/m` with no caption and no percentage, records moving the condition values, the once-per-stage completion overlay, and the reader's `롤모델 판정` line for an old verdict and for none, its `›` opening the `롤모델` screen · task and goal deletion · one-day gap (streak, shields) |
| end of `flow.js` | Data reset opened through `openSettings()` — asserts the state and profile-photo keys are removed and no modal is left behind (runs last) |
| `flow5.js` | Due dates and the `할 일` tab's time-ordered groups · the `할 일` tab leading with the overdue group and opening the briefing · the daily briefing and, since v27, the daily reader `오늘 읽을 것` (a new day opens the reader — never the briefing — with its sections in order, `롤모델 판정` last before `브리핑 ›` since 2026-09-18, the `{yesterday} 이후 새로 들어온 것` title, `브리핑 ›` and no checkbox, and closing it stamps `act.briefingSeen`; the same day reopens neither; the streak wording is read in the briefing reached through `브리핑 ›`; the reader opens from the profile card's `오늘 읽을 것 ›` and from the briefing's own button, `계약·입금 미확인 열기` lands on `사업` with no overlay left, written 2026-09-17, not run) · journal persistence · the assistant packet, the pasted reply and its import rules (including a reply-declared `kind` on a title that names no activity being refused on its own row) · the weekly review, which no longer chains to a metric check-in, stating per-track facts (v28) and opening the `주간 회고` packet only once this week's review is saved, whose reply registers next Monday's business work items (written 2026-09-18, not run) · the completed-task archive stating its completion date (as a `MM-DD` lead chip since 2026-09-16), its count line stating the total of completed tasks plus ticked event occurrences, and completing nothing when tapped |
| `flow7.js` | The `할 일` tab listing today's `마감` event as a one-line row with no checkbox, tagged `목표 기여 없음`, completable only through its detail sheet's own `완료 표시` button; once ticked it stays in `오늘` struck through and led by `완료`, the `오늘` count drops by one, no `오늘 완료` section exists, and the `완료` archive lists it (tagged `목표 기여 없음`) until it is un-ticked. The `일정` tab, calendar-only since 2026-09-16 (its `목록` view, `목록`/`달력` chips and header `일정 추가` button are all gone): form validation · the month grid (cells, weekday header read cell by cell, markers per kind) · a save that stored the retired list view opening on the calendar instead · today selected on entry · the selected-day panel rendering the full `EventRow` · an appointment with its time, a deadline and its D-day, and a weekly repeat marking both weeks, each read from the day it falls on via a `showDay` helper · `이 날짜에는 일정이 없어요.` on an empty day · `일정 추가` prefilled with the selected day · `‹` / `›` paging and `오늘` · weekend and public-holiday tones read off the day numbers · a holiday naming itself on the panel · a month outside the holiday table marking nothing and stating which years it covers · the `오늘 일정` briefing section · the 일정 tab's own counts line stating today's deadline · the packet section · the form's `프로젝트 (선택)` picker storing `projectId` only when chosen and dropping it on `연결 안 함`, with no meeting or project record moved (v26, written 2026-09-17, not run) · the event sheet's `확인할 것` checklist (v27) is covered by `flow11.js`, which plants the project fixtures it needs · the form's `트랙` chips (v28): a new event opens on `직장`, picking a business project moves the chip to `사업` and stores `track: "biz"`, a tapped `개인` survives a later project pick, and an event with neither stores `work` (written 2026-09-17, not run) |
| `flow8.js` | The 사업 tab, `계약` / `단가` / `포트폴리오`. Deal-form validation · a won contract's period, total and margin under `진행 중` · a boundary check that registering a deal and ticking a payment change `deals` only, never tasks, goals, streak or trophies · a payment chip toggled and un-toggled · a lead with no numbers · a quote feeding the pipeline line · the cost-missing line on a deal and on a rate · the rate view's margin and footer count · a landscape portfolio image kept at its own aspect and never upscaled · deleting a portfolio entry removing its image key · the chosen view surviving a reload (and the retired `ui.scheduleView` key confirmed gone, 2026-09-16) · the briefing's `사업` section with its packet counterpart · the `할 일` tab listing the same unpaid month as a business row that opens its own detail sheet with no completion control · a pasted reply naming a deal, a rate, a portfolio entry and an appointment that creates none of them · the packet stating the CV at degree and role level with no name, birth date, contact, school or company · a regression step that fills the briefing section's cap with alerts and asserts the closing revenue line still renders · a new contract stores `track: "biz"`, its row carries the cyan `사업` tag and the form opens on `사업` (v28, written 2026-09-17, not run) · **the roadmap (v28 Phase 2, written 2026-09-18, not run)**: on an emptied roadmap `로드맵이 비어 있어요.` and `기본 로드맵 채우기` seed nine planned milestones (stages 1–9, `createdAt` today, no links) with the toast `기본 로드맵 9건을 채웠어요`, the counts line `예정 9 · 진행 중 0 · 완료 0` and a first-row marker `{D-day} · 업무 0/0`, writing `milestones` only · `마일스톤 추가` with stage 5, `진행 중`, a condition, one contract and one planted work item stores the links without `doneAt` and shows `단계 순서: 1단계 미완 · 5단계 진행 중`; marking stage 1 `완료` stamps `doneAt` today and the note moves to `2단계`; setting the new milestone to `예정` removes the note; a 61-char title is refused with `마일스톤 이름은 60자까지예요 — 지금 61자예요.`; the confirmed delete leaves nine; every write moves `milestones` only · a planted milestone created 10 days back and due in 10 with two linked items states `궤도 유지` at 1/2 and `50%p 앞섬` at 2/2, and the reader's `사업 로드맵` section (after `계약·입금 미확인`) lists `3단계 · E2E 페이스 마일스톤 · D-10 · 업무 2/2 · 50%p 앞섬`; the step removes its plants, resets `milestones` to `[]` and the view to `deals` · **payment lines (v28 Phase 3, written 2026-09-18, not run)**: on a planted won contract, `항목 추가` · `계약금` · a due in 3 days · `1000000` stores one `deposit` line without `paidAt`, writing `deals` only; the row's chip reads `계약금 {due} · 100만원`, the header's third line `일시금 미확인 1건 · 이번 달 일시금 입금 0원`, and the briefing `E2E입금사 E2E 일시금 계약 — 계약금 입금 예정 {due} · 미확인`; tapping the chip stamps `paidAt` today (toast `계약금 입금 확인으로 표시했어요`, emerald chip, no `paidMonths` stamp), leaves the two monthly header lines unchanged and reads `일시금 미확인 0건 · 이번 달 일시금 입금 100만원`; a second tap removes the stamp · a line with a date and no amount is refused with `입금 예정 1번째 항목의 날짜와 금액을 입력해 주세요.` and nothing is written; removing the only line drops the `payments` key; both steps remove the planted contract · **pipeline and notices (v28 Phase 5, written 2026-09-18, not run)**: with the contract, lead and notice lists stashed and emptied, `리드 추가` refuses an empty name (`병원·기관 이름을 입력해 주세요.`), then `E2E병원` at `접촉` with a next action due yesterday stores `stageAt` and `createdAt` today and no `dealId`, writing `leads` only; the view reads `리드 1건 · 다음 액션 기한 지남 1건`, the briefing `다음 액션 기한 지난 리드 1건`, the reader's `사업 파이프라인 · 공고` the full lead line; with `stageAt` planted 5 days back the sheet states it and `계약 연결 없음`, and `견적` → `저장` stamps today · `계약 만들기 ›` writes nothing and opens `새 계약` with `E2E병원`, `견적` and `사업` on; registering it toasts `계약을 등록했어요 · 리드 연결`, writes `deals` and `leads` only, stores a `biz` quote and sets the lead's `dealId`; the sheet then names the contract and offers no button · `공고 추가` refuses a missing agency and deadline, then stores a `review` notice with one planted document (`문서 연결 (1/10)`), writing `notices` only; the view reads `공고 1건 · 마감 14일 이내 1건`, the briefing `공고 E2E 공고 — 마감 D-5`, the reader the full notice line, and the daily packet names neither; two planted `notice_status` stages read `단계 1/2 · 조건 0/2` and, after `제출` is saved, `단계 2/2 · 조건 1/2 · 전환 조건 미충족 (0/1)`; the confirmed delete writes `notices` only; `finally` restores the stashed lists and the contract view |
| `flow9.js` | Calendar export — the `일정` header's `캘린더로 내보내기` button, run between `flow8.js` and `flow4.js`. The sheet states its snapshot limits and stores nothing · one `VEVENT` per included event, task, daily digest and goal deadline, each with its `VALARM`, checked against a planted save · a weekly repeat's `RRULE` / `UNTIL` / `EXDATE` · a clamped monthly repeat written as the app's own dates with no `RRULE` · byte-counted folding, with a Korean title unfolding back to the original · a second export keeping every UID with a non-decreasing `SEQUENCE` · the privacy boundary against CV, business, `place` / `note` and journal values · the empty-selection state · (v28, written 2026-09-18, not run) a follow-up due, a check reminder the day before its meeting, a milestone with its D-7, a payment line without its amount and a notice deadline; past-dated items counted as skipped and a check whose meeting is today not written |
| `flow10.js` (new 2026-09-16) | The `미팅` tab — project-grouped, hand-written meeting minutes, run between `flow9.js` and `flow4.js` (which replaces the save). The tab starts empty and states its storage use · the project form refuses an empty name, then registers · the meeting form refuses a missing title, a missing summary and an over-cap summary · meetings register under their project, newest first, and a shared `recordBoundary` check proves saving minutes moves nothing else (no trophy, achievement, streak, shield, task or goal change) · a meeting links to a same-day `일정` occurrence without copying its time, and the link survives the event's own deletion, stating `연결된 일정이 삭제됐어요` · the view shows the full minutes and editing replaces the record while keeping `id`/`createdAt` · a project with minutes cannot be deleted, an empty one can · a meeting that would exceed the storage budget is refused with the form kept open and the typed title intact · meetings travel in the backup file · the briefing, the to-do list and the assistant packet never mention a meeting · **task links (v24)**: ticking two planted tasks in the form's `할 일 연결` picker (narrowed with `할 일 검색`) stores their ids in `taskIds` and leaves `tasks` byte-identical · the meeting view lists them under `연결된 할 일` and tapping one replaces the view with that task's sheet · the task sheet lists the meeting as `{date} {title}` under `관련 회의록` and opens it, while an unlinked task's sheet has no such section · the picker disables an eleventh task at 10 links and states `할 일은 10개까지 연결돼요.` · deleting a linked task removes its id from the meeting and nothing else, and a dangling id planted into the save is skipped and counted as `삭제된 할 일 1건`; the step then removes the planted tasks and meeting so `flow4.js` starts from the save it used to · **follow-up items (v26, written 2026-09-17, not run)**: the form's `항목 추가` rows with a `내 담당` chip and a due date store `followUps`, and the mine item registers one `source: "meeting"` work item dated today with a two-way link (toast `회의록을 등록했어요 · 업무 1건 등록`, row marker `후속 2/2`, work lead `회의`) · ticking `후속 완료` in the view marks the work item done and `완료 취소` on the work sheet reopens both · turning `내 담당` off deletes the undone work item and turning it on registers a new one · deleting the work item leaves the follow-up mine and unlinked, stated as `업무 삭제됨` · `항목으로 나누기` lists three ticked candidates from the free text, appends the ticked two (one mine) and leaves `actions` byte-identical · with 29 items the split disables the candidates past the room and states `후속 항목은 30건까지예요 — 1건만 추가할 수 있어요.`, and at 30 the form's `항목 추가` is disabled · the work packet states the step-16 meeting's items as `  후속 2건:` with one `  - {내 담당|타인} · {기한 …|기한 없음} · {완료|미완료} · {text}` line each and no raw `  후속:` line, keeps `  후속: 원문 후속` for a planted meeting without items, and states a hidden meeting with follow-ups as its title and `내용 비공개 (AI에 보내지 않기)` only; that last step removes the meetings and work items these steps made, so `flow11.js` starts from the save it used to · **urgent memos and transcripts (2026-09-17, written, not run)**: `긴급 메모 추가` in the always-rendered `프로젝트 없음 · 긴급 메모` section opens `새 회의록` with the `없음 (긴급 메모)` chip on; the summary is still textarea 0 until `녹취록 붙여넣기` opens the transcript textarea; the saved memo has `projectId: null`, the transcript byte-identical to the paste (line breaks and leading spaces kept), and lists in the memo group after the project sections · the view states `녹취록 {n}자 · 펼치기` and `없음 (긴급 메모)` with the `AI 전송` fact unchanged, expands to the text and `녹취록 지우기`, and `접기` hides it again · the edit form opens the transcript at once, refuses 30,001 chars with `녹취록은 30000자까지예요 — 지금 30001자예요.` keeping the paste in the textarea, and stores 30,000 · `녹취록 지우기` (confirmed) removes the `transcript` key only — summary, decisions, follow-ups and progress byte-identical — and the block reads `없음` · picking the project chip in the edit form moves the memo into that project's section (`긴급 메모가 없어요.` back on screen) and picking `없음 (긴급 메모)` returns it; the step then removes the memo · **documents (v27, 2026-09-17, written, not run)**: the empty counts line reads `프로젝트 0개 · 회의록 0건 · 문서 0건 · 저장 공간 …` · `문서 추가` in a project section opens `문서 추가` with that project's chip on and registers `{ id, projectId, title, source, summary, addedAt }` (summary line breaks kept, `addedAt` today), moving no meeting, work item or boundary record; the section head ends `문서 1건`, the row leads with `문서`, and the counts line states the count · the sheet states `프로젝트` / `추가일`, refuses a 61-char title (`문서 제목은 60자까지예요 — 지금 61자예요.`) and a 5,001-char summary (`문서 요약은 5000자까지예요 — 지금 5001자예요.`), and an edit with the source cleared drops the `source` key keeping `id` / `addedAt` · the memo group's `문서 추가` stores `projectId: null`, and the sheet's chips move the document into a project and back · a planted project with one document has `삭제` disabled with `문서 1건이 있어 삭제할 수 없어요 — 문서를 먼저 지워요.`; deleting the document (confirm `{title} 문서를 삭제해요. 계속할까요?`, recorded) enables it, the project is deleted, and the step's documents are removed so `flow11.js` starts from the save it used to · **tracks (v28)**: a project registered with `사업` stores `track: "biz"` and its head carries the tag; a meeting added on it stores no `track`; the memo form shows the track chips only while `없음 (긴급 메모)` is on, stores `personal`, and a memo moved into the project loses its own `track` (written 2026-09-17, not run) |
| `flow11.js` (new 2026-09-17, written, not run) | The `업무` tab and the meeting progress log (schema v25) — a work item is a record, never a task; runs between `flow10.js` and `flow4.js`. The tab starts empty, states `오늘 업무 — {today}` and its counts line, and pages with `‹` / `오늘` / `›` · a progress entry typed in the meeting view is stored with today's date under `meetings[].progress`, listed with its date, counted as `진행 1건` on the minutes row, and moves no other meeting field, work item, trophy, streak, task, goal or event · the progress textarea refuses an empty entry and a 301-char one · the `AI에 보내지 않기` checkbox in the meeting form stores `aiHidden` as a boolean, which the view states as `보내지 않음` / `요약·진행사항 포함` · a manual work item registers under today with `source: "manual"`, a `프로젝트` link, the `수기` lead chip and the kind-word marker, stores no task field and changes no task, meeting, streak or trophy · completing it from its sheet keeps the row in place struck through, moves `남음` to `완료`, changes `work` only, and `완료 취소` reverts it · an undone item planted three days back is carried first onto today's list with the lead `이월 3일` and `남음 2건 · 이월 1건`, is absent on yesterday's view (whose counts line has no `이월` fragment), is listed with `수기` on its own day, and keeps its stored date (carry-forward is derived, 2026-09-17) · completing it from its sheet (`{date} · 이월 3일`) keeps its date, takes it off today's list (`이월 0건`) and leaves it struck through on its own day, where `완료 취소` carries it again · the briefing states one undone item dated four days back as `이월 업무 1건 · 최장 4일` without its title, and tapping the line closes the briefing on the `업무` tab · with twenty planted items a twenty-first still registers (`업무를 등록했어요`; no per-day cap since 2026-09-17) · the backup file carries `work` and the meeting's progress entry at schema v25 · a work reply pasted as bare JSON (no fence) after analysis lines lists all twelve of its proposals (`제안 업무 확인 — 12건`, above the old limit of 8); the work packet stays within its 20,000-char cap and states a visible meeting's attendees and linked tasks, never a hidden meeting's attendees; select mode deletes one ticked item, then every item after `전체 선택` — which ticks the carried row too — and moves no other record; the packet's work-record section, headed `업무 기록 (이월·어제·오늘)`, states the carried item as `- {date} 미완료 · 이월 3일 {title}` · a project-linked event today and an event tomorrow titled like a previous meeting give the `업무` tab's first section `오늘 회의 준비` two blocks (time, last meeting, decisions, `내 담당 · {text} · 기한 없음 · 업무 없음`, progress) and the first block's `회의록 열기 ›` button opens that meeting (the block itself is a `div` since v27); the briefing states `오늘 회의 준비 1건 · 내일 1건`, then `후속 기한 지남 1건 · 내 담당 1건` once the item is overdue, and that line opens `미팅`; the file ends by removing everything it planted so `flow4.js` starts from the save it used to · **urgent memos (2026-09-17, written, not run)**: the work packet states a planted project-less memo as `- {today} [프로젝트 없음] {title}` with its `요약:` line and none of its transcript (a sentinel string) · a work item linked to that meeting shows `회의록 열기` under its `연결` fact, which replaces the sheet with the meeting's view (one overlay, the collapsed `녹취록 …자 · 펼치기` row); closing it lands on `업무`; a goal-linked item has no such button; both steps remove what they planted · **pre-meeting checks and the prep packet (v27, 2026-09-17, written, not run)**: on a planted project event with a document, a hidden meeting and a transcript, the prep card states `문서 1건`, `{document title} — …` and `확인할 것 0/0`; the add row refuses an empty and a 201-char check, then stores `{ id, text, done: false, source: "manual" }` on that event only (every other key and event byte-identical), the checkbox ticks and unticks it (`0/1`), and `확인할 것 삭제` asks `확인할 것을 삭제해요. 계속할까요?` · the event sheet from `할 일` states `프로젝트 · {name}`, `확인할 것 1/1` and the check above `목표 기여 없음`, and a plain appointment's sheet shows no checklist · `AI에게 회의 준비 묻기` builds a packet with the event line, `- {check} · 미완료`, the project's minutes, `## 문서 (1건)` with the summary, the hidden meeting as date and title only, no transcript, no `## 이력`, no profile identifier, at most 20,000 chars, and — with a won contract whose client is part of the project name — `- 진행 중 · {client} {title} · {month} ~ …` and `  미수 {month} …` · a pasted reply with `checks`, `tasks`, `work` and `deals` lists three proposals, refuses the existing check (`이미 확인할 것에 있어요`), shows `근거: …` / `근거 없음`, and registers two `source: "ai"` checks (one with the basis folded in as `{text} — {basis}`) while `tasks`, `work`, `deals`, `meetings`, `documents` and `journal` stay byte-identical; at 30 checks the confirm view refuses with `확인할 것은 30건까지예요 — 0건만 등록할 수 있어요.` · in a new meeting linked to the event, `확인할 것 가져오기 (3건)` copies the three texts into follow-up rows with `내 담당` off and states `확인할 것 3건을 가져왔어요 — 이미 있는 0건은 건너뛰었어요.`, a second tap skips all three, and the saved meeting's follow-ups are `mine: false` while the event's checks and `work` are unchanged; the step removes every plant · **the daily reader (v27, Phase 3, written, not run)**, before the import-checks step: with `act.briefingSeen` three days back, a planted open work item with a note, a done item dated yesterday with a result and an overdue mine follow-up on the prep meeting, the load opens `오늘 읽을 것 — {today}` whose seven blocks state, in order, the prep row (`오늘 10:00 · {event} · {project}`, `확인할 것 3/3`, `- {check}`, `결정: 월 10시간`, both follow-up lines, `문서: {title}`), the work (`메모:`, `어제 완료 · …`, `처리: …`), the overdue follow-up with its D-day (and not another person's undated item), the decision, `{date} 이후 새로 들어온 것` with the meeting and the document, the business totals and the goal-pace head; no transcript is shown; closing changes nothing but `act.briefingSeen`; the step removes its own plants · **tracks (v28, written 2026-09-17, not run)**: one item per track planted in reverse order lists `직장` → `사업` → `개인` under the heads `직장 1건` / `사업 1건` / `개인 1건`, and the sheet's chips round-trip `track`; the reader's `오늘 업무` and `오늘·내일 회의 준비` sections and the briefing's prep line (`오늘 회의 준비 3건 · 직장 1 · 사업 1 · 개인 1`) and schedule lines state the tracks in that order; a day-job project, meeting, work item, event and contract (sentinel `E2E-WORK-TRACK-SENTINEL-51aa`) stay out of the work and daily packets, the meetings heading counts only packet-track meetings, the prep block states `직장 트랙 — AI 패킷에 실리지 않아요` with no ask button, and flipping the project to `사업` brings its meeting into the work packet while the work item, the event and the contract stay out · **time budget and time log (v28 Phase 3, written 2026-09-18, not run)**: typing `90` into `걸린 시간` and `완료로 표시` writes `minutes: 90` and exactly one business `timeLog` entry with the item's `workId`, moving `work` and `timeLog` only; the week line moves from `이번 주 사업 0h/20h · 남은 날 {d} ›` to `1.5h/20h`; `완료 취소` removes the entry and keeps `minutes`; `1441` is refused with `걸린 시간은 1 이상 1440 이하 분으로 입력해 주세요.`; deleting a completed item leaves no entry · the week line opens `사업 시간 기록`, whose quick entry refuses `0` with `분을 1 이상 1440 이하로 입력해 주세요.`, records `120` on `사업` (toast `시간 120분을 기록했어요`, one entry without `workId`, `timeLog` only) and the line reads `2h/20h`; `주간 사업 시간` `10` writes `settings` only (toast `주간 사업 시간을 10시간으로 저장했어요`, line `2h/10h`), `169` is refused with `0 이상 168 이하 정수로 입력해 주세요.`; the typed entry is deleted through `시간 기록 삭제` after the confirm; each step restores the save's own `timeLog` and `settings` · (2026-09-22) the packet step runs twice — `settings.workInAi: false` planted (no day-job record in any packet, the captions and the prep notice shown), then the switch absent (the day-job meeting, work item and event in the work packet, the ask button on the day-job prep block) · the `AI 요청문` switch in settings writes `settings.workInAi` only, `false` then `true`, with both toasts and captions · (2026-09-22) registering a work-bridge proposal stamps `act.workRefreshedAt` (`act` and `work` only); with a stamp the send pane preselects `지난 갱신 이후` (the `마지막 갱신` line, only post-stamp meetings under `최근 회의록`, the pre-stamp meeting's new progress and open mine follow-up under `이전 회의록의 새 기록`, the post-stamp document without its `source`) and `전체` gives the full packet; the review bridge shows no chip and never stamps · (2026-09-22) a training record saved from the form's `교육` chip (its placeholders, `kind: "training"` only on it, the `교육` marker, the relabelled view), no follow-up, task-link or progress control on it (2026-09-22 amendment), its absence from the work packet and from the issue list's `할 일`, its `교육 · ` head line and `기억할 점:` line in the prep packet, the prep card ignoring it as the last meeting, and the `이슈 목록` screen — its entry points, section order, the carried row first, the training row, the latest minutes, `이전 3건 ›`, and rows opening existing sheets with no key changed |
| `flow12.js` (new 2026-09-24, written, not run) | The daily gate — runs between `flow11.js` and `flow4.js` on the save `flow11.js` leaves, plus a planted project with twelve 300-char-decision meetings so the reader overflows. The gate alone on a save without today's stamp (no `nav`, no `main`, no icon-only button, inert background and Escape, the three step lines, `퀴즈 요청문 만들기 ›` / `AI로 만들기 ›` / `업무 추가 ›` / `통과` `disabled`, the two open buttons enabled) · the reader above it in gate-read mode (no `[aria-label$=" 열기"]`, no `브리핑 ›` / `이슈 목록 ›` / `닫기`, `다 읽었어요` disabled until `[data-read-end]` is scrolled into view, then `오늘 읽을 것 완료 HH:MM` on the gate, `readReaderAt` and `briefingSeen` stamped) · the issue list above it (a work row tap opens no sheet, no `건 더 ›` button, `이슈 목록 완료 HH:MM`, `readIssuesAt` stamped, the quiz button enabled) · the quiz packet's content and privacy sentinels · a four-item reply refused, its `work` key ignored · a seven-item reply failing 5/7 with both reads cleared · the reshuffled retry passing 6/7 after a re-read · `업무 추가 ›` → `등록` → `통과` closing the gate with the toast and `passedAt` · after the pass a same-day reload shows no overlay and seven tabs; the save re-dated to yesterday reopens the gate alone with both reads `미완료` · `?open=issues` opens the issue list in gate-read mode above the gate with the query stripped, its X leaves the gate alone without a stamp, and the settings sheet states `오늘의 관문` with the month line computed from the save · onboarding after `localStorage.clear()` shows `시작하기` and no gate; the record boundary is unchanged and the save is restored. Steps 12–14 (2026-09-26, on the E2E clock pinned by `setClock`): the morning-appointment deferral until 22:00 (the home line before, the gate line from it, untimed / deadline / noon events defer nothing), the one `3시간 미루기` a day (+3 h, the used line, no second button, persists across a reload) and its 23:59 cap with the settings line's `· 미룸 {n}회`. Steps 15–17 (2026-09-26, Phase 2): inside the gate the minutes, event and follow-up rows open read-only sheets (no write control, disabled checkboxes, the raw save unchanged, the X back to the issue list) and a work row opens nothing. |
| `flow4.js` | Goal created and taken to 100% → marked achieved → removed from the record · a second goal planted and deleted while active (its open task removed, its completed task kept and shown in `할 일`'s `완료` view tagged `목표 기여 없음`) · legacy v10 save migration · save without a `v` field (asserts schema v13 trophy-kind conversion) · v13 → v14 field rename · v14 → v15 assistant fields · v15 → v16 schedule · v16 → v17 schedule view · v17 → v18 meeting task converted to a plain task · v18 → v19 life metrics removed · v19 → v20 business records added · v20 → v21 CV records added with every legacy profile value kept · v21 → v22 exam score fields added with nothing backfilled and the retired `ui.scheduleView` key dropped (2026-09-16) · v22 → v23 meeting records added as empty arrays (2026-09-16) · v23 → v24 `taskIds: []` backfilled on a planted meeting with every other field and key unchanged (2026-09-16) · v24 → v25 `work: []` added and `progress: []` / `aiHidden: false` backfilled on a planted meeting that carries a task link, with every other field and key unchanged (2026-09-17, written, not run) · v25 → v26 `followUps: []` backfilled on a planted meeting that carries progress and `aiHidden: true`, with `actions`, work items and events (no `projectId`) unchanged and no key added (2026-09-17, written, not run) · v26 → v27 `documents: []` added as the only new key, with meetings, work and events (no `checks` backfilled) unchanged and `문서 0건` on the `미팅` tab (2026-09-17, written, not run) · v27 → v28 `track: "work"` on every project, document, event, work item and memo, `track: "biz"` on the deal, no `track` on the project meeting, `milestones` / `timeLog` / `leads` / `notices` empty and `settings: { bizHoursPerWeek: 20 }` as the only new keys, no `payments` / `minutes` backfilled, the role unchanged, and `직장 1건` on the `업무` tab (2026-09-17, written, not run) |
| `flow6.js` | Service worker registration and control, a first visit that does not reload itself, a page already under a worker that does not reload when a new one takes over, the precache contents, the app opening offline, and the backup export/import round-trip opened through `openSettings()` — the file carries `timeLog` and `settings.bizHoursPerWeek` and the restored save states the same two (v28 Phase 3, written, not run) · the `확인 필요` notification (2026-09-22, written, not run): the settings switch writing `settings.checkNotify` only, the `life-check` cache entry with permission granted and its removal on switch-off, a refused permission writing nothing, and `?open=issues` (the `이슈 목록` screen) / `?open=reader` routing with the served `sw.js` handlers (runs last: it toggles offline mode) · the first-open stamp (2026-09-25, written, not run): `act.opened[today]` stamped `HH:MM` once at boot with the 61-day key pruned and the 60-day key kept, `act` the only changed key, a same-day reload keeping a planted `00:01`, the settings sheet's `자동 실행` section (the line, the five routine steps, both captions, its place between `AI 요청문` and `확인 알림`), and the gate's `오늘 첫 실행 HH:MM` line equal to the stamp; the served `sw.js` now also checked for `addEventListener("push"`, `const showCheck`, `showCheck(true)`; `restore` moved to file level (a `ReferenceError` fix) · the daily push (2026-09-25 Phase 2, written, not run): with a `pushManager` stub installed at document start, the `푸시 알림` section between `확인 알림` and `오늘의 관문`, the switch writing `settings.pushNotify` only and only after `subscribe` resolved (nothing at 400 ms, `true` at 1300 ms), the `subscribe` options (`userVisibleOnly: true`, the 65-byte key equal to `send.mjs`'s `PUSH_VAPID_PUBLIC`), the status line `구독 등록됨 · …abcdef123456`, the textarea behind `구독 정보 보기 ›`, `복사` with its toast, the four secret steps, the raw save free of the endpoint, switch-off unsubscribing first; a rejecting `subscribe` and a denied permission each writing nothing with their notices and `checkNotify` untouched; a CDP-delivered push with a sentinel payload — no navigation, no request, the cache entry unchanged, the shown notification (when observable) carrying the cached text and no sentinel, the served push block free of `e.data` |

Steps assert outcomes rather than just clicking: `assertDone` checks the completed label (its `replace(/s+/g, …)`
regex is missing a backslash — a pre-existing defect affecting only a failure message, not the check itself, see
[tech-debt-tracker.md](../../docs/exec-plans/tech-debt-tracker.md)), `clickInModal` scopes clicks to the open
modal, `modalError` reads validation messages, `openAreaGate` opens an area's promotion gate through the home
CV's grade rows, `openSettings` opens the home settings sheet, `overlayText` reads the topmost overlay's text.
`captureDownload` takes the file a download button offers instead of letting the browser save it, and serves the
backup-export step and every calendar-export step and (2026-09-16) `flow10.js`'s backup step. **2026-09-16
helpers**: `openTodo(title)` opens a to-do row's detail sheet without completing it; `completeQuest(title)` now
opens the row's sheet and presses `완료하기` inside it, since a row itself carries no completion control any
more; `submitPhotoEvidence(title, { score } = {})` types the exact score into an exam task's evidence form;
`recordBoundary(st)` (moved out of `flow8.js` into `run.js`, shared with `flow10.js`) snapshots what a record
save (a deal, a meeting) must never move — trophies, achievements, streak, shields, `lastActive`, tasks, goals.
**2026-09-24 helpers**: `plantGate()` writes the synthetic gate stamp for the page's own today; `passGate()` plants it
and reloads; `reload(opts, { keepGate: true })` skips the plant so a step can assert the gate itself.
**2026-09-26 helpers**: `setClock(hm | null)` pins the page's hours and minutes through the test-only sessionStorage key
`e2e-clock` (never read by the app, never `liferpg-*`; absent → the real clock); the hook installs on the first call and
takes effect from the next document, and persists for the page's lifetime. `tickClock()` fires `focus` so a live page
re-reads the clock.
Selector and assertion arguments are Korean UI copy on purpose and must not be translated.
