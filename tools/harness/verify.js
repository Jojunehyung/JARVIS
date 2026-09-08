// Verification pipeline: vite build → vite preview on a free port → puppeteer E2E → (optional) engine smoke.
// Exit 1 on any failed step or console error. Usage: node verify.js [--smoke] [--tag name]
const fs = require("fs");
const net = require("net");
const http = require("http");
const path = require("path");
const { spawn, spawnSync } = require("child_process");
const { ROOT } = require("./lib/source");

const args = process.argv.slice(2);
const TAG = (() => { const i = args.indexOf("--tag"); return i >= 0 ? args[i + 1] : "verify"; })();
const VITE = path.join(ROOT, "node_modules", "vite", "bin", "vite.js");
const E2E = path.join(ROOT, "tools", "e2e");

const freePort = () => new Promise((res, rej) => { const s = net.createServer(); s.listen(0, () => { const p = s.address().port; s.close(() => res(p)); }); s.on("error", rej); });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const waitFor = async (url, ms) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { const ok = await new Promise((r) => http.get(url, (rs) => r(rs.statusCode === 200)).on("error", () => r(false))); if (ok) return true; await sleep(300); } return false; };
const step = (name, r) => { console.log(`${r ? "✓" : "✗"} ${name}`); return r; };

(async () => {
  if (!fs.existsSync(VITE)) { console.error("vite not installed — run: npm i"); process.exit(1); }
  if (!fs.existsSync(path.join(E2E, "node_modules", "puppeteer-core"))) { console.error("E2E deps missing — run: cd tools/e2e && npm i"); process.exit(1); }

  if (args.includes("--smoke")) {
    const sm = spawnSync(process.execPath, [path.join(__dirname, "smoke-logic.js")], { cwd: ROOT, stdio: "inherit" });
    if (!step("engine smoke", sm.status === 0)) process.exit(1);
  }

  const build = spawnSync(process.execPath, [VITE, "build"], { cwd: ROOT, stdio: ["ignore", "pipe", "pipe"] });
  if (!step("vite build", build.status === 0)) { process.stderr.write(build.stderr.toString()); process.exit(1); }

  const port = await freePort();
  const preview = spawn(process.execPath, [VITE, "preview", "--port", String(port), "--strictPort"], { cwd: ROOT, stdio: "ignore" });
  let exit = 1;
  try {
    if (!step(`vite preview :${port}`, await waitFor(`http://localhost:${port}/`, 30000))) throw new Error("preview did not start");
    const e2e = spawnSync(process.execPath, ["run.js", "--url", `http://localhost:${port}/`, "--tag", TAG], { cwd: E2E, stdio: "inherit", timeout: 15 * 60 * 1000 });
    let res = null;
    try { res = JSON.parse(fs.readFileSync(path.join(E2E, "out", `${TAG}-result.json`), "utf8")); } catch {}
    const failed = res ? res.steps.filter((s) => !s.ok) : [{ name: "no result file" }];
    const errors = res ? res.errors : ["E2E did not produce a result"];
    step(`E2E ${res ? res.steps.length : 0} steps, ${failed.length} failed, ${errors.length} console error(s), coverage ${res?.coverage?.[0]?.pct ?? "?"}%`, e2e.status === 0 && !failed.length && !errors.length);
    for (const f of failed) console.log(`   ✗ ${f.name} — ${f.err || ""}`);
    for (const e of errors) console.log(`   ! ${e}`);
    exit = e2e.status === 0 && !failed.length && !errors.length ? 0 : 1;
  } catch (e) {
    console.error(e.message);
  } finally {
    if (process.platform === "win32") spawnSync("taskkill", ["/pid", String(preview.pid), "/T", "/F"], { stdio: "ignore" });
    else preview.kill();
  }
  process.exit(exit);
})();
