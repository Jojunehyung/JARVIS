# Unified to-do list in the `실행` tab

- Status: completed
- Date: 2026-09-13
- Needs approval: no — no `CERTS`/`EXAMS`/`WEIGHT_MATRIX`/`CERT_W_EXC` row, no `migrate` block, no `liferpg-*` key, no user data deleted. Everything added is derived at render ([Rule 9](../../design-docs/core-beliefs.md#rule-9)). One wording tension with [Rule 18](../../design-docs/core-beliefs.md#rule-18) is called out under "Rule reading" below; no rule text is edited by this plan.
- Agents: planner → implementer → cleanup → verifier → docs-syncer

## Goal

The user cannot tell `목표` and `실행` apart, because both tabs group by goal: `GoalsTab` renders goal → KRs → progress → pace, and `TaskTab` renders goal title + `goalProgress` % → that goal's rows → `＋ 이 목표에 실행`. The overlap is the goal title, the progress figure and the add button, and the cost is that `실행` cannot answer "what do I do today" — the only time-sorted list in the app is the home card's `오늘 할 일`, capped at five rows.

The user decided: **`실행` becomes one time-ordered list of everything actionable — tasks, schedule events and business items**; **`목표` stays numbers-only** (key results, progress, pace, create/edit/delete a goal — no task rows, no goal grouping); **the home card's `오늘 할 일` narrows to overdue plus today**, because `실행` now owns this week and later. Six tabs stay. Nothing about payouts, evidence gates, grades or the data tables changes; the list is a new view over state that is already there.

## Context read

Code (`src/LifeManager.jsx`, ~6,700 lines — line numbers move, grep the anchors):

| Symbol | Anchor | Why |
|---|---|---|
| `agendaOf` | `const agendaOf =` (~L2245) | open-task filter + date buckets; reused as the source of "open" |
| `occurrencesOf` / `eventsOn` / `upcomingEvents`, `EVENT_PAST_DAYS` (30), `EVENT_HORIZON_DAYS` (90), `EVENT_SOON_DAYS` (3) | `const occurrencesOf =` (~L2268) | occurrence expansion, reused verbatim |
| `bizSummary`, `dealEnd`, `dealBacklog`, `dealTotal`, `monthsBetween`, `wonText`, `DEAL_END_SOON`, `QUOTE_STALE_DAYS`, `DEAL_STATUS` | `const bizSummary =` (~L2191) | the one business roll-up every surface reads |
| `buildBriefing` business section | `const buildBriefing =` (~L2325), biz block ~L2385–2411 | the exact wording the new business rows mirror; `slice(0, 3)` becomes `BIZ_ALERT_MAX` |
| `TaskTab` + its `row(q)` closure | `function TaskTab` (~L4066) | rewritten; `row(q)` markup is kept and reused |
| `GoalsTab` | `function GoalsTab` (~L3375) | **verified: already numbers-only** — goal card, pace, KR rows, check-in, `＋ 실행 연결` / `실행 추가` / `등록 ›` / `달성 처리` / `목표 삭제`. It renders no task row. No change in this plan. |
| `HomeTab` `오늘 할 일` card | `function HomeTab` (~L3336–3369) | `agendaOf(state, today).all.slice(0, 5)` is replaced |
| `EventRow` | `function EventRow` (~L4943) | shared occurrence row; gains one optional prop |
| `ScheduleTab` groups | `function ScheduleTab` (~L5089) | group vocabulary and the `이후` repeat-collapse rule are copied from here |
| `DueChip`, `DiffBadge`, `CertBadge`, `SectionLabel`, `Chip`, `Bar`, `EmptyQuestSvg` | `function DueChip` (~L1304), `function SectionLabel` (~L1771) | atoms reused as-is |
| root wiring: `tryComplete`, `removeTask`, `toggleEventDone`, `skipOccurrence`, `setBizView`, `setTab`, `NAV` | `export default function LifeManager` (~L5806, tab render ~L6393) | prop changes only |

Docs: `AGENTS.md` §3–§7, `docs/PLANS.md`, `docs/FRONTEND.md`, `ARCHITECTURE.md` (file regions, glossary), `docs/product-specs/tasks.md`, `goals.md`, `home.md`, `schedule.md`, `business.md`, `docs/design-docs/information-architecture.md`, `docs/exec-plans/tech-debt-tracker.md` (TD-02, TD-32).

Rules touched: [1](../../design-docs/core-beliefs.md#rule-1), [9](../../design-docs/core-beliefs.md#rule-9), [10](../../design-docs/core-beliefs.md#rule-10), [13](../../design-docs/core-beliefs.md#rule-13), [16](../../design-docs/core-beliefs.md#rule-16), [17](../../design-docs/core-beliefs.md#rule-17), [18](../../design-docs/core-beliefs.md#rule-18), [19](../../design-docs/core-beliefs.md#rule-19). Untouched and must stay untouched: 2–6, 11, 12, 14, 15.

### Rule reading (decide once, here)

- **Rules 1 / 10 / 16 / 17.** An event row and a business row have **no completion checkbox, no lock, no evidence path and no payout**. An event keeps only its own `완료 표시` / `이번 회차 취소` / `수정` (the same `toggleEventDone` / `skipOccurrence` the `일정` tab calls, which pay nothing and move no goal). A business row is a link into the `사업` tab and completes nothing. `tryComplete` is passed **only** to task rows. This is the single acceptance criterion the reviewer must be able to check by reading the JSX.
- **Rule 18.** Its text says milestones are "shown under their goal in the task tab". After this change there is no per-goal section, but **every milestone row states its goal on the row itself** (`🎯 {goal.title}`, or `목표 기여 없음` when it has none), and the substance of the rule — the one-day-size exemption, the `Lock` control, evidence-only completion — is untouched. No rule text is edited. Record the reading in `decision-log.md`. If the user wants the rule's wording updated, that is a separate core-beliefs edit and needs their approval.
- **Rules 18 / 19.** Removing `＋ 이 목표에 실행` from `실행` leaves goal-scoped creation **only** in `목표` (`＋ 실행 연결`, the KR rows `실행 추가` / `채우기 ›` / `등록 ›`). This is a deliberate strengthening of Rule 19, not a side effect: after this change there is no task-creation entry point outside a goal.
- **Rule 9.** `todoOf` is pure, called in render, stores nothing. The `할 일` / `완료` view toggle is **component state** (`useState`), not `state.ui` — no schema change, no `migrate` block, no `v` bump. If the implementation appears to need a stored field, stop and report instead of adding one.
- **Rule 13.** Every row states facts and numbers; `목표 기여 없음` is shown, never softened; no number that a surface shows today is removed anywhere.

## Prompt

> Implement the unified to-do list in `실행` for Life Manager, exactly as specified below. Work in `src/LifeManager.jsx` and `tools/e2e/`. Read `docs/design-docs/core-beliefs.md` first; obey `docs/FRONTEND.md` (Tailwind v3 core utilities only, no arbitrary values, `font-mono` for numbers and system labels, lucide icons only, Korean UI copy in `해요체`, English identifiers and comments). Do not touch `CERTS`, `EXAMS`, `WEIGHT_MATRIX`, `CERT_W_EXC`, the `store` call sites, the `liferpg-*` keys, or any existing `migrate` block. There is **no schema change** in this task: if something seems to need a stored field, stop and report.
>
> ### Phase 1 — the merge engine and the `실행` tab
>
> **1.1 `BIZ_ALERT_MAX`.** In the Business region, beside `DEAL_END_SOON` (~L2110), add:
> ```js
> const BIZ_ALERT_MAX = 3; // business rows a surface names one by one, so unpaid months cannot bury the tasks
> ```
> and use it in `buildBriefing`'s business block in place of the literal `slice(0, 3)` on `biz.unpaid`. Behaviour is identical; the point is that the briefing and the to-do list provably name the same three months.
>
> **1.2 `todoOf(state, today)`** — new pure helper in the "Daily assistant" region, immediately after `upcomingEvents` (~L2313), before `lastDoneDate`. It is the single expansion the tab, the home card and any later surface read; computed at render, never stored ([Rule 9](../../design-docs/core-beliefs.md#rule-9)).
>
> Return shape:
> ```js
> // {
> //   groups: [{ key, label, rows }, …]   keys: overdue | today | tomorrow | week | later
> //   done:   [row, …]                    today's completions (tasks + ticked occurrences)
> //   counts: { overdue, today, week, open }
> // }
> // row = { key, kind: "task"|"event"|"biz", date, time, title, task?, ev?, done?, deal?, month?, text? }
> ```
> - `key` is the React key: `t:{task.id}` · `e:{ev.id}-{date}` · `b:unpaid:{deal.id}-{month}` · `b:end:{deal.id}`.
> - `date` is a `YYYY-MM-DD` string or `null`; `time` is `ev.time` or `""`.
> - Group labels, verbatim and in this order: `기한 지남` · `오늘` · `내일` · `이번 주` · `이후`. These are the words the app already uses (`DueChip` prints `기한 지남`; `ScheduleTab` groups `오늘` / `내일` / `이번 주` / `이후`). Do not invent new ones.
>
> **Bucketing — one rule for all three kinds**, with `tomorrow = shiftDay(today, 1)` and `weekEnd = shiftDay(mondayOf(today), 6)`:
> `date === null && task.type === "daily"` → `today` · `date === null` otherwise → `later` · `date < today` → `overdue` · `date === today` → `today` · `date === tomorrow` → `tomorrow` · `date <= weekEnd` → `week` · else → `later`.
>
> **Task rows.** Source is `agendaOf(state, today).all` — call `agendaOf`, do not re-implement its open filter, so "open" has exactly one definition. `date = q.due || null`, `title = q.title`.
>
> **Event rows.** Missed deadlines: `upcomingEvents(state, shiftDay(today, -EVENT_PAST_DAYS), EVENT_PAST_DAYS)` filtered to `o.ev.kind === "due"`. Ahead: `upcomingEvents(state, today, EVENT_HORIZON_DAYS)`, both kinds. Drop `o.done` from all five open groups (a ticked occurrence is not to-do; un-ticking stays reachable from `오늘 완료` and from the `일정` tab). In `later` only, collapse each event to its **earliest** occurrence in the window, exactly as `ScheduleTab` does — one weekly repeat would otherwise add 12 rows and a daily one 83 over the 90-day horizon. The near groups stay one row per occurrence.
>
> **Business rows — which facts enter, decided here, not by you:**
>
> | Fact | In? | Date used | Lands in | Row says |
> |---|---|---|---|---|
> | Unpaid billed month (`bizSummary().unpaid`, oldest first, `slice(0, BIZ_ALERT_MAX)`) | **yes** | last day of `u.month` — the month it closes, computed as `dstr(new Date(y, m + 1, 0, 12))` (the noon-anchored idiom `ScheduleCalendar` uses; never `toISOString`) | past months → `기한 지남`; the current month → `이번 주` or `이후`, whichever its closing date falls in | lead chip `{u.month}`, title `{deal.client} {deal.title}`, meta `입금 미확인 {wonText(u.amount)} · 목표 기여 없음` |
> | Contract ending inside `DEAL_END_SOON` (same filter as the briefing: `d.status === "won" && end && left >= 0 && left <= DEAL_END_SOON`, `left = monthsBetween(biz.month, end)`) | **yes**, uncapped (bounded by the 2-month window) | last day of `dealEnd(d)` | normally `이후` | lead chip `{end}`, title `{deal.client} {deal.title}`, meta `계약 종료 · 남은 계약 {wonText(dealBacklog(d, biz.month))} · 목표 기여 없음` |
> | Stale quote (`status === "quote"`, age > `QUOTE_STALE_DAYS`) | **no** | — | — | A stale quote has an age, not a date: there is no day on which the follow-up is due. Putting it in `오늘` would invent a deadline and putting it in `기한 지남` would claim a missed one — both would be a false number, which [Rule 13](../../design-docs/core-beliefs.md#rule-13) forbids as much as hiding one. It stays in the briefing (`견적 {n}일 경과`) and in `BizTab`'s `견적 대기` group, and the count is stated in the tab header line (1.4). |
> | Rates, portfolio, `lead` deals, the `thisMonth` / `collected` / `backlog` roll-ups | **no** | — | — | Undated, or a roll-up rather than an item. All are already stated by `BizTab`, the briefing and the home card; nothing is removed from any of them. |
>
> **Sorting inside a group.** Rows tie constantly (a daily task has no time at all), so the order is one deterministic key — mirror `eventsOn`'s `rank` idiom:
> ```js
> const KIND_RANK = { task: 0, event: 1, biz: 2 };
> const rowKey = (r) => `${r.date || "9999-99-99"}|${r.time || "99:99"}|${KIND_RANK[r.kind]}|${r.title}`;
> ```
> sorted with `localeCompare`. Read out: **date first; within a date, clock-timed rows in time order; then untimed rows as task → event → business; ties by title.** Undated rows sort last inside their group, so in `오늘` the dated items come first and the daily tasks last — the order `agendaOf` already produces and `flow5` asserts.
>
> **`done`.** Today's completions: tasks where `q.type === "daily" ? q.doneDates?.includes(today) : q.status === "done" && q.doneAt === today`, plus `eventsOn(state, today).filter((o) => o.done)`. Same comparator. Business rows are never "done".
>
> **`counts`.** `overdue` = rows in `기한 지남`; `today` = rows in `오늘`; `week` = rows in `오늘` + `내일` + `이번 주` (how much is left this week, the same semantics as `ScheduleTab`'s counts line); `open` = total across the five open groups.
>
> **1.3 `EventRow` gains one optional prop** `tail` (default `null`), rendered at the end of the meta line as `{tail && <span className="text-zinc-600"> · {tail}</span>}` — the same markup the task row uses for `목표 기여 없음`. `ScheduleTab` and `ScheduleCalendar` pass nothing, so the `일정` tab is byte-identical; the to-do list passes `tail="목표 기여 없음"`. Do not change anything else in `EventRow`.
>
> **1.4 `TaskTab` rewrite.** Keep the component name (`TaskTab`) and keep the existing `row(q)` closure markup: checkbox/`Lock` first, title, meta line, `DueChip`, badge, `X` last. Two edits to `row(q)` so every row states its goal:
> - done branch: `완료 · 🎯 {goal.title}` — or `완료 · 목표 기여 없음` when the goal does not resolve — followed by ` · 증거 보기` when `q.evidence` (unchanged link → `onViewEvidence(q)`).
> - `isCert` / `isExam` branches: prefix the existing text with `🎯 {goal.title} · ` (or `목표 기여 없음 · `). The generic branch already states `{area.name} · 🎯 {goal.title}` / `목표 기여 없음` — leave it as it is.
>
> New props: `TaskTab({ state, today, onComplete, onRemove, onCatalog, onGoGoals, onViewEvidence, onEditEvent, onToggleEventDone, onSkipEvent, onGoBiz })`. `onAddFor` is **removed**.
>
> Header section (one card, same shell as today's):
> - `SectionLabel tone="text-zinc-400"` → `실행 — 시간순 할 일`; sub-line `text-xs text-zinc-600` → `실행·일정·사업을 시간순으로 모아서 보여줘요. 새 실행은 목표 탭에서 만들어요.`; the `도감` button stays on the right, unchanged (it is the only general entry to `CatalogModal`).
> - counts line, `text-xs font-mono text-zinc-400`: `기한 지남 {counts.overdue} · 오늘 {counts.today} · 이번 주 {counts.week}`.
> - business line — a button → `onGoBiz()`, rendered only when `biz.counts.unpaid > 0 || biz.counts.quote > 0`, `text-xs font-mono text-zinc-400`, the unpaid count in `text-rose-400` when > 0: `사업 입금 미확인 {n}건 · 견적 대기 {n}건 ›`. This is what keeps the `BIZ_ALERT_MAX` cap and the excluded quotes honest — the full counts are always on screen.
> - view chips (`Chip`, component state `const [view, setView] = useState("todo")`): `할 일` · `완료`.
>
> `할 일` view: one `<section>` per non-empty group, `SectionLabel` = the group label with tone `기한 지남` → `text-rose-400`, `오늘` → `text-amber-300`, `내일` / `이번 주` → `text-zinc-400`, `이후` → `text-zinc-500`, `오늘 완료` → `text-emerald-400`; rows inside `space-y-1.5`. `오늘 완료` (from `todoOf().done`) is the last section. Row rendering by kind:
> - `task` → the existing `row(q)`; the only kind with a completion control (`Check` box, or `Lock` for an undone milestone) and the only one wired to `onComplete` → `tryComplete`.
> - `event` → `<EventRow … tail="목표 기여 없음" onToggleDone={onToggleEventDone} onSkip={onSkipEvent} onEdit={onEditEvent} />`; it keeps its lead chip (D-day or `{time}` / `시간 미정`), its right chip `약속` / `마감` and its own action row. No checkbox, no evidence, no payout.
> - `biz` → a new small component `BizTodoRow({ row, onOpen })`: a full-width `button` (`w-full text-left … active:opacity-70`) with a `font-mono` lead chip carrying the month, the title, the meta line, and the right chip `사업` (`border-zinc-700 text-zinc-300`). **No checkbox and no action row** — tapping the row is its only behaviour.
>
> The three are distinguishable without a legend: a task begins with a square checkbox or a lock and ends with a difficulty/grade badge; an event begins with a mono time/D-day chip, ends with `약속` or `마감` and carries three buttons under it; a business row begins with a mono month chip, ends with `사업` and has no control at all.
>
> Empty states:
> - `counts.open === 0` and `(state.goals || []).filter((g) => g.status === "active").length === 0` → the existing card, unchanged: `EmptyQuestSvg` + `실행은 목표의 실행 단위입니다 — 목표가 먼저예요.` + `목표 먼저 세우기 ›` → `onGoGoals`.
> - `counts.open === 0` with active goals → `EmptyQuestSvg` + `예정된 항목이 없어요 — 실행·일정·사업 모두 0건이에요.`
> - every open row is `kind === "biz"` → a line under the last group, `text-xs text-zinc-500`: `완료할 실행·일정이 없어요 — 남은 항목은 사업 기록이에요.`
>
> `완료` view: completed tasks only (events belong to the `일정` tab; today's ticked ones are already in `오늘 완료`). `state.tasks` filtered to `q.type === "daily" ? (q.doneDates || []).length : q.status === "done"`, sorted by `lastDoneDate(q)` descending then title, `slice(0, 40)`, rendered with the same `row(q)`. Count line `text-xs font-mono text-zinc-400`: `완료 {total}건 · 최근 {shown}건`. Empty: `완료한 항목이 없어요.` This view is what keeps [Rule 16](../../design-docs/core-beliefs.md#rule-16)'s `증거 보기` → `EvidenceViewModal` reachable for anything completed before today — today it is reachable only because `TaskTab` lists every task of an active goal forever.
>
> Deleted from `TaskTab`, with nothing left behind: the per-goal `<section>` loop, `goalProgress` in the header of each section (the figure lives in `목표` and on the home card's `오늘의 초점`; the function itself stays in use by `completeTask` / `checkinKR` / `goalStatus`), the divider `마일스톤 — 자격·시험·학습 (하루분량 예외 · 증거로만 완료)`, `연결된 실행이 아직 없습니다.`, `＋ 이 목표에 실행`, and the whole `미분류 — 목표 연결 전 항목` section including `완료·삭제는 가능하지만, 새 실행은 목표에서만 만들 수 있어요.` Orphan tasks are not lost: they appear as ordinary rows carrying `목표 기여 없음`. Two consequences to state in the report: TD-02 is resolved (the list is task-first, so tasks of a **done** goal now appear again), and the local `orphan` / `isMile` helpers are only kept if still referenced.
>
> **1.5 Root wiring** (~L6408):
> ```jsx
> {tab === "tasks" && (
>   <TaskTab state={state} today={today}
>     onComplete={tryComplete} onRemove={removeTask}
>     onCatalog={() => setModal({ type: "catalog" })}
>     onGoGoals={() => setTab("goals")}
>     onViewEvidence={(q) => setModal({ type: "evidenceView", task: q })}
>     onEditEvent={(ev) => setModal({ type: "event", event: ev })}
>     onToggleEventDone={toggleEventDone} onSkipEvent={skipOccurrence}
>     onGoBiz={() => { setBizView("deals"); setTab("biz"); }} />
> )}
> ```
> `GoalsTab` keeps `onAddQuestFor` — do not touch `GoalsTab`, `ScheduleTab`, `BizTab`, `AddTaskModal` or any handler body.
>
> **1.6 E2E for Phase 1** (`tools/e2e/`, step names in English, selector arguments in Korean UI copy):
> - `flow.js` "go to tasks tab": replace `expectText("실행")` with `expectText("실행 — 시간순 할 일")`.
> - `flow4.js` "delete an active goal — open task removed, completed task kept": the tail is now `await clickTab("실행"); await clickExact("완료"); await expectText("남길 실행"); await expectText("목표 기여 없음");` (the planted task has `doneAt: "2026-01-02"`, so it is in the archive view, not in `오늘 완료`). Remove `expectText("미분류")`.
> - `flow7.js`, **new step** after "briefing states the schedule between the tasks and the streak" (`서류 제출 마감`, a `due` event dated today, exists by then): `the tasks tab lists today's deadline and completes it without a task path` — switch to `실행`, assert the `오늘` section holds `서류 제출 마감` with `마감` and `목표 기여 없음`, assert that row has **no** checkbox input (only `완료 표시` / `수정`), press `완료 표시`, assert the row moved into `오늘 완료`, press `완료 취소` and assert it is back in `오늘` (the later packet assertions depend on it being open).
> - `flow8.js`, **new step** after "the home card line states the month and the unpaid count and opens the tab": `the tasks tab lists the unpaid month as a business row that completes nothing` — switch to `실행`, assert the header line `사업 입금 미확인 2건`, assert a row with `재고 관리 자동화 도구` + `입금 미확인` + `사업` + `목표 기여 없음` and **no** completion control, tap it and assert the `사업` tab opened on `계약`.
> - Verify, do not assume, that these still pass unchanged: `flow2.js` "submit with certificate photo" → `assertDone("전기기사")` and "evidence viewer" → the exact-text `증거 보기` button (both rely on today's completion being in `오늘 완료`); `run.js`'s `submitPhotoEvidence` / `logActivity` helpers (same reason); `flow3.js` "delete task" (walks up from `설계 실습 1시간` to the first ancestor with more than one button and clicks the last — the row markup is unchanged, but confirm it does not climb into a group section); `flow5.js` "once task with a due date" → `expectText("D-3")` (the row keeps its `DueChip`).
>
> **Phase 1 gate:** `npm run verify` — 0 failed steps, 0 console errors. Manual: 390 px wide, no horizontal scroll, header lines do not wrap mid-word, every group label and row legible.
>
> ### Phase 2 — the home card narrows to today
>
> In `HomeTab`, replace `const todayQuests = agendaOf(state, today).all;` with the `todoOf` selector, so the card and the tab can never disagree about what "today" means:
> ```js
> const td = todoOf(state, today);
> const byKey = (k) => td.groups.find((g) => g.key === k)?.rows || [];
> const todayQuests = [...byKey("overdue"), ...byKey("today")].filter((r) => r.kind === "task").map((r) => r.task);
> ```
> The rendering below (`todayQuests.slice(0, 5)`, the row markup, `관리 ›` → `onGoQuests`) is unchanged; the card stays **tasks only**, because the schedule and business facts of today already have their own lines (`오늘 일정 {n}건 · 3일 내 마감 {n}건 ›`, `이번 달 계약 … · 입금 미확인 {n}건 ›`) directly above it. The label stays `오늘 할 일`. Empty-state copy changes from `오늘 예정된 할 일이 없습니다.` to `오늘 기한인 실행이 없어요 — 이번 주 이후는 실행 탭에 있어요.`
>
> `flow5.js`:
> - "overdue task shows as past due" → make it structural instead of a body-text match (`기한 지남` is now also a group label and a counts word): find the `<section>` whose `SectionLabel` reads `기한 지남` and assert `밀린 독서 30분` is among its `.text-sm.font-semibold` titles.
> - "home agenda orders overdue → due → daily" → rename to `home agenda narrows to overdue and today` and assert, inside the `오늘 할 일` section: `밀린 독서 30분` is present and is the first row, and `저녁 요가 30분` (D-3) is **absent**.
> - **new step** `the tasks tab keeps the D-3 item in a later group`: in `실행`, assert `저녁 요가 30분` is listed but is **not** inside the `기한 지남` section.
>
> **Phase 2 gate:** `npm run verify` — 0 failed, 0 console errors. E2E total is **138 steps** (135 + 1 flow5 + 1 flow7 + 1 flow8).
>
> ### Phase 3 — finish, docs, screenshots
>
> `npm run finish` → exit 0. No allowlist entry is expected: `todoOf`, `BIZ_ALERT_MAX`, `BizTodoRow` and the `tail` prop all land with their call sites in Phase 1. Confirm `EmptyQuestSvg`, `goalProgress`, `DueChip`, `lastDoneDate` are still referenced, and that no icon import became unused.
>
> `npm run docs:gen && npm run docs:check` → exit 0. Then `npm run build:demo && node tools/harness/gen-screenshots.js` — `tasks.png` is one of the four manifest screenshots and its layout changes completely; commit the regenerated PNG. Finally re-run `npm run verify` once on the built demo path used by the harness.
>
> Report: what changed, every command with its result, the E2E step count before/after, the TD-02 resolution, and a proposed commit message. Do not commit unless the user asks.

## Steps

1. [x] **Phase 1a — engine.** `BIZ_ALERT_MAX` + `buildBriefing` literal swap; `todoOf` after `upcomingEvents`; `EventRow` `tail` prop. Added alongside `todoOf`: `TODO_GROUPS`, `TODO_KIND_RANK`, `todoKey`, `todoSort`, `monthEndDate` (the `dstr(new Date(y, m + 1, 0, 12))` idiom, named once).
2. [x] **Phase 1b — tab.** Rewrote `TaskTab` (header, chips, five open groups + `오늘 완료`, `완료` archive view, three row kinds, three empty states); added `BizTodoRow`, `TODO_TONE`, `TODO_DONE_MAX`; rewired the root. `onAddFor` removed from the signature and the call site; `orphan` / `isMile` locals removed (the `isMile` predicate is inlined at its one remaining use).
3. [x] **Phase 1c — E2E.** `flow.js`, `flow4.js` edits; new steps in `flow7.js` and `flow8.js`; `flow2`/`flow3`/`run.js` helpers re-checked and unchanged. Added one shared reader `todoRows(label, tap)` to `run.js` (`h.todoRows`) instead of duplicating a group reader in three flows — `finish-check` treats a repeated ≥6-line helper as a duplicate. Gate: `npm run verify` → **137 steps, 0 failed, 0 console errors**; 390 px manual check passed (no horizontal scroll, `scrollWidth === innerWidth === 390`).
4. [x] **Phase 2 — home card.** `HomeTab` selector + empty-state copy; `flow5.js` two rewrites and one new step. Gate: `npm run verify` → **138 steps, 0 failed, 0 console errors**. `npm run finish` and `npm run lang:check` both clean, no allowlist entry.
5. [x] **Phase 3 — finish.** `npm run verify` → 139 steps, 0 failed, 0 console errors; `npm run finish` → exit 0; `npm run lang:check` → clean (all confirmed green in the working tree before the docs pass below). `npm run build:demo` + `gen-screenshots.js` already run outside this docs pass (screenshots regenerated). `npm run docs:gen` + `npm run docs:check` run by the docs-sync pass below.
6. [x] Handed to docs-syncer with the doc list below; this plan moved to `docs/exec-plans/completed/`.

### Deviations and findings (phases 1–2)

- **flow7 step position.** The new step sits after `the briefing line opens the schedule tab` rather than immediately after `briefing states the schedule between the tasks and the streak`: that step leaves the briefing modal open and the next one clicks inside it, so inserting between the two would have required editing an existing step. The fixture requirement (`서류 제출 마감` exists, no modal open) is met either way.
- **flow8 assertion strengthened.** `headerLines()` is rendered in every business view, so it cannot prove the `계약` view; the step also asserts `최근 6개월`, which only the contract view renders.
- **Group of a dated row is calendar-dependent.** The plan's demo expectation (`부품사 1차 면접` +3d in `이번 주`) holds only mid-week. On 2026-09-13 (a Sunday) `weekEnd === today`, so everything after today falls in `내일` / `이후`. The E2E steps are written so they do not depend on the weekday.
- **`완료` archive rows use `row(q)` as specified in this section — superseded in Phase 3, see below.** As written here, a daily task completed on an earlier day would render with an open checkbox (its `doneToday` is false today); at the time this was read as the plan's own instruction ("rendered with the same `row(q)`"), not an accident. Phase 3 found that reading wrong: see the finding below.
- No `demoState` edit was needed: the demo produces all three row kinds (task, event, business).

### Finding — Phase 3 (the archive was a second completion surface)

The "not an accident" call above was wrong. `row(q)` unchanged meant a daily task completed on an earlier day drew a **live, unchecked** checkbox inside the `완료` archive, and tapping it there would have completed that task for *today* — a list titled `완료` acting as a second completion surface, which is not what any part of this plan asked for. `row` now takes a second parameter, `archived` (default `false`); an archived row is always closed regardless of `doneToday`, is struck through, and states `완료 {date}` in its subtitle rather than a live subtitle. The trailing `X` stays live on purpose, so an old record can still be deleted from the archive. A new E2E step, `the completed archive states its date and completes nothing` (`flow5.js`), was confirmed to fail without the fix and passes with it. This is also why the completed-row meta changed from `완료 · 🎯 {goal}` to `완료 {date} · 🎯 {goal}` everywhere, including `오늘 완료` — a single format for "closed", not two. E2E grew from 138 to **139** steps as a result; see [tasks.md](../../product-specs/tasks.md) and [tools/e2e/README.md](../../../tools/e2e/README.md) (helper `todoRows`) for the shipped shape.

## Verification

- `npm run verify` at the end of Phase 1, Phase 2 and Phase 3 — **0 failed steps, 0 console errors**. Final total is **139 steps**, not the 138 predicted above: Phase 3 added one more `flow5.js` step for the archive-row fix described under "Finding — Phase 3" below.
- `--smoke` is **not required**: no payout formula, `CERTS`/`EXAMS` row, matrix cell or grade cut is touched, and `tools/harness/smoke-logic.js` only mirrors the data/payout engine. Run `npm run verify -- --smoke` once at the final gate anyway; it is free and proves the tables are untouched.
- `npm run finish` exit 0. `npm run docs:gen && npm run docs:check` exit 0.
- **Manual 390 px check** (Chrome devtools, 390 × 844): `실행` tab with the demo save — no horizontal scroll; header sub-line, counts line and business line each fit; a business row's title truncates rather than wrapping; group labels and `오늘 완료` readable; the `할 일` / `완료` chips reachable without scrolling.
- **Manual demo check** (`데모 데이터로 둘러보기`): `demoState` already produces all three kinds — `이력서 초안 작성` (due yesterday) and the `○○물산` unpaid month (two months old) in `기한 지남`, the daily tasks in `오늘`, `영어 스터디 모임` tomorrow, `부품사 1차 면접` (+3d) and `전기기사 실기 원서 접수 마감` (+9d) in `이번 주` / `이후`, the cert and exam milestones in `이후`. **No `demoState` edit is expected** — if any kind is missing from the demo list, report it rather than editing the fixture silently.
- `npm run build:demo` + `node tools/harness/gen-screenshots.js`; confirm the four manifest screenshots regenerate and `tasks.png` shows the new list.

## Cleanup checklist

- [x] `npm run finish` exit 0 (unused symbols/imports, duplicates, residue, language) — `finish-check: clean`.
- [x] `onAddFor` removed from both the `TaskTab` signature and its call site; no orphaned prop.
- [x] `orphan` / `isMile` locals removed; `EmptyQuestSvg`, `goalProgress`, `DueChip`, `lastDoneDate` still referenced (`goalProgress` by `paceOf`, `completeTask`, `checkinKR`, `goalStatus`; `lastDoneDate` by `buildBriefing` and the `완료` archive sort).
- [x] No allowlist addition. `tools/harness/finish-allowlist.json` is untouched.
- [x] `npm run lang:check` clean — new comments are English; Korean appears only in UI copy and E2E selector arguments.

## Docs to sync

| File | Change |
|---|---|
| `docs/product-specs/tasks.md` | Rewrite the `TaskTab` section: new header, the five groups + `오늘 완료`, the `할 일` / `완료` chips, the three row kinds and their controls, the three empty states, every new/removed Korean string. `AddTaskModal` and `CatalogModal` sections unchanged. |
| `docs/product-specs/home.md` | `오늘 할 일` now = overdue + today, tasks only, from `todoOf`; new empty-state copy. |
| `docs/product-specs/goals.md` | State explicitly that `목표` is the only task-creation surface, and that goal→task listing now lives nowhere else (numbers only). |
| `docs/product-specs/schedule.md` | `EventRow` gains the optional `tail` prop (the `일정` tab passes nothing); events are also listed in `실행` and complete nothing there. |
| `docs/product-specs/business.md` | Which two business facts surface in `실행`, which do not and why; the `사업` tab stays the owner. |
| `docs/product-specs/daily-briefing.md` | `BIZ_ALERT_MAX` replaces the literal 3; the briefing is otherwise unchanged. |
| `docs/design-docs/information-architecture.md` | Screen map rows for `tasks` and `home`; replace the "Milestone / daily / unassigned sections" section with the time-group model; note that the four-level hierarchy is unchanged — only the task tab's *view* stops mirroring it. |
| `docs/design-docs/goal-engine.md` | If it describes the goal→task listing, correct it; `krProgress` / `goalProgress` / `paceOf` are untouched. |
| `docs/design-docs/assistant-bridge.md` | Confirm no change (the packet and `buildAssistantPacket` are untouched); state it if the doc claims the task tab is the agenda source. |
| `ARCHITECTURE.md` | Add `todoOf` to the "Daily assistant" region row and `BizTodoRow` to the Tabs row; refresh the status line (E2E 138 steps). |
| `docs/RELIABILITY.md`, `tools/e2e/README.md` | New step count 135 → 138, the new steps and what they cover. |
| `docs/exec-plans/tech-debt-tracker.md` | Move **TD-02** to Resolved (2026-09-13 — the tab lists tasks by time, not by goal, so a done goal's tasks appear again). Re-read **TD-32** and note whether the helper defect is unaffected (it is: `openTaskModalFor` targets `목표`, which this plan does not change). |
| `docs/design-docs/decision-log.md` | The user's three decisions, the business-facts table (including why a stale quote is excluded), the Rule 18 reading, and the link to this plan. |
| `docs/generated/*` | `npm run docs:gen` (symbol index, db-schema — schema is unchanged, the index gains `todoOf` / `BizTodoRow` / `BIZ_ALERT_MAX`). Never hand-edit. |
| `public/screenshots/tasks.png` (+ the other three) | Regenerated by `npm run build:demo` + `node tools/harness/gen-screenshots.js`. |

## Proposed commit

```
feat(tasks): one time-ordered list of tasks, events and business items in 실행
```
