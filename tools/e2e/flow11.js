// Work tab and the meeting progress log (schema v25). A work item is a record, never a task: these steps assert that
// registering, completing, carrying and refusing work items change `work` only — never tasks, goals, streak, shields,
// trophies, events or meetings — that a progress entry grows its own meeting record and nothing else, that the
// per-meeting AI flag is stored as a boolean and stated in the view, and that both travel in the backup file. Runs
// after flow10 and before flow4, which replaces the save. Written 2026-09-17 under the standing instruction that the
// suite is not run: every step parses, none has been executed.
module.exports = async (h) => {
  const { step, clickTab, clickInModalExact, expectText, openTodo, overlayText, openSettings, captureDownload, typeInto,
    setValue, closeModal, modalError, hasText, sleep, page } = h;

  const KEY = "liferpg-state-v1";
  const readState = () => page.evaluate((k) => { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } }, KEY);
  // Dates come from the page with the app's own local-date logic (never toISOString).
  const dstrIn = (delta) => page.evaluate((d) => {
    const t = new Date(); t.setHours(12, 0, 0, 0); t.setDate(t.getDate() + d);
    const pad = (n) => String(n).padStart(2, "0");
    return [t.getFullYear(), pad(t.getMonth() + 1), pad(t.getDate())].join("-");
  }, delta);
  // What a work item or a progress entry must never move: flow8's boundary plus the schedule records, as one string.
  const boundary = (st) => JSON.stringify({ ...h.recordBoundary(st), events: st.events || [] });
  const assertBoundary = (before, after, what) => {
    if (boundary(before) !== boundary(after)) throw new Error(`${what} moved a record it does not own: ${boundary(before).slice(0, 120)} -> ${boundary(after).slice(0, 120)}`);
  };
  // The work tab's counts line, whitespace-normalised.
  const countsLine = () => page.evaluate(() => [...document.querySelectorAll("main p")]
    .map((p) => (p.innerText || "").replace(/\s+/g, " ").trim())
    .find((t) => t.startsWith("남음 ") && t.includes("저장 공간")) || "");
  // Every to-do-shaped row on screen: `{ lead, title, marker, done }` read off the row's spans.
  const workRows = () => page.evaluate(() => [...document.querySelectorAll("main .text-sm.font-semibold")].map((node) => {
    const row = node.closest("button");
    const spans = row ? [...row.querySelectorAll("span")] : [];
    return { lead: (spans[0]?.innerText || "").trim(), title: (node.innerText || "").trim(), marker: (spans[1]?.innerText || "").trim(), done: /line-through/.test(node.className || "") };
  }));
  // A button in the tab body by its exact label (the pager chips, `업무 추가`, `선택`).
  const clickMain = async (label) => {
    const ok = await page.evaluate((l) => {
      const b = [...document.querySelectorAll("main button")].find((x) => (x.innerText || "").trim() === l);
      if (!b || b.disabled) return false;
      b.click(); return true;
    }, label);
    if (!ok) throw new Error(`tab button not found or disabled: ${label}`);
    await sleep(300);
  };
  // The link picker of the open work sheet: selects the option with this exact value and answers with its label.
  const pickLink = (value) => page.evaluate((v) => {
    const ov = [...document.querySelectorAll(".fixed.inset-0")].pop();
    const sel = ov && ov.querySelector("select");
    const opt = sel && [...sel.options].find((o) => o.value === v);
    if (!opt) return null;
    Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value").set.call(sel, opt.value);
    sel.dispatchEvent(new Event("change", { bubbles: true }));
    return opt.textContent;
  }, value);
  // The one checkbox of the meeting form (`AI에 보내지 않기`): clicks it and answers with the new state.
  const tickAiFlag = () => page.evaluate(() => {
    const ov = [...document.querySelectorAll(".fixed.inset-0")].pop();
    const box = ov && ov.querySelector('input[type="checkbox"]');
    if (!box) return null;
    box.click();
    return box.checked;
  });
  const openWorkForm = async () => { await clickTab("업무"); await clickMain("업무 추가"); await sleep(400); await expectText("연결 (선택)"); };

  const PROJECT_ID = "e2e-work-proj", MEETING_ID = "e2e-work-mtg";
  const PROJECT = "E2E 업무 프로젝트", MEETING = "E2E 진행 회의";
  const WORK_TITLE = "견적서 송부";
  const PAST_ID = "e2e-work-past", PAST_TITLE = "E2E 지난 업무";
  const meeting = async () => ((await readState()).meetings || []).find((m) => m.id === MEETING_ID);
  // Plants one project and one meeting dated yesterday, already in v25 shape, so the steps do not depend on flow10's leftovers.
  const plantMeeting = async () => {
    const date = await dstrIn(-1);
    await page.evaluate((k, pid, mid, pname, mtitle, d) => {
      const st = JSON.parse(localStorage.getItem(k));
      st.meetingProjects = [{ id: pid, name: pname, createdAt: d }, ...(st.meetingProjects || []).filter((p) => p.id !== pid)];
      st.meetings = [{ id: mid, projectId: pid, date: d, title: mtitle, summary: "진행사항 확인용 회의", createdAt: d, taskIds: [], progress: [], aiHidden: false },
        ...(st.meetings || []).filter((m) => m.id !== mid)];
      localStorage.setItem(k, JSON.stringify(st));
    }, KEY, PROJECT_ID, MEETING_ID, PROJECT, MEETING, date);
    await h.reload();
  };

  await step("the work tab starts empty, states today's date and its counts, and pages to another day", async () => {
    const today = await dstrIn(0), yesterday = await dstrIn(-1);
    await clickTab("업무");
    await expectText("오늘 업무 — " + today);
    await expectText("오늘 업무가 없어요.");
    await expectText("업무는 기록이에요 — 목표·실행·점수에 반영되지 않아요.");
    const line = await countsLine();
    if (!line.startsWith("남음 0건 · 이월 0건 · 완료 0건 · AI 제안 0건") || !/저장 공간 \d+\.\dMB \/ 3\.5MB$/.test(line)) throw new Error("work counts line: " + JSON.stringify(line));
    await clickMain("‹");
    await expectText("업무 — " + yesterday);
    await expectText("이 날짜에는 업무가 없어요.");
    const other = await countsLine();
    if (!other.startsWith("남음 0건 · 완료 0건 · AI 제안 0건")) throw new Error("another day's counts line: " + JSON.stringify(other));
    await clickMain("오늘");
    await expectText("오늘 업무 — " + today);
    await clickMain("›");
    await expectText("업무 — " + (await dstrIn(1)));
    await clickMain("오늘");
    await expectText("오늘 업무 — " + today);
  });

  await step("a progress entry is added to a meeting, listed newest first with its date, and the list row counts it", async () => {
    await plantMeeting();
    const before = await readState();
    const today = await dstrIn(0);
    await clickTab("미팅");
    await openTodo(MEETING);
    await expectText("진행사항이 없어요.");
    await typeInto("진행사항 추가", "견적서 초안 작성");
    await clickInModalExact("추가");
    await sleep(500);
    const view = await overlayText();
    if (!view.includes("견적서 초안 작성") || !view.includes(today)) throw new Error("the view does not list the new entry with today's date: " + view.slice(0, 300));
    if (view.includes("진행사항이 없어요.")) throw new Error("the empty state stayed after the add");
    const after = await readState();
    const m = (after.meetings || []).find((x) => x.id === MEETING_ID);
    if (!m || (m.progress || []).length !== 1 || m.progress[0].date !== today || m.progress[0].text !== "견적서 초안 작성") throw new Error("stored progress: " + JSON.stringify(m?.progress));
    const { progress: pb, ...restBefore } = before.meetings.find((x) => x.id === MEETING_ID);
    const { progress: pa, ...restAfter } = m;
    if (JSON.stringify(restBefore) !== JSON.stringify(restAfter)) throw new Error("adding progress changed another meeting field: " + JSON.stringify(restAfter));
    if (JSON.stringify(after.work || []) !== JSON.stringify(before.work || [])) throw new Error("adding progress changed the work items");
    assertBoundary(before, after, "adding a progress entry");
    await closeModal();
    const row = (await workRows()).find((r) => r.title === MEETING);
    if (!row || row.marker !== "진행 1건") throw new Error("the minutes row does not count the entry: " + JSON.stringify(row));
  });

  await step("the progress textarea refuses an empty and an over-cap entry", async () => {
    await clickTab("미팅");
    await openTodo(MEETING);
    await clickInModalExact("추가");
    let e = await modalError();
    if (e !== "진행사항을 입력해 주세요.") throw new Error("an empty entry gave: " + (e || "no error"));
    await setValue(".fixed.inset-0 textarea", "가".repeat(301), 0);
    await clickInModalExact("추가");
    e = await modalError();
    if (e !== "진행사항은 300자까지예요 — 지금 301자예요.") throw new Error("an over-cap entry gave: " + (e || "no error"));
    if (((await meeting()).progress || []).length !== 1) throw new Error("a refused entry reached the save");
    await closeModal();
  });

  await step("the AI flag is saved from the meeting form and stated in the view", async () => {
    await clickTab("미팅");
    await openTodo(MEETING);
    if (!(await overlayText()).includes("요약·진행사항 포함")) throw new Error("the view does not state the default AI line: " + (await overlayText()).slice(0, 300));
    await clickInModalExact("수정");
    await expectText("회의록 수정");
    await expectText("AI에 보내지 않기");
    if ((await tickAiFlag()) !== true) throw new Error("the AI checkbox did not tick");
    await clickInModalExact("저장");
    await sleep(500);
    let m = await meeting();
    if (m.aiHidden !== true) throw new Error("aiHidden after ticking: " + JSON.stringify(m.aiHidden));
    if ((m.progress || []).length !== 1) throw new Error("saving the form changed the progress entries: " + JSON.stringify(m.progress));
    await openTodo(MEETING);
    if (!(await overlayText()).includes("보내지 않음")) throw new Error("the view does not state the hidden flag");
    await clickInModalExact("수정");
    if ((await tickAiFlag()) !== false) throw new Error("the AI checkbox did not untick");
    await clickInModalExact("저장");
    await sleep(500);
    m = await meeting();
    if (m.aiHidden !== false) throw new Error("aiHidden after unticking: " + JSON.stringify(m.aiHidden));
    await openTodo(MEETING);
    if (!(await overlayText()).includes("요약·진행사항 포함")) throw new Error("the view does not state the visible flag again");
    await closeModal();
  });

  await step("a manual work item registers under today with source manual and changes no task, goal, streak or trophy", async () => {
    const before = await readState();
    const today = await dstrIn(0);
    await openWorkForm();
    await clickInModalExact("등록");
    const e = await modalError();
    if (e !== "업무 제목을 입력해 주세요.") throw new Error("an empty title gave: " + (e || "no error"));
    await typeInto("업무 제목", WORK_TITLE);
    await typeInto("메모 (선택)", "○○물산");
    const picked = await pickLink("project:" + PROJECT_ID);
    if (picked !== "프로젝트 · " + PROJECT) throw new Error("the link picker did not offer the planted project: " + picked);
    await clickInModalExact("등록");
    await sleep(500);
    const rows = await workRows();
    const row = rows.find((r) => r.title === WORK_TITLE);
    if (!row || row.lead !== "수기" || row.marker !== "프로젝트" || row.done) throw new Error("the work row: " + JSON.stringify(rows));
    const line = await countsLine();
    if (!line.startsWith("남음 1건 · 이월 0건 · 완료 0건 · AI 제안 0건")) throw new Error("counts after the add: " + line);
    const after = await readState();
    const w = (after.work || []).find((x) => x.title === WORK_TITLE);
    if (!w || w.date !== today || w.done !== false || w.source !== "manual" || w.note !== "○○물산" || w.createdAt !== today) throw new Error("stored work item: " + JSON.stringify(w));
    if (!w.link || w.link.kind !== "project" || w.link.id !== PROJECT_ID) throw new Error("stored link: " + JSON.stringify(w.link));
    const bad = ["pts", "diff", "goalId", "areaId", "status", "doneDates"].filter((k) => k in w);
    if (bad.length) throw new Error(`the work item stores task fields: ${bad.join(", ")}`);
    if (JSON.stringify(after.tasks) !== JSON.stringify(before.tasks)) throw new Error("registering a work item changed the tasks");
    if (JSON.stringify(after.meetings) !== JSON.stringify(before.meetings)) throw new Error("registering a work item changed the meetings");
    assertBoundary(before, after, "registering a work item");
  });

  await step("a work item completed from its sheet stays in place struck through and counts as done", async () => {
    const before = await readState();
    await clickTab("업무");
    await openTodo(WORK_TITLE);
    const sheet = await overlayText();
    for (const t of ["미완료", "수기", "프로젝트 · " + PROJECT]) if (!sheet.includes(t)) throw new Error(`the work sheet lacks "${t}": ` + sheet.slice(0, 300));
    await clickInModalExact("완료로 표시");
    await sleep(500);
    if (await page.evaluate(() => document.querySelectorAll(".fixed.inset-0").length)) throw new Error("the sheet stayed open after completion");
    const row = (await workRows()).find((r) => r.title === WORK_TITLE);
    if (!row || !row.done || row.lead !== "수기") throw new Error("the completed row is not in place and struck through: " + JSON.stringify(row));
    const line = await countsLine();
    if (!line.startsWith("남음 0건 · 이월 0건 · 완료 1건 · AI 제안 0건")) throw new Error("counts after completion: " + line);
    const after = await readState();
    if (after.work.find((x) => x.title === WORK_TITLE).done !== true) throw new Error("done was not stored");
    assertBoundary(before, after, "completing a work item");
    if (JSON.stringify(after.act) !== JSON.stringify(before.act)) throw new Error("completing a work item changed act: " + JSON.stringify(after.act));
    await openTodo(WORK_TITLE);
    if (!(await overlayText()).includes("완료 취소")) throw new Error("the sheet of a done item does not offer to undo");
    await clickInModalExact("완료 취소");
    await sleep(500);
    if ((await readState()).work.find((x) => x.title === WORK_TITLE).done !== false) throw new Error("done was not reverted");
  });

  // The result note (2026-09-17): how a finished item was done, typed in the sheet and kept by the done toggle itself.
  await step("a result typed in the sheet is stored by the done toggle, refused over 1000 chars, and removed when cleared", async () => {
    const RESULT = "견적서 PDF를 메일로 보냈어요";
    const itemOf = async () => (await readState()).work.find((x) => x.title === WORK_TITLE);
    const typeResult = async (text) => {
      await setValue('.fixed.inset-0 textarea[placeholder^="처리 내용"]', text);
      await sleep(150);
    };
    await clickTab("업무");
    await openTodo(WORK_TITLE);
    await typeResult(RESULT);
    await clickInModalExact("완료로 표시");
    await sleep(500);
    let item = await itemOf();
    if (!item.done || item.result !== RESULT) throw new Error("completion did not store the result: " + JSON.stringify(item));
    await openTodo(WORK_TITLE);
    await typeResult("가".repeat(1001));
    await clickInModalExact("완료 취소");
    const e = await modalError();
    if (e !== "처리 내용은 1000자까지예요 — 지금 1001자예요.") throw new Error("an over-cap result gave: " + (e || "no error"));
    item = await itemOf();
    if (!item.done || item.result !== RESULT) throw new Error("a refused result changed the record: " + JSON.stringify(item));
    await typeResult("");
    await clickInModalExact("완료 취소");
    await sleep(500);
    item = await itemOf();
    if (item.done || "result" in item) throw new Error("undoing with a cleared result left: " + JSON.stringify(item));
  });

  // Carry-forward is derived (2026-09-17): an undone item from an earlier day is listed first on today's view with its
  // age and keeps its own date and its own day; nothing is moved or rewritten.
  await step("an undone item from a past date is carried into today's list with its age, keeps its own date, and is absent on other days", async () => {
    const past = await dstrIn(-3);
    await page.evaluate((k, id, title, d) => {
      const st = JSON.parse(localStorage.getItem(k));
      st.work.push({ id, date: d, title, done: false, source: "manual", createdAt: d });
      localStorage.setItem(k, JSON.stringify(st));
    }, KEY, PAST_ID, PAST_TITLE, past);
    await h.reload();
    const before = await readState();
    await clickTab("업무");
    let line = await countsLine();
    if (!line.startsWith("남음 2건 · 이월 1건")) throw new Error("counts with a carried item: " + line);
    const rows = await workRows();
    if (rows[0]?.title !== PAST_TITLE || rows[0]?.lead !== "이월 3일") throw new Error("the carried row is not first with its age: " + JSON.stringify(rows));
    if (await hasText("지난 미완료")) throw new Error("the removed past-undone section is still rendered");
    if (await hasText("오늘로 옮기기")) throw new Error("the removed move button is still rendered");
    await clickMain("‹");
    if ((await workRows()).some((r) => r.title === PAST_TITLE)) throw new Error("the carried item is listed on yesterday's view");
    line = await countsLine();
    if (line.includes("이월")) throw new Error("another day's counts line states a carried count: " + line);
    await clickMain("‹");
    await clickMain("‹");
    await expectText("업무 — " + past);
    const own = (await workRows()).find((r) => r.title === PAST_TITLE);
    if (!own || own.lead !== "수기" || own.done) throw new Error("the item on its own day: " + JSON.stringify(own));
    await clickMain("오늘");
    const after = await readState();
    const w = after.work.find((x) => x.id === PAST_ID);
    if (!w || w.date !== past || w.done !== false) throw new Error("carrying rewrote the item: " + JSON.stringify(w));
    if (JSON.stringify(after.work) !== JSON.stringify(before.work)) throw new Error("viewing the carried item changed the work items");
    assertBoundary(before, after, "carrying a work item");
  });

  await step("completing a carried item keeps its date and takes it off today's list", async () => {
    const past = await dstrIn(-3);
    const before = await readState();
    await clickTab("업무");
    await openTodo(PAST_TITLE);
    const sheet = await overlayText();
    if (!sheet.includes(past + " · 이월 3일")) throw new Error("the carried item's sheet does not state its age: " + sheet.slice(0, 300));
    await clickInModalExact("완료로 표시");
    await sleep(500);
    const after = await readState();
    const w = after.work.find((x) => x.id === PAST_ID);
    if (!w || w.done !== true || w.date !== past) throw new Error("the completed carried item: " + JSON.stringify(w));
    assertBoundary(before, after, "completing a carried item");
    if ((await workRows()).some((r) => r.title === PAST_TITLE)) throw new Error("a done carried item stayed on today's list");
    const line = await countsLine();
    if (!line.startsWith("남음 1건 · 이월 0건")) throw new Error("counts after completing the carried item: " + line);
    for (let n = 0; n < 3; n++) await clickMain("‹");
    await expectText("업무 — " + past);
    const own = (await workRows()).find((r) => r.title === PAST_TITLE);
    if (!own || !own.done || own.lead !== "수기") throw new Error("the done item on its own day: " + JSON.stringify(own));
    // Reopen it from its own day so the later steps see the carried row again.
    await openTodo(PAST_TITLE);
    await clickInModalExact("완료 취소");
    await sleep(500);
    const reopened = (await readState()).work.find((x) => x.id === PAST_ID);
    if (!reopened || reopened.done !== false || reopened.date !== past) throw new Error("the reopened carried item: " + JSON.stringify(reopened));
    await clickMain("오늘");
    const back = (await workRows())[0];
    if (back?.title !== PAST_TITLE || back?.lead !== "이월 3일") throw new Error("the reopened item is not carried again: " + JSON.stringify(back));
  });

  // The per-day cap was removed 2026-09-17: undone items are carried forward, so a day's list may grow past twenty.
  await step("a twenty-first item on one day registers — there is no per-day cap", async () => {
    const today = await dstrIn(0);
    const keep = (await readState()).work; // the two items this file made — restored below
    await page.evaluate((k, d) => {
      const st = JSON.parse(localStorage.getItem(k));
      st.work = st.work.filter((w) => w.date !== d);
      for (let n = 1; n <= 20; n++) st.work.push({ id: `e2e-work-cap-${n}`, date: d, title: `E2E 한도 ${n}`, done: false, source: "manual", createdAt: d });
      localStorage.setItem(k, JSON.stringify(st));
    }, KEY, today);
    await h.reload();
    await openWorkForm();
    await typeInto("업무 제목", "스물한 번째");
    await clickInModalExact("등록");
    await expectText("업무를 등록했어요");
    const st = await readState();
    if (st.work.filter((w) => w.date === today).length !== 21 || !st.work.some((w) => w.title === "스물한 번째")) throw new Error("the twenty-first item did not reach the save");
    await page.evaluate((k, items) => { const s = JSON.parse(localStorage.getItem(k)); s.work = items; localStorage.setItem(k, JSON.stringify(s)); }, KEY, keep);
    await h.reload();
  });

  await step("select mode deletes the ticked items, then every item after select-all including the carried row, and moves nothing else", async () => {
    const today = await dstrIn(0);
    const keep = (await readState()).work; // restored below, for the backup step
    await page.evaluate((k, d) => {
      const st = JSON.parse(localStorage.getItem(k));
      for (let n = 1; n <= 3; n++) st.work.push({ id: `e2e-work-del-${n}`, date: d, title: `E2E 삭제 ${n}`, done: false, source: "ai", createdAt: d });
      localStorage.setItem(k, JSON.stringify(st));
    }, KEY, today);
    await h.reload();
    await page.evaluate(() => { window.confirm = () => true; });
    const before = await readState();
    await clickTab("업무");
    await clickMain("선택");
    const ticked = await page.evaluate((t) => {
      const label = [...document.querySelectorAll("main label")].find((l) => (l.innerText || "").includes(t));
      label?.querySelector('input[type="checkbox"]')?.click();
      return !!label;
    }, "E2E 삭제 2");
    if (!ticked) throw new Error("no selectable row for the planted item");
    await clickMain("선택 삭제 1건");
    await expectText("업무 1건을 삭제했어요");
    let st = await readState();
    if (st.work.some((w) => w.id === "e2e-work-del-2") || st.work.length !== before.work.length - 1) throw new Error("the ticked delete: " + JSON.stringify(st.work.map((w) => w.id)));
    if (await page.evaluate(() => document.querySelectorAll('main input[type="checkbox"]').length)) throw new Error("select mode stayed after the delete");
    // Today's view lists today's items plus every undone item from an earlier day (the carried row).
    const left = st.work.filter((w) => w.date === today || (w.date < today && !w.done)).length;
    if (!st.work.some((w) => w.id === PAST_ID && w.date < today && !w.done)) throw new Error("no carried item to select: " + JSON.stringify(st.work.map((w) => w.id)));
    await clickMain("선택");
    await clickMain("전체 선택");
    const carriedTicked = await page.evaluate((t) => {
      const label = [...document.querySelectorAll("main label")].find((l) => (l.innerText || "").includes(t));
      return label ? !!label.querySelector('input[type="checkbox"]')?.checked : null;
    }, PAST_TITLE);
    if (carriedTicked !== true) throw new Error("select-all did not tick the carried row: " + JSON.stringify(carriedTicked));
    await clickMain(`선택 삭제 ${left}건`);
    await expectText(`업무 ${left}건을 삭제했어요`);
    st = await readState();
    if (st.work.some((w) => w.date === today)) throw new Error("select-all left today's items: " + JSON.stringify(st.work));
    if (st.work.some((w) => w.id === PAST_ID)) throw new Error("select-all left the carried item: " + JSON.stringify(st.work));
    await expectText("오늘 업무가 없어요.");
    assertBoundary(before, st, "deleting work items");
    await page.evaluate((k, items) => { const s = JSON.parse(localStorage.getItem(k)); s.work = items; localStorage.setItem(k, JSON.stringify(s)); }, KEY, keep);
    await h.reload();
  });

  await step("the briefing states carried work as a count and its line opens the work tab", async () => {
    const keep = (await readState()).work; // restored below
    // Only one carried item for this step: the -3 item is set aside and one undone item dated -4 is planted.
    const fourDaysAgo = await dstrIn(-4);
    await page.evaluate((k, pastId, d) => {
      const st = JSON.parse(localStorage.getItem(k));
      st.work = st.work.filter((w) => w.id !== pastId);
      st.work.push({ id: "e2e-work-brief", date: d, title: "E2E 이월 브리핑", done: false, source: "manual", createdAt: d });
      localStorage.setItem(k, JSON.stringify(st));
    }, KEY, PAST_ID, fourDaysAgo);
    await h.reload();
    const before = await readState();
    await clickTab("할 일");
    await clickMain("브리핑 열기 ›");
    await sleep(400);
    await expectText("이월 업무 1건 · 최장 4일");
    if ((await overlayText()).includes("E2E 이월 브리핑")) throw new Error("the briefing lists a work item's title");
    await h.clickInModal("이월 업무 1건 · 최장 4일");
    await sleep(400);
    if (await page.evaluate(() => document.querySelectorAll(".fixed.inset-0").length)) throw new Error("the briefing stayed open after the carried line was tapped");
    const active = await page.evaluate(() => [...document.querySelectorAll("nav button")].filter((b) => /text-cyan-300/.test(b.className)).map((b) => (b.innerText || "").trim()).join("·"));
    if (active !== "업무") throw new Error("the carried line opened the tab: " + (active || "none"));
    await expectText("오늘 업무 — " + (await dstrIn(0)));
    const after = await readState();
    if (JSON.stringify(after.work) !== JSON.stringify(before.work)) throw new Error("the briefing changed the work items");
    await page.evaluate((k, items) => { const s = JSON.parse(localStorage.getItem(k)); s.work = items; localStorage.setItem(k, JSON.stringify(s)); }, KEY, keep);
    await h.reload();
  });

  // The meeting-prep card and the briefing's `회의 준비` section (secretary stage 1-A Phase 3, 2026-09-17, written, not run).
  await step("an event linked to a project, or titled like a previous meeting, gets a prep block that opens the last meeting", async () => {
    const P = { id: "e2e-prep-proj", name: "E2E 준비 프로젝트" };
    const M = { id: "e2e-prep-mtg", title: "E2E 준비 회의" };
    const E1 = { id: "e2e-prep-ev1", title: "E2E 준비 점검" };
    const FU_TEXT = "E2E 준비 자료 송부";
    const today = await dstrIn(0), tomorrow = await dstrIn(1), yesterday = await dstrIn(-1);
    M.date = await dstrIn(-3);
    await page.evaluate((k, p, m, e1, fu, t, tm) => {
      const st = JSON.parse(localStorage.getItem(k));
      st.meetingProjects = [...(st.meetingProjects || []), { id: p.id, name: p.name, createdAt: m.date }];
      st.meetings = [...(st.meetings || []), { id: m.id, projectId: p.id, date: m.date, title: m.title, summary: "준비 카드 확인용 회의",
        decisions: "월 10시간", createdAt: m.date, taskIds: [], aiHidden: false,
        progress: [{ id: "e2e-prep-prog", date: m.date, text: "견적 초안 작성" }],
        followUps: [{ id: "e2e-prep-fu", text: fu, mine: true, done: false }] }];
      st.events = [...(st.events || []),
        { id: e1.id, title: e1.title, kind: "appt", date: t, time: "10:00", projectId: p.id, createdAt: t },
        { id: "e2e-prep-ev2", title: m.title, kind: "appt", date: tm, createdAt: t }];
      localStorage.setItem(k, JSON.stringify(st));
    }, KEY, P, M, E1, FU_TEXT, today, tomorrow);
    await h.reload();
    const before = await readState();
    const cardText = () => page.evaluate(() => {
      const sec = [...document.querySelectorAll("main section")].find((s) => (s.innerText || "").trim().startsWith("오늘 회의 준비"));
      return sec ? { first: document.querySelector("main section") === sec, text: sec.innerText.replace(/[ \t]+/g, " ") } : null;
    });
    await clickTab("업무");
    await expectText("오늘 회의 준비");
    const card = await cardText();
    if (!card || !card.first) throw new Error("the prep card is not the first section of the work tab: " + JSON.stringify(card));
    const lines = card.text.split("\n").map((l) => l.trim()).filter(Boolean);
    if (lines[1] !== "2건") throw new Error("the prep card count: " + JSON.stringify(lines.slice(0, 2)));
    for (const t of [P.name, `오늘 10:00 · ${E1.title}`, `내일 시간 미정 · ${M.title}`, `마지막 회의 ${M.date} · ${M.title}`, "결정: 월 10시간",
      `내 담당 · ${FU_TEXT} · 기한 없음 · 업무 없음`, `${M.date} 견적 초안 작성`]) {
      if (!lines.includes(t)) throw new Error(`the prep card lacks "${t}": ` + lines.join(" | "));
    }
    if (lines.indexOf(`오늘 10:00 · ${E1.title}`) > lines.indexOf(`내일 시간 미정 · ${M.title}`)) throw new Error("today's block is not listed before tomorrow's");
    await page.evaluate(() => {
      const sec = [...document.querySelectorAll("main section")].find((s) => (s.innerText || "").trim().startsWith("오늘 회의 준비"));
      sec.querySelector("button").click();
    });
    await sleep(500);
    const view = await overlayText();
    if (!view.startsWith(M.title)) throw new Error("tapping the first block did not open the last meeting: " + view.slice(0, 120));
    await closeModal();
    await clickTab("할 일");
    await clickMain("브리핑 열기 ›");
    await sleep(400);
    await expectText("오늘 회의 준비 1건 · 내일 1건");
    if ((await overlayText()).includes("후속 기한 지남")) throw new Error("the briefing states an overdue follow-up before any due date is set");
    await closeModal();
    await page.evaluate((k, d) => {
      const st = JSON.parse(localStorage.getItem(k));
      st.meetings.find((m) => m.id === "e2e-prep-mtg").followUps[0].due = d;
      localStorage.setItem(k, JSON.stringify(st));
    }, KEY, yesterday);
    await h.reload();
    await clickTab("할 일");
    await clickMain("브리핑 열기 ›");
    await sleep(400);
    await expectText("후속 기한 지남 1건 · 내 담당 1건");
    await h.clickInModal("후속 기한 지남 1건 · 내 담당 1건");
    await sleep(400);
    if (await page.evaluate(() => document.querySelectorAll(".fixed.inset-0").length)) throw new Error("the briefing stayed open after the overdue line was tapped");
    const active = await page.evaluate(() => [...document.querySelectorAll("nav button")].filter((b) => /text-cyan-300/.test(b.className)).map((b) => (b.innerText || "").trim()).join("·"));
    if (active !== "미팅") throw new Error("the overdue follow-up line opened the tab: " + (active || "none"));
    const after = await readState();
    for (const key of ["work", "tasks", "goals", "events", "meetingProjects"]) {
      if (JSON.stringify(after[key] || []) !== JSON.stringify(before[key] || [])) throw new Error(`the prep card or the briefing changed ${key}`);
    }
    // Clean up the plants so the backup step and flow4 see the save they used to.
    await page.evaluate((k) => {
      const st = JSON.parse(localStorage.getItem(k));
      st.meetingProjects = st.meetingProjects.filter((p) => p.id !== "e2e-prep-proj");
      st.meetings = st.meetings.filter((m) => m.id !== "e2e-prep-mtg");
      st.events = st.events.filter((e) => !["e2e-prep-ev1", "e2e-prep-ev2"].includes(e.id));
      localStorage.setItem(k, JSON.stringify(st));
    }, KEY);
    await h.reload();
  });

  await step("work items and meeting progress travel in the backup file", async () => {
    const st = await readState();
    if (!(st.work || []).length) throw new Error("no work item to export");
    await openSettings();
    const dl = await captureDownload(() => h.clickInModal("백업 내보내기"));
    if (!dl || !dl.text) throw new Error("no backup blob was produced");
    const data = JSON.parse(dl.text);
    if (data.state?.v !== 26) throw new Error("backup schema version " + data.state?.v + " (expected 26)");
    if (JSON.stringify(data.state?.work) !== JSON.stringify(st.work)) throw new Error("backup work items differ: " + JSON.stringify(data.state?.work));
    const m = (data.state?.meetings || []).find((x) => x.id === MEETING_ID);
    if (!m || (m.progress || []).length !== 1 || m.aiHidden !== false) throw new Error("the backup lacks the meeting's progress entry or flag: " + JSON.stringify(m));
    await closeModal();
  });

  /* Phase 2 — the work packet and the pasted work reply. Written 2026-09-17 under the same standing instruction: parsed, not run. */
  const MTG_A_ID = "e2e-work-mtg-a", MTG_B_ID = "e2e-work-mtg-b";
  const MTG_A = "E2E 검색 범위 회의", MTG_B = "비공개 단가 협의";
  const HIDDEN_SUMMARY = "단가 3% 인하 합의";
  // The work packet as shown in the open sheet's read-only textarea.
  const packetText = () => page.evaluate(() => document.querySelector(".fixed.inset-0 textarea")?.value || "");
  // A proposal row of the confirm view: the label whose title span reads `title`, as `{ text, disabled, checked }`.
  const proposalRow = (title) => page.evaluate((t) => {
    const label = [...document.querySelectorAll(".fixed.inset-0 span")].find((s) => s.textContent.trim() === t)?.closest("label");
    if (!label) return null;
    const box = label.querySelector('input[type="checkbox"]');
    return { text: label.innerText.replace(/\s+/g, " ").trim(), disabled: !!box?.disabled, checked: !!box?.checked };
  }, title);
  const openWorkBridge = async () => { await clickTab("업무"); await clickMain("AI로 만들기 ›"); await sleep(400); await expectText("오늘 업무 만들기"); };
  const pasteWorkReply = async (reply) => {
    await clickInModalExact("AI 답변 붙여넣기 ›");
    await sleep(300);
    await setValue(".fixed.inset-0 textarea", reply);
    await clickInModalExact("답변 확인");
    await sleep(500);
  };

  await step("the work packet carries a meeting's attendees, linked tasks, summary and progress, only the title and date of a hidden meeting, and no profile identifier", async () => {
    const today = await dstrIn(0), twoDaysAgo = await dstrIn(-2);
    // Two more meetings under the planted project: A visible with a progress entry, B flagged `AI에 보내지 않기`.
    await page.evaluate((k, pid, a, b, d, t) => {
      const st = JSON.parse(localStorage.getItem(k));
      st.meetings = [
        { id: a.id, projectId: pid, date: d, title: a.title, attendees: "E2E 참석 2명", summary: "검색 범위 협의 완료", createdAt: d,
          taskIds: (st.tasks || []).slice(0, 1).map((q) => q.id),
          progress: [{ id: "e2e-work-prog-a", date: t, text: "색인 스크립트 초안 작성" }], aiHidden: false },
        { id: b.id, projectId: pid, date: d, title: b.title, attendees: "비공개 참석자", summary: b.summary, decisions: "단가 조정", createdAt: d, taskIds: [], progress: [], aiHidden: true },
        ...(st.meetings || []).filter((m) => m.id !== a.id && m.id !== b.id),
      ];
      localStorage.setItem(k, JSON.stringify(st));
    }, KEY, PROJECT_ID, { id: MTG_A_ID, title: MTG_A }, { id: MTG_B_ID, title: MTG_B, summary: HIDDEN_SUMMARY }, twoDaysAgo, today);
    await h.reload();
    await openWorkBridge();
    const txt = await packetText();
    const linkedTitle = ((await readState()).tasks || [])[0]?.title;
    if (!linkedTitle) throw new Error("no task to link, so the linked-task line would prove nothing");
    if (!txt.startsWith("[인생 관리 — 오늘 업무 제안 요청 " + today + "]")) throw new Error("the packet does not open with the work request line: " + txt.slice(0, 80));
    if (txt.length > 20000) throw new Error("the work packet exceeds the 20000-char cap: " + txt.length);
    for (const t of ["## 이력", "## 목표", "## 열린 할 일", "## 최근 회의록", "## 업무 기록 (이월·어제·오늘)",
      `[${PROJECT}] ${MTG_A}`, "참석: E2E 참석 2명", `연결된 할 일: ${linkedTitle} (`, "요약: 검색 범위 협의 완료", `진행 ${today}: 색인 스크립트 초안 작성`,
      `${twoDaysAgo} ${MTG_B}`, "내용 비공개 (AI에 보내지 않기)", `${today} 미완료 ${WORK_TITLE}`]) {
      if (!txt.includes(t)) throw new Error(`the work packet lacks "${t}" (${txt.length} chars)`);
    }
    // The carried item is in the work-record section, stated with its age as `- {date} 미완료 · 이월 {n}일 {title}` — the
    // records are built from today's carried view plus yesterday's items.
    const recordSection = txt.slice(txt.indexOf("## 업무 기록")).split("\n## ")[0];
    const pastItem = ((await readState()).work || []).find((w) => w.id === PAST_ID);
    if (!pastItem) throw new Error("the carried item is not in the save, so the record line would prove nothing");
    if (!recordSection.includes(`- ${pastItem.date} 미완료 · 이월 3일 ${PAST_TITLE}`)) throw new Error("the work-record section lacks the carried item: " + recordSection.slice(0, 300));
    // The hidden meeting: its body stays out, and its line names no project either — date and title only.
    if (txt.includes(HIDDEN_SUMMARY) || txt.includes("단가 조정") || txt.includes("비공개 참석자")) throw new Error("the hidden meeting's minutes reached the packet");
    if (txt.includes(`[${PROJECT}] ${MTG_B}`)) throw new Error("the hidden meeting's line names its project");
    const iHidden = txt.indexOf(`${twoDaysAgo} ${MTG_B}`);
    if (!txt.slice(iHidden).split("\n")[1].includes("내용 비공개")) throw new Error("the hidden meeting's line is not followed by the closed-body line");
    // Name, birth date, e-mail, phone, school names and the employer name: typed by flow.js / flow3.js, all absent.
    const p = (await readState()).profile || {};
    const identifying = [p.name, p.birth, p.email, p.phone, ...(p.edus || []).map((e) => e.school), ...(p.careers || []).map((c) => c.company)];
    for (const t of identifying) {
      if (!t) throw new Error("an identifying field is empty, so its absence would prove nothing: " + JSON.stringify(identifying));
      if (txt.includes(t)) throw new Error("the work packet carries an identifying field: " + t);
    }
  });

  await step("a pasted work reply imports the ticked proposals with source ai and refuses the duplicate", async () => {
    const before = await readState();
    const today = await dstrIn(0);
    const goal = (before.goals || []).find((g) => g.status === "active");
    if (!goal) throw new Error("no active goal to link a proposal to");
    const reply = [
      "분석: 어제 회의의 후속으로 견적서 송부가 남아 있어요.",
      "```json",
      JSON.stringify({ work: [
        { title: WORK_TITLE, note: "어제 회의 후속" },
        { title: "전기기사 기출 채점", note: "목표 근거", link: { kind: "goal", title: goal.title } },
        { title: "회의록 정리" },
      ], note: "세 건을 제안해요." }),
      "```",
    ].join("\n");
    await pasteWorkReply(reply);
    await expectText("제안 업무 확인 — 3건");
    await expectText("세 건을 제안해요.");
    const dup = await proposalRow(WORK_TITLE);
    if (!dup || !dup.disabled || dup.checked || !dup.text.includes("오늘 업무에 이미 있어요")) throw new Error("the duplicate row is not refused: " + JSON.stringify(dup));
    const linked = await proposalRow("전기기사 기출 채점");
    if (!linked || linked.disabled || !linked.checked || !linked.text.includes(`목표 · ${goal.title}`)) throw new Error("the goal-linked row: " + JSON.stringify(linked));
    const plain = await proposalRow("회의록 정리");
    if (!plain || plain.disabled || !plain.checked || !plain.text.includes("연결 없음")) throw new Error("the plain row: " + JSON.stringify(plain));
    await clickInModalExact("선택한 업무 등록");
    await expectText("AI 제안 업무 2건 등록");
    await sleep(500);
    const after = await readState();
    const made = (after.work || []).filter((w) => !(before.work || []).some((b) => b.id === w.id));
    if (made.length !== 2) throw new Error("imported work items: " + JSON.stringify(made));
    for (const w of made) {
      if (w.date !== today || w.source !== "ai" || w.done !== false || w.createdAt !== today) throw new Error("an imported item is not today's open AI record: " + JSON.stringify(w));
    }
    const withGoal = made.find((w) => w.title === "전기기사 기출 채점");
    if (!withGoal?.link || withGoal.link.kind !== "goal" || withGoal.link.id !== goal.id || withGoal.note !== "목표 근거") throw new Error("the goal link was not resolved: " + JSON.stringify(withGoal));
    const noLink = made.find((w) => w.title === "회의록 정리");
    if (!noLink || "link" in noLink || "note" in noLink) throw new Error("the plain item carries a link or note: " + JSON.stringify(noLink));
    if ((after.work || []).filter((w) => w.title === WORK_TITLE).length !== 1) throw new Error("the duplicate was imported");
    if (JSON.stringify(after.journal || []) !== JSON.stringify(before.journal || [])) throw new Error("the work reply was stored on the journal");
    if (JSON.stringify(after.tasks) !== JSON.stringify(before.tasks)) throw new Error("importing work items changed the tasks");
    assertBoundary(before, after, "importing work proposals");
    const rows = await workRows();
    for (const t of ["전기기사 기출 채점", "회의록 정리"]) {
      const row = rows.find((r) => r.title === t);
      if (!row || row.lead !== "AI" || row.done) throw new Error("the imported row is not listed under today with the AI lead: " + JSON.stringify(row));
    }
    const line = await countsLine();
    if (!line.includes("AI 제안 2건")) throw new Error("counts after the import: " + line);
  });

  // A chat's code-block copy button copies only the JSON, so a reply without the fence must still read.
  await step("a work reply pasted as bare JSON after analysis lines lists all twelve of its proposals", async () => {
    await openWorkBridge();
    // Twelve proposals: more than the old limit of 8, all listed (the limit is the per-day cap of 20).
    const many = Array.from({ length: 12 }, (_, n) => ({ title: n ? `펜스 없는 답변 ${n + 1}` : "펜스 없는 답변 확인", note: "코드블록 복사" }));
    await pasteWorkReply(`분석 한 줄이에요.\n${JSON.stringify({ work: many, note: "한 줄" }, null, 2)}`);
    await expectText("제안 업무 확인 — 12건");
    await expectText("펜스 없는 답변 확인");
    await expectText("펜스 없는 답변 12");
    await closeModal();
  });

  await step("a work reply naming tasks, deals, events and meetings creates none of them", async () => {
    const before = await readState();
    await openWorkBridge();
    await pasteWorkReply('```json\n{"tasks":[{"goal":"x","title":"독서 30분"}],"deals":[{"client":"c"}],"events":[{"title":"e"}],"meetings":[{"title":"m"}],"work":[]}\n```');
    await expectText("제안 업무 없음 — 등록할 항목이 없어요.");
    await clickInModalExact("선택한 업무 등록");
    await sleep(500);
    const after = await readState();
    for (const key of ["tasks", "deals", "events", "meetings", "work", "journal"]) {
      if (JSON.stringify(after[key] || []) !== JSON.stringify(before[key] || [])) throw new Error(`a work reply changed ${key}`);
    }
    if (await page.evaluate(() => document.querySelectorAll(".fixed.inset-0").length)) await closeModal();
    // Leave the save as flow4 expects it: no work items, no planted project or meetings.
    await page.evaluate((k, pid, ids) => {
      const s = JSON.parse(localStorage.getItem(k));
      s.work = [];
      s.meetings = (s.meetings || []).filter((x) => !ids.includes(x.id));
      s.meetingProjects = (s.meetingProjects || []).filter((p) => p.id !== pid);
      localStorage.setItem(k, JSON.stringify(s));
    }, KEY, PROJECT_ID, [MEETING_ID, MTG_A_ID, MTG_B_ID]);
    await h.reload();
  });

  // ── Urgent memos (2026-09-17): the work packet states a project-less meeting under `[프로젝트 없음]` and never reads its
  // transcript; a meeting-linked work item opens its minutes from the sheet. Written, not run.
  const MEMO_ID = "e2e-memo-packet", MEMO_TITLE = "E2E 패킷 메모", MEMO_WORK_ID = "e2e-memo-work", MEMO_WORK = "E2E 메모 업무", SENTINEL = "E2E-PACKET-SENTINEL-51c0";
  const GOAL_WORK_ID = "e2e-memo-work-goal", GOAL_WORK = "E2E 목표 업무";
  const overlayCount = () => page.evaluate(() => document.querySelectorAll(".fixed.inset-0").length);

  await step("the work packet states a memo under the no-project head and carries none of its transcript", async () => {
    const today = await dstrIn(0);
    await page.evaluate((k, id, title, d, sentinel) => {
      const s = JSON.parse(localStorage.getItem(k));
      s.meetings = [{ id, projectId: null, date: d, title, summary: "패킷 확인", transcript: "패킷 확인용 녹취 " + sentinel + "\n둘째 줄",
        createdAt: d, taskIds: [], progress: [], aiHidden: false, followUps: [] }, ...(s.meetings || []).filter((m) => m.id !== id)];
      localStorage.setItem(k, JSON.stringify(s));
    }, KEY, MEMO_ID, MEMO_TITLE, today, SENTINEL);
    await h.reload();
    await openWorkBridge();
    const txt = await packetText();
    await closeModal();
    if (!txt.includes(`- ${today} [프로젝트 없음] ${MEMO_TITLE}`)) throw new Error("the packet lacks the memo's head line: " + txt.slice(0, 400));
    if (!txt.includes("  요약: 패킷 확인")) throw new Error("the packet lacks the memo's summary line: " + txt.slice(0, 400));
    if (txt.includes(SENTINEL) || txt.includes("패킷 확인용 녹취")) throw new Error("the transcript reached the work packet");
    if (txt.length > 20000) throw new Error("the work packet exceeds the 20000-char cap: " + txt.length);
  });

  await step("the open-minutes button on a meeting-linked work item opens that meeting's view in place of the sheet, and a goal-linked item has no such button", async () => {
    const today = await dstrIn(0);
    const goal = ((await readState()).goals || []).find((g) => g.status === "active");
    if (!goal) throw new Error("no active goal to link a work item to");
    await page.evaluate((k, items) => {
      const s = JSON.parse(localStorage.getItem(k));
      const ids = new Set(items.map((w) => w.id));
      s.work = [...(s.work || []).filter((w) => !ids.has(w.id)), ...items];
      localStorage.setItem(k, JSON.stringify(s));
    }, KEY, [
      { id: MEMO_WORK_ID, date: today, title: MEMO_WORK, done: false, link: { kind: "meeting", id: MEMO_ID }, source: "manual", createdAt: today },
      { id: GOAL_WORK_ID, date: today, title: GOAL_WORK, done: false, link: { kind: "goal", id: goal.id }, source: "manual", createdAt: today },
    ]);
    await h.reload();
    await clickTab("업무");
    await openTodo(MEMO_WORK);
    const sheet = await overlayText();
    for (const t of [`회의록 · ${today} ${MEMO_TITLE}`, "회의록 열기"]) if (!sheet.includes(t)) throw new Error(`the work sheet lacks "${t}": ` + sheet.slice(0, 300));
    await clickInModalExact("회의록 열기");
    await sleep(500);
    const overlays = await overlayCount();
    if (overlays !== 1) throw new Error("overlays after opening the minutes from the sheet: " + overlays);
    const view = await overlayText();
    if (!view.startsWith(MEMO_TITLE)) throw new Error("the overlay is not the memo's view: " + view.slice(0, 200));
    if (!view.includes("녹취록 ") || !view.includes("자 · 펼치기")) throw new Error("the memo view lacks the collapsed transcript row: " + view.slice(0, 300));
    await closeModal();
    const left = await overlayCount();
    if (left) throw new Error(`${left} overlay(s) still open after the view was closed`);
    const active = await page.evaluate(() => [...document.querySelectorAll("nav button")].filter((b) => /text-cyan-300/.test(b.className)).map((b) => (b.innerText || "").trim()).join("·"));
    if (active !== "업무") throw new Error("closing the view left the app on the tab: " + (active || "none"));
    await openTodo(GOAL_WORK);
    if ((await overlayText()).includes("회의록 열기")) throw new Error("a goal-linked item offers the minutes button");
    await closeModal();
    // Leave the save as flow4 expects it: the memo and both planted work items gone.
    await page.evaluate((k, mid, wids) => {
      const s = JSON.parse(localStorage.getItem(k));
      s.meetings = (s.meetings || []).filter((m) => m.id !== mid);
      s.work = (s.work || []).filter((w) => !wids.includes(w.id));
      localStorage.setItem(k, JSON.stringify(s));
    }, KEY, MEMO_ID, [MEMO_WORK_ID, GOAL_WORK_ID]);
    await h.reload();
  });
};
