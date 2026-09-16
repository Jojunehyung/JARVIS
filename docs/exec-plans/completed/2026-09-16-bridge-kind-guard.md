# Assistant bridge — the title decides the activity kind, not the reply

- Status: completed
- Date: 2026-09-16
- Needs approval: no — no `CERTS` / `EXAMS` / `WEIGHT_MATRIX` / `CERT_W_EXC` row, no `migrate` block, no `v` bump, no `liferpg-*` key, no user data deleted, no rule text amended. The fix enforces rule text that already exists ([Rule 7](../../design-docs/core-beliefs.md#rule-7) amendment, [Rule 17](../../design-docs/core-beliefs.md#rule-17), [Rule 18](../../design-docs/core-beliefs.md#rule-18), [Rule 19](../../design-docs/core-beliefs.md#rule-19) amendment). The user approved the fix after a feasibility analysis.
- Agents: planner → implementer → cleanup → verifier → docs-syncer

## Goal

A pasted assistant reply can currently smuggle an appointment-shaped task into a goal. `parseAssistantReply` trusts the reply's own `kind` field whenever the title carries no reading or exercise word, so a proposal such as `{"goal":"하네스 설계 엔지니어 취업","title":"견적서 송부","kind":"book"}` passes every validation and is imported as a `독서` task. That is exactly what the [Rule 19](../../design-docs/core-beliefs.md#rule-19) amendment of 2026-09-11 forbids (a normal task must genuinely be reading or exercise; appointment-shaped work belongs to the `일정` tab) and it breaks the [Rule 7](../../design-docs/core-beliefs.md#rule-7) amendment's promise that a reply's proposals enter through the normal task path and its gates. After this change the activity kind comes from `detectKind(title)` alone, at both the parse and the import boundary; the packet tells the assistant to write the activity into the title, so a well-behaved reply is not silently refused; and two E2E steps grow assertions that pin the guard down without changing the step count.

## Context read

Code, re-read on 2026-09-16 (`src/LifeManager.jsx`, ~7,400 lines):

| Symbol | Lines | What is there today |
|---|---|---|
| `detectKind` | 1099–1104 | `/독서|책\s?읽|북클럽/` → `book`, `/운동|헬스|러닝|조깅|필라테스|요가|웨이트|수영/` → `fit`, else `""` |
| `PACKET_HEAD` | 2689–2698 | rule 3 at 2693, the JSON template string at 2696 (carries `,"kind":"book|fit"`), fenced block at 2695/2697 |
| `buildAssistantPacket` | 2700–2760 | builds `PACKET_HEAD` + sections, trims journal lines to `PACKET_MAX` 4000 |
| `parseAssistantReply` | 2765–2788 | `const dk = detectKind(title);` / `const kind = dk || (["book", "fit"].includes(t?.kind) ? t.kind : undefined);` (2779–2780); rejects at 2782–2784; `IMPORT_MAX` 5 (2764) |
| `BridgeModal` | 4412–4423, 4444–4471 | `check()` auto-picks every proposal with no `reject` and a matched `goalId`; a rejected row is `opacity-50`, its checkbox `disabled`, its reason in `text-rose-400` |
| `importTasks` | 7006–7023 | spreads `...(p.kind ? { kind: p.kind } : {})` onto the new task without re-deriving it; toast counts `list.length` |

E2E: `tools/e2e/flow5.js` reply fixture 145–155, validation asserts 159–162, import asserts 165–191; `tools/e2e/flow8.js` business paste step 375–417 (reply 395–406, comparison loop 413–416). `tools/e2e/run.js` `step()` records a failure and continues — a mutation can fail more than one step.

Docs: `docs/design-docs/assistant-bridge.md` (validation table row `kind`, line 90; refusal paragraph 92; the packet-rules sentence at 63; the closing paragraph 97), `docs/product-specs/daily-briefing.md` (`BridgeModal`, line 36), `docs/RELIABILITY.md` (flow rows 25 and 27, the step-count and mutation paragraphs 32–34), `tools/e2e/README.md` (rows 32 and 34), `docs/design-docs/decision-log.md`, `docs/exec-plans/tech-debt-tracker.md`, `ARCHITECTURE.md` §File regions row `Daily assistant` (no change expected — no symbol is added, removed or moved).

Rules touched: [7](../../design-docs/core-beliefs.md#rule-7) (amendment: a reply only proposes, through the normal path and its gates), [13](../../design-docs/core-beliefs.md#rule-13) (the refusal copy states a fact, the toast counts what was really registered), [17](../../design-docs/core-beliefs.md#rule-17) (activity kinds, title/kind mismatch blocks registration, kind tasks stay ≤ C), [18](../../design-docs/core-beliefs.md#rule-18) (`goalId` mandatory, one-day size), [19](../../design-docs/core-beliefs.md#rule-19) + its 2026-09-11 amendment (a normal task needs a book/fit kind; the count-KR carve-out is `AddTaskModal` state only and is not reachable from the bridge). Explicitly not touched: [1](../../design-docs/core-beliefs.md#rule-1), [4](../../design-docs/core-beliefs.md#rule-4), [6](../../design-docs/core-beliefs.md#rule-6), [9](../../design-docs/core-beliefs.md#rule-9), [10](../../design-docs/core-beliefs.md#rule-10), [12](../../design-docs/core-beliefs.md#rule-12), [15](../../design-docs/core-beliefs.md#rule-15), [16](../../design-docs/core-beliefs.md#rule-16).

### Fixture audit — does any existing reply fixture rely on a reply-declared `kind`?

No. Every pasted-reply fixture in the suite (`AI 답변 붙여넣기` appears only at `flow5.js` 142 and 195 and `flow8.js` 393) was checked line by line:

| Fixture | Title | `kind` in the reply | Outcome today | Outcome after the fix |
|---|---|---|---|---|
| flow5 149 | `기술 서적 30분 독서` | absent | `book` from the title | unchanged |
| flow5 150 | `아침 러닝 30분` | absent | `fit` from the title (`러닝`) | unchanged |
| flow5 151 | `전기기사 취득` | absent | refused, `자격·시험 실행은 목표의 KR에서만 등록돼요` | unchanged (the cert check runs first) |
| flow5 152 | `도면 기호 복습` | absent | refused, `활동 유형 없는 실행은 일정 탭에서 관리해요` | unchanged |
| flow5 196 | reply with no JSON block | — | stored as text only | unchanged |
| flow8 399 | `재고 관리 자동화 도구 유지보수 계약` | absent | refused (no kind); the step imports nothing | unchanged |

No fixture has to be edited to keep passing; the only fixture edits are the new ones this plan adds.

### E2E assertions that read the packet text or the template

| Where | Reads | Must change? |
|---|---|---|
| `flow5.js` 132–136 | `[인생 관리`, the goal title, `E2E 일지`, the 4,000-char cap | no |
| `flow7.js` 208–213 | `## 다가오는 일정 (14일)`, its position, two event lines, the cap | no |
| `flow8.js` 377–390 | the `## 사업 (계약·매출)` heading and its position, two business lines, `계약·단가·포트폴리오는 제안하지 않아요`, the cap | no — rule 3's closing sentence is deliberately left byte-identical, which is why the new sentence is inserted in the middle |
| `flow8.js` 424–434 | the `## 이력` line and the absent identifying fields | no |

Nothing in the suite asserts the JSON template line, so removing `,"kind":"book|fit"` breaks no assertion. Size: rule 3 grows by ~24 characters and the template shrinks by 18, a net ~+6 against `PACKET_MAX` 4000 — the three cap assertions stay green.

## Prompt

> Fix a validation hole in the assistant bridge of Life Manager (`src/LifeManager.jsx`, Vite + React, one file). A pasted reply can label any title with `"kind":"book"` and have it imported as a `독서` task under a goal; the activity kind must come from the title alone. Read `docs/design-docs/core-beliefs.md` rules 7, 13, 17, 18, 19 and `docs/FRONTEND.md` before editing. Do not change any UI copy other than the one `PACKET_HEAD` rule line named below, do not touch `migrate`, the schema version, any `store` call site, any `liferpg-*` key, any data table, or any rule text. No schema change: this adds no state field.
>
> **1. `parseAssistantReply` (around L2765–2788).** Replace the two lines
>
> ```js
> const dk = detectKind(title);
> const kind = dk || (["book", "fit"].includes(t?.kind) ? t.kind : undefined);
> ```
>
> with a single derivation from the title, and say why in a comment above it (English): the reply's own `kind` is never read, because a title that does not name the activity is an appointment and belongs to the `일정` tab (rules 17, 19). Keep `undefined` rather than `""` so the proposal object's shape is unchanged:
>
> ```js
> const kind = detectKind(title) || undefined;
> ```
>
> The reject chain at L2782–2784 is untouched: a proposal whose title yields no kind still falls to the existing `else if (!kind) reject = "활동 유형 없는 실행은 일정 탭에서 관리해요";`. A reply that still sends a `kind` field is ignored, not treated as an error.
>
> **2. `PACKET_HEAD` (L2689–2698).** The assistant cannot see `detectKind`'s word list, so tell it instead of refusing it silently. Two in-place edits, no line added or removed, so the numbering `1)`–`4)` and the fenced block below keep their positions:
> - L2693, rule 3 — insert one sentence between the existing first and last sentences, leaving the trailing `자격·시험 실행과 계약·단가·포트폴리오는 제안하지 않아요.` byte-identical (an E2E step asserts that substring). Compare against the current string and adjust minimally; the intended result is `"3) 제안은 목표에 연결된 하루분량 실행만 가능해요 (난이도 E/D/C). 제목에 독서·운동처럼 활동을 그대로 적어요. 자격·시험 실행과 계약·단가·포트폴리오는 제안하지 않아요."` — `해요체`, facts only (Rule 13).
> - L2696, the JSON template — drop `,"kind":"book|fit"`, since the field is no longer read. The rest of the template string stays exactly as it is.
>
> **3. `importTasks` (around L7006–7023).** A caller that bypasses the parser must not be able to import a mislabelled or kind-less task either. Derive the kind from the title and drop what has none, before `setState`, so the toast still states a true count (Rule 13):
>
> ```js
> // The title decides the kind here too: `parseAssistantReply` already refuses a proposal that names no
> // activity, and a caller that skipped it must not be able to import one (rules 17, 19).
> const kept = list.map((p) => ({ ...p, kind: detectKind(p.title) })).filter((p) => p.kind);
> ```
>
> Build `made` from `kept`, write the kind unconditionally (`kind: p.kind`) in place of `...(p.kind ? { kind: p.kind } : {})`, keep `...(p.due ? { due: p.due } : {})` as it is, and count `kept.length` in the toast instead of `list.length`. Both existing toast strings stay verbatim: `AI 제안 {n}건 등록 · 일지에 답변 저장` and `AI 답변을 일지에 저장했어요 — 제안 실행 없음`. `upsertReply(s, raw)` still runs on every call, so a reply whose every proposal was dropped is still stored on the journal entry.
>
> **4. E2E — fold assertions into existing steps; the suite must still report 157 steps.** Selector and assertion arguments are Korean UI copy and are never translated.
> - `tools/e2e/flow5.js`, reply fixture at L148–153: append a fifth proposal `{ goal: "하네스 설계 엔지니어 취업", title: "견적서 송부", kind: "book" }` (fifth and last — `IMPORT_MAX` is 5, so a sixth would be silently dropped and the check would go vacuous). Add a comment naming what it is: a business errand the reply labels as reading.
> - Same file, step `pasted reply is validated before import` (L141–163): after the existing `expectText` calls, add a row-scoped assertion — the `.fixed.inset-0` row whose title reads exactly `견적서 송부` must carry `활동 유형 없는 실행은 일정 탭에서 관리해요` and a `disabled` checkbox. A bare `expectText` is not enough: `도면 기호 복습` already puts that string on the screen, so the assertion must read that one row (find the row element from its title node, then read its text and its `input[type="checkbox"].disabled`) and throw with the row's text when it fails.
> - Same file, step `confirmed proposals become tasks; cert proposal is refused` (L165–191): beside the existing `도면 기호 복습` assertion, assert no task titled `견적서 송부` exists in the save afterwards, with the same throw style.
> - `tools/e2e/flow8.js`, step `the packet carries the business section and a pasted reply creates nothing` (L375–417): add `events` to the list compared before and after (L413 becomes `["deals", "rates", "folio", "events"]`), and add one `events` entry to the pasted reply JSON (L398–404) so the new comparison is non-vacuous, exactly as the `deals` / `rates` / `folio` keys already make theirs — a plain appointment-shaped record (title, `kind: "appt"`, a date, a time) that must not land anywhere. `docs/design-docs/assistant-bridge.md` states a reply can never touch an event; this is the assertion behind that sentence. Update the step's comment to name events alongside the business lists.
> - Add no step and delete none: `npm run verify` must report **157 steps**.
>
> **5. Mutation check (run it, then revert).** Restore the old line `const kind = dk || (["book", "fit"].includes(t?.kind) ? t.kind : undefined);` (with its `const dk = detectKind(title);`) and re-run `npm run verify`. Expected: `pasted reply is validated before import` fails, because `견적서 송부` is no longer refused — that is the step whose failure proves the new assertion. Because `run.js`'s `step()` records a failure and continues, the row is then auto-picked and imported, so `confirmed proposals become tasks; cert proposal is refused` fails too; both failures are expected and no other step may fail. Revert the mutation, re-run, and report the numbers from both runs in the finish report.
>
> **Acceptance criteria.**
> - A pasted reply proposing `{"goal":"<an active goal>","title":"견적서 송부","kind":"book"}` shows the greyed row with `활동 유형 없는 실행은 일정 탭에서 관리해요` and cannot be checked; confirming the other proposals creates no task titled `견적서 송부`.
> - A reply proposing `기술 서적 30분 독서` or `아침 러닝 30분` still imports, with `kind` `book` / `fit` and the goal inherited as before.
> - The packet's rule 3 names the title requirement, its JSON template no longer offers `kind`, the packet stays under 4,000 characters and `계약·단가·포트폴리오는 제안하지 않아요` is still present verbatim.
> - `importTasks` called with a kind-less entry creates nothing for it and the toast states the number actually registered.
> - No diff hunk inside `migrate`, `store`, `CERTS`, `EXAMS`, `WEIGHT_MATRIX`, `CERT_W_EXC`, `demoState`, or `docs/design-docs/core-beliefs.md`.
>
> **Verification.** `npm run verify` → 157 steps, 0 failed, 0 console errors. `npm run lang:check` clean. `npm run finish` exit 0. `npm run docs:gen && npm run docs:check` exit 0. `--smoke` is **not** required (no payout formula, data table, matrix cell, grade cut or `.ics` builder is touched; `smoke-logic.js` does not lift `parseAssistantReply`, `importTasks` or `PACKET_HEAD`). `npm run build:demo` and `node tools/harness/gen-screenshots.js` are **not** required: `gen-screenshots.js`'s `SHOTS` are `home.png` / `tasks.png` / `goals.png` / `calendar.png` (tabs `홈`, `실행`, `목표`, `일정` + `달력`), the script closes the briefing before the first shot and never opens `AI에게 보내기`, so no manifest screenshot contains packet text; the four committed files under `public/screenshots/` stay as they are and `release/` is gitignored.
>
> **Finish protocol.** cleanup (`npm run finish` exit 0; any allowlist entry mirrored in `docs/exec-plans/tech-debt-tracker.md`) → verifier (`npm run verify`) → docs-syncer (the list under "Docs to sync", `npm run docs:gen`, `npm run docs:check`, then move this plan to `docs/exec-plans/completed/`). Report what changed, the commands with their results, both mutation-run results, and the proposed commit message. Do not commit.

## Steps

1. `src/LifeManager.jsx` — `parseAssistantReply` kind derivation (Prompt §1).
2. `src/LifeManager.jsx` — `PACKET_HEAD` rule 3 and the JSON template, in place (Prompt §2).
3. `src/LifeManager.jsx` — `importTasks` re-derivation, filter and toast count (Prompt §3).
4. `tools/e2e/flow5.js` — the fifth proposal, the row-scoped refusal assertion, the save assertion (Prompt §4).
5. `tools/e2e/flow8.js` — the `events` entry in the reply and in the comparison list (Prompt §4).
6. Mutation check and revert (Prompt §5).
7. Finish protocol: cleanup → verifier → docs-syncer.

## Verification

- `npm run verify` → 157 steps, 0 failed, 0 console errors (no `--smoke`; reason in the Prompt).
- `npm run finish` → exit 0.
- `npm run lang:check` → clean.
- `npm run docs:gen && npm run docs:check` → exit 0.
- Mutation run: exactly `pasted reply is validated before import` and, as a knock-on, `confirmed proposals become tasks; cert proposal is refused` fail; reverted afterwards.
- Manual: paste a reply whose JSON block carries `{"goal":"<active goal>","title":"견적서 송부","kind":"book"}` and confirm the row is greyed with the refusal reason and cannot be checked.
- Not run: `npm run build:demo`, `node tools/harness/gen-screenshots.js` (no manifest screenshot shows packet text — verified against `SHOTS` in `tools/harness/gen-screenshots.js`).

## Cleanup checklist

- [ ] `npm run finish` exit 0 (unused symbols/imports, duplicates, residue, language) — watch for a now-unused `dk` binding in `parseAssistantReply`
- [ ] allowlist additions (with reason) mirrored in tech-debt-tracker.md — none expected

## Docs to sync

| File | Change |
|---|---|
| `docs/design-docs/assistant-bridge.md` | Validation table row `kind` (line 90): the kind comes from `detectKind(title)` only, a reply-declared `kind` is ignored. Refusal paragraph (92): unchanged wording plus the note that the same derivation runs again in `importTasks`. Packet-rules sentence (63) and the reply paragraph (94): rule 3 now asks for the activity in the title and the JSON template no longer carries `kind`. Closing paragraph (97): the event claim is now backed by an assertion, not only by "reads `tasks` and nothing else". |
| `docs/product-specs/daily-briefing.md` | `BridgeModal` paragraph (line 36): one clause — the import re-derives the kind from the title and registers only the rows that yield one, which is the number the toast states. |
| `docs/RELIABILITY.md` | `flow5.js` and `flow8.js` rows (25, 27): the new assertions (a business errand labelled `"kind":"book"` refused and never imported; a pasted reply naming an event as well as a deal, a rate and a portfolio entry). Mutation paragraph (32–34): this check and the step it fails. Step count stays 157 — say it is unchanged, with the assertions folded into existing steps. |
| `tools/e2e/README.md` | Scenario rows for `flow5.js` (32) and `flow8.js` (34), matching the RELIABILITY wording. |
| `docs/design-docs/decision-log.md` | One dated 2026-09-16 row: the reply's `kind` is no longer trusted at either boundary, the packet asks for the activity in the title, why no rule was amended (it enforces rules 7/17/18/19 as written), E2E steps unchanged at 157, link to this plan in `completed/`. |
| `docs/exec-plans/tech-debt-tracker.md` | One Resolved row: the defect (a reply-declared `kind` overrode the title check, so a business errand entered a goal as a `독서` task), how it was found (code review of the bridge against the Rule 19 amendment, 2026-09-16 — no E2E covered it), and the fix (kind from `detectKind(title)` at parse and import, packet rule 3 rewritten, two E2E steps extended, mutation-checked). |
| `docs/generated/*` | `npm run docs:gen` (symbol-index line numbers shift where `importTasks` grows). Never hand-edited. |
| `ARCHITECTURE.md` | No change expected — no symbol added, removed or moved; confirm the status line still reads E2E 157 and the `Daily assistant` region row is still accurate. |

## Proposed commit

fix(bridge): take a proposal's activity kind from its title, never from the reply
