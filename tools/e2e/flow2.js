// 심화 플로우 — 증거 제출(사진), 학습 산출물 검증, 활동 기록(독서·운동·미팅), 승급, 롤모델, 마이그레이션
module.exports = async (h) => {
  const { step, shot, clickText, clickInModal, clickInModalExact, assertDone, modalError, clickTab, hasText, expectText, typeInto, completeQuest, closeModal, sleep, page, errors, attach, addKindTask, submitPhotoEvidence, logActivity } = h;

  // ── 자격 마일스톤 → 합격증 사진 제출(증거 게이트)
  await step("목표 탭 → 자격 KR 마일스톤 원클릭 등록", async () => {
    await clickTab("목표");
    await clickText("실행 추가"); await sleep(500);   // AddQuestModal 안에 KR 브리지가 있다
    await clickInModal("등록 ›");                       // cert KR → 자격 마일스톤 생성
    await sleep(1200); await closeModal();
  });
  await step("실행 탭 — 자격 마일스톤 확인", async () => {
    await clickTab("실행");
    await expectText("전기기사");
  });
  await step("증거 모달 — 사진 없이 제출 차단 확인", async () => {
    await completeQuest("전기기사");
    await expectText("합격증");
    const blocked = await page.evaluate(() => {
      const b = [...document.querySelectorAll("button")].find((x) => x.innerText.includes("제출하고 완료"));
      return !!b && b.disabled;
    });
    if (!blocked) errors.push("증거 게이트: 사진 없이도 제출 버튼이 활성화됨");
  });
  await step("합격증 사진 첨부 후 제출(+P 지급)", async () => {
    await attach();
    await clickInModal("제출하고 완료");
    await sleep(1200); await closeModal();
    await clickTab("실행");
    await assertDone("전기기사");
  });
  await step("증거 열람 — 저장된 합격증 사진 확인", async () => {
    await clickTab("실행");
    const opened = await page.evaluate(() => {
      const b = [...document.querySelectorAll("button")].find((x) => x.innerText.trim() === "증거 보기");
      if (!b) return false; b.click(); return true;
    });
    if (!opened) throw new Error("증거 보기 버튼 없음");
    await sleep(900);
    await expectText("증거 —");
    const imgs = await page.evaluate(() => [...document.querySelectorAll(".fixed.inset-0 img")].map((i) => (i.src || "").slice(0, 30)));
    if (!imgs.length) throw new Error("증거 사진이 표시되지 않음");
    if (!imgs.some((s) => s.startsWith("data:image"))) throw new Error("사진 소스가 데이터 URL이 아님: " + JSON.stringify(imgs));
    await shot("evidence-view");
    await closeModal();
  });
  await shot("cert-done");

  // ── 학습 퀘스트(산출물 검증)
  await step("학습 마일스톤 등록", async () => {
    await clickTab("목표");
    await clickText("실행 추가"); await sleep(500);
    await clickInModal("학습 (하루분량)");
    await sleep(200);
    await typeInto("책·논문·강의명", "회로이론 3장");
    await clickInModal("학습 실행 추가");
    await sleep(600);
    { const e = await modalError(); if (e) errors.push("학습 등록 거부: " + e); }
    await sleep(600); await closeModal();
  });
  await step("학습 검증 모달 — 요약·새 지식 기재", async () => {
    await clickTab("실행");
    await completeQuest("회로이론 3장");
    await sleep(300);
    await typeInto("핵심 주장", "노드 해석과 메시 해석의 적용 조건을 정리했고 실무 회로 예제로 검산했다");
    await typeInto("읽기 전엔 몰랐던 것", "전원 분기에서 기준 노드 선택이 계산량을 좌우한다는 점");
    // D급이면 산출물 1건 필요 — 정리 사진 첨부
    try { await attach(); } catch {}
    await page.evaluate(() => {
      const ov = [...document.querySelectorAll(".fixed.inset-0")].pop();
      const b = [...ov.querySelectorAll("button")].pop();
      b.click();
    });
    await sleep(400);
    const e2 = await modalError(); if (e2) errors.push("학습 검증 거부: " + e2);
    await sleep(700); await closeModal();
    await assertDone("회로이론 3장");
  });
  await shot("study-done");

  // ── 활동 기록(독서)
  await step("독서 활동 실행 등록", async () => { await addKindTask("하네스", "독서", "기술서 30분 읽기"); });
  await step("독후감 기록 후 완료", async () => {
    await logActivity("기술서 30분 읽기", async () => {
      try { await clickText("⭐"); } catch {}
      const tas = await page.$$("textarea, input[type=text]");
      if (tas[0]) { await tas[0].click(); await tas[0].type("설계 관점에서 배선 규칙을 다시 정리했다", { delay: 4 }); }
    });
  });
  await shot("activity-done");

  // ── 롤모델 저장
  await step("롤모델 설정 저장", async () => {
    await clickTab("성장");
    try { await clickText("롤모델"); } catch { errors.push("롤모델 진입 실패"); }
    await sleep(400);
    const inp = await page.$(".fixed.inset-0 input");
    if (inp) { await inp.click(); await inp.type("시니어 하네스 설계자", { delay: 4 }); }
    // 파트별 요구 등급을 지정해야 근접도가 계산된다(요구 0이면 roleGap이 null)
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
    if (!picked) errors.push("롤모델 요구 등급 버튼 없음");
    await sleep(250);
    await clickInModalExact("저장");
    await sleep(800); await closeModal();
  });
  await step("롤모델 근접도 표시 확인", async () => { await clickTab("성장"); await sleep(300); });
  await shot("rolemodel");

  // ── 도감 시험 모드
  await step("도감 — 시험 탭", async () => {
    await clickTab("실행");
    await clickText("도감"); await sleep(400);
    await clickText("시험"); await sleep(400);
    await expectText("TOEIC");
    await closeModal();
  });

};
