// UserPromptSubmit hook: when the user phrases a request as "~해줘" (please do X),
// inject the prompt-first protocol so the plan/prompt is written before any edit.
// Input: JSON on stdin ({ prompt, session_id, ... }). Output: JSON with additionalContext, or nothing.
// Any Korean verb + 줘/주세요/줄래 ("고쳐줘", "추가해줘", "만들어 줘", "정리해주세요") counts as a task request.
const TRIGGER = /[가-힣]\s?줘(?![가-힣])|주세요|줄래|주라|줄\s?수\s?있|부탁/;
const SKIP = /^\s*\/|바로 해|no plan|plan 없이/i;

const PROTOCOL = [
  "PROMPT-FIRST PROTOCOL (AGENTS.md §4, docs/PLANS.md) — this request is phrased as a task.",
  "1. Before editing anything, delegate to the `planner` agent (or, for a trivial task ≤1 file/≤20 lines that touches no rule, write a 3-line inline plan).",
  "2. The plan is a file: docs/exec-plans/active/<YYYY-MM-DD>-<slug>.md with sections Goal · Context read · Prompt (the exact program-specific prompt the executing agent will run, citing constraints and acceptance criteria) · Steps · Verification · Cleanup checklist · Docs to sync · Proposed commit.",
  "3. Show the user a ≤10-line summary of the plan, then execute it immediately — ask first only if the plan touches CERTS/EXAMS/WEIGHT_MATRIX data, migrate blocks, storage keys, or deletes user data.",
  "4. Route work per AGENTS.md §3: implementer (code/docs), data-curator (data tables), reviewer (diagnosis), verifier (build+E2E), docs-syncer (docs after code).",
  "5. Finish protocol is mandatory: cleanup agent → `npm run finish` exit 0 → `npm run verify` → docs sync when src/data changed → report with proposed commit message.",
  "Language policy: English for code comments, docs, commit messages; Korean only for UI copy and Korean data (AGENTS.md §6).",
].join("\n");

let input = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (c) => (input += c));
process.stdin.on("end", () => {
  try {
    const prompt = String(JSON.parse(input || "{}").prompt || "");
    if (!TRIGGER.test(prompt) || SKIP.test(prompt)) return;
    process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: "UserPromptSubmit", additionalContext: PROTOCOL } }));
  } catch { /* never break prompt submission */ }
});
