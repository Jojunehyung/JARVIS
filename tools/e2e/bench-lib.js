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
module.exports = { CHROME, sleep, med, launchThrottled };
