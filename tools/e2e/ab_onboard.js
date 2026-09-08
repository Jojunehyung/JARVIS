// A/B — 온보딩 4단계(자격 선택) 진입·검색 입력 지연. 1,011행 전체 렌더 vs 60행 캡의 차이를 본다
const fs = require("fs");
const { sleep, med, launchThrottled } = require("./bench-lib");
const A = process.argv[2] || "http://localhost:5001/";
const B = process.argv[3] || "http://localhost:5002/";
const ROUNDS = +(process.argv[4] || 5);
const clickText = (page, t) => page.evaluate((s) => {
  const vis = (e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
  let hit = [...document.querySelectorAll("button")].filter((e) => vis(e) && (e.innerText || "").includes(s));
  hit = hit.filter((e) => !hit.some((o) => o !== e && e.contains(o)));
  if (!hit[0]) return false; hit[0].click(); return true;
}, t);

async function run(page, url) {
  await page.goto(url, { waitUntil: "networkidle2" });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: "networkidle2" });
  await sleep(400);
  // 온보딩 1~3단계 통과 (버튼 문구는 두 빌드가 다르므로 둘 다 시도)
  if (!(await clickText(page, "시작하기"))) await clickText(page, "새 인생 시작하기");
  await sleep(400);
  const nick = await page.$('input[placeholder*="닉네임"]');
  if (nick) await nick.type("AB", { delay: 0 });
  for (const t of ["20대 후반", "남성", "취업 준비", "학사 졸", "공학"]) { await clickText(page, t); await sleep(80); }
  await clickText(page, "다음"); await sleep(350);
  await clickText(page, "다음"); await sleep(350);      // 외형
  await clickText(page, "기본지식"); await sleep(120);
  await clickText(page, "다음"); await sleep(350);      // 파트 → 4단계 직전
  // 4단계 진입 렌더 시간
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
  console.log(`  4단계 진입 렌더: A ${med(res.A.map((x) => x.enter))}ms → B ${med(res.B.map((x) => x.enter))}ms`);
  console.log(`  검색 키입력:     A ${med(res.A.map((x) => x.key))}ms → B ${med(res.B.map((x) => x.key))}ms`);
  console.log(`  렌더된 행 수:    A ${res.A[0].rows}행 → B ${res.B[0].rows}행`);
  fs.writeFileSync(__dirname + "/out/ab-onboard.json", JSON.stringify(res, null, 1));
  await browser.close();
})();
