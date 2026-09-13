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

The three cover both kinds, a timed and an untimed row, and a repeat. None of them carries a `goalId`, points or
a flag: an event is a record, not a 실행 (task) ([../product-specs/schedule.md](../product-specs/schedule.md)).
The weekly appointment is what the `이후` group collapses — expanded it would produce twelve rows over the 90-day
horizon, so the demo tab shows four rows in total (`내일` 1, `이후` 3) instead of fifteen.

The same three events are what the `달력` view needs, so the demo needed no new event for it: the weekly
appointment marks four or five cells of the current month in cyan and the deadline one in rose, which is both
dot colours on one grid. `ui.scheduleView` comes from `freshState`, so the demo opens the tab on `목록`; the
manifest screenshot `public/screenshots/calendar.png` is this save with `달력` clicked
(`tools/harness/gen-screenshots.js`).

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
  `paidMonths`, so the severity-3 briefing line, the rose home-card count, and the packet's `미수` line all render.

The □□랩스 quote was created 9 days before `today`, one day past `QUOTE_STALE_DAYS` (7), so the briefing's
stale-quote line fires as well; with the unpaid line, that is two `biz` alerts, well under the `CAP − 1` the
section reserves before its closing summary line.

## Remaining state
- `act`: `{ streak: 4, lastActive: today − 1, shieldMonth: monthStr(), shieldsLeft: 2, briefingSeen: null, lastReview: today − 7 }` — a live streak that continues on the first completion instead of breaking; `briefingSeen: null` and an overdue task together mean the demo briefing opens on first load; `lastReview` at last week's Monday leaves this week's review outstanding. There is no `metrics` field and no `lastCheckin` stamp — both were removed entirely by schema v19 (2026-09-11); what they claimed to measure lives in a goal's metric KR instead.
- `exams`: `best.toeic = { label: "700", d: 49, p: 480, ver: POINT_POLICY_VERSION, date: today − 60 }`, `dim.toeic = 1`, empty `spec`. So the TOEIC 800 milestone pays the difference only — 720 − 480 = 240 P at multiplier 1 — which is exactly the same-family upgrade rule ([Rule 2](core-beliefs.md#rule-2)) on screen.
- `certBest`: empty, so 전기기사 (no stage group) pays its full `certP(67) = 900` before job weighting.
- `journal`: one entry dated yesterday with an `ai` reply, so the journal list and the stored-reply block are both visible.
- `reviews`: one entry for last week (`weekOf` = that Monday), which leaves this week's review outstanding.
- `room.trophies`: one `{ kind: "rank", label: "직업·커리어 실무자", date: today − 20 }`, so the achievement wall is not empty on first open.
- `role`: `{ name: "완성차 1차사 하네스 설계 책임", targets: { 직업·커리어: 6, 기본지식: 4 } }` — two targeted areas, which makes `roleGap` computable and the RANK UP proximity line meaningful.

## Derived values and known deviations
Progress computes to roughly 3 % (하네스), 46 % (어학) and 10 % (체력), with role-model proximity about 25 %. Two deviations are deliberate and harmless:
- The milestone tasks are stored at `diff: "B"` while `scoreTier(900)` and `scoreTier(720)` both return `"A"`. Nothing on screen reads that field for a milestone.
- The task `TOEIC L&R 800 달성` and the KR `TOEIC 800 달성` have different titles. Exam matching runs on `famId` and band label, so the mismatch does not affect progress.

Changing the demo means changing the scenario document too: the two are checked against each other, and `npm run smoke` asserts the payouts the scenario quotes.
