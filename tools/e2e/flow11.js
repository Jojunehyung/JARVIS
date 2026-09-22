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
      // v28: on the business track, so the packet steps below still see this project's meetings.
      st.meetingProjects = [{ id: pid, name: pname, createdAt: d, track: "biz" }, ...(st.meetingProjects || []).filter((p) => p.id !== pid)];
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
    // v28: the business track, so the work packet step below carries this item.
    await clickInModalExact("사업");
    await clickInModalExact("등록");
    await sleep(500);
    const rows = await workRows();
    const row = rows.find((r) => r.title === WORK_TITLE);
    if (!row || row.lead !== "수기" || row.marker !== "사업 · 프로젝트" || row.done) throw new Error("the work row: " + JSON.stringify(rows));
    const line = await countsLine();
    if (!line.startsWith("남음 1건 · 이월 0건 · 완료 0건 · AI 제안 0건")) throw new Error("counts after the add: " + line);
    const after = await readState();
    const w = (after.work || []).find((x) => x.title === WORK_TITLE);
    if (!w || w.date !== today || w.done !== false || w.source !== "manual" || w.note !== "○○물산" || w.createdAt !== today || w.track !== "biz") throw new Error("stored work item: " + JSON.stringify(w));
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
      st.work.push({ id, date: d, title, done: false, source: "manual", createdAt: d, track: "biz" }); // v28: carried into the work packet
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
    // v28: line 2 of a block ends with the event's track; the planted events carry none, so both read `직장`.
    for (const t of [P.name, `오늘 10:00 · ${E1.title} · 직장`, `내일 시간 미정 · ${M.title} · 직장`, `마지막 회의 ${M.date} · ${M.title}`, "결정: 월 10시간",
      `내 담당 · ${FU_TEXT} · 기한 없음 · 업무 없음`, `${M.date} 견적 초안 작성`]) {
      if (!lines.includes(t)) throw new Error(`the prep card lacks "${t}": ` + lines.join(" | "));
    }
    if (lines.indexOf(`오늘 10:00 · ${E1.title} · 직장`) > lines.indexOf(`내일 시간 미정 · ${M.title} · 직장`)) throw new Error("today's block is not listed before tomorrow's");
    // The block is a div since v27 (its checklist has controls of its own); the first `회의록 열기 ›` is today's block.
    await clickMain("회의록 열기 ›");
    await sleep(500);
    const view = await overlayText();
    if (!view.startsWith(M.title)) throw new Error("tapping the first block did not open the last meeting: " + view.slice(0, 120));
    await closeModal();
    await clickTab("할 일");
    await clickMain("브리핑 열기 ›");
    await sleep(400);
    await expectText("오늘 회의 준비 1건 · 직장 1 · 사업 0 · 개인 0 · 내일 1건");
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
    if (data.state?.v !== 28) throw new Error("backup schema version " + data.state?.v + " (expected 28)");
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
  // The paste pane is shared by the work and prep bridges.
  const pasteReply = async (reply) => {
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
    // v28: the generalised bridge component (shared with `reviewBridge`) keeps the work bridge's own title and caption.
    const sheet = await overlayText();
    if (!sheet.startsWith("오늘 업무 만들기")) throw new Error("the work bridge title changed: " + sheet.slice(0, 60));
    if (!sheet.includes("회의록 요약과 진행사항이 실려요 — 녹취록은 실리지 않아요.") || sheet.includes("다음 주 월요일")) throw new Error("the work bridge caption changed: " + sheet.slice(0, 300));
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
    await pasteReply(reply);
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
    await pasteReply(`분석 한 줄이에요.\n${JSON.stringify({ work: many, note: "한 줄" }, null, 2)}`);
    await expectText("제안 업무 확인 — 12건");
    await expectText("펜스 없는 답변 확인");
    await expectText("펜스 없는 답변 12");
    await closeModal();
  });

  await step("a work reply naming tasks, deals, events and meetings creates none of them", async () => {
    const before = await readState();
    await openWorkBridge();
    await pasteReply('```json\n{"tasks":[{"goal":"x","title":"독서 30분"}],"deals":[{"client":"c"}],"events":[{"title":"e"}],"meetings":[{"title":"m"}],"work":[]}\n```');
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
        createdAt: d, taskIds: [], progress: [], aiHidden: false, followUps: [], track: "biz" }, ...(s.meetings || []).filter((m) => m.id !== id)];
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

  /* ── Pre-meeting checks and the prep packet (schema v27, Phase 2, 2026-09-17): `확인할 것` on a project event, the third
     bridge packet and its reply, and `확인할 것 가져오기` into a new meeting's follow-up rows. Written, not run. The prep
     step above cleaned up its plants, so these steps plant their own: the project name contains the client word of the
     contract planted in the packet step. */
  const CHECK_A = "E2E 기존 확인", CHECK_B = "단가표 회신 여부", CHECK_C = "리스크: 일정 지연 가능성";
  const PP = { id: "e2e-prep-proj", name: "E2E물산 준비 프로젝트" };
  const PM = { id: "e2e-prep-mtg", title: "E2E 준비 회의" };
  const PE1 = { id: "e2e-prep-ev1", title: "E2E 준비 점검" };
  const DOC_P = { id: "e2e-prep-doc", title: "E2E 준비 문서" };
  const DOC_SENTINEL = "E2E-PREP-DOC-SENTINEL-2d9e";
  const HIDDEN = { id: "e2e-prep-hidden", title: "E2E 숨긴 회의" };
  const HIDDEN_SENTINEL = "E2E-HIDDEN-SENTINEL-4c11";
  const TRANSCRIPT_SENTINEL = "E2E-PREP-TRANSCRIPT-8a20";
  const PREP_DEAL_ID = "e2e-prep-deal", PLAIN_EVENT_ID = "e2e-prep-plain", CHECK_MEETING = "E2E 확인 회의";
  const eventOf = async (id) => ((await readState()).events || []).find((e) => e.id === id);
  // The prep card's text, whitespace-normalised, and its rose refusal line.
  const prepCardText = () => page.evaluate(() => {
    const sec = [...document.querySelectorAll("main section")].find((s) => (s.innerText || "").trim().startsWith("오늘 회의 준비"));
    return sec ? sec.innerText.replace(/\s+/g, " ").trim() : "";
  });
  const prepCardError = () => page.evaluate(() => {
    const sec = [...document.querySelectorAll("main section")].find((s) => (s.innerText || "").trim().startsWith("오늘 회의 준비"));
    const el = sec && [...sec.querySelectorAll(".text-rose-400")].find((e) => (e.innerText || "").trim());
    return el ? el.innerText.trim() : "";
  });
  const prepAiTags = () => page.evaluate(() => {
    const sec = [...document.querySelectorAll("main section")].find((s) => (s.innerText || "").trim().startsWith("오늘 회의 준비"));
    return sec ? [...sec.querySelectorAll("span")].filter((s) => (s.innerText || "").trim() === "AI").length : -1;
  });
  // A check write moves `events` only: every other top-level key, and every other event, stays byte-identical.
  const assertChecksOnly = (before, after, eventId, what) => {
    for (const key of Object.keys({ ...before, ...after })) {
      if (key === "events" || key === "lastTick") continue;
      if (JSON.stringify(before[key]) !== JSON.stringify(after[key])) throw new Error(`${what} changed ${key}`);
    }
    const rest = (st) => JSON.stringify((st.events || []).map((e) => (e.id === eventId ? { ...e, checks: null } : e)));
    if (rest(before) !== rest(after)) throw new Error(`${what} changed another event or another field of the event`);
  };
  // A proposal row of the prep confirm view whose text starts with `prefix`: `{ text, disabled, checked }`.
  const prepProposal = (prefix) => page.evaluate((t) => {
    const label = [...document.querySelectorAll(".fixed.inset-0 label")].find((l) => (l.querySelector(".text-sm")?.textContent || "").startsWith(t));
    if (!label) return null;
    const box = label.querySelector('input[type="checkbox"]');
    return { text: label.innerText.replace(/\s+/g, " ").trim(), disabled: !!box?.disabled, checked: !!box?.checked };
  }, prefix);
  const openPrepBridge = async () => { await clickTab("업무"); await clickMain("AI에게 회의 준비 묻기"); await sleep(400); await expectText("AI에게 회의 준비 묻기"); };

  await step("a check is added, ticked and deleted on the prep card, and only that event's checks change", async () => {
    const today = await dstrIn(0);
    PM.date = await dstrIn(-3);
    const hiddenCreated = await dstrIn(-4);
    await page.evaluate((k, pp, pm, pe1, doc, docSentinel, hidden, hiddenSentinel, trSentinel, t, hc) => {
      const st = JSON.parse(localStorage.getItem(k));
      // v28: the project, its document and its event are on the business track, so the prep packet may carry them.
      st.meetingProjects = [...(st.meetingProjects || []).filter((p) => p.id !== pp.id), { id: pp.id, name: pp.name, createdAt: pm.date, track: "biz" }];
      st.meetings = [...(st.meetings || []).filter((m) => ![pm.id, hidden.id].includes(m.id)),
        { id: pm.id, projectId: pp.id, date: pm.date, title: pm.title, summary: "준비 카드 확인용 회의", decisions: "월 10시간", transcript: trSentinel,
          createdAt: pm.date, taskIds: [], aiHidden: false, progress: [], followUps: [{ id: "e2e-prep-fu", text: "E2E 준비 자료 송부", mine: false, done: false }] },
        // Same date as PM but created earlier, so PM stays the project's last meeting on the card.
        { id: hidden.id, projectId: pp.id, date: pm.date, title: hidden.title, summary: "숨김 요약 " + hiddenSentinel, decisions: hiddenSentinel,
          createdAt: hc, taskIds: [], aiHidden: true, progress: [], followUps: [] }];
      st.documents = [...(st.documents || []).filter((d) => d.id !== doc.id),
        { id: doc.id, projectId: pp.id, title: doc.title, summary: "요구사항 요약 " + docSentinel, addedAt: t, track: "biz" }];
      st.events = [...(st.events || []).filter((e) => e.id !== pe1.id),
        { id: pe1.id, title: pe1.title, kind: "appt", date: t, time: "10:00", projectId: pp.id, createdAt: t, track: "biz" }];
      localStorage.setItem(k, JSON.stringify(st));
    }, KEY, PP, PM, PE1, DOC_P, DOC_SENTINEL, HIDDEN, HIDDEN_SENTINEL, TRANSCRIPT_SENTINEL, today, hiddenCreated);
    await h.reload();
    await clickTab("업무");
    let card = await prepCardText();
    for (const t of ["문서 1건", `${DOC_P.title} — `, "확인할 것 0/0", "확인할 것이 없어요.", "회의록 열기 ›", "AI에게 회의 준비 묻기",
      "확인할 것은 이 일정에 저장돼요 — 회의록을 쓸 때 후속 항목으로 가져올 수 있어요."]) {
      if (!card.includes(t)) throw new Error(`the prep card lacks "${t}": ` + card.slice(0, 400));
    }
    let before = await readState();
    await clickMain("추가");
    if ((await prepCardError()) !== "확인할 것을 입력해 주세요.") throw new Error("an empty check gave: " + ((await prepCardError()) || "no error"));
    await setValue('main input[placeholder^="확인할 것"]', "가".repeat(201));
    await clickMain("추가");
    if ((await prepCardError()) !== "확인할 것은 200자까지예요 — 지금 201자예요.") throw new Error("a 201-char check gave: " + ((await prepCardError()) || "no error"));
    if (JSON.stringify(await readState()) !== JSON.stringify(before)) throw new Error("a refused check reached the save");
    await setValue('main input[placeholder^="확인할 것"]', CHECK_A);
    await clickMain("추가");
    await expectText("확인할 것을 추가했어요");
    let after = await readState();
    const checks = (after.events.find((e) => e.id === PE1.id) || {}).checks || [];
    if (checks.length !== 1 || checks[0].text !== CHECK_A || checks[0].done !== false || checks[0].source !== "manual" || Object.keys(checks[0]).join() !== "id,text,done,source") {
      throw new Error("the stored check: " + JSON.stringify(checks));
    }
    const stray = after.events.filter((e) => e.id !== PE1.id && "checks" in e && !(before.events.find((b) => b.id === e.id) || {}).checks);
    if (stray.length) throw new Error("another event gained a checks key: " + stray.map((e) => e.title).join(", "));
    assertChecksOnly(before, after, PE1.id, "adding a check");
    if (JSON.stringify(h.recordBoundary(before)) !== JSON.stringify(h.recordBoundary(after))) throw new Error("adding a check moved the record boundary");
    if (await page.evaluate(() => document.querySelector('main input[placeholder^="확인할 것"]')?.value)) throw new Error("the check input was not cleared");
    if (!(await prepCardText()).includes("확인할 것 1/1")) throw new Error("the counter after the add: " + (await prepCardText()).slice(0, 300));
    before = after;
    await page.evaluate(() => document.querySelector('main input[aria-label="확인 완료"]').click());
    await sleep(400);
    await expectText("확인 완료로 표시했어요");
    after = await readState();
    if (after.events.find((e) => e.id === PE1.id).checks[0].done !== true) throw new Error("ticking did not store done");
    if (!(await prepCardText()).includes("확인할 것 0/1")) throw new Error("the counter after the tick: " + (await prepCardText()).slice(0, 300));
    assertChecksOnly(before, after, PE1.id, "ticking a check");
    await page.evaluate(() => document.querySelector('main input[aria-label="확인 완료"]').click());
    await sleep(400);
    await expectText("확인 완료를 취소했어요");
    if ((await eventOf(PE1.id)).checks[0].done !== false) throw new Error("unticking did not store done: false");
    before = await readState();
    await page.evaluate(() => {
      window.__confirmText = null;
      window.confirm = (msg) => { window.__confirmText = msg; return true; };
      document.querySelector('main button[aria-label="확인할 것 삭제"]').click();
    });
    await sleep(400);
    const asked = await page.evaluate(() => window.__confirmText);
    if (asked !== "확인할 것을 삭제해요. 계속할까요?") throw new Error("the delete confirm text: " + JSON.stringify(asked));
    await expectText("확인할 것을 삭제했어요");
    after = await readState();
    if (JSON.stringify(after.events.find((e) => e.id === PE1.id).checks) !== "[]") throw new Error("the deleted check stayed: " + JSON.stringify(after.events.find((e) => e.id === PE1.id).checks));
    assertChecksOnly(before, after, PE1.id, "deleting a check");
    // The packet step needs one existing check.
    await setValue('main input[placeholder^="확인할 것"]', CHECK_A);
    await clickMain("추가");
    card = await prepCardText();
    if (!card.includes("확인할 것 1/1") || !card.includes(CHECK_A)) throw new Error("the re-added check: " + card.slice(0, 300));
  });

  await step("the event sheet shows the same checklist for a project-linked event and nothing for a plain appointment", async () => {
    await clickTab("할 일");
    await openTodo(PE1.title);
    const sheet = await overlayText();
    for (const t of [`프로젝트 · ${PP.name}`, "확인할 것 1/1", CHECK_A, "목표 기여 없음"]) if (!sheet.includes(t)) throw new Error(`the event sheet lacks "${t}": ` + sheet.slice(0, 300));
    if (sheet.indexOf("확인할 것 1/1") > sheet.indexOf("목표 기여 없음")) throw new Error("the checklist is not above the no-goal line");
    await closeModal();
    const today = await dstrIn(0);
    await page.evaluate((k, id, t) => {
      const st = JSON.parse(localStorage.getItem(k));
      st.events = [...(st.events || []).filter((e) => e.id !== id), { id, title: "E2E 일반 약속", kind: "appt", date: t, time: "15:00", createdAt: t }];
      localStorage.setItem(k, JSON.stringify(st));
    }, KEY, PLAIN_EVENT_ID, today);
    await h.reload();
    await clickTab("할 일");
    await openTodo("E2E 일반 약속");
    const plain = await overlayText();
    if (!plain.startsWith("일정 — E2E 일반 약속")) throw new Error("the plain appointment's sheet did not open: " + plain.slice(0, 120));
    if (plain.includes("확인할 것") || plain.includes("프로젝트 ·")) throw new Error("a plain appointment's sheet shows a checklist: " + plain.slice(0, 300));
    await closeModal();
    await page.evaluate((k, id) => {
      const st = JSON.parse(localStorage.getItem(k));
      st.events = (st.events || []).filter((e) => e.id !== id);
      localStorage.setItem(k, JSON.stringify(st));
    }, KEY, PLAIN_EVENT_ID);
    await h.reload();
  });

  await step("the prep packet carries the event line, the existing checks, the project's minutes, the document summary and the same-client contract, and none of a hidden meeting's body, a transcript or a profile identifier", async () => {
    const today = await dstrIn(0);
    await openPrepBridge();
    if (!(await overlayText()).includes("녹취록·이름·연락처·문서 출처는 실리지 않아요.")) throw new Error("the prep bridge caption does not state what stays out");
    let txt = await packetText();
    for (const t of [`[인생 관리 — 회의 준비 요청 ${today}]`, "## 회의", `- ${today} 10:00 · ${PE1.title} · 프로젝트 ${PP.name}`, "## 확인할 것 (이미 있음)", `- ${CHECK_A} · 미완료`,
      "## 최근 회의록 (", `[${PP.name}] ${PM.title}`, "결정: 월 10시간", "## 문서 (1건)", `- ${today} ${DOC_P.title}`, DOC_SENTINEL, "## 열린 할 일 (회의록 연결)", "## 계약 (같은 고객사)"]) {
      if (!txt.includes(t)) throw new Error(`the prep packet lacks "${t}" (${txt.length} chars)`);
    }
    const iHidden = txt.indexOf(`- ${PM.date} ${HIDDEN.title}`);
    if (iHidden < 0 || !txt.slice(iHidden).split("\n")[1].includes("내용 비공개 (AI에 보내지 않기)")) throw new Error("the hidden meeting is not stated as date and title only");
    if (txt.includes(HIDDEN_SENTINEL)) throw new Error("the hidden meeting's body reached the prep packet");
    if (txt.includes(TRANSCRIPT_SENTINEL)) throw new Error("a transcript reached the prep packet");
    if (txt.includes("## 이력")) throw new Error("the prep packet carries a CV section");
    const p = (await readState()).profile || {};
    for (const t of [p.name, p.email, p.phone].filter(Boolean)) if (txt.includes(t)) throw new Error("the prep packet carries a profile identifier: " + t);
    if (txt.length > 20000) throw new Error("the prep packet exceeds the 20000-char cap: " + txt.length);
    await closeModal();
    // A won contract whose client is part of the project name, billed from this month.
    const month = today.slice(0, 7);
    await page.evaluate((k, id, m, t) => {
      const st = JSON.parse(localStorage.getItem(k));
      st.deals = [...(st.deals || []).filter((d) => d.id !== id),
        { id, client: "E2E물산", title: "E2E 준비 계약", status: "won", monthly: 1000000, months: 3, startMonth: m, paidMonths: [], createdAt: t }];
      localStorage.setItem(k, JSON.stringify(st));
    }, KEY, PREP_DEAL_ID, month, today);
    await h.reload();
    await openPrepBridge();
    txt = await packetText();
    const deals = txt.slice(txt.indexOf("## 계약 (같은 고객사)")).split("\n## ")[0];
    if (!deals.includes(`- 진행 중 · E2E물산 E2E 준비 계약 · ${month} ~ `) || !deals.includes(`  미수 ${month} 100만원`)) throw new Error("the same-client contract section: " + deals.slice(0, 300));
    await closeModal();
    await page.evaluate((k, id) => {
      const st = JSON.parse(localStorage.getItem(k));
      st.deals = (st.deals || []).filter((d) => d.id !== id);
      localStorage.setItem(k, JSON.stringify(st));
    }, KEY, PREP_DEAL_ID);
    await h.reload();
  });

  await step("a pasted prep reply imports the ticked checks with source ai, folds the basis, refuses a duplicate, and a reply carrying tasks, work and deals keys creates nothing", async () => {
    const before = await readState();
    const reply = ["분석 두 줄이에요.", "회의 준비 항목이에요.", "```json", JSON.stringify({
      checks: [{ text: CHECK_A, basis: "x" }, { text: CHECK_B, basis: "유지보수 범위 협의 " + PM.date }, { text: CHECK_C }],
      tasks: [{ title: "독서 30분" }], work: [{ title: "E2E 업무" }], deals: [{ client: "X" }], note: "세 건을 제안해요.",
    }), "```"].join("\n");
    await openPrepBridge();
    await pasteReply(reply);
    await expectText("확인할 것 제안 — 3건");
    await expectText("세 건을 제안해요.");
    const dup = await prepProposal(CHECK_A);
    if (!dup || !dup.disabled || dup.checked || !dup.text.includes("이미 확인할 것에 있어요")) throw new Error("the duplicate row is not refused: " + JSON.stringify(dup));
    const folded = await prepProposal(CHECK_B);
    if (!folded || folded.disabled || !folded.checked || !folded.text.includes(`근거: 유지보수 범위 협의 ${PM.date}`)) throw new Error("the row with a basis: " + JSON.stringify(folded));
    const bare = await prepProposal(CHECK_C);
    if (!bare || bare.disabled || !bare.checked || !bare.text.includes("근거 없음")) throw new Error("the row without a basis: " + JSON.stringify(bare));
    await clickInModalExact("선택한 항목 등록");
    await expectText("AI 제안 확인할 것 2건 등록");
    await sleep(500);
    const after = await readState();
    const checks = after.events.find((e) => e.id === PE1.id).checks;
    if (checks.length !== 3) throw new Error("checks after the import: " + JSON.stringify(checks));
    const made = checks.slice(1);
    if (!made.every((c) => c.source === "ai" && c.done === false)) throw new Error("an imported check is not an open AI item: " + JSON.stringify(made));
    if (made[0].text !== `${CHECK_B} — 유지보수 범위 협의 ${PM.date}` || made[1].text !== CHECK_C) throw new Error("the imported texts: " + JSON.stringify(made.map((c) => c.text)));
    for (const key of ["tasks", "work", "deals", "meetings", "documents", "journal"]) {
      if (JSON.stringify(after[key] || []) !== JSON.stringify(before[key] || [])) throw new Error(`a prep reply changed ${key}`);
    }
    assertChecksOnly(before, after, PE1.id, "importing prep proposals");
    const card = await prepCardText();
    if (!card.includes("확인할 것 3/3")) throw new Error("the prep card after the import: " + card.slice(0, 300));
    if ((await prepAiTags()) !== 2) throw new Error("AI tags on the prep card: " + (await prepAiTags()));
    // At the 30-item cap a ticked proposal is refused in the confirm view and nothing is written.
    const three = checks;
    await page.evaluate((k, id) => {
      const st = JSON.parse(localStorage.getItem(k));
      st.events.find((e) => e.id === id).checks = Array.from({ length: 30 }, (_, n) => ({ id: `e2e-cap-check-${n}`, text: `E2E 한도 확인 ${n + 1}`, done: false, source: "manual" }));
      localStorage.setItem(k, JSON.stringify(st));
    }, KEY, PE1.id);
    await h.reload();
    await openPrepBridge();
    await pasteReply('```json\n{"checks":[{"text":"E2E 한도 넘는 제안"}]}\n```');
    await clickInModalExact("선택한 항목 등록");
    const e = await modalError();
    if (e !== "확인할 것은 30건까지예요 — 0건만 등록할 수 있어요.") throw new Error("the cap refusal: " + (e || "no error"));
    if ((await eventOf(PE1.id)).checks.length !== 30) throw new Error("an over-cap import reached the save");
    await closeModal();
    await page.evaluate((k, id, list) => {
      const st = JSON.parse(localStorage.getItem(k));
      st.events.find((x) => x.id === id).checks = list;
      localStorage.setItem(k, JSON.stringify(st));
    }, KEY, PE1.id, three);
    await h.reload();
  });

  // The daily reader (v27, Phase 3, written, not run). It runs before the import-checks step, which writes a newer meeting
  // on the project (so the card's last meeting would no longer carry `월 10시간`) and removes every plant.
  const READER_WORK = { id: "e2e-reader-work", title: "E2E 오늘 읽을 업무", note: "E2E 읽을 메모" };
  const READER_DONE = { id: "e2e-reader-done", title: "E2E 어제 완료", result: "E2E 처리 내용" };
  const READER_FU = { id: "e2e-reader-fu", text: "E2E 읽을 후속" };
  // The reader's section blocks, in order, each whitespace-normalised.
  const readerSections = () => page.evaluate(() => {
    const ov = [...document.querySelectorAll(".fixed.inset-0")].pop();
    return ov ? [...ov.querySelectorAll(".bg-zinc-950.rounded-xl")].map((b) => b.innerText.replace(/\s+/g, " ").trim()) : [];
  });

  await step("the reader states the prep row with its checks and documents, today's work, the last week's decisions and what arrived since the last run", async () => {
    const today = await dstrIn(0), yesterday = await dstrIn(-1), since = await dstrIn(-3), overdue = await dstrIn(-2);
    const plain = await readState();
    await page.evaluate((k, ids, t, y, s3, od) => {
      const st = JSON.parse(localStorage.getItem(k));
      st.act.briefingSeen = s3;
      st.work = [...(st.work || []),
        { id: ids.work.id, date: t, title: ids.work.title, note: ids.work.note, done: false, source: "manual", createdAt: t },
        { id: ids.done.id, date: y, title: ids.done.title, result: ids.done.result, done: true, source: "manual", createdAt: y }];
      const pm = st.meetings.find((m) => m.id === ids.meeting);
      pm.followUps = [...pm.followUps, { id: ids.fu.id, text: ids.fu.text, mine: true, due: od, done: false }];
      localStorage.setItem(k, JSON.stringify(st));
    }, KEY, { work: READER_WORK, done: READER_DONE, fu: READER_FU, meeting: PM.id }, today, yesterday, since, overdue);
    await h.reload({}, { keepModal: true });
    await sleep(700);
    const before = await readState();
    const title = await overlayText();
    if (!title.startsWith(`오늘 읽을 것 — ${today}`)) throw new Error("the reader did not open on load: " + title.slice(0, 80));
    if (title.includes(TRANSCRIPT_SENTINEL)) throw new Error("the reader shows a transcript");
    const secs = await readerSections();
    const want = [
      ["오늘·내일 회의 준비", [`오늘 10:00 · ${PE1.title} · ${PP.name}`, "확인할 것 3/3", `- ${CHECK_A}`, "결정: 월 10시간",
        `후속 · 내 담당 · ${READER_FU.text} · 기한 ${overdue}`, "후속 · 타인 · E2E 준비 자료 송부 · 기한 없음", `문서: ${DOC_P.title}`]],
      ["오늘 업무", [READER_WORK.title, `메모: ${READER_WORK.note}`, `어제 완료 · ${READER_DONE.title}`, `처리: ${READER_DONE.result}`]],
      ["기한 지난 후속 · 내 담당 미완료 후속", [`${PM.title} · ${READER_FU.text} · 기한 ${overdue} (D+2)`]],
      ["최근 7일 결정 사항", [`${PM.date} ${PM.title}`, "월 10시간"]],
      [`${since} 이후 새로 들어온 것`, [`회의록 · ${PM.date} ${PM.title} · ${PP.name}`, `문서 · ${DOC_P.title} · ${PP.name}`]],
      ["계약·입금 미확인", ["이번 달 계약 매출"]],
      ["뒤처진 목표 페이스", []],
    ];
    if (secs.length !== want.length) throw new Error(`the reader has ${secs.length} section blocks: ` + secs.map((x) => x.slice(0, 20)).join(" | "));
    want.forEach(([head, lines], i) => {
      if (!secs[i].startsWith(head)) throw new Error(`section ${i + 1} starts: ${secs[i].slice(0, 60)}`);
      for (const t of lines) if (!secs[i].includes(t)) throw new Error(`section ${i + 1} (${head}) lacks "${t}": ` + secs[i].slice(0, 400));
    });
    if (secs[2].includes("E2E 준비 자료 송부")) throw new Error("the follow-up section lists another person's item with no due date");
    await closeModal();
    await sleep(400);
    const after = await readState();
    for (const key of Object.keys({ ...before, ...after })) {
      if (key === "lastTick") continue;
      const strip = (v) => JSON.stringify(key === "act" ? { ...v, briefingSeen: null } : v);
      if (strip(before[key]) !== strip(after[key])) throw new Error(`reading and closing the reader changed ${key}`);
    }
    if (after.act.briefingSeen !== today) throw new Error("closing the reader did not stamp the day: " + after.act.briefingSeen);
    // Remove the reader's plants; the prep fixtures stay for the next step.
    await page.evaluate((k, ids) => {
      const st = JSON.parse(localStorage.getItem(k));
      st.work = (st.work || []).filter((w) => ![ids.work, ids.done].includes(w.id));
      const pm = st.meetings.find((m) => m.id === ids.meeting);
      pm.followUps = pm.followUps.filter((f) => f.id !== ids.fu);
      localStorage.setItem(k, JSON.stringify(st));
    }, KEY, { work: READER_WORK.id, done: READER_DONE.id, fu: READER_FU.id, meeting: PM.id });
    await h.reload();
    const back = await readState();
    for (const key of ["work", "meetings", "events", "documents", "tasks", "goals"]) {
      if (JSON.stringify(back[key] || []) !== JSON.stringify(plain[key] || [])) throw new Error(`the reader step left ${key} changed`);
    }
  });

  await step("the import-checks button copies the event's checks into a new meeting's follow-up rows without changing the event", async () => {
    const before = await readState();
    const checks = before.events.find((e) => e.id === PE1.id).checks;
    await clickTab("미팅");
    const opened = await page.evaluate((n) => {
      const sec = [...document.querySelectorAll("main section")].find((s) => (s.querySelector(".font-bold.truncate")?.innerText || "").trim() === n);
      const b = sec && [...sec.querySelectorAll("button")].find((x) => (x.innerText || "").trim() === "회의록 추가");
      if (!b) return false;
      b.click(); return true;
    }, PP.name);
    if (!opened) throw new Error("no add-minutes button in the project's section");
    await sleep(400);
    await expectText("새 회의록");
    if ((await overlayText()).includes("확인할 것 가져오기")) throw new Error("the import button shows before an event is linked");
    await clickInModalExact(`10:00 ${PE1.title}`);
    const label = `확인할 것 가져오기 (${checks.length}건)`;
    await clickInModalExact(label);
    const rowsOf = () => page.evaluate(() => [...document.querySelectorAll('.fixed.inset-0 input[placeholder^="후속 항목"]')].map((i) => {
      const chip = [...i.closest(".space-y-1\\.5").querySelectorAll("button")].find((b) => (b.innerText || "").trim() === "내 담당");
      return { text: i.value, mine: !!chip && /bg-cyan-400/.test(chip.className) };
    }));
    let rows = await rowsOf();
    if (JSON.stringify(rows.map((r) => r.text)) !== JSON.stringify(checks.map((c) => c.text)) || rows.some((r) => r.mine)) throw new Error("the copied follow-up rows: " + JSON.stringify(rows));
    if (!(await overlayText()).includes(`확인할 것 ${checks.length}건을 가져왔어요 — 이미 있는 0건은 건너뛰었어요.`)) throw new Error("the first copy line is missing");
    await clickInModalExact(label);
    if (!(await overlayText()).includes(`이미 있는 ${checks.length}건은 건너뛰었어요`)) throw new Error("the second copy does not state the skipped rows");
    rows = await rowsOf();
    if (rows.length !== checks.length) throw new Error("the second copy appended rows: " + rows.length);
    await typeInto("회의 이름", CHECK_MEETING);
    await setValue('.fixed.inset-0 textarea[placeholder^="회의 요약"]', "확인할 것 가져오기 확인");
    await clickInModalExact("등록");
    await sleep(600);
    const after = await readState();
    const m = (after.meetings || []).find((x) => x.title === CHECK_MEETING);
    if (!m || m.followUps.length !== checks.length || !m.followUps.every((f) => f.mine === false && f.done === false)) throw new Error("the saved follow-ups: " + JSON.stringify(m?.followUps));
    if (m.eventId !== PE1.id) throw new Error("the meeting is not linked to the event: " + m.eventId);
    if (JSON.stringify(after.events.find((e) => e.id === PE1.id).checks) !== JSON.stringify(checks)) throw new Error("copying the checks changed the event's checks");
    if (JSON.stringify(after.work || []) !== JSON.stringify(before.work || [])) throw new Error("copying the checks created a work item");
    // Clean up every Phase 2 plant so flow4 sees the save it used to.
    await page.evaluate((k, ids) => {
      const st = JSON.parse(localStorage.getItem(k));
      st.meetingProjects = (st.meetingProjects || []).filter((p) => p.id !== ids.project);
      st.meetings = (st.meetings || []).filter((x) => ![ids.meeting, ids.hidden].includes(x.id) && x.title !== ids.checkMeeting);
      st.documents = (st.documents || []).filter((d) => d.id !== ids.doc);
      st.events = (st.events || []).filter((e) => e.id !== ids.event);
      localStorage.setItem(k, JSON.stringify(st));
    }, KEY, { project: PP.id, meeting: PM.id, hidden: HIDDEN.id, checkMeeting: CHECK_MEETING, doc: DOC_P.id, event: PE1.id });
    await h.reload();
  });

  /* ── Tracks (schema v28, Phase 1, 2026-09-17): the day's work grouped by track, the day-job track kept out of every
     packet, and the reader and the briefing stating each track in order. Written under the standing instruction; not run. */
  const TRACK_ITEMS = [
    { id: "e2e-track-personal", title: "E2E 개인 업무", track: "personal" },
    { id: "e2e-track-biz", title: "E2E 사업 업무", track: "biz" },
    { id: "e2e-track-work", title: "E2E 직장 업무", track: "work" },
  ];
  // Whether the chip of that exact label in the open sheet is on (`bg-cyan-400`), or null when absent.
  const chipOn = (label) => page.evaluate((l) => {
    const ov = [...document.querySelectorAll(".fixed.inset-0")].pop();
    const b = ov && [...ov.querySelectorAll("button")].find((x) => (x.innerText || "").trim() === l);
    return b ? /bg-cyan-400/.test(b.className || "") : null;
  }, label);
  // The work list section's text (the one holding the `선택` button or the empty line), whitespace-normalised.
  const workListText = () => page.evaluate(() => {
    const secs = [...document.querySelectorAll("main section")];
    const sec = secs.find((s) => [...s.querySelectorAll("button")].some((b) => (b.innerText || "").trim() === "선택"));
    return sec ? sec.innerText.replace(/\s+/g, " ").trim() : "";
  });
  const inOrder = (text, parts) => { let at = -1; return parts.every((p) => { const i = text.indexOf(p, at + 1); if (i < 0) return false; at = i; return true; }); };

  await step("the work tab groups the day by track in reading order", async () => {
    const today = await dstrIn(0);
    // Planted in reverse reading order, so the grouping — not the insertion order — decides the screen order.
    await page.evaluate((k, items, d) => {
      const st = JSON.parse(localStorage.getItem(k));
      const ids = new Set(items.map((w) => w.id));
      st.work = [...(st.work || []).filter((w) => !ids.has(w.id)),
        ...items.map((w) => ({ id: w.id, date: d, title: w.title, done: false, source: "manual", createdAt: d, track: w.track }))];
      localStorage.setItem(k, JSON.stringify(st));
    }, KEY, TRACK_ITEMS, today);
    await h.reload();
    await clickTab("업무");
    const titles = (await workRows()).map((r) => r.title).filter((t) => TRACK_ITEMS.some((w) => w.title === t));
    if (JSON.stringify(titles) !== JSON.stringify(["E2E 직장 업무", "E2E 사업 업무", "E2E 개인 업무"])) throw new Error("the rows are not in track order: " + JSON.stringify(titles));
    const list = await workListText();
    if (!inOrder(list, ["직장 1건", "E2E 직장 업무", "사업 1건", "E2E 사업 업무", "개인 1건", "E2E 개인 업무"])) throw new Error("the track heads: " + list.slice(0, 300));
    const markers = (await workRows()).filter((r) => TRACK_ITEMS.some((w) => w.title === r.title)).map((r) => r.marker);
    if (JSON.stringify(markers) !== JSON.stringify(["직장", "사업", "개인"])) throw new Error("the row markers: " + JSON.stringify(markers));
    // The sheet's chips round-trip the field.
    const trackOfItem = async (id) => ((await readState()).work || []).find((w) => w.id === id)?.track;
    await openTodo("E2E 직장 업무");
    // The track caption shows only while day-job records are switched off (`settings.workInAi` false); this save leaves it on.
    if ((await h.overlayText()).includes("직장 트랙은 AI 패킷에 실리지 않아요.")) throw new Error("the track caption shows while day-job records go into packets");
    if ((await chipOn("직장")) !== true) throw new Error("the sheet does not open on the item's track");
    await clickInModalExact("개인");
    await clickInModalExact("저장");
    await sleep(500);
    if ((await trackOfItem("e2e-track-work")) !== "personal") throw new Error("the sheet did not store the chosen track");
    await openTodo("E2E 직장 업무");
    if ((await chipOn("개인")) !== true) throw new Error("the sheet does not reopen on the stored track");
    await clickInModalExact("직장");
    await clickInModalExact("저장");
    await sleep(500);
    if ((await trackOfItem("e2e-track-work")) !== "work") throw new Error("the sheet did not store the track back");
  });

  await step("the reader and the briefing state each track in order", async () => {
    const today = await dstrIn(0);
    // A project event today on each track, so the briefing's prep line counts one per track.
    await page.evaluate((k, d) => {
      const st = JSON.parse(localStorage.getItem(k));
      const tracks = ["work", "biz", "personal"];
      st.meetingProjects = [...(st.meetingProjects || []).filter((p) => !p.id.startsWith("e2e-track-proj-")),
        ...tracks.map((t) => ({ id: "e2e-track-proj-" + t, name: "E2E 트랙 프로젝트 " + t, createdAt: d, track: t }))];
      st.events = [...(st.events || []).filter((e) => !e.id.startsWith("e2e-track-ev-")),
        ...tracks.map((t) => ({ id: "e2e-track-ev-" + t, title: "E2E 트랙 회의 " + t, kind: "appt", date: d, time: "16:00", projectId: "e2e-track-proj-" + t, createdAt: d, track: t }))];
      localStorage.setItem(k, JSON.stringify(st));
    }, KEY, today);
    await h.reload();
    await clickTab("프로필");
    await clickMain("오늘 읽을 것 ›");
    await sleep(500);
    const work = (await readerSections()).find((s) => s.startsWith("오늘 업무"));
    if (!work || !inOrder(work, ["직장 1건", "E2E 직장 업무", "사업 1건", "E2E 사업 업무", "개인 1건", "E2E 개인 업무"])) throw new Error("the reader's work section: " + String(work).slice(0, 300));
    const prep = (await readerSections()).find((s) => s.startsWith("오늘·내일 회의 준비"));
    if (!prep || !inOrder(prep, ["직장 1건", "E2E 트랙 회의 work", "사업 1건", "E2E 트랙 회의 biz", "개인 1건", "E2E 트랙 회의 personal"])) throw new Error("the reader's prep section: " + String(prep).slice(0, 300));
    await closeModal();
    await clickTab("할 일");
    await clickMain("브리핑 열기 ›");
    await sleep(400);
    const line = await page.evaluate(() => {
      const ov = [...document.querySelectorAll(".fixed.inset-0")].pop();
      const b = ov && [...ov.querySelectorAll("button")].find((x) => (x.innerText || "").replace(/\s+/g, " ").trim().startsWith("오늘 회의 준비"));
      return b ? b.innerText.replace(/\s+/g, " ").trim() : "";
    });
    if (!line.startsWith("오늘 회의 준비 3건 · 직장 1 · 사업 1 · 개인 1")) throw new Error("the briefing's prep line: " + JSON.stringify(line));
    if (!inOrder(line, ["직장", "사업", "개인"])) throw new Error("the briefing's prep line is not in track order: " + line);
    const brief = await overlayText();
    if (!inOrder(brief, ["직장 · E2E 트랙 회의 work", "사업 · E2E 트랙 회의 biz", "개인 · E2E 트랙 회의 personal"])) throw new Error("the briefing's schedule lines: " + brief.slice(0, 400));
    await closeModal();
    // Leave the save as the next step expects it: no track plants.
    await page.evaluate((k) => {
      const st = JSON.parse(localStorage.getItem(k));
      st.work = (st.work || []).filter((w) => !w.id.startsWith("e2e-track-"));
      st.events = (st.events || []).filter((e) => !e.id.startsWith("e2e-track-ev-"));
      st.meetingProjects = (st.meetingProjects || []).filter((p) => !p.id.startsWith("e2e-track-proj-"));
      localStorage.setItem(k, JSON.stringify(st));
    }, KEY);
    await h.reload();
  });

  /* 2026-09-22: day-job records go into the packets unless the settings switch `settings.workInAi` is false. The first
     half plants the switch off and keeps every v28 exclusion assertion; the second half removes it (absent reads as on). */
  await step("with day-job records switched off none enters a packet; with the switch absent they do", async () => {
    const WORK_SENTINEL = "E2E-WORK-TRACK-SENTINEL-51aa";
    const JOB = { project: "e2e-job-proj", meeting: "e2e-job-mtg", work: "e2e-job-work", event: "e2e-job-ev", deal: "e2e-job-deal", mixed: "e2e-job-ev-biz" };
    const MIXED_TITLE = "E2E 사업 혼합 일정";
    const JOB_PROJECT = "E2E 직장 프로젝트";
    const today = await dstrIn(0);
    await page.evaluate((k, ids, name, s, d) => {
      const st = JSON.parse(localStorage.getItem(k));
      st.meetingProjects = [...(st.meetingProjects || []).filter((p) => p.id !== ids.project), { id: ids.project, name, createdAt: d, track: "work" }];
      st.meetings = [...(st.meetings || []).filter((m) => m.id !== ids.meeting), { id: ids.meeting, projectId: ids.project, date: d, title: "E2E 직장 회의",
        summary: "직장 요약 " + s + "-meeting", createdAt: d, taskIds: [], progress: [], aiHidden: false, followUps: [] }];
      st.work = [...(st.work || []).filter((w) => w.id !== ids.work), { id: ids.work, date: d, title: "E2E 직장 " + s + "-item", done: false, source: "manual", createdAt: d, track: "work" }];
      // The second event is on the business track but linked to the day-job project: its packet must not name the project.
      st.events = [...(st.events || []).filter((e) => e.id !== ids.event && e.id !== ids.mixed), { id: ids.event, title: "E2E 직장 일정 " + s + "-event", kind: "appt", date: d, time: "17:00",
        projectId: ids.project, createdAt: d, track: "work" },
        { id: ids.mixed, title: "E2E 사업 혼합 일정", kind: "appt", date: d, time: "18:00", projectId: ids.project, createdAt: d, track: "biz" }];
      st.deals = [...(st.deals || []).filter((x) => x.id !== ids.deal), { id: ids.deal, client: "E2E 직장고객", title: "E2E 직장 계약 " + s + "-deal", status: "won",
        monthly: 1000000, months: 2, startMonth: d.slice(0, 7), paidMonths: [], createdAt: d, track: "work" }];
      st.settings = { ...(st.settings || {}), workInAi: false };
      localStorage.setItem(k, JSON.stringify(st));
    }, KEY, JOB, JOB_PROJECT, WORK_SENTINEL, today);
    await h.reload();
    // The meetings the work packet may carry: every meeting whose track (a memo's own, else its project's) is a packet track.
    const packetMeetings = (st) => (st.meetings || []).filter((m) => {
      const t = m.projectId == null ? m.track : (st.meetingProjects || []).find((p) => p.id === m.projectId)?.track;
      return ["biz", "personal"].includes(t);
    }).length;
    await openWorkBridge();
    await expectText("직장 트랙 기록은 실리지 않아요.");
    let txt = await packetText();
    await closeModal();
    if (txt.includes(WORK_SENTINEL) || txt.includes(JOB_PROJECT)) throw new Error("a day-job record reached the work packet: " + txt.slice(0, 400));
    const n = Math.min(10, packetMeetings(await readState()));
    if (!txt.includes(`## 최근 회의록 (${n}건)`)) throw new Error(`the meetings heading does not count ${n}: ` + (txt.match(/## 최근 회의록 \(\d+건\)/) || [""])[0]);
    await clickTab("할 일");
    await clickMain("브리핑 열기 ›");
    await sleep(400);
    await h.clickInModal("AI에게 보내기");
    await sleep(500);
    await expectText("직장 트랙 기록은 실리지 않아요.");
    const daily = await packetText();
    await closeModal();
    if (!daily || daily.includes(WORK_SENTINEL) || daily.includes(JOB_PROJECT)) throw new Error("a day-job record reached the daily packet: " + daily.slice(0, 400));
    await clickTab("업무");
    const block = await page.evaluate((title) => {
      const sec = [...document.querySelectorAll("main section")].find((s) => (s.innerText || "").trim().startsWith("오늘 회의 준비"));
      const div = sec && [...sec.querySelectorAll(".bg-zinc-950.rounded-xl")].find((b) => (b.innerText || "").includes(title));
      return div ? { text: div.innerText.replace(/\s+/g, " ").trim(), ask: [...div.querySelectorAll("button")].some((b) => (b.innerText || "").trim() === "AI에게 회의 준비 묻기") } : null;
    }, WORK_SENTINEL + "-event");
    if (!block || !block.text.endsWith("직장 트랙 — AI 패킷에 실리지 않아요") || block.ask) throw new Error("the day-job prep block: " + JSON.stringify(block));
    // A business event linked to the day-job project: its prep packet is the event line alone — no project name, no
    // minutes, documents, tasks or contracts derived from that project.
    const asked = await page.evaluate((title) => {
      const sec = [...document.querySelectorAll("main section")].find((s) => (s.innerText || "").trim().startsWith("오늘 회의 준비"));
      const div = sec && [...sec.querySelectorAll(".bg-zinc-950.rounded-xl")].find((b) => (b.innerText || "").includes(title));
      const b = div && [...div.querySelectorAll("button")].find((x) => (x.innerText || "").trim() === "AI에게 회의 준비 묻기");
      if (!b) return false;
      b.click(); return true;
    }, MIXED_TITLE);
    if (!asked) throw new Error("the business event linked to the day-job project offers no ask button");
    await sleep(400);
    const mixed = await packetText();
    await closeModal();
    if (mixed.includes(JOB_PROJECT) || mixed.includes(WORK_SENTINEL)) throw new Error("the day-job project reached a prep packet: " + mixed.slice(0, 400));
    const heads = mixed.split("\n").filter((l) => l.startsWith("## "));
    if (JSON.stringify(heads) !== JSON.stringify(["## 회의"]) || !mixed.includes(`- ${today} 18:00 · ${MIXED_TITLE}`)) throw new Error("the mixed prep packet: " + mixed.slice(-300));
    // Flip the project to the business track through its form: the meeting inherits, the work item and the deal keep their own track.
    await clickTab("미팅");
    const opened = await page.evaluate((name) => {
      const sec = [...document.querySelectorAll("main section")].find((s) => (s.querySelector(".font-bold.truncate")?.innerText || "").trim() === name);
      const b = sec && [...sec.querySelectorAll("button")].find((x) => (x.innerText || "").trim() === "프로젝트 수정");
      if (!b) return false;
      b.click(); return true;
    }, JOB_PROJECT);
    if (!opened) throw new Error("no edit button in the day-job project's section");
    await sleep(400);
    await clickInModalExact("사업");
    await clickInModalExact("저장");
    await sleep(500);
    await h.reload();
    if (((await readState()).meetingProjects || []).find((p) => p.id === JOB.project)?.track !== "biz") throw new Error("the project form did not store the business track");
    await openWorkBridge();
    txt = await packetText();
    await closeModal();
    if (!txt.includes(WORK_SENTINEL + "-meeting")) throw new Error("the flipped project's meeting is not in the work packet");
    if (txt.includes(WORK_SENTINEL + "-item") || txt.includes(WORK_SENTINEL + "-deal") || txt.includes(WORK_SENTINEL + "-event")) throw new Error("a record still on the day-job track reached the work packet");
    // Second half: the project back on the day-job track and the switch absent (on) — the day-job meeting, work item and
    // event go into the work packet, and the prep card offers the ask button for the day-job event.
    await page.evaluate((k, ids) => {
      const st = JSON.parse(localStorage.getItem(k));
      st.meetingProjects = (st.meetingProjects || []).map((p) => (p.id === ids.project ? { ...p, track: "work" } : p));
      if (st.settings) delete st.settings.workInAi;
      localStorage.setItem(k, JSON.stringify(st));
    }, KEY, JOB);
    await h.reload();
    await openWorkBridge();
    if ((await overlayText()).includes("직장 트랙 기록은 실리지 않아요.")) throw new Error("the work bridge still says day-job records stay out");
    txt = await packetText();
    await closeModal();
    for (const t of [`[${JOB_PROJECT}] E2E 직장 회의`, WORK_SENTINEL + "-meeting", WORK_SENTINEL + "-item", WORK_SENTINEL + "-event"]) {
      if (!txt.includes(t)) throw new Error(`with the switch absent the work packet lacks "${t}"`);
    }
    await clickTab("업무");
    const onBlock = await page.evaluate((title) => {
      const sec = [...document.querySelectorAll("main section")].find((s) => (s.innerText || "").trim().startsWith("오늘 회의 준비"));
      const div = sec && [...sec.querySelectorAll(".bg-zinc-950.rounded-xl")].find((b) => (b.innerText || "").includes(title));
      return div ? { text: div.innerText.replace(/s+/g, " ").trim(), ask: [...div.querySelectorAll("button")].some((b) => (b.innerText || "").trim() === "AI에게 회의 준비 묻기") } : null;
    }, WORK_SENTINEL + "-event");
    if (!onBlock || !onBlock.ask || onBlock.text.includes("직장 트랙 — AI 패킷에 실리지 않아요")) throw new Error("the day-job prep block with the switch absent: " + JSON.stringify(onBlock));
    // Leave the save as flow4 expects it: every plant gone, the switch absent.
    await page.evaluate((k, ids) => {
      const st = JSON.parse(localStorage.getItem(k));
      st.meetingProjects = (st.meetingProjects || []).filter((p) => p.id !== ids.project);
      st.meetings = (st.meetings || []).filter((m) => m.id !== ids.meeting);
      st.work = (st.work || []).filter((w) => w.id !== ids.work);
      st.events = (st.events || []).filter((e) => e.id !== ids.event && e.id !== ids.mixed);
      st.deals = (st.deals || []).filter((x) => x.id !== ids.deal);
      localStorage.setItem(k, JSON.stringify(st));
    }, KEY, JOB);
    await h.reload();
  });

  /* ── Time budget and time log (schema v28, Phase 3, 2026-09-18). A time-log entry is a record: a completion with minutes
     writes exactly one entry and nothing but `work` and `timeLog` moves; the quick entry writes `timeLog` only; the budget
     writes `settings` only. Written under the standing instruction; not run. Each step starts from an empty time log and
     the default budget and puts the save's own `timeLog` and `settings` back at the end. ── */
  // The work tab's week line (`이번 주 사업 {h}/{budget}h · 남은 날 {d} ›`), whitespace-normalised.
  const weekLine = () => page.evaluate(() => {
    const b = [...document.querySelectorAll("main button")].find((x) => (x.innerText || "").trim().startsWith("이번 주 사업"));
    return b ? b.innerText.replace(/\s+/g, " ").trim() : "";
  });
  // Days from today to Sunday, both included, from the page's own clock.
  const daysLeftIn = () => page.evaluate(() => 7 - ((new Date().getDay() + 6) % 7));
  // The top-level keys whose JSON differs, `lastTick` excepted.
  const changedKeys = (a, b) => [...new Set([...Object.keys(a), ...Object.keys(b)])]
    .filter((k) => k !== "lastTick" && JSON.stringify(a[k]) !== JSON.stringify(b[k])).sort();
  const resetTime = (log, settings) => page.evaluate((k, l, s) => {
    const st = JSON.parse(localStorage.getItem(k));
    st.timeLog = l;
    st.settings = s;
    localStorage.setItem(k, JSON.stringify(st));
  }, KEY, log, settings);
  const MIN_ID = "e2e-min-work", MIN_TITLE = "E2E 시간 업무";

  await step("completing a work item with minutes writes one time-log entry, un-completing removes it, and the week line moves", async () => {
    const today = await dstrIn(0);
    const saved = await readState();
    const keep = { log: saved.timeLog || [], settings: saved.settings || { bizHoursPerWeek: 20 } };
    try {
      await resetTime([], { ...keep.settings, bizHoursPerWeek: 20 });
      await page.evaluate((k, id, title, d) => {
        const st = JSON.parse(localStorage.getItem(k));
        st.work = [{ id, date: d, title, done: false, source: "manual", createdAt: d, track: "biz" }, ...(st.work || []).filter((w) => w.id !== id)];
        localStorage.setItem(k, JSON.stringify(st));
      }, KEY, MIN_ID, MIN_TITLE, today);
      await h.reload();
      const d = await daysLeftIn();
      await clickTab("업무");
      if ((await weekLine()) !== `이번 주 사업 0h/20h · 남은 날 ${d} ›`) throw new Error("the week line before: " + JSON.stringify(await weekLine()));
      await openTodo(MIN_TITLE);
      await expectText("걸린 시간 (분, 선택)");
      await setValue('.fixed.inset-0 input[aria-label="걸린 시간"]', "90");
      const before = await readState();
      await clickInModalExact("완료로 표시");
      await sleep(500);
      let after = await readState();
      if (JSON.stringify(changedKeys(before, after)) !== JSON.stringify(["timeLog", "work"])) throw new Error("the completion moved: " + JSON.stringify(changedKeys(before, after)));
      const item = after.work.find((w) => w.id === MIN_ID);
      if (!item || !item.done || item.minutes !== 90) throw new Error("the completed item: " + JSON.stringify(item));
      const entries = (after.timeLog || []).filter((e) => e.workId === MIN_ID);
      if (entries.length !== 1 || entries[0].track !== "biz" || entries[0].minutes !== 90 || entries[0].date !== today) throw new Error("the time-log entries: " + JSON.stringify(after.timeLog));
      if ((await weekLine()) !== `이번 주 사업 1.5h/20h · 남은 날 ${d} ›`) throw new Error("the week line after the completion: " + JSON.stringify(await weekLine()));
      await openTodo(MIN_TITLE);
      await expectText("완료 · 90분");
      await clickInModalExact("완료 취소");
      await sleep(500);
      after = await readState();
      if ((after.timeLog || []).some((e) => e.workId === MIN_ID)) throw new Error("un-completing left the entry: " + JSON.stringify(after.timeLog));
      if (after.work.find((w) => w.id === MIN_ID)?.minutes !== 90) throw new Error("un-completing dropped the item's minutes");
      if ((await weekLine()) !== `이번 주 사업 0h/20h · 남은 날 ${d} ›`) throw new Error("the week line after un-completing: " + JSON.stringify(await weekLine()));
      await openTodo(MIN_TITLE);
      await setValue('.fixed.inset-0 input[aria-label="걸린 시간"]', "1441");
      await clickInModalExact("완료로 표시");
      if ((await modalError()) !== "걸린 시간은 1 이상 1440 이하 분으로 입력해 주세요.") throw new Error("the minutes refusal: " + (await modalError()));
      if ((await readState()).work.find((w) => w.id === MIN_ID)?.done) throw new Error("the refused completion was written");
      // Completed again, then deleted: the entry goes with the item.
      await setValue('.fixed.inset-0 input[aria-label="걸린 시간"]', "90");
      await clickInModalExact("완료로 표시");
      await sleep(500);
      if (((await readState()).timeLog || []).filter((e) => e.workId === MIN_ID).length !== 1) throw new Error("the second completion wrote no single entry");
      await openTodo(MIN_TITLE);
      await page.evaluate(() => { window.confirm = () => true; });
      await clickInModalExact("삭제");
      await sleep(500);
      after = await readState();
      if (after.work.some((w) => w.id === MIN_ID) || (after.timeLog || []).some((e) => e.workId === MIN_ID)) throw new Error("the deleted item left an entry: " + JSON.stringify(after.timeLog));
    } finally {
      await closeModal();
      await page.evaluate((k, id) => {
        const st = JSON.parse(localStorage.getItem(k));
        st.work = (st.work || []).filter((w) => w.id !== id);
        localStorage.setItem(k, JSON.stringify(st));
      }, KEY, MIN_ID);
      await resetTime(keep.log, keep.settings);
      await h.reload();
    }
  });

  await step("the quick entry records minutes by track and the settings budget changes the line", async () => {
    const today = await dstrIn(0);
    const saved = await readState();
    const keep = { log: saved.timeLog || [], settings: saved.settings || { bizHoursPerWeek: 20 } };
    try {
      await resetTime([], { ...keep.settings, bizHoursPerWeek: 20 });
      await h.reload();
      const d = await daysLeftIn();
      await clickTab("업무");
      await clickMain(`이번 주 사업 0h/20h · 남은 날 ${d} ›`);
      await sleep(300);
      await expectText("사업 시간 기록");
      await expectText("이번 주 기록이 없어요.");
      if ((await chipOn("사업")) !== true) throw new Error("the quick entry does not open on the business track");
      await setValue('.fixed.inset-0 input[placeholder="분 — 예: 90"]', "0");
      await clickInModalExact("기록");
      if ((await modalError()) !== "분을 1 이상 1440 이하로 입력해 주세요.") throw new Error("the quick-entry refusal: " + (await modalError()));
      await setValue('.fixed.inset-0 input[placeholder="분 — 예: 90"]', "120");
      let before = await readState();
      await clickInModalExact("기록");
      await sleep(300);
      await expectText("시간 120분을 기록했어요");
      let after = await readState();
      if (JSON.stringify(changedKeys(before, after)) !== JSON.stringify(["timeLog"])) throw new Error("the quick entry moved: " + JSON.stringify(changedKeys(before, after)));
      const entry = (after.timeLog || [])[0];
      if (after.timeLog.length !== 1 || entry.workId || entry.minutes !== 120 || entry.track !== "biz" || entry.date !== today) throw new Error("the quick entry: " + JSON.stringify(after.timeLog));
      if (!(await overlayText()).includes(`${today} · 사업 · 120분 · 직접 기록`)) throw new Error("the sheet does not list the entry");
      await closeModal();
      if ((await weekLine()) !== `이번 주 사업 2h/20h · 남은 날 ${d} ›`) throw new Error("the week line after the entry: " + JSON.stringify(await weekLine()));
      // The budget: a whole number of hours, 0 to 168, written to `settings` only.
      await h.openSettings();
      await expectText("사업 시간 — 주간 예산");
      await setValue('.fixed.inset-0 input[aria-label="주간 사업 시간"]', "10");
      before = await readState();
      await clickInModalExact("저장");
      await sleep(300);
      await expectText("주간 사업 시간을 10시간으로 저장했어요");
      after = await readState();
      if (JSON.stringify(changedKeys(before, after)) !== JSON.stringify(["settings"]) || after.settings.bizHoursPerWeek !== 10) throw new Error("the budget save: " + JSON.stringify(after.settings));
      await clickTab("업무");
      if ((await weekLine()) !== `이번 주 사업 2h/10h · 남은 날 ${d} ›`) throw new Error("the week line after the budget: " + JSON.stringify(await weekLine()));
      await h.openSettings();
      await setValue('.fixed.inset-0 input[aria-label="주간 사업 시간"]', "169");
      await clickInModalExact("저장");
      if ((await modalError()) !== "0 이상 168 이하 정수로 입력해 주세요.") throw new Error("the budget refusal: " + (await modalError()));
      if ((await readState()).settings.bizHoursPerWeek !== 10) throw new Error("the refused budget was written");
      await closeModal();
      // The typed entry is deleted from the sheet after the confirm.
      await clickTab("업무");
      await clickMain(`이번 주 사업 2h/10h · 남은 날 ${d} ›`);
      await sleep(300);
      await page.evaluate(() => { window.confirm = () => true; });
      before = await readState();
      const tapped = await page.evaluate(() => {
        const b = document.querySelector('.fixed.inset-0 button[aria-label="시간 기록 삭제"]');
        if (!b) return false;
        b.click(); return true;
      });
      if (!tapped) throw new Error("the typed entry has no delete button");
      await sleep(400);
      await expectText("이번 주 기록이 없어요.");
      after = await readState();
      if ((after.timeLog || []).length !== 0 || JSON.stringify(changedKeys(before, after)) !== JSON.stringify(["timeLog"])) throw new Error("the delete: " + JSON.stringify(after.timeLog));
    } finally {
      await closeModal();
      await resetTime(keep.log, keep.settings);
      await h.reload();
    }
  });

  /* 2026-09-22: the settings switch `직장 기록을 AI 요청문에 포함` writes `settings.workInAi` only (explicit true/false)
     and its caption follows it. Written under the standing instruction; not run. */
  await step("the day-job AI switch writes settings.workInAi only and its caption follows", async () => {
    const ON_CAPTION = "직장 트랙 회의록·업무·일정도 AI 요청문에 실려요. 회사 자료를 보내면 안 되는 날엔 꺼요. 회의록마다 'AI에 보내지 않기'는 그대로 적용돼요.";
    const OFF_CAPTION = "직장 트랙 기록은 AI 요청문에 실리지 않아요.";
    const saved = await readState();
    const keep = saved.settings || { bizHoursPerWeek: 20 };
    // The switch's checkbox state, or null when the row is missing.
    const switchOn = () => page.evaluate(() => {
      const ov = [...document.querySelectorAll(".fixed.inset-0")].pop();
      const l = ov && [...ov.querySelectorAll("label")].find((x) => (x.innerText || "").trim() === "직장 기록을 AI 요청문에 포함");
      const i = l && l.querySelector('input[type="checkbox"]');
      return i ? i.checked : null;
    });
    const toggle = () => page.evaluate(() => {
      const ov = [...document.querySelectorAll(".fixed.inset-0")].pop();
      const l = ov && [...ov.querySelectorAll("label")].find((x) => (x.innerText || "").trim() === "직장 기록을 AI 요청문에 포함");
      const i = l && l.querySelector('input[type="checkbox"]');
      if (!i) return false;
      i.click(); return true;
    });
    try {
      await resetTime(saved.timeLog || [], (({ workInAi, ...rest }) => rest)(keep));
      await h.reload();
      await h.openSettings();
      await expectText("AI 요청문");
      if ((await switchOn()) !== true) throw new Error("the switch does not read on while settings.workInAi is absent");
      if (!(await overlayText()).includes(ON_CAPTION)) throw new Error("the on caption is missing");
      let before = await readState();
      if (!(await toggle())) throw new Error("no day-job AI checkbox in the settings sheet");
      await sleep(300);
      await expectText("직장 기록 AI 포함 꺼짐");
      let after = await readState();
      if (JSON.stringify(changedKeys(before, after)) !== JSON.stringify(["settings"]) || after.settings.workInAi !== false
        || after.settings.bizHoursPerWeek !== before.settings.bizHoursPerWeek) throw new Error("switching off: " + JSON.stringify(after.settings));
      if ((await switchOn()) !== false || !(await overlayText()).includes(OFF_CAPTION) || (await overlayText()).includes(ON_CAPTION)) throw new Error("the off caption does not follow the switch");
      before = after;
      await toggle();
      await sleep(300);
      await expectText("직장 기록 AI 포함 켜짐");
      after = await readState();
      if (JSON.stringify(changedKeys(before, after)) !== JSON.stringify(["settings"]) || after.settings.workInAi !== true) throw new Error("switching on: " + JSON.stringify(after.settings));
      if ((await switchOn()) !== true || !(await overlayText()).includes(ON_CAPTION)) throw new Error("the on caption does not come back");
    } finally {
      await closeModal();
      await resetTime(saved.timeLog || [], keep);
      await h.reload();
    }
  });
};
