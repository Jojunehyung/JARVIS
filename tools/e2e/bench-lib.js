// Shared benchmark helpers (browser launch, timing medians)
const fs = require("fs");
const puppeteer = require("puppeteer-core");
const CHROME = ["C:/Program Files/Google/Chrome/Application/chrome.exe", "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe"].find((p) => fs.existsSync(p));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const med = (a) => { const x = [...a].sort((p, q) => p - q); return +(x.length % 2 ? x[(x.length - 1) / 2] : (x[x.length / 2 - 1] + x[x.length / 2]) / 2).toFixed(1); };
// Headless mobile page with 4x CPU throttling (approximates a mid-range phone)
async function launchThrottled() {
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ["--no-sandbox"], defaultViewport: { width: 430, height: 932, isMobile: true } });
  const page = await browser.newPage();
  await page.emulateCPUThrottling(4);
  return { browser, page };
}
// Set a controlled React input by index, the way run.js does: the native setter, then the events React listens for.
const setNth = (page, sel, val, n = 0) => page.evaluate((s, v, i) => {
  const el = document.querySelectorAll(s)[i];
  if (!el) return false;
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(el, v);
  el.dispatchEvent(new Event("input", { bubbles: true }));
  el.dispatchEvent(new Event("change", { bubbles: true }));
  return true;
}, sel, val, n);

// Click a visible button by text. An exact label wins over a longer one that merely contains it,
// so a chip row whose labels contain one another is addressed unambiguously.
const clickLabel = (page, t) => page.evaluate((s) => {
  const vis = (e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
  let hit = [...document.querySelectorAll("button")].filter((e) => vis(e) && (e.innerText || "").includes(s));
  hit = hit.filter((e) => !hit.some((o) => o !== e && e.contains(o)));
  const el = hit.find((e) => (e.innerText || "").trim() === s) || hit[0];
  if (!el) return false;
  el.click(); return true;
}, t);

// Onboarding step 0 — name, birth date, gender, status and one education entry. Every bench script has to
// pass this gate before it can measure the certification picker on step 4.
async function onboardBasics(page) {
  await setNth(page, 'input[placeholder="이름"]', "AB");
  await setNth(page, 'input[placeholder*="닉네임"]', "AB");
  await setNth(page, 'input[type="date"]', "1998-05-14");
  for (const t of ["남성", "취업 준비"]) { await clickLabel(page, t); await sleep(60); }
  await setNth(page, 'input[placeholder*="학교 이름"]', "AB대학교");
  for (const t of ["학사", "졸업"]) { await clickLabel(page, t); await sleep(60); }
  await clickLabel(page, "학력 추가");
  await sleep(150);
}

module.exports = { CHROME, sleep, med, launchThrottled, setNth, clickLabel, onboardBasics };
