// 온보딩 4단계(자격 선택)에서 실제로 마운트되는 행 수 확인 — run.js 플로우 재사용
const puppeteer = require("puppeteer-core");
const fs = require("fs");
const URL = process.argv[2];
const START = process.argv[3] || "시작하기";
const CHROME = ["C:/Program Files/Google/Chrome/Application/chrome.exe"].find((p) => fs.existsSync(p));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  const b = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ["--no-sandbox"], defaultViewport: { width: 430, height: 932, isMobile: true } });
  const page = await b.newPage();
  const click = (t) => page.evaluate((s) => {
    const vis = (e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
    let h = [...document.querySelectorAll("button")].filter((e) => vis(e) && (e.innerText || "").includes(s));
    h = h.filter((e) => !h.some((o) => o !== e && e.contains(o)));
    if (!h[0]) return false; h[0].click(); return true;
  }, t);
  await page.goto(URL, { waitUntil: "networkidle2" });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: "networkidle2" }); await sleep(400);
  console.log("시작:", await click(START));
  await sleep(400);
  const nick = await page.$('input[placeholder*="닉네임"]'); if (nick) await nick.type("AB");
  for (const t of ["20대 후반", "남성", "취업 준비", "학사 졸", "공학"]) { await click(t); await sleep(70); }
  await click("다음"); await sleep(400);                       // → 2단계
  await click("다음"); await sleep(400);                       // → 3단계
  for (const t of ["기본지식", "IT·개발"]) { await click(t); await sleep(90); }
  await click("다음"); await sleep(600);                       // → 4단계
  const step = await page.evaluate(() => (document.body.innerText.match(/\d \/ 6/) || [""])[0]);
  const rows = await page.evaluate(() => document.querySelectorAll(".max-h-56 button").length);
  const nodes = await page.evaluate(() => document.querySelectorAll("*").length);
  await page.emulateCPUThrottling(4);
  const el = await page.$('input[placeholder="자격증 검색"]');
  const keys = [];
  if (el) for (const ch of ["기","사","전","기"]) {
    const t0 = Date.now(); await el.type(ch, { delay: 0 });
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
    keys.push(Date.now() - t0);
  }
  const m = keys.sort((a,b)=>a-b)[keys.length>>1];
  console.log(`단계 ${step} · 자격 목록 행 ${rows} · 전체 DOM 노드 ${nodes} · 검색 키입력 중앙값 ${m}ms (${keys.join(",")})`);
  await b.close();
})();
