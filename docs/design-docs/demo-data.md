# Demo data (`demoState`)
<!-- src: SPEC-7 -->

`demoState()` builds a complete, plausible save so the app can be opened without onboarding — it is what the demo build and the E2E harness enter. It reproduces the reference scenario in [../product-specs/scenario-harness-engineer.md](../product-specs/scenario-harness-engineer.md) one to one. Every date is relative (`shiftDay(today, ±n)`), so the data never goes stale, and the object is built by overwriting fields on `freshState([p1…p4])`.

## Areas

| Area | grade | `dir` | achievements |
|---|---|---|---|
| `사업` | 2 | — | `스마트스토어 월 수익 30만 달성` (today − 12, grade 2) |
| `직업·커리어` | 3 | `["전기·기계"]` | `초기 산정 — 기계·전자 전공, 하네스 설계 지망` (today − 30, grade 3) |
| `기본지식` | 2 | `["IT·개발", "재테크·금융"]` | `보유 자격: 컴퓨터활용능력 2급` (today − 30, grade 2) |
| `건강` | 1 | — | none |

`기본지식` carries two 방향 (directions), which `normDirs` maps to the jobs `개발` and `금융`. Registering a certification there takes the intersection of both, so most qualifications land at tier C and pay nothing ([Rule 15](core-beliefs.md#rule-15)) — the demo therefore registers 전기기사 under `직업·커리어`, whose direction is `전기·기계`.

## Profile
`{ name: "데모 사용자", nick: "하네스 지망생", birth: today − 9855 days (≈ 만 27세), gender: "남성", status: "취업 준비", edus: [{ school: "데모대학교", major: "기계공학", field: "공학", degree: "ba", status: "grad", from: "2017-03", to: "2023-02" }], careers: [{ company: "데모전장", role: "설계 지원", emp: "intern", from: month − 14, to: month − 8 }], edu: "ba", directions: ["IT·개발", "재테크·금융"], look: { skin: 0, hair: 0, hairColor: 0, outfit: 1, face: 0 }, startDate: today − 30 }`. No `email` / `phone` — both are optional and the demo ships no contact-shaped data at all ([SECURITY.md](../SECURITY.md)). No `roleModel` field — the role model lives in `state.role`.

`edu: "ba"` is carried over from the pre-v21 shape, fixing the invalid `"univ4"` key it used to hold — never a real `EDU_OPTS` key ([TD-28](../exec-plans/tech-debt-tracker.md), resolved 2026-09-13). There is still no `career`, `lead`, `biz`, `output`, `certs` or `examsOwned` key, exactly as before v21: the demo's area grades are authored directly on `p1`–`p4` below, never run through `computeGrades`, so a key that computation would consume is simply absent rather than faked. The legacy `age` and `majorField` fields are dropped outright (not carried as dead weight) because a v21 onboarding never writes either.

No `profile.certs` and no done `isCert` task means the home CV's `자격` row (`heldCertsOf(state)`, [home.md](../product-specs/home.md)) reads `자격 0건` on this save — a true fact about it, deliberately left that way: adding a declared name to `profile.certs` would need a matching `certBest` prefill for a stage-group certification to stay honest ([Rule 3](core-beliefs.md#rule-3)), and the tasks table below already exercises the earned half of `heldCertsOf` through 전기기사 (once it completes).

## Goals

| Goal | area | deadline | createdAt | note | KRs |
|---|---|---|---|---|---|
| `하네스 설계 엔지니어 취업` | 직업·커리어 | today + 150 | today − 14 | `자동차 부품사 설계직 — 전기기사 + 툴 숙련 + 어학 컷` | `cert` `전기기사 취득` (`certName: "전기기사"`) · `count` `CATIA·도면 연습` need 30 |
| `서류 어학 컷 넘기기` | 기본지식 | today + 90 | today − 7 | `부품사 서류 기준 토익 800` | `exam` `TOEIC 800 달성` (`toeic`, band `{ 800, d 60, p 720, conf B }`) · `count` `영어 스터디 참석` need 12 |
| `체력 기반 만들기` | 건강 | today + 60 | today − 10 | (empty) | `count` `운동 세션` need 20 · `metric` `체중` start 78 → target 73, current 77.2 kg |

The three goals cover all four KR types, a deadline in the near and far future, and both an ahead-of-pace and a behind-pace reading.

## Tasks

| Task | area / goal | diff | pts | type | doneDates | flags |
|---|---|---|---|---|---|---|
| `전기기사 취득` | 직업·커리어 / 하네스 | B | 900 | once | — | `isCert`, `certD: 67`, `due` = the goal deadline, created today − 14 |
| `이력서 초안 작성` | 직업·커리어 / 하네스 | D | — | once | — | `due: today − 1`, so the agenda and the briefing both open with an overdue row; no `kind` — since 2026-09-11 a normal task without a kind can no longer be created through the UI (the count-KR bridge is the only kind-less path), so this row survives only as seeded legacy data |
| `CATIA·도면 연습 1시간` | 직업·커리어 / 하네스 | D | — | daily | today − 2, today − 1 | created today − 14 |
| `영어 스터디 참석` | 기본지식 / 어학 | D | — | daily | today − 5, − 3, − 1 | created today − 7 |
| `TOEIC L&R 800 달성` | 기본지식 / 어학 | B | 720 | once | — | `isExam`, `famId: "toeic"`, band `{ 800, 60, 720, B }`, created today − 7 |
| `아침 운동 30분` | 건강 / 체력 | E | — | daily | today − 1 | `kind: "fit"`, created today − 10 |

Every task carries a `goalId` ([Rule 18](core-beliefs.md#rule-18)), so the demo also exercises the goal-progress deltas: completing the CATIA task moves 하네스 설계 엔지니어 취업, completing the exercise task moves 체력 기반 만들기.

## Events

| Event | kind | date | time | other |
|---|---|---|---|---|
| `부품사 1차 면접` | `약속` | today + 3 | 14:00 | `place: "판교 본사"`, `note: "도면 출력본 지참"`, created today − 2 |
| `전기기사 실기 원서 접수 마감` | `마감` | today + 9 | — | `note: "접수 후 수험표 확인"`, created today − 3 |
| `영어 스터디 모임` | `약속` | today + 1 | 20:00 | `place: "온라인"`, `repeat: { freq: "weekly" }`, created today − 7 |
| `○○물산 주간 점검` | `약속` | today + 1 | 11:00 | `place: "온라인"`, `projectId: mp1.id` (schema v26); two `checks` (schema v27) — one `manual`, one `ai` with a folded basis; created today − 2 |

The first three cover both kinds, a timed and an untimed row, and a repeat; the fourth (schema v26) names a
meeting project, so the `업무` tab's `MeetingPrepCard` has a matched row for tomorrow, and (schema v27) carries
the demo's two pre-meeting checks (`초과분 시간 단가표 회신 여부 확인`, `source: "manual"`; `월 리포트 양식
확정본 지참 — 유지보수 범위 협의 결정 사항`, `source: "ai"`), so the card reads `확인할 것 2/2` and none of
them is checked off. None of them carries a `goalId`, points or a flag: an event is a record, not a 실행 (task)
([../product-specs/schedule.md](../product-specs/schedule.md)).
The weekly appointment is what the `이후` group collapses — expanded it would produce twelve rows over the 90-day
horizon, so the demo tab shows four rows in total (`내일` 1, `이후` 3) instead of fifteen.

The same four events are what the `달력` view needs, so the demo needed no new event beyond the v26 addition above: the weekly
appointment marks four or five cells of the current month in cyan and the deadline one in rose, which is both
dot colours on one grid. `ui.scheduleView` comes from `freshState`, so the demo opens the tab on `목록`; the
manifest screenshot `public/screenshots/calendar.png` is this save with `달력` clicked
(`tools/harness/gen-screenshots.js`).

The same save, unchanged, already exercises every source the calendar export reads
(`캘린더로 내보내기`, [../design-docs/calendar-export.md](../design-docs/calendar-export.md)): the timed
appointment and the untimed deadline each become their own `VEVENT`, the weekly repeat carries an `RRULE`, the
three daily tasks feed the one digest entry, and the overdue once task (`이력서 초안 작성`, `due` = today − 1) is
exactly what the sheet's skipped line reports as `기한이 지난 실행 1건`. Of the three goal deadlines, only
체력 기반 만들기 (today + 60) falls inside the sheet's default `90일` window (`end = today + 89`) — 서류 어학 컷
넘기기 (today + 90) sits one day past it, and 하네스 설계 엔지니어 취업 (today + 150) further still; switching
the sheet to `1년` brings in all three. No demo change was needed for any of this.

## Documents (schema v27)

`s.documents` carries two records, prepended right after `s.meetings` is built (so the project ids exist):
`요구사항 정의서 v1` on `△△테크 문서 검색 AI` (with a `source`, dated yesterday, a multi-line summary covering
search scope, permissions, response format and open questions) and `◇◇스튜디오 예약 페이지 현황 메모` with no
project (dated today, no `source`). The `미팅` tab's counts line reads `프로젝트 2개 · 회의록 4건 · 문서 2건`.
See [../product-specs/documents.md](../product-specs/documents.md).

## Business

Three rates, two portfolio entries (no stored image, so `대표 이미지 없음` shows), and four deals, chosen so every
briefing and header line the tab can print actually renders once ([business.md](../product-specs/business.md)):

| Rate | unit | price | cost |
|---|---|---|---|
| `웹 앱 개발 (월)` | month | 3,000,000 | 800,000 |
| `AI 도입 컨설팅 (일)` | day | 400,000 | 60,000 |
| `랜딩 페이지 제작 (프로젝트)` | project | 1,200,000 | — (no cost, so its row prints `원가 미입력 — 마진은 계산하지 않아요`) |

| Deal | client | status | monthly | cost | months | startMonth | paidMonths |
|---|---|---|---|---|---|---|---|
| `재고 관리 자동화 도구` | ○○물산 | won | 1,200,000 | 300,000 | 3 | month − 4 | month − 4, month − 3 |
| `사내 문서 검색 AI 구축` | △△테크 | won | 3,000,000 | 800,000 | 4 | month + 1 | (none) |
| `리드 수집 크롤러` | □□랩스 | quote | 1,500,000 | — | 2 | — | — |
| `예약 페이지 개편` | ◇◇스튜디오 | lead | — | — | — | — | — |

Folio: `사내 문서 검색 AI 프로토타입` and `스마트스토어 주문 자동 집계`, each with a `period`, a `stack` and one or
two `links`; neither carries a stored image.

These four numbers hold regardless of which day the demo is generated on, because every deal date is `month ±
n`, never an absolute one:
- `이번 달 계약 0원` — the ○○물산 contract already ended (`month − 4` + 3 months = `month − 2`) and the △△테크
  contract has not started (`month + 1`), so no `won` deal bills the current month.
- `남은 계약 1,200만원` — the still-unbilled remainder of the △△테크 contract (3,000,000 × 4 months).
- `견적 대기 300만원` — the □□랩스 quote total (1,500,000 × 2).
- `입금 미확인 1건` — the ○○물산 contract's third billed month (`month − 2`) was deliberately left out of
  `paidMonths`, so the severity-3 briefing line, the rose unpaid count on the `실행` header's business button
  ([tasks.md](../product-specs/tasks.md)), and the packet's `미수` line all render.

The □□랩스 quote was created 9 days before `today`, one day past `QUOTE_STALE_DAYS` (7), so the briefing's
stale-quote line fires as well; with the unpaid line, that is two `biz` alerts, well under the `CAP − 1` the
section reserves before its closing summary line.

## Tracks and a day-job project (schema v28)

Every existing project, document, deal, memo and work item is stamped `track: "biz"`; the three schedule events
stay `track: "personal"`; `○○물산 주간 점검` is `track: "biz"`. One synthetic day-job project is added, `mpJob`,
named `데이터 프로파일링 — 데모기관` (a synthetic institution, no real name), `track: "work"`, created 15 days
back, prepended so the order reads `[mpJob, mp2, mp1]` and the counts line becomes `프로젝트 3개 · 회의록 5건 ·
문서 2건`. It carries one meeting, `주간 품질 점검` (2 days back, attendee `담당자 C`, one follow-up `결측 컬럼
목록 정리` due tomorrow, mirrored to a `track: "work"` work item), one manual `track: "work"` work item today
(`프로필 리포트 초안`), and one `track: "work"` event today (`품질 회의`, `appt`, `15:00`, linked to `mpJob`).
The demo's own-day counts line moves to `남음 4건 · 이월 0건 · 완료 1건 · AI 제안 1건`, with the work tab's heads
reading `직장 2건` and `사업 3건`; the briefing's prep line and the reader's `오늘 업무`/`오늘·내일 회의 준비`
sections gain the matching track heads. See [../product-specs/meetings.md](../product-specs/meetings.md#tracks-and-a-day-job-project-v28).

## Roadmap, time log, payments, leads, notices and role stages (schema v28)

`s.milestones = seedMilestones(today)` — the nine `ROADMAP_SEED` rows — then the first is stamped `status:
"done"` (`doneAt` yesterday) and the second `status: "active"` with `dealIds` naming the `△△테크` deal and
`workIds` naming the open manual business work item; the roadmap view reads `예정 7 · 진행 중 1 · 완료 1`.
`△△테크` gains one unpaid `deposit` payment line due in 5 days (₩3,000,000); `○○물산` gains one `final` line
due 20 days back, paid 18 days back (₩600,000) — so the header's third line reads `일시금 미확인 1건 · 이번 달
일시금 입금 {0원 또는 60만원}`, depending on whether the demo is opened on or after the 19th of the month (the
paid stamp can fall in the current or the prior month). The done AI-proposed work item gains `minutes: 180`;
`s.timeLog` holds three entries dated today — business 180 minutes with that item's `workId`, business 90
minutes with no `workId`, day-job 60 minutes — so the work tab's week line reads `이번 주 사업 4.5h/20h · 남은
날 {d}`. Two leads: `□□병원` at `접촉` (contact 4 days back, next action `시연 일정 제안` due 2 days back,
created 6 days back) and `◎◎의료원` at `잠재` (since yesterday) — `리드 2건 · 다음 액션 기한 지남 1건`. One
notice: `데모 AI 바우처 공고` by `데모진흥원` (posted 8 days back, deadline in 10 days, status `작성`, linked to
the `요구사항 정의서 v1` document) — `공고 1건 · 마감 14일 이내 1건`. `s.role.stages = seedStages()` (the nine
`ROLE_STAGE_SEED` stages); the stage figures depend on the save's own facts (below). See
[../product-specs/business.md](../product-specs/business.md#demo-content-v28).

## Remaining state
- `act`: `{ streak: 4, lastActive: today − 1, shieldMonth: monthStr(), shieldsLeft: 2, briefingSeen: null, lastReview: today − 7 }` — a live streak that continues on the first completion instead of breaking; `briefingSeen: null` and an overdue task together mean the demo briefing opens on first load; `lastReview` at last week's Monday leaves this week's review outstanding. There is no `metrics` field and no `lastCheckin` stamp — both were removed entirely by schema v19 (2026-09-11); what they claimed to measure lives in a goal's metric KR instead.
- `exams`: `best.toeic = { label: "700", d: 49, p: 480, ver: POINT_POLICY_VERSION, date: today − 60 }`, `dim.toeic = 1`, empty `spec`. So the TOEIC 800 milestone pays the difference only — 720 − 480 = 240 P at multiplier 1 — which is exactly the same-family upgrade rule ([Rule 2](core-beliefs.md#rule-2)) on screen.
- `certBest`: empty, so 전기기사 (no stage group) pays its full `certP(67) = 900` before job weighting.
- `journal`: one entry dated yesterday with an `ai` reply, so the journal list and the stored-reply block are both visible.
- `reviews`: one entry for last week (`weekOf` = that Monday), which leaves this week's review outstanding — and, since schema v28, means `ReviewModal`'s `AI에게 회고 묻기 ›` button opens **disabled** on the demo until the user saves this week's own review, exactly as the button's rule states (the packet reads the stored review, never a draft).
- `room.trophies`: one `{ kind: "rank", label: "직업·커리어 실무자", date: today − 20 }`, so the achievement wall is not empty on first open.
- `role`: `{ name: "완성차 1차사 하네스 설계 책임", targets: { 직업·커리어: 6, 기본지식: 4 }, stages: seedStages() }` (schema v28) — two targeted areas, which makes `roleAreas` computable and the requirement lines on the `롤모델` screen meaningful; the nine seeded stages read `단계 1/9 · 조건 3/14 · 전환 조건 미충족 (0/1)` — met: stage 1's `deals_active` (the upcoming `△△테크` contract), stage 3's `deals_won` ≥ 2 (two `won` deals), stage 4's `folio_match` `AI` (the document-search prototype); stage 1's `payment_paid` `deposit` is `0/1` (no paid deposit exists), so stage 1 stays current. `roleAreas`'s items are untouched by any of this ([Rule 14](core-beliefs.md#rule-14)) — the demo's role's target areas (`직업·커리어`, `기본지식`) are unchanged, so `RoleGradeSection` (the `롤모델` screen's collapsed `영역 등급`, `RoleAdviceModal`'s body until 2026-09-18) shows no `사업` gap block on this save. On home, one row under the CV reads `단계 1/9 계약 기반 개발자 · 조건 3/14 ›` — no percentage since 2026-09-18's third role-model change of the day, the [Rule 14](core-beliefs.md#rule-14) amendment (this line used to read `단계 1/9 계약 기반 개발자 · 진행 50%` with a bar and a verdict-probability caption). On the `롤모델` screen itself (2026-09-18, second change of the day): the current node reads `1단계 계약 기반 개발자` with its unmet condition's button `계약 목록 ›` (`payment_paid`'s landing, no bar since the third role-model change); stage 1's linked milestone is already done and links no work item, so `이 단계의 업무` reads its empty line, `연결된 업무 없음 — 로드맵에서 마일스톤에 업무를 연결해요` ([TD-86](../exec-plans/tech-debt-tracker.md), not fixed on the shipped demo — the E2E plants a stage-2 milestone with a linked work item on the main save instead, since re-linking the demo's own milestones would move the reader's and roadmap's `업무 0/1` lines `flow.js` asserts).
  **2026-09-18 additions (no schema bump — three more optional `role` fields):** `story` — a two-sentence `원하는 모습` about becoming the CEO of a 20-person medical-AI company by 2029, written to be sent verbatim in the fifth bridge packet; `seenStageK: 1`, matching the current derived stage so no completion overlay fires on demo entry; `verdicts` (newest first) — two AI-stated, unverified verdicts a month apart, dated today and `shiftDay(today, -29)` (relative, not the literal date the situation memo names — [TD-75](../exec-plans/tech-debt-tracker.md) is the precedent for why an absolute demo date would rot), both `stageK: 1` / `stageN: 9`, `source: "ai"`, **neither carrying a `probability` field since 2026-09-18's third role-model change of the day** (the two demo verdicts shipped that morning with `probability: 30`/`probability: 20`; the field was deleted from `demoState` the same day, not merely left unread). Stage 1's `deals_active` is met and `payment_paid 'deposit'` is unmet; home's row reads `단계 1/9 계약 기반 개발자 · 조건 3/14`, one line, no bar, no caption; the screen's delta line (behind `판정 기록 2건 ›`) reads `단계 1 → 1 ({shiftDay(today, -29)} → {today})`; the reader's tenth section reads `롤모델 판정 · 마지막 {today} · 0일 지남 · 단계 1/9`. The demo role verdict packet measures **2,408 chars** (2,434 before the third role-model change — the head's rule 1, rule 5 and JSON-template lines and the `## 지난 판정` line all shrank). Mechanics: [metrics-and-role-model.md](metrics-and-role-model.md#the-story-the-verdict-and-stage-progress-2026-09-18).
- `meetings` (schema v25; `followUps` schema v26; a project-less memo and `transcript`, 2026-09-17, no schema change; a training record, `kind: "training"`, 2026-09-22, no schema change, reference only since the same day): the day-job project `mpJob` carries one training record, `데이터 품질 지표 교육` (attendees `강사: 데모기관 품질팀`, dated 4 days back — older than `mpJob`'s meeting-kind record `주간 품질 점검` (2 days back), so the meeting stays `mpJob`'s `lastMeetingOf` and the meeting-prep card's `마지막 회의`), moving the demo's meeting count from 5 to **6** (`프로젝트 3개 · 회의록 6건 · 문서 2건`). It carries no follow-up, task link or progress entry (`followUps: []`, `taskIds: []`, `progress: []`) and its `기억할 점` (`actions`, renamed the same day from `적용할 것`) reads `완전성은 결측률, 유효성은 코드값 위반율로 측정해요` — reworded from a prior draft that read as a to-do, so the demo's own content never contradicts the reference-only rule; it never appears in the demo's `오늘 업무 만들기` work packet ([meetings.md](../product-specs/meetings.md#training-records-교육-2026-09-22--reference-only-same-day)). The newest demo meeting, `요구사항 1차 회의`, is flagged `aiHidden: true`, so its work-packet line states only its date and title; `유지보수 범위 협의` carries one `progress` entry (`월 10시간 한도를 반영한 유지보수 견적서 초안 작성`, dated two days before today) and three follow-up items — `긴급 대응 기준 초안 공유` (`mine: true`, due today + 2, mirrored to the demo work item below), `초과분 시간 단가표 회신` (`mine: false`, due today + 5), `월 리포트 양식 확정` (`mine: false`, `done: true`) — so its minutes row states `후속 2/3` and the demo shows the v25 and v26 fields at once; the third meeting carries empty `progress` and `followUps`, and `aiHidden: false`. Prepended (2026-09-17), one urgent memo, `긴급 메모 — ◇◇스튜디오 전화` (`projectId: null`, dated yesterday), with a 259-character Korean `transcript` (a reservation-page redesign call), one `progress` entry dated today (`개편 범위 정리 — …`) and one follow-up (`예약 페이지 개편 견적서 초안`, `mine: false`, due today + 3, so it mirrors no work item and the demo `업무` counts stay `남음 2건 · 이월 0건 · 완료 1건 · AI 제안 1건`); the `미팅` tab's counts line changes from `프로젝트 2개 · 회의록 3건` to `프로젝트 2개 · 회의록 4건`, and the new memo lists under `프로젝트 없음 · 긴급 메모`.
- `work` (schema v25; a third `source: "meeting"` item schema v26; a fourth, yesterday-dated done item schema v27): three items dated today — `○○물산 유지보수 견적서 송부` (manual, open, `note: "월 10시간 · 초과분 시간 단가"`, linked to the `○○물산 재고 관리 자동화` project), `전기기사 필기 기출 1회분 채점` (`source: "ai"`, `done: true`, linked to the `하네스 설계 엔지니어 취업` goal), and `긴급 대응 기준 초안 공유` (`source: "meeting"`, open, `link: { kind: "meeting", id: <유지보수 범위 협의>, followUpId: <fuA.id> }`) — so the demo `업무` tab shows one open manual row, one done AI-proposed row and one open `회의`-chip row, and its counts line reads `남음 2건 · 이월 0건 · 완료 1건 · AI 제안 1건`. Plus (schema v27) `○○물산 월 리포트 양식 회신`, dated **yesterday**, `done: true`, with a `result` (`양식 v2 확정본을 메일로 송부 — 다음 달부터 적용`), linked to the same project — it is not in today's view, so the counts line above is unchanged, but the daily reader's `오늘 업무` section states its `처리:` line ([TD-57](../exec-plans/tech-debt-tracker.md) still holds — there is still no carried row). See [../product-specs/daily-work.md](../product-specs/daily-work.md).

## Daily reader (schema v27)

Every section of `오늘 읽을 것` is non-empty on the demo save except `뒤처진 목표 페이스`, which lists both demo
goals (`체력 기반 만들기`, 5 points-percent behind; `하네스 설계 엔지니어 취업`, 6 points-percent behind) rather
than reading `없음`. `오늘·내일 회의 준비` states the tomorrow event with `확인할 것 2/2`, its last meeting's
decisions and `문서 없음` (the matched project, `○○물산 재고 관리 자동화`, carries no document of its own);
`오늘 업무` states the two open items and `어제 완료 · ○○물산 월 리포트 양식 회신` with its `처리:` line; the
follow-up section states the overdue `유지보수 범위 협의` item; the decisions section lists the two meetings
dated within the last 7 days; `{today−7} 이후 새로 들어온 것` lists meetings, both demo documents and progress
entries created in that window; `계약·입금 미확인` states the ○○물산 unpaid month and the closing totals line.
See [../product-specs/daily-reader.md](../product-specs/daily-reader.md).

## Derived values and known deviations
Progress computes to roughly 3 % (하네스), 46 % (어학) and 10 % (체력). The role model shows no percentage of any kind since 2026-09-18's third role-model change of the day (the [Rule 14](core-beliefs.md#rule-14) amendment) — the demo's requirement grades (`직업·커리어` 3/6, `기본지식` 2/4) are gap facts, not a proximity figure. Two deviations are deliberate and harmless:
- The milestone tasks are stored at `diff: "B"` while `scoreTier(900)` and `scoreTier(720)` both return `"A"`. Nothing on screen reads that field for a milestone.
- The task `TOEIC L&R 800 달성` and the KR `TOEIC 800 달성` have different titles. Exam matching runs on `famId` and band label, so the mismatch does not affect progress.

Changing the demo means changing the scenario document too: the two are checked against each other, and `npm run smoke` asserts the payouts the scenario quotes.
