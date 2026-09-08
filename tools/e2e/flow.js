// 실사용 전 구간 플로우 — run.js가 require해서 실행한다(헬퍼는 인자로 주입)
module.exports = async (h) => {
  const { step, shot, clickText, clickTab, hasText, expectText, typeInto, typeExact, completeQuest, closeModal, sleep, page, errors } = h;

  // ── 온보딩 6단계
  await step("온보딩 시작", async () => { await clickText("시작하기"); await expectText("1 / 6"); });
  await step("1단계 기본 정보", async () => {
    await typeInto("닉네임", "E2E테스터");
    for (const t of ["20대 후반", "남성", "취업 준비", "학사 졸", "공학"]) { try { await clickText(t); } catch { errors.push(`선택 실패: ${t}`); } }
    await clickText("다음"); await expectText("2 / 6");
  });
  await step("2단계 외형", async () => { await clickText("무작위"); await clickText("다음"); await expectText("3 / 6"); });
  await step("3단계 파트·지식 방향", async () => {
    for (const t of ["기본지식", "커리어"]) { try { await clickText(t); } catch {} }
    for (const d of ["IT·개발", "데이터·AI"]) { try { await clickText(d); } catch {} }
    await clickText("다음"); await expectText("4 / 6");
  });
  await step("4단계 자격 검색(1,011종)", async () => {
    await typeInto("자격증 검색", "정보처리기사");
    await sleep(250);
    await expectText("정보처리기사");
    await clickText("정보처리기사");
    await clickText("다음"); await expectText("5 / 6");
  });
  await step("5단계 경험·산출물", async () => {
    for (const t of ["경험 없음", "개인 프로젝트 있음"]) { try { await clickText(t); } catch { errors.push(`선택 실패: ${t}`); } }
    await clickText("다음"); await expectText("6 / 6");
  });
  await step("6단계 산정 결과 → 시작", async () => { await clickText("이 설정으로 시작"); await sleep(600); await expectText("오늘"); });
  await shot("home");
  await step("신규 상태 스키마 버전 확인", async () => {
    const v = await page.evaluate(() => { try { return JSON.parse(localStorage.getItem("liferpg-state-v1"))?.v; } catch { return null; } });
    if (v !== 14) throw new Error("신규 저장 스키마 v" + v + " (14 기대)");
  });

  // ── 목표(OKR) 생성 — metric·count·cert KR
  await step("목표 탭 → 새 목표 모달", async () => {
    await clickTab("목표");
    await clickText("새 목표"); await sleep(350);
    await expectText("새 목표");
  });
  await step("목표 제목·메모 입력", async () => {
    await typeInto("목표 —", "하네스 설계 엔지니어 취업");
    await typeInto("메모", "E2E 검증용 목표");
  });
  await step("KR 1 — 횟수형 추가", async () => {
    await clickText("횟수");
    await typeInto("행동 —", "설계 실습");
    await typeInto("횟수", "10");
    await clickText("이 핵심결과 추가"); await sleep(200);
  });
  await step("KR 2 — 자격형 추가(1,011종 검색)", async () => {
    await clickText("자격");
    await typeInto("자격증 검색 —", "전기기사");
    await sleep(300);
    await clickText("전기기사"); await sleep(150);
    await clickText("이 핵심결과 추가"); await sleep(200);
  });
  await step("KR 3 — 수치형 추가", async () => {
    await clickText("수치");
    await typeInto("지표명", "설계 산출물 수");
    await typeExact("시작", "0"); await typeExact("목표", "5"); await typeExact("단위", "건");
    await clickText("이 핵심결과 추가"); await sleep(200);
  });
  await step("목표 만들기", async () => { await clickText("목표 만들기"); await sleep(500); await expectText("하네스 설계 엔지니어 취업"); });
  await shot("goal-created");

  // ── KR 브리지로 실행 등록
  await step("KR 브리지 — 실행 모달 열기", async () => {
    await clickText("실행 연결"); await sleep(400);
  });
  await step("일일 실행 실행 등록", async () => {
    try { await clickText("일일 실행"); } catch {}
    await sleep(200);
    await typeInto("무엇을 하나요", "설계 실습 1시간");
    for (const t of ["등록", "추가", "만들기"]) { try { await clickText(t); break; } catch {} }
    await sleep(1600); // 토스트 사라질 때까지
    await closeModal();
  });
  await shot("quest-added");

  // ── 실행 탭 — 완료·도감
  await step("실행 탭 이동", async () => { await clickTab("실행"); await expectText("실행"); });
  await step("일일 실행 완료(목표 진행률 델타)", async () => {
    const before = await page.evaluate(() => document.body.innerText);
    await completeQuest("설계 실습 1시간");
    const after = await page.evaluate(() => document.body.innerText);
    if (before === after) errors.push("퀘스트 완료 후 화면 변화 없음(확인 필요)");
  });
  await step("성취 도감 열기(1,011종 목록)", async () => { await clickText("도감"); await sleep(400); await expectText("성취 도감"); });
  await step("도감 카테고리 전환 — 교육·복지·상담", async () => {
    try { await clickText("교육·복지·상담"); } catch { errors.push("신설 카테고리 버튼 없음"); }
    await sleep(300);
  });
  await step("도감 검색 응답", async () => {
    const t0 = Date.now();
    await typeInto("자격증 검색", "간호");
    await sleep(350);
    h.metrics.catalogSearchMs = Date.now() - t0;
    await expectText("간호");
  });
  await shot("catalog");
  await step("도감 닫기", async () => { await page.keyboard.press("Escape"); await sleep(200); await h.closeModal(); });

  // ── 성장 탭 — 지표 체크인·승급 관문·롤모델
  await step("성장 탭 이동", async () => { await clickTab("성장"); await expectText("인생 지표"); });
  await step("지표 체크인 저장", async () => {
    await clickText("체크인"); await sleep(300);
    await clickText("저장"); await sleep(400);
  });
  await step("승급 관문 모달 열기", async () => {
    try { await clickText("관문 증명하기"); } catch { errors.push("승급 버튼 없음"); }
    await sleep(400); await h.closeModal();
  });
  await step("롤모델 모달 열기", async () => {
    try { await clickText("롤모델"); } catch { errors.push("롤모델 버튼 없음"); }
    await sleep(350);
    try { await clickText("✕"); } catch {}
  });
  await shot("growth");

  // ── 탭 순회 + 지속성
  for (const tab of ["홈", "실행", "목표", "성장"]) {
    await step(`탭 이동: ${tab}`, async () => { await clickTab(tab); });
  }
  await step("새로고침 후 상태 유지", async () => {
    const before = await page.evaluate(() => localStorage.length);
    await h.reload();
    await sleep(600);
    const after = await page.evaluate(() => localStorage.length);
    if (!before || after !== before) throw new Error(`localStorage 키 ${before} → ${after}`);
    if (await hasText("시작하기")) throw new Error("온보딩으로 되돌아감(상태 유실)");
    await expectText("하네스 설계 엔지니어 취업");
  });
  await shot("after-reload");

  // ── 심화 플로우(증거·학습·활동·승급·롤모델·마이그레이션)
  await require("./flow2.js")(h);

  await require("./flow3.js")(h);
  await require("./flow4.js")(h);

  // ── 데모 데이터 경로(별도 세션)
  await step("데모 데이터 진입", async () => {
    await page.evaluate(() => localStorage.clear());
    await h.reload();
    await sleep(500);
    await clickText("데모 데이터로 둘러보기");
    await sleep(700);
    await expectText("오늘");
  });
  await step("데모 — 전 탭 순회", async () => {
    for (const tab of ["실행", "목표", "성장", "홈"]) { await clickTab(tab); }
  });
  await shot("demo");

  // ── 데이터 초기화 — 상태·증거 사진 키가 함께 지워지는지(가장 마지막에 실행)
  await step("데이터 초기화 — 증거 사진 키까지 정리", async () => {
    // 초기화 대상 확인용으로 이미지 키를 심어 둔다(앱이 쓰는 키 규약과 동일)
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
    if (!clicked) throw new Error("데이터 초기화 버튼 없음");
    await sleep(900);
    if (!(await hasText("시작하기"))) throw new Error("초기화 후 온보딩으로 가지 않음");
    const left = await page.evaluate(() => ({
      state: localStorage.getItem("liferpg-state-v1"),
      profileImg: localStorage.getItem("liferpg-img-profile"),
    }));
    if (left.state) throw new Error("초기화 후 상태 키가 남음");
    if (left.profileImg) throw new Error("초기화 후 프로필 사진 키가 남음");
  });
  await shot("reset");
};
