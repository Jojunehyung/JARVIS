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
    await h.openSettings();
    try { await clickInModal("롤모델"); } catch { errors.push("롤모델 진입 실패"); }
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
  await step("role-model proximity sits under the CV and matches roleGap", async () => {
    await clickTab("홈");
    await sleep(300);
    // The proximity line is the last block on home, and its number must be the one `roleGap` computes from the save.
    const res = await page.evaluate(() => {
      const line = document.querySelector("main")?.lastElementChild;
      const s = JSON.parse(localStorage.getItem("liferpg-state-v1"));
      const sq = (s.areas || [])
        .filter((p) => (s.role?.targets?.[p.id] || 0) > 0)
        .map((p) => Math.pow(Math.min(1, p.grade / s.role.targets[p.id]), 2));
      return {
        tag: line?.tagName || "",
        text: (line?.innerText || "").replace(/\s+/g, " ").trim(),
        match: sq.length ? Math.round((sq.reduce((a, b) => a + b, 0) / sq.length) * 100) : null,
      };
    });
    if (!res.text.includes("근접도")) throw new Error("the line under the CV does not state proximity: " + res.text);
    if (!res.text.includes("시니어 하네스 설계자")) throw new Error("the proximity line does not name the role model: " + res.text);
    if (res.tag !== "BUTTON") throw new Error(`the proximity line is a ${res.tag || "missing element"}, so it cannot open direction advice`);
    if (res.match === null) throw new Error("the save carries no role-model requirement — proximity cannot be checked");
    const shown = res.text.match(/(\d+)%/);
    if (!shown) throw new Error("the proximity line states no percentage: " + res.text);
    if (Number(shown[1]) !== res.match) throw new Error(`the proximity line states ${shown[1]}%, roleGap computes ${res.match}% — ${res.text}`);
  });
  await shot("rolemodel");

  await step("CV grade rows are one line each and open the promotion gate", async () => {
    await clickTab("홈");
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
  await step("the CV states held credentials and record counts, and the wall lists every area", async () => {
    await clickTab("홈");
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
    await clickTab("실행");
    await clickText("도감"); await sleep(400);
    await clickText("시험"); await sleep(400);
    await expectText("TOEIC");
    await closeModal();
  });

};
