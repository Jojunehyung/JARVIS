# Role model and streak
<!-- src: SPEC-5 -->

The recommendation logic behind 방향 제안 (direction advice) lives in `roleRecommendations`, shared with the daily briefing ([assistant-bridge.md](assistant-bridge.md)).

Two numbers describe the person behind the areas (영역): role-model (롤모델) proximity `roleGap`, and the streak with its streak shields (보호권) in `act`. Proximity is derived from area grades and never stored ([Rule 9](core-beliefs.md#rule-9), [Rule 14](core-beliefs.md#rule-14)). Field shapes: [../generated/db-schema.md](../generated/db-schema.md).

**2026-09-11:** the life-metric triple this file used to document (`metrics.asset / infl / body`, its automatic gain from achievements/promotion/goal completion, and its manual check-in) was removed by the user's decision, store and all (schema v19 drops `metrics` and `act.lastCheckin`) — see the [decision log](decision-log.md) and [Rule 8](core-beliefs.md#rule-8). What it claimed to track belongs to a goal's metric KR instead.

## Role-model proximity (`roleGap`)
`role = { name, targets{areaId: 1–8} } | null`. `RoleModelModal` offers `ROLE_PRESETS` (대기업 현직 전문가 · 월 500 1인 사업가 · 프리랜서 전문가 · 창업가·대표) or a free name (empty → `롤모델`) and, per area, `제외` (0) or a required grade from 견습 (1) to 거장 (8) — 정점 (9) cannot be required.
```
items = areas.filter(a => targets[a.id] > 0)
             .map(a => ({ area: a, need: targets[a.id], have: a.grade, gap: max(0, need - have) }))
match = round(mean(min(1, have / need) ** 2) * 100)      // null when role is null or items is empty
```
Overshoot is capped at 1. One grade short: need 5 / have 4 → 64 %, need 3 / have 2 → 44 %, need 8 / have 7 → 77 %, need 4 / have 3 → 56 % — the "about 70 %" of [Rule 14](core-beliefs.md#rule-14) describes the shape, not a constant. Demo: `완성차 1차사 하네스 설계 책임` with targets {직업·커리어 6, 기본지식 4} against grades 3 and 2 → 25 %. Proximity depends only on area grades, so it moves at promotion (or the `어학` specialisation jump); a certification payout by itself does not change it.

`롤모델 근접도` is the small line under the CV on home (2026-09-15, [home.md](../product-specs/home.md); it led the growth tab's headline before the tab was removed): `롤모델 근접도 {match}% · {name} ›`, a button into `RoleAdviceModal` — or, without a usable role, the inert line `롤모델 미설정 — 근접도 계산 대상 없음`. The number and its formula are unchanged. The segmented bar — one cell per required grade, width `((k + 1) / need)² − (k / need)²` × 100 %, filled while `k < min(have, need)`, next to `{RANKS[have].name} / 요구 {RANKS[need].name} · {gap}단계 부족` or `· 충족` — renders at `h-2` with no surrounding card as the first block of `RoleAdviceModal`, one tap away from the home line; the paragraph explaining how to read it sits once underneath, not repeated per branch.

## Role stages (v28)
Optional, additive to the proximity model above: `role.stages?: [{ id, name, conds: [{ type, arg?, min }] }]`, up
to `ROLE_STAGES_MAX` (12) stages, each up to `STAGE_CONDS_MAX` (5) conditions. A stage is **met** when every one
of its conditions is met; the current stage is the first unmet one (or `null`, with `k = n + 1`, once every stage
is met). Every value, the current stage and the quit condition are **derived at render, never stored**
([Rule 9](core-beliefs.md#rule-9)); the stage count is a second, independent figure beside `roleGap`, **never
merged, averaged or weighted into it** ([Rule 14](core-beliefs.md#rule-14)) — `roleGap` reads only area grades
and is byte-identical to its pre-v28 text.

**Condition grammar**, `{ type, arg?, min }`, evaluated by `condValue(state, today, c)` purely from the save:

| `type` | Label | `arg` | Reads |
|---|---|---|---|
| `deals_won` | 계약 체결 수 | client/title substring (optional) | won deals matching |
| `deals_active` | 진행·예정 계약 수 | client/title substring (optional) | won deals whose `dealPhase` is `active`/`upcoming` |
| `monthly_revenue` | 이번 달 계약 매출 (원) | — | `bizSummary(state, today).thisMonth` |
| `payment_paid` | 입금 확인된 일시금 수 | a `PAYMENT_KIND` key (optional) | payment lines with `paidAt` |
| `folio_match` | 포트폴리오 항목 수 | title/summary/stack substring, case-insensitive (optional) | `state.folio` |
| `milestone_done` | 완료 마일스톤 수 | a stage number, or a title substring (optional) | done `state.milestones` |
| `leads_stage` | 리드 수 (단계 이상) | a `LEAD_STAGES` value | leads at or past that stage — no/unknown `arg` counts every lead |
| `notice_status` | 공고 수 (상태 이상) | a `NOTICE_STAGES` value, or `rejected` | notices at or past that status (`rejected` counts only itself) — no/unknown `arg` counts every notice |
| `cert_held` | 보유 자격 | a certification name, exact | 1 when `heldCertsOf(state)` names it, else 0 |

An unknown `type` reads 0. `condText(state, today, c)` prints the label, the quoted `arg` when present, then
`{value}/{min}` (money through `wonText` for `monthly_revenue`); `roleStageOf(state, today)` returns `null`
without stages, else `{ n, k, condsMet, condsTotal, quit, current, stages }` — `k` capped for display at `n`,
`quit` = the last stage's `met`. `stageLine(rs)` → `롤모델 {k}/{n}단계 · 조건 {c}/{m} · {전환 조건 충족 (1/1) |
전환 조건 미충족 (0/1)}`, the one string the CV button, the advice modal and its `title` attribute share
(`quitText(rs)` is the shared quit fragment). **The quit condition is the last stage's conditions** —
`전환 조건 충족 (1/1)` once stage `n` is met, otherwise `전환 조건 미충족 (0/1)`; nothing else in the app reads
or sets it.

**The preset and the seed.** `ROLE_PRESETS` gains a fifth entry, `의료 AI 솔루션 대표` (an option list, not a
frozen data table — `data-guard`'s `ROW_PATTERNS` do not match it). Picking it sets the role's name and, after
`window.confirm("단계를 기본 9단계로 바꿔요. 계속할까요?")` when stages already exist, replaces `role.stages` with
`seedStages()` — `ROLE_STAGE_SEED` mapped with a fresh `id`. The seed is a literal array dated 2026-09-17, from
the user's own situation (see [decision-log.md](decision-log.md)): a contract-based developer → task-expansion
negotiation → a detailed sub-contract → an AI delivery registered as a portfolio item → hospital sales begun →
the first hospital contract → repeat revenue (**stage 7's `monthly_revenue` threshold, 5,000,000 won, is a draft
the caller left open and the user edits in the stage editor**) → a national-project proposal submitted → a
national project won, the quit condition. `condValue`'s evaluator choices the plan left open: `notice_status`
and `leads_stage` both read "every record" without a usable `arg` (not merely for leads, as first drafted);
`cert_held` without an `arg` reads 0; the three title-matching types (`deals_won`, `deals_active`,
`milestone_done`) are case-sensitive, unlike `folio_match`; `monthly_revenue` ignores an `arg`.

### The stages editor (v28)
Inside `RoleModelModal` (`설정` → `롤모델 설정`/`롤모델 수정`), below the target-area rows: `SectionLabel`
`단계 (선택)` with a mono `{n} / 12`. One card per stage (`bg-zinc-950 border border-zinc-800 rounded-xl p-2.5
space-y-1.5`): a mono `{i}단계` tag, a name input (`placeholder="단계 이름 — 예: 첫 병원 계약"`, `aria-label="단계
이름"`, `maxLength` `ROLE_STAGE_NAME` 40, no length refusal), a remove `X` (`aria-label="단계 삭제"`); one row per
condition — a `type` select (`aria-label="조건 종류"`, options = `COND_TYPES` labels), a text input (`aria-label="조건
값"`, placeholder = the type's argument hint or `조건 값 없음`, disabled and its value cleared when the hint is
empty), a number input (`aria-label="기준"`, `font-mono`, `w-16`) and a remove `X` (`aria-label="조건 삭제"`); a
button `조건 추가`, disabled at 5 with `조건은 단계당 5개까지예요.` Under the cards, `단계 추가` (a new stage
starts as `계약 체결 수` with threshold 1), disabled at 12 with `단계는 12개까지예요.` Caption: `조건은 앱의
기록으로 계산돼요 — 근접도와는 별개예요.` Declining the preset confirm still sets the role's name and keeps the
existing stages; switching a condition to a hint-less type clears its argument on the spot, and saving drops the
argument of such a type as well. Save refusals: `단계 이름을 입력해 주세요 — {k}번째 단계` and `기준은 0 이상
숫자예요 — {k}단계 {j}번째 조건`. Saving writes the name, the target areas and, when at least one stage remains,
`stages` shaped `{ id, name, conds: [{ type, arg?, min }] }` — every other write path (`role.targets`) is
unchanged; removing every stage stores no `stages` key at all, and the CV's stage line and button disappear with
it.

### The advice modal's stage block
`RoleAdviceModal` gains, after the proximity bars and legend, a block (`bg-zinc-950 rounded-xl p-3`) rendered
whenever stages exist: `SectionLabel` `단계`, a headline `{k}/{n}단계 · {stage name}` (or `전환 조건 충족 —
{n}/{n}단계` once every stage is met), one mono line per condition of the current stage (`- {condText}`, rose
when unmet, emerald when met), then `다음 마일스톤: {milestoneLine}` for the first not-done milestone by
`milestoneOrder`, or `다음 마일스톤 없음 — 로드맵에서 추가해요`, and a border button `로드맵 열기 ›` that closes
the modal, switches the business view to `roadmap` and opens the `사업` tab. **For the area named `사업`**, when
stages exist, the standard-certification block that every other area still shows (certification rows, exam
rows, the no-match line, `도감에서 더 보기 ›`) is **replaced** by these same stage lines under the `다음 관문:`
line — the `JOB_FIELDS` toggle row is unaffected and stays for every area, `사업` included. Every other area's
advice is unchanged.

### The briefing's next-step tail
`buildBriefing`'s `다음 단계` line: when the first gap's area is named `사업` **and** stages exist, the tail
becomes `다음: {stage}단계 {name} · 조건 {c}/{m}` (or `다음: 전환 조건 충족` once every stage is met) — stage
numbers, a name and counts only, so nothing a day-job or private record names can reach the daily packet through
this line. Without a `사업` gap, or without stages, the tail is the existing certification-recommendation text,
byte-identical. See [assistant-bridge.md](assistant-bridge.md).

`growth.md` (the retired tab's content map) carries one added row pointing here for the stages editor and the
advice modal's stage block, since both now live behind `설정` and the CV rather than the old growth headline.

## The story, the verdict and stage progress (2026-09-18)

Schema stays **v28** — `role` gains three optional fields, none backfilled, the same "no migration" shape as the
v26 memo/transcript change ([state-lifecycle.md](state-lifecycle.md)): `story?` (≤ `ROLE_STORY_MAX` 2,000 chars,
the user's own `원하는 모습` written in `RoleModelModal`'s new first section, above the stages editor which is
now labelled `세부 수정`), `verdicts?[{ id, date, probability?, summary, basis, position, gaps[], stageK, stageN,
source: "ai" }]` (newest first, capped at `ROLE_VERDICTS_MAX` 24 — the oldest is dropped past the cap), and
`seenStageK?` (a seen-stamp, below). Every reader tolerates their absence.

### The fifth bridge packet and its parser

`AI에게 판정 묻기` (`buildRoleVerdictPacket` / `parseRoleVerdictReply`) is the fifth packet the assistant bridge
carries — see [assistant-bridge.md](assistant-bridge.md#the-fifth-packet--ai에게-판정-묻기) for its sections, cap
and trim order, and the parser's validation table. It is built from the user's own story, the CV line, the area
grades and requirements, the held certifications and exam bests, business-and-private record counts, the current
stages with their condition values, and the last verdict — and carries no identifier. A reply may *propose*
stages and area requirement grades, and *state* a verdict; nothing is saved without the user's tick
([Rule 7](core-beliefs.md#rule-7) amendment, 2026-09-18).

### `RoleVerdictModal` — send, paste, confirm

Opened from `RoleAdviceModal`'s `AI에게 판정 묻기 ›` button (`modal.type: "roleVerdict"`, `roleVerdict` 39th
value), disabled until `role.story` is set, with the caption `먼저 롤모델 설정에서 원하는 모습을 적어요 — 적은
글이 패킷에 실려요.` Three steps sharing `PacketSendPane` / `ReplyPastePane` / `copyPacket` with the other bridge
modals: **send** (the packet and its privacy caption); **paste** (`ReplyPastePane`, pre-ticks every
non-rejected stage and area row on `읽기`); **confirm** — a verdict block (`AI 판단 · 검증되지 않음 · {today}`,
`probText(probability)`, the summary, `근거:`/`현재 위치:` lines, gap lines, or `판정 없음 — 답변에 verdict가
없어요` without one), then tickable stage rows (name, `why` or `근거 없음`, one mono condition line each, a
rose reject reason when rejected — a stage with one invalid condition is rejected whole) and tickable area rows
(`{name} 요구 {RANKS[need].name} (지금 {current ? RANKS[current].name : "제외"})`) — an area row appears only
when the proposed grade differs from the current requirement. Saving replaces `role.stages` only when at least
one stage is ticked; when stages already exist, `window.confirm("단계를 AI 제안으로 바꿔요. 계속할까요?")` gates
it first (user data — no tick, no confirm, no write). `cert_held` arguments are normalised through
`certByTitle(arg).n` (longest name first, [Rule 15](core-beliefs.md#rule-15)) before `condValue`'s exact-match
read of `heldCertsOf`; an unmatched name rejects the stage with `자격 표에 없는 이름이에요: {arg}`. The raw reply
is never stored, on the journal or the verdict — only the clipped `summary`/`basis`/`position`/`gaps` and the
probability. Toasts: `AI 판정 저장 · 단계 {a}건 · 요구 등급 {b}건` with a verdict, `AI 제안 저장 · 단계 {a}건 ·
요구 등급 {b}건` without one.

### `stageProgressOf(state, today)` and the headline decision

`stageProgressOf` → `null` without stages, else `{ rs, k, n, name, pct, journey, conds }`. `pct` is the current
stage's fraction (mean of `min(1, value/min)` over its conditions, a stage without conditions counting as met)
floored to a percentage, so `100` prints only once every condition is met; `journey` is `((k − 1) + fraction) /
n` as a rounded percentage — the figure that moves at most `1/n` per stage. **The profile headline states `pct`,
not `journey`**: `pct` is the number that moves with every record the user adds and names the stage it measures,
while `journey` would blur which condition moved and is printed once, in the advice sheet's stage block
(`진행 {pct}% · 전체 {journey}%`) — nowhere else. Both are derived at render, never stored
([Rule 9](core-beliefs.md#rule-9)); the stage progress percentage is a second figure beside `roleGap`'s
proximity, under its own label, never merged, averaged or weighted with it
([Rule 14](core-beliefs.md#rule-14)). `condRatio(r)` (a threshold of 0 met by definition, past the threshold
capped at 1) is the one top-level helper both `stageProgressOf` and `RoleStageLines`'s per-condition bars read.

The `HomeTab` headline (`단계 {k}/{n} {name} · 진행 {pct}%` with a cyan bar, `title={stageLine(sp.rs)}`, opening
`RoleAdviceModal`) renders **above** the unchanged proximity line, with the newest verdict's caption
(`{probText(probability)} · {date}`) beneath the bar when a verdict exists; without stages the proximity line
renders alone, as before v28.

### The stage-completion overlay and `seenStageK`

A third `Overlay` branch, `type: "stage"`: a cyan-bordered card with no portrait and no trophy — the mono label
`STAGE`, `단계 완료`, the completed stage's name, `다음: {next stage name}` or `모든 단계 충족`, and `기록으로
계산된 완료입니다.` — auto-closing after the existing 2,400 ms.

`role.seenStageK` is a **seen-stamp, not stored progress** ([Rule 9](core-beliefs.md#rule-9)): it records which
`k` the overlay was last shown for, exactly as `act.briefingSeen` records which day the reader was closed; `k`
itself is always recomputed from the records. A save without a stamp, or a stage set just replaced by
`saveRole`/`importRoleVerdict` (both stamp the new `k` in the same write, so replacing stages never fires the
overlay), is stamped silently on the next render. A root effect (after the day-change effect) is the single
place the overlay is raised: it compares the derived `k` against the stamp, raises the overlay only when the
stamp exists and `k` rose since it was taken (a record write — a deal, a payment, a portfolio entry, a
milestone, a lead, a notice, a certificate photo — is the only thing that can raise `k` between two stamped
renders), and always re-stamps to the current `k` — a missing stamp or a lower `k` (a deleted record) is
stamped silently, with no overlay.

### Verdict history and the delta line

`RoleAdviceModal`'s `AI 판정 기록` block: the `AI에게 판정 묻기 ›` button and its story caption, then — with two
or more verdicts — the delta line `확률 {a} → {b} ({date a} → {date b}) · 단계 {ka} → {kb}` between the two
newest, then the list newest first (label, `probText` + `단계 {k}/{n}`, the summary; the **newest** entry alone
also prints `근거:`, `현재 위치:` and its gap lines) — `AI 판정 없음` without any. The list renders at most
`ROLE_VERDICTS_MAX` entries (the store's own cap) — no further UI cap.

**Known limit** ([TD-84](../exec-plans/tech-debt-tracker.md)): when the reader's re-assessment line appends a
stage-rose suffix at the *last* stage, it reads `단계 n → n` — both `sp.k` and the verdict's `stageK` are capped
at `n` for display, so the figure never visibly moves at the top of the ladder even though the stage did
complete.

### The re-assessment line — `roleVerdictDue(state, today)`

`{ last, days, stageRose, due }`: due when there is no verdict yet, the last one is `ROLE_VERDICT_DAYS` (30) days
old or older, or a stage has completed since it was given (`stageRose`, comparing the verdict's own `stageK`
against the current derived `k`). Read by the reader's tenth section, `롤모델 판정` — see
[daily-reader.md](../product-specs/daily-reader.md#the-role-verdict-section) — never by a packet: the AI's own
probability must not travel back into a packet through the briefing, so `buildBriefing` stays byte-identical.

### Storage arithmetic

`STORAGE_BUDGET` = 3,672,064 chars. Story: `,"story":""` (11 chars) + up to 2,000 → ≤ 2.0 k once. A verdict record
≈ 130 chars of overhead (measured: an empty one is 140 chars, the plan's ≈130 estimate having used a shorter
`id`); full (300 + 500 + 300 + 8 × 122) ≈ 2.2 k; typical ≈ 600. `ROLE_VERDICTS_MAX` (24) × 2.2 k ≈ 53 k at the cap
(1.4 % of the budget), ≈ 14 k typical — the oldest is dropped past 24. `seenStageK`: `,"seenStageK":1` = 15 chars.
Every verdict save runs `recordFits(nextRole, JSON.stringify(prev.role || {}).length, "판정을")`.

### Demo figures (2026-09-18)

`demoState`'s `s.role` gains `story` (a two-sentence `원하는 모습` about the medical-AI company), `seenStageK: 1`
(matching the seeded stage so no overlay fires on demo entry) and two AI-stated verdicts a month apart —
`probability: 30` dated today, `probability: 20` dated `shiftDay(today, -29)`, both `stageK: 1`/`stageN: 9`,
`source: "ai"`. Stage 1 reads `deals_active 1/1` met and `payment_paid 'deposit' 0/1` unmet →
`stageProgressOf(demo)` = `{ pct: 50, journey: 6, k: 1, n: 9 }`; the headline reads `단계 1/9 계약 기반 개발자 ·
진행 50%` with the caption `AI 추정 확률 30% · {today}`; the advice sheet's delta line reads `확률 20% → 30%` ·
`단계 1 → 1` · `진행 50% · 전체 6%`; the reader's tenth section reads `롤모델 판정 · 마지막 {today} · 0일 지남 ·
AI 추정 확률 30% · 단계 1/9`. The demo role verdict packet measures **2,434 chars**. `stageLine(rs)` is unchanged
at `롤모델 1/9단계 · 조건 3/14 · 전환 조건 미충족 (0/1)`.

Measured on synthetic heavy fixtures: 12 five-condition stages with long arguments trim story 2,000 → 1,000 and
drop the condition lines, ending at **3,376 chars** with 12 stage lines; 260 forty-char areas (untrimmable by the
reductions that touch stages and the story alone) run the whole chain (story → 500, condition lines dropped,
stage lines → 0) and stay at **16,325 chars**, because the header, the CV, the grades, the certificates, the
counts and the last verdict are never dropped.

## Direction (방향) advice (`RoleAdviceModal`)
`방향 제안 — {role.name}` opens on the per-area requirement lines and segmented bars (above), followed once by the bar-legend paragraph `칸 하나 = 등급 한 단계, 칸 너비 = 그 단계의 비중. 하위 등급은 좁고 상위 등급은 넓어, 상위 승급 없이는 근접도가 오르지 않습니다. 롤모델 요구에 없는 영역의 활동은 반영되지 않습니다.` — rendered once under the bars rather than repeated at the end of each branch below (2026-09-15; it sat there, once per branch, while this modal was reached from the growth tab). Then, per area with `gap > 0`: `{RANKS[have].name} → {RANKS[need].name} · {gap}단계`, `다음 관문: {RANKS[have + 1].name} 승급 — 이 영역의 성취·증거가 필요합니다.`, a `JOB_FIELDS` toggle row that edits `area.dir` (intersection rule, [Rule 15](core-beliefs.md#rule-15)), then up to 4 certifications from `areaCatHints(state, area).cats` with `gain = round(certGainOf × jw.mult / 10) × 10` (gain 0 dropped; sorted by multiplier desc, then D asc) and, when the area hints an exam, up to 3 next bands above the current best `p`. No match → `매칭되는 표준 성취가 없습니다 — 이 영역은 프로젝트·실적 증거로 승급을 진행하세요.`; every gap closed → `모든 요구 영역을 충족했습니다. 근접도 {match}%.`

## Streak and shields (`applyDailyTick`, `completeTask`)
`act = { streak, lastActive, shieldMonth: "YYYY-MM", shieldsLeft }`, starting at streak 0, `lastActive: null`, `shieldsLeft: 2`.
```
applyDailyTick(s):        // on load after migrate, and inside freshState
  if (act.shieldMonth !== monthStr()) { act.shieldMonth = monthStr(); act.shieldsLeft = 2 }
  s.lastTick = dstr()
```
Nothing else happens on a tick — time never lowers the streak. The judgement lives in `completeTask`, once per day (`lastActive !== today`):
```
lastActive === shiftDay(today, -1)                     → streak += 1
lastActive === shiftDay(today, -2) && shieldsLeft > 0  → shieldsLeft -= 1; streak += 1; shield = true
otherwise                                              → streak = 1
lastActive = today
```
A consumed shield appends ` · 보호권 사용` to the completion toast (`완료 · 🎯 {goal} {from}→{to}%` or `완료 · 목표 기여 없음 · 🔥 {streak}일`). The home header shows `🔥 {streak}일` and `🛡 {shieldsLeft}`; during a gap the previous streak stays on screen until the next completion recomputes it. `lastTick` and `dModel` are written by `migrate`, `applyDailyTick` and `freshState` and read nowhere.
