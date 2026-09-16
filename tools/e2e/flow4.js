// Wrap-up — goal status changes and legacy migrations (last, because they affect later steps)
module.exports = async (h) => {
  const { step, shot, clickText, clickTab, clickExact, clickInModal, clickInModalExact, assertDone, completeQuest, hasText, expectText, typeInto, typeExact, closeModal, sleep, page, errors } = h;
  // The schema version every migrated fixture must end at — bumped with each new `migrate` block (rule 12).
  const SCHEMA_V = 24;
  // Order-independent deep equality for plain JSON records read back from the save.
  const canon = (v) => (Array.isArray(v) ? v.map(canon) : v && typeof v === "object" ? Object.keys(v).sort().map((k) => [k, canon(v[k])]) : v);
  const same = (a, b) => JSON.stringify(canon(a)) === JSON.stringify(canon(b));

  // Plant a legacy save, reload, and read back the migrated state.
  const migrateFixture = async (save) => {
    await page.evaluate((s) => localStorage.setItem("liferpg-state-v1", JSON.stringify(s)), save);
    await h.reload();
    await sleep(900);
    await clickTab("프로필"); await sleep(400);
    const st = await page.evaluate(() => { try { return JSON.parse(localStorage.getItem("liferpg-state-v1")); } catch { return null; } });
    if (!st) throw new Error("no state");
    if (st.v !== SCHEMA_V) throw new Error("schema version " + st.v + " (expected " + SCHEMA_V + ")");
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
    await clickTab("할 일");
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

  await step("plant a goal with one completed and one open task", async () => {
    await page.evaluate(() => {
      const k = "liferpg-state-v1";
      const s = JSON.parse(localStorage.getItem(k));
      const areaId = s.areas[0].id;
      s.goals = [{ id: "gdel", title: "E2E 삭제 목표", areaId, status: "active", createdAt: "2026-01-01",
        krs: [{ id: "kdel", type: "count", title: "정리 작업", need: 2 }] }, ...s.goals];
      s.tasks = [
        { id: "tkeep", title: "남길 실행", areaId, goalId: "gdel", diff: "D", type: "once", status: "done", doneAt: "2026-01-02", doneDates: [], createdAt: "2026-01-01", evidence: "정리 완료" },
        { id: "tdrop", title: "삭제될 실행", areaId, goalId: "gdel", diff: "D", type: "once", status: "todo", doneDates: [], createdAt: "2026-01-01" },
        ...s.tasks];
      localStorage.setItem(k, JSON.stringify(s));
    });
    await h.reload();
    await sleep(700);
    await clickTab("목표");
    await expectText("E2E 삭제 목표");
    await expectText("목표 삭제");
  });
  await step("delete an active goal — open task removed, completed task kept", async () => {
    // the confirmation is a real window.confirm; stub it the way flow6 does for the backup import
    await page.evaluate(() => { window.confirm = () => false; });
    await clickText("목표 삭제"); await sleep(500);
    if (!(await hasText("E2E 삭제 목표"))) throw new Error("cancelling the confirmation still deleted the goal");
    await page.evaluate(() => { window.confirm = () => true; });
    await clickText("목표 삭제"); await sleep(800);
    if (await hasText("E2E 삭제 목표")) throw new Error("goal survived the confirmed deletion");
    const st = await page.evaluate(() => { try { return JSON.parse(localStorage.getItem("liferpg-state-v1")); } catch { return null; } });
    if (!st) throw new Error("no state");
    if ((st.goals || []).some((g) => g.id === "gdel")) throw new Error("goal record remains");
    if ((st.tasks || []).some((q) => q.id === "tdrop")) throw new Error("open task of the deleted goal remains");
    const keep = (st.tasks || []).find((q) => q.id === "tkeep");
    if (!keep) throw new Error("completed task was deleted with its goal");
    if (keep.goalId !== "gdel" || keep.evidence !== "정리 완료") throw new Error("completed task was rewritten: " + JSON.stringify(keep));
    // The completed task keeps its evidence and now states that it serves no goal; it was completed before
    // today, so the `완료` archive is where it is listed.
    await clickTab("할 일");
    await clickExact("완료");
    await expectText("남길 실행");
    await expectText("목표 기여 없음");
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
    if (st.v !== SCHEMA_V) throw new Error("schema version " + st.v + " (expected " + SCHEMA_V + ")");
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
    // the save is written at boot; render home (every fixture now shows the CV there), then check the schema
    await clickTab("프로필");
    await sleep(400);
    const st = await page.evaluate(() => { try { return JSON.parse(localStorage.getItem("liferpg-state-v1")); } catch { return null; } });
    if (!st) throw new Error("no state");
    if (st.v !== SCHEMA_V) throw new Error("schema version " + st.v + " (expected " + SCHEMA_V + ")");
    if (!Array.isArray(st.tasks) || !Array.isArray(st.areas)) throw new Error("v14 fields (tasks, areas) missing");
    if (st.quests || st.parts) throw new Error("legacy fields (quests, parts) remain");
    // v12 built a life-metric store that v19 then deletes, so nothing v12 produced is observable in an end state.
    if (st.profile?.persona) throw new Error("v11 persona deletion skipped");
    if ("metrics" in st) throw new Error("v19 left the life-metric store the v11/v12 blocks had built");
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
    if (!("briefingSeen" in st.act) || !("lastReview" in st.act)) throw new Error("v15 act stamps missing");
    // v15 also writes lastCheckin, which v19 deletes again — the end state proves both blocks ran.
    if ("lastCheckin" in st.act) throw new Error("v19 left the check-in stamp the v15 block had written");
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
    // v17 wrote ui.scheduleView and v22 drops it again, so the v17 normalisation is no longer observable in an end
    // state (the v12 precedent); what is left to check is that the key is gone.
    if ("scheduleView" in (st.ui || {})) throw new Error("v22 left the retired schedule view: " + JSON.stringify(st.ui));
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
    if ("scheduleView" in (st.ui || {})) throw new Error("v22 left the retired schedule view: " + JSON.stringify(st.ui)); // no longer observable after v22 (the v12 precedent)
  });
  await step("v18 save → v19 life metrics removed", async () => {
    // shieldMonth and briefingSeen are stamped with today so that the monthly shield reset (applyDailyTick)
    // and the briefing-on-load cannot move them — what the step compares is then the work of the v19 block alone.
    const now = await page.evaluate(() => { const d = new Date(); const p = (n) => String(n).padStart(2, "0"); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`; });
    const s18 = {
      v: 18,
      profile: { nick: "v18세이브", gender: "남성", age: "30대 초반", status: "직장인 1~3년", look: { skin: 0, hair: 0, hairColor: 0, outfit: 0, face: 0 }, directions: [] },
      areas: [{ id: "aw", name: "커리어", grade: 2, achievements: [] }],
      tasks: [{ id: "tw", title: "레거시 실행", areaId: "aw", diff: "D", type: "daily", status: "todo", doneDates: [] }],
      goals: [],
      events: [],
      journal: [{ id: "jw", date: "2026-01-02", text: "레거시 기록" }],
      reviews: [{ id: "rw", weekOf: "2025-12-29", date: "2026-01-02", wins: "기록 유지", blocks: "없음" }],
      ui: { scheduleView: "calendar" },
      act: { streak: 3, lastActive: "2026-01-02", shieldMonth: now.slice(0, 7), shieldsLeft: 1, lastCheckin: "2026-01-02", briefingSeen: now, lastReview: "2026-01-02" },
      metrics: { asset: 40, infl: 30, body: 20 }, exams: { best: {}, dim: {}, spec: {}, policy: "1.0" },
      certBest: {}, room: { trophies: [] }, role: null, lastTick: "2026-01-02", dModel: "1.3",
    };
    const st = await migrateFixture(s18);
    if ("metrics" in st) throw new Error("v19 kept the life-metric store: " + JSON.stringify(st.metrics));
    if ("lastCheckin" in (st.act || {})) throw new Error("v19 kept the check-in stamp: " + JSON.stringify(st.act));
    const actKeys = Object.keys(st.act || {}).sort().join(",");
    if (actKeys !== "briefingSeen,lastActive,lastReview,shieldMonth,shieldsLeft,streak") throw new Error("v19 changed the act key set: " + actKeys);
    if (st.act?.streak !== 3 || st.act?.shieldsLeft !== 1) throw new Error("v19 changed the streak counters: " + JSON.stringify(st.act));
    if (st.act?.briefingSeen !== now || st.act?.lastReview !== "2026-01-02") throw new Error("v19 dropped an act stamp it must keep: " + JSON.stringify(st.act));
    if ("scheduleView" in (st.ui || {})) throw new Error("v22 left the retired schedule view: " + JSON.stringify(st.ui)); // no longer observable after v22 (the v12 precedent)
    if (st.journal?.length !== 1 || st.reviews?.length !== 1) throw new Error("v19 lost a record: " + JSON.stringify({ journal: st.journal?.length, reviews: st.reviews?.length }));
  });
  await step("v19 save → v20 business", async () => {
    const s19 = {
      v: 19,
      profile: { nick: "v19세이브", gender: "남성", age: "30대 초반", status: "직장인 1~3년", look: { skin: 0, hair: 0, hairColor: 0, outfit: 0, face: 0 }, directions: [] },
      areas: [{ id: "ab", name: "커리어", grade: 2, achievements: [] }],
      tasks: [{ id: "tb", title: "레거시 실행", areaId: "ab", diff: "D", type: "daily", status: "todo", doneDates: [] }],
      goals: [],
      events: [{ id: "eb", title: "레거시 면접", kind: "appt", date: "2026-01-05", time: "10:00", createdAt: "2026-01-02" }],
      journal: [{ id: "jb", date: "2026-01-02", text: "레거시 기록" }],
      reviews: [{ id: "rb", weekOf: "2025-12-29", date: "2026-01-02", wins: "기록 유지", blocks: "없음" }],
      ui: { scheduleView: "calendar" },
      act: { streak: 2, lastActive: "2026-01-02", shieldMonth: "2026-01", shieldsLeft: 2, briefingSeen: null, lastReview: "2026-01-02" },
      exams: { best: {}, dim: {}, spec: {}, policy: "1.0" },
      certBest: {}, room: { trophies: [] }, role: null, lastTick: "2026-01-02", dModel: "1.3",
    };
    const st = await migrateFixture(s19);
    for (const k of ["folio", "rates", "deals"]) {
      if (!Array.isArray(st[k])) throw new Error(`v20 record array ${k} missing: ` + JSON.stringify(st[k]));
      if (st[k].length) throw new Error(`v20 invented ${k} rows: ` + JSON.stringify(st[k]));
    }
    if (st.ui?.bizView !== "deals") throw new Error("v20 business view missing or not deals: " + JSON.stringify(st.ui));
    if ("scheduleView" in (st.ui || {})) throw new Error("v22 left the retired schedule view: " + JSON.stringify(st.ui)); // no longer observable after v22 (the v12 precedent)
    if (st.events?.length !== 1 || st.events[0].title !== "레거시 면접") throw new Error("v20 changed the schedule records: " + JSON.stringify(st.events));
    if (st.tasks?.length !== 1 || st.tasks[0].id !== "tb") throw new Error("v20 changed the task records: " + JSON.stringify(st.tasks));
    if (st.journal?.length !== 1 || st.reviews?.length !== 1) throw new Error("v20 lost a record: " + JSON.stringify({ journal: st.journal?.length, reviews: st.reviews?.length }));
    if (st.act?.streak !== 2 || st.act?.lastReview !== "2026-01-02") throw new Error("v20 changed an act stamp: " + JSON.stringify(st.act));
    if ("lastCheckin" in (st.act || {}) || "metrics" in st) throw new Error("v20 brought back what v19 removed: " + JSON.stringify(st.act));
  });
  await step("v20 save → v21 CV records", async () => {
    // A save that never finished onboarding keeps profile === null, so the root still routes it to the
    // onboarding screen instead of trapping it in the main app with no profile. Read back without a tab
    // click: there is no nav bar on that screen.
    await page.evaluate(() => localStorage.setItem("liferpg-state-v1", JSON.stringify({
      v: 20, profile: null, areas: [], tasks: [], goals: [], events: [], folio: [], rates: [], deals: [],
      journal: [], reviews: [], ui: { scheduleView: "list", bizView: "deals" },
      act: { streak: 0, lastActive: null, shieldMonth: "2026-01", shieldsLeft: 2, briefingSeen: null, lastReview: null },
      exams: { best: {}, dim: {}, spec: {}, policy: "1.0" }, certBest: {}, room: { trophies: [] }, role: null,
      lastTick: "2026-01-02", dModel: "1.3",
    })));
    await h.reload();
    await sleep(900);
    const half = await page.evaluate(() => { try { return JSON.parse(localStorage.getItem("liferpg-state-v1")); } catch { return null; } });
    if (!half) throw new Error("no state");
    if (half.v !== SCHEMA_V) throw new Error("schema version " + half.v + " (expected " + SCHEMA_V + ")");
    if (half.profile !== null) throw new Error("v21 materialised a profile on a half-onboarded save: " + JSON.stringify(half.profile));
    if (!(await hasText("시작하기"))) throw new Error("a profile-less save no longer routes to onboarding");

    // shieldMonth carries the current month so the monthly shield reset (applyDailyTick) cannot move
    // shieldsLeft — what the step compares is then the work of the v21 block alone, as in the v18 step.
    const now = await page.evaluate(() => { const d = new Date(); const p2 = (n) => String(n).padStart(2, "0"); return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`; });
    const s20 = {
      v: 20,
      profile: { nick: "v20세이브", gender: "남성", age: "30대 초반", status: "직장인 1~3년", edu: "ba", career: "y13", lead: "yes", biz: "none", output: "priv", majorField: "공학", majorName: "기계공학", certs: [], examsOwned: [], directions: [], look: { skin: 0, hair: 0, hairColor: 0, outfit: 0, face: 0 }, startDate: "2026-01-01" },
      areas: [{ id: "ac", name: "커리어", grade: 3, achievements: [{ id: "ach1", text: "초기 산정 — 실무 1~3년", date: "2026-01-01", grade: 3 }] }],
      tasks: [{ id: "tc", title: "레거시 실행", areaId: "ac", diff: "D", type: "daily", status: "todo", doneDates: [] }],
      goals: [],
      events: [{ id: "ec", title: "레거시 면접", kind: "appt", date: "2026-01-05", time: "10:00", createdAt: "2026-01-02" }],
      folio: [{ id: "fc", title: "레거시 포트폴리오", links: [], createdAt: "2026-01-02" }],
      rates: [], deals: [],
      journal: [{ id: "jc", date: "2026-01-02", text: "레거시 기록" }],
      reviews: [{ id: "rc", weekOf: "2025-12-29", date: "2026-01-02", wins: "기록 유지", blocks: "없음" }],
      ui: { scheduleView: "calendar", bizView: "folio" },
      act: { streak: 5, lastActive: "2026-01-02", shieldMonth: now.slice(0, 7), shieldsLeft: 1, briefingSeen: now, lastReview: "2026-01-02" },
      exams: { best: {}, dim: {}, spec: {}, policy: "1.0" },
      certBest: {}, room: { trophies: [] }, role: null, lastTick: "2026-01-02", dModel: "1.3",
    };
    const st = await migrateFixture(s20);
    const p = st.profile || {};
    if (!Array.isArray(p.edus) || p.edus.length) throw new Error("v21 education records missing or invented: " + JSON.stringify(p.edus));
    if (!Array.isArray(p.careers) || p.careers.length) throw new Error("v21 career records missing or invented: " + JSON.stringify(p.careers));
    if (p.name !== "" || p.email !== "" || p.phone !== "") throw new Error("v21 invented a personal field: " + JSON.stringify({ name: p.name, email: p.email, phone: p.phone }));
    if (p.birth !== null) throw new Error("v21 invented a birth date: " + JSON.stringify(p.birth));
    // The starting-grade inputs are one-time snapshots: recomputing them from the (empty) CV would
    // retroactively rescore the area grades this save already holds (rules 4, 11).
    if (p.edu !== "ba" || p.career !== "y13") throw new Error("v21 recomputed a starting-grade input: " + JSON.stringify({ edu: p.edu, career: p.career }));
    if (p.age !== "30대 초반" || p.majorName !== "기계공학" || p.majorField !== "공학") throw new Error("v21 dropped a legacy profile fact: " + JSON.stringify(p));
    if (p.nick !== "v20세이브" || p.status !== "직장인 1~3년" || p.lead !== "yes" || p.output !== "priv") throw new Error("v21 changed a profile field it must keep: " + JSON.stringify(p));
    if (st.areas?.[0]?.grade !== 3 || st.areas[0].achievements?.length !== 1) throw new Error("v21 changed the area record: " + JSON.stringify(st.areas));
    if (st.tasks?.length !== 1 || st.tasks[0].id !== "tc") throw new Error("v21 changed the task records: " + JSON.stringify(st.tasks));
    if (st.events?.length !== 1 || st.folio?.length !== 1) throw new Error("v21 changed a record array: " + JSON.stringify({ events: st.events?.length, folio: st.folio?.length }));
    if (st.journal?.length !== 1 || st.reviews?.length !== 1) throw new Error("v21 lost a record: " + JSON.stringify({ journal: st.journal?.length, reviews: st.reviews?.length }));
    if (st.act?.streak !== 5 || st.act?.shieldsLeft !== 1 || st.act?.lastReview !== "2026-01-02") throw new Error("v21 changed an act stamp: " + JSON.stringify(st.act));
    if (st.ui?.bizView !== "folio") throw new Error("v21 rewrote the business view: " + JSON.stringify(st.ui));
    if ("scheduleView" in (st.ui || {})) throw new Error("v22 left the retired schedule view: " + JSON.stringify(st.ui)); // no longer observable after v22 (the v12 precedent)
  });
  await step("v21 save → v22 exam score fields", async () => {
    // Nothing is backfilled: a completed exam milestone and its best band keep exactly the fields they were paid with,
    // and the CV falls back to the band label. The retired schedule view is dropped; the business view is kept.
    const now = await page.evaluate(() => { const d = new Date(); const p2 = (n) => String(n).padStart(2, "0"); return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`; });
    const task = { id: "tx", title: "TOEIC L&R 700 달성", areaId: "ax", goalId: "gx", isExam: true, famId: "toeic", band: { label: "700", d: 49, p: 480, conf: "B" },
      diff: "B", pts: 480, type: "once", status: "done", doneAt: "2026-01-02", doneDates: [], createdAt: "2026-01-01", evidence: "📎 성적표 첨부" };
    const best = { label: "700", d: 49, p: 480, ver: "1.0", date: "2026-01-02" };
    const s21 = {
      v: 21,
      profile: { name: "v21 사용자", nick: "v21세이브", birth: "1996-03-02", email: "", phone: "", gender: "남성", status: "직장인 1~3년",
        edus: [{ id: "ex1", school: "레거시대학교", degree: "ba", status: "grad" }], careers: [],
        edu: "ba", career: "y13", certs: [], examsOwned: [], directions: [], look: { skin: 0, hair: 0, hairColor: 0, outfit: 0, face: 0 }, startDate: "2026-01-01" },
      areas: [{ id: "ax", name: "기본지식", grade: 2, achievements: [{ id: "achx", text: "TOEIC L&R 700 — D49 · +480P", date: "2026-01-02", grade: 2 }] }],
      tasks: [task],
      goals: [{ id: "gx", title: "레거시 어학 목표", areaId: "ax", status: "active", createdAt: "2026-01-01", krs: [] }],
      events: [{ id: "ex", title: "레거시 면접", kind: "appt", date: "2026-01-05", time: "10:00", createdAt: "2026-01-02" }],
      folio: [], rates: [{ id: "rx", name: "레거시 단가", unit: "day", price: 300000, createdAt: "2026-01-02" }], deals: [],
      journal: [{ id: "jx", date: "2026-01-02", text: "레거시 기록" }],
      reviews: [],
      ui: { scheduleView: "calendar", bizView: "rates" },
      act: { streak: 2, lastActive: "2026-01-02", shieldMonth: now.slice(0, 7), shieldsLeft: 2, briefingSeen: now, lastReview: null },
      exams: { best: { toeic: best }, dim: { toeic: 1 }, spec: {}, policy: "1.0" },
      certBest: {}, room: { trophies: [{ id: "trx", kind: "ach", label: "TOEIC L&R 700", tier: "D", date: "2026-01-02" }] }, role: null,
      lastTick: "2026-01-02", dModel: "1.3",
    };
    const st = await migrateFixture(s21);
    if (!same(st.ui, { bizView: "rates" })) throw new Error("v22 ui: " + JSON.stringify(st.ui));
    const q = (st.tasks || []).find((x) => x.id === "tx");
    if (!same(q, task)) throw new Error("v22 changed the exam task: " + JSON.stringify(q));
    if (!same(st.exams?.best?.toeic, best)) throw new Error("v22 changed exams.best.toeic: " + JSON.stringify(st.exams?.best?.toeic));
    for (const k of ["areas", "tasks", "goals", "events", "folio", "rates", "deals", "journal", "reviews"]) {
      if ((st[k] || []).length !== s21[k].length) throw new Error(`v22 changed the length of ${k}: ${(st[k] || []).length} (planted ${s21[k].length})`);
    }
    if ((st.room?.trophies || []).length !== 1) throw new Error("v22 changed the trophies: " + JSON.stringify(st.room));
    await clickTab("프로필");
    await expectText("TOEIC L&R 700 구간");
  });
  await step("v22 save → v23 meeting records", async () => {
    // Every other top-level key must come back exactly as planted; only v and the daily-tick stamp may move.
    const now = await page.evaluate(() => { const d = new Date(); const p2 = (n) => String(n).padStart(2, "0"); return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`; });
    const s22 = {
      v: 22,
      profile: { name: "v22 사용자", nick: "v22세이브", birth: "1996-03-02", email: "", phone: "", gender: "남성", status: "직장인 1~3년",
        edus: [{ id: "ey1", school: "레거시대학교", degree: "ba", status: "grad" }], careers: [],
        edu: "ba", career: "y13", certs: [], examsOwned: [], directions: [], look: { skin: 0, hair: 0, hairColor: 0, outfit: 0, face: 0 }, startDate: "2026-01-01" },
      areas: [{ id: "ay", name: "커리어", grade: 2, achievements: [] }],
      tasks: [{ id: "ty", title: "레거시 실행", areaId: "ay", diff: "D", type: "daily", status: "todo", doneDates: [] }],
      goals: [],
      events: [{ id: "ey", title: "레거시 회의", kind: "appt", date: "2026-01-05", time: "10:00", createdAt: "2026-01-02" }],
      folio: [], rates: [], deals: [],
      journal: [{ id: "jy", date: "2026-01-02", text: "레거시 기록" }],
      reviews: [],
      ui: { bizView: "deals" },
      act: { streak: 1, lastActive: "2026-01-02", shieldMonth: now.slice(0, 7), shieldsLeft: 2, briefingSeen: now, lastReview: null },
      exams: { best: { toeic: { label: "800", d: 60, p: 720, ver: "1.0", date: "2026-01-02", score: "835" } }, dim: { toeic: 1 }, spec: {}, policy: "1.0" },
      certBest: {}, room: { trophies: [] }, role: null, lastTick: "2026-01-02", dModel: "1.3",
    };
    const st = await migrateFixture(s22);
    if (!same(st.meetingProjects, []) || !same(st.meetings, [])) throw new Error("v23 meeting arrays: " + JSON.stringify({ meetingProjects: st.meetingProjects, meetings: st.meetings }));
    for (const k of Object.keys(s22)) {
      if (k === "v" || k === "lastTick") continue;
      if (!same(st[k], s22[k])) throw new Error(`v23 changed ${k}: ` + JSON.stringify(st[k]));
    }
    const extra = Object.keys(st).filter((k) => !(k in s22) && k !== "meetingProjects" && k !== "meetings");
    if (extra.length) throw new Error("v23 added keys it does not own: " + extra.join(", "));
    await clickTab("미팅");
    await expectText("프로젝트가 없어요 — 프로젝트를 먼저 만들어요.");
  });
  await step("v23 save → v24 meeting task links", async () => {
    // One meeting without taskIds must come back with taskIds: [] and every other field, and every other key, unchanged.
    const now = await page.evaluate(() => { const d = new Date(); const p2 = (n) => String(n).padStart(2, "0"); return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`; });
    const meeting = { id: "mz", projectId: "pz", date: "2026-01-05", title: "레거시 회의록", attendees: "담당자 A",
      summary: "레거시 요약", decisions: "레거시 결정", actions: "레거시 후속", eventId: "ez", createdAt: "2026-01-05" };
    const s23 = {
      v: 23,
      profile: { name: "v23 사용자", nick: "v23세이브", birth: "1996-03-02", email: "", phone: "", gender: "남성", status: "직장인 1~3년",
        edus: [{ id: "ez1", school: "레거시대학교", degree: "ba", status: "grad" }], careers: [],
        edu: "ba", career: "y13", certs: [], examsOwned: [], directions: [], look: { skin: 0, hair: 0, hairColor: 0, outfit: 0, face: 0 }, startDate: "2026-01-01" },
      areas: [{ id: "az", name: "커리어", grade: 2, achievements: [] }],
      tasks: [{ id: "tz", title: "레거시 실행", areaId: "az", diff: "D", type: "daily", status: "todo", doneDates: [] }],
      goals: [],
      events: [{ id: "ez", title: "레거시 회의", kind: "appt", date: "2026-01-05", time: "10:00", createdAt: "2026-01-02" }],
      folio: [], rates: [], deals: [],
      meetingProjects: [{ id: "pz", name: "레거시 프로젝트", createdAt: "2026-01-02" }],
      meetings: [meeting],
      journal: [{ id: "jz", date: "2026-01-02", text: "레거시 기록" }],
      reviews: [],
      ui: { bizView: "deals" },
      act: { streak: 1, lastActive: "2026-01-02", shieldMonth: now.slice(0, 7), shieldsLeft: 2, briefingSeen: now, lastReview: null },
      exams: { best: {}, dim: {}, spec: {}, policy: "1.0" },
      certBest: {}, room: { trophies: [] }, role: null, lastTick: "2026-01-02", dModel: "1.3",
    };
    const st = await migrateFixture(s23);
    if ((st.meetings || []).length !== 1) throw new Error("v24 meetings: " + JSON.stringify(st.meetings));
    if (!same(st.meetings[0], { ...meeting, taskIds: [] })) throw new Error("v24 meeting record: " + JSON.stringify(st.meetings[0]));
    for (const k of Object.keys(s23)) {
      if (k === "v" || k === "lastTick" || k === "meetings") continue;
      if (!same(st[k], s23[k])) throw new Error(`v24 changed ${k}: ` + JSON.stringify(st[k]));
    }
    const extra = Object.keys(st).filter((k) => !(k in s23));
    if (extra.length) throw new Error("v24 added keys it does not own: " + extra.join(", "));
    await clickTab("미팅");
    await expectText("레거시 회의록");
  });
  await shot("migrated");
};
