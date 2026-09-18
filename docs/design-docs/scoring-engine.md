# Scoring engine — difficulty, points, certifications, exams
<!-- src: SPEC-5 -->

Everything the app pays out comes from one number: raw difficulty D (0–100), calibrated against market evidence and frozen ([Rule 6](core-beliefs.md#rule-6)). Points follow from D by a fixed formula, grade letters follow from D by fixed cuts ([Rule 5](core-beliefs.md#rule-5)), and payouts are pure — no multipliers, bonuses or caps beyond the ones named here ([Rule 1](core-beliefs.md#rule-1)). Job weighting, which applies to certifications only, is specified separately in [job-weighting.md](job-weighting.md).

## Difficulty and points

`DIFFS` — the difficulty a person picks when creating a 실행 (task):

| diff | pts | label |
|---|---|---|
| E | 10 | `30분 내 가벼운 일` |
| D | 25 | `반나절, 집중 필요` |
| C | 60 | `며칠~1주 작업` |
| B | 150 | `몇 주 이상 큰 도전` |
| A | 400 | `인생 이벤트 (취득·출시·계약)` |

```js
EVIDENCE_MIN = 150
certP(d)         = Math.round(0.2 * d * d / 10) * 10      // certification/exam D → base P, rounded to 10
achGrade(d)      = d >= 82 ? "A" : d >= 65 ? "B" : d >= 50 ? "C" : d >= 35 ? "D" : "E"
certGrade = examGrade = achGrade                          // aliases, one grade scale
legacyCertGrade(s) = s >= 550 ? "A" : s >= 250 ? "B" : s >= 100 ? "C" : s >= 50 ? "D" : "E"
scoreTier(s)     = s >= 400 ? "A" : s >= 150 ? "B" : s >= 60 ? "C" : s >= 25 ? "D" : "E"
gFromD(d)        = d >= 82 ? 5 : d >= 67 ? 4 : d >= 55 ? 3 : d >= 40 ? 2 : d >= 25 ? 1 : 0
needsEvidence(q) = q.isCert || q.isExam || (q.pts ?? DIFFS[q.diff].pts) >= EVIDENCE_MIN
```

`certP` samples: D22 → 100, D33 → 220, D48 → 460, D57 → 650, D67 → 900, D75 → 1130, D83 → 1380, D100 → 2000.
`legacyCertGrade` is the badge for certifications stored without a `certD` and the trophy tier of a plain task at 150 P (C) or 400 P (B). `scoreTier` sets the `diff` of a milestone task from its payout (`band.p` or `certP(d)`): `scoreTier(900) = A`. `gFromD` maps a held qualification to a starting 등급 (grade) during onboarding.

**Four different letter scales use the same letters.** Read the symbol, not the letter: ① task difficulty `DIFFS` E–A (10–400 pts) · ② achievement grade `achGrade` E–A (D cuts 82/65/50/35) · ③ job-fit tier S/A/B/C (`TIER_MULT` 1.0/0.8/0.5/0) · ④ band evidence confidence `conf` A/B/C, which is displayed only and never calculated with.

`DIFF_RAW_VERSION` (`"1.3"`) is stored on the state as `dModel` so a save records which D table paid it.

## Certifications (`CERTS`)

1,011 rows of `{ n, d, c, l, sg?, st? }` across 15 categories (`CERT_CATS`). Full table and statistics: [../generated/cert-table.md](../generated/cert-table.md) (D min 20, max 100, mean 52.37; grades E 211 / D 288 / C 288 / B 113 / A 111). `st` is informational — the code never reads it.

V1.3 (2026-09-06) added 807 currently issued national qualifications: every level of the national technical qualifications, national professional qualifications and licences. Derived and education-only issuance, temporary licences and restricted-scope duplicates were excluded. D came from three independent lenses (pass rate and eligibility / anchor comparison / preparation time and prerequisites) reduced to a median, then adversarially verified per batch (grade band, position against anchors, lens spread, ladder monotonicity). Existing D values did not move.

Renames applied without touching D: 웹디자인기능사 → 웹디자인개발기능사 (2025-01-01), 용접기능사 → 피복아크용접기능사 (2023-01-01), 정보처리기능사 → 프로그래밍기능사 (2026-01-01), 전자계산기조직응용기사 → 컴퓨터시스템기사 (2026-01-01, merged with 전자계산기기사). Renames whose effective date has not arrived (2027-01-01 and 2028-01-01) are not applied. Medical specialist licences remain unlisted because the D scale is capped at 100 (변호사).

### Stage groups (`sg`) — pay the difference only
80 groups tie the grade ladder of one qualification together; the 기능사 / 산업기사 / 기사 / 기술사 series is deliberately **not** a ladder. Per-group members are listed in the generated table.

```js
certGainOf(state, c) = !c.sg ? certP(c.d) : Math.max(0, certP(c.d) - (state.certBest[c.sg]?.p || 0))
```
`certBest[sg] = { p, name, d }` where `p` is the pre-multiplier `certP`. It is updated on completion when the new `cp` exceeds the stored `p`, and prefilled during onboarding from the highest qualification held in each group. Examples: 컴퓨터활용능력 2급 (D36, 260) → 1급 (D52, 540) pays 280; CFA Level I → II → III → Charterholder pays 260 / 240 / 160; 응급구조사 2급 (D33) → 1급 (D57) pays 430. 조산사 and 전문간호사 are parallel branches with no mutual prerequisite but share the 간호사 ladder, paying the difference from the best record held (revisit tracked in the backlog).

### Payout chain (`completeTask`)
```js
cp      = certD != null ? certP(certD) : (pts ?? 0)
prevP   = sg ? (certBest[sg].p || 0) : 0
basePay = Math.max(0, cp - prevP)
pay     = jw ? Math.round(basePay * jw.mult / 10) * 10 : basePay     // jw = jobWeightForCert(...)
certBest[sg] ← { p: cp, name, d }                                    // when sg && cp > stored p
```
The achievement text reads `{title} — D{d} · +{pay}P (단계 차액) · 직무 {tier} ×{mult} ({field} 기준·교집합)`, keeping only the parts that apply. A trophy is stored as `{ kind: "ach", label: title, tier: achGrade(certD) ?? legacyCertGrade(cp) }`. Every `cert` KR whose title contains the certification name is marked done, in every goal, regardless of `goalId`.

The same weighted formula is used for display in `AddTaskModal` and `RoleGradeSection` (the `롤모델` screen's `영역 등급` section, `RoleAdviceModal`'s body until 2026-09-18) (`Math.round(certGainOf * (jw?.mult ?? 1) / 10) * 10`); `CatalogModal` shows the unweighted figure.

Duplicate protection: adding a certification task is refused when a task with the same title already exists, completed or not. Payment happens once per qualification, independent of 영역 (area) — the toast says `{title} — 이미 등록된 자격입니다. 자격 지급은 영역과 무관하게 1회입니다.`

## Exams (`EXAMS`)

17 families of `{ id, n, lang, cat, sk, bands: [[label, d, p, conf]] }` — 10 English, 2 Japanese, 1 Chinese, 4 academic — with 115 bands in total. Full listing: [../generated/exam-table.md](../generated/exam-table.md). Band `p` equals `certP(d)` for 113 of the 115 bands; TOEIC L&R 850 (D 65, P 840 against `certP(65) = 850`) and OPIc NM (D 25, P 120 against `certP(25) = 130`) differ. The table values are authoritative and frozen ([Rule 6](core-beliefs.md#rule-6)).

Skill buckets `sk`: languages use RL (reading/listening), S (speaking), W (writing); academic exams use their own name, so they never overlap. `LANG_KO` maps `English` → `영어`, `Japanese` → `일본어`, `Chinese` → `중국어`. `DIM_STEPS = [1, 0.7, 0.5, 0.3]` is the decay by overlap count 0/1/2/3+.

Bands are stored as snapshots: the task and the KR carry `band { label, d, p, conf }` verbatim, and `exams.best[famId] = { label, d, p, ver: POINT_POLICY_VERSION, date }`. Already-paid achievements are never rescored ([Rule 4](core-beliefs.md#rule-4)).

**Exam score (2026-09-16, schema v22) — display only.** `exams.best[famId]` gains an optional `score` — the exact figure the score report stated, entered in `EvidenceModal` and validated by `examScoreError` (inside the milestone's band, at most the family's scale maximum, [evidence-and-promotion.md](evidence-and-promotion.md)). `calcExamPayout`, every field above (`label`, `d`, `p`, `ver`, `date`) and the `q.band.p > prevBest.p` replacement test are byte-identical to before this change — `score` is merged in as an extra field under the same replacement condition, never read by the payout chain ([Rule 1](core-beliefs.md#rule-1), [Rule 2](core-beliefs.md#rule-2)). One addition to the replacement logic: a same-band retake (`q.band.p === prevBest.p`) that would otherwise pay 0 and touch nothing now updates only `best.score` — via `examScoreBetter`, which for a numeric family requires a strictly higher figure and for a level family (`opic`/`cambridge`/`jlpt`/`hsk`, free text) always accepts the newer entry — leaving `label`, `d`, `p`, `ver` and `date` exactly as they were. A lower band still never touches `best` at all. Display: `examBestText(id, b)` reads `{name} {score}` when a score exists, else `{name} {label} 구간`; it is the only reader of `score` besides `AchievementWallModal`'s ` · 점수 {score}` suffix and `TaskDetailModal`'s `점수` row ([home.md](../product-specs/home.md), [tasks.md](../product-specs/tasks.md)). A save from before v22 has no `score` anywhere and shows the band label as it always did.

### `calcExamPayout(exState, fam, band)` — pure
1. `diffP = max(0, band.p − (best[fam.id]?.p || 0))` — an upgrade in the same family pays only the difference; an equal or lower band pays 0.
2. If `dim[fam.id]` is already defined, use it unchanged. The multiplier is **locked at first registration** ([Rule 2](core-beliefs.md#rule-2)); below 1 the reason reads `등록 시 고정된 감쇠`.
3. Otherwise: `lang === "Academic"` → 1. For a language, count the families already in `dim` for that language whose `sk` overlaps this one; `mult = DIM_STEPS[min(overlap, 3)]`, with the reason `{언어} 스킬 중복 {n}회째` when overlap is non-zero.
4. Specialisation floor: `spec[lang] && band.d >= 70 && mult < 0.7` → `mult = 0.7`, reason `전문화 하한 70% 보장`.
5. Returns `{ payout: Math.round(diffP * mult), mult, prevP, prevLabel, reason }`.

### Caller responsibilities (`completeTask`, and the onboarding prefill)
Store `r.mult` into `dim[famId]` only when it was undefined (that is the lock) → update `best` when `band.p` exceeds the stored `p` → achievement text `{fam.n} {label} — D{d} · +{payout}P (감쇠 ×{mult})` → trophy `{ kind: "ach", tier: examGrade(d) }` → specialisation check: for a non-academic language with `!spec[lang]`, if `best` holds at least two entries of that language at D ≥ 75, set `spec[lang] = true`, add the trophy `{언어} 전문화`, raise the area named `어학` to grade 5 if it is lower, log the achievement `🎖 {언어} 전문화 — 고난도 시험(D75+) 2종 달성`, and show the toast `🎖 {언어} 전문화 — 고난도 감쇠 하한 70% 적용` after 2,700 ms → the ACHIEVEMENT overlay.

Specialisation **forms** at D ≥ 75 while the 70 % floor **applies** from D ≥ 70; the two cuts differ by design.

The onboarding prefill runs the same calculation but discards `payout`, recording only `dim` and `best` — held qualifications and scores do not pay. `examBandGain(state, fam, b)` is the display-only wrapper.

KR progress for an exam KR: `krProgress = min(1, best.p / (band.p || 1))`; the remaining-text helper shows `미응시`, `달성`, or `{band.p − best.p}P 남음`.

## Role stages (v28) — a stated no-op

`role.stages`'s `cert_held` condition type reads `heldCertsOf(state)` (the same held-certification list the CV
and `RoleGradeSection` already read) to test whether a named certification is held; every other condition type
reads `bizSummary`, `dealPhase`, `state.folio`, `state.milestones`, `state.leads` or `state.notices`. None of
this touches `calcExamPayout`, `certGainOf`, `jobWeightForCert`, `computeGrades` or any D value, grade cut or
payout — the stage model is a second, independent number beside `roleGap`, never merged into it
([Rule 14](core-beliefs.md#rule-14)), and is fully specified in
[metrics-and-role-model.md](metrics-and-role-model.md#role-stages-v28).
