// A/B — onboarding step 4 (certification picker) entry and search-input latency. Compares rendering all 1,011 rows vs the 60-row cap
const fs = require("fs");
const { sleep, med, launchThrottled, clickLabel, onboardBasics } = require("./bench-lib");
const A = process.argv[2] || "http://localhost:5001/";
const B = process.argv[3] || "http://localhost:5002/";
const ROUNDS = +(process.argv[4] || 5);

async function run(page, url) {
  await page.goto(url, { waitUntil: "networkidle2" });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: "networkidle2" });
  await sleep(400);
  // pass onboarding steps 1–3 (button copy differs between the builds, so try both)
  if (!(await clickLabel(page, "시작하기"))) await clickLabel(page, "새 인생 시작하기");
  await sleep(400);
  await onboardBasics(page);
  await clickLabel(page, "다음"); await sleep(350);
  await clickLabel(page, "다음"); await sleep(350);      // appearance
  await clickLabel(page, "기본지식"); await sleep(120);
  await clickLabel(page, "다음"); await sleep(350);      // areas → just before step 4
  // step 4 entry render time
  const enter = await page.evaluate(async () => {
    const vis = (e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
    const btn = [...document.querySelectorAll("button")].filter((e) => vis(e) && e.innerText.trim() === "다음")[0];
    const t0 = performance.now(); btn.click();
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    return performance.now() - t0;
  });
  await sleep(500);
  const rows = await page.evaluate(() => document.querySelectorAll(".max-h-56 button").length);
  const el = await page.$('input[placeholder="자격증 검색"]');
  const keys = [];
  if (el) for (const ch of ["기", "사", "전"]) {
    const t0 = Date.now(); await el.type(ch, { delay: 0 });
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
    keys.push(Date.now() - t0);
  }
  return { enter, rows, key: med(keys) };
}

(async () => {
  const { browser, page } = await launchThrottled();
  const res = { A: [], B: [] };
  for (let i = 0; i < ROUNDS; i++) { res.A.push(await run(page, A)); res.B.push(await run(page, B)); process.stdout.write("."); }
  console.log("");
  console.log(`  step 4 entry render: A ${med(res.A.map((x) => x.enter))}ms → B ${med(res.B.map((x) => x.enter))}ms`);
  console.log(`  search keystroke:     A ${med(res.A.map((x) => x.key))}ms → B ${med(res.B.map((x) => x.key))}ms`);
  console.log(`  rendered rows:       A ${res.A[0].rows} → B ${res.B[0].rows}`);
  fs.writeFileSync(__dirname + "/out/ab-onboard.json", JSON.stringify(res, null, 1));
  await browser.close();
})();
