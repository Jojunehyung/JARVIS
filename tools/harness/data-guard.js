// PreToolUse hook (Edit|MultiEdit): rows of the frozen data tables in src/LifeManager.jsx
// (CERTS entries, EXAMS bands, WEIGHT_MATRIX / CERT_W_EXC cells) may only be edited by the
// data-curator agent, which sets HARNESS_DATA_EDIT=1. Enforces core-beliefs rules 6 and 15 mechanically.
const ROW_PATTERNS = [
  /\{\s*n:\s*"[^"]+",\s*d:\s*\d+/,          // CERTS row
  /bands:\s*\[\s*\[/,                          // EXAMS band table
  /^\s*"[^"]+":\s*\{[^}]*"[SABC]"/m,           // WEIGHT_MATRIX / CERT_W_EXC row
  /TIER_MULT\s*=\s*\{/,
];

let input = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (c) => (input += c));
process.stdin.on("end", () => {
  try {
    if (process.env.HARNESS_DATA_EDIT === "1") return;
    const j = JSON.parse(input || "{}");
    const fp = String(j.tool_input?.file_path || "");
    if (!/LifeManager\.jsx$/.test(fp)) return;
    const edits = j.tool_input?.edits || [j.tool_input];
    const touched = edits.some((e) => ROW_PATTERNS.some((re) => re.test(String(e?.old_string || "")) || re.test(String(e?.new_string || ""))));
    if (!touched) return;
    process.stdout.write(JSON.stringify({
      hookSpecificOutput: {
        hookEventName: "PreToolUse",
        permissionDecision: "deny",
        permissionDecisionReason: "data-guard: this edit touches a frozen data row (CERTS/EXAMS/WEIGHT_MATRIX/CERT_W_EXC). Rules 6/15 — only the data-curator agent may change these, with evidence, running with HARNESS_DATA_EDIT=1.",
      },
    }));
  } catch { /* never block on our own error */ }
});
