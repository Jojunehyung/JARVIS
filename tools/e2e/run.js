// Life Manager E2E — drives every screen flow in a real Chrome and collects JS coverage
// Usage: node run.js [--url http://localhost:4173] [--headful] [--tag before]
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

// Find an element by text — the innermost, smallest visible element carrying that text
const findByText = async (text, sel = "button,[role=button],input,label,span,div,a") =>
  page.evaluateHandle((t, s) => {
    const vis = (e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(e).visibility !== "hidden"; };
    let hit = [...document.querySelectorAll(s)].filter((e) => vis(e) && ((e.innerText || e.value || "").includes(t)));
    hit = hit.filter((e) => !hit.some((o) => o !== e && e.contains(o))); // drop ancestors when a descendant carries the same text
    const rank = (e) => (e.tagName === "BUTTON" || e.tagName === "INPUT" ? 0 : 1);
    const area = (e) => { const r = e.getBoundingClientRect(); return r.width * r.height; };
    hit.sort((a, b) => rank(a) - rank(b) || area(a) - area(b));
    return hit[0] || null;
  }, text, sel);
const clickText = async (text, sel) => {
  const h = await findByText(text, sel);
  const el = h.asElement();
  if (!el) throw new Error(`click target not found: "${text}"`);
  await el.evaluate((e) => e.scrollIntoView({ block: "center" }));
  await el.click();
  await sleep(170);
};
// Click only inside the open modal — avoids hitting a same-named button on the screen behind
const clickInModal = async (text) => {
  const ok = await page.evaluate((t) => {
    const ovs = [...document.querySelectorAll(".fixed.inset-0")];
    const ov = ovs[ovs.length - 1];
    if (!ov) return "모달 없음";
    const btns = [...ov.querySelectorAll("button")].filter((b) => (b.innerText || "").includes(t));
    if (!btns.length) return "버튼 없음";
    btns[0].click(); return "ok";
  }, text);
  if (ok !== "ok") throw new Error(`click inside modal failed (${ok}): ${text}`);
  await sleep(400);
};
// Verify the task really shows as completed — the title node's sibling text must carry the "done" label (Korean UI copy)
const assertDone = async (title) => {
  const res = await page.evaluate((t) => {
    const nodes = [...document.querySelectorAll("div")].filter((d) => (d.innerText || "").trim().startsWith(t) && d.children.length === 0);
    const titleNode = nodes[0] || [...document.querySelectorAll("div")].filter((d) => (d.innerText || "").includes(t) && d.children.length === 0)[0];
    if (!titleNode) return "제목 노드 없음";
    const row = titleNode.parentElement;                 // title + status line
    const txt = (row?.innerText || "");
    return /완료/.test(txt) ? "ok" : "미완료: " + txt.replace(/s+/g, " ").slice(0, 80);
  }, title);
  if (res !== "ok") throw new Error(`${res} — ${title}`);
};
// Click the button inside the modal whose text matches exactly (prevents partial-match misclicks)
const clickInModalExact = async (text) => {
  const ok = await page.evaluate((t) => {
    const ov = [...document.querySelectorAll(".fixed.inset-0")].pop();
    if (!ov) return "모달 없음";
    const btn = [...ov.querySelectorAll("button")].find((b) => (b.innerText || "").trim() === t);
    if (!btn) return "버튼 없음";
    btn.click(); return "ok";
  }, text);
  if (ok !== "ok") throw new Error(`exact-match click inside modal failed (${ok}): ${text}`);
  await sleep(450);
};
// Read the error message (red text) inside the modal
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
    throw new Error(`"${t}" not found · current screen: ${body}`);
  }
};
// Set a controlled React input/textarea directly — needed for <input type="date"> and long pastes,
// where per-character typing is slow or unsupported. Uses the native setter so React sees the change.
// `nth` addresses one of several same-typed inputs (the from/to month pair of a CV entry, for instance).
const setValue = async (selector, value, nth = 0) => {
  const ok = await page.evaluate((sel, val, n) => {
    const el = document.querySelectorAll(sel)[n];
    if (!el) return false;
    const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, "value").set.call(el, val);
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
    return true;
  }, selector, value, nth);
  if (!ok) throw new Error(`setValue target not found: ${selector}[${nth}]`);
  await sleep(150);
};
const typeExact = async (placeholder, value) => {
  const el = await page.$(`input[placeholder="${placeholder}"], textarea[placeholder="${placeholder}"]`);
  if (!el) throw new Error(`input not found (exact match): ${placeholder}`);
  await el.click({ clickCount: 3 }); await el.type(value, { delay: 8 });
};
// Click the complete button on a task card — walk up from the innermost node holding the title to the row that has buttons
const completeQuest = async (title) => {
  const r = await page.evaluate((t) => {
    const nodes = [...document.querySelectorAll("div,span")].filter((e) => (e.innerText || "").includes(t));
    const inner = nodes.filter((e) => !nodes.some((o) => o !== e && e.contains(o)));
    if (!inner.length) return "카드 없음";
    let row = inner[0];
    for (let i = 0; i < 6 && row; i++) { if (row.querySelector("button")) break; row = row.parentElement; }
    if (!row || !row.querySelector("button")) return "버튼 없음";
    const btns = [...row.querySelectorAll("button")];
    // first button that is not the delete (X) button = the completion checkbox or the lock (evidence) button
    const btn = btns[0];
    btn.click();
    return "ok";
  }, title);
  if (r !== "ok") throw new Error(`task completion failed (${r}): ${title}`);
  await sleep(600);
};
const typeInto = async (placeholder, value) => {
  const el = await page.$(`input[placeholder*="${placeholder}"], textarea[placeholder*="${placeholder}"]`);
  if (!el) throw new Error(`input not found: ${placeholder}`);
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

  await step("favicon — no 404 requests", async () => {
    const misses = [];
    page.on("requestfailed", (rq) => misses.push(rq.url()));
    page.on("response", (rs) => { if (rs.status() === 404) misses.push(rs.url()); });
    await page.goto(URL, { waitUntil: "networkidle2", timeout: 60000 });
    await sleep(500);
    if (misses.length) throw new Error("404 requests: " + misses.map((u) => u.split("/").pop()).join(", "));
  });
  await step("app load", async () => { await page.goto(URL, { waitUntil: "networkidle2", timeout: 60000 }); await sleep(400); if (!(await hasText("인생"))) throw new Error("title missing"); });
  await shot("title");
  const closeModal = async () => { // close every open overlay (header X → click the backdrop if that fails)
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
      if (i === 2) errors.push(`modal did not close: ${JSON.stringify(info)}`);
    }
  };
  const clickTab = async (name) => { // bottom tab bar only (avoids confusion with a same-named button in the body)
    const ok = await page.evaluate((n) => {
      const nav = document.querySelector("nav");
      if (!nav) return false;
      const btn = [...nav.querySelectorAll("button")].find((b) => (b.innerText || "").includes(n));
      if (!btn) return false;
      btn.click(); return true;
    }, name);
    if (!ok) throw new Error(`tab not found: ${name}`);
    await sleep(320);
  };
  // Editable rows, found structurally: every row carries a `수정` button and the card is its grandparent.
  // `texts` are the strings the card must show; with `label`, the button of that exact name is tapped on the
  // first match. Shared by the schedule and business flows, whose cards are built to the same shape.
  const rows = (texts, label = null) => page.evaluate((ts, l) => {
    const cards = [...document.querySelectorAll("button")]
      .filter((b) => (b.innerText || "").trim() === "수정")
      .map((b) => b.parentElement.parentElement)
      .filter((c) => ts.every((t) => (c.innerText || "").includes(t)));
    const out = cards.map((c) => c.innerText.replace(/\s+/g, " ").trim());
    if (!l) return { rows: out };
    const btn = cards[0] && [...cards[0].querySelectorAll("button")].find((b) => (b.innerText || "").trim() === l);
    if (!btn) return { rows: out, clicked: false };
    btn.scrollIntoView({ block: "center" });
    btn.click();
    return { rows: out, clicked: true };
  }, texts, label);
  // The `실행` to-do list, read by group. Each group is a `<section>` led by its label and every row carries its
  // title in a `.text-sm.font-semibold` node; all three row kinds share the same shell, so the walk up from the
  // title stops on the shell and the buttons/inputs that come back are exactly that row's controls. `label` null
  // reads every group. With `tap = { title, button }` the named button of that row is pressed — or the row itself
  // when `button` is omitted — so a step addresses one row instead of the first same-named button on the screen.
  const todoRows = (label = null, tap = null) => page.evaluate((l, tp) => {
    const labelOf = (s) => { const e = s.querySelector(".tracking-widest"); return e ? (e.innerText || "").trim() : null; };
    const secs = [...document.querySelectorAll("section")].filter((s) => labelOf(s) !== null && (l === null || labelOf(s) === l));
    if (l !== null && !secs.length) return null;
    const out = [];
    for (const sec of secs) {
      for (const node of sec.querySelectorAll(".text-sm.font-semibold")) {
        let row = node;
        for (let i = 0; i < 6 && row.parentElement; i++) {
          row = row.parentElement;
          const cls = row.className || "";
          if (/bg-zinc-950/.test(cls) && /rounded-xl/.test(cls)) break;
        }
        const btns = [...row.querySelectorAll("button")];
        const title = (node.innerText || "").trim();
        if (tp && tp.title === title) {
          const b = tp.button ? btns.find((x) => (x.innerText || "").trim() === tp.button) : row.tagName === "BUTTON" ? row : null;
          if (b) { b.scrollIntoView({ block: "center" }); b.click(); }
        }
        out.push({
          group: labelOf(sec), title,
          text: (row.innerText || "").replace(/\s+/g, " ").trim(),
          buttons: btns.map((b) => (b.innerText || "").trim()).filter(Boolean),
          controls: btns.length + row.querySelectorAll("input").length,
        });
      }
    }
    return out;
  }, label, tap);
  // The `성장` tab's area rows: one button per area, each stating its `{grade}/9` counter. Tapping a row is the
  // only route into the promotion gate modal — the tab carries no promote button of its own — so every promotion
  // step goes through here. `name` picks the row of that area; omitted, the first row is taken. Returns false
  // when no row matched, so a caller can report it instead of silently passing.
  const openAreaGate = async (name = null) => {
    const ok = await page.evaluate((n) => {
      const rows = [...document.querySelectorAll("main button")].filter((b) => /\d\/9/.test(b.innerText || ""));
      const row = n ? rows.find((b) => (b.innerText || "").includes(n)) : rows[0];
      if (!row) return false;
      row.scrollIntoView({ block: "center" });
      row.click();
      return true;
    }, name);
    if (ok) await sleep(450);
    return ok;
  };
  // Click a page button by its exact label — calendar controls and view chips sit outside any modal, and a
  // partial match would hit `계약 추가` instead of the `계약` chip.
  const clickExact = async (label) => {
    const ok = await page.evaluate((l) => {
      const b = [...document.querySelectorAll("button")].find((x) => (x.innerText || "").trim() === l);
      if (!b) return false;
      b.scrollIntoView({ block: "center" }); b.click(); return true;
    }, label);
    if (!ok) throw new Error(`button not found: ${label}`);
    await sleep(350);
  };
  // Split coverage around reloads and accumulate (V8 coverage resets on every navigation)
  // The app opens the daily briefing on the first load of each day; dismiss it so the next click
  // reaches the screen behind. Pass { keepModal: true } in steps that assert the briefing itself.
  const reload = async (opts, { keepModal = false } = {}) => {
    await stashCov(); await page.reload(opts || { waitUntil: "networkidle2" }); await startCov(); await sleep(300);
    if (!keepModal) { try { await closeModal(); } catch {} }
  };
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
  // Register a daily task of an activity kind (kind = the Korean chip label) under a goal
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
  const h = { step, shot, clickText, clickInModal, clickInModalExact, clickExact, assertDone, modalError, clickTab, reload, rows, todoRows, openAreaGate, setValue, attach, openTaskModalFor, addKindTask, submitPhotoEvidence, logActivity, findByText, hasText, expectText, typeInto, typeExact, completeQuest, sleep, page, errors, closeModal, metrics: {} };

  h.metrics = {};
  await require("./flow.js")(h);

  // ── Coverage
  await stashCov();
  const cov = [];
  for (const e of covAll) { // merge ranges of the same URL as a union
    const cur = cov.find((c) => c.url === e.url);
    if (cur) cur.ranges.push(...e.ranges); else cov.push({ url: e.url, text: e.text, ranges: [...e.ranges] });
  }
  for (const c of cov) { // sort and merge ranges
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
  console.log(`\n[E2E ${TAG}] steps ${steps.length} · failed ${fail.length} · console errors ${errors.length}`);
  for (const s of steps) console.log(`  ${s.ok ? "✓" : "✗"} ${s.name}${s.ok ? "" : " — " + s.err} (${s.ms}ms)`);
  if (errors.length) { console.log("\n[errors]"); for (const e of errors.slice(0, 15)) console.log("  " + e); }
  console.log("\n[coverage]"); for (const c of summary) console.log(`  ${c.url}: ${c.pct}% (${c.used}/${c.total}B)`);
  await browser.close();
  process.exit(fail.length ? 1 : 0);
})().catch((e) => { console.error("치명적 오류:", e); process.exit(2); });
