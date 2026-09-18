// Remaining paths — exam KR and score report, exercise activity, the activity-kind gate, profile photo, direction advice, role-model stages and their editor, task and goal deletion, streak after a day gap
module.exports = async (h) => {
  const { step, shot, clickText, clickInModal, clickInModalExact, assertDone, modalError, clickTab, hasText, expectText, typeInto, typeExact, completeQuest, closeModal, sleep, page, errors, attach, openTaskModalFor, addKindTask, submitPhotoEvidence, logActivity, openTodo } = h;
  // ── Profile photo upload (resizeImage path). The picker lives in the profile modal now, but the file input
  // it drives is mounted on the app shell — so `attach` finds it through its unscoped fallback, and the modal
  // closing mid-pick cannot take the input with it.
  await step("profile photo upload through the profile modal", async () => {
    await clickTab("프로필");
    await clickText("프로필 편집"); await sleep(400);
    if (await page.$('.fixed.inset-0 input[type="file"]')) throw new Error("the profile modal declared a file input of its own");
    await clickInModal("사진 등록");
    await attach();
    await sleep(500);
    const stored = await page.evaluate(() => (localStorage.getItem("liferpg-img-profile") || "").length);
    if (!stored) throw new Error("the profile photo key was not written");
    await expectText("사진 삭제");
    await closeModal();
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
  const readState = () => page.evaluate(() => { try { return JSON.parse(localStorage.getItem("liferpg-state-v1")); } catch { return null; } });
  // Dates are computed in the page with the app's own local-date logic (never toISOString).
  const dstrIn = (delta) => page.evaluate((d) => {
    const t = new Date(); t.setHours(12, 0, 0, 0); t.setDate(t.getDate() + d);
    const p = (n) => String(n).padStart(2, "0");
    return `${t.getFullYear()}-${p(t.getMonth() + 1)}-${p(t.getDate())}`;
  }, delta);
  // The exact score is an extra requirement on the score report (schema v22): each refusal happens before anything is
  // written, so the task stays open and no evidence image key appears.
  await step("the score report needs a score inside the band", async () => {
    await clickTab("할 일");
    await completeQuest("TOEIC");
    await sleep(400);
    await attach();
    const task = ((await readState())?.tasks || []).find((q) => q.isExam && q.famId === "toeic" && q.status !== "done");
    if (!task) throw new Error("no open TOEIC milestone in the save");
    const cases = [
      [null, (e) => e === "성적표에 적힌 점수를 입력해 주세요."],
      ["abc", (e) => e === "점수는 숫자로 입력해 주세요."],
      ["790", (e) => e.includes("800 구간 미만 점수예요")],
      ["1000", (e) => e === "TOEIC L&R 최고 점수는 990예요."],
    ];
    for (const [value, ok] of cases) {
      if (value != null) await typeInto("성적표에 적힌", value);
      await clickInModal("제출하고 완료");
      const e = await modalError();
      if (!ok(e)) throw new Error(`score ${JSON.stringify(value)} gave the modal error: ${e || "none"}`);
      const q = ((await readState())?.tasks || []).find((x) => x.id === task.id);
      if (!q || q.status === "done") throw new Error(`score ${JSON.stringify(value)} completed the milestone`);
      if (await page.evaluate((k) => localStorage.getItem(k) != null, `liferpg-img-ev-${task.id}`)) throw new Error(`score ${JSON.stringify(value)} left an evidence image key behind`);
    }
    await closeModal();
  });
  await step("submit score report photo (exam payout)", async () => { await submitPhotoEvidence("TOEIC", { score: "835" }); });
  await shot("exam-done");
  await step("the exact score is stored beside an unchanged band", async () => {
    const st = await readState();
    const q = (st?.tasks || []).find((x) => x.isExam && x.famId === "toeic" && x.status === "done");
    if (!q) throw new Error("no completed TOEIC milestone in the save");
    if (q.score !== "835" || q.band?.label !== "800") throw new Error("task score or band: " + JSON.stringify({ score: q.score, band: q.band }));
    const b = st.exams?.best?.toeic || {};
    if (b.score !== "835" || b.label !== "800" || b.p !== 720 || b.d !== 60) throw new Error("exams.best.toeic: " + JSON.stringify(b));
    const area = (st.areas || []).find((a) => a.id === q.areaId);
    const last = (area?.achievements || []).slice(-1)[0];
    if (!last || !last.text.startsWith("TOEIC L&R 800 — D60")) throw new Error("the newest achievement text: " + JSON.stringify(last));
    await clickTab("프로필");
    const cv = await page.evaluate(() => (document.querySelector("main section")?.innerText || "").replace(/\s+/g, " "));
    if (!cv.includes("TOEIC L&R 835")) throw new Error("the CV does not state the exact score: " + cv.slice(0, 240));
    if (cv.includes("D60")) throw new Error("the CV prints the band's difficulty figure: " + cv.slice(0, 240));
  });
  // Same band again with a higher score: the band snapshot, D, P, date and the locked decay stay; only the shown score moves.
  await step("a same-band retake updates only the shown score", async () => {
    const before = await readState();
    const done = (before.tasks || []).find((x) => x.isExam && x.famId === "toeic" && x.status === "done");
    if (!done) throw new Error("no completed TOEIC milestone to copy");
    const bestBefore = before.exams?.best?.toeic;
    const dimBefore = before.exams?.dim?.toeic;
    const today = await page.evaluate(() => { const d = new Date(); const p = (n) => String(n).padStart(2, "0"); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`; });
    await page.evaluate((t) => {
      const st = JSON.parse(localStorage.getItem("liferpg-state-v1"));
      st.tasks = [{ id: "tretake", title: "TOEIC L&R 800 재응시", isExam: true, famId: "toeic", band: t.band, goalId: t.goalId, areaId: t.areaId,
        diff: "B", pts: 720, type: "once", status: "todo", doneDates: [], createdAt: t.today }, ...st.tasks];
      localStorage.setItem("liferpg-state-v1", JSON.stringify(st));
    }, { band: done.band, goalId: done.goalId, areaId: done.areaId, today });
    await h.reload();
    await submitPhotoEvidence("800 재응시", { score: "870" });
    const st = await readState();
    const b = st.exams?.best?.toeic || {};
    const want = { ...bestBefore, score: "870" };
    if (JSON.stringify(Object.keys(b).sort().map((k) => [k, b[k]])) !== JSON.stringify(Object.keys(want).sort().map((k) => [k, want[k]]))) {
      throw new Error("exams.best.toeic after the retake: " + JSON.stringify(b) + " expected " + JSON.stringify(want));
    }
    if (st.exams?.dim?.toeic !== dimBefore) throw new Error(`the locked decay moved: ${dimBefore} → ${st.exams?.dim?.toeic}`);
  });

  // ── Exercise activity (weight and skeletal muscle → metric KR)
  await step("register exercise activity task", async () => { await addKindTask("하네스", "운동", "웨이트 40분"); });
  await step("save exercise log (weight, skeletal muscle)", async () => {
    await logActivity("웨이트 40분", async () => {
      try { await typeInto("체중", "72"); } catch {}
      try { await typeInto("골격근량", "33"); } catch {}
    });
  });

  // ── A goal takes an activity kind or nothing: appointment-shaped work belongs to the `일정` tab
  await step("kind-less task under a goal is refused", async () => {
    await openTaskModalFor("하네스");
    await typeInto("무엇을 하나요", "이력서 초안 작성");
    await clickInModalExact("등록");
    await sleep(500);
    const e = await modalError();
    if (!e.includes("활동 유형")) throw new Error("kind-less task was not refused (modal error: " + (e || "none") + ")");
    const made = await page.evaluate(() => {
      try { return JSON.parse(localStorage.getItem("liferpg-state-v1")).tasks.some((q) => q.title === "이력서 초안 작성"); } catch { return null; }
    });
    if (made !== false) throw new Error("refused task reached the state: " + made);
    await closeModal();
  });

  // ── Promotion (evidence chip selection → actual promotion)
  await step("promotion — submit after selecting evidence chips", async () => {
    await clickTab("프로필");
    if (!(await h.openAreaGate())) errors.push("no area row to open the promotion gate");
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

  // ── Direction advice (RoleAdviceModal) → catalogue link. The sheet opens from the proximity line and leads with the
  // per-area bars, whose cell widths are the squared curve `roleGap` averages (rule 14): read off the first bar and
  // compared with the formula and with the save's grade and requirement for that area.
  await step("the proximity line opens direction advice with the squared bars", async () => {
    await clickTab("프로필");
    await clickText("롤모델 근접도"); await sleep(600);
    const sheet = await h.overlayText();
    for (const t of ["방향 제안 —", "/ 요구", "칸 하나 = 등급 한 단계"]) {
      if (!sheet.includes(t)) throw new Error(`direction advice does not state "${t}": ` + sheet.slice(0, 200));
    }
    const bar = await page.evaluate(() => {
      const row = document.querySelector(".fixed.inset-0 div.flex.h-2");
      const s = JSON.parse(localStorage.getItem("liferpg-state-v1"));
      const area = (s.areas || []).find((a) => (s.role?.targets?.[a.id] || 0) > 0);
      if (!row || !area) return { row: !!row, area: !!area };
      const cells = [...row.children];
      return {
        row: true, area: true, have: area.grade, target: s.role.targets[area.id],
        widths: cells.map((c) => parseFloat(c.style.width)),
        cyan: cells.filter((c) => /bg-cyan-400/.test(c.className)).length,
      };
    });
    if (!bar.row) throw new Error("direction advice draws no proximity bar");
    if (!bar.area) throw new Error("the save carries no area with a role-model requirement");
    const need = bar.widths.length;
    if (need !== bar.target) throw new Error(`the first bar has ${need} cells, the save requires grade ${bar.target}`);
    bar.widths.forEach((w, k) => {
      const want = (Math.pow((k + 1) / need, 2) - Math.pow(k / need, 2)) * 100;
      if (!(Math.abs(w - want) <= 0.05)) throw new Error(`cell ${k} is ${w}% wide, the squared curve gives ${want.toFixed(2)}% — widths ${bar.widths.join(", ")}`);
    });
    if (bar.cyan !== Math.min(bar.have, need)) throw new Error(`${bar.cyan} filled cell(s), expected min(grade ${bar.have}, requirement ${need})`);
    try { await clickText("도감에서 더 보기"); await sleep(600); } catch {}
    await closeModal(); await closeModal();
  });

  // ── Role-model stages (v28): a second figure beside proximity, derived from the save's own records and never merged
  // into the percentage (rule 14). The CV button's children are flex items, so its text is read whitespace-normalised.
  const stageLineText = () => page.evaluate(() => {
    const b = [...document.querySelectorAll("main button")].find((x) => /^단계\s*\d+\/\d+/.test((x.innerText || "").trim()));
    return b ? b.innerText.replace(/\s+/g, " ").trim() : null;
  });
  // The condition count and the quit condition live on the button's `title` (`stageLine(rs)`, unchanged since v28); the
  // visible text keeps the stage figure. Read as `{ text, title }` so both can be asserted from one render.
  const stageButton = () => page.evaluate(() => {
    const b = [...document.querySelectorAll("main button")].find((x) => /^단계\s*\d+\/\d+/.test((x.innerText || "").trim()));
    return b ? { text: b.innerText.replace(/\s+/g, " ").trim(), title: b.getAttribute("title") || "" } : null;
  });
  const proximityFigure = () => page.evaluate(() => {
    const b = [...document.querySelectorAll("main button")].find((x) => (x.innerText || "").includes("롤모델 근접도"));
    return b ? ((b.innerText.match(/(\d+)%/) || [])[1] ?? null) : null;
  });
  // Plants the role model and appends the stage fixtures' contracts and portfolio entries; `null` lists remove them.
  const patchSave = (patch) => page.evaluate((p) => {
    const k = "liferpg-state-v1";
    const s = JSON.parse(localStorage.getItem(k));
    if ("role" in p) s.role = p.role;
    for (const key of ["deals", "folio"]) {
      if (!(key in p)) continue;
      const kept = (s[key] || []).filter((x) => !String(x.id).startsWith("e2e-stage-"));
      s[key] = p[key] ? [...(s[key] || []), ...p[key]] : kept;
    }
    localStorage.setItem(k, JSON.stringify(s));
  }, patch);
  await step("the stage line states the current stage, the condition count and the quit condition, and the advice lists the unmet conditions", async () => {
    await clickTab("프로필"); await sleep(300);
    const before = await proximityFigure();
    if (before == null) throw new Error("no proximity figure on the CV before the stages are planted");
    const saved = await page.evaluate(() => {
      const s = JSON.parse(localStorage.getItem("liferpg-state-v1"));
      return { role: s.role, held: (s.profile?.certs || [])[0] || null };
    });
    if (!saved.held) throw new Error("the save holds no declared certification for the cert_held condition");
    try {
      // Stage 1 needs a won contract the save does not have; stage 2 is a held certification (met) plus a portfolio
      // entry (unmet); stage 3 needs a second won contract — so the quit condition starts unmet.
      await patchSave({ role: { ...saved.role, stages: [
        { id: "e2e-st1", name: "E2E 첫 계약", conds: [{ type: "deals_won", arg: "E2E단계고객", min: 1 }] },
        { id: "e2e-st2", name: "E2E 실적", conds: [{ type: "cert_held", arg: saved.held, min: 1 }, { type: "folio_match", arg: "E2E단계포트폴리오", min: 1 }] },
        { id: "e2e-st3", name: "E2E 전환", conds: [{ type: "deals_won", arg: "E2E단계고객", min: 2 }] },
      ] } });
      await h.reload(); await clickTab("프로필"); await sleep(300);
      let sb = await stageButton();
      if (!sb || !sb.text.includes("단계 1/3") || !sb.title.includes("조건 1/4") || !sb.title.includes("전환 조건 미충족 (0/1)")) throw new Error("the planted stages read: " + JSON.stringify(sb));
      if ((await proximityFigure()) !== before) throw new Error(`proximity moved from ${before}% to ${await proximityFigure()}% when stages were planted`);
      await page.evaluate(() => [...document.querySelectorAll("main button")].find((x) => /^단계\s*\d+\/\d+/.test((x.innerText || "").trim())).click());
      await sleep(500);
      const sheet = await h.overlayText();
      for (const t of ["방향 제안 —", "단계", "1/3단계 · E2E 첫 계약", "- 계약 체결 수 'E2E단계고객' 0/1", "로드맵 열기 ›"]) {
        if (!sheet.includes(t)) throw new Error(`direction advice does not state "${t}": ` + sheet.slice(0, 300));
      }
      await closeModal();
      const month = await page.evaluate(() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; });
      const deal = (id) => ({ id, client: "E2E단계고객", title: "단계 확인", status: "won", monthly: 1000000, months: 1, startMonth: month, paidMonths: [], createdAt: `${month}-01`, track: "biz" });
      await patchSave({ deals: [deal("e2e-stage-deal-1")] });
      await h.reload(); await clickTab("프로필"); await sleep(300);
      sb = await stageButton();
      if (!sb || !sb.text.includes("단계 2/3") || !sb.title.includes("조건 2/4") || !sb.title.includes("전환 조건 미충족 (0/1)")) throw new Error("after one won contract the line reads: " + JSON.stringify(sb));
      await patchSave({ deals: [deal("e2e-stage-deal-2")], folio: [{ id: "e2e-stage-folio", title: "E2E단계포트폴리오", summary: "", stack: [], createdAt: `${month}-01` }] });
      await h.reload(); await clickTab("프로필"); await sleep(300);
      sb = await stageButton();
      if (!sb || !sb.text.includes("단계 3/3") || !sb.title.includes("조건 4/4") || !sb.title.includes("전환 조건 충족 (1/1)")) throw new Error("with every condition met the line reads: " + JSON.stringify(sb));
      if ((await proximityFigure()) !== before) throw new Error(`proximity moved from ${before}% to ${await proximityFigure()}% while conditions were met`);
    } finally {
      await patchSave({ role: saved.role, deals: null, folio: null });
      await h.reload();
    }
  });

  await step("the medical-AI preset seeds nine editable stages, the editor saves only role, and removing every stage drops the key", async () => {
    const original = await page.evaluate(() => JSON.parse(localStorage.getItem("liferpg-state-v1")).role);
    if (!original || original.stages) throw new Error("the step expects a role model without stages: " + JSON.stringify(original));
    const stageInputs = () => page.evaluate(() => document.querySelectorAll(".fixed.inset-0 input[aria-label='단계 이름']").length);
    const openEditor = async () => {
      await h.openSettings();
      await clickInModalExact("롤모델 수정"); await sleep(400);
    };
    try {
      // 2026-09-18: a story and an older verdict planted beside the stages must survive the editor's save untouched.
      const old = await dstrIn(-40);
      await patchSave({ role: { ...original, story: "E2E 스토리", verdicts: [{ id: "e2e-v0", date: old, probability: 10, summary: "E2E 이전 판정", basis: "", position: "", gaps: [], stageK: 1, stageN: 9, source: "ai" }] } });
      await h.reload();
      await page.evaluate(() => { window.confirm = () => true; });
      await openEditor();
      await clickInModalExact("의료 AI 솔루션 대표"); await sleep(300);
      if ((await stageInputs()) !== 9) throw new Error(`the preset seeded ${await stageInputs()} stage cards`);
      if (!(await h.overlayText()).includes("9 / 12")) throw new Error("the stage count is not stated as 9 / 12");
      // An empty stage name is refused with its position
      await h.setValue(".fixed.inset-0 input[aria-label='단계 이름']", "", 0);
      await clickInModalExact("저장"); await sleep(300);
      const refusal = await modalError();
      if (!refusal.includes("단계 이름을 입력해 주세요 — 1번째 단계")) throw new Error("an empty stage name was not refused: " + refusal);
      await h.setValue(".fixed.inset-0 input[aria-label='단계 이름']", "E2E 편집 단계", 0);
      await page.evaluate(() => document.querySelectorAll(".fixed.inset-0 button[aria-label='조건 삭제']")[0].click());
      await sleep(200);
      const before = await page.evaluate(() => JSON.parse(localStorage.getItem("liferpg-state-v1")));
      await clickInModalExact("저장"); await sleep(600);
      const after = await page.evaluate(() => JSON.parse(localStorage.getItem("liferpg-state-v1")));
      const r = after.role || {};
      if (!Array.isArray(r.stages) || r.stages.length !== 9) throw new Error("role.stages is not nine stages: " + JSON.stringify(r.stages));
      if (r.stages[0].name !== "E2E 편집 단계") throw new Error("the first stage name was not edited: " + r.stages[0].name);
      if (r.stages[0].conds.length !== 1) throw new Error(`the first stage keeps ${r.stages[0].conds.length} conditions, expected 1 after removing one of 2`);
      if (JSON.stringify(r.targets) !== JSON.stringify(original.targets)) throw new Error("saving the stages changed role.targets");
      if (!Array.isArray(r.verdicts) || r.verdicts.length !== 1 || r.verdicts[0].id !== "e2e-v0") throw new Error("the editor's save did not keep the planted verdict: " + JSON.stringify(r.verdicts));
      if (r.story !== "E2E 스토리") throw new Error("the editor's save did not keep the story: " + JSON.stringify(r.story));
      if (!Number.isFinite(r.seenStageK)) throw new Error("the editor's save did not stamp seenStageK: " + JSON.stringify(r.seenStageK));
      const changed = Object.keys({ ...before, ...after }).filter((k) => k !== "role" && k !== "lastTick" && JSON.stringify(before[k]) !== JSON.stringify(after[k]));
      if (changed.length) throw new Error("saving the role model wrote other keys: " + changed.join(", "));
      try { await closeModal(); } catch {}
      // Remove every stage and restore the name: the saved role carries no stages key
      await openEditor();
      for (let i = 0; i < 9; i++) {
        await page.evaluate(() => document.querySelectorAll(".fixed.inset-0 button[aria-label='단계 삭제']")[0].click());
        await sleep(80);
      }
      if ((await stageInputs()) !== 0) throw new Error("stage cards remain after removing every stage");
      await h.setValue(".fixed.inset-0 input", original.name, 0);
      await clickInModalExact("저장"); await sleep(600);
      const cleared = await page.evaluate(() => JSON.parse(localStorage.getItem("liferpg-state-v1")).role);
      if ("stages" in cleared) throw new Error("a role model without stages still stores a stages key");
      if ("seenStageK" in cleared) throw new Error("a role model without stages still stores the seenStageK stamp");
      if (cleared.name !== original.name || JSON.stringify(cleared.targets) !== JSON.stringify(original.targets)) throw new Error("the restored role model differs: " + JSON.stringify(cleared));
      try { await closeModal(); } catch {}
      if (await stageLineText()) throw new Error("the stage line still renders without stages");
    } finally {
      await patchSave({ role: original });
      await h.reload();
    }
  });

  // ── Role verdict (2026-09-18, the fifth packet): the story is the one free text sent verbatim; the packet states the CV
  // line, the grades, the held records, the record counts and the stages, and never an identifier, a client or a day-job
  // deal. The reply's proposals become stages, requirement grades and a dated verdict only through the user's tick.
  const RANK_NAMES = ["지망생", "견습", "초심자", "실무자", "숙련자", "전문가", "리더", "마스터", "거장", "정점"];
  let verdictStash = null;
  const restoreVerdictPlant = async () => {
    if (!verdictStash) return;
    await page.evaluate((st) => {
      const k = "liferpg-state-v1";
      const s = JSON.parse(localStorage.getItem(k));
      s.role = st.role; s.profile = st.profile; s.deals = st.deals;
      localStorage.setItem(k, JSON.stringify(s));
    }, verdictStash);
    verdictStash = null;
    await h.reload();
  };
  const openVerdictSheet = async () => {
    await clickTab("프로필"); await sleep(300);
    await page.evaluate(() => [...document.querySelectorAll("main button")].find((x) => /^단계\s*\d+\/\d+/.test((x.innerText || "").trim())).click());
    await sleep(500);
    await clickInModalExact("AI에게 판정 묻기 ›"); await sleep(500);
  };
  await step("the role verdict packet carries the story, the CV line, the area grades, the counts and the stages, and no identifier", async () => {
    const st = await readState();
    verdictStash = { role: st.role, profile: st.profile, deals: st.deals };
    const month = (await dstrIn(0)).slice(0, 7);
    const old = await dstrIn(-40);
    await page.evaluate((p) => {
      const k = "liferpg-state-v1";
      const s = JSON.parse(localStorage.getItem(k));
      s.profile = { ...s.profile, email: "e2e-role@example.com", phone: "010-1234-0000",
        edus: [{ ...((s.profile.edus || [])[0] || { id: "e2e-role-edu", degree: "ba", status: "grad", major: "기계공학" }), school: "E2E대학교" }, ...(s.profile.edus || []).slice(1)],
        careers: [{ ...((s.profile.careers || [])[0] || { id: "e2e-role-career", role: "설계 엔지니어", emp: "full", from: "2024-01" }), company: "E2E직장주식회사" }, ...(s.profile.careers || []).slice(1)] };
      s.deals = [...(s.deals || []),
        { id: "e2e-role-deal-biz", client: "E2E고객사", title: "판정 확인", status: "won", monthly: 1000000, months: 1, startMonth: p.month, paidMonths: [], createdAt: `${p.month}-01`, track: "biz" },
        { id: "e2e-role-deal-work", client: "E2E직장고객", title: "E2E-ROLE-WORK-SENTINEL-7c21", status: "won", monthly: 1000000, months: 1, startMonth: p.month, paidMonths: [], createdAt: `${p.month}-01`, track: "work" }];
      s.role = { ...(s.role || { name: "롤모델", targets: {} }), story: "E2E 원하는 모습 — 직원 20명 의료 AI 회사 대표",
        verdicts: [{ id: "e2e-v0", date: p.old, probability: 10, summary: "E2E 이전 판정", basis: "", position: "", gaps: [], stageK: 1, stageN: 9, source: "ai" }],
        stages: [
          { id: "e2e-st1", name: "E2E 첫 계약", conds: [{ type: "deals_won", arg: "E2E단계고객", min: 1 }] },
          { id: "e2e-st2", name: "E2E 실적", conds: [{ type: "cert_held", arg: p.held, min: 1 }, { type: "folio_match", arg: "E2E단계포트폴리오", min: 1 }] },
          { id: "e2e-st3", name: "E2E 전환", conds: [{ type: "deals_won", arg: "E2E단계고객", min: 2 }] },
        ] };
      localStorage.setItem(k, JSON.stringify(s));
    }, { month, old, held: (st.profile.certs || [])[0] || "정보처리기사" });
    await h.reload();
    await openVerdictSheet();
    if (!(await h.overlayText()).startsWith("AI에게 판정 묻기")) throw new Error("the verdict sheet title: " + (await h.overlayText()).slice(0, 60));
    const packet = await page.evaluate(() => { const ov = [...document.querySelectorAll(".fixed.inset-0")].pop(); const t = ov && ov.querySelector("textarea"); return t ? t.value : ""; });
    const saved = await readState();
    // Won deals on a packet track (a deal without a track is business); the day-job sentinel is not one of them.
    const wonBiz = (saved.deals || []).filter((d) => d.status === "won" && (d.track || "biz") !== "work").length;
    if (wonBiz < 1) throw new Error("the planted business deal is missing from the save");
    const must = ["[인생 관리 — 롤모델 판정 요청", "E2E 원하는 모습 — 직원 20명 의료 AI 회사 대표", "## 이력", "## 영역 등급", "## 보유 자격·시험", "## 기록 요약", `계약 체결 ${wonBiz}건`,
      "## 현재 단계", "1단계 E2E 첫 계약", "- 계약 체결 수 'E2E단계고객' 0/1", "조건 종류:", "- cert_held:",
      ...saved.areas.map((a) => `- ${a.name}: ${RANK_NAMES[a.grade]} (${a.grade}/9)`)];
    for (const part of must) if (!packet.includes(part)) throw new Error(`the role packet lacks "${part}" (${packet.length} chars)`);
    const never = [saved.profile.name, saved.profile.birth, "e2e-role@example.com", "010-1234-0000", "E2E대학교", "E2E직장주식회사", "E2E고객사", "E2E-ROLE-WORK-SENTINEL-7c21"];
    for (const part of never) if (part && packet.includes(part)) throw new Error(`the role packet carries "${part}"`);
    if (packet.length > 12000) throw new Error(`the role packet is ${packet.length} chars`);
    await closeModal(); await closeModal();
    // The story travels in the role packet only: the daily packet never states it.
    await clickTab("할 일");
    await clickText("브리핑 열기"); await sleep(400);
    await clickInModal("AI에게 보내기"); await sleep(400);
    const daily = await page.evaluate(() => document.querySelector(".fixed.inset-0 textarea")?.value || "");
    if (daily.includes("E2E 원하는 모습")) throw new Error("the daily packet carries the story");
    await closeModal();
  });

  await step("a pasted verdict reply lists stages with conditions, rejects an unknown condition type and an unknown certificate name, and saving replaces the stages and appends a dated verdict", async () => {
    try {
      if (!verdictStash) throw new Error("the previous step did not plant the story and the stages");
      const before = await readState();
      const today = await dstrIn(0);
      // The first area without a requirement takes grade 5; the earlier stage step proved at least one area is targeted.
      const area = before.areas.find((a) => !(before.role?.targets?.[a.id] > 0)) || before.areas.find((a) => before.role.targets[a.id] !== 5);
      if (!area) throw new Error("no area whose requirement can move to grade 5");
      await openVerdictSheet();
      await clickInModalExact("AI 답변 붙여넣기 ›"); await sleep(300);
      // `정보보안기사` is in the table and not held by this save (the save holds 정보처리기사 and 전기기사), so its row reads 0/1.
      const reply = ["판정 5줄 이내.", "```json", JSON.stringify({
        verdict: { summary: "E2E 판정 요약", probability: 35, basis: "E2E 근거 (추정)", position: "E2E 위치", gaps: ["E2E 부족 1", "E2E 부족 2"] },
        stages: [
          { name: "E2E 제안 단계", why: "E2E 이유", conds: [{ type: "deals_won", arg: "E2E판정고객", min: 2 }, { type: "cert_held", arg: "정보보안기사", min: 1 }] },
          { name: "E2E 나쁜 종류", conds: [{ type: "unknown_type", min: 1 }] },
          { name: "E2E 나쁜 자격", conds: [{ type: "cert_held", arg: "존재하지않는자격증", min: 1 }] },
        ],
        areas: { [area.name]: 5, "없는영역": 3 },
        note: "E2E 노트",
      }), "```"].join("\n");
      await h.setValue(".fixed.inset-0 textarea", reply);
      await clickInModalExact("답변 확인"); await sleep(500);
      const sheet = await h.overlayText();
      for (const t of [`AI 판단 · 검증되지 않음 · ${today}`, "AI 추정 확률 35%", "E2E 판정 요약", "근거: E2E 근거 (추정)", "- E2E 부족 1", "제안 단계 — 3건",
        "- 계약 체결 수 'E2E판정고객' 0/2", "- 보유 자격 '정보보안기사' 0/1", "알 수 없는 조건 종류예요: unknown_type", "자격 표에 없는 이름이에요: 존재하지않는자격증",
        "없는 영역이에요: 없는영역", "저장하면 지금 단계 3개가 선택한 단계로 바뀌어요."]) {
        if (!sheet.includes(t)) throw new Error(`the confirm sheet does not state "${t}": ` + sheet.slice(0, 400));
      }
      await page.evaluate(() => { window.confirm = () => true; });
      await clickInModalExact("선택한 항목 저장"); await sleep(600);
      const after = await readState();
      const r = after.role || {};
      if (!Array.isArray(r.stages) || r.stages.length !== 1 || r.stages[0].name !== "E2E 제안 단계") throw new Error("the ticked stage did not replace the stages: " + JSON.stringify(r.stages));
      if (JSON.stringify(r.stages[0].conds) !== JSON.stringify([{ type: "deals_won", arg: "E2E판정고객", min: 2 }, { type: "cert_held", arg: "정보보안기사", min: 1 }])) throw new Error("the saved conditions differ: " + JSON.stringify(r.stages[0].conds));
      if ("why" in r.stages[0]) throw new Error("the stage's why was stored");
      const v = (r.verdicts || [])[0] || {};
      if (v.date !== today || v.probability !== 35 || v.summary !== "E2E 판정 요약" || (v.gaps || []).length !== 2 || v.stageK !== 1 || v.stageN !== 1 || v.source !== "ai") throw new Error("the verdict record differs: " + JSON.stringify(v));
      if (r.verdicts.length !== 2 || r.verdicts[1].id !== "e2e-v0") throw new Error("the older verdict is not behind the new one: " + JSON.stringify(r.verdicts.map((x) => x.id)));
      if (r.targets[area.id] !== 5) throw new Error("the ticked requirement is not stored: " + JSON.stringify(r.targets));
      if (r.seenStageK !== 1) throw new Error("seenStageK is not the new stage index: " + JSON.stringify(r.seenStageK));
      const changed = Object.keys({ ...before, ...after }).filter((k) => k !== "role" && k !== "lastTick" && JSON.stringify(before[k]) !== JSON.stringify(after[k]));
      if (changed.length) throw new Error("saving the verdict wrote other keys: " + changed.join(", "));
      if ((after.journal || []).length !== (before.journal || []).length) throw new Error("the verdict save wrote a journal entry");
      try { await closeModal(); } catch {}
    } finally {
      await restoreVerdictPlant();
    }
  });

  // ── Task deletion / goal removal
  await step("delete task", async () => {
    await clickTab("할 일");
    await openTodo("설계 실습 1시간");
    await clickInModalExact("삭제");
    await sleep(600);
    const left = await page.evaluate(() => (JSON.parse(localStorage.getItem("liferpg-state-v1")).tasks || []).some((q) => q.title === "설계 실습 1시간"));
    if (left) throw new Error("the deleted task is still stored");
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
