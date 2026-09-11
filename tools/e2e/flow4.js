// Wrap-up — goal status changes and legacy migrations (last, because they affect later steps)
module.exports = async (h) => {
  const { step, shot, clickText, clickTab, clickInModal, clickInModalExact, assertDone, completeQuest, hasText, expectText, typeInto, typeExact, closeModal, sleep, page, errors } = h;

  // Plant a legacy save, reload, and read back the migrated state.
  const migrateFixture = async (save) => {
    await page.evaluate((s) => localStorage.setItem("liferpg-state-v1", JSON.stringify(s)), save);
    await h.reload();
    await sleep(900);
    await clickTab("성장"); await sleep(400);
    const st = await page.evaluate(() => { try { return JSON.parse(localStorage.getItem("liferpg-state-v1")); } catch { return null; } });
    if (!st) throw new Error("no state");
    if (st.v !== 18) throw new Error("schema version " + st.v + " (expected 18)");
    return st;
  };
  // ── Goal status change and removal
  await step("create goal to finish (count KR ×1)", async () => {
    await clickTab("목표");
    await clickText("새 목표"); await sleep(400);
    await typeInto("목표 —", "E2E 완주 목표");
    await clickText("횟수");
    await typeInto("행동 —", "마무리 점검");
    await typeExact("횟수", "1");
    await clickText("이 핵심결과 추가"); await sleep(250);
    await clickText("목표 만들기"); await sleep(700);
  });
  await step("register and complete a task on the goal (progress 100%)", async () => {
    await h.openTaskModalFor("E2E 완주 목표");
    await clickInModal("채우기 ›"); // count KR → the task that fills it registers without an activity kind
    await typeInto("무엇을 하나요", "마무리 점검 실행");
    await clickInModalExact("등록");
    await sleep(1000); await closeModal();
    await clickTab("실행");
    await completeQuest("마무리 점검 실행");
    await sleep(500);
    await assertDone("마무리 점검 실행");
  });
  await step("mark goal achieved", async () => {
    await clickTab("목표");
    await clickTab("목표");
    const done = await page.evaluate(() => {
      const btn = [...document.querySelectorAll("button")].find((b) => (b.innerText || "").includes("달성 처리"));
      if (!btn) return false;
      btn.scrollIntoView({ block: "center" }); btn.click(); return true;
    });
    if (!done) throw new Error("achieve button not found (progress is not 100%)");
    await sleep(900);
    await closeModal(); // close the achievement overlay
    await sleep(300);
  });
  await step("remove the achieved goal from the record", async () => {
    await clickTab("목표");
    const removed = await page.evaluate(() => {
      const btn = [...document.querySelectorAll("button")].find((b) => (b.innerText || "").includes("기록에서 제거"));
      if (!btn) return false;
      btn.scrollIntoView({ block: "center" }); btn.click(); return true;
    });
    if (!removed) throw new Error("remove-from-record button not found (goal not achieved)");
    await sleep(800);
    if (await hasText("E2E 완주 목표")) throw new Error("제거 후에도 목표가 남아 있음");
  });

  // ── Legacy save migration paths
  await step("v10 save migration", async () => {
    await page.evaluate(() => {
      const old = {
        v: 10, profile: { nick: "구세이브", persona: "삭제대상", gender: "남성", age: "30대 초반", status: "직장인 1~3년", look: { skin: 0, hair: 0, hairColor: 0, outfit: 0, face: 0 }, startDate: "2026-01-01" },
        parts: [{ id: "p1", name: "커리어", grade: 2, achievements: [] }],
        quests: [{ id: "q1", title: "레거시 퀘스트", partId: "p1", diff: "D", type: "daily", status: "todo", doneDates: [], bossHp: 30 }],
        goals: [], act: { streak: 3, lastActive: "2026-01-02", shieldMonth: "2026-01", shieldsLeft: 1 },
        story: { asset: 20, infl: 10, risk: 8 },
        room: { trophies: [{ id: "t1", kind: "boss", label: "레거시 트로피", tier: "C", date: "2026-01-02" }] }, role: null,
      };
      localStorage.setItem("liferpg-state-v1", JSON.stringify(old)); // the app's real storage key (KEY)
    });
    await h.reload();
    await sleep(800);
    const txt = await page.evaluate(() => document.body.innerText);
    if (/오류|Error|undefined/.test(txt)) errors.push("마이그레이션 후 오류 텍스트 노출");
    // v13 conversion check — the stored trophy kind must change from boss to ach
    const st = await page.evaluate(() => {
      try { return JSON.parse(localStorage.getItem("liferpg-state-v1")); } catch { return null; }
    });
    if (!st) throw new Error("no state after migration");
    if (st.v !== 18) throw new Error("schema version " + st.v + " (expected 18)");
    if (!Array.isArray(st.tasks) || !Array.isArray(st.areas)) throw new Error("v14 fields (tasks, areas) missing");
    if (st.quests || st.parts) throw new Error("legacy fields (quests, parts) remain");
    const kinds = (st.room?.trophies || []).map((t) => t.kind);
    if (kinds.includes("boss")) throw new Error("트로피 kind boss 잔존: " + JSON.stringify(kinds));
    if (!kinds.includes("ach")) throw new Error("트로피 kind ach 변환 안 됨: " + JSON.stringify(kinds));
  });
  await step("legacy save without v migration", async () => {
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
    // trigger one state change to force a save, then check the schema
    await clickTab("성장");
    await sleep(400);
    const st = await page.evaluate(() => { try { return JSON.parse(localStorage.getItem("liferpg-state-v1")); } catch { return null; } });
    if (!st) throw new Error("no state");
    if (st.v !== 18) throw new Error("schema version " + st.v + " (expected 18)");
    if (!Array.isArray(st.tasks) || !Array.isArray(st.areas)) throw new Error("v14 fields (tasks, areas) missing");
    if (st.quests || st.parts) throw new Error("legacy fields (quests, parts) remain");
    if (typeof st.metrics?.body !== "number") throw new Error("metrics.body missing — v12 conversion skipped");
    if ((st.room?.trophies || []).some((t) => t.kind === "boss")) throw new Error("trophy kind boss remains");
  });
  await step("v13 save → v14 field rename", async () => {
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
    const st = await migrateFixture(s13);
    if (st.quests || st.parts) throw new Error("legacy fields remain");
    if (st.tasks?.[0]?.areaId !== "pa") throw new Error("task areaId conversion failed: " + JSON.stringify(st.tasks?.[0]));
    if (st.goals?.[0]?.areaId !== "pa") throw new Error("goal areaId conversion failed");
    if (st.areas?.[0]?.name !== "커리어") throw new Error("area migration failed");
  });
  await step("v14 save → v15 assistant fields", async () => {
    const s14 = {
      v: 14,
      profile: { nick: "v14세이브", gender: "남성", age: "30대 초반", status: "직장인 1~3년", look: { skin: 0, hair: 0, hairColor: 0, outfit: 0, face: 0 }, directions: [] },
      areas: [{ id: "ar", name: "커리어", grade: 2, achievements: [] }],
      tasks: [{ id: "ta", title: "레거시 실행", areaId: "ar", diff: "D", type: "daily", status: "todo", doneDates: [] }],
      goals: [], act: { streak: 1, lastActive: "2026-01-02", shieldMonth: "2026-01", shieldsLeft: 2 },
      metrics: { asset: 10, infl: 5, body: 15 }, exams: { best: {}, dim: {}, spec: {}, policy: "1.0" },
      certBest: {}, room: { trophies: [] }, role: null, lastTick: "2026-01-02", dModel: "1.3",
    };
    const st = await migrateFixture(s14);
    if (!Array.isArray(st.journal) || !Array.isArray(st.reviews)) throw new Error("v15 records (journal, reviews) missing");
    if (!("briefingSeen" in st.act) || !("lastCheckin" in st.act) || !("lastReview" in st.act)) throw new Error("v15 act stamps missing");
    if (st.tasks?.[0]?.due !== undefined) throw new Error("migration invented a due date");
  });
  await step("v15 save → v16 schedule", async () => {
    const s15 = {
      v: 15,
      profile: { nick: "v15세이브", gender: "남성", age: "30대 초반", status: "직장인 1~3년", look: { skin: 0, hair: 0, hairColor: 0, outfit: 0, face: 0 }, directions: [] },
      areas: [{ id: "as", name: "커리어", grade: 2, achievements: [] }],
      tasks: [{ id: "ts", title: "레거시 실행", areaId: "as", diff: "D", type: "daily", status: "todo", doneDates: [] }],
      goals: [],
      journal: [{ id: "js", date: "2026-01-02", text: "레거시 기록" }],
      reviews: [{ id: "rs", weekOf: "2025-12-29", date: "2026-01-02", wins: "기록 유지", blocks: "없음" }],
      act: { streak: 1, lastActive: "2026-01-02", shieldMonth: "2026-01", shieldsLeft: 2, lastCheckin: null, briefingSeen: null, lastReview: null },
      metrics: { asset: 10, infl: 5, body: 15 }, exams: { best: {}, dim: {}, spec: {}, policy: "1.0" },
      certBest: {}, room: { trophies: [] }, role: null, lastTick: "2026-01-02", dModel: "1.3",
    };
    const st = await migrateFixture(s15);
    if (!Array.isArray(st.events)) throw new Error("v16 events array missing");
    if (st.events.length) throw new Error("migration invented events: " + JSON.stringify(st.events));
    if (st.journal?.length !== 1 || !Array.isArray(st.reviews)) throw new Error("v15 records lost by the v16 block");
  });
  await step("v16 save → v17 schedule view", async () => {
    const s16 = {
      v: 16,
      profile: { nick: "v16세이브", gender: "남성", age: "30대 초반", status: "직장인 1~3년", look: { skin: 0, hair: 0, hairColor: 0, outfit: 0, face: 0 }, directions: [] },
      areas: [{ id: "av", name: "커리어", grade: 2, achievements: [] }],
      tasks: [{ id: "tv", title: "레거시 실행", areaId: "av", diff: "D", type: "daily", status: "todo", doneDates: [] }],
      goals: [],
      events: [{ id: "ev", title: "레거시 면접", kind: "appt", date: "2026-01-05", time: "10:00", createdAt: "2026-01-02" }],
      journal: [{ id: "jv", date: "2026-01-02", text: "레거시 기록" }],
      reviews: [{ id: "rv", weekOf: "2025-12-29", date: "2026-01-02", wins: "기록 유지", blocks: "없음" }],
      act: { streak: 1, lastActive: "2026-01-02", shieldMonth: "2026-01", shieldsLeft: 2, lastCheckin: null, briefingSeen: null, lastReview: null },
      metrics: { asset: 10, infl: 5, body: 15 }, exams: { best: {}, dim: {}, spec: {}, policy: "1.0" },
      certBest: {}, room: { trophies: [] }, role: null, lastTick: "2026-01-02", dModel: "1.3",
    };
    const st = await migrateFixture(s16);
    if (st.ui?.scheduleView !== "list") throw new Error("v17 schedule view missing or not list: " + JSON.stringify(st.ui));
    if (st.events?.length !== 1 || st.events[0].title !== "레거시 면접") throw new Error("v16 events changed by the v17 block: " + JSON.stringify(st.events));
    if (st.journal?.length !== 1 || st.reviews?.length !== 1) throw new Error("v15 records lost by the v17 block");
  });
  await step("v17 save → v18 meeting task converted", async () => {
    const s17 = {
      v: 17,
      profile: { nick: "v17세이브", gender: "남성", age: "30대 초반", status: "직장인 1~3년", look: { skin: 0, hair: 0, hairColor: 0, outfit: 0, face: 0 }, directions: [] },
      areas: [{ id: "av", name: "커리어", grade: 2, achievements: [] }],
      tasks: [{ id: "tm", title: "거래처 미팅", areaId: "av", kind: "meet", diff: "D", type: "once", status: "done", doneAt: "2026-01-02", doneDates: [], evidence: "회의록 · ○○상사 김과장 — 안건: 사양 협의" }],
      goals: [],
      events: [],
      journal: [],
      reviews: [],
      ui: { scheduleView: "calendar" },
      act: { streak: 1, lastActive: "2026-01-02", shieldMonth: "2026-01", shieldsLeft: 2, lastCheckin: null, briefingSeen: null, lastReview: null },
      metrics: { asset: 10, infl: 5, body: 15 }, exams: { best: {}, dim: {}, spec: {}, policy: "1.0" },
      certBest: {}, room: { trophies: [] }, role: null, lastTick: "2026-01-02", dModel: "1.3",
    };
    const st = await migrateFixture(s17);
    const mt = (st.tasks || []).find((q) => q.id === "tm");
    if (!mt) throw new Error("v18 removed the meeting task instead of converting it");
    if ("kind" in mt) throw new Error("meet kind survived the v18 block: " + JSON.stringify(mt));
    if (mt.title !== "거래처 미팅" || mt.diff !== "D" || mt.status !== "done" || mt.doneAt !== "2026-01-02") throw new Error("v18 changed a field it must keep: " + JSON.stringify(mt));
    if (mt.evidence !== "회의록 · ○○상사 김과장 — 안건: 사양 협의") throw new Error("v18 dropped the recorded minutes: " + JSON.stringify(mt));
    if (st.ui?.scheduleView !== "calendar") throw new Error("v18 rewrote the v17 schedule view: " + JSON.stringify(st.ui));
  });
  await shot("migrated");
};
