# Product sense
<!-- src: CL-1 --><!-- src: CL-3 --><!-- src: PL --><!-- src: SPEC-1 -->

## One-line definition
Life Manager (인생 관리) is a tool for **setting goals (OKR) → proving execution with evidence → being judged coldly against market standards**. Main uses: job seeking, career moves, self-management. Local-only, mobile-web, single user.

## Why it exists
Self-improvement apps reward self-reported effort; the market does not. Life Manager only counts what can be evidenced (a certificate photo, a score report, an artifact, an activity log) and prices it the way hiring does: a qualification is worth its difficulty (D) times how much the target job actually values it (job-fit tier). Nothing else moves a number.

## Three principles
1. **Reality and objectivity** — no encouraging or optimistic copy. Progress is always shown next to elapsed time and a pace verdict (behind / on track / ahead); a completion that does not contribute to a goal is labelled "목표 기여 없음". ([Rule 13](design-docs/core-beliefs.md#rule-13))
2. **No completion without evidence** — every completion requires the evidence specific to that activity; there is no path where self-report alone raises a score. ([Rules 10, 16, 17](design-docs/core-beliefs.md#rule-10))
3. **Goal-first** — a task cannot exist without a goal; the goal is the frame, and the task-creation screen is scoped to the goal's context (KRs, related kinds). ([Rules 18, 19](design-docs/core-beliefs.md#rule-18))

## Core loop
Create a goal (OKR) → register milestones and daily tasks from its KRs (KR–task bridge) → complete with evidence → grade promotion moves the role model's requirement-gap facts → keep the streak daily.

## Structure
```
Area (life area, grade 0–9, optional job directions dir)   e.g. 직업·커리어 [전기·기계]
 └ Goal (OKR: title · deadline · 1–4 key results)          e.g. 하네스 설계 엔지니어 취업 (D-150)
     ├ KR cert   → 전기기사 취득          ← one click creates the certification milestone
     ├ KR count  → CATIA·도면 연습 30회   ← prefills daily tasks
     ├ KR exam   → TOEIC 800              ← one click creates the exam milestone
     └ KR metric → 체중 73kg              ← updated by check-in and fitness records
         └ Tasks (one-day tasks + milestones)
```
Grades 0–9 per area: 지망생·견습·초심자·실무자·숙련자·전문가·리더·마스터·거장·정점. Achievement letters A (amber) B (violet) C (sky) D (emerald) E (zinc).

## Target users
People preparing for a job, a career change, or a certification who want a ledger that will not flatter them: engineering graduates targeting a specific role (the reference scenario is a wiring-harness design engineer — see [product-specs/scenario-harness-engineer.md](product-specs/scenario-harness-engineer.md)), working professionals adding qualifications, and anyone tracking body/finance/influence metrics by evidence rather than mood.

## Screens
Home (one quantitative CV — identity, education/career/certification/exam/portfolio/achievement records, area grades that open the promotion gate — plus, once the role model has stages, a one-row stage line under it (`단계 k/n {name} · 조건 c/m`, no percentage since the [Rule 14](design-docs/core-beliefs.md#rule-14) amendment of 2026-09-18); no Growth tab any more, and no date-scoped fact of any kind, decided 2026-09-15) / Goals (OKR cards · KR check-in · progress and pace, the only screen that shows either) / Tasks (one time-ordered list of tasks, schedule occurrences and business facts · catalog · reopens the daily briefing) / Work (`업무`, added 2026-09-17 — dated work items typed by hand or proposed through the assistant bridge and confirmed per item; a record, never a task) / Schedule (appointments and deadlines, list and calendar views) / Meetings (`미팅`, added 2026-09-16 — project-grouped, hand-written meeting minutes with a dated progress log since 2026-09-17) / Business (contracts, unit prices, portfolio). Onboarding in six steps (name, exact birth date, education and career records replace vague chip picks); 30 modals (`docs/design-docs/information-architecture.md`), including the CV's settings sheet and achievement wall; two full-screen overlays (RANK UP / ACHIEVEMENT); one toast.

## Non-goals (what we do not build)
- In-app AI: generation, judgement, scoring (user decision 2026-08-29). The only AI touchpoint is the copy/paste assistant bridge approved 2026-09-09 ([Rule 7](design-docs/core-beliefs.md#rule-7)): no key, no network, proposals only.
- Game mechanics: XP, levels, gold, random rewards, story, dating-sim elements ([Rule 7](design-docs/core-beliefs.md#rule-7)).
- Social features, rankings, sharing.
- Encouraging copy, streak guilt, notifications that nag. The app itself sends no push of its own — there is no
  browser API that schedules a local alarm while it is closed. Since 2026-09-25, by the user's own decision
  (reversing the two earlier records above), the app's own repository sends a **contentless** wake-up push twice
  a day: it carries nothing the app knows, shows only the on-device `확인 필요` facts the page already rendered,
  and asks for no more than the push subscription the user copies into a repository secret by hand
  ([Rule 7](design-docs/core-beliefs.md#rule-7) amendment, [SECURITY.md](SECURITY.md#the-daily-push-2026-09-25)).
  A separate reminder path stays the calendar file the user exports (`캘린더로 내보내기`,
  [product-specs/schedule.md](product-specs/schedule.md)): its alarms are raised by the phone's own calendar, at
  times the user chose in the export sheet, stating facts only (a title and a date) — never a guilt line about a
  streak or a miss.
- Automatically estimated scores — every number comes from evidence, a formula, or a check-in.
- Cloud sync or accounts: state lives in the browser's `localStorage` under `liferpg-*` keys.

## Language
UI copy is Korean (해요체). Qualification and exam names are Korean as issued. Everything else in the repo is English.
