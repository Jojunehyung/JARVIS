# Role model and streak
<!-- src: SPEC-5 -->

The recommendation logic behind 방향 제안 (direction advice) lives in `roleRecommendations`, shared with the daily briefing ([assistant-bridge.md](assistant-bridge.md)).

Two numbers describe the person behind the areas (영역): role-model (롤모델) proximity `roleGap`, and the streak with its streak shields (보호권) in `act`. Proximity is derived from area grades and never stored ([Rule 9](core-beliefs.md#rule-9), [Rule 14](core-beliefs.md#rule-14)). Field shapes: [../generated/db-schema.md](../generated/db-schema.md).

**2026-09-11:** the life-metric triple this file used to document (`metrics.asset / infl / body`, its automatic gain from achievements/promotion/goal completion, and its manual check-in) was removed by the user's decision, store and all (schema v19 drops `metrics` and `act.lastCheckin`) — see the [decision log](decision-log.md) and [Rule 8](core-beliefs.md#rule-8). What it claimed to track belongs to a goal's metric KR instead.

## Role-model proximity (`roleGap`)
`role = { name, targets{areaId: 1–8} } | null`. The `roleEdit` sub-screen (`RoleModelModal`, reached through the `롤모델` screen's `세부 수정 ›`) offers a free name (empty → `롤모델`) and, per area, `제외` (0) or a required grade from 견습 (1) to 거장 (8) — 정점 (9) cannot be required. **`ROLE_PRESETS` was removed 2026-09-18** (second change of the day) along with the chip row that picked one; see [The role screen](#the-role-screen-2026-09-18-second-change-of-the-day) below.
```
items = areas.filter(a => targets[a.id] > 0)
             .map(a => ({ area: a, need: targets[a.id], have: a.grade, gap: max(0, need - have) }))
match = round(mean(min(1, have / need) ** 2) * 100)      // null when role is null or items is empty
```
Overshoot is capped at 1. One grade short: need 5 / have 4 → 64 %, need 3 / have 2 → 44 %, need 8 / have 7 → 77 %, need 4 / have 3 → 56 % — the "about 70 %" of [Rule 14](core-beliefs.md#rule-14) describes the shape, not a constant. Demo: `완성차 1차사 하네스 설계 책임` with targets {직업·커리어 6, 기본지식 4} against grades 3 and 2 → 25 %. Proximity depends only on area grades, so it moves at promotion (or the `어학` specialisation jump); a certification payout by itself does not change it.

`롤모델 근접도` is the small line under the CV on home (2026-09-15, [home.md](../product-specs/home.md); it led the growth tab's headline before the tab was removed): `롤모델 근접도 {match}% · {name} ›`, a button into the `롤모델` screen (`RoleModal`, 2026-09-18) — or, without a usable role, the inert line `롤모델 미설정 — 근접도 계산 대상 없음`. The number and its formula are unchanged. The segmented bar — one cell per required grade, width `((k + 1) / need)² − (k / need)²` × 100 %, filled while `k < min(have, need)`, next to `{RANKS[have].name} / 요구 {RANKS[need].name} · {gap}단계 부족` or `· 충족` — renders at `h-2` with no surrounding card as the first block of `RoleGradeSection`, collapsed by default under the screen's `영역 등급` section (see below); the paragraph explaining how to read it sits once underneath, not repeated per branch.

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

**The seed, without the preset.** `ROLE_PRESETS` (which briefly gained a fifth entry, `의료 AI 솔루션 대표`) and
the chip row that picked one were both removed 2026-09-18 (second change of the day) — see
[The role screen](#the-role-screen-2026-09-18-second-change-of-the-day) below. `ROLE_STAGE_SEED` itself stays:
the `roleEdit` sub-screen's stages header now carries a single button, `기본 9단계 채우기`, which after
`window.confirm("단계를 기본 9단계로 바꿔요. 계속할까요?")` when stages already exist replaces `role.stages` with
`seedStages()` — `ROLE_STAGE_SEED` mapped with a fresh `id` — and no longer touches the role's name. The seed is a literal array dated 2026-09-17, from
the user's own situation (see [decision-log.md](decision-log.md)): a contract-based developer → task-expansion
negotiation → a detailed sub-contract → an AI delivery registered as a portfolio item → hospital sales begun →
the first hospital contract → repeat revenue (**stage 7's `monthly_revenue` threshold, 5,000,000 won, is a draft
the caller left open and the user edits in the stage editor**) → a national-project proposal submitted → a
national project won, the quit condition. `condValue`'s evaluator choices the plan left open: `notice_status`
and `leads_stage` both read "every record" without a usable `arg` (not merely for leads, as first drafted);
`cert_held` without an `arg` reads 0; the three title-matching types (`deals_won`, `deals_active`,
`milestone_done`) are case-sensitive, unlike `folio_match`; `monthly_revenue` ignores an `arg`.

### The stages editor (v28)
Inside the `roleEdit` sub-screen (`RoleModelModal`, reached through the `롤모델` screen's `세부 수정 ›` — before
2026-09-18 this same editor was reached directly from `설정` → `롤모델 설정`/`롤모델 수정`), below the target-area
rows: `SectionLabel`
`단계 (선택)` with a mono `{n} / 12`. One card per stage (`bg-zinc-950 border border-zinc-800 rounded-xl p-2.5
space-y-1.5`): a mono `{i}단계` tag, a name input (`placeholder="단계 이름 — 예: 첫 병원 계약"`, `aria-label="단계
이름"`, `maxLength` `ROLE_STAGE_NAME` 40, no length refusal), a remove `X` (`aria-label="단계 삭제"`); one row per
condition — a `type` select (`aria-label="조건 종류"`, options = `COND_TYPES` labels), a text input (`aria-label="조건
값"`, placeholder = the type's argument hint or `조건 값 없음`, disabled and its value cleared when the hint is
empty), a number input (`aria-label="기준"`, `font-mono`, `w-16`) and a remove `X` (`aria-label="조건 삭제"`); a
button `조건 추가`, disabled at 5 with `조건은 단계당 5개까지예요.` Under the cards, `단계 추가` (a new stage
starts as `계약 체결 수` with threshold 1), disabled at 12 with `단계는 12개까지예요.` Caption: `조건은 앱의
기록으로 계산돼요 — 근접도와는 별개예요.` Declining the `기본 9단계 채우기` confirm keeps the existing stages
and the role's name untouched (the button no longer sets a name, 2026-09-18); switching a condition to a
hint-less type clears its argument on the spot, and saving drops the argument of such a type as well. Save refusals: `단계 이름을 입력해 주세요 — {k}번째 단계` and `기준은 0 이상
숫자예요 — {k}단계 {j}번째 조건`. Saving writes the name, the target areas and, when at least one stage remains,
`stages` shaped `{ id, name, conds: [{ type, arg?, min }] }` — every other write path (`role.targets`) is
unchanged; removing every stage stores no `stages` key at all, and the CV's stage line and button disappear with
it.

### The advice modal's stage block (superseded 2026-09-18)
This block — a `SectionLabel` `단계`, a headline `{k}/{n}단계 · {stage name}`, one mono line per condition of the
current stage, `다음 마일스톤: {milestoneLine}` and `로드맵 열기 ›` — shipped inside `RoleAdviceModal`, after the
proximity bars and legend, on 2026-09-17. `RoleAdviceModal` no longer exists (second change of 2026-09-18): the
storyline itself — every stage, not only the current one, with per-condition bars and a `지금 할 것` landing per
unmet condition — is now the `롤모델` screen's `스토리라인` section (`RoleModal`, below), and the `사업` area's
gap block inside `RoleGradeSection` still uses `RoleStageLines` for the same stage lines under the `다음 관문:`
line described here — the certification/exam block every other area shows is still **replaced** by them for
`사업` when stages exist; the `JOB_FIELDS` toggle row is unaffected and stays for every area, `사업` included.
Every other area's advice is unchanged.

### The briefing's next-step tail
`buildBriefing`'s `다음 단계` line: when the first gap's area is named `사업` **and** stages exist, the tail
becomes `다음: {stage}단계 {name} · 조건 {c}/{m}` (or `다음: 전환 조건 충족` once every stage is met) — stage
numbers, a name and counts only, so nothing a day-job or private record names can reach the daily packet through
this line. Without a `사업` gap, or without stages, the tail is the existing certification-recommendation text,
byte-identical. See [assistant-bridge.md](assistant-bridge.md).

`growth.md` (the retired tab's content map) carries one added row pointing here for the stages editor and the
advice modal's stage block, since both now live behind `설정` and the CV rather than the old growth headline.

## The story, the verdict and stage progress (2026-09-18)

This section describes the story/verdict fields as they shipped this same day, before the `롤모델` screen
rewrite a few hours later; see [The role screen](#the-role-screen-2026-09-18-second-change-of-the-day) below for
where each surface named here lives now (`RoleModelModal` → the `roleEdit` sub-screen, `RoleAdviceModal` →
`RoleModal`/`RoleGradeSection`) — every number and packet stays byte-identical across both changes.

Schema stays **v28** — `role` gains three optional fields, none backfilled, the same "no migration" shape as the
v26 memo/transcript change ([state-lifecycle.md](state-lifecycle.md)): `story?` (≤ `ROLE_STORY_MAX` 2,000 chars,
the user's own `원하는 모습`, written that day in `RoleModelModal`'s new first section and, since the role-screen
rewrite, in `RoleModal`'s `원하는 모습` section instead — the stages editor moved with it into the `roleEdit`
sub-screen, labelled `세부 수정 ›`), `verdicts?[{ id, date, probability?, summary, basis, position, gaps[], stageK, stageN,
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

Opened from the `롤모델` screen's (`RoleModal`, since the role-screen rewrite — originally `RoleAdviceModal`'s)
`AI에게 판정 묻기 ›` button (`modal.type: "roleVerdict"`, `roleVerdict` 39th value), disabled until `role.story`
is set, with the caption `먼저 원하는 모습을 적고 저장해요 — 적은 글이 패킷에 실려요.` (reworded with the story
section 2026-09-18, second change; the sheet itself is unchanged below). Three steps sharing `PacketSendPane` / `ReplyPastePane` / `copyPacket` with the other bridge
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
while `journey` would blur which condition moved and is printed on the `롤모델` screen only, never on the CV
(the timeline's journey line, `전체 {journey}% · 전환 조건 {충족|미충족}`, and, when a `사업` grade gap exists,
once more inside that gap's `RoleStageLines` block — never twice on the same line, and never the CV headline).
Both are derived at render, never stored
([Rule 9](core-beliefs.md#rule-9)); the stage progress percentage is a second figure beside `roleGap`'s
proximity, under its own label, never merged, averaged or weighted with it
([Rule 14](core-beliefs.md#rule-14)). `condRatio(r)` (a threshold of 0 met by definition, past the threshold
capped at 1) is the one top-level helper both `stageProgressOf` and `RoleStageLines`'s per-condition bars read.

The `HomeTab` headline (`단계 {k}/{n} {name} · 진행 {pct}%` with a cyan bar, `title={stageLine(sp.rs)}`, opening
the `롤모델` screen — `onRole`, `{ type: "role" }`, since the role-screen rewrite; originally `RoleAdviceModal`)
renders **above** the unchanged proximity line, with the newest verdict's caption
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

This described `RoleAdviceModal`'s `AI 판정 기록` block as it shipped that day; since the role-screen rewrite
(below) the newest verdict is its own card under section 1's CTA and the history sits behind
`판정 기록 {n}건 ›`/`판정 기록 접기`: the delta line `확률 {a} → {b} ({date a} → {date b}) · 단계 {ka} → {kb}`
between the two newest, then the list newest first (label, `probText` + `단계 {k}/{n}`, the summary only — the
newest entry's basis, position and gaps are already on the card above it, so the list itself never repeats
them). The list renders at most `ROLE_VERDICTS_MAX` entries (the store's own cap) — no further UI cap.

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
진행 50%` with the caption `AI 추정 확률 30% · {today}`; the screen's delta line (behind `판정 기록 2건 ›`) reads
`확률 20% → 30%` · `단계 1 → 1` · `진행 50% · 전체 6%`; the reader's tenth section reads `롤모델 판정 · 마지막 {today} · 0일 지남 ·
AI 추정 확률 30% · 단계 1/9`. The demo role verdict packet measures **2,434 chars**. `stageLine(rs)` is unchanged
at `롤모델 1/9단계 · 조건 3/14 · 전환 조건 미충족 (0/1)`.

Measured on synthetic heavy fixtures: 12 five-condition stages with long arguments trim story 2,000 → 1,000 and
drop the condition lines, ending at **3,376 chars** with 12 stage lines; 260 forty-char areas (untrimmable by the
reductions that touch stages and the story alone) run the whole chain (story → 500, condition lines dropped,
stage lines → 0) and stay at **16,325 chars**, because the header, the CV, the grades, the certificates, the
counts and the last verdict are never dropped.

## The role screen (2026-09-18, second change of the day)

One screen, `롤모델` (`RoleModal`, `modal.type: "role"`), replaces both `RoleModelModal`'s and `RoleAdviceModal`'s
user-facing roles the same day the story/verdict change above shipped, folding the grade gaps away and moving
the manual editor one tap behind `세부 수정 ›`. Opened from the profile card's stage headline and proximity
line, the settings `롤모델` button, the daily reader's `롤모델 판정` section and the daily briefing's `다음 단계`
line — every one of those five entry points now lands on `{ type: "role" }`; `roleAdvice` is retired
(`modal.type` stays **39**: `roleAdvice` out, `roleEdit` in). Read top to bottom:

1. **`원하는 모습`** — three tap-to-fill template chips (`ROLE_STORY_TEMPLATES`, below), the story textarea
   (unchanged: `aria-label="원하는 모습"`, `rows={5}`, `maxLength={ROLE_STORY_MAX}`, the mono counter, the
   privacy caption), `저장` (writes `role.story` alone through `saveRoleStory`, below), the CTA
   `AI에게 판정 묻기 ›` / `다시 판정 ›` (disabled until the **saved** story exists — an unsaved edit does not
   enable it, since the packet reads what is saved) with the newest verdict card beneath it, and
   `판정 기록 {n}건 ›` behind which the delta line and the summary-only history sit (moved verbatim from
   `RoleAdviceModal`'s `AI 판정 기록` block — [Verdict history](#verdict-history-and-the-delta-line) above).
2. **`스토리라인`** — a vertical timeline over `stageProgressOf`'s `rs.stages`: a done stage (`i + 1 < rs.k`)
   compacts to one row ending `충족` (no date stored — rule 9); the current stage (`i + 1 === rs.k`) expands to
   a cyan-bordered card with its progress bar, `지금 할 것` (one `- {condText}` line and bar per condition,
   emerald when met, rose when unmet, and — only when unmet — a `ROLE_COND_ACTIONS[type].label` button, below)
   and `이 단계의 업무` (`stageWorkOf`, below); an upcoming stage is a peekable one-line row,
   `조건 {n}개 ›`/`▾`. Below the list: the journey line `전체 {journey}% · 전환 조건 {충족|미충족}`, the
   next-milestone line (`RoleStageLines`'s own text) and `로드맵 열기 ›`. Without stages:
   `단계 없음 — AI 판정에서 단계를 받거나 세부 수정에서 직접 적어요` plus the verdict CTA and `세부 수정 ›`.
3. **`영역 등급`** — `RoleGradeSection` ([Direction advice](#direction-방향-advice--rolegradesection-inside-the-롤모델-screen-2026-09-18)
   below), collapsed by default behind `펼치기 ›`/`접기`, a one-line summary always visible.

**Footer**: `세부 수정 ›` (→ the `roleEdit` sub-screen, always present) and, only when `state.role` exists,
`롤모델 초기화` (rose, → `resetRole`, below).

### Story templates — `ROLE_STORY_TEMPLATES` / `storyWithTemplate`

Three static, hand-written templates (취업/창업/전문가) a chip inserts or appends — never writes state; only
`저장` does. `storyWithTemplate(story, tpl)` inserts the template when the trimmed story is empty, otherwise
appends `"\n\n" + tpl`; the result is clipped to `ROLE_STORY_MAX` (2,000). A chip never overwrites the user's
own text.

| Chip | Template |
|---|---|
| `취업` | `[회사] [직무]로 [시기]까지 입사하고 싶어요. 지금은 [현재 상황]이에요.` |
| `창업` | `[시기]까지 [분야] 회사를 세워 [규모] 규모의 대표가 되고 싶어요. 지금은 [현재 상황]이에요.` |
| `전문가` | `[분야]에서 [수준]의 전문가로 인정받고 싶어요 — [기준, 예: 연봉·직급·자격]. 지금은 [현재 상황]이에요.` |

### `ROLE_COND_ACTIONS` — one landing per condition type

The place each condition type is changed — a business view (with the add modal that opens over it) or the
certificate catalogue, navigation only, nothing here completes, pays or promotes (rules 10, 11):

| `type` | Label | Landing |
|---|---|---|
| `deals_won` | `계약 추가 ›` | `사업` tab, `deals` view, `DealModal` open |
| `deals_active` | `계약 추가 ›` | same |
| `monthly_revenue` | `계약 추가 ›` | same |
| `payment_paid` | `계약 목록 ›` | `사업` tab, `deals` view, no modal |
| `folio_match` | `포트폴리오 추가 ›` | `사업` tab, `folio` view, `FolioModal` open |
| `milestone_done` | `로드맵 열기 ›` | `사업` tab, `roadmap` view, no modal |
| `leads_stage` | `리드 추가 ›` | `사업` tab, `leads` view, `LeadModal` open |
| `notice_status` | `공고 추가 ›` | `사업` tab, `notices` view, `NoticeModal` open |
| `cert_held` | `도감에서 찾기 ›` | `CatalogModal`, `initialQuery` seeded with the condition's `arg`, `initialCat` from `certByTitle(arg)?.c` |

`cert_held` cannot create the certification task itself — that path is the goal's KR ([Rule 19](core-beliefs.md#rule-19)); the button only finds the name in the catalogue ([TD-88](../exec-plans/tech-debt-tracker.md)). `payment_paid` lands on the deal list, not a specific payment line ([TD-87](../exec-plans/tech-debt-tracker.md)).

### `stageWorkOf(state, today, k)`

Undone work items linked to stage `k`'s milestones, in `workOn`'s carried-first order — derived at render, never
stored ([Rule 9](core-beliefs.md#rule-9)): `(state.milestones || []).filter(m => m.stage === k)` collects their
`workIds`, and the result filters `workOn(state, today, today)` to undone items in that set. A done linked item
drops out; a dangling `workIds` id is skipped since it names no row in `workOn`'s output.

### Root handlers

`saveRoleStory(story)` writes `role.story` alone (creates `{ name: "롤모델", targets: {}, story }` when `role`
is null; deletes the key on an empty trim) — never `stages`, `targets`, `verdicts` or `seenStageK`; toast
`원하는 모습 저장 · {n}자` / `원하는 모습 지움`. `resetRole()` deletes the whole `role` record on
`window.confirm("롤모델·단계·판정 기록을 모두 지워요. 계속할까요?")` — name, targets, stages, story, verdicts,
seen-stamp — closes every modal and toasts `롤모델 삭제 — 근접도·단계 계산 대상 없음`; this is the one handler
the exec plan flagged for the user under AGENTS.md §4 (a handler that deletes user data), approved once.
`goRoleAction(c)` reads `ROLE_COND_ACTIONS[c.type]`, closes the current modal, and either opens the catalogue
(the certificate path) or switches the business view/tab and opens the condition's add modal — it writes nothing
beyond `ui.bizView` (through the existing `setBizView`).

Every role write now returns to the screen, not to nothing: `saveRole` (the `roleEdit` sub-screen's save),
`importRoleVerdict` and `RoleVerdictModal`'s close all `setModal({ type: "role" })`.

### The `roleEdit` sub-screen

`RoleModelModal`, title `롤모델 세부 수정`, reached only through `세부 수정 ›`. Presets and the story field are
both gone (see [The seed, without the preset](#role-stages-v28) above); the name input is first
(`placeholder="롤모델 이름 (예: 연 매출 1억 1인 사업가)"`), then the target-area rows, then the stages editor —
unchanged except its header gains `기본 9단계 채우기` (above). `saveRole`'s write guard changed to
`if ("story" in rm) { if (rm.story) next.story = rm.story; else delete next.story; }`, so a sub-screen save —
which never carries `story` in its payload — leaves `role.story` untouched; the sub-screen's close and its save
both return to `role`.

### The profile card's third state

When `state.role` exists but `roleGap` is null — a story saved with no requirement grades, now a normal state
since the story is saved before any grade is set — the CV's inert `<p>` becomes a button:
`근접도 계산 대상 없음 — 세부 수정에서 요구 등급을 정해요 ›`, opening `role`. Without any `role` the `<p>`
`롤모델 미설정 — 근접도 계산 대상 없음` stays, unchanged.

### What did not change

Every number — `roleGap`, `stageProgressOf`, `roleStageOf`, `roleRecommendations`, `roleVerdictDue`,
`condValue`/`condText`/`condRatio` — and the four bridge packets and the briefing text stay byte-identical;
`buildBriefing` and `buildReader` differ from before only in the action object they route to
(`{ type: "roleAdvice" }` → `{ type: "role" }`). No schema change (v28 stays); `modal.type` count stays 39. E2E:
`tools/e2e/flow*.js` written to **255** `await step(` calls, parsed (`node --check`), **not executed** — see
[RELIABILITY.md](../RELIABILITY.md).

## Direction (방향) advice — `RoleGradeSection`, inside the `롤모델` screen (2026-09-18)
Formerly `방향 제안 — {role.name}`, its own sheet (`RoleAdviceModal`, retired 2026-09-18, second change of the day). Its JSX moved **verbatim** into a module-level component, `RoleGradeSection({ state, today, onOpenCatalog, onSetDir })`, now rendered by `RoleModal`'s section 3, `영역 등급` — collapsed by default behind `펼치기 ›`, with a one-line summary always visible (`근접도 {match}% · 요구 영역 {n}개 · 부족 {m}개`, or `요구 등급 없음 — 세부 수정에서 정해요` without one). Content, unchanged: the per-area requirement lines and segmented bars, followed once by the bar-legend paragraph `칸 하나 = 등급 한 단계, 칸 너비 = 그 단계의 비중. 하위 등급은 좁고 상위 등급은 넓어, 상위 승급 없이는 근접도가 오르지 않습니다. 롤모델 요구에 없는 영역의 활동은 반영되지 않습니다.` — rendered once under the bars rather than repeated at the end of each branch below. Then, per area with `gap > 0`: `{RANKS[have].name} → {RANKS[need].name} · {gap}단계`, `다음 관문: {RANKS[have + 1].name} 승급 — 이 영역의 성취·증거가 필요합니다.`, a `JOB_FIELDS` toggle row that edits `area.dir` (intersection rule, [Rule 15](core-beliefs.md#rule-15)), then up to 4 certifications from `areaCatHints(state, area).cats` with `gain = round(certGainOf × jw.mult / 10) × 10` (gain 0 dropped; sorted by multiplier desc, then D asc) and, when the area hints an exam, up to 3 next bands above the current best `p`. No match → `매칭되는 표준 성취가 없습니다 — 이 영역은 프로젝트·실적 증거로 승급을 진행하세요.`; every gap closed → `모든 요구 영역을 충족했습니다. 근접도 {match}%.` `RoleStageLines` keeps its own signature and is called from here only, for the `사업` gap block.

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
