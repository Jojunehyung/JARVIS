// CPU profile — top self-time functions during tab switching and catalogue search, mapped back to source positions
const puppeteer = require("puppeteer-core");
const fs = require("fs"), path = require("path");
const { SourceMapConsumer } = require("source-map");
const CHROME = ["C:/Program Files/Google/Chrome/Application/chrome.exe", "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe"].find((p) => fs.existsSync(p));
const URL = "http://localhost:4173/";
const DIST = "c:/Users/조준형/Desktop/life/files/dist/assets";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ["--no-sandbox"], defaultViewport: { width: 430, height: 932, isMobile: true } });
  const page = await browser.newPage();
  await page.emulateCPUThrottling(4);
  await page.goto(URL, { waitUntil: "networkidle2" });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: "networkidle2" });
  await page.evaluate(() => [...document.querySelectorAll("button")].find((b) => b.innerText.includes("데모 데이터"))?.click());
  await sleep(900);

  const client = await page.createCDPSession();
  await client.send("Profiler.enable");
  await client.send("Profiler.setSamplingInterval", { interval: 100 });
  await client.send("Profiler.start");

  const clickTab = async (n) => { await page.evaluate((t) => { const nav = document.querySelector("nav"); [...nav.querySelectorAll("button")].find((b) => b.innerText.includes(t))?.click(); }, n); await sleep(500); };
  for (const t of ["목표", "할 일", "프로필", "목표", "할 일"]) await clickTab(t);
  // catalogue search
  await clickTab("할 일");
  await page.evaluate(() => [...document.querySelectorAll("button")].find((b) => b.innerText.trim() === "도감")?.click());
  await sleep(400);
  const el = await page.$('.fixed.inset-0 input[placeholder*="자격증 검색"]');
  if (el) await el.type("전기기사", { delay: 60 });
  await sleep(500);

  const { profile } = await client.send("Profiler.stop");
  const map = JSON.parse(fs.readFileSync(path.join(DIST, fs.readdirSync(DIST).find((f) => f.endsWith(".js.map"))), "utf8"));
  const consumer = await new SourceMapConsumer(map);

  // self-time aggregation
  const self = new Map();
  const byId = new Map(profile.nodes.map((n) => [n.id, n]));
  const total = profile.timeDeltas.reduce((s, d) => s + d, 0);
  for (let i = 0; i < profile.samples.length; i++) {
    const id = profile.samples[i], dt = profile.timeDeltas[i] || 0;
    self.set(id, (self.get(id) || 0) + dt);
  }
  const rows = [...self.entries()].map(([id, us]) => {
    const n = byId.get(id); if (!n) return null;
    const cf = n.callFrame;
    let orig = null;
    if (cf.url && cf.url.includes("/assets/")) {
      const p = consumer.originalPositionFor({ line: cf.lineNumber + 1, column: cf.columnNumber, bias: SourceMapConsumer.LEAST_UPPER_BOUND });
      if (p && p.source) orig = `${p.source.split("/").pop()}:${p.line}${p.name ? ` (${p.name})` : ""}`;
    }
    return { fn: cf.functionName || "(anonymous)", where: orig || (cf.url ? cf.url.split("/").pop() + ":" + (cf.lineNumber + 1) : cf.url), ms: +(us / 1000).toFixed(1) };
  }).filter(Boolean).sort((a, b) => b.ms - a.ms);

  console.log(`total sampled ${(total / 1000).toFixed(0)}ms\n[top self-time]`);
  for (const r of rows.slice(0, 25)) console.log(`  ${String(r.ms).padStart(7)}ms  ${r.fn.padEnd(24)} ${r.where || ""}`);
  fs.writeFileSync(path.join(__dirname, "out", "profile-top.json"), JSON.stringify(rows.slice(0, 60), null, 1));
  consumer.destroy();
  await browser.close();
})();
