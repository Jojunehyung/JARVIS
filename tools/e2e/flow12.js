// The daily gate (2026-09-24) — a save with a profile and no `act.gate[today].passedAt` opens one full-screen layer in
// place of every tab and sheet: no X, an inert backdrop, no key closes it; the reader and the issue list open above it
// in gate-read mode (no route, one read-done button per screen that stamps a `HH:MM` time), `?open=issues` routes
// into that read step, a same-day reload lands in the app once passed, a save re-dated to yesterday opens the gate
// again, onboarding sees no gate, and the settings sheet states the month's counts. Phase 1 wrote steps 1–3 and 9–11;
// Phase 2 inserts the quiz steps 4–8 between them. Runs after flow11 and before flow4, which replaces the save.
// Written under the standing instruction that the suite is not run: every step parses, none has been executed.
module.exports = async (h) => {
  const { step, clickInModalExact, overlayText, openSettings, hasText, sleep, page } = h;
  const KEY = "liferpg-state-v1";
  // Dates come from the page with the app's own local-date logic (never toISOString), noon-anchored.
  const dstrIn = (delta) => page.evaluate((d) => {
    const t = new Date(); t.setHours(12, 0, 0, 0); t.setDate(t.getDate() + d);
    const two = (n) => String(n).padStart(2, "0");
    return `${t.getFullYear()}-${two(t.getMonth() + 1)}-${two(t.getDate())}`;
  }, delta);
  const readState = () => page.evaluate((k) => { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } }, KEY);
  const writeState = (st) => page.evaluate((k, s) => localStorage.setItem(k, JSON.stringify(s)), KEY, st);
  // Every overlay's text, first to last: the gate is the first `.fixed.inset-0`, a sheet above it is the last
  // (`overlayText` reads the last one); `gateText` reads the first.
  const overlays = () => page.evaluate(() => [...document.querySelectorAll(".fixed.inset-0")].map((o) => (o.innerText || "").replace(/\s+/g, " ").trim()));
  const gateText = async () => (await overlays())[0] || "";
  const brief = (list) => JSON.stringify(list.map((t) => t.slice(0, 40)));
  const scrollToEnd = () => page.evaluate(() => document.querySelector("[data-read-end]")?.scrollIntoView({ block: "end" }));
  // A button by its exact text on the first overlay (the gate) or on the last one (the sheet above it).
  const buttonOf = (label, onGate = false) => page.evaluate((l, g) => {
    const ovs = [...document.querySelectorAll(".fixed.inset-0")];
    const ov = g ? ovs[0] : ovs[ovs.length - 1];
    const b = ov && [...ov.querySelectorAll("button")].find((x) => (x.innerText || "").trim() === l);
    return b ? { found: true, disabled: b.disabled } : { found: false, disabled: null };
  }, label, onGate);
  const expectButton = async (label, disabled, onGate = false) => {
    const b = await buttonOf(label, onGate);
    if (!b.found) throw new Error(`button not found: ${label}`);
    if (b.disabled !== disabled) throw new Error(`${label} is ${b.disabled ? "disabled" : "enabled"}, expected ${disabled ? "disabled" : "enabled"}`);
  };
  // The sheet's header X — the one icon-only button; `closeModal` is not used above the gate, since after closing the
  // sheet it would go on to the gate, which it cannot close.
  const tapHeaderX = () => page.evaluate(() => {
    const ov = [...document.querySelectorAll(".fixed.inset-0")].pop();
    const b = ov && [...ov.querySelectorAll("button")].find((el) => el.querySelector("svg") && !(el.innerText || "").trim());
    if (!b) return false;
    b.click();
    return true;
  });
  const HHMM = /^\d\d:\d\d$/;
  const saved = await readState();
  const boundary0 = JSON.stringify(h.recordBoundary(saved));
  const today = await dstrIn(0), yesterday = await dstrIn(-1);
  const base = page.url().split("?")[0];

  await step("the gate opens on a save without today's stamp: no nav, no X, an inert backdrop, three steps stated, later steps disabled", async () => {
    const s = structuredClone(saved);
    delete s.act.gate;
    s.work = (s.work || []).filter((w) => w.createdAt !== today);
    s.act.briefingSeen = yesterday;
    // Twelve meetings of the last seven days with 300-char decisions, so the reader overflows at 430 × 932 (step 2
    // asserts the disabled state on an overflowing sheet and would be meaningless on one that fits).
    const days = [];
    for (let i = 0; i < 7; i++) days.push(await dstrIn(-i));
    const decisions = "관문 결정 문장. ".repeat(40).slice(0, 300);
    s.meetingProjects = [...(s.meetingProjects || []), { id: "gate-p", name: "E2E 관문 프로젝트", track: "biz", createdAt: days[6] }];
    s.meetings = [...(s.meetings || []), ...Array.from({ length: 12 }, (_, i) => ({
      id: `gate-m${i}`, projectId: "gate-p", date: days[i % 7], title: `E2E 관문 회의 ${i + 1}`, attendees: "", summary: `관문 회의 ${i + 1} 요약`,
      decisions, actions: "", createdAt: days[i % 7], taskIds: [], progress: [], followUps: [], aiHidden: false,
    }))];
    await writeState(s);
    await h.reload({}, { keepModal: true, keepGate: true });
    await sleep(600);
    const ovs = await overlays();
    if (ovs.length !== 1) throw new Error(`${ovs.length} overlays on load, expected the gate alone (the reader must not auto-open over it): ` + brief(ovs));
    if (!ovs[0].startsWith(`오늘의 관문 — ${today}`)) throw new Error("the gate title: " + ovs[0].slice(0, 80));
    for (const t of ["1 읽기 — 오늘 읽을 것 미완료 · 이슈 목록 미완료", "2 퀴즈 — 아직", "3 업무 갱신 — 없음", "닫기와 건너뛰기는 없어요"]) {
      if (!ovs[0].includes(t)) throw new Error(`the gate does not state "${t}": ` + ovs[0].slice(0, 300));
    }
    const dom = await page.evaluate(() => {
      const ov = document.querySelector(".fixed.inset-0");
      return {
        nav: document.querySelector("nav") !== null, main: document.querySelector("main") !== null,
        iconOnly: [...ov.querySelectorAll("button")].some((b) => b.querySelector("svg") && !(b.innerText || "").trim()),
      };
    });
    if (dom.nav || dom.main) throw new Error("the tab bar or the screen is rendered behind the gate: " + JSON.stringify(dom));
    if (dom.iconOnly) throw new Error("the gate carries an icon-only (close) button");
    // The layer's own background and the Escape key are inert
    await page.evaluate(() => document.querySelector(".fixed.inset-0").click());
    await sleep(300);
    await page.keyboard.press("Escape");
    await sleep(300);
    const after = await overlays();
    if (after.length !== 1 || !after[0].startsWith("오늘의 관문 —")) throw new Error("a background tap or Escape changed the gate: " + brief(after));
    for (const l of ["퀴즈 요청문 만들기 ›", "AI로 만들기 ›", "업무 추가 ›", "통과"]) await expectButton(l, true, true);
    for (const l of ["오늘 읽을 것 열기 ›", "이슈 목록 열기 ›"]) await expectButton(l, false, true);
  });

  await step("the reader inside the gate has no route, its read-done button is disabled until the end is reached, and stamps readReaderAt and briefingSeen", async () => {
    await clickInModalExact("오늘 읽을 것 열기 ›");
    await sleep(500);
    const ovs = await overlays();
    if (ovs.length !== 2 || !ovs[1].startsWith(`오늘 읽을 것 — ${today}`)) throw new Error("the reader did not open above the gate: " + brief(ovs));
    const sheet = await page.evaluate(() => {
      const ov = [...document.querySelectorAll(".fixed.inset-0")].pop();
      const card = ov.querySelector(".overflow-y-auto");
      return { routes: ov.querySelectorAll('button[aria-label$=" 열기"]').length, overflow: card ? card.scrollHeight > card.clientHeight : null };
    });
    if (sheet.routes) throw new Error(`the reader inside the gate still renders ${sheet.routes} section route(s)`);
    for (const t of ["브리핑 ›", "이슈 목록 ›", "닫기"]) if (ovs[1].includes(t)) throw new Error(`the reader inside the gate still offers "${t}"`);
    if (sheet.overflow !== true) throw new Error("the planted reader does not overflow, so the disabled check would be meaningless: " + JSON.stringify(sheet));
    await expectButton("다 읽었어요", true);
    await scrollToEnd();
    await sleep(400);
    await expectButton("다 읽었어요", false);
    await clickInModalExact("다 읽었어요");
    await sleep(400);
    if ((await overlays()).length !== 1) throw new Error("the reader stayed open after the read-done tap");
    const gate = await gateText();
    if (!/오늘 읽을 것 완료 \d\d:\d\d/.test(gate) || !gate.includes("이슈 목록 미완료")) throw new Error("the gate after the reader: " + gate.slice(0, 200));
    const st = await readState();
    const e = st.act.gate?.[today] || {};
    if (!HHMM.test(e.readReaderAt || "") || e.readIssuesAt) throw new Error("the reader stamp: " + JSON.stringify(e));
    if (st.act.briefingSeen !== today) throw new Error("the reader's read-done did not mark the day seen: " + st.act.briefingSeen);
  });

  await step("the issue list inside the gate opens no sheet, shows no tab route, and stamps readIssuesAt", async () => {
    await clickInModalExact("이슈 목록 열기 ›");
    await sleep(500);
    let ovs = await overlays();
    if (ovs.length !== 2 || !ovs[1].startsWith("이슈 목록")) throw new Error("the issue list did not open above the gate: " + brief(ovs));
    // A row is a `TodoRow` button (`bg-zinc-950 rounded-xl`); the planted project's latest minutes guarantee one
    const tapped = await page.evaluate(() => {
      const ov = [...document.querySelectorAll(".fixed.inset-0")].pop();
      const row = ov.querySelector("button.bg-zinc-950.rounded-xl");
      if (!row) return false;
      row.scrollIntoView({ block: "center" });
      row.click();
      return true;
    });
    if (!tapped) throw new Error("no row on the issue list to tap");
    await sleep(400);
    ovs = await overlays();
    if (ovs.length !== 2 || !ovs[1].startsWith("이슈 목록")) throw new Error("a row tap inside the gate opened a sheet: " + brief(ovs));
    const more = await page.evaluate(() => [...[...document.querySelectorAll(".fixed.inset-0")].pop().querySelectorAll("button")].some((b) => /건 더 ›$/.test((b.innerText || "").trim())));
    if (more) throw new Error("the issue list inside the gate still offers a tab route behind its more-button");
    await scrollToEnd();
    await sleep(400);
    await clickInModalExact("다 읽었어요");
    await sleep(400);
    const gate = await gateText();
    if ((await overlays()).length !== 1 || !/이슈 목록 완료 \d\d:\d\d/.test(gate)) throw new Error("the gate after the issue list: " + gate.slice(0, 200));
    const e = (await readState()).act.gate?.[today] || {};
    if (!HHMM.test(e.readIssuesAt || "") || !HHMM.test(e.readReaderAt || "")) throw new Error("the issue list stamp: " + JSON.stringify(e));
    await expectButton("퀴즈 요청문 만들기 ›", false, true);
    await expectButton("AI로 만들기 ›", true, true);
    await expectButton("통과", true, true);
  });

  await step("a reload the same day opens nothing; a save re-dated to yesterday opens the gate again, and the reader does not open over it", async () => {
    // Phase 1 has no quiz sheet, so the passed state is reached through the harness stamp; Phase 2's step 8 passes the
    // gate through the app itself and this step then follows it.
    if (!(await h.plantGate())) throw new Error("plantGate found no save with a profile");
    await h.reload({}, { keepModal: true, keepGate: true });
    await sleep(600);
    const open = await page.evaluate(() => ({ overlays: document.querySelectorAll(".fixed.inset-0").length, tabs: document.querySelectorAll("nav button").length }));
    if (open.overlays !== 0 || open.tabs !== 7) throw new Error("a same-day reload after the pass: " + JSON.stringify(open));
    // The next day is simulated by re-dating the save — today's entry moves under yesterday's key and the seen-marker
    // goes back a day; the clock is not moved.
    const s = await readState();
    s.act.gate = { ...(s.act.gate || {}), [yesterday]: s.act.gate[today] };
    delete s.act.gate[today];
    s.act.briefingSeen = yesterday;
    await writeState(s);
    await h.reload({}, { keepModal: true, keepGate: true });
    await sleep(600);
    const ovs = await overlays();
    if (ovs.length !== 1 || !ovs[0].startsWith(`오늘의 관문 — ${today}`)) throw new Error("the re-dated save did not open the gate alone: " + brief(ovs));
    if (!ovs[0].includes("1 읽기 — 오늘 읽을 것 미완료 · 이슈 목록 미완료")) throw new Error("yesterday's stamps count for today: " + ovs[0].slice(0, 200));
    if (await page.evaluate(() => document.querySelector("nav") !== null)) throw new Error("the tab bar is rendered under the re-opened gate");
  });

  await step("?open=issues routes into the gate's read step and strips the query; the settings line states the month's facts", async () => {
    await page.goto(`${base}?open=issues`, { waitUntil: "networkidle2" });
    await sleep(600);
    const ovs = await overlays();
    if (ovs.length !== 2 || !ovs[0].startsWith("오늘의 관문") || !ovs[1].startsWith("이슈 목록")) throw new Error("?open=issues with the gate active: " + brief(ovs));
    if (!ovs[1].includes("다 읽었어요") || ovs[1].includes("닫기")) throw new Error("the routed issue list is not in gate-read mode: " + ovs[1].slice(-120));
    if ((await page.evaluate(() => location.search)) !== "") throw new Error("the query was not stripped: " + (await page.evaluate(() => location.search)));
    if (!(await tapHeaderX())) throw new Error("the routed sheet has no header X");
    await sleep(400);
    const left = await overlays();
    if (left.length !== 1 || !left[0].startsWith("오늘의 관문")) throw new Error("closing the routed sheet did not leave the gate alone: " + brief(left));
    const e = (await readState()).act.gate?.[today] || {};
    if (e.readIssuesAt) throw new Error("the header X stamped readIssuesAt: " + JSON.stringify(e));
    // The settings line, computed here from the save by the app's rule: this month's entries, passed = with
    // `passedAt`, the quiz averages to one decimal or the no-quiz wording (the E2E save carries no quiz in Phase 1).
    await h.plantGate();
    await h.reload();
    await openSettings();
    const gate = (await readState()).act.gate || {};
    const month = today.slice(0, 7);
    const entries = Object.entries(gate).filter(([d]) => d.startsWith(month)).map(([, v]) => v);
    const passed = entries.filter((v) => v.passedAt).length;
    const quizzes = entries.filter((v) => v.quiz);
    const mean = (f) => Math.round((quizzes.reduce((n, v) => n + f(v.quiz), 0) / quizzes.length) * 10) / 10;
    const want = `이번 달 관문 통과 ${passed}일 · 미통과 ${entries.length - passed}일 · ${quizzes.length ? `퀴즈 평균 ${mean((q) => q.score)}/${mean((q) => q.total)}` : "퀴즈 없음"}`;
    const sheet = await overlayText();
    if (!sheet.includes("오늘의 관문") || !sheet.includes(want)) throw new Error(`the settings sheet does not state "${want}": ` + sheet.slice(0, 400));
    if (!sheet.includes("끄는 설정은 없어요")) throw new Error("the settings sheet does not state that the gate has no switch");
    await h.closeModal();
  });

  await step("onboarding sees no gate; the saved state is restored", async () => {
    const st = await readState();
    if (JSON.stringify(h.recordBoundary(st)) !== boundary0) throw new Error(`the gate flow moved a record: ${boundary0} -> ${JSON.stringify(h.recordBoundary(st))}`);
    await page.evaluate(() => localStorage.clear());
    await h.reload({}, { keepModal: true, keepGate: true });
    await sleep(600);
    if (!(await hasText("시작하기"))) throw new Error("no onboarding after the save was cleared");
    if (await hasText("오늘의 관문")) throw new Error("the gate is shown on onboarding");
    await writeState(saved);
    await h.reload();
  });
};
