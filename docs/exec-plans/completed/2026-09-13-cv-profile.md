# Exact CV profile — personal facts, education records, career records
- Status: completed
- Date: 2026-09-13
- Needs approval: **yes** — adds an `if (s.v < 21)` block to `migrate` and bumps `v` in `freshState` ([Rule 12](../../design-docs/core-beliefs.md#rule-12)). No `CERTS` / `EXAMS` / `WEIGHT_MATRIX` / `CERT_W_EXC` row is touched, no `liferpg-*` key changes, and no user data is deleted.
- Agents: planner → implementer → cleanup → verifier → docs-syncer

## Goal
The user asked to enter personal data exactly instead of picking vague chips: real name, exact date of birth, a registered photo, exact school names, departments, and "every CV field". Today `profile` is collected once in `Onboarding` and can never be edited again without `데이터 초기화`; `nick` is an optional nickname, `age` is a seven-value band, there is no school-name field at all (`majorName` is a major, not a school), and the only post-onboarding profile control is a stray `업로드` button on the home card. This plan replaces the vague inputs with exact records, adds the profile screen the app has never had, and keeps the starting-grade engine and every frozen table exactly as they are.

Scope is **personal details + education + career** only. Certifications, exam bests and portfolio pieces are already held by the app (`profile.certs`, `exams.best`, `folio[]`) and are assembled read-only into the CV surface — never re-typed.

## Context read
- `src/LifeManager.jsx` (6,728 lines) — re-read at every anchor below:
  - `AGE_OPTS` … `OUTPUT_OPTS`, `MAJOR_FIELDS`, `gFromD`, `computeGrades` (L1122–1209, region `초기 설정 선택지`, grep anchor `const AGE_OPTS =`).
  - `PACKET_HEAD`, `buildAssistantPacket` (L2586–2649).
  - `@schema v20` JSDoc + `migrate` (L2680–2798), `freshState` (L2807), `demoState` (L2829+, `s.profile` at L2845).
  - `Onboarding` (L2939–3346): state L2942–2976, `profile` assembly L3011–3017, `next()` validation L3020–3035, `start()` L3037–3082, `OptRow` L3084, step 0 L3137–3155, step 1 L3157–3176, step 4 L3290–3301, step 5 L3303–3327.
  - `HomeTab` profile card L3364–3385 (`Portrait`, `업로드`, `✕`, `state.profile.nick`).
  - `Modal` (L1806), `FolioModal` (L5840–5930) — the existing inline add-form, `type="month"` pair and validation pattern to copy.
  - `GrowthTab` data section L4975–4992.
  - App root: `imgs` / `askUpload` / `onFile` / `clearImg` L6014–6079, `exportBackup` / `importBackup` / `resetAll` L6502–6552, onboarding hand-off L6556–6567, header L6584–6594, modal dispatch L6653–6722.
- Docs: [AGENTS.md](../../../AGENTS.md) §4–§7, [ARCHITECTURE.md](../../../ARCHITECTURE.md) (file regions, state flow), [../../FRONTEND.md](../../FRONTEND.md), [../../PLANS.md](../../PLANS.md), [../../product-specs/new-user-onboarding.md](../../product-specs/new-user-onboarding.md), [../../product-specs/home.md](../../product-specs/home.md), [../../design-docs/state-lifecycle.md](../../design-docs/state-lifecycle.md), [../../design-docs/information-architecture.md](../../design-docs/information-architecture.md), [../../SECURITY.md](../../SECURITY.md), [../tech-debt-tracker.md](../tech-debt-tracker.md) (TD-28, TD-37), [../../RELIABILITY.md](../../RELIABILITY.md).
- Harness: `tools/e2e/run.js` (`typeInto` matches a placeholder substring, `typeExact` an exact placeholder, `setValue` drives `input[type=date|month]` through the native setter), `tools/e2e/flow.js` (onboarding, 6 steps), `flow4.js` (migration fixtures), `flow8.js` (`packetText()` helper), `tools/harness/lib/source.js` (`DATA_TABLES` — `AGE_OPTS`, `EDU_OPTS`, `MAJOR_FIELDS`, `CAREER_OPTS`, `LEAD_OPTS`, `BIZ_OPTS`, `OUTPUT_OPTS` are all guarded by `data-guard`), `tools/harness/smoke-logic.js`, `tools/harness/gen-screenshots.js`.

### Rules touched
| Rule | How this plan touches it |
|---|---|
| [Rule 4](../../design-docs/core-beliefs.md#rule-4) | Editing the CV after onboarding must never re-run `computeGrades`. Already-set area grades are immutable. |
| [Rule 5](../../design-docs/core-beliefs.md#rule-5) | `achGrade` cuts A82 / B65 / C50 / D35 are not touched. |
| [Rule 6](../../design-docs/core-beliefs.md#rule-6) | `EDU_OPTS`, `CAREER_OPTS`, `LEAD_OPTS`, `BIZ_OPTS`, `OUTPUT_OPTS`, `AGE_OPTS`, `MAJOR_FIELDS`, `CERTS`, `EXAMS` keep every key, label and `g` value. **If any step of the implementation seems to need one of these changed, stop and report — that is data-curator work, not this plan.** |
| [Rule 7](../../design-docs/core-beliefs.md#rule-7) (2026-09-09 amendment) | The assistant packet gains exactly one line; it still proposes only plain tasks and makes no network call. |
| [Rule 9](../../design-docs/core-beliefs.md#rule-9) | Resolved explicitly below — the derived age is never stored; `profile.edu` / `profile.career` are snapshot inputs, not live derivations. |
| [Rule 11](../../design-docs/core-beliefs.md#rule-11) | A CV edit is not a promotion path. Grades move only through `PromoteModal`. |
| [Rule 12](../../design-docs/core-beliefs.md#rule-12) | New `if (s.v < 21)` block, append-only; no existing block edited; `liferpg-*` keys unchanged. |
| [Rule 13](../../design-docs/core-beliefs.md#rule-13) | Every new string states a fact or a consequence. No encouragement, no softening of the "no education entered" or "no career entered" consequence. |
| [Rule 16](../../design-docs/core-beliefs.md#rule-16) | The profile photo keeps the `liferpg-img-profile` key; the `liferpg-img-*` convention is unchanged. |
| Rules [1](../../design-docs/core-beliefs.md#rule-1)–[3](../../design-docs/core-beliefs.md#rule-3) | Read-only: the CV surface prints held certifications, `exams.best` and `folio[]`; it never registers, pays or edits any of them. |

## The design constraint and how it is resolved
An exact birth date is free; an exact school name is dangerous. `computeGrades` (L1166–1209) reads `profile.edu`, `profile.output`, `profile.career`, `profile.lead`, `profile.biz`, `profile.certs`, `profile.examsOwned`. `profile.age` and `profile.majorField` are read by **nothing** — confirmed line by line. So:

1. **Age — replace outright.** `AGE_OPTS` band → exact `profile.birth` (`YYYY-MM-DD`). Nothing in the engine reads `age`, so this costs no grade. The displayed age is derived at render (`만 {n}세`), never stored ([Rule 9](../../design-docs/core-beliefs.md#rule-9)). The band a legacy save stored stays on that save and is displayed only when it is one of the seven strings this app ever wrote.
2. **Education — record the facts, derive the existing key.** The `최종 학력` chip row disappears from onboarding. In its place the user adds **education entries** (school, major, degree chip, status chip, dates). `profile.edu` is then **computed from the highest completed degree** and stored as one of the unchanged `EDU_OPTS` keys. The degree chips use the `EDU_OPTS` keys `hs` / `assoc` / `ba` / `ms` / `phd` directly, and the sixth key `col` (`전문대·대학 재학`, `g` 1) is produced by the status rule — so no key is invented, no `g` value moves, and **no school-ranking table is created**. School name and department are recorded; they never produce a grade.
3. **Career — same shape.** `직무 경력` chips disappear. Career entries carry company, role, employment kind and dates; `profile.career` is computed from the total months of practice against the unchanged `CAREER_OPTS` bands. `리드 경험` (`LEAD_OPTS`) stays exactly as it is — a yes/no fact, not a vague band.
4. **The derivation runs at onboarding only.** `eduKeyOf` and `careerKeyOf` are called in exactly one place, `Onboarding.start()`. `ProfileModal` writes `profile.edus` / `profile.careers` and **must not** write `profile.edu` / `profile.career`. Adding a doctorate to the CV of an existing save changes no area grade ([Rule 4](../../design-docs/core-beliefs.md#rule-4), [Rule 11](../../design-docs/core-beliefs.md#rule-11)); grades move only through the evidence gate after that point.

### Where the "nothing derived is stored" rule lands
`profile.edu` and `profile.career` are values computed from other stored values, which looks like the stored derivation [Rule 9](../../design-docs/core-beliefs.md#rule-9) forbids. They are not. They are **snapshot inputs of a one-time computation**, the same category as `exams.best` (a band snapshot, [Rule 2](../../design-docs/core-beliefs.md#rule-2)) and an achievement's `ver` ([Rule 4](../../design-docs/core-beliefs.md#rule-4)): written once, read once, never recomputed. If they were recomputed live from `edus` / `careers` they *would* become a derivation — and a retroactive one, which rules 4 and 11 forbid outright. The invariant that keeps both rules satisfied is the single call site: `eduKeyOf` / `careerKeyOf` appear exactly once each in the file, inside `Onboarding.start()`. Everything genuinely derived (the age number, total career months, the CV lines in the packet, the read-only held-records section) is computed in render and stored nowhere.

## Prompt
> Implement the exact CV profile in `src/LifeManager.jsx`, `tools/e2e/*` and the docs listed at the end. Work phase by phase; each phase ends at its gate and the next phase does not start until that gate is green. Read every anchor in the plan's "Context read" before editing it — do not trust line numbers alone.
>
> **Language.** Every identifier, comment, commit message and this plan's prose is English. UI copy is Korean `해요체` and is quoted verbatim in §"Korean strings" below — copy those strings exactly, character for character; each one is an E2E selector.
>
> **Frozen.** Do not edit `CERTS`, `EXAMS`, `WEIGHT_MATRIX`, `CERT_W_EXC`, `AGE_OPTS`, `EDU_OPTS`, `MAJOR_FIELDS`, `CAREER_OPTS`, `LEAD_OPTS`, `BIZ_OPTS`, `OUTPUT_OPTS`, `KNOWLEDGE_FIELDS`, any existing `migrate` block, any `store` call site, or any `liferpg-*` key ([Rule 6](../../design-docs/core-beliefs.md#rule-6), [Rule 12](../../design-docs/core-beliefs.md#rule-12)). The `data-guard` hook will deny an edit to any of them; if you hit it, stop and report rather than setting `HARNESS_DATA_EDIT=1`. Tailwind v3 core utilities only — no arbitrary values, no plugins. Target width 390 px with no horizontal scroll; use the `flex-1 w-0` pattern `FolioModal` already uses for its side-by-side `type="month"` inputs.
>
> ### Phase 1 — schema, migration, demo state
> 1. **Schema.** Update the `@schema` JSDoc above `migrate` to `v21` and change the version line to `v: 21`. The `profile` line becomes:
>    ```
>    profile: { name, nick, birth("YYYY-MM-DD"), gender, status, email?, phone?,
>               edus: [{ id, school, major?, field?(MAJOR_FIELDS), degree("hs"|"assoc"|"ba"|"ms"|"phd" — EDU_OPTS keys),
>                        status("enroll"|"leave"|"expect"|"grad"|"course"|"drop"), from?("YYYY-MM"), to?("YYYY-MM") }],
>               careers: [{ id, company, role, emp("full"|"free"|"intern"), from("YYYY-MM"), to?("YYYY-MM" — absent = still employed) }],
>               edu(EDU_OPTS key — snapshot input of the one-time starting-grade computation, never recomputed),
>               career(CAREER_OPTS key — same), lead, biz, output, certs[], examsOwned[],
>               directions[], look{skin,hair,hairColor,outfit,face}, startDate,
>               age?(legacy AGE_OPTS band — read only when birth is absent), majorField?(legacy), majorName?(legacy), roleModel? }
>    ```
>    This also closes the `profile` half of TD-28: `majorName`, `career`, `lead`, `biz`, `output`, `certs`, `examsOwned` are now all listed. Add to the "Derived values (never stored)" line: the displayed age (`ageText`), total career months (`careerMonths`) and the CV lines in the packet.
> 2. **Migration.** Append one block after the `v < 20` block — never edit an existing one:
>    ```js
>    if (s.v < 21) {
>      // v21: the CV — exact personal facts replace the vague chips. name, birth, email, phone and the two record
>      // arrays profile.edus / profile.careers are added empty; nothing is removed. age, edu, career, majorField and
>      // majorName stay exactly as the old save wrote them: edu and career are the frozen inputs of the one-time
>      // starting-grade computation and must never be recomputed (rules 4, 11), and the age band is the only age fact
>      // an old save has until the user enters a birth date. profile stays null on a save that never finished
>      // onboarding, so the root still routes it to Onboarding.
>      const p = s.profile;
>      s = { ...s, v: 21, profile: p ? { ...p, name: p.name ?? "", birth: p.birth ?? null, email: p.email ?? "", phone: p.phone ?? "", edus: p.edus || [], careers: p.careers || [] } : p };
>    }
>    ```
>    The `profile === null` guard is load-bearing: the root renders `Onboarding` when `!state?.profile`, so materialising an object here would trap a half-onboarded save in the main app with no profile data.
> 3. `freshState` → `v: 21`.
> 4. **`demoState`.** Replace the `s.profile` line. Keep the existing persona (harness-design applicant) and use obviously synthetic values with **no plausible real personal data**: `name: "데모 사용자"`, `nick: "하네스 지망생"` (unchanged), `birth: shiftDay(today, -9855)` (generated from today, like every other demo date, ≈ 27 years), `edu: "ba"` (fixes the invalid `"univ4"` key recorded in TD-28), one `edus` entry `{ id: uid(), school: "데모대학교", major: "기계공학", field: "공학", degree: "ba", status: "grad", from: "2017-03", to: "2023-02" }`, one `careers` entry `{ id: uid(), company: "데모전장", role: "설계 지원", emp: "intern", from: monthAdd(month, -14), to: monthAdd(month, -8) }`, and **no `email` / `phone`** (both optional — the demo ships nothing contact-shaped). Do not set `profile.career`: the demo's area grades are authored, not derived, and adding it would imply a computation that never ran.
> 5. **E2E.** `flow.js` "fresh state schema version" expects `21`. Add one fixture step to `flow4.js` after "v19 save → v20 business", named `v20 save → v21 CV records`: a v20 fixture whose `profile` carries `nick`, `age: "30대 초반"`, `edu: "ba"`, `career: "y13"`, `majorName`, plus areas, tasks and stamps. Assert: `edus` and `careers` are arrays and empty; `name`, `email`, `phone` are empty strings and `birth` is `null`; `edu` is still `"ba"`, `career` still `"y13"`, `age` still `"30대 초반"`, `majorName` unchanged; every other record and act stamp survives; and a second fixture with `profile: null` migrates to `profile === null`.
>
> **Gate 1:** `npm run verify` → 0 failed, 0 console errors · `npm run finish` → exit 0.
>
> ### Phase 2 — derivation helpers and onboarding
> 6. **New label lists**, placed immediately after `OUTPUT_OPTS` in the `초기 설정 선택지` region. These are new UI label lists, not edits to a frozen table; do **not** add them to `DATA_TABLES` in `tools/harness/lib/source.js`.
>

```js
/* CV chips. The degree keys are EDU_OPTS keys on purpose — the starting-grade table stays frozen and the
   sixth key `col` (전문대·대학 재학) is produced by the status rule in eduKeyOf, never picked directly. */
const EDU_LEVELS = [{ k: "hs", t: "고등학교" }, { k: "assoc", t: "전문학사" }, { k: "ba", t: "학사" }, { k: "ms", t: "석사" }, { k: "phd", t: "박사" }];
const EDU_STATUS = [{ k: "enroll", t: "재학" }, { k: "leave", t: "휴학" }, { k: "expect", t: "졸업예정" }, { k: "grad", t: "졸업" }, { k: "course", t: "수료" }, { k: "drop", t: "중퇴" }];
const EMP_KINDS  = [{ k: "full", t: "정규·계약" }, { k: "free", t: "프리랜서·외주" }, { k: "intern", t: "인턴·알바" }];
```

>
> 7. **Pure helpers**, placed directly below `computeGrades` (same story: profile → starting grade). `monthsBetween` is defined later in the file, in the business region; the forward reference is safe because these are called from render, never at module initialisation — say so in a one-line comment.
>    - `ageOf(birth, today)` → whole years (Korean `만 나이`: birthday not yet reached this year → one less).
>    - `ageText(p, today)` → `` `만 ${ageOf(p.birth, today)}세` `` when `p.birth` is set; otherwise `AGE_OPTS.includes(p?.age) ? p.age : "나이 미입력"`. The `AGE_OPTS.includes` guard is what keeps the frozen table referenced *and* refuses to print a band this app never wrote (an imported or hand-edited save can carry anything).
>    - `careerMonths(careers, today)` → size of the **union** of `YYYY-MM` months covered by entries whose `emp` is `full` or `free` (`to` absent = up to the current month). A union, not a sum, so two concurrent jobs are not double-counted. Build it with `monthAdd` / `monthsBetween` and a `Set`.
>    - `careerText(n)` → `` `${y}년 ${m}개월` ``, dropping the year part when `y === 0` and the month part when `m === 0`; `0` → `없음`.
>    - `eduKeyOf(edus)` → an `EDU_OPTS` key: highest `EDU_OPTS.g` among entries with `status === "grad"`; else `"col"` if any entry with `degree ∈ {assoc, ba, ms, phd}` has `status ∈ {enroll, leave, expect, course}`; else `"hs"`. (`drop` contributes nothing — a withdrawal is neither a degree nor current enrolment.) This must reproduce, for the same facts, exactly the key the user would have picked from the old `최종 학력` row.
>    - `careerKeyOf(careers, today)` → a `CAREER_OPTS` key from `m = careerMonths(...)`: `m >= 120 → "y10"`, `>= 60 → "y510"`, `>= 36 → "y35"`, `>= 12 → "y13"`, `>= 1 → "u1"`, else `careers.some(c => c.emp === "intern") ? "intern" : "none"`. The boundaries are the `CAREER_OPTS` labels read literally; do not invent a band.
>    - `displayName(p)` → `p?.nick?.trim() || p?.name?.trim() || "사용자"`.
>    - `topEdu(edus)` (highest completed degree, else the most recent entry) and `latestCareer(careers)` (latest `from`) — used by the profile screen and the packet.
> 8. **Onboarding step 0** (`1 / 6` `기본 정보`), in this order: `이름` input (required) → `닉네임 (선택)` input (unchanged placeholder) → `생년월일` label + `input type="date"` (required) → `성별` chips (unchanged) → `현재 신분` chips (unchanged) → the `학력` entry section. Remove the `연령대` row, the `최종 학력` row, the `전공 계열` row and the `전공 이름 (선택, 예: 경영학)` input. Replace the subtitle. The education section is an entry list plus one inline add form (copy `FolioModal`'s shape: fields, then an add button that validates and appends); `MAJOR_FIELDS` moves here as the optional `계열 (선택)` chip row, which keeps that frozen list referenced.
> 9. **Onboarding step 4** (`5 / 6`), heading `경력·경험`: the `경력` entry section first (same inline-add shape, with a `재직 중` toggle that clears the end month), then a derived summary line, then the unchanged `리드 경험` (`LEAD_OPTS`, still gated on `hasJob`), `사업 경험` (`BIZ_OPTS`, gated on `hasBiz`) and `산출물·포트폴리오` (`OUTPUT_OPTS`) rows. Remove the `직무 경력` row. **Neither entry section is gated on `hasJob` / `hasBiz`** — a CV has an education and a career section regardless of which areas the user chose to grow; only the grade they feed applies to an area that exists.
> 10. **Onboarding wiring.** New component state: `name`, `birth`, `edus`, `careers` and the two add-form drafts. `profile` assembly becomes `{ name: name.trim(), nick: nick.trim(), birth, gender, status, email: "", phone: "", edus, careers, directions, look, examsOwned, certs: certSel, edu: eduKeyOf(edus), career: careerKeyOf(careers, dstr()), lead: lead ?? "no", biz: biz ?? "none", output: output ?? "none" }` — note `nick` is no longer defaulted to `사용자`; `displayName` owns that fallback now. **`eduKeyOf` and `careerKeyOf` appear nowhere else in the file.** Step 1's preview name and step 5's summary name both become `displayName({ nick, name })`; step 5's `{age} · {status}` becomes `{ageText({ birth }, dstr())} · {status}`, and a line above the area cards states the two derived keys (§"Korean strings").
> 11. **E2E.** Rewrite `flow.js` `step 1 — basic info` (name, nickname, birth date via `setValue('input[type="date"]', …)` — onboarding is not inside `.fixed.inset-0`, so the selector must be unscoped — then `남성`, `취업 준비`). Add `step 1 — education entry` (school, major, `학사`, `졸업`, the two `input[type="month"]` fields by index, `학력 추가`, then assert the entry row). Rewrite `step 5 — experience and outputs` for the new heading and add `step 5 — career entry` (company, role, `정규·계약`, months, `경력 추가`, then assert the derived summary line). Step 6 asserts the derived line `학력 학사 졸` — those are existing `EDU_OPTS` / `CAREER_OPTS` labels, not new copy. **Do not build on TD-37**: `step 3 — areas and knowledge directions` deselects the chips it clicks, so the run proceeds with `사업` only — that is why neither CV section may be gated on an area. Update `tools/e2e/ab_onboard.js` and `tools/e2e/rows.js`, which drive the same step-0 selectors and would otherwise break silently (they are bench scripts outside the `verify` chain).
>
> **Gate 2:** `npm run verify -- --smoke` → 0 failed, 0 console errors, `smoke: all checks passed`. The `--smoke` run is required **here**: `eduKeyOf` / `careerKeyOf` read the `g` values of `EDU_OPTS` and `CAREER_OPTS` and are edited into the `초기 설정 선택지` region that sits between the frozen option tables, and `smoke-logic.js` re-evaluates those tables straight out of the source and checks them against `finish.config.json`'s expected counts — so it is the check that proves the edit did not disturb an adjacent table. Then `npm run finish` → exit 0.
>
> ### Phase 3 — the profile screen
> 12. **`ProfileModal`**, a new component in the Modals region, reached as `modal.type === "profile"` (the 19th type). A modal, not a view: the app has exactly six nav tabs and the `Modal` shell already gives `max-h-full overflow-y-auto` and a mobile bottom sheet, so a seventh tab or a route is not warranted for a screen opened occasionally. Props: `profile`, `state`, `img`, `today`, `onUpload`, `onClearImg`, `onSave`, `onClose`. Sections in order: `사진` → `인적사항` → `학력` → `경력` → `보유 기록`. Photo controls call the root's existing `askUpload("profile")` / `clearImg("profile")` — **no new `store` call site**, `liferpg-img-profile` unchanged ([Rule 16](../../design-docs/core-beliefs.md#rule-16)). The root's hidden file input lives on `Shell`, outside the modal, so the E2E must select `input[type="file"]` unscoped (`run.js` already falls back to that). The education and career sections reuse the same entry-list + inline-add components as onboarding — factor them once (e.g. `CvEntryRow`, `CvAddForm`) and use them in both places, so `finish-check`'s duplicate detector (window 6, 4 logic lines) has nothing to flag. `보유 기록` is read-only: held certifications from `profile.certs`, best scores from `state.exams.best`, portfolio count from `state.folio`, each with the line telling the user where they are actually managed.
> 13. **The modal must not write `profile.edu` or `profile.career`.** `onSave` merges only `name`, `nick`, `birth`, `gender`, `status`, `email`, `phone`, `edus`, `careers` into `profile` through the clone pattern. The modal shows the standing note that a CV edit does not move a grade.
> 14. **Home card.** Replace the `업로드` button and the `✕` photo-clear overlay with a single `프로필` button that opens the modal; photo registration and removal now live inside it, next to the rest of the CV, instead of being the one stray profile control on the home screen. `{state.profile.nick}` → `{displayName(state.profile)}`; do the same at the header (`App`, next to `· {state.profile.status}`). Check whether `Camera` is still imported-and-used after the move (it moves to the modal's `사진 등록` button) — `finish-check` flags unused lucide imports.
> 15. **E2E.** Add three steps: `profile modal — opens from the home card and lists the CV` (assert the school name and the role typed at onboarding are shown); `profile modal — validation` (empty required field, malformed e-mail, end month before start month — assert each message); `profile modal — a CV edit never moves a grade` (read every `areas[].grade` from `localStorage`, add a `박사` `졸업` entry, save, re-read, assert every grade and `profile.edu` are byte-identical).
>
> **Gate 3:** `npm run verify` → 0 failed, 0 console errors · manual 390 px check (Chrome device toolbar at 390 px: onboarding step 0, step 4, and `ProfileModal` with two education and two career entries — no horizontal scroll, no clipped month input) · `npm run build:demo && node tools/harness/gen-screenshots.js` (the home card changed, so `public/screenshots/home.png` no longer matches the UI; the screenshots are committed and the build copies `public/` verbatim) · `npm run finish` → exit 0.
>
> ### Phase 4 — packet, privacy, docs
> 16. **Assistant packet.** Add exactly one new section to `buildAssistantPacket`, `sec("이력", cvLines)`, placed after `## 오늘 브리핑` and before `## 목표`. `cvLines` is at most one line built from `topEdu` and `latestCareer`: the degree label + major (or `계열`, or `전공 미기재`), and the total practice months + the most recent role. **It carries no `name`, no `birth`, no `email`, no `phone`, no `school` and no `company`** — the user's decision of 2026-09-13 is "role and department level only", and a school or employer name identifies a person nearly as well as a name does. Write that exclusion as a comment above the block, naming the fields. The 4,000-char cap and its journal-trim loop are untouched; the `sec` helper already prints `- 없음` for an empty section.
> 17. **Privacy boundaries**, to be stated in `docs/SECURITY.md` and enforced in code:
>     - **Backup file** — carries the whole save including every new personal field. That is correct and stays as it is: the file is local, it is the only way back from a cleared browser, and `SECURITY.md` already says it is as sensitive as the app itself. Only the sentence listing what it contains gains the CV.
>     - **Assistant packet** — the single `이력` line above, nothing else. This is the only place data deliberately leaves the device.
>     - **Briefing** (`buildBriefing`) — no personal field at all; it is about today's numbers.
>     - **Demo state** — synthetic values only, no contact fields at all.
>     - **Screenshots** (`gen-screenshots.js`) — generated from the demo save, so they can never contain a real person's data.
> 18. **E2E.** Add one step in `flow8.js` using its existing `packetText()` helper: the packet contains the major and the role, and does **not** contain the name, the birth date, the school name or the company name typed during onboarding. Make it non-vacuous by using distinctive onboarding values (`E2E대학교`, `E2E전장`) and asserting their absence.
>
> **Gate 4:** `npm run verify -- --smoke` · `npm run docs:gen && npm run docs:check` → exit 0 · `npm run finish` → exit 0. Then hand over to docs-syncer for the doc list at the end of this plan and move this plan to `docs/exec-plans/completed/`.
>
> ### Acceptance criteria (observable)
> 1. A fresh onboarding asks for a name, an exact birth date, gender, status, and at least one education entry with a school name; the save is schema `v21` and `profile.edus[0].school` holds the typed string.
> 2. Step 5 prints `만 {n}세` instead of a band, and states the two derived keys using the unchanged `EDU_OPTS` / `CAREER_OPTS` labels.
> 3. For the same facts, `eduKeyOf` / `careerKeyOf` produce the key the user would have picked from the old chip rows — a `학사` `졸업` entry gives `ba`, an enrolled undergraduate gives `col`, 26 months of full-time work gives `y13`.
> 4. The home card has a `프로필` button and no `업로드` button; the modal registers and removes the photo under `liferpg-img-profile`.
> 5. **Adding a `박사` `졸업` entry to an existing save through the profile screen changes no area grade and does not change `profile.edu`** (E2E step in Phase 3).
> 6. Every migration fixture in `flow4.js` passes, including a v20 save that keeps its `age`, `edu`, `career` and `majorName`, and a `profile: null` save that stays `null`.
> 7. The packet contains the `## 이력` section with the major and role, and none of name / birth / school / company / e-mail / phone.
> 8. `npm run verify` reports 0 failed steps and 0 console errors at every gate; the final step count is the current 142 plus the 7 steps added here — report the number `verify` prints rather than assuming it.
> 9. No horizontal scroll at 390 px on onboarding step 0, step 4, and `ProfileModal` with two entries in each list.
>
> ### Finish protocol
> cleanup (`npm run finish` exit 0; any intentional finding goes to `tools/harness/finish-allowlist.json` with a reason and is mirrored in `docs/exec-plans/tech-debt-tracker.md`) → verifier (`npm run verify -- --smoke`) → docs-syncer (`npm run docs:gen`, `npm run docs:check`, move this plan to `completed/`) → report with the proposed commit message. Do not commit outside a gate the user approved.

## Korean strings
Every string added, changed or removed. Each is an E2E selector — copy verbatim.

### Added — onboarding step 0 (`1 / 6` `기본 정보`)
| Where | String |
|---|---|
| subtitle (replaces the one below) | `입력한 학력·경력으로 시작 등급이 산정돼요.` |
| name input placeholder | `이름` |
| birth label | `생년월일` |
| education section label | `학력` |
| school input placeholder | `학교 이름 — 예: 한국대학교` |
| major input placeholder | `전공·학과 (선택) — 예: 기계공학` |
| degree chip row label | `학위` |
| degree chips (`EDU_LEVELS`) | `고등학교` · `전문학사` · `학사` · `석사` · `박사` |
| status chip row label | `상태` |
| status chips (`EDU_STATUS`) | `재학` · `휴학` · `졸업예정` · `졸업` · `수료` · `중퇴` |
| field chip row label (chips are the unchanged `MAJOR_FIELDS`) | `계열 (선택)` |
| add button | `학력 추가` |
| empty-list note | `학력을 1개 이상 추가해요. 최종 학력이 기본지식 시작 등급의 근거가 돼요.` |

### Added — onboarding step 4 (`5 / 6`)
| Where | String |
|---|---|
| heading (replaces `경험`) | `경력·경험` |
| career section label | `경력` |
| company input placeholder | `회사·조직 이름 — 예: 한국부품` |
| role input placeholder | `직책·직무 — 예: 설계 엔지니어` |
| employment chip row label | `고용 형태` |
| employment chips (`EMP_KINDS`) | `정규·계약` · `프리랜서·외주` · `인턴·알바` |
| still-employed toggle | `재직 중` |
| add button | `경력 추가` |
| empty-list note | `경력이 없으면 비워 둬요. 직업·커리어 시작 등급은 경력 없음 기준이에요.` |
| derived summary line | `합산 실무 {careerText} · 시작 등급 기준 {CAREER_OPTS label}` |

### Added — onboarding step 1 and step 5
| Where | String |
|---|---|
| step 1 note | `사진은 시작한 뒤 홈 프로필 카드에서 등록해요.` |
| step 5 derived line (labels come from the frozen tables) | `학력 {EDU_OPTS label} · 경력 {CAREER_OPTS label}` |
| `ageText` fallback when neither a birth date nor a valid band exists | `나이 미입력` |

### Added — `ProfileModal`
| Where | String |
|---|---|
| modal title | `프로필` |
| section labels | `사진` · `인적사항` · `학력` · `경력` · `보유 기록` |
| photo buttons | `사진 등록` · `사진 삭제` |
| e-mail input placeholder | `이메일 (선택)` |
| phone input placeholder | `연락처 (선택)` |
| save button | `저장` |
| discard note | `창을 닫으면 저장되지 않아요.` |
| no-rescore note | `학력·경력을 고쳐도 시작 등급은 바뀌지 않아요. 승급은 관문 증거로만 올라가요.` |
| held-records note | `여기서는 고칠 수 없어요 — 자격·시험은 목표의 핵심결과에서, 포트폴리오는 사업 탭에서 관리해요.` |
| save toast | `프로필을 저장했어요` |

### Added — home card
| Where | String |
|---|---|
| button (replaces `업로드`) | `프로필` |

### Added — validation messages
| Case | String |
|---|---|
| name empty | `이름을 입력해 주세요.` |
| birth date empty | `생년월일을 입력해 주세요.` |
| birth date malformed | `생년월일 형식이 올바르지 않아요 — YYYY-MM-DD로 입력해요.` |
| birth date in the future | `생년월일이 오늘보다 뒤예요.` |
| gender or status missing | `성별과 현재 신분을 선택해 주세요.` |
| no education entry | `학력을 1개 이상 추가해 주세요.` |
| school name empty | `학교 이름을 입력해 주세요.` |
| degree or status not picked | `학위와 상태를 선택해 주세요.` |
| education end month before start month | `졸업 연월이 입학 연월보다 앞서요.` |
| company or role empty | `회사 이름과 직책을 입력해 주세요.` |
| employment kind not picked | `고용 형태를 선택해 주세요.` |
| career start month empty | `입사 연월을 입력해 주세요.` |
| career end month before start month | `퇴사 연월이 입사 연월보다 앞서요.` |
| malformed e-mail | `이메일 형식이 올바르지 않아요.` |

### Changed
| Where | From | To |
|---|---|---|
| step 0 subtitle | `선택만 하면 시작 등급이 자동 산정됩니다.` | `입력한 학력·경력으로 시작 등급이 산정돼요.` |
| step 4 validation | `직무 경력과 리드 경험을 선택해 주세요.` | `리드 경험을 선택해 주세요.` |
| step 4 heading | `경험` | `경력·경험` |
| step 5 summary | `{age} · {status}` | `{ageText} · {status}` |

### Removed
`연령대` (label; the seven `AGE_OPTS` chips are no longer rendered — the list stays in the file and stays referenced by `ageText`'s legacy-band guard) · `최종 학력` (label; `EDU_OPTS` stays, read by `computeGrades` and `eduKeyOf`) · `전공 계열` (label; `MAJOR_FIELDS` moves to `계열 (선택)`) · `전공 이름 (선택, 예: 경영학)` (placeholder; `profile.majorName` is no longer written and stays on legacy saves) · `직무 경력` (label; `CAREER_OPTS` stays, read by `computeGrades` and `careerKeyOf`) · `연령대·성별·신분·학력·전공 계열을 모두 선택해 주세요.` (replaced by the six messages above) · `업로드` (home card).

## Steps
1. Phase 1 — `@schema` v21, `migrate` `v < 21` block, `freshState` v21, `demoState` profile, `flow.js` version assert, `flow4.js` fixture step. Gate 1.
2. Phase 2 — `EDU_LEVELS` / `EDU_STATUS` / `EMP_KINDS`, the eight pure helpers, onboarding steps 0 / 1 / 4 / 5, `profile` assembly, validation, `flow.js` + `ab_onboard.js` + `rows.js`. Gate 2 (`--smoke`).
3. Phase 3 — `ProfileModal`, the shared CV entry components, `modal.type === "profile"`, `saveProfile` handler, home card and header `displayName`, three E2E steps. Gate 3 (+ 390 px manual check, `build:demo` + `gen-screenshots.js`).
4. Phase 4 — the packet's `## 이력` section, the privacy comment, `flow8.js` privacy step, docs hand-off. Gate 4.

## Verification
- Gates 1 and 3: `npm run verify` — 0 failed steps, 0 console errors.
- Gates 2 and 4: `npm run verify -- --smoke` — additionally `smoke: all checks passed` (required because the derivation helpers read the frozen `EDU_OPTS` / `CAREER_OPTS` `g` values and are edited into the region between the frozen option tables).
- `npm run finish` → exit 0 at every gate.
- `npm run docs:gen && npm run docs:check` → exit 0 at Gate 4.
- Manual, Gate 3: Chrome device toolbar at **390 px** — onboarding step 0, onboarding step 4, and `ProfileModal` with two education and two career entries; no horizontal scroll, no clipped `type="month"` input.
- Re-run after Gate 3: `npm run build:demo` then `node tools/harness/gen-screenshots.js` — the home card lost `업로드` and gained `프로필`, so the committed `public/screenshots/home.png` is stale.
- E2E step count: 142 today → 149 expected (+2 onboarding, +3 profile modal, +1 migration fixture, +1 packet privacy). Report the number `verify` prints.

## Cleanup checklist
- [ ] `npm run finish` exit 0 (unused symbols/imports, duplicates, residue, language)
- [ ] `Camera` and any other lucide import is still used after the home-card button moved into `ProfileModal`
- [ ] `AGE_OPTS`, `MAJOR_FIELDS`, `EDU_OPTS`, `CAREER_OPTS`, `LEAD_OPTS` are all still referenced — no frozen table became dead
- [ ] the education and career entry UI exists once and is used from both onboarding and `ProfileModal` (duplicate gate: window 6, 4 logic lines)
- [ ] `eduKeyOf` and `careerKeyOf` each appear exactly once outside their definition, both inside `Onboarding.start()`
- [ ] allowlist additions (with reason) mirrored in `tech-debt-tracker.md`

## Docs to sync
| Doc | Change |
|---|---|
| `docs/product-specs/new-user-onboarding.md` | Steps 0, 1, 4, 5 rewritten; new component state; the `profile` assembly; the `computeGrades` input table's closing sentence ("`majorField`, `majorName`, `gender`, `age`, and `status` are collected but never used") is now about `birth` and the legacy fields. |
| `docs/product-specs/home.md` | Profile card: `프로필` button replaces `업로드` and the `✕` overlay; `displayName` replaces `profile.nick`. |
| `docs/product-specs/growth.md` | Unchanged unless the data section gains a second entry point — confirm it does not. |
| **new** `docs/product-specs/profile.md` (or a section in `home.md` — docs-syncer decides; if a new file, register it in `tools/harness/docs-manifest.json`) | `ProfileModal`: sections, fields, validation, the no-rescore rule, the read-only held-records section. |
| `docs/design-docs/scoring-engine.md` | `computeGrades` inputs are now derived from the CV at onboarding only; `age` and `majorField` are out of the input set entirely. |
| `docs/design-docs/state-lifecycle.md` | Shape (v20 → v21), the `migrate` ledger gains the v21 row, the `profile: null` guard. |
| `docs/design-docs/information-architecture.md` | Modal count 18 → 19 (`profile`); home-card entry point. |
| `docs/design-docs/demo-data.md` | The `## Profile` section; note that `edu: "univ4"` is fixed and that the demo ships no contact fields. |
| `docs/SECURITY.md` | "Data at rest" gains the CV fields; "Data in transit" gains the packet's `## 이력` line and its exclusions; "The backup file" sentence lists the CV and states that carrying it is correct and unchanged. |
| `docs/PRODUCT_SENSE.md` | Only if the screen list or the non-goals need the profile screen named. |
| `ARCHITECTURE.md` | Schema **v21**, the new E2E step count, `Onboarding` region description, `ProfileModal` in the Modals row, file line count. |
| `docs/RELIABILITY.md` | Step count and what the new steps assert (the CV-edit-never-moves-a-grade step is the load-bearing one). |
| `tools/e2e/README.md` | `node run.js --tag run` step count. |
| `docs/exec-plans/tech-debt-tracker.md` | **TD-28 rewritten**: the `profile` drift half is resolved (`@schema` now lists every field, `demoState.edu` is a valid key); what remains is the `roleGap` ≈ 70 % wording and the `CERTS` header comments — keep those, drop the resolved clauses. TD-37 stays open and is explicitly not built on. |
| `docs/design-docs/decision-log.md` | New entry: exact CV replaces the vague chips; education and career are records, the grade keys are one-time snapshots; the packet carries role and department level only. |
| `docs/generated/*` | `npm run docs:gen` (db-schema from the `@schema` block, symbol index). Never hand-edited. |

## Proposed commit
`feat(profile): exact CV — name, birth date, school and career records with an editable profile screen`
