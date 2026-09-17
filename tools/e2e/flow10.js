// Meetings tab — project minutes. A meeting is a record, never a task: these steps assert that saving minutes changes
// `meetingProjects` and `meetings` only — never the tasks, goals, streak, trophies or events — that a meeting stores a
// date and an optional event id but no time of its own, that the storage guard refuses a save over the budget with the
// form kept open, and that the briefing, the to-do list and the assistant packet never read a meeting. Runs after flow9
// and before flow4, which replaces the save.
module.exports = async (h) => {
  const { step, clickTab, clickText, clickInModal, clickInModalExact, expectText, rows, todoRows, openTodo, overlayText,
    openSettings, captureDownload, typeInto, setValue, closeModal, modalError, sleep, page } = h;

  const KEY = "liferpg-state-v1";
  const BUDGET = 3672064; // STORAGE_BUDGET = 3.5 × 1,048,576, counted in string length
  const NL = String.fromCharCode(10);
  const readState = () => page.evaluate((k) => { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } }, KEY);
  // Dates are computed in the page with the app's own local-date logic (never toISOString).
  const dstrIn = (delta) => page.evaluate((d) => {
    const t = new Date(); t.setHours(12, 0, 0, 0); t.setDate(t.getDate() + d);
    const p = (n) => String(n).padStart(2, "0");
    return `${t.getFullYear()}-${p(t.getMonth() + 1)}-${p(t.getDate())}`;
  }, delta);
  // What saving minutes must never move (flow8's boundary, plus the schedule records).
  const boundary = (st) => ({ ...h.recordBoundary(st), events: JSON.stringify(st.events || []) });
  const assertBoundary = (before, after, what) => {
    const b = boundary(before), a = boundary(after);
    for (const k of Object.keys(b)) {
      if (b[k] !== a[k]) throw new Error(`${what} changed ${k}: ${String(b[k]).slice(0, 90)} -> ${String(a[k]).slice(0, 90)}`);
    }
  };
  // The tab's counts line, whitespace-normalised.
  const countsLine = () => page.evaluate(() => [...document.querySelectorAll("main p")]
    .map((p) => (p.innerText || "").replace(/\s+/g, " ").trim())
    .find((t) => t.startsWith("프로젝트 ") && t.includes("저장 공간")) || "");
  // One project section's minutes rows, in screen order: `{ lead, title, controls }`.
  const projectRows = (name) => page.evaluate((n) => {
    const sec = [...document.querySelectorAll("main section")].find((s) => (s.querySelector(".font-bold.truncate")?.innerText || "").trim() === n);
    if (!sec) return null;
    return [...sec.querySelectorAll(".text-sm.font-semibold")].map((node) => {
      const row = node.closest("button");
      return {
        lead: (row?.querySelector("span")?.innerText || "").trim(),
        title: (node.innerText || "").trim(),
        controls: row ? row.querySelectorAll("button, input").length : -1,
      };
    });
  }, name);
  // Fill and submit the meeting form that is already open.
  const fillMeeting = async ({ title, date, summary }) => {
    if (date) await setValue('.fixed.inset-0 input[type="date"]', date);
    if (title != null) await typeInto("회의 이름", title);
    if (summary != null) await setValue(".fixed.inset-0 textarea", summary, 0);
  };
  const openMeetingForm = async () => { await clickText("회의록 추가"); await sleep(400); await expectText("새 회의록"); };

  const PROJECT = "E2E 프로젝트";
  const KICKOFF_LINES = ["요구사항 범위를 1차와 2차로 나눔", "데이터 이관은 2차에서 진행"];

  await step("meetings tab starts empty and states its storage use", async () => {
    await clickTab("미팅");
    await expectText("미팅 — 프로젝트별 회의록");
    await expectText("프로젝트가 없어요 — 프로젝트를 먼저 만들어요.");
    const line = await countsLine();
    if (!/^프로젝트 0개 · 회의록 0건 · 저장 공간 \d+\.\dMB \/ 3\.5MB$/.test(line)) throw new Error("meetings counts line: " + JSON.stringify(line));
  });

  await step("the project form refuses an empty name, then registers", async () => {
    await clickText("프로젝트 추가"); await sleep(400);
    await expectText("새 프로젝트");
    await clickInModalExact("등록");
    const e = await modalError();
    if (e !== "프로젝트 이름을 입력해 주세요.") throw new Error("empty project name gave: " + (e || "no error"));
    await typeInto("프로젝트 이름", PROJECT);
    await clickInModalExact("등록");
    await sleep(500);
    const st = await readState();
    if ((st.meetingProjects || []).length !== 1) throw new Error("stored projects: " + JSON.stringify(st.meetingProjects));
    const keys = Object.keys(st.meetingProjects[0]).sort().join(",");
    if (keys !== "createdAt,id,name" || st.meetingProjects[0].name !== PROJECT) throw new Error("stored project record: " + JSON.stringify(st.meetingProjects[0]));
  });

  await step("the meeting form refuses a missing title, a missing summary and an over-cap summary", async () => {
    await clickTab("미팅");
    await openMeetingForm();
    await clickInModalExact("등록");
    let e = await modalError();
    if (e !== "회의 이름을 입력해 주세요.") throw new Error("missing title gave: " + (e || "no error"));
    await fillMeeting({ title: "킥오프 회의" });
    await clickInModalExact("등록");
    e = await modalError();
    if (e !== "회의 요약을 입력해 주세요.") throw new Error("missing summary gave: " + (e || "no error"));
    await fillMeeting({ summary: "가".repeat(5001) });
    await clickInModalExact("등록");
    e = await modalError();
    if (e !== "회의 요약은 5000자까지예요 — 지금 5001자예요.") throw new Error("over-cap summary gave: " + (e || "no error"));
    if (((await readState()).meetings || []).length) throw new Error("a refused meeting reached the save");
    await closeModal();
  });

  await step("meetings register under their project, newest first, and pay nothing", async () => {
    const before = await readState();
    await clickTab("미팅");
    await openMeetingForm();
    await fillMeeting({ title: "킥오프 회의", date: await dstrIn(-2), summary: KICKOFF_LINES.join(NL) });
    await clickInModalExact("등록");
    await sleep(500);
    await openMeetingForm();
    await fillMeeting({ title: "주간 점검", date: await dstrIn(0), summary: "진행 상황 공유" });
    await clickInModalExact("등록");
    await sleep(500);
    const list = await projectRows(PROJECT);
    if (!list || list.length !== 2) throw new Error("project rows: " + JSON.stringify(list));
    const today = await dstrIn(0);
    if (list[0].title !== "주간 점검" || list[0].lead !== today.slice(2)) throw new Error("first row: " + JSON.stringify(list[0]) + ` (expected 주간 점검 · ${today.slice(2)})`);
    if (list.some((r) => r.controls !== 0)) throw new Error("a minutes row carries a nested control: " + JSON.stringify(list));
    const after = await readState();
    assertBoundary(before, after, "saving minutes");
    if ((after.meetings || []).length !== 2) throw new Error("stored meetings: " + (after.meetings || []).length);
    for (const m of after.meetings) {
      const bad = ["time", "place", "repeat", "goalId", "pts", "diff"].filter((k) => k in m);
      if (bad.length) throw new Error(`meeting ${m.title} stores ${bad.join(", ")}`);
    }
    const kick = after.meetings.find((m) => m.title === "킥오프 회의");
    if (!kick || kick.summary !== KICKOFF_LINES.join(NL)) throw new Error("the two-line summary was not stored as typed: " + JSON.stringify(kick));
  });

  await step("a meeting links to a schedule occurrence on its date without copying it", async () => {
    const today = await dstrIn(0);
    await clickTab("일정");
    await clickText("일정 추가"); await sleep(400);
    await typeInto("일정 이름", "주간 회의");
    await setValue('.fixed.inset-0 input[type="date"]', today);
    await setValue('.fixed.inset-0 input[type="time"]', "10:00");
    await clickInModalExact("등록");
    await sleep(700);
    const ev = ((await readState()).events || []).find((e) => e.title === "주간 회의" && e.date === today);
    if (!ev) throw new Error("the schedule event was not stored");

    await clickTab("미팅");
    await openMeetingForm();
    await fillMeeting({ title: "일정 연결 회의", date: today, summary: "주간 회의 안건 정리" });
    await clickInModal("10:00 주간 회의");
    await clickInModalExact("등록");
    await sleep(500);
    const m = ((await readState()).meetings || []).find((x) => x.title === "일정 연결 회의");
    if (!m) throw new Error("the linked meeting was not stored");
    if (m.eventId !== ev.id) throw new Error(`stored eventId ${m.eventId}, expected ${ev.id}`);
    if ("time" in m) throw new Error("the meeting copied the event time: " + JSON.stringify(m));
    await openTodo("일정 연결 회의");
    if (!(await overlayText()).includes("10:00 주간 회의")) throw new Error("the meeting view does not state the linked event: " + (await overlayText()).slice(0, 200));
    await closeModal();

    // Deleting the event keeps the minutes and states that the link is gone.
    await clickTab("일정");
    const hit = await rows(["주간 회의", "10:00"], "수정");
    if (!hit.clicked) throw new Error("the event row was not found on today's panel: " + JSON.stringify(hit.rows));
    await sleep(400);
    await clickInModalExact("삭제");
    await sleep(600);
    const st = await readState();
    if ((st.events || []).some((e) => e.id === ev.id)) throw new Error("the event survived its deletion");
    if (!(st.meetings || []).some((x) => x.id === m.id && x.eventId === ev.id)) throw new Error("deleting the event changed or removed the minutes");
    await clickTab("미팅");
    await openTodo("일정 연결 회의");
    if (!(await overlayText()).includes("연결된 일정이 삭제됐어요")) throw new Error("the view does not state the deleted link: " + (await overlayText()).slice(0, 200));
    await closeModal();
  });

  await step("the view shows the full minutes and editing replaces the record", async () => {
    await clickTab("미팅");
    const before = ((await readState()).meetings || []).find((x) => x.title === "킥오프 회의");
    await openTodo("킥오프 회의");
    const view = await overlayText();
    for (const line of KICKOFF_LINES) if (!view.includes(line)) throw new Error(`the view lacks the summary line "${line}": ` + view.slice(0, 240));
    await clickInModalExact("수정");
    await expectText("회의록 수정");
    await typeInto("회의 이름", "킥오프 회의 1차");
    await clickInModalExact("저장");
    await sleep(500);
    const after = ((await readState()).meetings || []).find((x) => x.id === before.id);
    if (!after || after.title !== "킥오프 회의 1차") throw new Error("the edited title was not stored: " + JSON.stringify(after));
    if (after.createdAt !== before.createdAt || after.summary !== before.summary) throw new Error("editing rewrote a field it does not own: " + JSON.stringify(after));
  });

  await step("a project with minutes cannot be deleted; an empty one can", async () => {
    await clickTab("미팅");
    await clickText("프로젝트 수정"); await sleep(400);
    const del = await page.evaluate(() => {
      const ov = [...document.querySelectorAll(".fixed.inset-0")].pop();
      const b = ov && [...ov.querySelectorAll("button")].find((x) => (x.innerText || "").trim() === "삭제");
      return b ? b.disabled : null;
    });
    if (del !== true) throw new Error("the project delete button is not disabled: " + del);
    if (!(await overlayText()).includes("회의록 3건이 있어 삭제할 수 없어요 — 회의록을 먼저 지워요.")) throw new Error("the sheet does not state why deleting is refused");
    await closeModal();
    await page.evaluate(() => { window.confirm = () => true; });
    for (const t of ["킥오프 회의 1차", "주간 점검", "일정 연결 회의"]) {
      await openTodo(t);
      await clickInModalExact("수정");
      await clickInModalExact("삭제");
      await sleep(400);
      await closeModal();
    }
    if (((await readState()).meetings || []).length) throw new Error("minutes survived their deletion");
    await clickText("프로젝트 수정"); await sleep(400);
    await clickInModalExact("삭제");
    await sleep(500);
    if (((await readState()).meetingProjects || []).length) throw new Error("the empty project survived its deletion");
    await expectText("프로젝트가 없어요 — 프로젝트를 먼저 만들어요.");
  });

  await step("a meeting that would exceed the storage budget is refused and the form stays open", async () => {
    await clickTab("미팅");
    await clickText("프로젝트 추가"); await sleep(400);
    await typeInto("프로젝트 이름", PROJECT);
    await clickInModalExact("등록");
    await sleep(500);
    try {
      // The filler is sized the way `storageUsedBytes` counts: every key plus every value, in string length.
      await page.evaluate((budget) => {
        let used = 0;
        for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); used += k.length + (localStorage.getItem(k) || "").length; }
        localStorage.setItem("e2e-filler", "x".repeat(Math.max(0, budget - used + 100)));
      }, BUDGET);
      await openMeetingForm();
      await fillMeeting({ title: "한도 초과 회의", summary: "저장되면 안 되는 요약" });
      await clickInModalExact("등록");
      const e = await modalError();
      if (!e.startsWith("저장 공간이 부족해요 — 현재")) throw new Error("the over-budget save gave: " + (e || "no error"));
      const kept = await page.evaluate(() => {
        const ov = [...document.querySelectorAll(".fixed.inset-0")].pop();
        const input = ov && ov.querySelector('input[placeholder^="회의 이름"]');
        return { open: !!ov, title: input ? input.value : null };
      });
      if (!kept.open || kept.title !== "한도 초과 회의") throw new Error("the form did not stay open with the typed title: " + JSON.stringify(kept));
      if (((await readState()).meetings || []).length) throw new Error("the refused meeting reached the save");
      await closeModal();
    } finally {
      await page.evaluate(() => localStorage.removeItem("e2e-filler"));
      await h.reload();
    }
  });

  await step("meetings travel in the backup file", async () => {
    await clickTab("미팅");
    await openMeetingForm();
    await fillMeeting({ title: "백업 확인 회의", summary: "백업 파일 포함 여부 확인" });
    await clickInModalExact("등록");
    await sleep(500);
    const st = await readState();
    if ((st.meetings || []).length !== 1) throw new Error("stored meetings before the export: " + (st.meetings || []).length);
    await openSettings();
    const dl = await captureDownload(() => h.clickInModal("백업 내보내기"));
    if (!dl || !dl.text) throw new Error("no backup blob was produced");
    const data = JSON.parse(dl.text);
    if (JSON.stringify(data.state?.meetings) !== JSON.stringify(st.meetings)) throw new Error("backup meetings differ: " + JSON.stringify(data.state?.meetings));
    if (JSON.stringify(data.state?.meetingProjects) !== JSON.stringify(st.meetingProjects)) throw new Error("backup projects differ: " + JSON.stringify(data.state?.meetingProjects));
    await closeModal();
  });

  await step("the briefing, the to-do list and the packet never read a meeting", async () => {
    const title = "백업 확인 회의";
    await clickTab("할 일");
    const list = (await todoRows()) || [];
    if (list.some((r) => r.title.includes(title))) throw new Error("the to-do list lists a meeting");
    await clickText("브리핑 열기"); await sleep(600);
    if ((await overlayText()).includes(title)) throw new Error("the briefing mentions a meeting");
    await clickInModal("AI에게 보내기"); await sleep(500);
    const packet = await page.evaluate(() => document.querySelector(".fixed.inset-0 textarea")?.value || "");
    if (!packet) throw new Error("the assistant packet textarea is empty");
    if (packet.includes(title)) throw new Error("the assistant packet carries a meeting");
    await closeModal();
  });

  // ── Task links (schema v24): a meeting names existing tasks; linking changes no task, and both sides show the link.
  const LINK_MEETING = "할 일 연결 회의";
  const linkTitle = (n) => `E2E 연결 ${String(n).padStart(2, "0")}`; // two digits, so no title is a substring of another
  const linkId = (n) => `e2e-link-${String(n).padStart(2, "0")}`;
  // Tick (or just read, with click=false) one row of the form's `할 일 연결` picker.
  const pickerRow = (title, click = true) => page.evaluate((t, c) => {
    const ov = [...document.querySelectorAll(".fixed.inset-0")].pop();
    const b = ov && [...ov.querySelectorAll('button[role="checkbox"]')].find((x) => (x.innerText || "").includes(t));
    if (!b) return null;
    const out = { disabled: b.disabled, checked: b.getAttribute("aria-checked") === "true" };
    if (c && !b.disabled) b.click();
    return out;
  }, title, click);
  const tick = async (title) => {
    const r = await pickerRow(title);
    if (!r) throw new Error(`picker row not found: ${title}`);
    if (r.disabled) throw new Error(`picker row disabled: ${title}`);
    await sleep(120);
  };
  const linkMeeting = async () => ((await readState()).meetings || []).find((m) => m.title === LINK_MEETING);

  await step("linking two tasks when writing a meeting stores their ids and changes no task", async () => {
    // Plant twelve open tasks on an existing goal (or unlinked when none is active) — enough to reach the cap.
    const due = await dstrIn(7);
    await page.evaluate((k, d) => {
      const st = JSON.parse(localStorage.getItem(k));
      const g = (st.goals || []).find((x) => x.status === "active");
      const areaId = g ? g.areaId : st.areas[0].id;
      for (let n = 1; n <= 12; n++) {
        const nn = String(n).padStart(2, "0");
        st.tasks.push({ id: `e2e-link-${nn}`, title: `E2E 연결 ${nn}`, areaId, ...(g ? { goalId: g.id } : {}), diff: "E",
          type: "once", status: "todo", doneDates: [], createdAt: d, due: d });
      }
      localStorage.setItem(k, JSON.stringify(st));
    }, KEY, due);
    await h.reload();
    const before = await readState();
    await clickTab("미팅");
    await openMeetingForm();
    await expectText("할 일 연결");
    await fillMeeting({ title: LINK_MEETING, summary: "연결 확인" });
    await typeInto("할 일 검색", "E2E 연결");
    await sleep(200);
    await tick(linkTitle(1));
    await tick(linkTitle(2));
    await clickInModalExact("등록");
    await sleep(500);
    const after = await readState();
    const m = (after.meetings || []).find((x) => x.title === LINK_MEETING);
    if (!m) throw new Error("the linked meeting was not stored");
    if (!Array.isArray(m.taskIds) || [...m.taskIds].sort().join(",") !== [linkId(1), linkId(2)].join(",")) throw new Error("stored taskIds: " + JSON.stringify(m.taskIds));
    if (JSON.stringify(after.tasks) !== JSON.stringify(before.tasks)) throw new Error("linking a task changed the tasks");
    assertBoundary(before, after, "linking tasks to a meeting");
  });

  await step("the meeting view lists the linked tasks and tapping one opens its task sheet", async () => {
    await clickTab("미팅");
    await openTodo(LINK_MEETING);
    const view = await overlayText();
    for (const t of ["연결된 할 일", linkTitle(1), linkTitle(2)]) if (!view.includes(t)) throw new Error(`the meeting view lacks "${t}": ` + view.slice(0, 300));
    if (view.includes("삭제된 할 일")) throw new Error("the view states a deleted link that does not exist");
    await clickInModal(linkTitle(1));
    const sheet = await overlayText();
    if (!sheet.includes("완료하기") || !sheet.includes(linkTitle(1))) throw new Error("tapping a linked task did not open its task sheet: " + sheet.slice(0, 300));
    if ((await page.evaluate(() => document.querySelectorAll(".fixed.inset-0").length)) !== 1) throw new Error("the task sheet did not replace the meeting view");
  });

  await step("the task sheet lists the meeting under its related-minutes section and opens it", async () => {
    const sheet = await overlayText();
    if (!sheet.includes("관련 회의록") || !sheet.includes(LINK_MEETING)) throw new Error("the task sheet lacks its meeting: " + sheet.slice(0, 300));
    const m = await linkMeeting();
    if (!sheet.includes(`${m.date} ${LINK_MEETING}`)) throw new Error("the related meeting row is not `{date} {title}`: " + sheet.slice(0, 300));
    await clickInModal(LINK_MEETING);
    if (!(await overlayText()).includes("연결된 할 일")) throw new Error("tapping the related meeting did not open the meeting view");
    await closeModal();
    if (await page.evaluate(() => document.querySelectorAll(".fixed.inset-0").length)) throw new Error("a sheet was left open after closing");
    // A task without links shows no section at all.
    await clickTab("할 일");
    await openTodo(linkTitle(3));
    if ((await overlayText()).includes("관련 회의록")) throw new Error("an unlinked task sheet shows the related-minutes section");
    await closeModal();
  });

  await step("a meeting links at most 10 tasks", async () => {
    await clickTab("미팅");
    await openTodo(LINK_MEETING);
    await clickInModalExact("수정");
    await expectText("회의록 수정");
    await typeInto("할 일 검색", "E2E 연결");
    await sleep(200);
    for (let n = 3; n <= 10; n++) await tick(linkTitle(n));
    if (!(await overlayText()).includes("할 일은 10개까지 연결돼요.")) throw new Error("the cap line is missing at 10 links");
    const eleventh = await pickerRow(linkTitle(11), false);
    if (!eleventh || !eleventh.disabled || eleventh.checked) throw new Error("the 11th task is not disabled at the cap: " + JSON.stringify(eleventh));
    const tenth = await pickerRow(linkTitle(10), false);
    if (!tenth || tenth.disabled || !tenth.checked) throw new Error("a linked task is not untickable at the cap: " + JSON.stringify(tenth));
    await clickInModalExact("저장");
    await sleep(500);
    const m = await linkMeeting();
    if ((m.taskIds || []).length !== 10 || m.taskIds.includes(linkId(11))) throw new Error("stored taskIds at the cap: " + JSON.stringify(m.taskIds));
  });

  await step("deleting a linked task removes its id from the meeting", async () => {
    const before = await linkMeeting();
    await clickTab("할 일");
    await openTodo(linkTitle(1));
    await clickInModalExact("삭제");
    await sleep(500);
    const st = await readState();
    if ((st.tasks || []).some((q) => q.id === linkId(1))) throw new Error("the linked task survived its deletion");
    const m = (st.meetings || []).find((x) => x.id === before.id);
    if (!m || m.taskIds.includes(linkId(1)) || m.taskIds.length !== 9) throw new Error("the deleted task's id stayed on the meeting: " + JSON.stringify(m?.taskIds));
    const { taskIds: a, ...restBefore } = before;
    const { taskIds: b, ...restAfter } = m;
    if (JSON.stringify(restBefore) !== JSON.stringify(restAfter)) throw new Error("deleting a task changed another meeting field");
    // A link left dangling by an older save is skipped at render and counted.
    await page.evaluate((k, id) => {
      const s = JSON.parse(localStorage.getItem(k));
      s.meetings.find((x) => x.id === id).taskIds.push("e2e-gone-task");
      localStorage.setItem(k, JSON.stringify(s));
    }, KEY, before.id);
    await h.reload();
    await clickTab("미팅");
    await openTodo(LINK_MEETING);
    const view = await overlayText();
    if (view.includes(linkTitle(1))) throw new Error("the view still lists the deleted task");
    if (!view.includes("삭제된 할 일 1건")) throw new Error("the view does not count the dangling link: " + view.slice(0, 300));
    await closeModal();
    // Leave the save as flow4 expects it: no planted tasks, no link meeting.
    await page.evaluate((k, id) => {
      const s = JSON.parse(localStorage.getItem(k));
      s.tasks = s.tasks.filter((q) => !String(q.id).startsWith("e2e-link-"));
      s.meetings = s.meetings.filter((x) => x.id !== id);
      localStorage.setItem(k, JSON.stringify(s));
    }, KEY, before.id);
    await h.reload();
  });
};
