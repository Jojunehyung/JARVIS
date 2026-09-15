# Home tab — the CV
<!-- src: SPEC-4-2 -->

Home is one CV card plus one small proximity line under it — nothing else (2026-09-15, [decision log](../design-docs/decision-log.md)). The user asked, verbatim, for the `성장` tab gone and home stripped to "정량적 평가만" (quantitative evaluation only) plus one small percentage under it. `HomeTab` renders exactly two top-level children inside `<main>`: the CV `<section>` and the proximity line. Everything on it is derived from `state` at render — nothing is stored ([Rule 9](../design-docs/core-beliefs.md#rule-9)). Props: `state, today, imgs, onProfile (opens ProfileModal), onSettings (opens SettingsModal), onPromote (opens PromoteModal for an area), onRoleAdvice (opens RoleAdviceModal), onWall (opens AchievementWallModal)`.

Deliberately absent: goal progress and pace (the user's own decision — `목표별 진행률은 목표탭에서만 하고 롤모델 근접도만`, so progress with pace stays in `목표` only, [goals.md](goals.md)), and everything dated today — the briefing, today's schedule and business counts, today's tasks, today's completion count. None of it disappeared; [Where everything went](#where-everything-went-and-why) below is the map.

## Admission rule
A row is admitted only when its value is a number, a grade, or an ordinal credential level — age, a degree level with status, months of practice, an area grade `n/9`, a certification or exam D, a count (held certifications, exam bests, portfolio pieces, trophies, verified achievements), or role-model proximity `%`. A nominal field appears only as the label that qualifies such a value: the major of the degree, the most recent role behind the practice months, the name of the certification or exam whose D is shown. Portrait and display name stay, as the CV's identity.

Excluded on the same rule: school and employer names, e-mail, phone, gender, `현재 신분` (the header already states it on every tab), knowledge and job directions, anything dated today, goal progress and pace, money (a record, not an evaluation), and free-text achievement entries (one tap away behind the `성취` row, in full, inside `AchievementWallModal`).

## The CV card
One `<section>`, three blocks top to bottom — identity, records, grades — so the grade rows sit last, next to the proximity line computed from them.

### Identity row
`Portrait` at size 64 in the existing frame; `{displayName(state.profile)}`; `{ageText(state.profile, today)}`; the `프로필` button (unchanged, opens `ProfileModal`) — the only edit control on the CV, since `ProfileModal` owns the photo, the personal facts and the records. Last, in the top-right corner of the card, an icon-only settings button (`aria-label`/`title` `설정`, lucide `Settings`) → `onSettings`. It sits on the card, not the shared header, because the header is common to all five tabs and its right edge already carries the streak/shield pill.

### Records
One `CvFact({ label, children, onClick })` row each — a button when `onClick` is given, else a plain row. Zeros are stated (`0건`, `트로피 0개 · 검증된 성취 0건` — [Rule 13](../design-docs/core-beliefs.md#rule-13)); every read is guarded (`?.`, `|| []`) so a v10 or unversioned save still renders the card instead of printing `undefined` (`tools/e2e/flow4.js`).

| Label | Value | Source |
|---|---|---|
| `학력` | `cv.edu` | `cvSummaryOf(profile, today)` |
| `경력` | `cv.career` | `cvSummaryOf(profile, today)` |
| `자격` | `{n}건`, then ` · {name} D{d}` per held certification, highest D first (unknown D last) | `heldCertsOf(state)` |
| `시험` | `{n}건`, then ` · {exam name} {band} D{d}` per `exams.best` row, highest D first | `state.exams?.best`, name from `examOf(id)?.n` falling back to the id |
| `포트폴리오` | `{n}건` | `(state.folio || []).length` |
| `성취` | `트로피 {t}개 · 검증된 성취 {a}건 ›` (button → `onWall`) | trophy count from `state.room?.trophies`, achievement total summed over `state.areas[].achievements` |

A truncated row is never the only place a name lives: every held certification and exam best is listed in full in `ProfileModal`'s `보유 기록`, and the wall modal lists every trophy, specialisation and achievement. `cvSummaryOf` and `heldCertsOf` are module-level helpers placed right after `displayName`, both derived at render and stored nowhere:

- **`cvSummaryOf(profile, today)`** → `{ any, edu, career }`. Shared with the assistant packet ([assistant-bridge.md](../design-docs/assistant-bridge.md)) so the two can never state a different degree or role: `edu` = `{degree} {status} · {major || field || "전공 미기재"}` (degree fallback `학력`), or `학력 미입력` without an education entry; `career` = `실무 {careerText(careerMonths(careers, today))} · 최근 {role}`, or `경력 없음` without one; `any` says there is an education or a career entry at all. It reads neither `edus[].school` nor `careers[].company` — see the packet's own privacy note.
- **`heldCertsOf(state)`** → `[{ n, d }]`, one entry per name, highest D first (unknown last), then name — every name in `profile.certs` (declared at onboarding, D from `certOf`) merged with every done `isCert` task (proven with a certificate photo, name from `certByTitle` — longest name first, [Rule 15](../design-docs/core-beliefs.md#rule-15) — D from `task.certD`). `profile.certs` is written only at onboarding, so before this helper existed a certification proven inside the app was never counted as held; `heldCertsOf` closes that gap. `ProfileModal`'s `보유 기록` `자격 {n}건` line reads the same helper, so the CV and the profile screen cannot disagree ([TD-42](../exec-plans/tech-debt-tracker.md): the merged list carries no marker telling a declared name apart from a proven one). `demoState` deliberately carries no `profile.certs` and no done `isCert` task, so the demo CV's `자격 0건` is a true fact about that save, not an oversight — adding one would need a matching `certBest` prefill for a stage-group certification ([Rule 3](../design-docs/core-beliefs.md#rule-3)).

### Grades
`SectionLabel` `영역 등급`, then one `AreaGradeRow({ area, onPromote })` per `state.areas` entry — the growth tab's former row, moved verbatim: grade box, `{name}`, `등급 {cur.name} · 다음 관문 {next.name}` (or `정점 도달` at grade 9), `{grade}/9`. With a next rank the **row is the button** (`Lock`, `›`) → `onPromote(area)` opens `PromoteModal`; at grade 9 the row is a plain `div` with `Trophy` and no press state (`PromoteModal` returns `null` there). This is the only control on home that promotes — nothing else does ([Rule 11](../design-docs/core-beliefs.md#rule-11)). `PromoteModal`, `promoteArea`, `EvidencePicker` and `composeEvidence` are unchanged; mechanics: [evidence-and-promotion.md](../design-docs/evidence-and-promotion.md).

## The proximity line
The second and last child of `<main>`, outside the card. With `rg = roleGap(state)`: a full-width button reading `롤모델 근접도` · `{rg.match}%` (`font-mono font-bold text-cyan-300`) · `· {rg.name}` (truncated) · `›` → `onRoleAdvice` opens `RoleAdviceModal`. Without a usable role (`rg === null` — no role model, no target above 0, or a role whose every target area is excluded, [TD-11](../exec-plans/tech-debt-tracker.md)): the inert fact `롤모델 미설정 — 근접도 계산 대상 없음`, not a button — the role model is set from `설정`, not from this line, and `RoleAdviceModal` has nothing to explain without one ([TD-29](../exec-plans/tech-debt-tracker.md)). Formula, demo numbers and the segmented-bar mechanics: [metrics-and-role-model.md](../design-docs/metrics-and-role-model.md).

## `SettingsModal` (`modal.type: "settings"`)
Opened by the CV's corner button. Title `설정`, a bottom sheet like every other modal — chosen over a sixth tab for the same reason `ProfileModal` is a modal: opened rarely, one modal slot, the `Modal` shell already scrolls. Two sections, both moved verbatim from the former growth tab's collapsed panels:
- `롤모델`: the button `{state.role ? "롤모델 수정" : "롤모델 설정"}` → `onRoleModel` (`setModal({ type: "role" })`, `RoleModelModal`) with its explanatory line underneath.
- `데이터 — 백업 · 초기화`: the backup sentence, `백업 내보내기` → `exportBackup`, `백업 불러오기` → `askImport`, then `데이터 초기화` → `onReset`. No `<input type="file">` inside the modal — `askImport` drives the one hidden input mounted on `Shell` (R-14, [tech-debt-tracker.md](../exec-plans/tech-debt-tracker.md)), so the modal closing mid-pick cannot take it down. The root wires `onReset={() => { setModal(null); resetAll(); }}` — `resetAll` never clears `modal` itself, so without the explicit close the sheet would reappear over the app after the next onboarding or demo entry. `resetAll` is otherwise byte-identical and still asks nothing before it runs ([TD-26](../exec-plans/tech-debt-tracker.md), unresolved).

Backup and reset mechanics (file shape, validation, toasts): [install-and-backup.md](install-and-backup.md).

## `AchievementWallModal` (`modal.type: "wall"`)
Opened by the CV's `성취` row. Title `성취의 벽`, read-only — the former growth tab's wall, moved verbatim. First line: `트로피 {t}개 · 시험 {e}개 · 검증된 성취 {a}건`. Then, in order: the empty state when there is neither a trophy nor an exam best; the last 10 trophies (`slice(-10)`) inside `WallFrame`; a line per language specialisation (`🎖 {lang} 전문화 — 고난도 감쇠 하한 70%`, [Rule 2](../design-docs/core-beliefs.md#rule-2)); every `exams.best` row with its D and cumulative P; one block per area, newest 30 achievements first. The CV states the counts and this sheet holds every earned item — nothing earned becomes unreachable ([Rule 13](../design-docs/core-beliefs.md#rule-13)).

## Where everything went, and why
| Today (before 2026-09-15) | After |
|---|---|
| `onPromote` → `PromoteModal`, growth area row | CV grade row (`AreaGradeRow`, on home) |
| `onRoleModel` → `RoleModelModal`, growth headline button | `SettingsModal`'s `롤모델 설정` / `롤모델 수정`; also the briefing's no-role `다음 단계` line |
| `onRoleAdvice` → `RoleAdviceModal`, growth `방향 제안` button | the home proximity line (when `rg` exists); the briefing's `다음 단계` line, unchanged |
| per-area proximity lines and squared bars, growth headline | first block of `RoleAdviceModal` |
| `onExport` / `onImport`, growth data section | `SettingsModal` |
| `onReset` → `resetAll`, growth data section | `SettingsModal`, with `setModal(null)` fired first |
| trophy strip, specialisation lines, exam bests, per-area achievement lists, growth `성취의 벽` | `AchievementWallModal` from the CV's `성취` row; the CV states only the counts |
| `브리핑 열기 ›`, home's `오늘 브리핑` card | `실행` tab header chip row ([tasks.md](tasks.md), [daily-briefing.md](daily-briefing.md)) |
| `일지 쓰기` / `주간 리뷰`, home card buttons | inside `BriefingModal` (unchanged) |
| `오늘 할 일` rows and their completion control | `실행` tab rows and the briefing's `오늘 할 일` lines, both through `tryComplete` |
| goal progress and pace, `오늘의 초점` | `목표` cards, and the briefing's `목표 페이스` (user decision) |
| today's schedule and business counts, home card | `일정` header, `사업` header, `실행` header, briefing sections |
| held certifications and exam bests, full list | still `ProfileModal`'s `보유 기록` — now also counting certifications earned in-app, not just declared at onboarding |

The former `성장` tab itself is retired; its content map is also kept, briefly, at [growth.md](growth.md) for anything still linking there.

## `ProfileModal` (`modal.type: "profile"`) — the CV as a screen
`ProfileModal` is unchanged except for one line: `보유 기록`'s `자격 {n}건` now reads `heldCertsOf(state)` (above) instead of `profile.certs` alone, so it cannot disagree with the CV. Everything else — the photo, the personal facts, the education/career record sections, validation, `saveProfile`'s nine-field write, the no-rescore guarantee — is documented in full in the previous revision of this file and is reproduced here unchanged.

Title `프로필`. Opens with `학력·경력을 고쳐도 시작 등급은 바뀌지 않아요. 승급은 관문 증거로만 올라가요.` — editing the CV is never a promotion path ([Rule 4](../design-docs/core-beliefs.md#rule-4), [Rule 11](../design-docs/core-beliefs.md#rule-11)).

| Section | Contents |
|---|---|
| `사진` | `Portrait` at size 64, `사진 등록` / `사진 삭제`, both driving the root's `askUpload("profile")` hidden input on `Shell` — the modal declares no file input of its own. |
| `인적사항` | `이름`, `닉네임 (선택)`, `생년월일` (with `ageText` printed beneath it), `성별`, `현재 신분`, `이메일 (선택)`, `연락처 (선택)`. |
| `학력` | `CvSection kind="edu"`, the same list-plus-add-form onboarding step 0 uses ([new-user-onboarding.md](new-user-onboarding.md)). |
| `경력` | `CvSection kind="career"`, plus the derived line `합산 실무 {careerText(careerMonths(careers, today))}`. |
| `보유 기록` (read-only) | `자격 {n}건` from `heldCertsOf(state)`; `시험 성적 {n}건` from `state.exams.best`; `포트폴리오 {n}건` from `state.folio`; `없음` when empty. Note: `여기서는 고칠 수 없어요 — 자격·시험은 목표의 핵심결과에서, 포트폴리오는 사업 탭에서 관리해요.` |

Validation on `저장`, in order: name empty → `이름을 입력해 주세요.`; birth empty → `생년월일을 입력해 주세요.`; birth malformed → `생년월일 형식이 올바르지 않아요 — YYYY-MM-DD로 입력해요.`; birth after today → `생년월일이 오늘보다 뒤예요.`; gender or status missing → `성별과 현재 신분을 선택해 주세요.`; no education entry → `학력을 1개 이상 추가해 주세요.`; malformed e-mail → `이메일 형식이 올바르지 않아요.`

`저장` calls `onSave` with exactly nine fields (`name, nick, birth, gender, status, email, phone, edus, careers`); `saveProfile` merges only those into `state.profile` — it never touches `edu`, `career`, `certs`, `examsOwned`, `look`, or any `areas[].grade`. A CV edited after onboarding moves no grade ([Rule 4](../design-docs/core-beliefs.md#rule-4), [Rule 11](../design-docs/core-beliefs.md#rule-11)), proven by a mutation-tested E2E step (`profile modal — a CV edit never moves a grade`). Toast `프로필을 저장했어요`. Closing without saving discards every change.
