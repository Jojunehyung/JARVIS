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
`{ nick: "하네스 지망생", gender: "남성", age: "20대 중반", status: "취업 준비", edu: "univ4", majorField: "공학", directions: ["IT·개발", "재테크·금융"], look: { skin: 0, hair: 0, hairColor: 0, outfit: 1, face: 0 }, startDate: today − 30 }`. No `roleModel` field — the role model lives in `state.role`.

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
| `전기기사 취득` | 직업·커리어 / 하네스 | B | 900 | once | — | `isCert`, `certD: 67`, created today − 14 |
| `CATIA·도면 연습 1시간` | 직업·커리어 / 하네스 | D | — | daily | today − 2, today − 1 | created today − 14 |
| `영어 스터디 참석` | 기본지식 / 어학 | D | — | daily | today − 5, − 3, − 1 | created today − 7 |
| `TOEIC L&R 800 달성` | 기본지식 / 어학 | B | 720 | once | — | `isExam`, `famId: "toeic"`, band `{ 800, 60, 720, B }`, created today − 7 |
| `아침 운동 30분` | 건강 / 체력 | E | — | daily | today − 1 | `kind: "fit"`, created today − 10 |

Every task carries a `goalId` ([Rule 18](core-beliefs.md#rule-18)), so the demo also exercises the goal-progress deltas: completing the CATIA task moves 하네스 설계 엔지니어 취업, completing the exercise task moves 체력 기반 만들기.

## Remaining state
- `act`: `{ streak: 4, lastActive: today − 1, shieldMonth: monthStr(), shieldsLeft: 2 }` — a live streak that continues on the first completion instead of breaking.
- `metrics`: `{ asset: 24, infl: 14, body: 20 }`, written directly rather than derived from the achievement history.
- `exams`: `best.toeic = { label: "700", d: 49, p: 480, ver: POINT_POLICY_VERSION, date: today − 60 }`, `dim.toeic = 1`, empty `spec`. So the TOEIC 800 milestone pays the difference only — 720 − 480 = 240 P at multiplier 1 — which is exactly the same-family upgrade rule ([Rule 2](core-beliefs.md#rule-2)) on screen.
- `certBest`: empty, so 전기기사 (no stage group) pays its full `certP(67) = 900` before job weighting.
- `room.trophies`: one `{ kind: "rank", label: "직업·커리어 실무자", date: today − 20 }`, so the achievement wall is not empty on first open.
- `role`: `{ name: "완성차 1차사 하네스 설계 책임", targets: { 직업·커리어: 6, 기본지식: 4 } }` — two targeted areas, which makes `roleGap` computable and the RANK UP proximity line meaningful.

## Derived values and known deviations
Progress computes to roughly 3 % (하네스), 46 % (어학) and 10 % (체력), with role-model proximity about 25 %. Two deviations are deliberate and harmless:
- The milestone tasks are stored at `diff: "B"` while `scoreTier(900)` and `scoreTier(720)` both return `"A"`. Nothing on screen reads that field for a milestone.
- The task `TOEIC L&R 800 달성` and the KR `TOEIC 800 달성` have different titles. Exam matching runs on `famId` and band label, so the mismatch does not affect progress.

Changing the demo means changing the scenario document too: the two are checked against each other, and `npm run smoke` asserts the payouts the scenario quotes.
