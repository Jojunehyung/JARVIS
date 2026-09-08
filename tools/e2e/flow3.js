// Remaining paths — exam KR and score report, exercise/meeting activities, profile photo, direction advice, task and goal deletion, streak after a day gap
module.exports = async (h) => {
  const { step, shot, clickText, clickInModal, clickInModalExact, assertDone, modalError, clickTab, hasText, expectText, typeInto, typeExact, completeQuest, closeModal, sleep, page, errors, attach, openTaskModalFor, addKindTask, submitPhotoEvidence, logActivity } = h;
  // ── Profile photo upload (resizeImage path)
  await step("profile photo upload", async () => {
    await clickTab("홈");
    await attach();
    await sleep(500);
  });

  // ── Goal with an exam KR → exam milestone → score report submission
  await step("create goal with exam KR", async () => {
    await clickTab("목표");
    await clickText("새 목표"); await sleep(400);
    await typeInto("목표 —", "어학 점수 확보");
    await clickText("시험"); await sleep(200);
    try { await clickText("TOEIC"); } catch { errors.push("시험 패밀리 버튼 없음"); }
    await sleep(300);
    // pick the first band
    await page.evaluate(() => {
      const ov = document.querySelector(".fixed.inset-0");
      const btns = [...ov.querySelectorAll("button")].filter((b) => /\d{3}/.test(b.innerText));
      if (btns.length) btns[Math.min(2, btns.length - 1)].click();
    });
    await sleep(250);
    await clickText("이 핵심결과 추가"); await sleep(300);
    await clickText("목표 만들기"); await sleep(600);
  });
  await step("register exam milestone", async () => {
    await openTaskModalFor("어학 점수 확보");
    await clickInModal("등록 ›");
    await sleep(1200); await closeModal();
  });
  await step("submit score report photo (exam payout)", async () => { await submitPhotoEvidence("TOEIC"); });
  await shot("exam-done");

  // ── Exercise activity (weight and skeletal muscle → metric KR)
  await step("register exercise activity task", async () => { await addKindTask("하네스", "운동", "웨이트 40분"); });
  await step("save exercise log (weight, skeletal muscle)", async () => {
    await logActivity("웨이트 40분", async () => {
      try { await typeInto("체중", "72"); } catch {}
      try { await typeInto("골격근량", "33"); } catch {}
    });
  });

  // ── Meeting activity (action item → follow-up task)
  await step("register meeting activity task", async () => { await addKindTask("하네스", "미팅", "협력사 미팅"); });
  await step("meeting minutes + action item follow-up", async () => {
    await logActivity("협력사 미팅", async () => {
      try { await typeInto("미팅 상대", "○○상사 김과장"); } catch {}
      try { await typeInto("안건", "하네스 사양 협의"); } catch {}
      try { await typeInto("결정사항", "도면 회신 후 재검토"); } catch {}
      const ta = await page.$$("textarea");
      if (ta[0]) { await ta[0].click(); await ta[0].type("사양서 초안 작성", { delay: 4 }); }
    });
  });
  await shot("meet-done");

  // ── Promotion (evidence chip selection → actual promotion)
  await step("promotion — submit after selecting evidence chips", async () => {
    await clickTab("성장");
    try { await clickText("관문 증명하기"); } catch { errors.push("승급 버튼 없음"); }
    await sleep(500);
    await page.evaluate(() => {
      const ov = document.querySelector(".fixed.inset-0");
      if (!ov) return;
      const chip = [...ov.querySelectorAll("button")].find((b) => b.innerText.trim() && !b.innerText.includes("증거 제출"));
      if (chip) chip.click();
    });
    await sleep(200);
    try { await clickInModal("증거 제출 · 승급"); } catch { errors.push("승급 제출 실패"); }
    await sleep(1200); await closeModal();
  });

  // ── Direction advice (RoleAdviceModal) → catalogue link
  await step("open direction advice", async () => {
    await clickTab("성장");
    try { await clickText("방향 제안"); await sleep(600); } catch { errors.push("방향 제안 버튼 없음(롤모델 미설정?)"); }
    try { await clickText("도감에서 더 보기"); await sleep(600); } catch {}
    await closeModal(); await closeModal();
  });

  // ── Task deletion / goal removal
  await step("delete task", async () => {
    await clickTab("실행");
    const ok = await page.evaluate(() => {
      const nodes = [...document.querySelectorAll("div")].filter((d) => d.innerText.includes("설계 실습 1시간"));
      const inner = nodes[nodes.length - 1];
      let row = inner; for (let i = 0; i < 6 && row; i++) { if (row.querySelectorAll("button").length > 1) break; row = row.parentElement; }
      const btns = row ? [...row.querySelectorAll("button")] : [];
      if (btns.length < 2) return false;
      btns[btns.length - 1].click(); return true;
    });
    if (!ok) errors.push("task delete button not found");
    await sleep(600);
  });
  // ── One day later (streak, shields) — set lastActive to the past to exercise applyDailyTick
  await step("re-entry after a one-day gap (streak, shields)", async () => {
    await page.evaluate(() => {
      const k = "liferpg-state-v1";
      const raw = localStorage.getItem(k); if (!raw) return;
      const s = JSON.parse(raw);
      const d = new Date(); d.setDate(d.getDate() - 2);
      const iso = d.toISOString().slice(0, 10);
      s.act = { ...(s.act || {}), lastActive: iso, streak: 5, shieldsLeft: 2, shieldMonth: iso.slice(0, 7) };
      s.lastTick = iso;
      localStorage.setItem(k, JSON.stringify(s));
    });
    await h.reload();
    await sleep(700);
    if (await hasText("시작하기")) throw new Error("상태 유실");
  });
  await shot("daily-tick");
};
