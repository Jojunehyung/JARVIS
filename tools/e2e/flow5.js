// Daily assistant — due dates and the home agenda (phase A). Briefing, journal, review and the
// assistant bridge steps are appended in phases B and C.
module.exports = async (h) => {
  const { step, clickInModal, clickInModalExact, clickTab, expectText, typeInto, setValue, openTaskModalFor, closeModal, sleep, page, errors } = h;

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
};
