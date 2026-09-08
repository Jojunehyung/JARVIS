// Renders public/icon.svg into the PNG sizes an installable app needs, using the Chrome the E2E
// harness already drives (no new dependency). Run: node tools/harness/gen-icons.js
// Outputs public/icons/*.png — committed, because the build copies public/ verbatim.
const fs = require("fs");
const path = require("path");
const { ROOT } = require("./lib/source");

const PUP = path.join(ROOT, "tools", "e2e", "node_modules", "puppeteer-core");
const CHROME = [
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
].find((p) => fs.existsSync(p));

// size = pixels, pad = fraction of the canvas left empty around the art (maskable icons need a safe zone)
const TARGETS = [
  { file: "icon-192.png", size: 192, pad: 0 },
  { file: "icon-512.png", size: 512, pad: 0 },
  { file: "icon-maskable-512.png", size: 512, pad: 0.1 },
  { file: "apple-touch-icon-180.png", size: 180, pad: 0.06 },
];

(async () => {
  if (!fs.existsSync(PUP)) { console.error("puppeteer-core missing — run: cd tools/e2e && npm i"); process.exit(1); }
  if (!CHROME) { console.error("no Chrome or Edge found"); process.exit(1); }
  const puppeteer = require(PUP);
  const svg = fs.readFileSync(path.join(ROOT, "public", "icon.svg"), "utf8");
  const outDir = path.join(ROOT, "public", "icons");
  fs.mkdirSync(outDir, { recursive: true });

  const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ["--no-sandbox"] });
  try {
    const page = await browser.newPage();
    for (const t of TARGETS) {
      const inset = Math.round(t.size * t.pad);
      const art = t.size - inset * 2;
      await page.setViewport({ width: t.size, height: t.size, deviceScaleFactor: 1 });
      await page.setContent(
        `<html><body style="margin:0;width:${t.size}px;height:${t.size}px;background:#09090b;display:flex;align-items:center;justify-content:center">` +
        `<div style="width:${art}px;height:${art}px">${svg.replace("<svg", '<svg width="100%" height="100%"')}</div></body></html>`,
        { waitUntil: "load" }
      );
      const buf = await page.screenshot({ type: "png", omitBackground: false });
      fs.writeFileSync(path.join(outDir, t.file), buf);
      console.log(`${t.file}: ${t.size}x${t.size}${t.pad ? ` (safe zone ${Math.round(t.pad * 100)}%)` : ""} · ${(buf.length / 1024).toFixed(1)} KB`);
    }
  } finally {
    await browser.close();
  }
})();
