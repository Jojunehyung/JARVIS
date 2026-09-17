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
    if (!/^프로젝트 0개 · 회의록 0건 · 문서 0건 · 저장 공간 \d+\.\dMB \/ 3\.5MB$/.test(line)) throw new Error("meetings counts line: " + JSON.stringify(line));
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

  // ── Follow-up items (schema v26): structured follow-ups on a meeting; a mine item is mirrored as a work item with a
  // two-way link, and only `done` mirrors. Written 2026-09-17 under the standing instruction that the suite is not run.
  const FU_MEETING = "E2E 후속 회의";
  const SPLIT_ID = "e2e-split-mtg", SPLIT_TITLE = "E2E 나누기 회의";
  const CAP_ID = "e2e-cap-mtg", CAP_TITLE = "E2E 후속 한도 회의";
  const SPLIT_ACTIONS = "- 샘플 문서 전달" + NL + "• 권한 목록 회신 / 일정 확정";
  const fuMeeting = async () => ((await readState()).meetings || []).find((m) => m.title === FU_MEETING);
  // The marker span of a minutes row (or the lead chip of a work row) whose title is exactly `title`, or null.
  const rowSpan = (title, which) => page.evaluate((t, w) => {
    const node = [...document.querySelectorAll("main .text-sm.font-semibold")].find((e) => (e.innerText || "").trim() === t);
    const spans = node?.closest("button") ? [...node.closest("button").querySelectorAll("span")] : [];
    const span = w === "lead" ? spans[0] : spans.length > 1 ? spans[spans.length - 1] : null;
    return span ? (span.innerText || "").trim() : null;
  }, title, which);
  // Taps the nth (0-based) button labelled exactly `label` in the open overlay.
  const clickNthInModal = async (label, n) => {
    const ok = await page.evaluate((l, i) => {
      const ov = [...document.querySelectorAll(".fixed.inset-0")].pop();
      const b = ov && [...ov.querySelectorAll("button")].filter((x) => (x.innerText || "").trim() === l)[i];
      if (!b) return false;
      b.click(); return true;
    }, label, n);
    if (!ok) throw new Error(`button #${n} not found in the sheet: ${label}`);
    await sleep(250);
  };
  // One follow-up row of the open meeting view, found by its text: `done` ticks its checkbox, `mine` taps its owner chip.
  const fuRowTap = async (text, what) => {
    const ok = await page.evaluate((t, w) => {
      const ov = [...document.querySelectorAll(".fixed.inset-0")].pop();
      const box = ov && [...ov.querySelectorAll('input[aria-label="후속 완료"]')]
        .find((b) => (b.parentElement?.querySelector("p")?.innerText || "").trim() === t);
      if (!box) return false;
      if (w === "done") { box.click(); return true; }
      const chip = [...box.parentElement.querySelectorAll("button")].find((b) => (b.innerText || "").trim() === "내 담당");
      if (!chip) return false;
      chip.click(); return true;
    }, text, what);
    if (!ok) throw new Error(`follow-up row control not found: ${text} (${what})`);
    await sleep(500);
  };
  // Opens the follow-up meeting's view, taps one control of its first row, waits for the toast, and answers the save
  // and that meeting. The view stays open.
  const tapInFuView = async (what, toast) => {
    await clickTab("미팅");
    await openTodo(FU_MEETING);
    await fuRowTap("견적서 송부", what);
    await expectText(toast);
    const st = await readState();
    return { st, m: (st.meetings || []).find((x) => x.title === FU_MEETING) };
  };
  // One candidate row of the split panel: answers `{ checked, disabled }`; `tick` clicks its checkbox, `mine` its chip.
  const splitRow = (text, what = null) => page.evaluate((t, w) => {
    const ov = [...document.querySelectorAll(".fixed.inset-0")].pop();
    const panel = ov && ov.querySelector(".border-cyan-800");
    const row = panel && [...panel.querySelectorAll('input[type="checkbox"]')].map((b) => b.parentElement)
      .find((r) => (r.querySelector("span")?.innerText || "").trim().startsWith(t));
    if (!row) return null;
    const box = row.querySelector('input[type="checkbox"]');
    const out = { checked: box.checked, disabled: box.disabled };
    if (w === "tick") box.click();
    if (w === "mine") [...row.querySelectorAll("button")].find((b) => (b.innerText || "").trim() === "내 담당")?.click();
    return out;
  }, text, what);
  const plantMeetingRecord = async (rec) => {
    await page.evaluate((k, r) => {
      const s = JSON.parse(localStorage.getItem(k));
      const p = (s.meetingProjects || [])[0];
      s.meetings = [{ ...r, projectId: r.projectId === null ? null : p.id }, ...(s.meetings || []).filter((m) => m.id !== r.id)];
      localStorage.setItem(k, JSON.stringify(s));
    }, KEY, rec);
    await h.reload();
  };

  await step("the meeting form registers follow-up items and a mine item becomes a work item dated the meeting day", async () => {
    const today = await dstrIn(0), due = await dstrIn(2);
    const before = await readState();
    await clickTab("미팅");
    await openMeetingForm();
    await fillMeeting({ title: FU_MEETING, summary: "후속 항목 확인" });
    await clickInModalExact("항목 추가");
    await clickInModalExact("항목 추가");
    await setValue('.fixed.inset-0 input[placeholder^="후속 항목"]', "견적서 송부", 0);
    await setValue('.fixed.inset-0 input[placeholder^="후속 항목"]', "단가표 회신", 1);
    await clickNthInModal("내 담당", 0);
    await setValue('.fixed.inset-0 input[aria-label="후속 기한"]', due, 0);
    await clickInModalExact("등록");
    await expectText("회의록을 등록했어요 · 업무 1건 등록");
    const after = await readState();
    const m = (after.meetings || []).find((x) => x.title === FU_MEETING);
    if (!m || (m.followUps || []).length !== 2) throw new Error("stored follow-ups: " + JSON.stringify(m?.followUps));
    const [f1, f2] = m.followUps;
    if (f1.text !== "견적서 송부" || f1.mine !== true || f1.due !== due || f1.done !== false || !f1.workId) throw new Error("the first follow-up: " + JSON.stringify(f1));
    if (f2.text !== "단가표 회신" || f2.mine !== false || "due" in f2 || f2.done !== false || "workId" in f2) throw new Error("the second follow-up: " + JSON.stringify(f2));
    const made = (after.work || []).filter((w) => !(before.work || []).some((x) => x.id === w.id));
    if (made.length !== 1) throw new Error("work items created: " + JSON.stringify(made));
    const w = made[0];
    if (w.id !== f1.workId || w.source !== "meeting" || w.date !== today || w.done !== false || w.title !== "견적서 송부") throw new Error("the mirrored work item: " + JSON.stringify(w));
    if (!w.link || w.link.kind !== "meeting" || w.link.id !== m.id || w.link.followUpId !== f1.id) throw new Error("the mirrored item's link: " + JSON.stringify(w.link));
    assertBoundary(before, after, "registering follow-ups");
    const marker = await rowSpan(FU_MEETING, "marker");
    if (marker !== "후속 2/2") throw new Error("the minutes row marker: " + JSON.stringify(marker));
    await clickTab("업무");
    const lead = await rowSpan("견적서 송부", "lead");
    if (lead !== "회의") throw new Error("the work row lead: " + JSON.stringify(lead));
  });

  await step("a follow-up ticked done in the meeting view marks its work item done, and un-ticking from the work sheet marks it open again", async () => {
    const before = await readState();
    let { m, st } = await tapInFuView("done", "후속 항목을 완료로 표시했어요");
    if (m.followUps[0].done !== true) throw new Error("the follow-up was not stored done: " + JSON.stringify(m.followUps[0]));
    if ((st.work || []).find((w) => w.id === m.followUps[0].workId)?.done !== true) throw new Error("the linked work item was not marked done");
    await closeModal();
    const marker = await rowSpan(FU_MEETING, "marker");
    if (marker !== "후속 1/2") throw new Error("the minutes row marker after done: " + JSON.stringify(marker));
    await clickTab("업무");
    await openTodo("견적서 송부");
    const sheet = await overlayText();
    for (const t of ["회의 후속", "연결은 회의록의 후속 항목을 따라요.", `회의록 · ${m.date} ${FU_MEETING}`]) if (!sheet.includes(t)) throw new Error(`the work sheet lacks "${t}": ` + sheet.slice(0, 300));
    await clickInModalExact("완료 취소");
    await sleep(500);
    m = await fuMeeting();
    st = await readState();
    if (m.followUps[0].done !== false) throw new Error("un-ticking the work item did not reopen the follow-up: " + JSON.stringify(m.followUps[0]));
    if ((st.work || []).find((w) => w.id === m.followUps[0].workId)?.done !== false) throw new Error("the work item stayed done");
    assertBoundary(before, st, "mirroring done");
  });

  await step("turning the mine flag off removes the undone work item and turning it on registers a new one", async () => {
    const oldId = (await fuMeeting()).followUps[0].workId;
    let { m, st } = await tapInFuView("mine", "내 담당을 해제했어요 · 미완료 업무 삭제");
    if ((st.work || []).some((w) => w.id === oldId)) throw new Error("the undone work item survived turning the mine flag off");
    if (m.followUps[0].mine !== false || "workId" in m.followUps[0]) throw new Error("the follow-up after turning the mine flag off: " + JSON.stringify(m.followUps[0]));
    await fuRowTap("견적서 송부", "mine");
    await expectText("내 담당으로 표시했어요 · 업무 등록");
    m = await fuMeeting();
    st = await readState();
    const fu = m.followUps[0];
    const w = (st.work || []).find((x) => x.id === fu.workId);
    if (fu.mine !== true || !w || w.id === oldId || w.source !== "meeting" || w.link?.followUpId !== fu.id) throw new Error("the re-registered work item: " + JSON.stringify({ fu, w }));
    await closeModal();
  });

  await step("deleting the work item leaves the follow-up on the meeting, unlinked", async () => {
    await page.evaluate(() => { window.confirm = () => true; });
    await clickTab("업무");
    await openTodo("견적서 송부");
    await clickInModalExact("삭제");
    await sleep(500);
    const m = await fuMeeting();
    const fu = (m.followUps || []).find((f) => f.text === "견적서 송부");
    if (!fu || fu.mine !== true || "workId" in fu) throw new Error("the follow-up after its work item was deleted: " + JSON.stringify(fu));
    if (((await readState()).work || []).some((w) => w.link?.followUpId === fu.id)) throw new Error("a work item still mirrors the follow-up");
    await clickTab("미팅");
    await openTodo(FU_MEETING);
    if (!(await overlayText()).includes("업무 삭제됨")) throw new Error("the view does not state the deleted work item: " + (await overlayText()).slice(0, 300));
    await closeModal();
  });

  await step("the split button turns the free-text follow-ups into ticked candidates and appends the ticked ones without touching the text", async () => {
    const today = await dstrIn(0);
    await plantMeetingRecord({ id: SPLIT_ID, date: today, title: SPLIT_TITLE, summary: "나누기 확인", actions: SPLIT_ACTIONS,
      createdAt: today, taskIds: [], progress: [], aiHidden: false, followUps: [] });
    const before = await readState();
    await clickTab("미팅");
    await openTodo(SPLIT_TITLE);
    await clickInModalExact("항목으로 나누기");
    if (!(await overlayText()).includes("후속 조치에서 항목 나누기 — 3건")) throw new Error("the split panel title: " + (await overlayText()).slice(0, 300));
    for (const t of ["샘플 문서 전달", "권한 목록 회신", "일정 확정"]) {
      const r = await splitRow(t);
      if (!r || !r.checked || r.disabled) throw new Error(`candidate "${t}" does not start ticked: ` + JSON.stringify(r));
    }
    await splitRow("일정 확정", "tick");
    await sleep(150);
    await splitRow("샘플 문서 전달", "mine");
    await sleep(150);
    await clickInModalExact("추가");
    await expectText("후속 항목 2건을 추가했어요 · 업무 1건 등록");
    const st = await readState();
    const m = (st.meetings || []).find((x) => x.id === SPLIT_ID);
    if ((m.followUps || []).length !== 2 || m.followUps.map((f) => f.text).join("|") !== "샘플 문서 전달|권한 목록 회신") throw new Error("appended follow-ups: " + JSON.stringify(m.followUps));
    if (m.actions !== SPLIT_ACTIONS) throw new Error("the split rewrote actions: " + JSON.stringify(m.actions));
    const made = (st.work || []).filter((w) => !(before.work || []).some((x) => x.id === w.id));
    if (made.length !== 1 || made[0].source !== "meeting" || made[0].title !== "샘플 문서 전달" || made[0].id !== m.followUps[0].workId) throw new Error("the split's work item: " + JSON.stringify(made));
    if (!(await overlayText()).includes("항목으로 나누기")) throw new Error("the split button left the view after the append");
    await closeModal();
  });

  await step("the split tool refuses beyond thirty items", async () => {
    const today = await dstrIn(0);
    const pad = (n) => String(n).padStart(2, "0");
    const fus = Array.from({ length: 29 }, (_, i) => ({ id: `e2e-cap-fu-${pad(i + 1)}`, text: `E2E 후속 ${pad(i + 1)}`, mine: false, done: false }));
    await plantMeetingRecord({ id: CAP_ID, date: today, title: CAP_TITLE, summary: "한도 확인", actions: "a / b / c",
      createdAt: today, taskIds: [], progress: [], aiHidden: false, followUps: fus });
    await clickTab("미팅");
    await openTodo(CAP_TITLE);
    await clickInModalExact("항목으로 나누기");
    const a = await splitRow("a"), b = await splitRow("b"), c = await splitRow("c");
    if (!a || !a.checked || a.disabled) throw new Error("the first candidate is not ticked: " + JSON.stringify(a));
    if (!c || c.checked || !c.disabled || !b || b.checked || !b.disabled) throw new Error("candidates past the room are not disabled: " + JSON.stringify({ b, c }));
    if (!(await overlayText()).includes("후속 항목은 30건까지예요 — 1건만 추가할 수 있어요.")) throw new Error("the room line is missing: " + (await overlayText()).slice(0, 300));
    await clickInModalExact("추가");
    await expectText("후속 항목 1건을 추가했어요");
    const m = ((await readState()).meetings || []).find((x) => x.id === CAP_ID);
    if ((m.followUps || []).length !== 30) throw new Error("follow-ups at the cap: " + (m.followUps || []).length);
    await clickInModalExact("수정");
    await expectText("회의록 수정");
    const addDisabled = await page.evaluate(() => {
      const ov = [...document.querySelectorAll(".fixed.inset-0")].pop();
      const btn = ov && [...ov.querySelectorAll("button")].find((x) => (x.innerText || "").trim() === "항목 추가");
      return btn ? btn.disabled : null;
    });
    if (addDisabled !== true) throw new Error("the form's add-row button is not disabled at 30 items: " + addDisabled);
    if (!(await overlayText()).includes("후속 항목은 30건까지예요.")) throw new Error("the form does not state the follow-up cap");
    await closeModal();
  });

  // Phase 3 (written 2026-09-17, not run): the work packet states follow-ups as items. It reads the step-16 meeting, so
  // the cleanup that used to end the previous step runs at the end of this one.
  await step("the work packet states each follow-up with owner, due and state, and keeps the raw line only for a meeting without items", async () => {
    const today = await dstrIn(0);
    const RAW_ID = "e2e-raw-mtg", RAW_TITLE = "E2E 원문 후속 회의";
    const HIDDEN_ID = "e2e-hidden-fu-mtg", HIDDEN_TITLE = "E2E 비공개 후속 회의";
    await plantMeetingRecord({ id: RAW_ID, date: today, title: RAW_TITLE, summary: "원문 확인", actions: "원문 후속",
      createdAt: today, taskIds: [], progress: [], aiHidden: false, followUps: [] });
    await plantMeetingRecord({ id: HIDDEN_ID, date: today, title: HIDDEN_TITLE, summary: "비공개 요약", actions: "비공개 원문 후속",
      createdAt: today, taskIds: [], progress: [], aiHidden: true, followUps: [{ id: "e2e-hidden-fu", text: "비공개 후속 항목", mine: true, done: false }] });
    await clickTab("업무");
    await clickText("AI로 만들기 ›");
    await sleep(400);
    await expectText("오늘 업무 만들기");
    const txt = await page.evaluate(() => document.querySelector(".fixed.inset-0 textarea")?.value || "");
    await closeModal();
    // One meeting's lines: its `- {date} …{title}` heading and every indented line under it.
    const blockOf = (title) => {
      const lines = txt.split(NL);
      const i = lines.findIndex((l) => l.startsWith("- ") && l.endsWith(" " + title));
      if (i < 0) return null;
      const out = [lines[i]];
      for (let j = i + 1; j < lines.length && lines[j].startsWith("  "); j++) out.push(lines[j]);
      return out;
    };
    if (txt.length > 20000) throw new Error("the work packet exceeds the 20000-char cap: " + txt.length);
    if (!txt.includes("## 업무 기록 (이월·어제·오늘)")) throw new Error("the work-record heading is not 업무 기록 (이월·어제·오늘)");
    const m = await fuMeeting();
    const fus = [...m.followUps.filter((f) => !f.done), ...m.followUps.filter((f) => f.done)];
    const line = (f) => `  - ${f.mine ? "내 담당" : "타인"} · ${f.due ? `기한 ${f.due}` : "기한 없음"} · ${f.done ? "완료" : "미완료"} · ${f.text}`;
    const fuBlock = blockOf(FU_MEETING);
    if (!fuBlock) throw new Error("the packet lacks the follow-up meeting: " + txt.slice(0, 300));
    const at = fuBlock.indexOf(`  후속 ${fus.length}건:`);
    if (fus.length !== 2 || at < 0) throw new Error("the follow-up meeting's item heading: " + fuBlock.join(" | "));
    const want = fus.map(line);
    if (!want.includes(`  - 내 담당 · 기한 ${m.followUps[0].due} · 미완료 · 견적서 송부`) || !want.includes("  - 타인 · 기한 없음 · 미완료 · 단가표 회신")) throw new Error("the saved follow-ups drifted from the earlier steps: " + want.join(" | "));
    if (fuBlock.slice(at + 1, at + 3).join(NL) !== want.join(NL)) throw new Error("the item lines: " + fuBlock.slice(at + 1, at + 3).join(" | ") + " — expected " + want.join(" | "));
    if (fuBlock.some((l) => l.startsWith("  후속: "))) throw new Error("a meeting with items still carries the raw follow-up line: " + fuBlock.join(" | "));
    const rawBlock = blockOf(RAW_TITLE);
    if (!rawBlock || !rawBlock.includes("  후속: 원문 후속") || rawBlock.some((l) => /^  후속 \d+건:$/.test(l))) throw new Error("the meeting without items: " + JSON.stringify(rawBlock));
    const hidden = blockOf(HIDDEN_TITLE);
    if (!hidden || hidden.length !== 2 || hidden[1] !== "  내용 비공개 (AI에 보내지 않기)") throw new Error("the hidden meeting's lines: " + JSON.stringify(hidden));
    if (txt.includes("비공개 후속 항목") || txt.includes("비공개 원문 후속")) throw new Error("the hidden meeting's follow-ups reached the packet");
    // Leave the save as flow11 expects it: the planted and form-made meetings gone, with every work item they created.
    await page.evaluate((k, ids, title) => {
      const s = JSON.parse(localStorage.getItem(k));
      const gone = new Set(s.meetings.filter((x) => ids.includes(x.id) || x.title === title).map((x) => x.id));
      s.meetings = s.meetings.filter((x) => !gone.has(x.id));
      s.work = (s.work || []).filter((w) => !(w.link?.kind === "meeting" && gone.has(w.link.id)));
      localStorage.setItem(k, JSON.stringify(s));
    }, KEY, [SPLIT_ID, CAP_ID, RAW_ID, HIDDEN_ID], FU_MEETING);
    await h.reload();
  });

  // ── Urgent memos and transcripts (2026-09-17): a meeting with `projectId: null` listed under `프로젝트 없음 · 긴급 메모`,
  // and a pasted transcript kept as pasted, read collapsed in the view and cleared on its own. Written under the standing
  // instruction that the suite is not run.
  const MEMO_TITLE = "E2E 긴급 메모", MEMO_GROUP = "프로젝트 없음 · 긴급 메모", SENTINEL = "E2E-TRANSCRIPT-SENTINEL-9f3a";
  const TRANSCRIPT = "첫 줄 " + SENTINEL + NL + "  둘째 줄 (들여쓰기 유지)" + NL + NL + "넷째 줄";
  const TRANSCRIPT_SEL = '.fixed.inset-0 textarea[placeholder^="녹취록"]';
  const memo = async () => ((await readState()).meetings || []).find((m) => m.title === MEMO_TITLE);
  // The section titles of the meetings tab in screen order (`.font-bold.truncate` — a project name or the memo group).
  const sectionTitles = () => page.evaluate(() => [...document.querySelectorAll("main section")]
    .map((s) => (s.querySelector(".font-bold.truncate")?.innerText || "").trim()).filter(Boolean));
  // The memo chip of the open meeting form as `{ on }`, read off its class (`bg-cyan-400` = selected), or null.
  const memoChip = () => page.evaluate(() => {
    const ov = [...document.querySelectorAll(".fixed.inset-0")].pop();
    const b = ov && [...ov.querySelectorAll("button")].find((x) => (x.innerText || "").trim() === "없음 (긴급 메모)");
    return b ? { on: /bg-cyan-400/.test(b.className || "") } : null;
  });
  const transcriptField = () => page.evaluate((sel) => { const el = document.querySelector(sel); return el ? el.value : null; }, TRANSCRIPT_SEL);

  await step("a memo saved with no project has projectId null and lists under the project-less group after the project groups", async () => {
    const before = await readState();
    await clickTab("미팅");
    await expectText(MEMO_GROUP);
    await expectText("긴급 메모가 없어요.");
    await clickText("긴급 메모 추가"); await sleep(400);
    await expectText("새 회의록");
    const chip = await memoChip();
    if (!chip || !chip.on) throw new Error("the memo chip is not preselected: " + JSON.stringify(chip));
    // Textarea 0 is still the summary: the transcript block is collapsed until its button is tapped.
    await fillMeeting({ title: MEMO_TITLE, summary: "긴급 메모 확인" });
    await clickInModalExact("녹취록 붙여넣기");
    await setValue(TRANSCRIPT_SEL, TRANSCRIPT);
    await clickInModalExact("등록");
    await expectText("회의록을 등록했어요");
    await sleep(300);
    const after = await readState();
    const m = (after.meetings || []).find((x) => x.title === MEMO_TITLE);
    if (!m || !("projectId" in m) || m.projectId !== null) throw new Error("the memo's projectId: " + JSON.stringify(m));
    if (m.transcript !== TRANSCRIPT) throw new Error("the transcript was not stored as pasted: " + JSON.stringify(m.transcript));
    for (const k of ["id", "date", "title", "summary", "createdAt", "taskIds", "progress", "aiHidden", "followUps"]) if (!(k in m)) throw new Error("the memo lacks the key " + k);
    assertBoundary(before, after, "saving a memo");
    const list = await projectRows(MEMO_GROUP);
    if (!list || !list.some((r) => r.title === MEMO_TITLE)) throw new Error("the memo group rows: " + JSON.stringify(list));
    const titles = await sectionTitles();
    const ip = titles.indexOf(PROJECT), im = titles.indexOf(MEMO_GROUP);
    if (ip < 0 || im < 0 || ip > im) throw new Error("the memo group is not after the project sections: " + titles.join(" | "));
  });

  await step("the view states the transcript's length collapsed, expands and collapses it, and the packet-facing fact rows are unchanged", async () => {
    await clickTab("미팅");
    await openTodo(MEMO_TITLE);
    const label = `녹취록 ${TRANSCRIPT.length}자 · 펼치기`;
    let view = await overlayText();
    if (!view.includes(label)) throw new Error("the collapsed transcript row: " + view.slice(0, 300));
    if (!view.includes("프로젝트") || !view.includes("없음 (긴급 메모)")) throw new Error("the project fact of a memo: " + view.slice(0, 300));
    if (!view.includes("요약·진행사항 포함")) throw new Error("the AI fact row changed: " + view.slice(0, 300));
    if (view.includes(SENTINEL)) throw new Error("the collapsed view shows the transcript text");
    await clickInModalExact(label);
    view = await overlayText();
    for (const t of [SENTINEL, "둘째 줄 (들여쓰기 유지)", "접기", "녹취록 지우기"]) if (!view.includes(t)) throw new Error(`the expanded view lacks "${t}": ` + view.slice(0, 400));
    await clickInModalExact("접기");
    if ((await overlayText()).includes(SENTINEL)) throw new Error("the transcript is still shown after collapsing");
    await closeModal();
  });

  await step("the transcript refuses 30001 chars with the count, keeps the paste in the form, and accepts 30000", async () => {
    await openTodo(MEMO_TITLE);
    await clickInModalExact("수정");
    await expectText("회의록 수정");
    const opened = await transcriptField();
    if (opened !== TRANSCRIPT) throw new Error("the edit form did not open the saved transcript: " + JSON.stringify(opened));
    await setValue(TRANSCRIPT_SEL, "가".repeat(30001));
    await clickInModalExact("저장");
    const e = await modalError();
    if (e !== "녹취록은 30000자까지예요 — 지금 30001자예요.") throw new Error("an over-cap transcript gave: " + (e || "no error"));
    const kept = await transcriptField();
    if ((kept || "").length !== 30001) throw new Error("the refused paste was not kept in the form: " + (kept || "").length);
    await setValue(TRANSCRIPT_SEL, "가".repeat(30000));
    await clickInModalExact("저장");
    await expectText("회의록을 수정했어요");
    await sleep(300);
    const m = await memo();
    if (!m || (m.transcript || "").length !== 30000) throw new Error("the 30000-char transcript was not stored: " + (m?.transcript || "").length);
    const line = await countsLine();
    if (!/저장 공간 \d+\.\dMB/.test(line)) throw new Error("meetings counts line after the transcript: " + JSON.stringify(line));
  });

  await step("clearing the transcript removes that field only and leaves summary, decisions, follow-ups and progress as they were", async () => {
    const today = await dstrIn(0);
    const id = (await memo()).id;
    await page.evaluate((k, mid, d) => {
      const s = JSON.parse(localStorage.getItem(k));
      s.meetings = s.meetings.map((m) => (m.id === mid ? { ...m, decisions: "E2E 결정",
        followUps: [{ id: "e2e-memo-fu", text: "E2E 메모 후속", mine: false, done: false }],
        progress: [{ id: "e2e-memo-pg", date: d, text: "E2E 메모 진행" }] } : m));
      localStorage.setItem(k, JSON.stringify(s));
    }, KEY, id, today);
    await h.reload();
    const before = await readState();
    const memoBefore = before.meetings.find((m) => m.id === id);
    await clickTab("미팅");
    await openTodo(MEMO_TITLE);
    await clickInModalExact(`녹취록 ${memoBefore.transcript.length}자 · 펼치기`);
    await page.evaluate(() => { window.confirm = () => true; });
    await clickInModalExact("녹취록 지우기");
    await expectText("녹취록을 지웠어요");
    await sleep(300);
    const after = await readState();
    const memoAfter = after.meetings.find((m) => m.id === id);
    if (!memoAfter || "transcript" in memoAfter) throw new Error("the transcript key survived: " + JSON.stringify(memoAfter).slice(0, 200));
    if (JSON.stringify({ ...memoBefore, transcript: undefined }) !== JSON.stringify({ ...memoAfter, transcript: undefined })) throw new Error("clearing the transcript changed another field: " + JSON.stringify(memoAfter).slice(0, 300));
    const view = await overlayText();
    if (!view.includes("녹취록 없음") || view.includes("펼치기")) throw new Error("the view after clearing: " + view.slice(0, 300));
    assertBoundary(before, after, "clearing a transcript");
  });

  await step("moving a memo into a project relists it under that project, and back to the memo chip returns it to the group", async () => {
    const pid = ((await readState()).meetingProjects || []).find((p) => p.name === PROJECT)?.id;
    if (!pid) throw new Error("the project is missing from the save");
    await closeModal();
    await openTodo(MEMO_TITLE);
    await clickInModalExact("수정");
    await clickInModalExact(PROJECT);
    await clickInModalExact("저장");
    await expectText("회의록을 수정했어요");
    await sleep(300);
    if ((await memo()).projectId !== pid) throw new Error("the memo did not move into the project: " + JSON.stringify(await memo()));
    const inProject = await projectRows(PROJECT);
    let inGroup = await projectRows(MEMO_GROUP);
    if (!inProject || !inProject.some((r) => r.title === MEMO_TITLE)) throw new Error("the project section does not list the moved memo: " + JSON.stringify(inProject));
    if (!inGroup || inGroup.some((r) => r.title === MEMO_TITLE)) throw new Error("the memo group still lists the moved memo: " + JSON.stringify(inGroup));
    await expectText("긴급 메모가 없어요.");
    await openTodo(MEMO_TITLE);
    await clickInModalExact("수정");
    await clickInModalExact("없음 (긴급 메모)");
    await clickInModalExact("저장");
    await expectText("회의록을 수정했어요");
    await sleep(300);
    if ((await memo()).projectId !== null) throw new Error("the memo did not return to the memo group: " + JSON.stringify(await memo()));
    inGroup = await projectRows(MEMO_GROUP);
    if (!inGroup || !inGroup.some((r) => r.title === MEMO_TITLE)) throw new Error("the memo group does not list the memo again: " + JSON.stringify(inGroup));
    // Leave the save as flow11 expects it: the memo gone, with any work item linked to it (none expected).
    await page.evaluate((k, title) => {
      const s = JSON.parse(localStorage.getItem(k));
      const gone = new Set(s.meetings.filter((x) => x.title === title).map((x) => x.id));
      s.meetings = s.meetings.filter((x) => !gone.has(x.id));
      s.work = (s.work || []).filter((w) => !(w.link?.kind === "meeting" && gone.has(w.link.id)));
      localStorage.setItem(k, JSON.stringify(s));
    }, KEY, MEMO_TITLE);
    await h.reload();
  });

  // ── Documents (schema v27): a record of what a file says, attached to a project or to none, listed in the meetings tab
  // under its minutes rows, opened in its own sheet and deleted after a confirm by title. Written 2026-09-17 under the
  // standing instruction that the suite is not run.
  const DOC_TITLE = "E2E 요구사항 문서", DOC_MEMO_TITLE = "E2E 메모 문서", DOC_SENTINEL = "E2E-DOC-SENTINEL-7b1c";
  const DOC_TITLE_SEL = '.fixed.inset-0 input[placeholder^="문서 제목"]';
  const DOC_SOURCE_SEL = '.fixed.inset-0 input[placeholder^="출처"]';
  const DOC_SUMMARY_SEL = '.fixed.inset-0 textarea[placeholder^="문서 요약"]';
  const docByTitle = async (t) => ((await readState()).documents || []).find((d) => d.title === t);
  // Tap a button by its exact label inside one meetings-tab section.
  const clickInSection = async (name, label) => {
    const ok = await page.evaluate((n, l) => {
      const sec = [...document.querySelectorAll("main section")].find((s) => (s.querySelector(".font-bold.truncate")?.innerText || "").trim() === n);
      const b = sec && [...sec.querySelectorAll("button")].find((x) => (x.innerText || "").trim() === l);
      if (!b) return false;
      b.scrollIntoView({ block: "center" }); b.click(); return true;
    }, name, label);
    if (!ok) throw new Error(`no "${label}" button in the section ${name}`);
    await sleep(400);
  };
  // One section's head count span (`회의록 {n}건 · 문서 {d}건`), or null.
  const sectionCount = (name) => page.evaluate((n) => {
    const sec = [...document.querySelectorAll("main section")].find((s) => (s.querySelector(".font-bold.truncate")?.innerText || "").trim() === n);
    return sec ? (sec.querySelector(".font-bold.truncate")?.parentElement?.querySelector(".font-mono")?.innerText || "").trim() : null;
  }, name);
  // Whether the chip of that exact label in the open sheet is on (`bg-cyan-400`), or null when absent.
  const chipOn = (label) => page.evaluate((l) => {
    const ov = [...document.querySelectorAll(".fixed.inset-0")].pop();
    const b = ov && [...ov.querySelectorAll("button")].find((x) => (x.innerText || "").trim() === l);
    return b ? /bg-cyan-400/.test(b.className || "") : null;
  }, label);
  // The disabled state of the open sheet's `삭제` button, or null when absent.
  const deleteDisabled = () => page.evaluate(() => {
    const ov = [...document.querySelectorAll(".fixed.inset-0")].pop();
    const b = ov && [...ov.querySelectorAll("button")].find((x) => (x.innerText || "").trim() === "삭제");
    return b ? b.disabled : null;
  });
  let docsBeforeCount = 0;

  await step("a document registers under a project with its title, source and summary, and lists in that project's section", async () => {
    const today = await dstrIn(0);
    const before = await readState();
    docsBeforeCount = (before.documents || []).length;
    const pid = (before.meetingProjects || []).find((p) => p.name === PROJECT)?.id;
    if (!pid) throw new Error("the project is missing from the save");
    await clickTab("미팅");
    await clickInSection(PROJECT, "문서 추가");
    await expectText("문서 추가");
    if ((await chipOn(PROJECT)) !== true) throw new Error("the project chip is not preselected");
    const summary = "첫 줄 " + DOC_SENTINEL + NL + "둘째 줄";
    await setValue(DOC_TITLE_SEL, DOC_TITLE);
    await setValue(DOC_SOURCE_SEL, "spec-v1.pdf");
    await setValue(DOC_SUMMARY_SEL, summary);
    await clickInModalExact("등록");
    await expectText("문서를 등록했어요");
    await sleep(300);
    const after = await readState();
    if ((after.documents || []).length !== docsBeforeCount + 1) throw new Error("documents length: " + (after.documents || []).length);
    const d = after.documents.find((x) => x.title === DOC_TITLE);
    if (!d || d.projectId !== pid || d.source !== "spec-v1.pdf" || d.summary !== summary || d.addedAt !== today) throw new Error("the document record: " + JSON.stringify(d));
    const keys = Object.keys(d).sort().join(",");
    if (keys !== ["id", "projectId", "title", "source", "summary", "addedAt"].sort().join(",")) throw new Error("the document keys: " + keys);
    assertBoundary(before, after, "adding a document");
    for (const k of ["meetings", "work"]) if (JSON.stringify(before[k]) !== JSON.stringify(after[k])) throw new Error("adding a document changed " + k);
    const head = await sectionCount(PROJECT);
    if (!head || !head.endsWith("문서 1건")) throw new Error("the project head: " + JSON.stringify(head));
    const list = await projectRows(PROJECT);
    if (!list || !list.some((r) => r.title === DOC_TITLE && r.lead === "문서")) throw new Error("the project rows: " + JSON.stringify(list));
    const line = await countsLine();
    if (!line.includes(`문서 ${docsBeforeCount + 1}건`)) throw new Error("meetings counts line: " + JSON.stringify(line));
  });

  await step("the document sheet states the facts, an edit clears the source, and the caps refuse with the count", async () => {
    const today = await dstrIn(0);
    await clickTab("미팅");
    await openTodo(DOC_TITLE);
    const sheet = await overlayText();
    for (const t of ["프로젝트", PROJECT, "추가일", today]) if (!sheet.includes(t)) throw new Error(`the document sheet lacks "${t}": ` + sheet.slice(0, 300));
    // The source and the summary are field values, not text nodes.
    const fields = await page.evaluate((a, b) => [document.querySelector(a)?.value, document.querySelector(b)?.value], DOC_SOURCE_SEL, DOC_SUMMARY_SEL);
    if (fields[0] !== "spec-v1.pdf" || !String(fields[1]).includes(DOC_SENTINEL)) throw new Error("the document sheet fields: " + JSON.stringify(fields));
    const before = await readState();
    const cur = before.documents.find((x) => x.title === DOC_TITLE);
    await setValue(DOC_SOURCE_SEL, "");
    await setValue(DOC_TITLE_SEL, "가".repeat(61));
    await clickInModalExact("저장");
    let e = await modalError();
    if (e !== "문서 제목은 60자까지예요 — 지금 61자예요.") throw new Error("the title cap refusal: " + e);
    await setValue(DOC_TITLE_SEL, DOC_TITLE);
    await setValue(DOC_SUMMARY_SEL, "가".repeat(5001));
    await clickInModalExact("저장");
    e = await modalError();
    if (e !== "문서 요약은 5000자까지예요 — 지금 5001자예요.") throw new Error("the summary cap refusal: " + e);
    await setValue(DOC_SUMMARY_SEL, "요약 수정");
    await clickInModalExact("저장");
    await expectText("문서를 수정했어요");
    await sleep(300);
    const after = await readState();
    const d = await docByTitle(DOC_TITLE);
    if (!d || "source" in d || d.summary !== "요약 수정" || d.addedAt !== cur.addedAt || d.id !== cur.id) throw new Error("the edited document: " + JSON.stringify(d));
    assertBoundary(before, after, "editing a document");
  });

  await step("a document with no project lists in the memo group and moves into a project from its sheet", async () => {
    const pid = ((await readState()).meetingProjects || []).find((p) => p.name === PROJECT)?.id;
    await clickTab("미팅");
    await clickInSection(MEMO_GROUP, "문서 추가");
    if ((await chipOn("없음 (긴급 메모)")) !== true) throw new Error("the memo chip is not preselected");
    await setValue(DOC_TITLE_SEL, DOC_MEMO_TITLE);
    await setValue(DOC_SUMMARY_SEL, "메모 문서");
    await clickInModalExact("등록");
    await expectText("문서를 등록했어요");
    await sleep(300);
    let d = await docByTitle(DOC_MEMO_TITLE);
    if (!d || !("projectId" in d) || d.projectId !== null) throw new Error("the memo document's projectId: " + JSON.stringify(d));
    let inGroup = await projectRows(MEMO_GROUP);
    if (!inGroup || !inGroup.some((r) => r.title === DOC_MEMO_TITLE)) throw new Error("the memo group rows: " + JSON.stringify(inGroup));
    await openTodo(DOC_MEMO_TITLE);
    await clickInModalExact(PROJECT);
    await clickInModalExact("저장");
    await expectText("문서를 수정했어요");
    await sleep(300);
    d = await docByTitle(DOC_MEMO_TITLE);
    if (d?.projectId !== pid) throw new Error("the document did not move into the project: " + JSON.stringify(d));
    const inProject = await projectRows(PROJECT);
    if (!inProject || !inProject.some((r) => r.title === DOC_MEMO_TITLE)) throw new Error("the project section does not list the moved document: " + JSON.stringify(inProject));
    await openTodo(DOC_MEMO_TITLE);
    await clickInModalExact("없음 (긴급 메모)");
    await clickInModalExact("저장");
    await expectText("문서를 수정했어요");
    await sleep(300);
    d = await docByTitle(DOC_MEMO_TITLE);
    if (!d || d.projectId !== null) throw new Error("the document did not return to the memo group: " + JSON.stringify(d));
    inGroup = await projectRows(MEMO_GROUP);
    if (!inGroup || !inGroup.some((r) => r.title === DOC_MEMO_TITLE)) throw new Error("the memo group does not list the document again: " + JSON.stringify(inGroup));
  });

  await step("deleting a project with documents is refused, and deleting the documents by title clears the way", async () => {
    const PD = "E2E 문서 프로젝트", PD_DOC = "E2E 삭제 문서";
    const today = await dstrIn(0);
    await page.evaluate((k, name, title, d) => {
      const s = JSON.parse(localStorage.getItem(k));
      s.meetingProjects = [{ id: "e2e-doc-project", name, createdAt: d }, ...(s.meetingProjects || [])];
      s.documents = [{ id: "e2e-doc-planted", projectId: "e2e-doc-project", title, summary: "삭제할 문서", addedAt: d }, ...(s.documents || [])];
      localStorage.setItem(k, JSON.stringify(s));
    }, KEY, PD, PD_DOC, today);
    await h.reload();
    await clickTab("미팅");
    await clickInSection(PD, "프로젝트 수정");
    if ((await deleteDisabled()) !== true) throw new Error("the project delete button is not disabled with a document on it");
    if (!(await overlayText()).includes("문서 1건이 있어 삭제할 수 없어요 — 문서를 먼저 지워요.")) throw new Error("the sheet does not state the documents refusal");
    await closeModal();
    await page.evaluate(() => { window.__confirms = []; window.confirm = (m) => { window.__confirms.push(m); return true; }; });
    const before = await readState();
    await openTodo(PD_DOC);
    await clickInModalExact("삭제");
    await expectText("문서를 삭제했어요");
    await sleep(300);
    const after = await readState();
    if ((after.documents || []).some((d) => d.id === "e2e-doc-planted")) throw new Error("the planted document survived");
    if (!(after.meetingProjects || []).some((p) => p.id === "e2e-doc-project")) throw new Error("deleting the document removed its project");
    assertBoundary(before, after, "deleting a document");
    await clickInSection(PD, "프로젝트 수정");
    if ((await deleteDisabled()) !== false) throw new Error("the project delete button is still disabled with no documents");
    await clickInModalExact("삭제");
    await expectText("프로젝트를 삭제했어요");
    await sleep(300);
    for (const t of [DOC_TITLE, DOC_MEMO_TITLE]) {
      await openTodo(t);
      await clickInModalExact("삭제");
      await expectText("문서를 삭제했어요");
      await sleep(300);
    }
    const confirms = await page.evaluate(() => window.__confirms);
    const want = [PD_DOC, DOC_TITLE, DOC_MEMO_TITLE].map((t) => `${t} 문서를 삭제해요. 계속할까요?`);
    if (JSON.stringify(confirms) !== JSON.stringify(want)) throw new Error("the delete confirms: " + JSON.stringify(confirms));
    const end = await readState();
    if ((end.documents || []).length !== docsBeforeCount) throw new Error("documents after the cleanup: " + (end.documents || []).length);
    if ((end.meetingProjects || []).some((p) => p.id === "e2e-doc-project")) throw new Error("the planted project survived");
  });
};
