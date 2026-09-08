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
  // Switch to a tab and tap one of its buttons — the whole file opens screens this way.
  const openFrom = async (tab, label, ms = 400) => {
    await clickTab(tab);
    await clickText(label);
    await sleep(ms);
  };

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
    await openFrom("홈", "일지 쓰기");
    await typeInto("오늘 한 일", "E2E 일지 — CATIA 1시간");
    await clickInModalExact("저장");
    await sleep(600);
    await h.reload();
    await openFrom("홈", "일지 쓰기");
    const val = await page.evaluate(() => document.querySelector(".fixed.inset-0 textarea")?.value || "");
    if (!val.includes("E2E 일지")) throw new Error("journal text lost: " + val);
    await closeModal();
  });

  await step("packet carries the goals, tasks and journal", async () => {
    await openFrom("홈", "브리핑 열기");
    await clickInModal("AI에게 보내기");
    await sleep(400);
    const txt = await page.evaluate(() => document.querySelector(".fixed.inset-0 textarea")?.value || "");
    for (const t of ["[인생 관리", "하네스 설계 엔지니어 취업", "E2E 일지"]) {
      if (!txt.includes(t)) throw new Error(`packet missing "${t}" (${txt.length} chars)`);
    }
    if (txt.length > 4000) errors.push("packet longer than the 4000-char cap: " + txt.length);
    await clickInModalExact("복사");
    await sleep(400);
  });

  await step("pasted reply is validated before import", async () => {
    await clickInModal("AI 답변 붙여넣기");
    await sleep(400);
    const due = await dstrIn(2);
    const reply = [
      "오늘 점검 요약: 기한 지난 실행 1건.",
      "```json",
      JSON.stringify({ tasks: [
        { goal: "하네스 설계 엔지니어 취업", title: "도면 기호 복습", diff: "D", type: "once", due },
        { goal: "없는 목표", title: "영어 단어 30개", diff: "E", type: "daily" },
        { goal: "하네스 설계 엔지니어 취업", title: "전기기사 취득", diff: "C", type: "once" },
      ], note: "기한 지난 실행부터 처리해요." }),
      "```",
    ].join("\n");
    await setValue(".fixed.inset-0 textarea", reply);
    await clickInModalExact("답변 확인");
    await sleep(500);
    await expectText("도면 기호 복습");
    await expectText("목표 선택");
    await expectText("자격·시험 실행은");
  });

  await step("confirmed proposals become tasks; cert proposal is refused", async () => {
    const before = await readState();
    const certBefore = before.tasks.filter((q) => q.title === "전기기사 취득").length;
    await page.evaluate(() => {
      const sel = document.querySelector(".fixed.inset-0 select");
      const goal = [...sel.options].find((o) => o.text.includes("하네스"));
      const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value").set;
      setter.call(sel, goal.value);
      sel.dispatchEvent(new Event("change", { bubbles: true }));
    });
    await sleep(300);
    await page.evaluate(() => [...document.querySelectorAll('.fixed.inset-0 input[type="checkbox"]')].forEach((c) => { if (!c.disabled && !c.checked) c.click(); }));
    await sleep(200);
    await clickInModal("선택한 실행 등록");
    await sleep(800);
    const st = await readState();
    const titles = st.tasks.map((q) => q.title);
    if (!titles.includes("도면 기호 복습")) throw new Error("matched proposal not imported");
    if (!titles.includes("영어 단어 30개")) throw new Error("goal-picked proposal not imported");
    if (st.tasks.filter((q) => q.title === "전기기사 취득").length !== certBefore) throw new Error("certification proposal was imported");
    const imported = st.tasks.find((q) => q.title === "도면 기호 복습");
    if (imported.isCert || imported.isExam || imported.isStudy) throw new Error("imported task carries a milestone flag");
    if (!imported.goalId) throw new Error("imported task has no goalId");
    const today = await dstrIn(0);
    if (!(st.journal.find((e) => e.date === today)?.ai || "").includes("도면 기호 복습")) throw new Error("reply not stored on the journal entry");
  });

  await step("a reply without a JSON block is stored as text only", async () => {
    await openFrom("홈", "브리핑 열기");
    await clickInModal("AI 답변 붙여넣기"); await sleep(400);
    await setValue(".fixed.inset-0 textarea", "오늘은 기한 지난 실행부터 처리해요. 제안할 실행은 없어요.");
    await clickInModalExact("답변 확인");
    await sleep(400);
    await expectText("제안 실행 없음");
    await clickInModal("선택한 실행 등록");
    await sleep(600);
    const st = await readState();
    const today = await dstrIn(0);
    if (!(st.journal.find((e) => e.date === today)?.ai || "").includes("제안할 실행은 없어요")) throw new Error("plain reply not stored");
  });

  await step("weekly review saves and chains to the check-in", async () => {
    await openFrom("홈", "주간 리뷰");
    await typeInto("잘된 것", "운동 3회 · 영어 스터디 2회");
    await typeInto("막힌 것", "CATIA 연습 2일 누락");
    await clickInModalExact("리뷰 저장");
    await sleep(600);
    let st = await readState();
    const today = await dstrIn(0);
    if (!st.reviews?.length) throw new Error("review not saved");
    if (st.act.lastReview !== today) throw new Error("lastReview not stamped: " + st.act.lastReview);
    await clickText("주간 리뷰"); await sleep(400);
    await clickInModal("저장하고 지표 체크인");
    await sleep(600);
    await expectText("인생 지표 체크인");
    await clickInModalExact("저장");
    await sleep(600);
    st = await readState();
    if (st.act.lastCheckin !== today) throw new Error("check-in not stamped after the review chain");
  });

  await step("briefing reflects the saved review", async () => {
    await openFrom("홈", "브리핑 열기");
    await expectText("이번 주 리뷰 완료");
    await closeModal();
  });

  await step("metrics check-in stamps its date", async () => {
    await openFrom("성장", "체크인");
    await clickInModalExact("저장");
    await sleep(600);
    const st = await readState();
    const today = await dstrIn(0);
    if (st.act.lastCheckin !== today) throw new Error("lastCheckin not stamped: " + st.act.lastCheckin);
    await expectText("마지막 체크인");
  });
};
