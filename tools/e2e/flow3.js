// 잔여 경로 — 시험 KR·성적표, 운동/미팅 활동, 프로필 사진, 방향 제안, 퀘스트·목표 삭제, 스트릭 경과
module.exports = async (h) => {
  const { step, shot, clickText, clickInModal, clickInModalExact, assertDone, modalError, clickTab, hasText, expectText, typeInto, typeExact, completeQuest, closeModal, sleep, page, errors, attach, openTaskModalFor, addKindTask, submitPhotoEvidence, logActivity } = h;
  // ── 프로필 사진 업로드(resizeImage 경로)
  await step("프로필 사진 업로드", async () => {
    await clickTab("홈");
    await attach();
    await sleep(500);
  });

  // ── 시험 KR이 있는 목표 → 시험 마일스톤 → 성적표 제출
  await step("시험 KR 목표 생성", async () => {
    await clickTab("목표");
    await clickText("새 목표"); await sleep(400);
    await typeInto("목표 —", "어학 점수 확보");
    await clickText("시험"); await sleep(200);
    try { await clickText("TOEIC"); } catch { errors.push("시험 패밀리 버튼 없음"); }
    await sleep(300);
    // 밴드 선택(첫 번째)
    await page.evaluate(() => {
      const ov = document.querySelector(".fixed.inset-0");
      const btns = [...ov.querySelectorAll("button")].filter((b) => /\d{3}/.test(b.innerText));
      if (btns.length) btns[Math.min(2, btns.length - 1)].click();
    });
    await sleep(250);
    await clickText("이 핵심결과 추가"); await sleep(300);
    await clickText("목표 만들기"); await sleep(600);
  });
  await step("시험 마일스톤 등록", async () => {
    await openTaskModalFor("어학 점수 확보");
    await clickInModal("등록 ›");
    await sleep(1200); await closeModal();
  });
  await step("성적표 사진 제출(시험 지급)", async () => { await submitPhotoEvidence("TOEIC"); });
  await shot("exam-done");

  // ── 운동 활동(체중·골격근량 → metric KR 반영)
  await step("운동 활동 실행 등록", async () => { await addKindTask("하네스", "운동", "웨이트 40분"); });
  await step("운동 기록(체중·골격근량) 저장", async () => {
    await logActivity("웨이트 40분", async () => {
      try { await typeInto("체중", "72"); } catch {}
      try { await typeInto("골격근량", "33"); } catch {}
    });
  });

  // ── 미팅 활동(액션 아이템 → 팔로업 퀘스트 생성)
  await step("미팅 활동 실행 등록", async () => { await addKindTask("하네스", "미팅", "협력사 미팅"); });
  await step("회의록 기록 + 액션 아이템 팔로업", async () => {
    await logActivity("협력사 미팅", async () => {
      try { await typeInto("미팅 상대", "○○상사 김과장"); } catch {}
      try { await typeInto("안건", "하네스 사양 협의"); } catch {}
      try { await typeInto("결정사항", "도면 회신 후 재검토"); } catch {}
      const ta = await page.$$("textarea");
      if (ta[0]) { await ta[0].click(); await ta[0].type("사양서 초안 작성", { delay: 4 }); }
    });
  });
  await shot("meet-done");

  // ── 승급(증거 칩 선택 → 실제 승급 처리)
  await step("승급 — 증거 칩 선택 후 제출", async () => {
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

  // ── 방향 제안(RoleAdviceModal) → 도감 연결
  await step("방향 제안 열기", async () => {
    await clickTab("성장");
    try { await clickText("방향 제안"); await sleep(600); } catch { errors.push("방향 제안 버튼 없음(롤모델 미설정?)"); }
    try { await clickText("도감에서 더 보기"); await sleep(600); } catch {}
    await closeModal(); await closeModal();
  });

  // ── 실행 삭제 / 목표 제거
  await step("실행 삭제", async () => {
    await clickTab("실행");
    const ok = await page.evaluate(() => {
      const nodes = [...document.querySelectorAll("div")].filter((d) => d.innerText.includes("설계 실습 1시간"));
      const inner = nodes[nodes.length - 1];
      let row = inner; for (let i = 0; i < 6 && row; i++) { if (row.querySelectorAll("button").length > 1) break; row = row.parentElement; }
      const btns = row ? [...row.querySelectorAll("button")] : [];
      if (btns.length < 2) return false;
      btns[btns.length - 1].click(); return true;
    });
    if (!ok) errors.push("실행 삭제 버튼 없음");
    await sleep(600);
  });
  // ── 하루 경과(스트릭·실드) — lastActive를 과거로 바꿔 applyDailyTick 경로 실행
  await step("하루 공백 후 재진입(스트릭·실드)", async () => {
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
