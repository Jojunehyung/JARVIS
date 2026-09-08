// Finish gate: dead code, duplicate code, game-term residue, and (optionally) language policy.
// Every task must end with this exiting 0 (AGENTS.md §5). The Stop hook calls it with --hook.
//
//   node finish-check.js            human report; exit 1 when blocking findings remain
//   node finish-check.js --json     machine output
//   node finish-check.js --report   also write out/finish-report.md
//   node finish-check.js --hook     Claude Code Stop hook (stdin JSON); blocks at most twice per session
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { execSync } = require("child_process");
const S = require("./lib/source");
const lang = require("./lang-check");

const OUT_DIR = path.join(__dirname, "out");
const CONFIG = Object.assign(
  { duplicatesBlock: true, lang: false, window: 6, minLogicLines: 4, maxBlocks: 2 },
  readJson(path.join(__dirname, "finish.config.json")) || {},
);
const ALLOW = Object.assign({ unused: [], duplicates: [], residue: [], lang: [] }, readJson(path.join(__dirname, "finish-allowlist.json")) || {});

function readJson(p) { try { return JSON.parse(fs.readFileSync(p, "utf8")); } catch { return null; } }
const sha1 = (s) => crypto.createHash("sha1").update(s).digest("hex").slice(0, 12);

/* ── 1. unused top-level symbols and imports (src/ only) ── */
function unusedSymbols(files) {
  const corpus = files.map((f) => fs.readFileSync(f, "utf8")).join("\n");
  const out = [];
  for (const f of files.filter((p) => S.rel(p).startsWith("src/"))) {
    const text = fs.readFileSync(f, "utf8");
    for (const d of S.collectDecls(text)) {
      if (S.countRefs(corpus, d.name) <= 1) out.push({ kind: "unused", file: S.rel(f), line: d.line, name: d.name, detail: `${d.kind} ${d.name} is never referenced` });
    }
    for (const im of S.collectImports(text)) {
      if (S.countRefs(text, im.local) <= 1) out.push({ kind: "unused-import", file: S.rel(f), line: im.line, name: im.local, detail: `import ${im.local} from "${im.from}" is never used` });
    }
  }
  return out.filter((x) => !ALLOW.unused.some((a) => a.name === x.name && (!a.file || a.file === x.file)));
}

/* ── 2. orphan section banners ── */
function orphanBanners(src) {
  const out = [];
  src.lines.forEach((l, i) => {
    if (!/^\/\* ─+.*─* \*\/$/.test(l.trim())) return;
    let j = i + 1;
    while (j < src.lines.length && !src.lines[j].trim()) j++;
    if (j < src.lines.length && /^\/\* ─/.test(src.lines[j].trim())) out.push({ kind: "orphan-banner", file: S.rel(src.file), line: i + 1, name: l.trim().slice(0, 60), detail: "section banner with no content" });
  });
  return out;
}

/* ── 3. game-term residue (outside data tables and migration blocks) ── */
const RESIDUE = [
  [/\bboss\b|bossHp/, "game term boss"], [/\bXP\b|\bxp\b/, "game term XP"], [/골드|크리티컬|미연시|가챠|콤보|레벨업|플레이어/, "game term"],
  [/🎲|🎮|🕹|⚔|🗡|👾/, "arcade emoji"], [/\bcritical hit\b|\bloot\b/i, "game term"],
];
function residue(src) {
  const skip = S.dataRegions(src);
  const mig = S.grabBlock("migrate", src);
  if (mig) skip.push({ name: "migrate", start: mig.start, end: mig.end });
  const out = [];
  src.lines.forEach((l, i) => {
    const n = i + 1;
    if (S.inRegions(skip, n)) return;
    for (const [re, why] of RESIDUE) if (re.test(l)) { out.push({ kind: "residue", file: S.rel(src.file), line: n, name: why, detail: l.trim().slice(0, 100) }); break; }
  });
  return out.filter((x) => !ALLOW.residue.some((a) => a.file === x.file && a.line === x.line));
}

/* ── 4. duplicate blocks (zero-dependency sliding-window hashing) ── */
function normalize(line) {
  let t = line.trim();
  if (!t) return null;
  t = t.replace(/\/\/.*$/, "").trim();
  if (!t || /^import\b/.test(t) || /^[{}()\[\];,]+$/.test(t)) return null;
  if (/^<[^>]*className=/.test(t) && !/[(=]/.test(t.replace(/className=\{[^}]*\}|className="[^"]*"/g, ""))) return null; // JSX styling-only line
  t = t.replace(/`(?:\\.|[^`\\])*`/g, '"S"').replace(/"(?:\\.|[^"\\])*"/g, '"S"').replace(/'(?:\\.|[^'\\])*'/g, '"S"').replace(/\b\d+(\.\d+)?\b/g, "N").replace(/\s+/g, " ");
  return t.length < 12 ? null : t;
}
const isLogic = (t) => /[(=]|\breturn\b|=>/.test(t) && !/^</.test(t);

function duplicates(files) {
  const W = CONFIG.window;
  const perFile = files.map((f) => {
    const src = S.readSrc(f);
    const regions = S.rel(f).startsWith("src/") ? S.dataRegions(src) : [];
    const rows = [];
    src.lines.forEach((l, i) => { if (S.inRegions(regions, i + 1)) return; const t = normalize(l); if (t) rows.push({ line: i + 1, t }); });
    return { file: S.rel(f), rows };
  });
  const index = new Map(); // key → [{fi, i}]
  perFile.forEach((pf, fi) => { for (let i = 0; i + W <= pf.rows.length; i++) { const key = sha1(pf.rows.slice(i, i + W).map((r) => r.t).join("\n")); (index.get(key) || index.set(key, []).get(key)).push({ fi, i }); } });
  const dupStarts = perFile.map(() => new Set());
  for (const [, occ] of index) {
    if (occ.length < 2) continue;
    // same-file overlaps of one long repeated region are not duplicates of each other
    const distinct = occ.filter((o, k) => !occ.some((p, j) => j < k && p.fi === o.fi && Math.abs(p.i - o.i) < W));
    if (distinct.length < 2) continue;
    for (const o of distinct) dupStarts[o.fi].add(o.i);
  }
  const groups = new Map();
  perFile.forEach((pf, fi) => {
    const starts = [...dupStarts[fi]].sort((a, b) => a - b);
    let k = 0;
    while (k < starts.length) {
      let a = starts[k], b = starts[k] + W; // row index range [a, b)
      while (k + 1 < starts.length && starts[k + 1] <= b) { b = starts[k + 1] + W; k++; }
      k++;
      const rows = pf.rows.slice(a, b);
      if (rows.filter((r) => isLogic(r.t)).length < CONFIG.minLogicLines) continue;
      const fp = sha1(rows.map((r) => r.t).join("\n"));
      const entry = { file: pf.file, start: rows[0].line, end: rows[rows.length - 1].line, lines: rows.length, key0: sha1(pf.rows.slice(a, a + W).map((r) => r.t).join("\n")) };
      (groups.get(fp) || groups.set(fp, []).get(fp)).push(entry);
    }
  });
  // Pair ranges that share their first window even if their merged extents differ.
  const byKey0 = new Map();
  for (const [fp, list] of groups) for (const e of list) (byKey0.get(e.key0) || byKey0.set(e.key0, []).get(e.key0)).push({ fp, ...e });
  const out = [];
  const seen = new Set();
  for (const [, list] of byKey0) {
    if (list.length < 2) continue;
    const fp = list[0].fp;
    if (seen.has(fp)) continue;
    seen.add(fp);
    if (ALLOW.duplicates.some((a) => a.fingerprint === fp)) continue;
    out.push({ kind: "duplicate", fingerprint: fp, name: `${list.length} copies × ${Math.min(...list.map((e) => e.lines))}+ lines`, file: list[0].file, line: list[0].start, detail: list.map((e) => `${e.file}:${e.start}-${e.end}`).join(" · ") });
  }
  return out;
}

/* ── run ── */
function run() {
  const files = S.listSourceFiles();
  const src = S.readSrc();
  const findings = [...unusedSymbols(files), ...orphanBanners(src), ...residue(src), ...duplicates(files)];
  const langF = CONFIG.lang ? lang.applyAllow(lang.scan(files)).map((f) => ({ kind: "lang", file: f.file, line: f.line, name: f.kind, detail: f.text })) : [];
  const all = [...findings, ...langF];
  const blocking = all.filter((f) => f.kind !== "duplicate" || CONFIG.duplicatesBlock);
  return { findings: all, blocking, config: CONFIG };
}

function format(res) {
  if (!res.findings.length) return "finish-check: clean";
  const lines = [`finish-check: ${res.findings.length} finding(s), ${res.blocking.length} blocking`];
  for (const f of res.findings) lines.push(`  [${f.kind}] ${f.file}:${f.line} ${f.name} — ${f.detail}`);
  lines.push("Fix, merge, or allowlist with a reason in tools/harness/finish-allowlist.json (mirror in docs/exec-plans/tech-debt-tracker.md).");
  return lines.join("\n");
}

function hookMode() {
  let input = "";
  process.stdin.setEncoding("utf8");
  process.stdin.on("data", (c) => (input += c));
  process.stdin.on("end", () => {
    try {
      const j = JSON.parse(input || "{}");
      // Fast path: nothing changed in this working tree → nothing to clean.
      let dirty = "";
      try { dirty = execSync("git status --porcelain -- src tools docs *.md package.json", { cwd: S.ROOT, stdio: ["ignore", "pipe", "ignore"] }).toString().trim(); } catch { dirty = "x"; }
      if (!dirty) return;
      const res = run();
      const stateDir = path.join(S.ROOT, ".claude", "harness-state");
      const stateFile = path.join(stateDir, `finish-${(j.session_id || "session").replace(/[^\w-]/g, "")}.json`);
      if (!res.blocking.length) { try { fs.unlinkSync(stateFile); } catch {} return; }
      fs.mkdirSync(stateDir, { recursive: true });
      const st = readJson(stateFile) || { blocks: 0 };
      if (j.stop_hook_active && st.blocks >= CONFIG.maxBlocks) {
        fs.mkdirSync(OUT_DIR, { recursive: true });
        fs.writeFileSync(path.join(OUT_DIR, "finish-report.md"), `# finish-check report\n\n\`\`\`\n${format(res)}\n\`\`\`\n`);
        console.log(`finish-check: ${res.blocking.length} finding(s) still open after ${st.blocks} blocks — allowing stop; see tools/harness/out/finish-report.md`);
        return;
      }
      st.blocks += 1;
      fs.writeFileSync(stateFile, JSON.stringify(st));
      const top = res.blocking.slice(0, 10).map((f) => `${f.file}:${f.line} ${f.kind} ${f.name}`).join("; ");
      process.stdout.write(JSON.stringify({ decision: "block", reason: `finish-check: ${res.blocking.length} finding(s) — ${top}. Run the cleanup agent (remove/merge, or allowlist with a reason in tools/harness/finish-allowlist.json), then finish again.` }));
    } catch (e) {
      console.error("finish-check hook error (stop allowed):", e.message);
    }
  });
}

if (require.main === module) {
  const args = process.argv.slice(2);
  if (args.includes("--hook")) { hookMode(); }
  else {
    const res = run();
    if (args.includes("--json")) console.log(JSON.stringify(res, null, 1));
    else console.log(format(res));
    if (args.includes("--report")) { fs.mkdirSync(OUT_DIR, { recursive: true }); fs.writeFileSync(path.join(OUT_DIR, "finish-report.md"), `# finish-check report\n\n\`\`\`\n${format(res)}\n\`\`\`\n`); }
    process.exit(res.blocking.length ? 1 : 0);
  }
}

module.exports = { run, format };
