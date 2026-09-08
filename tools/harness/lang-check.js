// Language policy check: English everywhere except UI copy and Korean-required data.
// Flags Hangul inside comments (src/, tools/) and, for tools/e2e, inside step names / error messages / logs.
// Selector-helper arguments (text that must match Korean UI copy) are allowed.
//
// Modes:
//   node lang-check.js                 report all findings (exit 0)
//   node lang-check.js --strict        exit 1 when findings remain
//   node lang-check.js --file <path>   check one file
//   node lang-check.js --hook          PostToolUse hook: read tool_input.file_path from stdin, warn only
const fs = require("fs");
const path = require("path");
const { ROOT, listSourceFiles, rel } = require("./lib/source");

const HANGUL = /[가-힣]/;
// Functions whose string arguments legitimately contain Korean UI copy (E2E selectors/assertions).
const SELECTOR_FNS = ["clickText", "clickInModal", "clickInModalExact", "assertDone", "completeQuest", "clickTab", "hasText", "expectText", "typeInto", "typeExact", "findByText", "includes", "startsWith", "test", "match", "innerText"];
const E2E_MSG_FNS = /\b(step|Error|console\.log|errors\.push|log)\s*\(\s*([`"'])/;

// Remove string/template literal bodies and JSX text so only code + comments remain.
function stripStrings(line) {
  return line
    .replace(/`(?:\\.|[^`\\])*`/g, "``")
    .replace(/"(?:\\.|[^"\\])*"/g, '""')
    .replace(/'(?:\\.|[^'\\])*'/g, "''")
    .replace(/>[^<>{}]*</g, "><");
}

function scanFile(file) {
  const text = fs.readFileSync(file, "utf8");
  const lines = text.split("\n");
  const findings = [];
  let inBlock = false;
  const isE2E = rel(file).startsWith("tools/e2e/");
  lines.forEach((raw, i) => {
    const lineNo = i + 1;
    let line = stripStrings(raw);
    let commentText = "";
    // Block comment state machine (after string stripping, `/*` inside strings is gone).
    let rest = line;
    while (rest.length) {
      if (inBlock) {
        const end = rest.indexOf("*/");
        if (end < 0) { commentText += rest; rest = ""; break; }
        commentText += rest.slice(0, end); rest = rest.slice(end + 2); inBlock = false;
      } else {
        const bs = rest.indexOf("/*"), ls = rest.indexOf("//");
        if (bs >= 0 && (ls < 0 || bs < ls)) { rest = rest.slice(bs + 2); inBlock = true; }
        else if (ls >= 0) { commentText += rest.slice(ls + 2); rest = ""; }
        else rest = "";
      }
    }
    if (HANGUL.test(commentText)) findings.push({ file: rel(file), line: lineNo, kind: "comment", text: raw.trim().slice(0, 100) });
    if (isE2E) {
      const m = raw.match(E2E_MSG_FNS);
      if (m) {
        const after = raw.slice(m.index + m[0].length);
        const body = after.split(m[2])[0];
        if (HANGUL.test(body) && !SELECTOR_FNS.some((f) => new RegExp(`\\b${f}\\s*\\(`).test(raw.slice(0, m.index)))) {
          findings.push({ file: rel(file), line: lineNo, kind: "message", text: raw.trim().slice(0, 100) });
        }
      }
    }
  });
  return findings;
}

function scan(files) {
  return files.flatMap(scanFile);
}

function loadAllow() {
  try { return JSON.parse(fs.readFileSync(path.join(__dirname, "finish-allowlist.json"), "utf8")).lang || []; } catch { return []; }
}

function applyAllow(findings) {
  const allow = loadAllow();
  return findings.filter((f) => !allow.some((a) => a.file === f.file && (a.line === f.line || a.line === "*")));
}

if (require.main === module) {
  const args = process.argv.slice(2);
  if (args.includes("--hook")) {
    let input = ""; process.stdin.setEncoding("utf8");
    process.stdin.on("data", (c) => (input += c));
    process.stdin.on("end", () => {
      try {
        const fp = JSON.parse(input || "{}")?.tool_input?.file_path;
        if (!fp || !/\.(js|jsx)$/.test(fp)) return;
        const abs = path.isAbsolute(fp) ? fp : path.join(ROOT, fp);
        const r = rel(abs);
        if (!(r.startsWith("src/") || r.startsWith("tools/")) || !fs.existsSync(abs)) return;
        const f = applyAllow(scanFile(abs));
        if (f.length) console.log(`lang-check: ${f.length} Korean comment/message line(s) in ${r} — ${f.slice(0, 5).map((x) => x.line).join(", ")}. Language policy: English except UI copy and data (AGENTS.md §6).`);
      } catch { /* never block the tool */ }
    });
    return;
  }
  const fileArg = args.indexOf("--file");
  const files = fileArg >= 0 ? [path.resolve(args[fileArg + 1])] : listSourceFiles();
  const findings = applyAllow(scan(files));
  if (!findings.length) { console.log("lang-check: clean"); process.exit(0); }
  const byFile = {};
  for (const f of findings) (byFile[f.file] = byFile[f.file] || []).push(f);
  for (const [file, list] of Object.entries(byFile)) {
    console.log(`${file}: ${list.length}`);
    for (const f of list.slice(0, 40)) console.log(`  ${String(f.line).padStart(5)} ${f.kind.padEnd(8)} ${f.text}`);
    if (list.length > 40) console.log(`  … ${list.length - 40} more`);
  }
  console.log(`lang-check: ${findings.length} finding(s)`);
  process.exit(args.includes("--strict") ? 1 : 0);
}

module.exports = { scan, scanFile, applyAllow };
