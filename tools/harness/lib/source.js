// Shared source-extraction helpers for the harness scripts.
// Everything reads the single app file src/LifeManager.jsx; nothing here mutates it.
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..", "..", "..");
const SRC = path.join(ROOT, "src", "LifeManager.jsx");

// Top-level constants that are pure data tables. finish-check skips these regions
// for duplicate detection and residue scans; gen-* scripts read them.
const DATA_TABLES = [
  "CERTS", "EXAMS", "WEIGHT_MATRIX", "CERT_W_EXC", "DIR_CATS", "DIR_ALIAS", "TASK_TEMPLATES",
  "AGE_OPTS", "STATUS_OPTS", "EDU_OPTS", "MAJOR_FIELDS", "KNOWLEDGE_FIELDS", "CAREER_OPTS", "LEAD_OPTS",
  "BIZ_OPTS", "OUTPUT_OPTS", "GATE_CHIPS", "STUDY_REQ", "RANKS", "DIFFS", "JOB_FIELDS", "CERT_CATS",
  "AREA_PRESETS", "TASK_EV_CHIPS", "METRICS_META", "LANG_KO", "DIM_STEPS",
];

function readSrc(file = SRC) {
  const text = fs.readFileSync(file, "utf8");
  return { file, text, lines: text.split("\n") };
}

// Locate `const NAME = ...` (or `function NAME(`) at column 0 and return its 1-based line range.
// Single-line definitions end on the same line; block definitions end at the first `];` / `};` / `}` at column 0.
function grabBlock(name, src = readSrc()) {
  const { lines } = src;
  const s = lines.findIndex((l) => l.startsWith(`const ${name} = `) || l.startsWith(`function ${name}(`));
  if (s < 0) return null;
  const head = lines[s].trimEnd();
  if (head.startsWith("const ") && /;\s*(\/\/.*)?$/.test(head) && !/[\[{(]\s*(\/\/.*)?$/.test(head)) {
    return { name, start: s + 1, end: s + 1, text: lines[s] };
  }
  const open = head.endsWith("[") || /\[\s*\/\//.test(head) ? "[" : "{";
  const close = open === "[" ? "];" : head.startsWith("function") ? "}" : "};";
  let e = s + 1;
  while (e < lines.length && !lines[e].startsWith(close)) e++;
  if (e >= lines.length) throw new Error(`grabBlock: no closing "${close}" found for ${name}`);
  return { name, start: s + 1, end: e + 1, text: lines.slice(s, e + 1).join("\n") };
}

// Evaluate a `const NAME = <literal>` block. Only for trusted local source (data tables).
function evalConst(name, src = readSrc()) {
  const b = grabBlock(name, src);
  if (!b) throw new Error(`evalConst: ${name} not found`);
  const body = b.text.replace(`const ${name} = `, "").replace(/;\s*(\/\/.*)?$/, "");
  // eslint-disable-next-line no-eval
  return eval("(" + body + ")");
}

function dataRegions(src = readSrc()) {
  const out = [];
  for (const name of DATA_TABLES) {
    const b = grabBlock(name, src);
    if (b) out.push({ name, start: b.start, end: b.end });
  }
  return out.sort((a, b) => a.start - b.start);
}

function inRegions(regions, line) {
  return regions.some((r) => line >= r.start && line <= r.end);
}

// Top-level declarations: `const X =`, `function X(`, `const { a, b } =`.
function collectDecls(text) {
  const decls = [];
  text.split("\n").forEach((l, i) => {
    let m = l.match(/^const ([A-Za-z_$][\w$]*) =/);
    if (m) decls.push({ name: m[1], line: i + 1, kind: "const" });
    m = l.match(/^function ([A-Za-z_$][\w$]*)\(/);
    if (m) decls.push({ name: m[1], line: i + 1, kind: "function" });
    m = l.match(/^const \{ ([^}]+) \} =/);
    if (m) for (const n of m[1].split(",").map((s) => s.trim().split(":").pop().trim())) decls.push({ name: n, line: i + 1, kind: "destructure" });
  });
  return decls;
}

// ESM imports: returns the local binding names with their module.
function collectImports(text) {
  const out = [];
  const re = /^import\s+(?:([A-Za-z_$][\w$]*)\s*,?\s*)?(?:\{([^}]*)\})?\s*from\s*["']([^"']+)["'];?/gms;
  for (const m of text.matchAll(re)) {
    const line = text.slice(0, m.index).split("\n").length;
    if (m[1]) out.push({ name: m[1], local: m[1], from: m[3], line });
    if (m[2]) for (const part of m[2].split(",").map((s) => s.trim()).filter(Boolean)) {
      const [orig, alias] = part.split(/\s+as\s+/).map((s) => s.trim());
      out.push({ name: orig, local: alias || orig, from: m[3], line });
    }
  }
  return out;
}

// Count identifier references. Spread (`...NAME`) counts; property access (`obj.NAME`) does not.
function countRefs(corpus, name) {
  const re = new RegExp(`(?<![\\w$])${name.replace(/[$]/g, "\\$")}(?![\\w$])`, "g");
  let n = 0;
  for (const m of corpus.matchAll(re)) {
    const before = corpus.slice(Math.max(0, m.index - 3), m.index);
    if (before.endsWith(".") && !before.endsWith("...")) continue;
    n++;
  }
  return n;
}

// Nearest preceding section banner comment (`/* ── ... ── */`) for a 1-based line.
function sectionOf(lines, lineNo) {
  for (let i = lineNo - 1; i >= 0; i--) {
    const t = lines[i].trim();
    if (/^\/\* ─+/.test(t)) return t.replace(/^\/\*\s*─+\s*/, "").replace(/\s*─+\s*\*\/$/, "").trim();
  }
  return "";
}

function listSourceFiles() {
  const files = [];
  const walk = (dir) => {
    for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
      if (ent.name === "node_modules" || ent.name === "out") continue;
      const p = path.join(dir, ent.name);
      if (ent.isDirectory()) walk(p);
      else if (/\.(js|jsx)$/.test(ent.name)) files.push(p);
    }
  };
  walk(path.join(ROOT, "src"));
  for (const d of ["tools/e2e", "tools/harness"]) if (fs.existsSync(path.join(ROOT, d))) walk(path.join(ROOT, d));
  return files;
}


// Shared by the icon and screenshot generators: the Chrome the E2E already drives, with puppeteer-core
// borrowed from tools/e2e. Exits with a clear message rather than a stack trace when either is missing.
function launchBrowser() {
  const pup = path.join(ROOT, "tools", "e2e", "node_modules", "puppeteer-core");
  const chrome = [
    "C:/Program Files/Google/Chrome/Application/chrome.exe",
    "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
    "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  ].find((p2) => fs.existsSync(p2));
  if (!fs.existsSync(pup)) { console.error("puppeteer-core missing — run: cd tools/e2e && npm i"); process.exit(1); }
  if (!chrome) { console.error("no Chrome or Edge found"); process.exit(1); }
  return require(pup).launch({ executablePath: chrome, headless: true, args: ["--no-sandbox"] });
}
function rel(p) { return path.relative(ROOT, p).split(path.sep).join("/"); }

module.exports = { ROOT, SRC, DATA_TABLES, launchBrowser, readSrc, grabBlock, evalConst, dataRegions, inRegions, collectDecls, collectImports, countRefs, sectionOf, listSourceFiles, rel };
