# New-user onboarding
<!-- src: SPEC-4-1 --><!-- src: SPEC-5 -->

`Onboarding` turns a title screen and six steps of choices into the initial state: areas with a computed starting 등급 (grade), an exam record prefilled with 어학 (language) scores, and stage-group best records. The same choices always give the same grade; afterwards an area rises only through a 관문 (gate) ([Rule 11](../design-docs/core-beliefs.md#rule-11)). Option lists, `RANKS`, and `GATE_CHIPS` are generated in [../generated/onboarding-tables.md](../generated/onboarding-tables.md); the resulting state shape is in [../generated/db-schema.md](../generated/db-schema.md).

## Flow and state
- Rendered when `phase === "onboard"` or the saved state has no `profile`; it is not wrapped in `Shell`.
- `step` is `"title"` or 0–5. State: `err`, `name`, `nick`, `birth`, `gender`, `status`, `edus` (education records), `look` `{ skin: 0, hair: 0, hairColor: 0, outfit: 0, face: 1 }`, `selected` (default `["사업", "직업·커리어", "기본지식"]`), `customs`, `customInput`, `directions` (max 3), `certSel`, `examOwnFam`, `examsOwned`, `cat`, `gradeF`, `query`, `careers` (career records), `lead`, `biz`, `output`. There is no `age`, `edu`, `majorField` or `majorName` state any more — the exact CV (2026-09-13) replaced the seven-band 연령대 chip, the six-key 최종 학력 chip and the 전공 계열/전공 이름 inputs with `birth` and the `edus[]` record list.
- `areaNames` = the selected `AREA_PRESETS` in preset order, then `customs`. `hasJob` = includes 직업·커리어; `hasBiz` = includes 사업.
- `profile` is assembled on every render as `{ name: name.trim(), nick: nick.trim(), birth, gender, status, email: "", phone: "", edus, careers, directions, look, examsOwned, certs: certSel, edu: eduKeyOf(edus), career: careerKeyOf(careers, dstr()), lead: lead ?? "no", biz: biz ?? "none", output: output ?? "none" }`, and `results = computeGrades(profile, areaNames)` is recomputed with it. `nick` is no longer defaulted to `사용자` here — `displayName` owns that fallback, everywhere a name is shown.
- Header: monospace label `PROFILE SETUP` on every screen; h1 `인생 관리` on the title screen only; six-segment progress bar on steps 0–5 (`i <= step` → `bg-cyan-400`, else `bg-zinc-800`).
- Buttons below steps 0–5: `이전` when `step > 0` (the title screen cannot be returned to); `다음` runs the step's validation and shows the error in rose text; step 5 shows `이 설정으로 시작` instead.

## Title
`OnboardingHeroSvg` · `지금 위치를 숫자로 확인하세요. 평가는 시장 기준입니다.` · button `시작하기` → step 0 · link `먼저 화면만 볼래요 — 데모 데이터로 둘러보기` → `onDemo` → `demoState()`.

## Step 0 — `1 / 6` `기본 정보`
Subtitle `입력한 학력·경력으로 시작 등급이 산정돼요.` Fields in order: name input `이름` (required) → nickname input `닉네임 (선택)` → `생년월일` label + `input type="date"` (required) → 성별 `[남성, 여성, 선택 안 함]` → 현재 신분 `STATUS_OPTS` (11) → the 학력 (education) section: an entry list (`CvEntryRow`, one row per saved entry with a remove `X`) plus one inline add form (`CvAddForm`) — 학교 이름 input `학교 이름 — 예: 한국대학교` (required), 전공·학과 input `전공·학과 (선택) — 예: 기계공학`, 학위 chip row `EDU_LEVELS` (5: 고등학교/전문학사/학사/석사/박사, required), 상태 chip row `EDU_STATUS` (6: 재학/휴학/졸업예정/졸업/수료/중퇴, required), 계열 (선택) chip row — the unchanged `MAJOR_FIELDS` (9), moved here from its own onboarding row — a `type="month"` from/to pair, and the add button `학력 추가`. Empty-list note: `학력을 1개 이상 추가해요. 최종 학력이 기본지식 시작 등급의 근거가 돼요.`

Step validation, in this order: name empty → `이름을 입력해 주세요.`; birth empty → `생년월일을 입력해 주세요.`; birth not `YYYY-MM-DD` → `생년월일 형식이 올바르지 않아요 — YYYY-MM-DD로 입력해요.`; birth after today → `생년월일이 오늘보다 뒤예요.`; gender or status missing → `성별과 현재 신분을 선택해 주세요.`; no education entry → `학력을 1개 이상 추가해 주세요.` The add-form itself (`CvAddForm`, shared with step 4 and `ProfileModal` — [home.md](home.md)) blocks *adding* an entry, separately from the step: school name empty → `학교 이름을 입력해 주세요.`; degree or status not picked → `학위와 상태를 선택해 주세요.`; end month before start month → `졸업 연월이 입학 연월보다 앞서요.`

Removed from this step: 연령대 (the seven `AGE_OPTS` chips are no longer rendered — the list stays in the source, read only by `ageText`'s legacy-band guard below); 최종 학력 (the six `EDU_OPTS` chips are gone — the list stays, read by `computeGrades` and by `eduKeyOf`); 전공 계열 (moved into the education add form as `계열 (선택)`); the `전공 이름 (선택, 예: 경영학)` input (`profile.majorName` is no longer written by a fresh onboarding and survives only on legacy saves).

## Step 1 — `2 / 6` `프로필 외형`
Preview card: `PortraitSprite` (`look`, `gender`, size 84) + `displayName({ nick, name })` + `무작위` (`randomLook`: `Math.floor(Math.random() * length)` over `SKINS` 4, `HAIR_STYLES` 5, `HAIR_COLORS` 6, `OUTFITS` 6, `FACES` 3). Note beneath the card: `사진은 시작한 뒤 프로필 탭의 프로필 편집에서 등록해요.` (updated 2026-09-16 for the renamed tab and button) — onboarding itself has no photo step; the photo is registered afterwards through `ProfileModal` ([home.md](home.md)). Controls in order: Swatch 피부 `SKINS` · Swatch 머리색 `HAIR_COLORS` · Swatch 옷 색상 `OUTFITS` · OptRow 헤어스타일 `HAIR_STYLES` (stored as `indexOf`) · OptRow 표정 `FACES`. No validation.

## Step 2 — `3 / 6` `성장시킬 영역`
Eight `AREA_PRESETS` chips toggle; custom areas render as `{c} ✕` (click removes); input `직접 추가 (선택)` + Plus button (`addCustom`: blank, a preset name, or an existing custom name is ignored; the input is cleared either way). Note: `직접 추가한 영역은 측정 항목이 없어 지망생부터 시작해요.`
When 기본지식 is selected, a box `기본지식이 향할 방향 (1~3개)` / `지금 업무와 무관해도 돼요. 앞으로 나아갈 분야를 고르면 추천과 성장 방향이 여기에 맞춰집니다.` lists the 18 `KNOWLEDGE_FIELDS` chips (`toggleDir`; a fourth pick is silently ignored).
Validation: no area → `영역을 하나 이상 선택해 주세요.`; 기본지식 selected with no direction → `기본지식이 향할 방향을 1개 이상 선택해 주세요.`

## Step 3 — `4 / 6` `보유 자격·어학` `({n}개 선택)`
Category buttons `["전체", ...CERT_CATS]` → grade buttons `[전체, A, B, C, D, E]` (`GRADE_TEXT` colours) → input `자격증 검색`. `filtered` = `CERTS` ∧ category match ∧ `achGrade(c.d)` match ∧ `c.n.includes(query)`. The list (`max-h-56`) renders at most 60 rows (`shown`), already-selected certs pinned first; a row is the grade letter + `c.n` + `c.l`, selected → `bg-cyan-500` + Check. Empty: `검색 결과 없음`; overflow: `{n}종 더 있음 — 검색어로 좁혀요`. Note: `없으면 그냥 다음으로. 취득 예정인 건 나중에 자격증 실행으로 등록해요.`
Exam box `보유 시험 성적 ({n})`: 17 `EXAMS` family buttons (click again to deselect) → the family's band chips → `examsOwned` entry `{ famId, famN, label, d, p }`, one per family (re-selecting removes the old entry and pushes the new one to the end, so registration order changes) → list rows `{famN} {label} D{d}` + X. Note: `여기 등록한 성적은 시작 기록으로 저장되고, 이후 상향 시 차액만 지급돼요.` No validation.

## Step 4 — `5 / 6` `경력·경험`
Subtitle `정직하게, 상향 없이.` The 경력 (career) section comes first — the same entry-list-plus-inline-add-form shape as step 0's education section: 회사·조직 이름 input `회사·조직 이름 — 예: 한국부품` (required), 직책·직무 input `직책·직무 — 예: 설계 엔지니어` (required), 고용 형태 chip row `EMP_KINDS` (3: 정규·계약/프리랜서·외주/인턴·알바, required), a `재직 중` toggle (clears the end month and disables its input), a `type="month"` from/to pair (`from` required unless 재직 중), and the add button `경력 추가`. Empty-list note: `경력이 없으면 비워 둬요. 직업·커리어 시작 등급은 경력 없음 기준이에요.` Beneath the list, a derived summary line: `합산 실무 {careerText(careerMonths(careers, today))} · 시작 등급 기준 {CAREER_OPTS label}` — both values are computed from the entries at render and stored nowhere. Then, unchanged: `hasJob` → 리드 경험 `LEAD_OPTS` (2); `hasBiz` → 사업 경험 `BIZ_OPTS` (7); always 산출물·포트폴리오 `OUTPUT_OPTS` (4). Neither the education nor the career section is gated on `hasJob` / `hasBiz` — a CV has both regardless of which areas were chosen; only the grade it feeds applies to an area that exists.

Step validation: `hasJob && !lead` → `리드 경험을 선택해 주세요.` (career is no longer part of this check — it is always derived from the entries, never picked); `hasBiz && !biz` → `사업 경험을 선택해 주세요.`; `!output` → `산출물 항목을 선택해 주세요.` The career add form's own validation: company or role empty → `회사 이름과 직책을 입력해 주세요.`; employment kind not picked → `고용 형태를 선택해 주세요.`; start month empty → `입사 연월을 입력해 주세요.`; end month before start month (when not 재직 중) → `퇴사 연월이 입사 연월보다 앞서요.`

Removed from this step: 직무 경력, the seven-key `CAREER_OPTS` chip row — the list stays, now read only by `computeGrades` and by `careerKeyOf`.

## Step 5 — `6 / 6` `설정 완료`
Summary card (`PortraitSprite` 60, `displayName({ nick, name })`, `{ageText({ birth }, dstr())} · {status}[ · directions joined by ·]`) — the exact age (`만 {n}세`) replaces the old band, computed at render and never stored ([Rule 9](../design-docs/core-beliefs.md#rule-9)). A line beneath the card states the two derived starting-grade keys in the frozen tables' own labels: `학력 {EDU_OPTS label} · 경력 {CAREER_OPTS label}`. Then one card per area: name (plus ` · directions` for 기본지식), `RANKS[grade].name` in cyan, `Bar` at `grade / 9`, `근거: {why}`. Note: `선택지 조합으로 자동 산정된 시작점이에요. 이후 승급은 오직 관문 통과로만 가능합니다.` Button `이 설정으로 시작` → `start()`.

## CV → starting-grade keys
Nine pure helpers turn the CV records into the same values `computeGrades` and the rest of the app already read; none of them is stored ([Rule 9](../design-docs/core-beliefs.md#rule-9)):
- `ageOf(birth, today)` — whole years, Korean 만 나이: if this year's birthday has not yet occurred, one less.
- `ageText(p, today)` — `` `만 ${ageOf(p.birth, today)}세` `` when `p.birth` is set; otherwise the legacy band only when it is one of the seven strings `AGE_OPTS` actually holds (so a hand-edited or imported save cannot print an invented band); otherwise `나이 미입력`.
- `careerMonths(careers, today)` — the size of the **union** of `YYYY-MM` months covered by entries whose `emp` is `full` or `free` (`to` absent = through the current month, each entry capped at 1,200 months before the union is built) — a union, not a sum, so two concurrent jobs count once, not twice.
- `careerText(n)` — `` `${y}년 ${m}개월` ``, dropping the year part when `y === 0` and the month part when `m === 0`; `0` → `없음`.
- `eduKeyOf(edus)` — the highest `EDU_OPTS` grade among entries with `status === "grad"`; failing that, `"col"` when any entry with `degree` in `assoc`/`ba`/`ms`/`phd` has `status` in `enroll`/`leave`/`expect`/`course`; failing that, `"hs"`. A `drop` entry counts as neither a degree nor current enrolment. For the same facts this reproduces exactly the key the old 최종 학력 chip row would have picked.
- `careerKeyOf(careers, today)` — from `m = careerMonths(...)`: `m ≥ 120 → "y10"`, `≥ 60 → "y510"`, `≥ 36 → "y35"`, `≥ 12 → "y13"`, `≥ 1 → "u1"`, else `"intern"` when any entry has `emp === "intern"`, else `"none"` — the `CAREER_OPTS` boundaries read literally.
- `displayName(p)` — `p.nick` trimmed, else `p.name` trimmed, else `사용자`.
- `topEdu(edus)` / `latestCareer(careers)` — the highest completed degree (or, absent one, the most recently started entry) / the most recently started job. Both feed `cvSummaryOf(profile, today)` (placed right after `displayName`), the one helper the home CV's `학력` / `경력` rows and the assistant packet's `## 이력` line both read, so the two can never disagree ([home.md](home.md), [assistant-bridge.md](../design-docs/assistant-bridge.md)) — neither `topEdu`/`latestCareer` nor `cvSummaryOf` feeds a grade.

**`eduKeyOf` and `careerKeyOf` are called in exactly one place in the whole file: the `profile` assembly above, which runs every render but is only ever handed off to state inside `start()`.** A CV edited afterwards through `ProfileModal` writes `profile.edus` / `profile.careers` and never re-derives `profile.edu` / `profile.career`, so an already-awarded grade cannot move ([Rule 4](../design-docs/core-beliefs.md#rule-4), [Rule 11](../design-docs/core-beliefs.md#rule-11)).

## `start()`
1. `results` → area objects `{ id: uid(), name, grade, achievements }`. Achievements: grade > 0 → `초기 산정 — {why}`; 기본지식 with `certSel` → `보유 자격: a, b`; 어학 with `examsOwned` → `보유 성적: {famN} {label}, ...`. `dir = directions` is set on the 기본지식 area only.
2. Exam prefill: for each `examsOwned` entry in order, `calcExamPayout(ex, fam, { label, d, p })` → `ex.dim[famId] = r.mult` (decay locked at registration) and `ex.best[famId] = { label, d, p, ver: POINT_POLICY_VERSION, date }`; the payout is discarded — nothing is paid ([Rule 2](../design-docs/core-beliefs.md#rule-2)).
3. Specialisation: per language English / Japanese / Chinese, two or more `best` records with `d ≥ 75` → `ex.spec[lang] = true`; if an 어학 area exists with grade < 5 it becomes 5 and gains `🎖 {LANG_KO[lang]} 전문화 — 고난도 시험(D75+) 2종 보유`.
4. Stage groups: every `certSel` entry with `sg` → `certBest[sg] = { p: certP(d), name, d }`, keeping the highest `p` per group ([Rule 3](../design-docs/core-beliefs.md#rule-3)).
5. `onStart({ areas, profile: { ...profile, startDate: dstr() }, exams, certBest })` → the root builds `freshState(areas)`, attaches profile / exams / certBest, and sets `phase` to `main`.

## Grade computation (`computeGrades(profile, areaNames)`)
Inputs: `certMaxD` = highest `CERTS` d among `profile.certs` via `certOf` (0 if none); `acadMaxD` = highest d in `examsOwned` whose family has `lang === "Academic"`; `langMaxD` = highest d among the others; `edu` = `EDU_OPTS.g`; `out` = `OUTPUT_OPTS.g`; `car` = `CAREER_OPTS.g`; `lead` = `profile.lead === "yes" ? 1 : 0` (`LEAD_OPTS.g` is not read); `biz` = `BIZ_OPTS.g`. `gFromD(d)`: ≥ 82 → 5 / ≥ 67 → 4 / ≥ 55 → 3 / ≥ 40 → 2 / ≥ 25 → 1 / else 0.

| Area | grade | why |
|---|---|---|
| 기본지식 | `kD = max(certMaxD, acadMaxD)`; `grade = max(edu, gFromD(kD), out)` | every term that equals the max and is > 0: `학력: {EDU_OPTS.t}` / `보유 자격·성적 최고 D{kD}` / `{OUTPUT_OPTS.t}` |
| 어학 | `langMaxD` ≥ 88 → 5 / ≥ 76 → 4 / ≥ 60 → 3 / ≥ 45 → 2 / ≥ 30 → 1 / else 0 | `보유 성적 최고 D{n}` or `어학 성적 없음` |
| 직업·커리어 | `car + (car >= 4 ? lead : 0)` | `{CAREER_OPTS.t}` or `경력 없음`, plus `리드 경험 +1` when it applied |
| 사업 | `biz` | `{BIZ_OPTS.t}` or `경험 없음` |
| any other area (remaining presets and customs) | 0 | `측정 항목 없음 — 지망생 시작, 관문으로 승급` |

Common: `grade = Math.min(grade, 6)`; `why` entries are joined with ` · `. The highest D is used regardless of category — job-fit weighting ([Rule 15](../design-docs/core-beliefs.md#rule-15)) does not apply here. `name`, `birth`, `gender`, and `status` — and every legacy field a v20 or earlier save still carries (`age`, `majorField`, `majorName`) — are collected or preserved but never read here; `edus[]` and `careers[]` themselves are not read here either, only the `edu` / `career` keys `eduKeyOf` / `careerKeyOf` derive from them once, in `start()`.
