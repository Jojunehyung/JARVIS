# Plans — prompt-first protocol and exec plans
<!-- src: KP --><!-- src: SPEC-12 -->

Every task request produces a written plan **before** any edit. The plan's core is a program-specific **prompt** — the exact instruction the executing agent runs — so that constraints, acceptance criteria, and verification are decided up front rather than discovered mid-edit. The routing of agents is in `AGENTS.md` §3.

## Protocol
1. **Detect.** A request that contains 해줘 / 주세요 (the `UserPromptSubmit` hook injects this protocol) or an imperative (implement, add, fix, change, refactor, translate, optimise) is a task.
2. **Plan before edit.** The `planner` agent writes `docs/exec-plans/active/<YYYY-MM-DD>-<slug>.md` from the template below. Trivial task (≤ 1 file, ≤ 20 lines, no rule touched) → a 3-line inline plan — still before any edit.
   **The plan is written in English**, whatever language the request used — including its `Prompt` section, the summary shown to the user, and every delegation prompt. Korean appears only where AGENTS.md §6 requires it, quoted verbatim in backticks. `npm run docs:check` fails on Korean prose in a file under `docs/exec-plans/`.
3. **Show** the user a ≤ 10-line summary (plan path, agents, rules touched, approval needed?).
4. **Execute immediately.** Ask the user first only when the plan touches rules 1–19 data (`CERTS`/`EXAMS`/matrix rows), `migrate` blocks, `liferpg-*` keys, or deletes user data (`needs-approval: true`).
5. **Finish protocol** (AGENTS.md §5): cleanup → verifier → docs-syncer → report with a proposed commit message. Commits happen only at user-approved gates.

## Exec-plan template
Written in English; Korean only inside backticks (UI copy, data names).

```markdown
# <Title>
- Status: active | completed
- Date: YYYY-MM-DD
- Needs approval: yes/no (why)
- Agents: planner → implementer | data-curator → cleanup → verifier → docs-syncer

## Goal
One paragraph: the user's request in product terms and the intended outcome.

## Context read
Files/symbols (from ARCHITECTURE.md anchors), rules touched by number (core-beliefs.md#rule-n), conventions (FRONTEND.md), specs (product-specs/*.md).

## Prompt
The exact prompt the executing agent runs. Program-specific: goal, files and symbols, constraints (rules, conventions, language policy), acceptance criteria (observable behaviour, E2E step to add), verification commands, finish protocol.

## Steps
1. …
2. …

## Verification
`npm run verify` (add `-- --smoke` for engine/data), `npm run docs:check`, manual checks if any.

## Cleanup checklist
- [ ] `npm run finish` exit 0 (unused symbols/imports, duplicates, residue, language)
- [ ] allowlist additions (with reason) mirrored in tech-debt-tracker.md

## Docs to sync
Which of ARCHITECTURE.md, product-specs, design-docs, generated (docs:gen), decision-log, tech-debt-tracker, backlog change.

## Proposed commit
type(scope): summary
```

Completed plans move to `docs/exec-plans/completed/` and are linked from `docs/design-docs/decision-log.md`. The backlog of not-yet-planned work is `docs/exec-plans/backlog.md`; known defects and intentional debt are in `docs/exec-plans/tech-debt-tracker.md`.

## Example prompts (Korean requests are fine; the plan is English)
- File split (backlog 3): "백로그 3번을 진행해줘. `calcExamPayout`, `krProgress`, `migrate`에 단위 테스트를 먼저 만들고, 테스트가 통과하는 상태를 유지하면서 data/engine/components로 분리해."
- Weekly review (backlog 4): "주간 리뷰 플로우를 기획부터 제안해줘. 지표 체크인(MetricsModal)을 확장하는 방향으로."
- Before any feature: "불변 규칙(core-beliefs)과 충돌하는지 먼저 확인하고 시작해."
- Data change: "○○기사 신설을 반영해줘 — 시행일·근거 URL 포함" → planner marks `needs-approval`, data-curator executes with `HARNESS_DATA_EDIT=1`.

## First-session kickoff (historical)
The original kickoff (Vite scaffold → move the JSX → storage shim → smoke → commit) was completed on 2026-09-03; see `docs/exec-plans/completed/2026-09-03-storage-shim-and-vite.md`. New sessions start from `CLAUDE.md` → `AGENTS.md`.
