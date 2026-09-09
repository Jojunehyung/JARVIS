// Captures the manifest screenshots from the single-file demo, so the install prompt and packaging
// tools show what the app looks like. Run after `npm run build:demo`:
//   node tools/harness/gen-screenshots.js
// Outputs public/screenshots/*.png — committed, because the build copies public/ verbatim.
const fs = require("fs");
const path = require("path");
const { ROOT, launchBrowser } = require("./lib/source");

const DEMO = path.join(ROOT, "release", "life-demo.html");
const WIDTH = 430, HEIGHT = 932;

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// Each shot: the bottom-tab label to open, plus anything to click first.
const SHOTS = [
  { file: "home.png", tab: "홈" },
  { file: "tasks.png", tab: "실행" },
  { file: "goals.png", tab: "목표" },
];

(async () => {
  if (!fs.existsSync(DEMO)) { console.error("release/life-demo.html missing — run: npm run build:demo"); process.exit(1); }
  const outDir = path.join(ROOT, "public", "screenshots");
  fs.mkdirSync(outDir, { recursive: true });

  const browser = await launchBrowser();
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: WIDTH, height: HEIGHT, isMobile: true });
    await page.goto("file:///" + DEMO.split(path.sep).join("/"), { waitUntil: "networkidle2" });
    await wait(900);
    // Enter the demo save so the screens show real content rather than empty states.
    await page.evaluate(() => {
      const b = [...document.querySelectorAll("button")].find((e) => (e.innerText || "").includes("데모 데이터"));
      if (b) b.click();
    });
    await wait(1400);
    // Close the briefing if it opened, so the first shot is the home screen itself.
    await page.evaluate(() => {
      const ov = [...document.querySelectorAll(".fixed.inset-0")].pop();
      if (!ov) return;
      const x = [...ov.querySelectorAll("button")].find((b) => b.querySelector("svg") && !b.innerText.trim());
      (x || ov).click();
    });
    await wait(600);

    for (const s of SHOTS) {
      await page.evaluate((label) => {
        const nav = document.querySelector("nav");
        const b = nav && [...nav.querySelectorAll("button")].find((e) => (e.innerText || "").trim().includes(label));
        if (b) b.click();
      }, s.tab);
      await wait(700);
      const buf = await page.screenshot({ type: "png" });
      fs.writeFileSync(path.join(outDir, s.file), buf);
      console.log(`${s.file}: ${WIDTH}x${HEIGHT} · ${(buf.length / 1024).toFixed(0)} KB`);
    }
  } finally {
    await browser.close();
  }
})();
