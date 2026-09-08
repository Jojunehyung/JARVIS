// Documentation integrity: links resolve, exactly 19 canonical rules, agents listed, indexes complete, exec plans in English,
// source-coverage manifest satisfied, generated files fresh, retired filenames absent (--final).
//   node check-docs.js [--final] [--no-links]
const fs = require("fs");
const path = require("path");
const { ROOT, SRC } = require("./lib/source");

const args = process.argv.slice(2);
const problems = [], warnings = [];
const P = (m) => problems.push(m);
const W = (m) => warnings.push(m);
const exists = (p) => fs.existsSync(p);
const read = (p) => fs.readFileSync(p, "utf8");
const rel = (p) => path.relative(ROOT, p).split(path.sep).join("/");

function mdFiles() {
  const out = [];
  const walk = (dir) => { for (const e of fs.readdirSync(dir, { withFileTypes: true })) { if (e.name === "node_modules" || e.name.startsWith(".")) continue; const p = path.join(dir, e.name); if (e.isDirectory()) walk(p); else if (e.name.endsWith(".md")) out.push(p); } };
  for (const f of fs.readdirSync(ROOT)) if (f.endsWith(".md")) out.push(path.join(ROOT, f));
  if (exists(path.join(ROOT, "docs"))) walk(path.join(ROOT, "docs"));
  if (exists(path.join(ROOT, ".claude", "agents"))) walk(path.join(ROOT, ".claude", "agents"));
  return out;
}
const files = mdFiles();

// 1) relative links resolve
if (!args.includes("--no-links")) {
  for (const f of files) {
    const text = read(f);
    for (const m of text.matchAll(/\]\(([^)\s#]+)(#[^)]*)?\)/g)) {
      const target = m[1];
      if (/^(https?:|mailto:|@)/.test(target)) continue;
      const abs = path.resolve(path.dirname(f), target);
      if (!exists(abs)) P(`${rel(f)}: broken link → ${target}`);
    }
    for (const m of text.matchAll(/^@([\w./-]+)$/gm)) if (!exists(path.join(path.dirname(f), m[1]))) P(`${rel(f)}: import @${m[1]} not found`);
  }
}

// 2) canonical rules
const beliefs = path.join(ROOT, "docs", "design-docs", "core-beliefs.md");
if (exists(beliefs)) {
  const nums = [...read(beliefs).matchAll(/^### Rule (\d+)\b/gm)].map((m) => +m[1]);
  if (nums.length !== 19 || nums.some((n, i) => n !== i + 1)) P(`core-beliefs.md: expected "### Rule 1".."### Rule 19" in order, found [${nums.join(",")}]`);
  // rule text must not be restated elsewhere: forbid "### Rule N" headings outside core-beliefs
  for (const f of files) if (f !== beliefs && /^### Rule \d+/m.test(read(f))) P(`${rel(f)}: restates a "### Rule N" heading — link to core-beliefs.md instead`);
} else W("docs/design-docs/core-beliefs.md missing (expected after Phase 2)");

// 3) every agent file appears in AGENTS.md
const agentsMd = path.join(ROOT, "AGENTS.md");
const agentDir = path.join(ROOT, ".claude", "agents");
if (exists(agentsMd) && exists(agentDir)) {
  const text = read(agentsMd);
  for (const f of fs.readdirSync(agentDir).filter((x) => x.endsWith(".md"))) {
    const name = (read(path.join(agentDir, f)).match(/^name:\s*(\S+)/m) || [])[1] || f.replace(/\.md$/, "");
    if (!new RegExp(`\\b${name}\\b`).test(text)) P(`AGENTS.md does not mention agent "${name}" (.claude/agents/${f})`);
  }
}

// 4) indexes list every sibling doc
for (const dir of ["docs/design-docs", "docs/product-specs"]) {
  const abs = path.join(ROOT, dir), idx = path.join(abs, "index.md");
  if (!exists(idx)) continue;
  const text = read(idx);
  for (const f of fs.readdirSync(abs).filter((x) => x.endsWith(".md") && x !== "index.md")) if (!text.includes(f)) P(`${dir}/index.md does not list ${f}`);
}

// 5) source-coverage manifest: every id has a <!-- src: ID --> marker somewhere
const manifestPath = path.join(__dirname, "docs-manifest.json");
if (exists(manifestPath)) {
  const man = JSON.parse(read(manifestPath));
  const corpus = files.map(read).join("\n");
  const markers = new Set([...corpus.matchAll(/<!--\s*src:\s*([\w.-]+)\s*-->/g)].map((m) => m[1]));
  for (const [id, entry] of Object.entries(man.sources || {})) {
    if (entry.status === "pending") continue;
    if (!markers.has(id)) P(`manifest id ${id} (${entry.from}) has no <!-- src: ${id} --> marker in docs`);
  }
  const pending = Object.values(man.sources || {}).filter((e) => e.status === "pending").length;
  if (pending) W(`manifest: ${pending} source id(s) still pending`);
}

// 6) generated docs: header + freshness
const gen = path.join(ROOT, "docs", "generated");
if (exists(gen)) {
  const srcM = fs.statSync(SRC).mtimeMs;
  for (const f of fs.readdirSync(gen).filter((x) => x.endsWith(".md"))) {
    const p = path.join(gen, f);
    if (!/GENERATED/.test(read(p).slice(0, 300))) P(`docs/generated/${f} lacks the GENERATED header`);
    if (fs.statSync(p).mtimeMs < srcM) W(`docs/generated/${f} is older than src/LifeManager.jsx — run npm run docs:gen`);
  }
}

// 7) retired filenames must not be referenced after Phase 5
if (args.includes("--final")) {
  const retired = ["PLANNING.md", "KICKOFF_PROMPT.md", "기획안", "클로드디자인", "LifeRPG"];
  for (const f of files) { const t = read(f); for (const r of retired) if (t.includes(r) && !/decision-log|completed\//.test(rel(f))) P(`${rel(f)}: references retired "${r}"`); }
  for (const r of ["PLANNING.md", "KICKOFF_PROMPT.md"]) if (exists(path.join(ROOT, r))) P(`${r} still exists`);
}

// 8) exec plans are written in English (AGENTS.md §4/§6): Hangul only inside backticks or fenced code
{
  const HANGUL = /[가-힣]/;
  for (const f of files.filter((x) => rel(x).startsWith("docs/exec-plans/"))) {
    const lines = read(f).split("\n");
    let inFence = false;
    lines.forEach((raw, i) => {
      if (/^\s*```/.test(raw)) { inFence = !inFence; return; }
      if (inFence) return;
      const prose = raw.replace(/`[^`]*`/g, "");
      if (HANGUL.test(prose)) P(`${rel(f)}:${i + 1}: Korean prose in an exec plan — write it in English, or quote UI copy/data in backticks`);
    });
  }
}

for (const w of warnings) console.log("warn:", w);
for (const p of problems) console.log("FAIL:", p);
console.log(problems.length ? `check-docs: ${problems.length} problem(s)` : "check-docs: clean");
process.exit(problems.length ? 1 : 0);
