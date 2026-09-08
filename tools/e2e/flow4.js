// 마무리 — 목표 상태 변경·구버전 마이그레이션(뒤 단계에 영향 주므로 마지막)
module.exports = async (h) => {
  const { step, shot, clickText, clickTab, clickInModalExact, assertDone, completeQuest, hasText, expectText, typeInto, typeExact, closeModal, sleep, page, errors } = h;
  // ── 목표 상태 변경·삭제
  await step("완주용 목표 생성(횟수 KR 1회)", async () => {
    await clickTab("목표");
    await clickText("새 목표"); await sleep(400);
    await typeInto("목표 —", "E2E 완주 목표");
    await clickText("횟수");
    await typeInto("행동 —", "마무리 점검");
    await typeExact("횟수", "1");
    await clickText("이 핵심결과 추가"); await sleep(250);
    await clickText("목표 만들기"); await sleep(700);
  });
  await step("완주 목표에 실행 등록 후 완료(진행률 100%)", async () => {
    const ok = await page.evaluate(() => {
      const cards = [...document.querySelectorAll("div")].filter((d) => d.innerText.includes("E2E 완주 목표") && [...d.querySelectorAll("button")].some((b) => b.innerText.includes("실행")));
      const inner = cards[cards.length - 1];
      const btn = inner && [...inner.querySelectorAll("button")].find((b) => b.innerText.includes("실행"));
      if (btn) { btn.click(); return true; }
      return false;
    });
    if (!ok) throw new Error("완주 목표의 퀘스트 버튼 없음");
    await sleep(600);
    await typeInto("무엇을 하나요", "마무리 점검 실행");
    await clickInModalExact("등록");
    await sleep(1000); await closeModal();
    await clickTab("실행");
    await completeQuest("마무리 점검 실행");
    await sleep(500);
    await assertDone("마무리 점검 실행");
  });
  await step("목표 달성 처리", async () => {
    await clickTab("목표");
    await clickTab("목표");
    const done = await page.evaluate(() => {
      const btn = [...document.querySelectorAll("button")].find((b) => (b.innerText || "").includes("달성 처리"));
      if (!btn) return false;
      btn.scrollIntoView({ block: "center" }); btn.click(); return true;
    });
    if (!done) throw new Error("달성 처리 버튼 없음(진행률 100% 아님)");
    await sleep(900);
    await closeModal(); // 성취 오버레이 닫기
    await sleep(300);
  });
  await step("달성한 목표를 기록에서 제거", async () => {
    await clickTab("목표");
    const removed = await page.evaluate(() => {
      const btn = [...document.querySelectorAll("button")].find((b) => (b.innerText || "").includes("기록에서 제거"));
      if (!btn) return false;
      btn.scrollIntoView({ block: "center" }); btn.click(); return true;
    });
    if (!removed) throw new Error("기록에서 제거 버튼 없음(달성 상태 아님)");
    await sleep(800);
    if (await hasText("E2E 완주 목표")) throw new Error("제거 후에도 목표가 남아 있음");
  });

  // ── 구버전 세이브 마이그레이션 경로
  await step("v10 세이브 마이그레이션", async () => {
    await page.evaluate(() => {
      const old = {
        v: 10, profile: { nick: "구세이브", persona: "삭제대상", gender: "남성", age: "30대 초반", status: "직장인 1~3년", look: { skin: 0, hair: 0, hairColor: 0, outfit: 0, face: 0 }, startDate: "2026-01-01" },
        parts: [{ id: "p1", name: "커리어", grade: 2, achievements: [] }],
        quests: [{ id: "q1", title: "레거시 퀘스트", partId: "p1", diff: "D", type: "daily", status: "todo", doneDates: [], bossHp: 30 }],
        goals: [], act: { streak: 3, lastActive: "2026-01-02", shieldMonth: "2026-01", shieldsLeft: 1 },
        story: { asset: 20, infl: 10, risk: 8 },
        room: { trophies: [{ id: "t1", kind: "boss", label: "레거시 트로피", tier: "C", date: "2026-01-02" }] }, role: null,
      };
      localStorage.setItem("liferpg-state-v1", JSON.stringify(old)); // 앱의 실제 저장 키(KEY)
    });
    await h.reload();
    await sleep(800);
    const txt = await page.evaluate(() => document.body.innerText);
    if (/오류|Error|undefined/.test(txt)) errors.push("마이그레이션 후 오류 텍스트 노출");
    // v13 변환 검증 — 저장된 트로피 kind가 boss → ach 로 바뀌어야 한다
    const st = await page.evaluate(() => {
      try { return JSON.parse(localStorage.getItem("liferpg-state-v1")); } catch { return null; }
    });
    if (!st) throw new Error("마이그레이션 후 상태 없음");
    if (st.v !== 14) throw new Error("스키마 버전 " + st.v + " (14 기대)");
    if (!Array.isArray(st.tasks) || !Array.isArray(st.areas)) throw new Error("v14 필드(tasks·areas) 없음");
    if (st.quests || st.parts) throw new Error("구필드(quests·parts) 잔존");
    const kinds = (st.room?.trophies || []).map((t) => t.kind);
    if (kinds.includes("boss")) throw new Error("트로피 kind boss 잔존: " + JSON.stringify(kinds));
    if (!kinds.includes("ach")) throw new Error("트로피 kind ach 변환 안 됨: " + JSON.stringify(kinds));
  });
  await step("v 필드 없는 구세이브 마이그레이션", async () => {
    await page.evaluate(() => {
      const old = {
        profile: { nick: "무버전세이브", gender: "남성", age: "30대 초반", status: "직장인 1~3년", look: { skin: 0, hair: 0, hairColor: 0, outfit: 0, face: 0 }, startDate: "2026-01-01" },
        parts: [{ id: "p9", name: "커리어", grade: 1, achievements: [] }],
        quests: [], goals: [], act: { streak: 1, lastActive: "2026-01-02", shieldMonth: "2026-01", shieldsLeft: 2 },
        story: { asset: 12, infl: 6, risk: 4 }, room: { trophies: [{ id: "t2", kind: "boss", label: "구 트로피", tier: "D", date: "2026-01-02" }] }, role: null,
      };
      localStorage.setItem("liferpg-state-v1", JSON.stringify(old));
    });
    await h.reload();
    await sleep(900);
    // 상태 변경을 한 번 일으켜 저장을 유도한 뒤 스키마를 확인한다
    await clickTab("성장");
    await sleep(400);
    const st = await page.evaluate(() => { try { return JSON.parse(localStorage.getItem("liferpg-state-v1")); } catch { return null; } });
    if (!st) throw new Error("상태 없음");
    if (st.v !== 14) throw new Error("스키마 버전 " + st.v + " (14 기대)");
    if (!Array.isArray(st.tasks) || !Array.isArray(st.areas)) throw new Error("v14 필드(tasks·areas) 없음");
    if (st.quests || st.parts) throw new Error("구필드(quests·parts) 잔존");
    if (typeof st.metrics?.body !== "number") throw new Error("metrics.body 미생성 — v12 변환 누락");
    if ((st.room?.trophies || []).some((t) => t.kind === "boss")) throw new Error("트로피 kind boss 잔존");
  });
  await step("v13 세이브 → v14 필드 전환", async () => {
    await page.evaluate(() => {
      const s13 = {
        v: 13,
        profile: { nick: "v13세이브", gender: "남성", age: "30대 초반", status: "직장인 1~3년", look: { skin: 0, hair: 0, hairColor: 0, outfit: 0, face: 0 }, startDate: "2026-01-01" },
        parts: [{ id: "pa", name: "커리어", grade: 2, achievements: [] }],
        quests: [{ id: "qa", title: "레거시 실행", partId: "pa", diff: "D", type: "daily", status: "todo", doneDates: [] }],
        goals: [{ id: "ga", title: "레거시 목표", partId: "pa", status: "active", createdAt: "2026-01-01", krs: [] }],
        act: { streak: 2, lastActive: "2026-01-02", shieldMonth: "2026-01", shieldsLeft: 2 },
        metrics: { asset: 10, infl: 5, body: 15 }, exams: { best: {}, dim: {}, spec: {}, policy: "1.0" },
        certBest: {}, room: { trophies: [] }, role: null, lastTick: "2026-01-02", dModel: "1.3",
      };
      localStorage.setItem("liferpg-state-v1", JSON.stringify(s13));
    });
    await h.reload();
    await sleep(900);
    await clickTab("성장"); await sleep(400);
    const st = await page.evaluate(() => { try { return JSON.parse(localStorage.getItem("liferpg-state-v1")); } catch { return null; } });
    if (!st) throw new Error("상태 없음");
    if (st.v !== 14) throw new Error("스키마 버전 " + st.v + " (14 기대)");
    if (st.quests || st.parts) throw new Error("구필드 잔존");
    if (st.tasks?.[0]?.areaId !== "pa") throw new Error("실행 areaId 변환 실패: " + JSON.stringify(st.tasks?.[0]));
    if (st.goals?.[0]?.areaId !== "pa") throw new Error("목표 areaId 변환 실패");
    if (st.areas?.[0]?.name !== "커리어") throw new Error("영역 이관 실패");
  });
  await shot("migrated");
};
