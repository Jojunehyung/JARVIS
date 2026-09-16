// Daily assistant — due dates, the `할 일` list's time-ordered groups, the briefing and the journal. The briefing
// is opened from the `할 일` header since 2026-09-15, and the journal, the weekly review and the assistant bridge
// are reached through it. The assistant bridge and the weekly review are appended in phase C.
module.exports = async (h) => {
  const { step, clickText, clickInModal, clickInModalExact, clickTab, hasText, expectText, todoRows, typeInto, setValue, openTaskModalFor, closeModal, sleep, page, errors } = h;
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
  // Open the briefing from the `할 일` header and tap one of its lines or buttons — the only manual way into the
  // journal and the weekly review once the daily auto-open has been dismissed.
  const fromBriefing = async (label) => {
    await openFrom("할 일", "브리핑 열기");
    await clickInModal(label);
  };

  // Dates are computed in the page with the app's own local-date logic (never toISOString).
  const dstrIn = (delta) => page.evaluate((d) => {
    const t = new Date(); t.setHours(12, 0, 0, 0); t.setDate(t.getDate() + d);
    const p = (n) => String(n).padStart(2, "0");
    return `${t.getFullYear()}-${p(t.getMonth() + 1)}-${p(t.getDate())}`;
  }, delta);

  // A goal takes activity tasks only, so both dated fixtures declare their kind through the title (detectKind).
  const addDatedTask = async (title, delta) => {
    await openTaskModalFor("하네스 설계 엔지니어 취업");
    await typeInto("무엇을 하나요", title);
    await clickInModalExact("오늘 1회");
    await setValue('.fixed.inset-0 input[type="date"]', await dstrIn(delta));
    await clickInModalExact("등록");
    await sleep(600); await closeModal();
  };

  await step("once task with a due date", async () => {
    await addDatedTask("저녁 요가 30분", 3);
    await clickTab("할 일");
    await expectText("D-3");
  });

  // `기한 지남` is a group label, a counts word and a chip, so the assertion is structural: the row has to sit
  // inside the group of that name, not merely somewhere on the screen.
  await step("overdue task shows as past due", async () => {
    await addDatedTask("밀린 독서 30분", -1);
    await clickTab("할 일");
    const overdue = await todoRows("기한 지남");
    if (!overdue) throw new Error("the overdue group is missing from the list");
    if (!overdue.some((r) => r.title.includes("밀린 독서 30분"))) {
      throw new Error("the overdue task is not in the overdue group: " + overdue.map((r) => r.title).join(" | "));
    }
  });

  await step("the tasks tab keeps the D-3 item in a later group", async () => {
    await clickTab("할 일");
    const all = (await todoRows()) || [];
    const hit = all.filter((r) => r.title.includes("저녁 요가 30분"));
    if (!hit.length) throw new Error("the dated task is not listed: " + all.map((r) => `${r.group}/${r.title}`).join(" | "));
    if (hit.some((r) => r.group === "기한 지남")) throw new Error("a task due in three days is listed as overdue");
  });

  // The list leads with what is already late: the overdue group comes first and holds the overdue task. The
  // three-day item staying out of that group is asserted by the step above.
  await step("the tasks tab leads with the overdue group", async () => {
    await clickTab("할 일");
    const rows = (await todoRows()) || [];
    if (rows[0]?.group !== "기한 지남" || !rows[0].title.includes("밀린 독서 30분")) {
      throw new Error("the first row is not the overdue task in the overdue group: " + rows.map((r) => `${r.group}/${r.title}`).join(" | "));
    }
  });

  await step("the tasks tab opens the briefing and stamps it seen", async () => {
    await clickTab("할 일");
    await clickText("브리핑 열기");
    await sleep(400);
    await expectText("오늘 브리핑 —");
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
    await fromBriefing("일지 쓰기");
    await typeInto("오늘 한 일", "E2E 일지 — CATIA 1시간");
    await clickInModalExact("저장");
    await sleep(600);
    await h.reload();
    await fromBriefing("일지 쓰기");
    const val = await page.evaluate(() => document.querySelector(".fixed.inset-0 textarea")?.value || "");
    if (!val.includes("E2E 일지")) throw new Error("journal text lost: " + val);
    await closeModal();
  });

  await step("packet carries the goals, tasks and journal", async () => {
    await openFrom("할 일", "브리핑 열기");
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
        { goal: "하네스 설계 엔지니어 취업", title: "기술 서적 30분 독서", diff: "D", type: "once", due },
        { goal: "없는 목표", title: "아침 러닝 30분", diff: "E", type: "daily" },
        { goal: "하네스 설계 엔지니어 취업", title: "전기기사 취득", diff: "C", type: "once" },
        { goal: "하네스 설계 엔지니어 취업", title: "도면 기호 복습", diff: "D", type: "once" },
        // A business errand the reply labels as reading — last of the five, since IMPORT_MAX drops a sixth.
        { goal: "하네스 설계 엔지니어 취업", title: "견적서 송부", kind: "book" },
      ], note: "기한 지난 실행부터 처리해요." }),
      "```",
    ].join("\n");
    await setValue(".fixed.inset-0 textarea", reply);
    await clickInModalExact("답변 확인");
    await sleep(500);
    await expectText("기술 서적 30분 독서");
    await expectText("목표 선택");
    await expectText("자격·시험 실행은");
    await expectText("활동 유형 없는 실행은");
    // The refusal reason is already on screen for another row, so the errand is read on its own row: the kind
    // the reply declared is ignored, the row states why, and its checkbox cannot be ticked.
    const errand = await page.evaluate(() => {
      const label = [...document.querySelectorAll(".fixed.inset-0 span")].find((s) => s.textContent.trim() === "견적서 송부")?.closest("label");
      if (!label) return null;
      const box = label.querySelector('input[type="checkbox"]');
      return { text: label.innerText.replace(/\s+/g, " ").trim(), disabled: !!box?.disabled };
    });
    if (!errand) throw new Error("the proposal row for the errand titled with no activity is missing");
    if (!errand.text.includes("활동 유형 없는 실행은 일정 탭에서 관리해요")) throw new Error("a reply-declared kind overrode the title check: " + errand.text);
    if (!errand.disabled) throw new Error("the refused row can still be picked: " + errand.text);
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
    if (!titles.includes("기술 서적 30분 독서")) throw new Error("matched proposal not imported");
    if (!titles.includes("아침 러닝 30분")) throw new Error("goal-picked proposal not imported");
    if (st.tasks.filter((q) => q.title === "전기기사 취득").length !== certBefore) throw new Error("certification proposal was imported");
    if (titles.includes("도면 기호 복습")) throw new Error("kind-less proposal was imported");
    if (titles.includes("견적서 송부")) throw new Error("a proposal whose declared kind its title does not carry was imported");
    const imported = st.tasks.find((q) => q.title === "기술 서적 30분 독서");
    if (imported.isCert || imported.isExam || imported.isStudy) throw new Error("imported task carries a milestone flag");
    if (!imported.goalId) throw new Error("imported task has no goalId");
    const today = await dstrIn(0);
    if (!(st.journal.find((e) => e.date === today)?.ai || "").includes("기술 서적 30분 독서")) throw new Error("reply not stored on the journal entry");
  });

  await step("a reply without a JSON block is stored as text only", async () => {
    await openFrom("할 일", "브리핑 열기");
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

  await step("weekly review saves and stamps its date", async () => {
    await fromBriefing("이번 주 리뷰");
    await typeInto("잘된 것", "운동 3회 · 영어 스터디 2회");
    await typeInto("막힌 것", "CATIA 연습 2일 누락");
    await clickInModalExact("리뷰 저장");
    await sleep(600);
    const st = await readState();
    const today = await dstrIn(0);
    if (!st.reviews?.length) throw new Error("review not saved");
    if (st.act.lastReview !== today) throw new Error("lastReview not stamped: " + st.act.lastReview);
    await fromBriefing("이번 주 리뷰 완료"); await sleep(400);
    if (await hasText("저장하고 지표 체크인")) throw new Error("review still offers the removed check-in");
    await closeModal();
  });

  await step("briefing reflects the saved review", async () => {
    await openFrom("할 일", "브리핑 열기");
    await expectText("이번 주 리뷰 완료");
    await closeModal();
  });

  await step("the completed archive states its date and completes nothing", async () => {
    // A daily task finished on an earlier day is finished, not open. Its row leads with the completion date and its
    // sheet offers no completion control — otherwise a list titled `완료` would double as a second completion surface.
    const yesterday = await dstrIn(-1);
    const title = await page.evaluate((y) => {
      const k = "liferpg-state-v1";
      const s = JSON.parse(localStorage.getItem(k));
      const q = (s.tasks || []).find((x) => x.type === "daily");
      if (!q) return null;
      q.doneDates = [y];
      localStorage.setItem(k, JSON.stringify(s));
      return q.title;
    }, yesterday);
    if (!title) throw new Error("no daily task to archive");
    await h.reload();
    await clickTab("할 일");
    await h.clickExact("완료");
    await sleep(400);
    const before = await readState();
    // The count line states the real total: every task with a completion plus every ticked event occurrence.
    const total = (before.tasks || []).filter((q) => (q.type === "daily" ? (q.doneDates || []).length : q.status === "done")).length
      + (before.events || []).reduce((n, e) => n + (e.doneDates || []).length, 0);
    const countLine = await page.evaluate(() => [...document.querySelectorAll("main p")]
      .map((p) => (p.innerText || "").trim()).find((t) => /^완료 \d+건 · 최근 \d+건$/.test(t)) || "");
    if (countLine !== `완료 ${total}건 · 최근 ${Math.min(total, 40)}건`) throw new Error(`the archive count line is "${countLine}", expected ${total} in total`);
    const seen = await page.evaluate((t) => {
      // The archive is the one section in `main` led by the `완료 {n}건 · 최근 {n}건` count line.
      const sec = [...document.querySelectorAll("main section")].find((x) => /^완료 \d+건 · 최근 \d+건/.test((x.innerText || "").trim()));
      const node = sec && [...sec.querySelectorAll(".text-sm.font-semibold")].find((n) => (n.innerText || "").trim() === t);
      const row = node && node.closest("button");
      if (!row) return null;
      const lead = row.querySelector("span.font-mono");
      const out = { text: (row.innerText || "").replace(/\s+/g, " ").trim(), lead: lead ? lead.innerText.trim() : "", controls: row.querySelectorAll("button,input").length };
      row.scrollIntoView({ block: "center" });
      row.click();
      return out;
    }, title);
    if (!seen) throw new Error("the archive does not list the task completed yesterday: " + title);
    if (seen.lead !== yesterday.slice(5)) throw new Error(`the archive row leads with "${seen.lead}", expected ${yesterday.slice(5)}: ` + seen.text);
    if (seen.controls) throw new Error(`the archive row carries ${seen.controls} inner control(s)`);
    await sleep(500);
    const sheet = await h.overlayText();
    if (!sheet.includes("매일 · 완료 1회")) throw new Error("the archive sheet does not state the completion count: " + sheet.slice(0, 300));
    const live = await page.evaluate(() => {
      const ov = [...document.querySelectorAll(".fixed.inset-0")].pop();
      return !!ov && [...ov.querySelectorAll("button")].some((b) => (b.innerText || "").trim() === "완료하기");
    });
    if (live) throw new Error("the archive sheet offers the completion button — it can complete the task");
    await closeModal();
    await sleep(300);
    const after = await readState();
    const q = (after.tasks || []).find((x) => x.title === title);
    if ((q.doneDates || []).join() !== yesterday) throw new Error("the archive changed the completion record: " + JSON.stringify(q.doneDates));
    if (after.act.streak !== before.act.streak) throw new Error("the archive moved the streak");
  });
};
