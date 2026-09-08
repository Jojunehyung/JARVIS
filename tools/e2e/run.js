// 인생 상태창 E2E — 실제 Chrome으로 전 화면 플로우 실행 + JS 커버리지 수집
// 사용: node run.js [--url http://localhost:4173] [--headful] [--tag before]
const puppeteer = require("puppeteer-core");
const fs = require("fs");
const path = require("path");
const args = process.argv.slice(2);
const arg = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const URL = arg("--url", "http://localhost:4173/");
const TAG = arg("--tag", "run");
const HEADFUL = args.includes("--headful");
const CHROME = ["C:/Program Files/Google/Chrome/Application/chrome.exe", "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe"].find((p) => fs.existsSync(p));
const OUT = path.join(__dirname, "out"); fs.mkdirSync(OUT, { recursive: true });

const steps = [];
const errors = [];
let page;
const shot = async (name) => { try { await page.screenshot({ path: path.join(OUT, `${TAG}-${String(steps.length).padStart(2, "0")}-${name}.png`) }); } catch {} };
const step = async (name, fn) => {
  const t0 = Date.now();
  try { await fn(); steps.push({ name, ok: true, ms: Date.now() - t0 }); }
  catch (e) { steps.push({ name, ok: false, ms: Date.now() - t0, err: String(e).split("\n")[0] }); await shot(`FAIL-${name}`); }
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// 텍스트로 요소 찾기 — 보이는 요소 중 그 텍스트를 가진 "가장 안쪽·가장 작은" 것
const findByText = async (text, sel = "button,[role=button],input,label,span,div,a") =>
  page.evaluateHandle((t, s) => {
    const vis = (e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(e).visibility !== "hidden"; };
    let hit = [...document.querySelectorAll(s)].filter((e) => vis(e) && ((e.innerText || e.value || "").includes(t)));
    hit = hit.filter((e) => !hit.some((o) => o !== e && e.contains(o))); // 같은 텍스트 자손이 있으면 조상 제외
    const rank = (e) => (e.tagName === "BUTTON" || e.tagName === "INPUT" ? 0 : 1);
    const area = (e) => { const r = e.getBoundingClientRect(); return r.width * r.height; };
    hit.sort((a, b) => rank(a) - rank(b) || area(a) - area(b));
    return hit[0] || null;
  }, text, sel);
const clickText = async (text, sel) => {
  const h = await findByText(text, sel);
  const el = h.asElement();
  if (!el) throw new Error(`클릭 대상 없음: "${text}"`);
  await el.evaluate((e) => e.scrollIntoView({ block: "center" }));
  await el.click();
  await sleep(170);
};
// 열린 모달 안에서만 클릭 — 뒤 화면의 동명 버튼 오클릭 방지
const clickInModal = async (text) => {
  const ok = await page.evaluate((t) => {
    const ovs = [...document.querySelectorAll(".fixed.inset-0")];
    const ov = ovs[ovs.length - 1];
    if (!ov) return "모달 없음";
    const btns = [...ov.querySelectorAll("button")].filter((b) => (b.innerText || "").includes(t));
    if (!btns.length) return "버튼 없음";
    btns[0].click(); return "ok";
  }, text);
  if (ok !== "ok") throw new Error(`모달 내 클릭 실패(${ok}): ${text}`);
  await sleep(400);
};
// 퀘스트가 실제로 완료 표시됐는지 검증 — 제목 노드의 형제 텍스트에서 "완료" 확인
const assertDone = async (title) => {
  const res = await page.evaluate((t) => {
    const nodes = [...document.querySelectorAll("div")].filter((d) => (d.innerText || "").trim().startsWith(t) && d.children.length === 0);
    const titleNode = nodes[0] || [...document.querySelectorAll("div")].filter((d) => (d.innerText || "").includes(t) && d.children.length === 0)[0];
    if (!titleNode) return "제목 노드 없음";
    const row = titleNode.parentElement;                 // 제목 + 상태줄
    const txt = (row?.innerText || "");
    return /완료/.test(txt) ? "ok" : "미완료: " + txt.replace(/s+/g, " ").slice(0, 80);
  }, title);
  if (res !== "ok") throw new Error(`${res} — ${title}`);
};
// 모달 안에서 텍스트가 정확히 일치하는 버튼 클릭(부분일치 오클릭 방지)
const clickInModalExact = async (text) => {
  const ok = await page.evaluate((t) => {
    const ov = [...document.querySelectorAll(".fixed.inset-0")].pop();
    if (!ov) return "모달 없음";
    const btn = [...ov.querySelectorAll("button")].find((b) => (b.innerText || "").trim() === t);
    if (!btn) return "버튼 없음";
    btn.click(); return "ok";
  }, text);
  if (ok !== "ok") throw new Error(`모달 내 정확일치 클릭 실패(${ok}): ${text}`);
  await sleep(450);
};
// 모달 안 오류 메시지(빨간 텍스트) 읽기
const modalError = async () => page.evaluate(() => {
  const ov = [...document.querySelectorAll(".fixed.inset-0")].pop();
  if (!ov) return "";
  const el = [...ov.querySelectorAll("*")].find((e) => /text-rose-400/.test(e.className || "") && e.innerText.trim());
  return el ? el.innerText.trim() : "";
});
const hasText = async (text) => page.evaluate((t) => document.body.innerText.includes(t), text);
const expectText = async (t) => {
  if (!(await hasText(t))) {
    const body = await page.evaluate(() => document.body.innerText.replace(/\s+/g, " ").slice(0, 260));
    throw new Error(`"${t}" 없음 · 현재화면: ${body}`);
  }
};
const typeExact = async (placeholder, value) => {
  const el = await page.$(`input[placeholder="${placeholder}"], textarea[placeholder="${placeholder}"]`);
  if (!el) throw new Error(`입력 대상 없음(정확 일치): ${placeholder}`);
  await el.click({ clickCount: 3 }); await el.type(value, { delay: 8 });
};
// 퀘스트 카드의 완료 버튼 클릭 — 제목을 가진 가장 안쪽 노드에서 위로 올라가 버튼 있는 행을 찾는다
const completeQuest = async (title) => {
  const r = await page.evaluate((t) => {
    const nodes = [...document.querySelectorAll("div,span")].filter((e) => (e.innerText || "").includes(t));
    const inner = nodes.filter((e) => !nodes.some((o) => o !== e && e.contains(o)));
    if (!inner.length) return "카드 없음";
    let row = inner[0];
    for (let i = 0; i < 6 && row; i++) { if (row.querySelector("button")) break; row = row.parentElement; }
    if (!row || !row.querySelector("button")) return "버튼 없음";
    const btns = [...row.querySelectorAll("button")];
    // 삭제(X) 버튼이 아닌 첫 버튼 = 완료 체크박스 또는 잠금(증거) 버튼
    const btn = btns[0];
    btn.click();
    return "ok";
  }, title);
  if (r !== "ok") throw new Error(`퀘스트 완료 실패(${r}): ${title}`);
  await sleep(600);
};
const typeInto = async (placeholder, value) => {
  const el = await page.$(`input[placeholder*="${placeholder}"], textarea[placeholder*="${placeholder}"]`);
  if (!el) throw new Error(`입력 대상 없음: ${placeholder}`);
  await el.click({ clickCount: 3 });
  await el.type(value, { delay: 8 });
};

(async () => {
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: !HEADFUL, args: ["--no-sandbox", "--window-size=430,932"], defaultViewport: { width: 430, height: 932, deviceScaleFactor: 1, isMobile: true, hasTouch: true } });
  page = await browser.newPage();
  page.on("console", (m) => { if (m.type() === "error") errors.push(`console: ${m.text().slice(0, 200)}`); });
  page.on("pageerror", (e) => errors.push(`pageerror: ${String(e).split("\n")[0].slice(0, 200)}`));
  const covAll = [];
  const startCov = () => page.coverage.startJSCoverage({ resetOnNavigation: false, includeRawScriptCoverage: true });
  const stashCov = async () => { try { covAll.push(...(await page.coverage.stopJSCoverage())); } catch {} };
  await startCov();

  await step("파비콘 — 404 요청 없음", async () => {
    const misses = [];
    page.on("requestfailed", (rq) => misses.push(rq.url()));
    page.on("response", (rs) => { if (rs.status() === 404) misses.push(rs.url()); });
    await page.goto(URL, { waitUntil: "networkidle2", timeout: 60000 });
    await sleep(500);
    if (misses.length) throw new Error("404 요청: " + misses.map((u) => u.split("/").pop()).join(", "));
  });
  await step("앱 로드", async () => { await page.goto(URL, { waitUntil: "networkidle2", timeout: 60000 }); await sleep(400); if (!(await hasText("인생"))) throw new Error("타이틀 없음"); });
  await shot("title");
  const closeModal = async () => { // 열린 오버레이 전부 닫기(헤더 X → 실패 시 오버레이 클릭)
    for (let i = 0; i < 3; i++) {
      const info = await page.evaluate(() => {
        const ovs = [...document.querySelectorAll(".fixed.inset-0")];
        if (!ovs.length) return { n: 0 };
        const ov = ovs[ovs.length - 1];
        const btn = [...ov.querySelectorAll("button")].find((b) => b.querySelector("svg") && !b.innerText.trim());
        if (btn) btn.click(); else ov.click();
        return { n: ovs.length, via: btn ? "x" : "overlay", cls: ov.className.slice(0, 60) };
      });
      if (!info.n) return;
      await sleep(320);
      if (!(await page.evaluate(() => document.querySelectorAll(".fixed.inset-0").length))) return;
      if (i === 2) errors.push(`모달이 닫히지 않음: ${JSON.stringify(info)}`);
    }
  };
  const clickTab = async (name) => { // 하단 탭바 전용 클릭(본문의 동명 버튼과 혼동 방지)
    const ok = await page.evaluate((n) => {
      const nav = document.querySelector("nav");
      if (!nav) return false;
      const btn = [...nav.querySelectorAll("button")].find((b) => (b.innerText || "").includes(n));
      if (!btn) return false;
      btn.click(); return true;
    }, name);
    if (!ok) throw new Error(`탭 없음: ${name}`);
    await sleep(320);
  };
  // 새로고침 전후로 커버리지를 끊어서 누적(V8 커버리지는 내비게이션마다 초기화됨)
  const reload = async (opts) => { await stashCov(); await page.reload(opts || { waitUntil: "networkidle2" }); await startCov(); await sleep(300); };
  // 1x1 PNG fixture for photo attachments (evidence, study artifacts, profile)
  const PNG_PATH = path.join(OUT, "shot.png");
  fs.writeFileSync(PNG_PATH, Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64"));
  const attach = async () => {
    const input = (await page.$('.fixed.inset-0 input[type="file"]')) || (await page.$('input[type="file"]'));
    if (!input) throw new Error("no file input");
    await input.uploadFile(PNG_PATH);
    await sleep(600);
  };
  // Open the AddTaskModal from the goal card whose title contains goalTitle
  const openTaskModalFor = async (goalTitle) => {
    await clickTab("목표");
    const ok = await page.evaluate((t) => {
      const cards = [...document.querySelectorAll("div")].filter((d) => d.innerText.includes(t) && [...d.querySelectorAll("button")].some((b) => b.innerText.includes("실행")));
      const inner = cards[cards.length - 1];
      const btn = inner && [...inner.querySelectorAll("button")].find((b) => b.innerText.includes("실행"));
      if (btn) { btn.click(); return true; }
      return false;
    }, goalTitle);
    if (!ok) throw new Error("goal card task button not found: " + goalTitle);
    await sleep(600);
  };
  // Register a daily task of an activity kind (chip label 독서/운동/미팅) under a goal
  const addKindTask = async (goalTitle, kindLabel, title) => {
    await openTaskModalFor(goalTitle);
    if (kindLabel) { try { await clickInModal(kindLabel); } catch {} }
    await sleep(150);
    await typeInto("무엇을 하나요", title);
    await clickInModalExact("등록");
    await sleep(600);
    const e = await modalError(); if (e) errors.push("task registration rejected: " + e);
    await sleep(600); await closeModal();
  };
  // Complete an evidence-gated task (cert/exam) by attaching the photo fixture and submitting
  const submitPhotoEvidence = async (title) => {
    await clickTab("실행");
    await completeQuest(title);
    await sleep(400);
    await attach();
    await clickInModal("제출하고 완료");
    await sleep(1200); await closeModal();
    await clickTab("실행");
    await assertDone(title);
  };
  // Complete an activity task through its log modal; `fill` enters the modal fields
  const logActivity = async (title, fill) => {
    await clickTab("실행");
    await completeQuest(title);
    await sleep(400);
    await fill();
    for (const t of ["기록", "완료", "저장"]) { try { await clickInModal(t); break; } catch {} }
    await sleep(1000); await closeModal();
    await assertDone(title);
  };
  const h = { step, shot, clickText, clickInModal, clickInModalExact, assertDone, modalError, clickTab, reload, attach, openTaskModalFor, addKindTask, submitPhotoEvidence, logActivity, findByText, hasText, expectText, typeInto, typeExact, completeQuest, sleep, page, errors, closeModal, metrics: {} };

  h.metrics = {};
  await require("./flow.js")(h);

  // ── 커버리지
  await stashCov();
  const cov = [];
  for (const e of covAll) { // 같은 URL의 범위를 합집합으로 병합
    const cur = cov.find((c) => c.url === e.url);
    if (cur) cur.ranges.push(...e.ranges); else cov.push({ url: e.url, text: e.text, ranges: [...e.ranges] });
  }
  for (const c of cov) { // 범위 정렬·병합
    c.ranges.sort((a, b) => a.start - b.start || a.end - b.end);
    const merged = [];
    for (const rg of c.ranges) { const last = merged[merged.length - 1]; if (last && rg.start <= last.end) last.end = Math.max(last.end, rg.end); else merged.push({ ...rg }); }
    c.ranges = merged;
  }
  const summary = cov.map((e) => {
    const used = e.ranges.reduce((s, r) => s + (r.end - r.start), 0);
    return { url: e.url.split("/").pop(), total: e.text.length, used, pct: +(100 * used / e.text.length).toFixed(1) };
  });
  fs.writeFileSync(path.join(OUT, `${TAG}-coverage.json`), JSON.stringify(cov.map((e) => ({ url: e.url, text: e.text, ranges: e.ranges })), null, 0));
  const res = { tag: TAG, url: URL, steps, errors, metrics: h.metrics, coverage: summary };
  fs.writeFileSync(path.join(OUT, `${TAG}-result.json`), JSON.stringify(res, null, 1));
  const fail = steps.filter((s) => !s.ok);
  console.log(`\n[E2E ${TAG}] 단계 ${steps.length} · 실패 ${fail.length} · 콘솔 오류 ${errors.length}`);
  for (const s of steps) console.log(`  ${s.ok ? "✓" : "✗"} ${s.name}${s.ok ? "" : " — " + s.err} (${s.ms}ms)`);
  if (errors.length) { console.log("\n[오류]"); for (const e of errors.slice(0, 15)) console.log("  " + e); }
  console.log("\n[커버리지]"); for (const c of summary) console.log(`  ${c.url}: ${c.pct}% (${c.used}/${c.total}B)`);
  await browser.close();
  process.exit(fail.length ? 1 : 0);
})().catch((e) => { console.error("치명적 오류:", e); process.exit(2); });
