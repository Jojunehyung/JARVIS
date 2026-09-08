// A/B 성능 비교 — 두 빌드를 한 프로세스에서 번갈아 측정해 머신 부하 편차를 상쇄한다
// 사용: node ab.js <urlA> <urlB> [반복]
const puppeteer = require("puppeteer-core");
const fs = require("fs");
const A = process.argv[2] || "http://localhost:5001/";
const B = process.argv[3] || "http://localhost:5002/";
const ROUNDS = +(process.argv[4] || 7);
const CHROME = ["C:/Program Files/Google/Chrome/Application/chrome.exe", "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe"].find((p) => fs.existsSync(p));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const med = (a) => { const x = [...a].sort((p, q) => p - q); return +(x.length % 2 ? x[(x.length - 1) / 2] : (x[x.length / 2 - 1] + x[x.length / 2]) / 2).toFixed(1); };

async function measure(page, url) {
  await page.goto(url, { waitUntil: "networkidle2" });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: "networkidle2" });
  await page.evaluate(() => [...document.querySelectorAll("button")].find((b) => b.innerText.includes("데모 데이터"))?.click());
  await sleep(900);
  const tab = async (n) => page.evaluate(async (t) => {
    const nav = document.querySelector("nav");
    const btn = [...nav.querySelectorAll("button")].find((b) => b.innerText.includes(t));
    const t0 = performance.now(); btn.click();
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    return performance.now() - t0;
  }, n);
  const tabs = [];
  for (const t of ["목표", "퀘스트", "성장", "홈", "목표", "퀘스트", "성장", "홈"]) { tabs.push(await tab(t)); await sleep(150); }

  const opens = [], searches = [];
  for (let i = 0; i < 4; i++) {
    await tab("퀘스트"); await sleep(150);
    opens.push(await page.evaluate(async () => {
      const btn = [...document.querySelectorAll("button")].find((b) => b.innerText.trim() === "도감");
      const t0 = performance.now(); btn.click();
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      return performance.now() - t0;
    }));
    const el = await page.$('.fixed.inset-0 input[placeholder*="자격증 검색"]');
    if (el) for (const ch of ["기", "사", "전"]) {
      const t0 = Date.now(); await el.type(ch, { delay: 0 });
      await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
      searches.push(Date.now() - t0);
    }
    await page.evaluate(() => { const ov = [...document.querySelectorAll(".fixed.inset-0")].pop(); const b = [...ov.querySelectorAll("button")].find((x) => x.querySelector("svg") && !x.innerText.trim()); b?.click(); });
    await sleep(200);
  }
  return { tab: med(tabs), open: med(opens), search: med(searches) };
}

(async () => {
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ["--no-sandbox"], defaultViewport: { width: 430, height: 932, isMobile: true } });
  const page = await browser.newPage();
  await page.emulateCPUThrottling(4);
  const res = { A: [], B: [] };
  for (let r = 0; r < ROUNDS; r++) {
    res.A.push(await measure(page, A));
    res.B.push(await measure(page, B));
    process.stdout.write(`.`);
  }
  console.log("");
  for (const k of ["tab", "open", "search"]) {
    const a = med(res.A.map((x) => x[k])), b = med(res.B.map((x) => x[k]));
    const label = { tab: "탭 전환", open: "도감 오픈", search: "검색 키입력" }[k];
    console.log(`  ${label}: A ${a}ms → B ${b}ms (${b < a ? "-" : "+"}${Math.abs(((b - a) / a) * 100).toFixed(0)}%)`);
  }
  fs.writeFileSync(__dirname + "/out/ab.json", JSON.stringify(res, null, 1));
  await browser.close();
})();
