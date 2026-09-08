# New-user onboarding
<!-- src: SPEC-4-1 --><!-- src: SPEC-5 -->

`Onboarding` turns a title screen and six steps of choices into the initial state: areas with a computed starting 등급 (grade), an exam record prefilled with 어학 (language) scores, and stage-group best records. The same choices always give the same grade; afterwards an area rises only through a 관문 (gate) ([Rule 11](../design-docs/core-beliefs.md#rule-11)). Option lists, `RANKS`, and `GATE_CHIPS` are generated in [../generated/onboarding-tables.md](../generated/onboarding-tables.md); the resulting state shape is in [../generated/db-schema.md](../generated/db-schema.md).

## Flow and state
- Rendered when `phase === "onboard"` or the saved state has no `profile`; it is not wrapped in `Shell`.
- `step` is `"title"` or 0–5. State: `err`, `nick`, `age`, `gender`, `status`, `edu`, `majorField`, `majorName`, `look` `{ skin: 0, hair: 0, hairColor: 0, outfit: 0, face: 1 }`, `selected` (default `["사업", "직업·커리어", "기본지식"]`), `customs`, `customInput`, `directions` (max 3), `certSel`, `examOwnFam`, `examsOwned`, `cat`, `gradeF`, `query`, `career`, `lead`, `biz`, `output`.
- `areaNames` = the selected `AREA_PRESETS` in preset order, then `customs`. `hasJob` = includes 직업·커리어; `hasBiz` = includes 사업.
- `profile` is assembled on every render with fallbacks (`nick` → `사용자`, `career` → `none`, `lead` → `no`, `biz` → `none`, `output` → `none`) and `results = computeGrades(profile, areaNames)` is recomputed with it.
- Header: monospace label `PROFILE SETUP` on every screen; h1 `인생 관리` on the title screen only; six-segment progress bar on steps 0–5 (`i <= step` → `bg-cyan-400`, else `bg-zinc-800`).
- Buttons below steps 0–5: `이전` when `step > 0` (the title screen cannot be returned to); `다음` runs the step's validation and shows the error in rose text; step 5 shows `이 설정으로 시작` instead.

## Title
`OnboardingHeroSvg` · `지금 위치를 숫자로 확인하세요. 평가는 시장 기준입니다.` · button `시작하기` → step 0 · link `먼저 화면만 볼래요 — 데모 데이터로 둘러보기` → `onDemo` → `demoState()`.

## Step 0 — `1 / 6` `기본 정보`
Subtitle `선택만 하면 시작 등급이 자동 산정됩니다.` Nickname input `닉네임 (선택)` → 연령대 `AGE_OPTS` (7) → 성별 `[남성, 여성, 선택 안 함]` → 현재 신분 `STATUS_OPTS` (11) → 최종 학력 `EDU_OPTS` (6, stores `k`) → 전공 계열 `MAJOR_FIELDS` (9) → major-name input `전공 이름 (선택, 예: 경영학)`.
Validation: any of age, gender, status, edu, majorField missing → `연령대·성별·신분·학력·전공 계열을 모두 선택해 주세요.`

## Step 1 — `2 / 6` `프로필 외형`
Preview card: `PortraitSprite` (`look`, `gender`, size 84) + nickname + `무작위` (`randomLook`: `Math.floor(Math.random() * length)` over `SKINS` 4, `HAIR_STYLES` 5, `HAIR_COLORS` 6, `OUTFITS` 6, `FACES` 3). Controls in order: Swatch 피부 `SKINS` · Swatch 머리색 `HAIR_COLORS` · Swatch 옷 색상 `OUTFITS` · OptRow 헤어스타일 `HAIR_STYLES` (stored as `indexOf`) · OptRow 표정 `FACES`. No validation.

## Step 2 — `3 / 6` `성장시킬 영역`
Eight `AREA_PRESETS` chips toggle; custom areas render as `{c} ✕` (click removes); input `직접 추가 (선택)` + Plus button (`addCustom`: blank, a preset name, or an existing custom name is ignored; the input is cleared either way). Note: `직접 추가한 영역은 측정 항목이 없어 지망생부터 시작해요.`
When 기본지식 is selected, a box `기본지식이 향할 방향 (1~3개)` / `지금 업무와 무관해도 돼요. 앞으로 나아갈 분야를 고르면 추천과 성장 방향이 여기에 맞춰집니다.` lists the 18 `KNOWLEDGE_FIELDS` chips (`toggleDir`; a fourth pick is silently ignored).
Validation: no area → `영역을 하나 이상 선택해 주세요.`; 기본지식 selected with no direction → `기본지식이 향할 방향을 1개 이상 선택해 주세요.`

## Step 3 — `4 / 6` `보유 자격·어학` `({n}개 선택)`
Category buttons `["전체", ...CERT_CATS]` → grade buttons `[전체, A, B, C, D, E]` (`GRADE_TEXT` colours) → input `자격증 검색`. `filtered` = `CERTS` ∧ category match ∧ `achGrade(c.d)` match ∧ `c.n.includes(query)`. The list (`max-h-56`) renders at most 60 rows (`shown`), already-selected certs pinned first; a row is the grade letter + `c.n` + `c.l`, selected → `bg-cyan-500` + Check. Empty: `검색 결과 없음`; overflow: `{n}종 더 있음 — 검색어로 좁혀요`. Note: `없으면 그냥 다음으로. 취득 예정인 건 나중에 자격증 실행으로 등록해요.`
Exam box `보유 시험 성적 ({n})`: 17 `EXAMS` family buttons (click again to deselect) → the family's band chips → `examsOwned` entry `{ famId, famN, label, d, p }`, one per family (re-selecting removes the old entry and pushes the new one to the end, so registration order changes) → list rows `{famN} {label} D{d}` + X. Note: `여기 등록한 성적은 시작 기록으로 저장되고, 이후 상향 시 차액만 지급돼요.` No validation.

## Step 4 — `5 / 6` `경험`
Subtitle `정직하게, 상향 없이.` `hasJob` → 직무 경력 `CAREER_OPTS` (7) · 리드 경험 `LEAD_OPTS` (2); `hasBiz` → 사업 경험 `BIZ_OPTS` (7); always 산출물·포트폴리오 `OUTPUT_OPTS` (4).
Validation: `hasJob && (!career || !lead)` → `직무 경력과 리드 경험을 선택해 주세요.`; `hasBiz && !biz` → `사업 경험을 선택해 주세요.`; `!output` → `산출물 항목을 선택해 주세요.`

## Step 5 — `6 / 6` `설정 완료`
Summary card (`PortraitSprite` 60, nickname, `{age} · {status}[ · directions joined by ·]`), then one card per area: name (plus ` · directions` for 기본지식), `RANKS[grade].name` in cyan, `Bar` at `grade / 9`, `근거: {why}`. Note: `선택지 조합으로 자동 산정된 시작점이에요. 이후 승급은 오직 관문 통과로만 가능합니다.` Button `이 설정으로 시작` → `start()`.

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

Common: `grade = Math.min(grade, 6)`; `why` entries are joined with ` · `. The highest D is used regardless of category — job-fit weighting ([Rule 15](../design-docs/core-beliefs.md#rule-15)) does not apply here. `majorField`, `majorName`, `gender`, `age`, and `status` are collected but never used in the computation.
