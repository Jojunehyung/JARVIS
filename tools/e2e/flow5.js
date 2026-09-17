// Daily assistant — due dates, the `할 일` list's time-ordered groups, the briefing, the daily reader and the journal.
// The briefing is opened from the `할 일` header since 2026-09-15 and from the daily reader since v27, which took over
// the once-a-day auto-open; the journal, the weekly review and the assistant bridge are reached through the briefing.
// The assistant bridge and the weekly review are appended in phase C.
module.exports = async (h) => {
  const { step, clickText, clickInModal, clickInModalExact, clickTab, hasText, expectText, todoRows, typeInto, setValue, openTaskModalFor, closeModal, sleep, page, errors } = h;
  const readState = () => page.evaluate(() => { try { return JSON.parse(localStorage.getItem("liferpg-state-v1")); } catch { return null; } });
  const patchAct = (patch) => page.evaluate((p) => {
    const s = JSON.parse(localStorage.getItem("liferpg-state-v1"));
    Object.assign(s.act, p);
    localStorage.setItem("liferpg-state-v1", JSON.stringify(s));
  }, patch);
  // Switch to a tab and tap one of its buttons — the whole file opens screens this way.
  const openFrom = async (tab, label, ms = 400) => {
    await clickTab(tab);
    await clickText(label);
    await sleep(ms);
  };
  // Open the briefing from the `할 일` header and tap one of its lines or buttons — the only manual way into the
  // journal and the weekly review once the daily auto-open has been dismissed.
  const fromBriefing = async (label) => {
    await openFrom("할 일", "브리핑 열기");
    await clickInModal(label);
  };

  // Dates are computed in the page with the app's own local-date logic (never toISOString).
  const dstrIn = (delta) => page.evaluate((d) => {
    const t = new Date(); t.setHours(12, 0, 0, 0); t.setDate(t.getDate() + d);
    const p = (n) => String(n).padStart(2, "0");
    return `${t.getFullYear()}-${p(t.getMonth() + 1)}-${p(t.getDate())}`;
  }, delta);

  // A goal takes activity tasks only, so both dated fixtures declare their kind through the title (detectKind).
  const addDatedTask = async (title, delta) => {
    await openTaskModalFor("하네스 설계 엔지니어 취업");
    await typeInto("무엇을 하나요", title);
    await clickInModalExact("오늘 1회");
    await setValue('.fixed.inset-0 input[type="date"]', await dstrIn(delta));
    await clickInModalExact("등록");
    await sleep(600); await closeModal();
  };

  await step("once task with a due date", async () => {
    await addDatedTask("저녁 요가 30분", 3);
    await clickTab("할 일");
    await expectText("D-3");
  });

  // `기한 지남` is a group label, a counts word and a chip, so the assertion is structural: the row has to sit
  // inside the group of that name, not merely somewhere on the screen.
  await step("overdue task shows as past due", async () => {
    await addDatedTask("밀린 독서 30분", -1);
    await clickTab("할 일");
    const overdue = await todoRows("기한 지남");
    if (!overdue) throw new Error("the overdue group is missing from the list");
    if (!overdue.some((r) => r.title.includes("밀린 독서 30분"))) {
      throw new Error("the overdue task is not in the overdue group: " + overdue.map((r) => r.title).join(" | "));
    }
  });

  await step("the tasks tab keeps the D-3 item in a later group", async () => {
    await clickTab("할 일");
    const all = (await todoRows()) || [];
    const hit = all.filter((r) => r.title.includes("저녁 요가 30분"));
    if (!hit.length) throw new Error("the dated task is not listed: " + all.map((r) => `${r.group}/${r.title}`).join(" | "));
    if (hit.some((r) => r.group === "기한 지남")) throw new Error("a task due in three days is listed as overdue");
  });

  // The list leads with what is already late: the overdue group comes first and holds the overdue task. The
  // three-day item staying out of that group is asserted by the step above.
  await step("the tasks tab leads with the overdue group", async () => {
    await clickTab("할 일");
    const rows = (await todoRows()) || [];
    if (rows[0]?.group !== "기한 지남" || !rows[0].title.includes("밀린 독서 30분")) {
      throw new Error("the first row is not the overdue task in the overdue group: " + rows.map((r) => `${r.group}/${r.title}`).join(" | "));
    }
  });

  await step("the tasks tab opens the briefing and stamps it seen", async () => {
    await clickTab("할 일");
    await clickText("브리핑 열기");
    await sleep(400);
    await expectText("오늘 브리핑 —");
    await expectText("목표 페이스");
    await expectText("기한 지남");
    await closeModal();
    await sleep(400);
    const st = await readState();
    const today = await dstrIn(0);
    if (st.act.briefingSeen !== today) throw new Error("briefingSeen not stamped: " + st.act.briefingSeen);
  });

  // Since v27 the first load of a day opens the daily reader, not the briefing; the briefing is one tap away from it.
  const READER_SECTIONS = (since) => ["오늘·내일 회의 준비", "오늘 업무", "기한 지난 후속 · 내 담당 미완료 후속", "최근 7일 결정 사항",
    `${since} 이후 새로 들어온 것`, "계약·입금 미확인", "뒤처진 목표 페이스", "브리핑 ›"];

  await step("a new day opens the reader on load with every section, and closing it stamps the day", async () => {
    const yesterday = await dstrIn(-1), today = await dstrIn(0);
    await patchAct({ briefingSeen: yesterday });
    await h.reload({}, { keepModal: true });
    await sleep(700);
    if (!(await hasText("오늘 읽을 것 —"))) throw new Error("the reader did not open on a new day");
    if (await hasText("오늘 브리핑 —")) throw new Error("the briefing opened on its own on a new day");
    const txt = await h.overlayText();
    if (!txt.startsWith(`오늘 읽을 것 — ${today}`)) throw new Error("the reader title: " + txt.slice(0, 60));
    let at = -1;
    for (const t of READER_SECTIONS(yesterday)) {
      const i = txt.indexOf(t, at + 1);
      if (i < 0) throw new Error(`the reader lacks "${t}" after position ${at}: ` + txt.slice(0, 400));
      at = i;
    }
    const inputs = await page.evaluate(() => [...document.querySelectorAll(".fixed.inset-0")].pop().querySelectorAll('input[type="checkbox"]').length);
    if (inputs) throw new Error(`the reader renders ${inputs} checkbox(es)`);
    await closeModal();
    await sleep(400);
    const st = await readState();
    if (st.act.briefingSeen !== today) throw new Error("closing the reader did not stamp the day: " + st.act.briefingSeen);
  });

  await step("the same day does not reopen it", async () => {
    await h.reload({}, { keepModal: true });
    await sleep(700);
    const open = await page.evaluate(() => document.querySelectorAll(".fixed.inset-0").length);
    const titles = [await hasText("오늘 읽을 것 —"), await hasText("오늘 브리핑 —")];
    if (open || titles.some(Boolean)) { await closeModal(); throw new Error(`a screen reopened on the same day (overlays ${open}, reader ${titles[0]}, briefing ${titles[1]})`); }
  });

  await step("streak line states the risk", async () => {
    await patchAct({ briefingSeen: await dstrIn(-1), lastActive: await dstrIn(-1), streak: 3 });
    await h.reload({}, { keepModal: true });
    await sleep(700);
    await clickInModalExact("브리핑 ›");
    await expectText("연속 3일이 끊겨요");
    await closeModal();
  });

  await step("the reader opens from the profile card and from the briefing, and the briefing no longer opens on its own", async () => {
    await clickTab("프로필");
    await clickText("오늘 읽을 것");
    await sleep(400);
    await expectText("오늘 읽을 것 —");
    await clickInModalExact("브리핑 ›");
    await expectText("오늘 브리핑 —");
    await clickInModalExact("오늘 읽을 것 ›");
    await expectText("오늘 읽을 것 —");
    const tapped = await page.evaluate(() => {
      const b = [...document.querySelectorAll(".fixed.inset-0")].pop()?.querySelector('button[aria-label="계약·입금 미확인 열기"]');
      if (!b) return false;
      b.click(); return true;
    });
    if (!tapped) throw new Error("the reader has no open button for its business section");
    await sleep(400);
    const res = await page.evaluate(() => ({
      open: document.querySelectorAll(".fixed.inset-0").length,
      tab: [...document.querySelectorAll("nav button")].filter((b) => /text-cyan-300/.test(b.className)).map((b) => (b.innerText || "").trim()).join("·"),
    }));
    if (res.open) throw new Error(`${res.open} overlay(s) left after the section button`);
    if (res.tab !== "사업") throw new Error("the business section button landed on: " + (res.tab || "none"));
    await patchAct({ briefingSeen: await dstrIn(-1) });
    await h.reload({}, { keepModal: true });
    await sleep(700);
    if (!(await hasText("오늘 읽을 것 —")) || (await hasText("오늘 브리핑 —"))) throw new Error("the new-day load did not open the reader alone");
    await closeModal();
  });

  await step("journal persists across a reload", async () => {
    await fromBriefing("일지 쓰기");
    await typeInto("오늘 한 일", "E2E 일지 — CATIA 1시간");
    await clickInModalExact("저장");
    await sleep(600);
    await h.reload();
    await fromBriefing("일지 쓰기");
    const val = await page.evaluate(() => document.querySelector(".fixed.inset-0 textarea")?.value || "");
    if (!val.includes("E2E 일지")) throw new Error("journal text lost: " + val);
    await closeModal();
  });

  await step("packet carries the goals, tasks and journal", async () => {
    await openFrom("할 일", "브리핑 열기");
    await clickInModal("AI에게 보내기");
    await sleep(400);
    const txt = await page.evaluate(() => document.querySelector(".fixed.inset-0 textarea")?.value || "");
    for (const t of ["[인생 관리", "하네스 설계 엔지니어 취업", "E2E 일지"]) {
      if (!txt.includes(t)) throw new Error(`packet missing "${t}" (${txt.length} chars)`);
    }
    if (txt.length > 4000) errors.push("packet longer than the 4000-char cap: " + txt.length);
    await clickInModalExact("복사");
    await sleep(400);
  });

  await step("pasted reply is validated before import", async () => {
    await clickInModal("AI 답변 붙여넣기");
    await sleep(400);
    const due = await dstrIn(2);
    const reply = [
      "오늘 점검 요약: 기한 지난 실행 1건.",
      "```json",
      JSON.stringify({ tasks: [
        { goal: "하네스 설계 엔지니어 취업", title: "기술 서적 30분 독서", diff: "D", type: "once", due },
        { goal: "없는 목표", title: "아침 러닝 30분", diff: "E", type: "daily" },
        { goal: "하네스 설계 엔지니어 취업", title: "전기기사 취득", diff: "C", type: "once" },
        { goal: "하네스 설계 엔지니어 취업", title: "도면 기호 복습", diff: "D", type: "once" },
        // A business errand the reply labels as reading — last of the five, since IMPORT_MAX drops a sixth.
        { goal: "하네스 설계 엔지니어 취업", title: "견적서 송부", kind: "book" },
      ], note: "기한 지난 실행부터 처리해요." }),
      "```",
    ].join("\n");
    await setValue(".fixed.inset-0 textarea", reply);
    await clickInModalExact("답변 확인");
    await sleep(500);
    await expectText("기술 서적 30분 독서");
    await expectText("목표 선택");
    await expectText("자격·시험 실행은");
    await expectText("활동 유형 없는 실행은");
    // The refusal reason is already on screen for another row, so the errand is read on its own row: the kind
    // the reply declared is ignored, the row states why, and its checkbox cannot be ticked.
    const errand = await page.evaluate(() => {
      const label = [...document.querySelectorAll(".fixed.inset-0 span")].find((s) => s.textContent.trim() === "견적서 송부")?.closest("label");
      if (!label) return null;
      const box = label.querySelector('input[type="checkbox"]');
      return { text: label.innerText.replace(/\s+/g, " ").trim(), disabled: !!box?.disabled };
    });
    if (!errand) throw new Error("the proposal row for the errand titled with no activity is missing");
    if (!errand.text.includes("활동 유형 없는 실행은 일정 탭에서 관리해요")) throw new Error("a reply-declared kind overrode the title check: " + errand.text);
    if (!errand.disabled) throw new Error("the refused row can still be picked: " + errand.text);
  });

  await step("confirmed proposals become tasks; cert proposal is refused", async () => {
    const before = await readState();
    const certBefore = before.tasks.filter((q) => q.title === "전기기사 취득").length;
    await page.evaluate(() => {
      const sel = document.querySelector(".fixed.inset-0 select");
      const goal = [...sel.options].find((o) => o.text.includes("하네스"));
      const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value").set;
      setter.call(sel, goal.value);
      sel.dispatchEvent(new Event("change", { bubbles: true }));
    });
    await sleep(300);
    await page.evaluate(() => [...document.querySelectorAll('.fixed.inset-0 input[type="checkbox"]')].forEach((c) => { if (!c.disabled && !c.checked) c.click(); }));
    await sleep(200);
    await clickInModal("선택한 실행 등록");
    await sleep(800);
    const st = await readState();
    const titles = st.tasks.map((q) => q.title);
    if (!titles.includes("기술 서적 30분 독서")) throw new Error("matched proposal not imported");
    if (!titles.includes("아침 러닝 30분")) throw new Error("goal-picked proposal not imported");
    if (st.tasks.filter((q) => q.title === "전기기사 취득").length !== certBefore) throw new Error("certification proposal was imported");
    if (titles.includes("도면 기호 복습")) throw new Error("kind-less proposal was imported");
    if (titles.includes("견적서 송부")) throw new Error("a proposal whose declared kind its title does not carry was imported");
    const imported = st.tasks.find((q) => q.title === "기술 서적 30분 독서");
    if (imported.isCert || imported.isExam || imported.isStudy) throw new Error("imported task carries a milestone flag");
    if (!imported.goalId) throw new Error("imported task has no goalId");
    const today = await dstrIn(0);
    if (!(st.journal.find((e) => e.date === today)?.ai || "").includes("기술 서적 30분 독서")) throw new Error("reply not stored on the journal entry");
  });

  await step("a reply without a JSON block is stored as text only", async () => {
    await openFrom("할 일", "브리핑 열기");
    await clickInModal("AI 답변 붙여넣기"); await sleep(400);
    await setValue(".fixed.inset-0 textarea", "오늘은 기한 지난 실행부터 처리해요. 제안할 실행은 없어요.");
    await clickInModalExact("답변 확인");
    await sleep(400);
    await expectText("제안 실행 없음");
    await clickInModal("선택한 실행 등록");
    await sleep(600);
    const st = await readState();
    const today = await dstrIn(0);
    if (!(st.journal.find((e) => e.date === today)?.ai || "").includes("제안할 실행은 없어요")) throw new Error("plain reply not stored");
  });

  await step("weekly review saves and stamps its date", async () => {
    await fromBriefing("이번 주 리뷰");
    await typeInto("잘된 것", "운동 3회 · 영어 스터디 2회");
    await typeInto("막힌 것", "CATIA 연습 2일 누락");
    await clickInModalExact("리뷰 저장");
    await sleep(600);
    const st = await readState();
    const today = await dstrIn(0);
    if (!st.reviews?.length) throw new Error("review not saved");
    if (st.act.lastReview !== today) throw new Error("lastReview not stamped: " + st.act.lastReview);
    await fromBriefing("이번 주 리뷰 완료"); await sleep(400);
    if (await hasText("저장하고 지표 체크인")) throw new Error("review still offers the removed check-in");
    await closeModal();
  });

  await step("briefing reflects the saved review", async () => {
    await openFrom("할 일", "브리핑 열기");
    await expectText("이번 주 리뷰 완료");
    await closeModal();
  });

  /* v28 — the weekly review's per-track facts and the `주간 회고` packet. The first step replaces the lists the facts read
     with a plant of this week (and drops this week's review, so the bridge starts disabled); the second restores the
     stashed save in `finally`. */
  const REVIEW_KEYS = ["meetingProjects", "meetings", "work", "timeLog", "milestones", "leads", "reviews", "settings"];
  let reviewStash = null;
  const mondayIn = (weeks) => page.evaluate((w) => {
    const t = new Date(); t.setHours(12, 0, 0, 0); t.setDate(t.getDate() - ((t.getDay() + 6) % 7) + 7 * w);
    const p = (n) => String(n).padStart(2, "0");
    return `${t.getFullYear()}-${p(t.getMonth() + 1)}-${p(t.getDate())}`;
  }, weeks);
  const bridgeButton = () => page.evaluate(() => {
    const ov = [...document.querySelectorAll(".fixed.inset-0")].pop();
    const b = ov && [...ov.querySelectorAll("button")].find((x) => (x.innerText || "").trim() === "AI에게 회고 묻기 ›");
    return b ? { disabled: b.disabled } : null;
  });

  await step("the review states per-track facts", async () => {
    const st = await readState();
    reviewStash = Object.fromEntries(REVIEW_KEYS.map((k) => [k, st[k]]));
    const today = await dstrIn(0);
    const week = await mondayIn(0);
    const sunday = await page.evaluate((m) => { const t = new Date(m + "T12:00:00"); t.setDate(t.getDate() + 6); const p = (n) => String(n).padStart(2, "0"); return `${t.getFullYear()}-${p(t.getMonth() + 1)}-${p(t.getDate())}`; }, week);
    await page.evaluate((k, d) => {
      const s = JSON.parse(localStorage.getItem(k));
      s.meetingProjects = [{ id: "rv-biz", name: "E2E회고사업프로젝트", track: "biz", createdAt: d.today }];
      s.meetings = [{ id: "rv-m1", projectId: "rv-biz", date: d.today, title: "E2E회고사업회의", summary: "E2E회고요약", taskIds: [], progress: [], aiHidden: false, createdAt: d.today,
        followUps: [{ id: "rv-f1", text: "E2E끝난후속", mine: true, due: d.week, done: true }, { id: "rv-f2", text: "E2E열린후속", mine: true, due: d.sunday, done: false }] }];
      s.work = [
        { id: "rv-w1", date: d.today, title: "E2E회고완료업무", done: true, minutes: 60, source: "manual", track: "biz", createdAt: d.today },
        { id: "rv-w2", date: d.today, title: "E2E회고열린업무", done: false, source: "manual", track: "biz", createdAt: d.today },
        { id: "rv-w3", date: d.today, title: "E2E직장비밀업무", done: true, source: "manual", track: "work", createdAt: d.today },
      ];
      s.timeLog = [{ id: "rv-t1", date: d.today, track: "biz", minutes: 60, workId: "rv-w1", createdAt: d.today }];
      s.milestones = [{ id: "rv-ms", title: "E2E회고마일스톤", status: "done", doneAt: d.today, dealIds: [], documentIds: [], workIds: [], createdAt: d.today }];
      s.leads = [{ id: "rv-l1", name: "E2E회고병원", stage: "contact", stageAt: d.today, createdAt: d.today }];
      s.reviews = (s.reviews || []).filter((r) => r.weekOf !== d.week);
      s.settings = { ...(s.settings || {}), bizHoursPerWeek: 20 };
      localStorage.setItem(k, JSON.stringify(s));
    }, "liferpg-state-v1", { today, week, sunday });
    await h.reload();
    await fromBriefing("이번 주 리뷰");
    await sleep(400);
    for (const line of [
      "직장 · 이번 주 기한 후속 0/0 · 업무 완료 1건 · 0h",
      "사업 · 이번 주 기한 후속 1/2 · 업무 완료 1건 · 1h/20h · 마일스톤 완료 1건 · 리드 진전 1건",
      "개인 · 업무 완료 0건 · 0h",
    ]) {
      if (!(await h.overlayText()).includes(line)) throw new Error(`the review does not state "${line}": ` + (await h.overlayText()).slice(0, 300));
    }
    const before = await bridgeButton();
    if (!before || !before.disabled) throw new Error("the review bridge button is not disabled before this week's review is saved: " + JSON.stringify(before));
    await expectText("먼저 리뷰를 저장해요 — 저장된 리뷰가 패킷에 실려요.");
    await typeInto("잘된 것", "E2E회고잘된것 견적 2건");
    await typeInto("막힌 것", "E2E회고막힌것 승인 대기");
    await clickInModalExact("리뷰 저장");
    await sleep(600);
    await fromBriefing("이번 주 리뷰");
    await sleep(400);
    const after = await bridgeButton();
    if (!after || after.disabled) throw new Error("the review bridge button is not enabled once the review is saved: " + JSON.stringify(after));
    if (await hasText("먼저 리뷰를 저장해요")) throw new Error("the not-saved caption is still shown");
  });

  await step("the review packet carries the business week and the saved review, and its reply registers next Monday's business work items through the work path", async () => {
    try {
      if (!reviewStash) throw new Error("the previous step did not plant the week");
      if (!(await bridgeButton())) await fromBriefing("이번 주 리뷰");
      await clickInModalExact("AI에게 회고 묻기 ›");
      await sleep(500);
      if (!(await h.overlayText()).startsWith("주간 회고 — AI에게 묻기")) throw new Error("the review bridge title: " + (await h.overlayText()).slice(0, 60));
      const packet = await page.evaluate(() => { const ov = [...document.querySelectorAll(".fixed.inset-0")].pop(); const t = ov && ov.querySelector("textarea"); return t ? t.value : ""; });
      const st = await readState();
      for (const part of ["[인생 관리 — 주간 회고 요청 ", "## 이번 주 사실 (사업)", "## 로드맵", "## 파이프라인", "## 이번 주 리뷰", "E2E회고잘된것 견적 2건", "E2E회고열린업무", "E2E열린후속"]) {
        if (!packet.includes(part)) throw new Error(`the review packet lacks "${part}"`);
      }
      for (const part of ["E2E직장비밀업무", "## 이력", st.profile.name, "E2E회고요약"]) {
        if (part && packet.includes(part)) throw new Error(`the review packet carries "${part}"`);
      }
      if (packet.length > 20000) throw new Error(`the review packet is ${packet.length} chars`);
      await clickInModalExact("AI 답변 붙여넣기 ›");
      await setValue(".fixed.inset-0 textarea", "이번 주 회고 5줄\n```json\n{\"work\":[{\"title\":\"E2E 다음 주 업무\",\"note\":\"근거 한 줄\"}],\"tasks\":[{\"goal\":\"하네스 설계 엔지니어 취업\",\"title\":\"독서 30분\",\"diff\":\"E\",\"type\":\"once\"}]}\n```");
      await clickInModalExact("답변 확인");
      await expectText("제안 업무 확인 — 1건");
      const before = await readState();
      const nextMonday = await mondayIn(1);
      await clickInModalExact("선택한 업무 등록");
      await expectText(`AI 제안 업무 1건 등록 · ${nextMonday}`);
      await sleep(400);
      const after = await readState();
      const item = (after.work || []).find((w) => w.title === "E2E 다음 주 업무");
      if (!item) throw new Error("the proposal was not registered");
      if (item.date !== nextMonday || item.track !== "biz" || item.source !== "ai" || item.done !== false) throw new Error("the registered item: " + JSON.stringify(item));
      for (const k of ["tasks", "journal", "reviews"]) {
        if (JSON.stringify(after[k]) !== JSON.stringify(before[k])) throw new Error(`registering the proposal changed ${k}`);
      }
    } finally {
      await closeModal();
      if (reviewStash) {
        await page.evaluate((k, stash) => {
          const s = JSON.parse(localStorage.getItem(k));
          for (const [key, v] of Object.entries(stash)) { if (v === undefined) delete s[key]; else s[key] = v; }
          localStorage.setItem(k, JSON.stringify(s));
        }, "liferpg-state-v1", reviewStash);
        await h.reload();
      }
    }
  });

  await step("the completed archive states its date and completes nothing", async () => {
    // A daily task finished on an earlier day is finished, not open. Its row leads with the completion date and its
    // sheet offers no completion control — otherwise a list titled `완료` would double as a second completion surface.
    const yesterday = await dstrIn(-1);
    const title = await page.evaluate((y) => {
      const k = "liferpg-state-v1";
      const s = JSON.parse(localStorage.getItem(k));
      const q = (s.tasks || []).find((x) => x.type === "daily");
      if (!q) return null;
      q.doneDates = [y];
      localStorage.setItem(k, JSON.stringify(s));
      return q.title;
    }, yesterday);
    if (!title) throw new Error("no daily task to archive");
    await h.reload();
    await clickTab("할 일");
    await h.clickExact("완료");
    await sleep(400);
    const before = await readState();
    // The count line states the real total: every task with a completion plus every ticked event occurrence.
    const total = (before.tasks || []).filter((q) => (q.type === "daily" ? (q.doneDates || []).length : q.status === "done")).length
      + (before.events || []).reduce((n, e) => n + (e.doneDates || []).length, 0);
    const countLine = await page.evaluate(() => [...document.querySelectorAll("main p")]
      .map((p) => (p.innerText || "").trim()).find((t) => /^완료 \d+건 · 최근 \d+건$/.test(t)) || "");
    if (countLine !== `완료 ${total}건 · 최근 ${Math.min(total, 40)}건`) throw new Error(`the archive count line is "${countLine}", expected ${total} in total`);
    const seen = await page.evaluate((t) => {
      // The archive is the one section in `main` led by the `완료 {n}건 · 최근 {n}건` count line.
      const sec = [...document.querySelectorAll("main section")].find((x) => /^완료 \d+건 · 최근 \d+건/.test((x.innerText || "").trim()));
      const node = sec && [...sec.querySelectorAll(".text-sm.font-semibold")].find((n) => (n.innerText || "").trim() === t);
      const row = node && node.closest("button");
      if (!row) return null;
      const lead = row.querySelector("span.font-mono");
      const out = { text: (row.innerText || "").replace(/\s+/g, " ").trim(), lead: lead ? lead.innerText.trim() : "", controls: row.querySelectorAll("button,input").length };
      row.scrollIntoView({ block: "center" });
      row.click();
      return out;
    }, title);
    if (!seen) throw new Error("the archive does not list the task completed yesterday: " + title);
    if (seen.lead !== yesterday.slice(5)) throw new Error(`the archive row leads with "${seen.lead}", expected ${yesterday.slice(5)}: ` + seen.text);
    if (seen.controls) throw new Error(`the archive row carries ${seen.controls} inner control(s)`);
    await sleep(500);
    const sheet = await h.overlayText();
    if (!sheet.includes("매일 · 완료 1회")) throw new Error("the archive sheet does not state the completion count: " + sheet.slice(0, 300));
    const live = await page.evaluate(() => {
      const ov = [...document.querySelectorAll(".fixed.inset-0")].pop();
      return !!ov && [...ov.querySelectorAll("button")].some((b) => (b.innerText || "").trim() === "완료하기");
    });
    if (live) throw new Error("the archive sheet offers the completion button — it can complete the task");
    await closeModal();
    await sleep(300);
    const after = await readState();
    const q = (after.tasks || []).find((x) => x.title === title);
    if ((q.doneDates || []).join() !== yesterday) throw new Error("the archive changed the completion record: " + JSON.stringify(q.doneDates));
    if (after.act.streak !== before.act.streak) throw new Error("the archive moved the streak");
  });
};
