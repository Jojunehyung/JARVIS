# Goal engine — progress, pace, and task creation
<!-- src: SPEC-5 -->

A goal is an objective plus key results (KR). Progress is always derived from KRs and tasks, never stored ([Rule 9](core-beliefs.md#rule-9)), and every 실행 (task) belongs to a goal ([Rule 18](core-beliefs.md#rule-18)). Pace — progress measured against elapsed time — is shown whether it flatters the person or not ([Rule 13](core-beliefs.md#rule-13)).

## KR progress (`krProgress(kr, goal, state)`)

| type | Formula |
|---|---|
| `metric` | `span = (target ?? 0) − (start ?? 0)`; when `span` is 0, `current >= target ? 1 : 0`; otherwise `clamp01(((current ?? start) − start) / span)` — a decreasing target (weight loss) works because the span is negative |
| `exam` | `best = exams.best[famId]`; no record → 0; otherwise `min(1, best.p / (band.p || 1))` |
| `cert` | `done ? 1 : 0` |
| `count` | `min(1, done / max(1, need || 1))` where `done` sums every task of this goal: `daily` contributes `doneDates.length`, `once` contributes 1 when `status === "done"` |

`krDoneCount(goal, state)` is that same sum, computed per goal rather than per KR — so several `count` KRs on one goal share one tally, and completed milestone tasks count towards it too.

```js
goalProgress = krs.length ? sum(krProgress) / krs.length : 0     // unweighted mean
```

## Pace and deadline

```js
elapsedRatio(goal) = clamp01((Date.now() − Date(createdAt + "T00:00")) / (Date(deadline + "T23:59") − Date(createdAt + "T00:00")))
                     // span <= 0 → 1; no deadline or no createdAt → null
paceOf(goal, state):
  el == null                      → { label: "기한 없음",        cls: text-zinc-500 }
  gap = round((p − el) * 100)
  gap <= −5                       → { label: "{−gap}%p 뒤처짐",  cls: text-rose-400 }
  gap >=  5                       → { label: "{gap}%p 앞섬",     cls: text-emerald-400 }
  otherwise                       → { label: "궤도 유지",        cls: text-zinc-400 }
daysBetween(a, b)  = whole days from a to b, both "YYYY-MM-DD", anchored at noon so DST cannot shift the count
ddayStr(deadline)  = daysBetween(dstr(), deadline) → "D-{n}" | "D-DAY" | "D+{n}"   // due today reads D-DAY
```
`paceOf` returns `p` as well, so a caller that already has the pace must not call `goalProgress` again.

`krRemainText` states what is left: `metric` → `달성` when `target >= start ? cur >= target : cur <= target`, otherwise `{|target − cur| rounded to 2 decimals}{unit} 남음`; `count` → `달성` or `{need − done}회 남음`; `exam` → `미응시`, `달성`, or `{band.p − best.p}P 남음`; `cert` → `취득` or `미취득`.

## Progress deltas
Every mutation that can move a goal snapshots `goalProgress` for each active goal before the change (`beforeP`), recomputes afterwards, and reports only the goals where `to !== from`, as whole percents. `completeTask` sends the deltas to the ACHIEVEMENT overlay or the toast, `checkinKR` shows `체크인 · 🎯 {title} {from}% → {to}%`, and `addGoal` reports the starting progress. `promoteArea` does not compute deltas — a 승급 (promotion) changes area grades, not goal progress.

## KR check-in (`checkinKR`)
Writes a new `current` onto a `metric` KR and shows the resulting delta. It is the only path that changes a metric KR, and the only place fitness measurements land: `applyMeasures` looks for the first active goal holding a `metric` KR whose title contains the measured label (`체중`, `골격근량`) and calls `checkinKR` with the value ([Rule 17](core-beliefs.md#rule-17)).

## Task creation rules

`detectKind(t)` infers an activity kind from the title, in priority order: `/독서|책\s?읽|북클럽/` → `book`, `/운동|헬스|러닝|조깅|필라테스|요가|웨이트|수영/` → `fit`, otherwise `""`.

`goalKinds(goal)` returns `{ kinds, study }` and decides what the task modal is allowed to offer. `kinds` starts as an empty `Set`. From `title + note`: `detectKind` adds its kind; `/어학|영어|토익|오픽|일본어|중국어|공부|학습|독서|자격|시험|스펙|지식|개발|코딩/` sets `study` and adds `book`; `/체력|건강|다이어트|감량|근육|헬스|피트니스|몸/` adds `fit`. Each KR then contributes: `detectKind(kr.title)`; an `exam` or `cert` KR sets `study` and adds `book`; a `metric` KR matching `/체중|골격근|체지방|근육|인바디/` adds `fit`.

Scope: template chips appear only for kinds in `gk.kinds`, and study mode only when `gk.study` — so an unrelated kind never reaches the screen ([Rule 19](core-beliefs.md#rule-19)). The activity-kind chip row itself always renders in normal mode and falls back to offering both `book` and `fit` when `gk.kinds` is empty, so a goal that matches no keyword (a revenue goal with only a metric KR, say) is never a dead end.

`TASK_TEMPLATES`:

| Title | kind | diff | type |
|---|---|---|---|
| `아침 운동 30분` | fit | E | daily |
| `독서 30분` | book | E | daily |

**Difficulty caps** ([Rule 18](core-beliefs.md#rule-18)): daily and activity tasks may be E, D or C — 60 pts stays below `EVIDENCE_MIN` (150), so a kind task can never bypass the evidence gate ([Rule 17](core-beliefs.md#rule-17)). Study tasks may be E or D only. Milestones get their difficulty from `scoreTier` of the payout, which is how they reach B and A.

**Title/kind conflict** is refused when `detectKind(title)` and the selected kind are both set and differ. With no kind selected, the detected kind is assigned automatically — including a kind outside `gk.kinds`.

**Kind requirement** ([Rule 19](core-beliefs.md#rule-19) amendment, 2026-09-11): a normal task needs a kind — either the selected chip or `detectKind(title)` — before `submitNormal` will call `onAdd`; with neither, it refuses with `활동 유형을 골라 주세요 — 📚 독서·💪 운동만 목표에 등록돼요. 공부는 '학습', 자격·시험은 핵심결과, 약속·미팅은 일정 탭에서 만들어요.` The one exception is a task started from a count KR's `채우기 ›` (`fillCount`, [tasks.md](../product-specs/tasks.md)): it sets `krId`, form state that lets `submitNormal` accept an empty kind, since a count KR is the goal's own measured action rather than an appointment.

A `once` task may carry an optional `due` date (`기한 (선택)` in the modal); `daily` tasks never do, and a milestone created from a KR defaults its `due` to the goal deadline. `agendaOf(state, today)` buckets the open tasks by that date into overdue, due today, daily, this week and later — derived at render, never stored ([Rule 9](core-beliefs.md#rule-9)).

`type` is `daily` (`매일 반복`) or `once` (`오늘 1회`); study tasks and milestones are always `once`. The 영역 (area) is inherited (`areaId = goal.areaId || areas[0].id`), never chosen in the modal. New tasks start `status: "todo"`, `doneDates: []`, with `createdAt` and a fresh `uid()`, and are inserted at the front of the list.
