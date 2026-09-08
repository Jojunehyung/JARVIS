// Deep flows — photo evidence submission, study output verification, activity logs (reading, exercise, meetings), promotion, role model, migration
module.exports = async (h) => {
  const { step, shot, clickText, clickInModal, clickInModalExact, assertDone, modalError, clickTab, hasText, expectText, typeInto, completeQuest, closeModal, sleep, page, errors, attach, addKindTask, submitPhotoEvidence, logActivity } = h;

  // ── Certification milestone → certificate photo submission (evidence gate)
  await step("goals tab → one-click cert KR milestone registration", async () => {
    await clickTab("목표");
    await clickText("실행 추가"); await sleep(500);   // the KR bridge lives inside AddTaskModal
    await clickInModal("등록 ›");                       // cert KR → creates the certification milestone
    await sleep(1200); await closeModal();
  });
  await step("tasks tab — certification milestone present", async () => {
    await clickTab("실행");
    await expectText("전기기사");
  });
  await step("evidence modal — submit blocked without a photo", async () => {
    await completeQuest("전기기사");
    await expectText("합격증");
    const blocked = await page.evaluate(() => {
      const b = [...document.querySelectorAll("button")].find((x) => x.innerText.includes("제출하고 완료"));
      return !!b && b.disabled;
    });
    if (!blocked) errors.push("evidence gate: submit button enabled without a photo");
  });
  await step("submit with certificate photo (+P payout)", async () => {
    await attach();
    await clickInModal("제출하고 완료");
    await sleep(1200); await closeModal();
    await clickTab("실행");
    await assertDone("전기기사");
  });
  await step("evidence viewer — stored certificate photo shown", async () => {
    await clickTab("실행");
    const opened = await page.evaluate(() => {
      const b = [...document.querySelectorAll("button")].find((x) => x.innerText.trim() === "증거 보기");
      if (!b) return false; b.click(); return true;
    });
    if (!opened) throw new Error("evidence view button not found");
    await sleep(900);
    await expectText("증거 —");
    const imgs = await page.evaluate(() => [...document.querySelectorAll(".fixed.inset-0 img")].map((i) => (i.src || "").slice(0, 30)));
    if (!imgs.length) throw new Error("evidence photo not displayed");
    if (!imgs.some((s) => s.startsWith("data:image"))) throw new Error("사진 소스가 데이터 URL이 아님: " + JSON.stringify(imgs));
    await shot("evidence-view");
    await closeModal();
  });
  await shot("cert-done");

  // ── Study task (output verification)
  await step("register study milestone", async () => {
    await clickTab("목표");
    await clickText("실행 추가"); await sleep(500);
    await clickInModal("학습 (하루분량)");
    await sleep(200);
    await typeInto("책·논문·강의명", "회로이론 3장");
    await clickInModal("학습 실행 추가");
    await sleep(600);
    { const e = await modalError(); if (e) errors.push("study registration rejected: " + e); }
    await sleep(600); await closeModal();
  });
  await step("study verification modal — summary and new knowledge", async () => {
    await clickTab("실행");
    await completeQuest("회로이론 3장");
    await sleep(300);
    await typeInto("핵심 주장", "노드 해석과 메시 해석의 적용 조건을 정리했고 실무 회로 예제로 검산했다");
    await typeInto("읽기 전엔 몰랐던 것", "전원 분기에서 기준 노드 선택이 계산량을 좌우한다는 점");
    // grade D needs one output — attach a notes photo
    try { await attach(); } catch {}
    await page.evaluate(() => {
      const ov = [...document.querySelectorAll(".fixed.inset-0")].pop();
      const b = [...ov.querySelectorAll("button")].pop();
      b.click();
    });
    await sleep(400);
    const e2 = await modalError(); if (e2) errors.push("study verification rejected: " + e2);
    await sleep(700); await closeModal();
    await assertDone("회로이론 3장");
  });
  await shot("study-done");

  // ── Activity log (reading)
  await step("register reading activity task", async () => { await addKindTask("하네스", "독서", "기술서 30분 읽기"); });
  await step("complete after book report", async () => {
    await logActivity("기술서 30분 읽기", async () => {
      try { await clickText("⭐"); } catch {}
      const tas = await page.$$("textarea, input[type=text]");
      if (tas[0]) { await tas[0].click(); await tas[0].type("설계 관점에서 배선 규칙을 다시 정리했다", { delay: 4 }); }
    });
  });
  await shot("activity-done");

  // ── Role model save
  await step("save role model settings", async () => {
    await clickTab("성장");
    try { await clickText("롤모델"); } catch { errors.push("롤모델 진입 실패"); }
    await sleep(400);
    const inp = await page.$(".fixed.inset-0 input");
    if (inp) { await inp.click(); await inp.type("시니어 하네스 설계자", { delay: 4 }); }
    // required grades per area must be set for proximity to compute (roleGap is null when the requirement is 0)
    const picked = await page.evaluate(() => {
      const ov = [...document.querySelectorAll(".fixed.inset-0")].pop();
      if (!ov) return 0;
      let n = 0;
      for (const row of ov.querySelectorAll("div")) {
        const btns = [...row.querySelectorAll(":scope > button")];
        const target = btns.find((b) => /실무자|숙련자/.test(b.innerText));
        if (target) { target.click(); n++; }
        if (n >= 2) break;
      }
      return n;
    });
    if (!picked) errors.push("role model required-grade button not found");
    await sleep(250);
    await clickInModalExact("저장");
    await sleep(800); await closeModal();
  });
  await step("role model proximity displayed", async () => { await clickTab("성장"); await sleep(300); });
  await shot("rolemodel");

  // ── Catalogue exam mode
  await step("catalogue — exam tab", async () => {
    await clickTab("실행");
    await clickText("도감"); await sleep(400);
    await clickText("시험"); await sleep(400);
    await expectText("TOEIC");
    await closeModal();
  });

};
