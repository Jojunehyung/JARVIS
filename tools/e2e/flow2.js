// Deep flows — photo evidence submission, study output verification, activity logs (reading, exercise, meetings), promotion, role model, migration
module.exports = async (h) => {
  const { step, shot, clickText, clickInModal, clickInModalExact, assertDone, modalError, clickTab, hasText, expectText, typeInto, completeQuest, closeModal, sleep, page, errors, attach, addKindTask, submitPhotoEvidence, logActivity, openTodo, todoRows, overlayText } = h;

  // ── Certification milestone → certificate photo submission (evidence gate)
  await step("goals tab → one-click cert KR milestone registration", async () => {
    await clickTab("목표");
    await clickText("실행 추가"); await sleep(500);   // the KR bridge lives inside AddTaskModal
    await clickInModal("등록 ›");                       // cert KR → creates the certification milestone
    await sleep(1200); await closeModal();
  });
  await step("tasks tab — certification milestone present", async () => {
    await clickTab("할 일");
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
    await clickTab("할 일");
    await assertDone("전기기사");
  });
  await step("evidence viewer — stored certificate photo shown", async () => {
    await clickTab("할 일");
    await openTodo("전기기사 취득");
    const sheet = await overlayText();
    for (const t of ["합격증 사진 필수", "증거 기록"]) {
      if (!sheet.includes(t)) throw new Error(`the certificate task sheet does not state "${t}": ` + sheet.slice(0, 300));
    }
    await clickInModalExact("증거 보기");
    await sleep(900);
    await expectText("증거 —");
    const imgs = await page.evaluate(() => [...document.querySelectorAll(".fixed.inset-0 img")].map((i) => (i.src || "").slice(0, 30)));
    if (!imgs.length) throw new Error("evidence photo not displayed");
    if (!imgs.some((s) => s.startsWith("data:image"))) throw new Error("사진 소스가 데이터 URL이 아님: " + JSON.stringify(imgs));
    await shot("evidence-view");
    await closeModal();
  });
  await shot("cert-done");

  // A to-do row is one button: a lead chip, the title and at most one marker. Everything else lives in the sheet.
  await step("to-do rows show a lead chip, the title and at most one marker", async () => {
    await clickTab("할 일");
    const all = (await todoRows()) || [];
    if (!all.length) throw new Error("the to-do list has no rows to check");
    const st = await page.evaluate(() => JSON.parse(localStorage.getItem("liferpg-state-v1")));
    const liveGoals = new Set((st.goals || []).map((g) => g.id));
    const goalTitles = new Set((st.tasks || []).filter((q) => q.goalId && liveGoals.has(q.goalId)).map((q) => q.title));
    const recordTitles = new Set([...(st.events || []).map((e) => e.title), ...(st.deals || []).map((d) => `${d.client} ${d.title}`)]);
    for (const r of all) {
      if (r.controls !== 0) throw new Error(`the row "${r.title}" carries ${r.controls} inner control(s)`);
      for (const t of ["🎯", "직무 적합", "증거 필요", "산출물검증", "증거 보기"]) {
        if (r.text.includes(t)) throw new Error(`the row "${r.title}" still prints "${t}": ` + r.text);
      }
      if (goalTitles.has(r.title) && r.text.includes("목표 기여 없음")) throw new Error("a row that serves a goal says it serves none: " + r.text);
      if (recordTitles.has(r.title) && !r.text.includes("목표 기여 없음")) throw new Error("an event or business row hides that it serves no goal: " + r.text);
    }
  });

  /* The sheet holds what the row leaves out. `설계 실습 1시간` was completed today in flow.js, so its sheet is closed:
     it states the facts and offers `삭제` but no completion control. */
  await step("the task sheet states goal, area, type, difficulty and evidence", async () => {
    await clickTab("할 일");
    const goal = await page.evaluate(() => {
      const s = JSON.parse(localStorage.getItem("liferpg-state-v1"));
      const q = (s.tasks || []).find((x) => x.title === "설계 실습 1시간");
      return q ? ((s.goals || []).find((g) => g.id === q.goalId)?.title || null) : null;
    });
    if (!goal) throw new Error("the daily task or its goal is not stored");
    await openTodo("설계 실습 1시간");
    const sheet = await overlayText();
    for (const t of ["상태", "기한", "목표", "영역", "유형", "난이도", "증거", "삭제", goal, "매일 · 완료 1회 · 오늘 완료"]) {
      if (!sheet.includes(t)) throw new Error(`the task sheet does not state "${t}": ` + sheet.slice(0, 300));
    }
    const hasComplete = await page.evaluate(() => {
      const ov = [...document.querySelectorAll(".fixed.inset-0")].pop();
      return !!ov && [...ov.querySelectorAll("button")].some((b) => (b.innerText || "").trim() === "완료하기");
    });
    if (hasComplete) throw new Error("the sheet of a task done today still offers the completion button");
    await closeModal();
  });

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
    await clickTab("할 일");
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
    await h.openSettings();
    try { await clickInModal("롤모델"); } catch { errors.push("롤모델 진입 실패"); }
    await sleep(400);
    // 2026-09-18: the name and the requirement grades live on the `roleEdit` sub-screen behind `세부 수정 ›`
    try { await clickInModalExact("세부 수정 ›"); } catch { errors.push("role edit sub-screen not reached"); }
    await sleep(400);
    const inp = await page.$(".fixed.inset-0 input");
    if (inp) { await inp.click(); await inp.type("시니어 하네스 설계자", { delay: 4 }); }
    // required grades per area are set here; the role line under the CV states the stage facts, never a percentage
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
    // The save returns to the role screen, which `closeModal` closes after the sub-screen
    await sleep(800); await closeModal();
  });
  await step("the role line under the CV states no stages and no percentage for a role model without stages", async () => {
    await clickTab("프로필");
    await sleep(300);
    // The role line is the last block on home: a role model without stages names itself and states `단계 없음`, and
    // nothing on home states a percentage (rule 14 amendment, 2026-09-18).
    const res = await page.evaluate(() => {
      const line = document.querySelector("main")?.lastElementChild;
      return {
        tag: line?.tagName || "",
        text: (line?.innerText || "").replace(/\s+/g, " ").trim(),
        main: (document.querySelector("main")?.innerText || ""),
      };
    });
    if (!res.text.includes("시니어 하네스 설계자")) throw new Error("the role line does not name the role model: " + res.text);
    if (!res.text.endsWith(" · 단계 없음 — AI 판정에서 받거나 세부 수정에서 적어요 ›")) throw new Error("the role line without stages reads: " + res.text);
    if (res.tag !== "BUTTON") throw new Error(`the role line is a ${res.tag || "missing element"}, so it cannot open the role screen`);
    if (/\d+%/.test(res.main)) throw new Error("home states a percentage: " + res.main.slice(0, 300));
    // A role model saved without stages has no stage line (v28): the stage count renders only beside stored stages.
    const stageLine = await page.evaluate(() => [...document.querySelectorAll("main button")].some((b) => /^단계\s*\d+\/\d+/.test((b.innerText || "").trim())));
    if (stageLine) throw new Error("a stage line renders for a role model without stages");
  });
  await shot("rolemodel");

  await step("CV grade rows are one line each and open the promotion gate", async () => {
    await clickTab("프로필");
    await sleep(300);
    const before = await page.evaluate(() => {
      const s = JSON.parse(localStorage.getItem("liferpg-state-v1"));
      return {
        body: document.body.innerText,
        rows: [...document.querySelectorAll("main button")].filter((b) => /\d\/9/.test(b.innerText || "")).map((b) => (b.innerText || "").replace(/\s+/g, " ").trim()),
        // TD-37: the main save's area list is read, never assumed
        promotable: (s.areas || []).filter((a) => a.grade < 9).map((a) => a.name),
      };
    });
    if (before.body.includes("관문 증명하기")) throw new Error("home carries a promote button of its own");
    if (before.body.includes("필요 증거:")) throw new Error("home spells out the required evidence");
    if (!before.promotable.length) throw new Error("the save has no area below grade 9, so no gate can be opened");
    if (before.rows.length !== before.promotable.length) throw new Error(`${before.rows.length} grade row button(s) for ${before.promotable.length} area(s) below grade 9: ` + before.rows.join(" | "));
    if (!before.rows.every((r) => r.includes("다음 관문"))) throw new Error("a grade row does not name its next gate: " + before.rows.join(" | "));
    if (!(await h.openAreaGate(before.promotable[0]))) throw new Error("the grade row did not open the promotion gate");
    await expectText("승급 심사");
    await expectText("필요 증거:"); // the line the row dropped is stated by the modal instead
    await closeModal();
  });

  // The CV counts what the save holds — declared and earned certifications together — and the wall sheet it opens
  // holds every item those counts stand for.
  await step("the CV states held credentials without difficulty figures, and the wall lists every area", async () => {
    await clickTab("프로필");
    await sleep(300);
    const res = await page.evaluate(() => {
      const s = JSON.parse(localStorage.getItem("liferpg-state-v1"));
      const earned = (s.tasks || []).filter((q) => q.isCert && q.status === "done").map((q) => q.title.replace(/ 취득$/, ""));
      return {
        held: [...new Set([...(s.profile?.certs || []), ...earned])],
        cv: (document.querySelector("main")?.firstElementChild?.innerText || "").replace(/\s+/g, " ").trim(),
        exams: Object.keys(s.exams?.best || {}).length,
        trophies: (s.room?.trophies || []).length,
        achievements: (s.areas || []).reduce((n, a) => n + (a.achievements || []).length, 0),
        areas: (s.areas || []).map((a) => a.name),
      };
    });
    if (res.held.length < 2) throw new Error("fewer than two certifications are held, so the declared-plus-earned union is not exercised: " + JSON.stringify(res.held));
    const want = [`자격 ${res.held.length}건`, ...res.held, `시험 ${res.exams}건`, `트로피 ${res.trophies}개 · 검증된 성취 ${res.achievements}건`];
    for (const t of want) if (!res.cv.includes(t)) throw new Error(`the CV does not state "${t}": ` + res.cv);
    if (/D\d{1,3}/.test(res.cv)) throw new Error("the CV still prints a difficulty figure: " + res.cv);
    const cvLines = (res.cv.match(/검증된 성취/g) || []).length;
    if (cvLines !== 1) throw new Error(`the CV states the verified-achievement count ${cvLines} times, expected once`);
    await clickText("검증된 성취");
    const wall = await h.overlayText();
    if (!wall.includes("성취의 벽")) throw new Error("the achievement row did not open the wall sheet: " + wall.slice(0, 200));
    if (!/트로피 \d+개 · 시험 \d+개 · 검증된 성취 \d+건/.test(wall)) throw new Error("the wall sheet does not state its three counts: " + wall.slice(0, 200));
    const wallLines = (wall.match(/검증된 성취/g) || []).length;
    if (wallLines !== res.areas.length + 1) throw new Error(`${wallLines} verified-achievement lines on the wall, expected ${res.areas.length + 1}`);
    for (const n of res.areas) if (!wall.includes(n)) throw new Error("the wall sheet omits an area: " + n);
    await closeModal();
  });

  // ── Catalogue exam mode
  await step("catalogue — exam tab", async () => {
    await clickTab("할 일");
    await clickText("도감"); await sleep(400);
    await clickText("시험"); await sleep(400);
    await expectText("TOEIC");
    await closeModal();
  });

};
