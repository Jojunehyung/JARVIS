// Daily assistant — due dates, the home agenda, the briefing and the journal. The assistant bridge
// and the weekly review are appended in phase C.
module.exports = async (h) => {
  const { step, clickText, clickInModal, clickInModalExact, clickTab, expectText, typeInto, setValue, openTaskModalFor, closeModal, sleep, page, errors } = h;
  const readState = () => page.evaluate(() => { try { return JSON.parse(localStorage.getItem("liferpg-state-v1")); } catch { return null; } });
  const patchAct = (patch) => page.evaluate((p) => {
    const s = JSON.parse(localStorage.getItem("liferpg-state-v1"));
    Object.assign(s.act, p);
    localStorage.setItem("liferpg-state-v1", JSON.stringify(s));
  }, patch);

  // Dates are computed in the page with the app's own local-date logic (never toISOString).
  const dstrIn = (delta) => page.evaluate((d) => {
    const t = new Date(); t.setHours(12, 0, 0, 0); t.setDate(t.getDate() + d);
    const p = (n) => String(n).padStart(2, "0");
    return `${t.getFullYear()}-${p(t.getMonth() + 1)}-${p(t.getDate())}`;
  }, delta);

  const addDatedTask = async (title, delta) => {
    await openTaskModalFor("하네스 설계 엔지니어 취업");
    await typeInto("무엇을 하나요", title);
    await clickInModalExact("오늘 1회");
    await setValue('.fixed.inset-0 input[type="date"]', await dstrIn(delta));
    await clickInModalExact("등록");
    await sleep(600); await closeModal();
  };

  await step("once task with a due date", async () => {
    await addDatedTask("이력서 초안 작성", 3);
    await clickTab("실행");
    await expectText("D-3");
  });

  await step("overdue task shows as past due", async () => {
    await addDatedTask("포트폴리오 정리", -1);
    await clickTab("실행");
    await expectText("기한 지남");
  });

  await step("home agenda orders overdue → due → daily", async () => {
    await clickTab("홈");
    await sleep(300);
    const order = await page.evaluate(() => {
      const label = [...document.querySelectorAll("div")].find((d) => (d.innerText || "").trim() === "오늘 할 일");
      const card = label?.closest("section");
      if (!card) return null;
      return [...card.querySelectorAll(".text-sm.font-semibold")].map((e) => e.innerText.trim());
    });
    if (!order || !order.length) throw new Error("agenda rows not found");
    const iOver = order.findIndex((t) => t.includes("포트폴리오 정리"));
    const iDue = order.findIndex((t) => t.includes("이력서 초안 작성"));
    if (iOver < 0 || iDue < 0) throw new Error("dated tasks missing from the agenda: " + order.join(" | "));
    if (iOver > iDue) errors.push("agenda order: overdue task listed after the due-today task");
  });

  await step("home card opens the briefing and stamps it seen", async () => {
    await clickTab("홈");
    await expectText("오늘 브리핑");
    await clickText("브리핑 열기");
    await sleep(400);
    await expectText("목표 페이스");
    await expectText("기한 지남");
    await closeModal();
    await sleep(400);
    const st = await readState();
    const today = await dstrIn(0);
    if (st.act.briefingSeen !== today) throw new Error("briefingSeen not stamped: " + st.act.briefingSeen);
  });

  await step("a new day opens the briefing on load", async () => {
    await patchAct({ briefingSeen: await dstrIn(-1) });
    await h.reload({}, { keepModal: true });
    await sleep(700);
    const shown = await page.evaluate(() => document.body.innerText.includes("오늘 브리핑 —"));
    if (!shown) throw new Error("the briefing did not open on a new day");
    await closeModal();
  });

  await step("the same day does not reopen it", async () => {
    await h.reload({}, { keepModal: true });
    await sleep(700);
    const open = await page.evaluate(() => document.querySelectorAll(".fixed.inset-0").length);
    if (open) { await closeModal(); throw new Error("the briefing reopened on the same day"); }
  });

  await step("streak line states the risk", async () => {
    await patchAct({ briefingSeen: await dstrIn(-1), lastActive: await dstrIn(-1), streak: 3 });
    await h.reload({}, { keepModal: true });
    await sleep(700);
    await expectText("연속 3일이 끊겨요");
    await closeModal();
  });

  await step("journal persists across a reload", async () => {
    await clickTab("홈");
    await clickText("일지 쓰기");
    await sleep(400);
    await typeInto("오늘 한 일", "E2E 일지 — CATIA 1시간");
    await clickInModalExact("저장");
    await sleep(600);
    await h.reload();
    await clickTab("홈");
    await clickText("일지 쓰기");
    await sleep(400);
    const val = await page.evaluate(() => document.querySelector(".fixed.inset-0 textarea")?.value || "");
    if (!val.includes("E2E 일지")) throw new Error("journal text lost: " + val);
    await closeModal();
  });

  await step("metrics check-in stamps its date", async () => {
    await clickTab("성장");
    await clickText("체크인");
    await sleep(400);
    await clickInModalExact("저장");
    await sleep(600);
    const st = await readState();
    const today = await dstrIn(0);
    if (st.act.lastCheckin !== today) throw new Error("lastCheckin not stamped: " + st.act.lastCheckin);
    await expectText("마지막 체크인");
  });
};
