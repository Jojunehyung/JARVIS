// Performance measurement — initial load, catalogue open/search-input latency, role-model recommendation, tab switching
// Usage: node perf.js [--tag before]
const puppeteer = require("puppeteer-core");
const fs = require("fs"), path = require("path");
const args = process.argv.slice(2);
const arg = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const TAG = arg("--tag", "perf");
const URL = arg("--url", "http://localhost:4173/");
const CHROME = ["C:/Program Files/Google/Chrome/Application/chrome.exe", "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe"].find((p) => fs.existsSync(p));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const N = 5; // repeated measurements

(async () => {
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ["--no-sandbox"], defaultViewport: { width: 430, height: 932, isMobile: true, hasTouch: true } });
  const page = await browser.newPage();
  await page.emulateCPUThrottling(4); // mobile approximation (4× slowdown)
  const out = {};

  // 1) Initial load — script evaluation + first render
  const loads = [];
  for (let i = 0; i < N; i++) {
    await page.goto("about:blank");
    const t0 = Date.now();
    await page.goto(URL, { waitUntil: "networkidle2" });
    await page.waitForFunction(() => document.body.innerText.includes("인생"));
    loads.push(Date.now() - t0);
  }
  out.초기로드ms = loads.sort((a, b) => a - b)[Math.floor(N / 2)];

  // enter the demo state (has certifications, tasks and goals)
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: "networkidle2" });
  await page.evaluate(() => {
    const btn = [...document.querySelectorAll("button")].find((b) => b.innerText.includes("데모 데이터"));
    btn?.click();
  });
  await sleep(800);

  const clickTab = async (n) => { await page.evaluate((t) => { const nav = document.querySelector("nav"); [...nav.querySelectorAll("button")].find((b) => b.innerText.includes(t))?.click(); }, n); await sleep(350); };

  // 2) Catalogue open (first render of the 1,011-row list)
  const opens = [];
  for (let i = 0; i < N; i++) {
    await clickTab("할 일");
    const t = await page.evaluate(async () => {
      const btn = [...document.querySelectorAll("button")].find((b) => b.innerText.trim() === "도감");
      const t0 = performance.now();
      btn.click();
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      return performance.now() - t0;
    });
    opens.push(t);
    await page.evaluate(() => { const ov = [...document.querySelectorAll(".fixed.inset-0")].pop(); const b = [...ov.querySelectorAll("button")].find((x) => x.querySelector("svg") && !x.innerText.trim()); b?.click(); });
    await sleep(250);
  }
  out.도감오픈ms = +(opens.sort((a, b) => a - b)[Math.floor(N / 2)]).toFixed(1);

  // 3) Catalogue search-input latency (keystroke → list update)
  await clickTab("할 일");
  await page.evaluate(() => [...document.querySelectorAll("button")].find((b) => b.innerText.trim() === "도감")?.click());
  await sleep(400);
  const keys = [];
  for (const ch of ["기", "사", " ", "전", "기"]) {
    const el = await page.$('.fixed.inset-0 input[placeholder*="자격증 검색"]');
    const t0 = Date.now();
    await el.type(ch, { delay: 0 });
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
    keys.push(Date.now() - t0);
  }
  out.도감검색_키입력ms = keys;
  out.도감검색_중앙값ms = keys.sort((a, b) => a - b)[Math.floor(keys.length / 2)];
  await page.evaluate(() => { const ov = [...document.querySelectorAll(".fixed.inset-0")].pop(); const b = [...ov.querySelectorAll("button")].find((x) => x.querySelector("svg") && !x.innerText.trim()); b?.click(); });
  await sleep(250);

  // 4) Tab switch render
  const tabs = [];
  for (const t of ["프로필", "목표", "할 일", "프로필", "목표"]) {
    const ms = await page.evaluate(async (name) => {
      const nav = document.querySelector("nav");
      const btn = [...nav.querySelectorAll("button")].find((b) => b.innerText.includes(name));
      const t0 = performance.now();
      btn.click();
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      return performance.now() - t0;
    }, t);
    tabs.push(+ms.toFixed(1));
    await sleep(200);
  }
  out.탭전환ms = tabs;
  out.탭전환_중앙값ms = tabs.slice().sort((a, b) => a - b)[Math.floor(tabs.length / 2)];

  // 5) JavaScript heap and bundle size
  const metrics = await page.metrics();
  out.JS힙MB = +(metrics.JSHeapUsedSize / 1048576).toFixed(1);
  const dist = "c:/Users/조준형/Desktop/life/files/dist/assets";
  const js = fs.readdirSync(dist).find((f) => f.endsWith(".js"));
  out.번들KB = +(fs.statSync(path.join(dist, js)).size / 1024).toFixed(1);

  fs.writeFileSync(path.join(__dirname, "out", `${TAG}-perf.json`), JSON.stringify(out, null, 1));
  console.log(`[perf ${TAG}]`);
  for (const [k, v] of Object.entries(out)) console.log(`  ${k}: ${Array.isArray(v) ? v.join(", ") : v}`);
  await browser.close();
})();
