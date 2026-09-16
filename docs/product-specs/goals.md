# Goals tab
<!-- src: SPEC-4-3 -->

`GoalsTab` lists goals as OKR cards — title, 영역 (area), deadline, note, and key results (KR) of four types — and is numbers-only: no task row, no per-task control, nothing derived from a task beyond the KR progress figures below. It is also, since the `할 일` tab (named `실행` before 2026-09-16) dropped `＋ 이 목표에 실행` ([tasks.md](tasks.md)), the **only** place a 실행 (task) can be created from ([Rule 18](../design-docs/core-beliefs.md#rule-18)) — every goal→task listing in the app now lives here, as numbers, never as a row list. Progress and 페이스 (pace) are computed at render by `goalProgress`, `krProgress`, and `paceOf` ([Rule 9](../design-docs/core-beliefs.md#rule-9)); the formulas are in `goal-engine.md` under `../design-docs/`. Props: `state, onAddGoal (opens modal "addGoal"), onCheckin (checkinKR), onGoalStatus (goalStatus), onRemoveGoal (removeGoal), onAddQuestFor (opens modal "addQuest" with the goal id)`.

Since home became a quantitative CV with no date-scoped facts (2026-09-15, [home.md](home.md)), `목표` is also the **only** screen that shows goal progress with its pace — the user's own decision (`목표별 진행률은 목표탭에서만`). The daily briefing still carries its own `목표 페이스` lines ([daily-briefing.md](daily-briefing.md)), unchanged.

## Layout
- Header section: `목표 (OKR)` / `목표를 세우고, 핵심결과 수치로 진행을 측정해요.` / cyan button `새 목표`.
- Groups in order: `active` → `진행 중` (label zinc-400, bar cyan) and `done` → `달성` (label emerald-400, bar emerald, card at `opacity-75`). An empty group is not rendered; with no goals at all: `EmptyGoalSvg` + `목표가 없습니다. 모든 진행 측정은 목표에서 시작됩니다.`

## Goal card
- Title; `{area.name || "일반"} · {deadline} ({ddayStr})` or `기한 없음`.
- Active goals add the pace line (`pc = paceOf(g, state)`): `진행 {round(p·100)}% · 시간 경과 {round(el·100)}% · {pc.label}` (label in `pc.cls`), or `기한 없음 — 페이스 계산 불가` when `pc.el` is null. Never softened ([Rule 13](../design-docs/core-beliefs.md#rule-13)).
- Right: `{round(pr·100)}%` (large mono; cyan while active, emerald when done) with `pr = pc.p`, then `Bar(pr)`.

## KR rows
Each KR shows a type chip from `KR_CHIP` (`수치` emerald · `횟수` cyan · `시험` sky · `자격` violet), `kr.title`, `{round(kp·100)}% · {krRemainText}` on the right with `kp = krProgress(kr, g, state)`, `Bar(kp)` (`h-1.5`), and a type-specific line:

| Type | Line | Control |
|---|---|---|
| `metric` | `{start}{unit} → 목표 {target}{unit}` | `<input type="number">` with `defaultValue = current ?? start` and `key = "{id}-{current}"` (remounts after each check-in); `onBlur` → `onCheckin(g.id, kr.id, Number(value))`; unit label beside it |
| `exam` | `내 최고 {exams.best[famId].label || "—"} → 목표 {band.label} · 시험 실행으로 자동 반영` | `등록 ›` (sky) → `onAddQuestFor(g.id)` while `!kr.done` |
| `cert` | `{certName} — 취득 완료` when `kr.done`, else `{certName} — 마일스톤 실행에서 합격증 제출로 완료` | `CertBadge(achGrade(c.d))` when `certByTitle(certName)` resolves; no manual completion button ([Rule 19](../design-docs/core-beliefs.md#rule-19)) |
| `count` | `{krDoneCount(g)} / {need}회 (연결 실행)` | button `실행 추가` → `onAddQuestFor(g.id)` |

`krRemainText`: metric → `달성` or `{|target − current| to 2 decimals}{unit} 남음` (direction-aware: hit when `current ≥ target` if `target ≥ start`, else `current ≤ target`); count → `달성` or `{need − done}회 남음`; exam → `미응시` (no `exams.best[famId]`), `달성`, or `{band.p − best.p}P 남음`; cert → `취득` / `미취득`. `checkinKR` accepts only a finite number on a `metric` KR, returns the previous state when the value is unchanged, and toasts `체크인 · 🎯 {g.title} {from}% → {to}%` when the rounded goal progress moved.

## Card footer
- Active: `＋ 실행 연결` → `onAddQuestFor(g.id)` (`AddTaskModal` for this goal) and, only when `pr ≥ 1`, `달성 처리` → `goalStatus(id, "done")`: the status flips and the `achieve` overlay opens with `{name: g.title, tier: "A", kind: "rank"}`. Every active card also shows `목표 삭제` (`text-rose-400`, the destructive role — [../DESIGN.md](../DESIGN.md)) → `removeGoal`: `window.confirm` names the goal and both counts — `{title} 목표를 삭제해요. 연결된 미완료 실행 {n}건도 함께 사라져요. 완료 기록 {m}건은 미분류로 남아요. 계속할까요?` — cancelling changes nothing; confirming deletes the goal together with its tasks that carry no completion record (`status !== "done"` and no `doneDates` entry), clears those tasks' `liferpg-img-ev-*` and `liferpg-img-study-*` keys the way `removeTask` does, and toasts `목표를 삭제했어요 · 미완료 실행 {n}건 삭제 · 완료 기록 {m}건 유지`. Tasks that carry a completion record keep their `goalId` on purpose (the confirm and toast still call this state "미분류") — since [tasks.md](tasks.md)'s rewrite there is no section by that name any more, so they render as ordinary rows of the `할 일` tab tagged `목표 기여 없음`, same as the done-goal path below.
- Done: `기록에서 제거` → `removeGoal` filters the goal out of `goals` only, no confirmation, no toast, no task deletion. Linked tasks keep their `goalId`; because it no longer resolves they render as ordinary `할 일`-tab rows tagged `목표 기여 없음`.

## `AddGoalModal` — `새 목표 (OKR)`
Props: `areas, onClose, onAdd (addGoal)`. Inputs: title `목표 — 예: 영어 실전 수준 만들기`; area `<select>` over `areas` (defaults to `areas[0]`); `<input type="date">` deadline with no `min` (past dates accepted); note `메모 (선택) — 왜 이 목표인가`. KR box `핵심결과(KR) 추가 — {n}개` with type chips `수치` · `횟수` · `시험` · `자격` (`krType`, default `metric`; switching clears the error):

| Type | Inputs | Validation error | KR appended by `addKr` |
|---|---|---|---|
| metric | `지표명 — 예: 체지방률` · `시작` · `목표` (number inputs) · `단위` (`w-16`) | `지표명·시작값·목표값을 입력해 주세요.` | `{id, type: "metric", title, start: Number, target: Number, current: start, unit}` |
| count | `행동 — 예: 스터디 참석` · `횟수` (number) | `행동명과 목표 횟수를 입력해 주세요.` (empty only — `0` and negative values pass) | `{id, type: "count", title, need: Number}` |
| exam | horizontal family buttons from `EXAMS` (selecting one resets the band) → band chips from `fam.bands` `[label, d, p, conf]`; note `달성 여부는 시험 실행 완료 기록에서 자동 계산돼요.` | `시험과 목표 밴드를 선택해 주세요.` | `{id, type: "exam", title: "{fam.n} {label} 달성", famId, band: {label, d, p, conf}}` |
| cert | `자격증 검색 — 예: 정보처리기사` + up to 5 chips (`certHits`: `CERTS` names containing the query, case-sensitive) | `자격증 이름을 입력해 주세요.` | `{id, type: "cert", title: "{q} 취득", certName: q}` — free text is accepted; a name outside `CERTS` cannot be bridged to a milestone later |

`＋ 이 핵심결과 추가` appends to the list (rows removable with X, one field set is cleared after each add). `목표 만들기` (`submit`): empty title → `목표 이름을 입력해 주세요.`; otherwise `onAdd({id: uid(), title, areaId, deadline: deadline || null, note, status: "active", createdAt: dstr(), krs})`. `addGoal` prepends the goal to `goals`, closes the modal, and toasts `목표 생성 · 시작 진행률 {p0}%` followed by ` · {ddayStr}` or ` · 기한 없음`. Footer note: `KR이 없으면 진행률은 0%로 고정됩니다 — 측정할 수 없는 목표는 관리되지 않습니다.` (`goalProgress` returns 0 for a goal without KRs).
