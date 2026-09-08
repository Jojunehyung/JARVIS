// Full real-usage flow — required and run by run.js (helpers are injected as arguments)
module.exports = async (h) => {
  const { step, shot, clickText, clickTab, hasText, expectText, typeInto, typeExact, completeQuest, closeModal, sleep, page, errors } = h;

  // ── Onboarding, 6 steps
  await step("onboarding start", async () => { await clickText("시작하기"); await expectText("1 / 6"); });
  await step("step 1 — basic info", async () => {
    await typeInto("닉네임", "E2E테스터");
    for (const t of ["20대 후반", "남성", "취업 준비", "학사 졸", "공학"]) { try { await clickText(t); } catch { errors.push(`선택 실패: ${t}`); } }
    await clickText("다음"); await expectText("2 / 6");
  });
  await step("step 2 — appearance", async () => { await clickText("무작위"); await clickText("다음"); await expectText("3 / 6"); });
  await step("step 3 — areas and knowledge directions", async () => {
    for (const t of ["기본지식", "커리어"]) { try { await clickText(t); } catch {} }
    for (const d of ["IT·개발", "데이터·AI"]) { try { await clickText(d); } catch {} }
    await clickText("다음"); await expectText("4 / 6");
  });
  await step("step 4 — certification search (1,011 rows)", async () => {
    await typeInto("자격증 검색", "정보처리기사");
    await sleep(250);
    await expectText("정보처리기사");
    await clickText("정보처리기사");
    await clickText("다음"); await expectText("5 / 6");
  });
  await step("step 5 — experience and outputs", async () => {
    for (const t of ["경험 없음", "개인 프로젝트 있음"]) { try { await clickText(t); } catch { errors.push(`선택 실패: ${t}`); } }
    await clickText("다음"); await expectText("6 / 6");
  });
  await step("step 6 — computed result → start", async () => { await clickText("이 설정으로 시작"); await sleep(600); await expectText("오늘"); });
  await shot("home");
  await step("fresh state schema version", async () => {
    const v = await page.evaluate(() => { try { return JSON.parse(localStorage.getItem("liferpg-state-v1"))?.v; } catch { return null; } });
    if (v !== 14) throw new Error("fresh save schema v" + v + " (expected 14)");
  });

  // ── Goal (OKR) creation — metric, count and cert KRs
  await step("goals tab → new goal modal", async () => {
    await clickTab("목표");
    await clickText("새 목표"); await sleep(350);
    await expectText("새 목표");
  });
  await step("goal title and note input", async () => {
    await typeInto("목표 —", "하네스 설계 엔지니어 취업");
    await typeInto("메모", "E2E 검증용 목표");
  });
  await step("KR 1 — add count KR", async () => {
    await clickText("횟수");
    await typeInto("행동 —", "설계 실습");
    await typeInto("횟수", "10");
    await clickText("이 핵심결과 추가"); await sleep(200);
  });
  await step("KR 2 — add cert KR (1,011-row search)", async () => {
    await clickText("자격");
    await typeInto("자격증 검색 —", "전기기사");
    await sleep(300);
    await clickText("전기기사"); await sleep(150);
    await clickText("이 핵심결과 추가"); await sleep(200);
  });
  await step("KR 3 — add metric KR", async () => {
    await clickText("수치");
    await typeInto("지표명", "설계 산출물 수");
    await typeExact("시작", "0"); await typeExact("목표", "5"); await typeExact("단위", "건");
    await clickText("이 핵심결과 추가"); await sleep(200);
  });
  await step("create goal", async () => { await clickText("목표 만들기"); await sleep(500); await expectText("하네스 설계 엔지니어 취업"); });
  await shot("goal-created");

  // ── Register a task through the KR bridge
  await step("KR bridge — open task modal", async () => {
    await clickText("실행 연결"); await sleep(400);
  });
  await step("register daily task", async () => {
    try { await clickText("일일 실행"); } catch {}
    await sleep(200);
    await typeInto("무엇을 하나요", "설계 실습 1시간");
    for (const t of ["등록", "추가", "만들기"]) { try { await clickText(t); break; } catch {} }
    await sleep(1600); // until the toast disappears
    await closeModal();
  });
  await shot("quest-added");

  // ── Tasks tab — completion and catalogue
  await step("go to tasks tab", async () => { await clickTab("실행"); await expectText("실행"); });
  await step("complete daily task (goal progress delta)", async () => {
    const before = await page.evaluate(() => document.body.innerText);
    await completeQuest("설계 실습 1시간");
    const after = await page.evaluate(() => document.body.innerText);
    if (before === after) errors.push("no visible change after completing the task (check)");
  });
  await step("open achievement catalogue (1,011 rows)", async () => { await clickText("도감"); await sleep(400); await expectText("성취 도감"); });
  await step("catalogue category switch — education/welfare/counselling", async () => {
    try { await clickText("교육·복지·상담"); } catch { errors.push("신설 카테고리 버튼 없음"); }
    await sleep(300);
  });
  await step("catalogue search response", async () => {
    const t0 = Date.now();
    await typeInto("자격증 검색", "간호");
    await sleep(350);
    h.metrics.catalogSearchMs = Date.now() - t0;
    await expectText("간호");
  });
  await shot("catalog");
  await step("close catalogue", async () => { await page.keyboard.press("Escape"); await sleep(200); await h.closeModal(); });

  // ── Growth tab — metrics check-in, promotion gate, role model
  await step("go to growth tab", async () => { await clickTab("성장"); await expectText("인생 지표"); });
  await step("save metrics check-in", async () => {
    await clickText("체크인"); await sleep(300);
    await clickText("저장"); await sleep(400);
  });
  await step("open promotion gate modal", async () => {
    try { await clickText("관문 증명하기"); } catch { errors.push("승급 버튼 없음"); }
    await sleep(400); await h.closeModal();
  });
  await step("open role model modal", async () => {
    try { await clickText("롤모델"); } catch { errors.push("롤모델 버튼 없음"); }
    await sleep(350);
    try { await clickText("✕"); } catch {}
  });
  await shot("growth");

  // ── Tab sweep + persistence
  for (const tab of ["홈", "실행", "목표", "성장"]) {
    await step(`switch tab: ${tab}`, async () => { await clickTab(tab); });
  }
  await step("state persists after reload", async () => {
    const before = await page.evaluate(() => localStorage.length);
    await h.reload();
    await sleep(600);
    const after = await page.evaluate(() => localStorage.length);
    if (!before || after !== before) throw new Error(`localStorage key ${before} → ${after}`);
    if (await hasText("시작하기")) throw new Error("온보딩으로 되돌아감(상태 유실)");
    await expectText("하네스 설계 엔지니어 취업");
  });
  await shot("after-reload");

  // ── Deep flows (evidence, study, activities, promotion, role model, migration)
  await require("./flow2.js")(h);

  await require("./flow3.js")(h);
  await require("./flow4.js")(h);

  // ── Demo data path (separate session)
  await step("enter demo data", async () => {
    await page.evaluate(() => localStorage.clear());
    await h.reload();
    await sleep(500);
    await clickText("데모 데이터로 둘러보기");
    await sleep(700);
    await expectText("오늘");
  });
  await step("demo — sweep every tab", async () => {
    for (const tab of ["실행", "목표", "성장", "홈"]) { await clickTab(tab); }
  });
  await shot("demo");

  // ── Data reset — state and evidence photo keys must be cleared together (runs last)
  await step("data reset — clears evidence photo keys too", async () => {
    // plant image keys as reset targets (same key convention the app uses)
    await page.evaluate(() => {
      localStorage.setItem("liferpg-img-ev-zzz", "data:image/png;base64,AAAA");
      localStorage.setItem("liferpg-img-profile", "data:image/png;base64,AAAA");
    });
    await clickTab("성장");
    await sleep(300);
    const clicked = await page.evaluate(() => {
      const b = [...document.querySelectorAll("button")].find((x) => x.innerText.includes("데이터 초기화"));
      if (!b) return false; b.scrollIntoView({ block: "center" }); b.click(); return true;
    });
    if (!clicked) throw new Error("data reset button not found");
    await sleep(900);
    if (!(await hasText("시작하기"))) throw new Error("초기화 후 온보딩으로 가지 않음");
    const left = await page.evaluate(() => ({
      state: localStorage.getItem("liferpg-state-v1"),
      profileImg: localStorage.getItem("liferpg-img-profile"),
    }));
    if (left.state) throw new Error("state key remains after reset");
    if (left.profileImg) throw new Error("profile photo key remains after reset");
  });
  await shot("reset");
};
