// Schedule tab — appointments and deadlines. An event is a record, never a task: these steps assert that
// registering, ticking and cancelling one changes `events` only, and never the tasks, streak or trophies.
// The event sheet's `확인할 것` checklist (v27) is covered in flow11.js, next to the project fixtures it needs.
module.exports = async (h) => {
  const { step, clickTab, clickText, clickExact, clickInModal, clickInModalExact, expectText, hasText, rows, todoRows, overlayText, typeInto, setValue, closeModal, modalError, sleep, page, errors } = h;

  // Dates are computed in the page with the app's own local-date logic (never toISOString).
  const dstrIn = (delta) => page.evaluate((d) => {
    const t = new Date(); t.setHours(12, 0, 0, 0); t.setDate(t.getDate() + d);
    const p = (n) => String(n).padStart(2, "0");
    return `${t.getFullYear()}-${p(t.getMonth() + 1)}-${p(t.getDate())}`;
  }, delta);
  const readState = () => page.evaluate(() => { try { return JSON.parse(localStorage.getItem("liferpg-state-v1")); } catch { return null; } });
  // Occurrence rows come from the shared `rows` reader in run.js, read off the calendar's selected-day panel: for a
  // repeat, `texts` carries the occurrence date next to the title so one occurrence is addressed rather than the whole event.
  const openEventModal = async () => { await clickText("일정 추가"); await sleep(400); };
  // Register one event through the modal: a title, a day offset from today, and optionally a time,
  // the `마감` kind chip, a repeat chip and a track chip (v28) (all of them Korean UI copy, used here as selectors).
  const addEvent = async (title, delta, { kind = null, time = null, freq = null, track = null } = {}) => {
    await openEventModal();
    await typeInto("일정 이름", title);
    if (kind) await clickInModalExact(kind);
    await setValue('.fixed.inset-0 input[type="date"]', await dstrIn(delta));
    if (time) await setValue('.fixed.inset-0 input[type="time"]', time);
    if (freq) await clickInModalExact(freq);
    if (track) await clickInModalExact(track);
    await clickInModalExact("등록");
    await sleep(700);
  };

  /* ── Calendar readers (2026-09-11; the tab is calendar-only since 2026-09-16) ──────────────────────
     The grid is read structurally: leading and trailing cells are plain `div`s without a day number, so
     only the day buttons come back and a bare number inside a panel row can never pass for a cell. */
  const gridCells = () => page.evaluate(() => {
    const grid = [...document.querySelectorAll(".grid.grid-cols-7")].find((g) => g.querySelector("button"));
    if (!grid) return [];
    // `dow` is the column, so it is counted over every cell — the inert padding ones included — and only
    // then filtered down to the day buttons, which keeps the contract of one entry per day of the month.
    return [...grid.children].map((el, i) => ({ el, dow: i % 7 })).filter((c) => c.el.tagName === "BUTTON").map(({ el: b, dow }) => {
      const num = b.querySelector("span");
      const cls = num?.className || "";
      const dots = [...b.querySelectorAll("span.rounded-full")];
      const more = [...b.querySelectorAll("span")].find((s) => /^\+\d+$/.test((s.textContent || "").trim()));
      return {
        day: Number((num?.textContent || "").trim()),
        dow,
        // Exactly one tone on the day number, read back in the app's own order of precedence.
        tone: /text-amber-300/.test(cls) ? "amber" : /text-rose-400/.test(cls) ? "rose" : /text-sky-400/.test(cls) ? "sky" : "zinc",
        dots: dots.map((d) => (/bg-rose-400/.test(d.className) ? "due" : "appt")),
        plus: more ? Number(more.textContent.trim().slice(1)) : 0,
        selected: /border-cyan-500/.test(b.className),   // the selection and today are separate marks
        today: /text-amber-300/.test(cls),
      };
    });
  });
  // The weekday header is one cell per label, so it is read cell by cell, never as a single string.
  const weekdayCells = () => page.evaluate(() => {
    const head = [...document.querySelectorAll(".grid.grid-cols-7")].find((g) => !g.querySelector("button"));
    return head ? [...head.children].map((c) => (c.textContent || "").trim()) : [];
  });
  const monthLabel = () => page.evaluate(() => {
    const el = [...document.querySelectorAll("div")].find((d) => !d.children.length && /^\d{4}년 \d{1,2}월$/.test((d.textContent || "").trim()));
    return el ? el.textContent.trim() : "";
  });
  // The panel's mono line, `{YYYY-MM-DD} · {n}건`.
  const panelLine = () => page.evaluate(() => {
    const el = [...document.querySelectorAll("p")].find((p) => /^\d{4}-\d{2}-\d{2} · \d+건$/.test((p.textContent || "").trim()));
    return el ? el.textContent.trim() : "";
  });
  // The panel's holiday line, present only when the table covers the selected day.
  const holidayLine = () => page.evaluate(() => {
    const el = [...document.querySelectorAll("p")].find((p) => (p.textContent || "").trim().startsWith("공휴일 · "));
    return el ? el.textContent.trim() : "";
  });
  // The note under the grid, rendered only in a month the table does not cover.
  const coverageNote = () => page.evaluate(() => {
    const el = [...document.querySelectorAll("p")].find((p) => /^공휴일은 \d{4}~\d{4}년만 표시해요\.$/.test((p.textContent || "").trim()));
    return el ? el.textContent.trim() : "";
  });
  const nextMonthDisabled = () => page.evaluate(() => {
    const b = [...document.querySelectorAll("button")].find((x) => (x.innerText || "").trim() === "›");
    return b ? b.disabled : true;
  });
  const monthLabelIn = (delta) => page.evaluate((d) => {
    const t = new Date(); t.setHours(12, 0, 0, 0); t.setDate(1); t.setMonth(t.getMonth() + d);
    return `${t.getFullYear()}년 ${t.getMonth() + 1}월`;
  }, delta);
  const daysThisMonth = () => page.evaluate(() => { const t = new Date(); return new Date(t.getFullYear(), t.getMonth() + 1, 0).getDate(); });
  // Select the cell carrying this day number, searched among the grid buttons only.
  const pickDay = async (day) => {
    const ok = await page.evaluate((d) => {
      const grid = [...document.querySelectorAll(".grid.grid-cols-7")].find((g) => g.querySelector("button"));
      const b = grid && [...grid.querySelectorAll("button")].find((x) => Number((x.querySelector("span")?.textContent || "").trim()) === d);
      if (!b) return false;
      b.scrollIntoView({ block: "center" }); b.click(); return true;
    }, day);
    if (!ok) throw new Error(`day cell not found: ${day}`);
    await sleep(350);
  };
  const addButtonCount = () => page.evaluate(() => [...document.querySelectorAll("button")].filter((b) => (b.innerText || "").trim().includes("일정 추가")).length);
  // Show the month holding `date` and select that day, so the panel lists exactly that day's occurrences.
  // The tab has no list view any more, so every occurrence is read off the selected day's panel.
  const showDay = async (date) => {
    await clickTab("일정");
    const ym = (y, m) => y * 12 + (m - 1);
    const want = ym(Number(date.slice(0, 4)), Number(date.slice(5, 7)));
    for (let i = 0; ; i++) {
      const m = (await monthLabel()).match(/^(\d{4})년 (\d{1,2})월$/);
      if (!m) throw new Error("the calendar month header is missing");
      const diff = want - ym(Number(m[1]), Number(m[2]));
      if (diff === 0) break;
      if (i >= 2) throw new Error(`the calendar is still ${diff} month(s) away from ${date} after two presses`);
      await clickExact(diff > 0 ? "›" : "‹");
    }
    await pickDay(Number(date.slice(8)));
  };

  await step("schedule tab opens on the calendar and starts empty", async () => {
    await clickTab("일정");
    await expectText("다가오는 일정");
    await expectText("이 날짜에는 일정이 없어요.");
    const counts = await page.evaluate(() => (document.body.innerText.match(/오늘 \d+건 · 이번 주 \d+건 · 지난 마감 \d+건/) || [""])[0]);
    if (counts !== "오늘 0건 · 이번 주 0건 · 지난 마감 0건") throw new Error("schedule tab counts line: " + JSON.stringify(counts));
    if (await hasText("목록")) throw new Error("the schedule tab still offers a list view");
  });

  await step("the form refuses an event without a title or a date", async () => {
    await openEventModal();
    await expectText("새 일정");
    await clickInModalExact("등록");
    const noTitle = await modalError();
    if (!noTitle.includes("일정 이름을 입력해 주세요.")) errors.push("an event without a title was accepted: " + noTitle);
    await typeInto("일정 이름", "면접 리허설");
    // The only add button is the calendar panel's, which opens on the selected day — clear it to test the refusal.
    await setValue('.fixed.inset-0 input[type="date"]', "");
    await clickInModalExact("등록");
    const noDate = await modalError();
    if (!noDate.includes("날짜를 선택해 주세요.")) errors.push("an event without a date was accepted: " + noDate);
    await closeModal();
    const st = await readState();
    if ((st.events || []).length) throw new Error("a rejected form stored an event anyway");
  });

  await step("appointment registers on its day with its time", async () => {
    const before = await readState();
    await addEvent("면접 리허설", 1, { time: "14:00" });
    await showDay(await dstrIn(1));
    const r = await rows(["면접 리허설", await dstrIn(1)]);
    if (r.rows.length !== 1) throw new Error(`appointment row count ${r.rows.length}, expected 1`);
    if (!r.rows[0].includes("14:00")) throw new Error("the appointment row does not lead with its time: " + r.rows[0]);
    const st = await readState();
    const ev = (st.events || []).find((x) => x.title === "면접 리허설");
    if (!ev) throw new Error("the event was not stored");
    if (ev.goalId || ev.pts || ev.diff) throw new Error("the event carries task fields: " + JSON.stringify(ev));
    if (st.tasks.length !== before.tasks.length) throw new Error(`registering an event changed the task count ${before.tasks.length} to ${st.tasks.length}`);
  });

  await step("deadline registers and shows its D-day", async () => {
    await addEvent("원서 접수 마감", 3, { kind: "마감" });
    await showDay(await dstrIn(3));
    const r = await rows(["원서 접수 마감", await dstrIn(3)]);
    if (!r.rows.length) throw new Error("the deadline row is missing");
    if (!r.rows[0].includes("D-3")) throw new Error("the deadline row does not lead with D-3: " + r.rows[0]);
  });

  await step("weekly repeat marks both weeks and the to-do list collapses the later ones", async () => {
    await addEvent("주간 스터디", 1, { time: "20:00", freq: "매주", track: "개인" }); // v28: a packet track, for the packet step below
    for (const delta of [1, 8]) {
      await showDay(await dstrIn(delta));
      const day = await rows(["주간 스터디"]);
      if (day.rows.length !== 1) throw new Error(`the weekly event shows ${day.rows.length} rows on day +${delta}, expected 1`);
      if (!day.rows[0].includes("반복 매주")) throw new Error("the occurrence does not state its repeat: " + day.rows[0]);
    }
    // The to-do list's later group keeps one row per event, so a weekly event shows once tomorrow and at most once later.
    await clickTab("할 일");
    const todo = (await todoRows()) || [];
    const inTomorrow = todo.filter((r) => r.group === "내일" && r.title === "주간 스터디").length;
    const inLater = todo.filter((r) => r.group === "이후" && r.title === "주간 스터디").length;
    if (inTomorrow !== 1) throw new Error(`the weekly event shows ${inTomorrow} rows in the tomorrow group, expected 1`);
    if (inLater > 1) throw new Error(`the weekly event shows ${inLater} rows in the later group, expected at most 1 (the collapse)`);
    const st = await readState();
    const saved = (st.events || []).find((x) => x.title === "주간 스터디");
    if (saved.repeat?.freq !== "weekly") throw new Error("the repeat rule was not stored: " + JSON.stringify(saved.repeat));
    for (const k of Object.keys(saved)) {
      if (Array.isArray(saved[k]) && k !== "skip" && k !== "doneDates") throw new Error("derived occurrences were written into the save: " + k);
    }
  });

  await step("completion mark flips the button and stores only the date", async () => {
    const before = await readState();
    const date = await dstrIn(3);
    await showDay(date);
    const r = await rows(["원서 접수 마감", date], "완료 표시");
    if (!r.clicked) throw new Error("the deadline row has no completion button: " + r.rows.join(" | "));
    await sleep(800);
    const after = await rows(["원서 접수 마감", date]);
    if (!after.rows[0]?.includes("완료 취소")) throw new Error("the button did not flip after the completion mark: " + after.rows.join(" | "));
    const st = await readState();
    const ev = st.events.find((x) => x.title === "원서 접수 마감");
    if (!(ev.doneDates || []).includes(date)) throw new Error("the completed date was not stored: " + JSON.stringify(ev.doneDates));
    if (st.act.streak !== before.act.streak) throw new Error(`an event changed the streak ${before.act.streak} to ${st.act.streak}`);
    if (st.room.trophies.length !== before.room.trophies.length) throw new Error("an event created a trophy");
    if (st.tasks.length !== before.tasks.length) throw new Error("an event changed the task list");
  });

  await step("cancelling one occurrence leaves the next one", async () => {
    const date = await dstrIn(1);
    await showDay(date);
    const r = await rows(["주간 스터디", date], "이번 회차 취소");
    if (!r.clicked) throw new Error("the repeating row has no cancel-occurrence button: " + r.rows.join(" | "));
    await sleep(800);
    const gone = await rows(["주간 스터디", date]);
    if (gone.rows.length) throw new Error("the cancelled occurrence is still listed: " + gone.rows.join(" | "));
    await showDay(await dstrIn(8));
    const kept = await rows(["주간 스터디", await dstrIn(8)]);
    if (!kept.rows.length) throw new Error("the following occurrence disappeared with the cancelled one");
    const st = await readState();
    const ev = st.events.find((x) => x.title === "주간 스터디");
    if (!(ev.skip || []).includes(date)) throw new Error("the cancelled date was not stored: " + JSON.stringify(ev.skip));
  });

  await step("editing changes the stored event and its row", async () => {
    await showDay(await dstrIn(1));
    const r = await rows(["면접 리허설"], "수정");
    if (!r.clicked) throw new Error("the appointment row has no edit button: " + r.rows.join(" | "));
    await sleep(400);
    await expectText("일정 수정");
    await typeInto("일정 이름", "면접 리허설 2차");
    await clickInModalExact("저장");
    await sleep(800);
    const after = await rows(["면접 리허설 2차"]);
    if (after.rows.length !== 1) throw new Error(`row count for the edited title ${after.rows.length}, expected 1`);
    const st = await readState();
    if (st.events.some((x) => x.title === "면접 리허설")) throw new Error("the old title is still stored");
  });

  // Event `projectId` (secretary stage 1-A, 2026-09-17, written, not run): an optional reference to a meeting project,
  // written only when chosen; the prep card reads it and nothing else does.
  await step("the event form offers a project picker and stores projectId only when chosen", async () => {
    const TITLE = "E2E 프로젝트 일정";
    // Puppeteer's own select fires the change event React reads; the answer is the chosen option's label.
    const PICKER = '.fixed.inset-0 select[aria-label="프로젝트 (선택)"]';
    const pickProject = async (value) => {
      await page.select(PICKER, value);
      return page.$eval(PICKER, (sel) => (sel.selectedOptions[0] ? sel.selectedOptions[0].textContent : null));
    };
    await page.evaluate(() => {
      const s = JSON.parse(localStorage.getItem("liferpg-state-v1"));
      s.meetingProjects = [...(s.meetingProjects || []).filter((p) => p.id !== "pE"), { id: "pE", name: "E2E 일정 프로젝트", createdAt: "2026-01-01" }];
      localStorage.setItem("liferpg-state-v1", JSON.stringify(s));
    });
    await h.reload();
    const before = await readState();
    await showDay(await dstrIn(0));
    await openEventModal();
    await expectText("프로젝트 (선택)");
    await typeInto("일정 이름", TITLE);
    const label = await pickProject("pE");
    if (label !== "E2E 일정 프로젝트") throw new Error("the project picker lacks the planted project: " + JSON.stringify(label));
    await clickInModalExact("등록");
    await sleep(700);
    let ev = ((await readState()).events || []).find((x) => x.title === TITLE);
    if (!ev || ev.projectId !== "pE") throw new Error("the chosen project was not stored: " + JSON.stringify(ev));
    await showDay(await dstrIn(0));
    const r = await rows([TITLE], "수정");
    if (!r.clicked) throw new Error("the project event row has no edit button: " + r.rows.join(" | "));
    await sleep(400);
    await expectText("일정 수정");
    const shown = await page.evaluate(() => [...document.querySelectorAll(".fixed.inset-0")].pop()?.querySelector('select[aria-label="프로젝트 (선택)"]')?.value);
    if (shown !== "pE") throw new Error("the edit form did not open on the stored project: " + JSON.stringify(shown));
    if ((await pickProject("")) !== "연결 안 함") throw new Error("the picker has no unlinked option");
    await clickInModalExact("저장");
    await sleep(800);
    const after = await readState();
    ev = (after.events || []).find((x) => x.title === TITLE);
    if (!ev || "projectId" in ev) throw new Error("clearing the pick left projectId on the event: " + JSON.stringify(ev));
    for (const key of ["meetings", "meetingProjects", "tasks", "goals"]) {
      if (JSON.stringify(after[key] || []) !== JSON.stringify(before[key] || [])) throw new Error(`the project picker changed ${key}`);
    }
    await showDay(await dstrIn(0));
    const del = await rows([TITLE], "수정");
    if (!del.clicked) throw new Error("the project event row has no edit button for the delete");
    await sleep(400);
    await clickInModalExact("삭제");
    await sleep(700);
    await page.evaluate(() => {
      const s = JSON.parse(localStorage.getItem("liferpg-state-v1"));
      s.meetingProjects = (s.meetingProjects || []).filter((p) => p.id !== "pE");
      localStorage.setItem("liferpg-state-v1", JSON.stringify(s));
    });
    await h.reload();
    const st = await readState();
    if ((st.events || []).some((x) => x.title === TITLE) || (st.meetingProjects || []).some((p) => p.id === "pE")) throw new Error("the planted project or its event survived the cleanup");
  });

  // Tracks (schema v28, Phase 1, 2026-09-17, written, not run): the form's chips store `track`; picking a project follows
  // that project's track until a track chip is tapped in the same form.
  await step("the event form's track chips store track, and picking a project follows the project's track until a chip is tapped", async () => {
    const TITLE = "E2E 트랙 일정", PLAIN = "E2E 트랙 없는 일정";
    const PICKER = '.fixed.inset-0 select[aria-label="프로젝트 (선택)"]';
    const chipOn = (label) => page.evaluate((l) => {
      const ov = [...document.querySelectorAll(".fixed.inset-0")].pop();
      const b = ov && [...ov.querySelectorAll("button")].find((x) => (x.innerText || "").trim() === l);
      return b ? /bg-cyan-400/.test(b.className || "") : null;
    }, label);
    const eventBy = async (title) => ((await readState()).events || []).find((x) => x.title === title);
    await page.evaluate(() => {
      const s = JSON.parse(localStorage.getItem("liferpg-state-v1"));
      s.meetingProjects = [...(s.meetingProjects || []).filter((p) => p.id !== "pT"), { id: "pT", name: "E2E 트랙 프로젝트", createdAt: "2026-01-01", track: "biz" }];
      localStorage.setItem("liferpg-state-v1", JSON.stringify(s));
    });
    await h.reload();
    await showDay(await dstrIn(0));
    await openEventModal();
    await expectText("직장 트랙은 AI 패킷에 실리지 않아요.");
    if ((await chipOn("직장")) !== true) throw new Error("a new event does not default to the day-job track");
    await typeInto("일정 이름", TITLE);
    await page.select(PICKER, "pT");
    if ((await chipOn("사업")) !== true) throw new Error("picking a business project did not move the track chip");
    await clickInModalExact("등록");
    await sleep(700);
    if ((await eventBy(TITLE))?.track !== "biz") throw new Error("the event did not store its project's track: " + JSON.stringify(await eventBy(TITLE)));
    await showDay(await dstrIn(0));
    const r = await rows([TITLE], "수정");
    if (!r.clicked) throw new Error("the track event row has no edit button: " + r.rows.join(" | "));
    if (!r.rows[0].includes("사업")) throw new Error("the event row does not state its track: " + r.rows[0]);
    await sleep(400);
    await clickInModalExact("개인");
    await page.select(PICKER, "");
    await page.select(PICKER, "pT");
    if ((await chipOn("개인")) !== true) throw new Error("a project pick overrode a tapped track chip");
    await clickInModalExact("저장");
    await sleep(700);
    if ((await eventBy(TITLE))?.track !== "personal") throw new Error("the tapped track was not stored: " + JSON.stringify(await eventBy(TITLE)));
    await addEvent(PLAIN, 0);
    if ((await eventBy(PLAIN))?.track !== "work") throw new Error("an event with no project and no chip is not on the day-job track: " + JSON.stringify(await eventBy(PLAIN)));
    await page.evaluate((titles) => {
      const s = JSON.parse(localStorage.getItem("liferpg-state-v1"));
      s.events = (s.events || []).filter((e) => !titles.includes(e.title));
      s.meetingProjects = (s.meetingProjects || []).filter((p) => p.id !== "pT");
      localStorage.setItem("liferpg-state-v1", JSON.stringify(s));
    }, [TITLE, PLAIN]);
    await h.reload();
  });

  await step("deleting removes the event from the tab", async () => {
    await showDay(await dstrIn(1));
    const r = await rows(["면접 리허설 2차"], "수정");
    if (!r.clicked) throw new Error("the renamed row has no edit button");
    await sleep(400);
    await clickInModalExact("삭제");
    await sleep(800);
    const after = await rows(["면접 리허설 2차"]);
    if (after.rows.length) throw new Error("the deleted event is still listed: " + after.rows.join(" | "));
    const st = await readState();
    if (st.events.some((x) => x.title === "면접 리허설 2차")) throw new Error("the deleted event is still stored");
  });

  await step("briefing states the schedule between the tasks and the streak", async () => {
    await clickTab("일정");
    await addEvent("서류 제출 마감", 0, { kind: "마감", track: "개인" }); // v28: a packet track, for the packet step below
    await clickTab("할 일");
    await clickText("브리핑 열기");
    await sleep(500);
    const brief = await overlayText();
    if (!brief.includes("오늘 일정")) throw new Error("the briefing has no schedule section: " + brief.slice(0, 200));
    if (!brief.includes("서류 제출 마감 — 오늘 마감")) throw new Error("the deadline of the day is not stated: " + brief.slice(0, 300));
    const pos = ["오늘 할 일", "오늘 일정", "연속 기록"].map((t) => brief.indexOf(t));
    if (!(pos[0] < pos[1] && pos[1] < pos[2])) throw new Error("the schedule section is not between the tasks and the streak: " + pos.join(","));
  });

  await step("the briefing line opens the schedule tab", async () => {
    await clickInModal("서류 제출 마감");
    await sleep(500);
    const open = await page.evaluate(() => document.querySelectorAll(".fixed.inset-0").length);
    if (open) { await closeModal(); throw new Error("the briefing stayed open after its schedule line was tapped"); }
    await expectText("다가오는 일정");
    const line = await panelLine();
    if (!line.startsWith(await dstrIn(0))) throw new Error("the schedule tab did not open with today selected: " + JSON.stringify(line));
  });

  /* The same occurrence in the `할 일` list: a compact row with no controls that opens the event sheet. The sheet's
     actions are the schedule's own `EventRow` buttons (`toggleEventDone`), so ticking and un-ticking here leaves the
     save as it was and the packet assertions below still see an open deadline. */
  await step("the to-do list lists today's deadline and ticks it only through its event sheet", async () => {
    await clickTab("할 일");
    const open = (await todoRows("오늘")) || [];
    const ev = open.find((r) => r.title === "서류 제출 마감");
    if (!ev) throw new Error("today's deadline is not in the today group: " + open.map((r) => r.title).join(" | "));
    if (!ev.text.includes("D-DAY") || !ev.text.includes("목표 기여 없음")) {
      throw new Error("the deadline row does not lead with D-DAY and state that it moves no goal: " + ev.text);
    }
    // The rule boundary, read off the row: no checkbox, no lock, no evidence path, no payout (rules 1, 10, 16).
    if (ev.controls !== 0) throw new Error(`the deadline row carries ${ev.controls} inner control(s): ` + JSON.stringify(ev.buttons));
    await todoRows("오늘", { title: "서류 제출 마감" });
    await sleep(500);
    const sheet = await overlayText();
    for (const t of ["일정 — 서류 제출 마감", "완료 표시", "수정", "목표 기여 없음 — 일정은 기록이라 점수와 목표에 반영되지 않아요."]) {
      if (!sheet.includes(t)) throw new Error(`the event sheet does not state "${t}": ` + sheet.slice(0, 300));
    }
    if (sheet.includes("완료하기")) throw new Error("the event sheet offers the task completion button");
    const countsOf = () => page.evaluate(() => [...document.querySelectorAll("main p")]
      .map((p) => (p.innerText || "").replace(/\s+/g, " ").trim()).find((t) => /^기한 지남 \d+ · 오늘 \d+ · 이번 주 \d+$/.test(t)) || "");
    const todayCount = (line) => Number((line.match(/· 오늘 (\d+) ·/) || [])[1]);
    const beforeCounts = await countsOf();
    await clickInModalExact("완료 표시");
    await closeModal();
    // The ticked occurrence stays in `오늘`, struck through and led by `완료`; no done-today section exists and the
    // counts drop by one, because they state open rows only.
    if (((await todoRows("오늘 완료")) || []).length) throw new Error("the removed done-today section is back");
    const ticked = ((await todoRows("오늘")) || []).find((r) => r.title === "서류 제출 마감");
    if (!ticked) throw new Error("the ticked occurrence left the today group");
    if (!ticked.text.startsWith("완료")) throw new Error("the ticked occurrence does not lead with the done chip: " + ticked.text);
    const struck = await page.evaluate(() => [...document.querySelectorAll("main .text-sm.font-semibold")]
      .some((n) => (n.innerText || "").trim() === "서류 제출 마감" && /line-through/.test(n.className)));
    if (!struck) throw new Error("the ticked occurrence is not struck through");
    const afterCounts = await countsOf();
    if (todayCount(afterCounts) !== todayCount(beforeCounts) - 1) throw new Error(`the counts did not drop by one: ${beforeCounts} → ${afterCounts}`);
    // The `완료` archive lists the ticked occurrence beside completed tasks.
    await h.clickExact("완료");
    await sleep(400);
    const archived = await page.evaluate(() => {
      const sec = [...document.querySelectorAll("main section")].find((x) => /^완료 \d+건 · 최근 \d+건/.test((x.innerText || "").trim()));
      const node = sec && [...sec.querySelectorAll(".text-sm.font-semibold")].find((n) => (n.innerText || "").trim() === "서류 제출 마감");
      const row = node && node.closest("button");
      return row ? (row.innerText || "").replace(/\s+/g, " ").trim() : null;
    });
    if (!archived) throw new Error("the archive does not list the ticked occurrence");
    if (!archived.includes("목표 기여 없음")) throw new Error("the archived event row hides that it serves no goal: " + archived);
    // Back to the open list through the chip in `main` — the tab bar carries a button of the same name.
    await page.evaluate(() => [...document.querySelectorAll("main button")].find((b) => (b.innerText || "").trim() === "할 일")?.click());
    await sleep(400);
    await todoRows("오늘", { title: "서류 제출 마감" });
    await sleep(500);
    await clickInModalExact("완료 취소");
    await closeModal();
    const back = ((await todoRows("오늘")) || []).find((r) => r.title === "서류 제출 마감");
    if (!back || back.text.startsWith("완료")) throw new Error("un-ticking did not return the deadline to an open row in the today group: " + JSON.stringify(back));
  });

  /* Today's figure where it now lives: the removed home line counted `서류 제출 마감` twice (today's occurrence and a
     deadline inside three days). The tab's own counts line states today's occurrence and no missed deadline; the
     briefing's `— 오늘 마감` line and the `할 일` today-group step above still assert the deadline itself. */
  await step("the schedule tab counts line states today's deadline", async () => {
    await clickTab("일정");
    const line = await page.evaluate(() => {
      const p = [...document.querySelectorAll("main p")].find((x) => /^오늘 \d+건 · 이번 주 \d+건 · 지난 마감 \d+건$/.test((x.innerText || "").replace(/\s+/g, " ").trim()));
      return p ? p.innerText.replace(/\s+/g, " ").trim() : "";
    });
    if (!line.startsWith("오늘 1건 · ") || !line.endsWith("지난 마감 0건")) throw new Error("schedule tab counts line: " + JSON.stringify(line));
  });

  await step("the assistant packet lists the upcoming schedule", async () => {
    await clickTab("할 일");
    await clickText("브리핑 열기");
    await sleep(500);
    await clickInModal("AI에게 보내기");
    await sleep(500);
    const txt = await page.evaluate(() => document.querySelector(".fixed.inset-0 textarea")?.value || "");
    if (!txt.includes("## 다가오는 일정 (14일)")) throw new Error("the packet has no schedule section");
    if (txt.indexOf("## 다가오는 일정 (14일)") < txt.indexOf("## 열린 실행")) throw new Error("the schedule section is not placed after the open tasks");
    if (!txt.includes("서류 제출 마감")) throw new Error("the deadline of the day is missing from the packet");
    if (!txt.includes("주간 스터디 · 반복 매주")) throw new Error("the repeating appointment is missing its repeat marker in the packet");
    if (txt.length > 4000) errors.push("packet longer than the 4000-char cap: " + txt.length);
    await closeModal();
  });

  let freeDate = ""; // the empty day the panel line and the prefilled add are checked on

  await step("the calendar opens on this month with its weekday header", async () => {
    await clickTab("일정");
    await expectText("선택한 날짜");
    const head = await weekdayCells();
    const want = ["일", "월", "화", "수", "목", "금", "토"];
    if (head.length !== 7 || want.some((d, i) => head[i] !== d)) throw new Error("weekday header cells: " + JSON.stringify(head));
    const label = await monthLabel();
    const wantLabel = await monthLabelIn(0);
    if (label !== wantLabel) throw new Error(`month header "${label}", expected "${wantLabel}"`);
    const cells = await gridCells();
    const dim = await daysThisMonth();
    if (cells.length !== dim) throw new Error(`tappable day cells ${cells.length}, expected ${dim} (the padding cells must stay inert)`);
    const adds = await addButtonCount();
    if (adds !== 1) throw new Error(`add-event buttons on the schedule tab: ${adds}, expected 1 (the panel's own)`);
  });

  // `ui.scheduleView` is retired and read by nothing: a save that still holds "list" opens on the calendar all the same,
  // and the v22 block drops the key on load. The plant marks the save v21 — a save already at v22 never runs that block.
  await step("a save that stored the list view opens on the calendar", async () => {
    await page.evaluate(() => {
      const st = JSON.parse(localStorage.getItem("liferpg-state-v1"));
      st.ui = { ...(st.ui || {}), scheduleView: "list" };
      st.v = 21;
      localStorage.setItem("liferpg-state-v1", JSON.stringify(st));
    });
    await h.reload();
    await clickTab("일정");
    await expectText("선택한 날짜");
    if (await hasText("목록")) throw new Error("a list view came back from the stored preference");
    const st = await readState();
    if ("scheduleView" in (st.ui || {})) throw new Error("the retired schedule view survived the load: " + JSON.stringify(st.ui));
  });

  await step("today's cell marks its deadline and the panel opens on today", async () => {
    const today = await dstrIn(0);
    const cells = await gridCells();
    const cur = cells.find((c) => c.today);
    if (!cur) throw new Error("no cell carries today's mark");
    if (cur.day !== Number(today.slice(8))) throw new Error(`today's mark sits on day ${cur.day}, expected ${Number(today.slice(8))}`);
    if (!cur.selected) throw new Error("the calendar did not open with today selected");
    if (!cur.dots.includes("due")) throw new Error("the deadline registered for today has no deadline marker: " + JSON.stringify(cur));
    const want = `${today} · ${cur.dots.length + cur.plus}건`;
    const line = await panelLine();
    if (line !== want) throw new Error(`panel line "${line}" disagrees with the cell markers ${JSON.stringify(cur)}`);
  });

  await step("the selected day's panel renders the full event row", async () => {
    const today = await dstrIn(0);
    const r = await rows(["서류 제출 마감", today]);
    if (r.rows.length !== 1) throw new Error(`panel rows for today ${r.rows.length}, expected 1`);
    if (!r.rows[0].includes("D-DAY")) throw new Error("the panel row lost the lead badge the list shows: " + r.rows[0]);
    // The same row component, not a calendar-only summary: its controls must be on the panel row too.
    const controls = await page.evaluate((t) => {
      const card = [...document.querySelectorAll("button")].filter((b) => (b.innerText || "").trim() === "수정")
        .map((b) => b.parentElement.parentElement).find((c) => (c.innerText || "").includes(t));
      return card ? [...card.querySelectorAll("button")].map((b) => (b.innerText || "").trim()) : null;
    }, "서류 제출 마감");
    if (!controls || !controls.includes("수정") || !controls.includes("완료 표시")) throw new Error("panel row controls: " + JSON.stringify(controls));
  });

  await step("a day with no occurrence reads the empty line", async () => {
    const today = await dstrIn(0);
    const cells = await gridCells();
    const free = cells.filter((c) => !c.today && !c.dots.length && !c.plus);
    const pick = free.find((c) => c.day > Number(today.slice(8))) || free[free.length - 1];
    if (!pick) throw new Error("every day of this month carries an occurrence");
    freeDate = `${today.slice(0, 8)}${String(pick.day).padStart(2, "0")}`;
    await pickDay(pick.day);
    await expectText("이 날짜에는 일정이 없어요.");
    const want = `${freeDate} · 0건`;
    const line = await panelLine();
    if (line !== want) throw new Error(`panel line for an empty day "${line}", expected "${want}"`);
    const r = await rows([]);
    if (r.rows.length) throw new Error("an empty day still shows rows: " + r.rows.join(" | "));
    const after = await gridCells();
    const sel = after.filter((c) => c.selected);
    if (sel.length !== 1 || sel[0].day !== pick.day) throw new Error("the selection did not move to the tapped day: " + JSON.stringify(sel));
    if (!after.some((c) => c.today && !c.selected)) throw new Error("today's own mark disappeared once another day was selected");
  });

  await step("adding from the calendar opens on the selected day and registers there", async () => {
    const before = await readState();
    await openEventModal();
    await expectText("새 일정");
    const filled = await page.evaluate(() => document.querySelector('.fixed.inset-0 input[type="date"]')?.value || "");
    if (filled !== freeDate) throw new Error(`the date input opened on "${filled}", expected the selected day ${freeDate}`);
    await typeInto("일정 이름", "면접 일정 확인");
    await clickInModalExact("등록");
    await sleep(700);
    const r = await rows(["면접 일정 확인", freeDate]);
    if (r.rows.length !== 1) throw new Error(`the new event shows ${r.rows.length} rows in the selected day's panel, expected 1`);
    const want = `${freeDate} · 1건`;
    const line = await panelLine();
    if (line !== want) throw new Error(`panel line after the add: "${line}", expected "${want}"`);
    const cell = (await gridCells()).find((c) => c.day === Number(freeDate.slice(8)));
    if (!cell) throw new Error("the day the event was registered on left the grid: " + freeDate);
    if (cell.dots.length !== 1 || cell.dots[0] !== "appt") throw new Error("the day's marker after the add: " + JSON.stringify(cell));
    const st = await readState();
    const ev = (st.events || []).find((x) => x.title === "면접 일정 확인");
    if (!ev) throw new Error("the event registered from the calendar was not stored");
    if (ev.date !== freeDate) throw new Error(`stored date ${ev.date}, expected the selected day ${freeDate}`);
    if (ev.goalId || ev.pts || ev.diff) throw new Error("the event carries task fields: " + JSON.stringify(ev));
    if (st.tasks.length !== before.tasks.length) throw new Error("registering from the calendar changed the task list");
  });

  await step("the month pages one month at a time and the today button comes back", async () => {
    await clickExact("›");
    const nextLabel = await monthLabel();
    const wantNext = await monthLabelIn(1);
    if (nextLabel !== wantNext) throw new Error(`after ›: "${nextLabel}", expected "${wantNext}"`);
    const nextCells = await gridCells();
    // The weekly appointment has no end date, so the next month must carry its markers too.
    if (!nextCells.some((c) => c.dots.length)) throw new Error("the next month shows no occurrence of the weekly appointment");
    if (!nextCells.some((c) => c.selected && c.day === 1)) throw new Error("paging did not select the 1st of the month shown");
    if (nextCells.some((c) => c.today)) throw new Error("another month marked one of its days as today");
    await clickExact("‹");
    await clickExact("‹");
    const prevLabel = await monthLabel();
    const wantPrev = await monthLabelIn(-1);
    if (prevLabel !== wantPrev) throw new Error(`after ‹ ‹: "${prevLabel}", expected "${wantPrev}"`);
    // Every event in this flow starts today or later, so a past month has nothing to mark.
    const prevCells = await gridCells();
    const marked = prevCells.filter((c) => c.dots.length || c.plus);
    if (marked.length) throw new Error("a past month shows markers: " + JSON.stringify(marked));
    await expectText("이 날짜에는 일정이 없어요.");
    await clickExact("오늘");
    const backLabel = await monthLabel();
    const wantBack = await monthLabelIn(0);
    if (backLabel !== wantBack) throw new Error(`after the today button: "${backLabel}", expected "${wantBack}"`);
    const cur = (await gridCells()).find((c) => c.today);
    if (!cur?.selected) throw new Error("the today button did not reselect today");
    const line = await panelLine();
    if (!line.startsWith(await dstrIn(0))) throw new Error("the panel did not return to today: " + line);
  });

  await step("weekends and holidays tone the day numbers of the current month", async () => {
    const cells = await gridCells();
    // Sanity count on the whole grid: every month has at least four of each weekend day. Today is excluded
    // from the tone assertions below (amber outranks the weekend tone) but must not be excluded here — in a
    // month with exactly four Saturdays, running this step on a Saturday would otherwise count three.
    const sundays = cells.filter((c) => c.dow === 0);
    const saturdays = cells.filter((c) => c.dow === 6);
    if (sundays.length < 4 || saturdays.length < 4) throw new Error(`weekend cells read off the grid: ${sundays.length} Sundays, ${saturdays.length} Saturdays`);
    const sun = sundays.filter((c) => !c.today);
    const sat = saturdays.filter((c) => !c.today);
    const paleSun = sun.filter((c) => c.tone !== "rose");
    if (paleSun.length) throw new Error("Sundays that are not rose: " + JSON.stringify(paleSun));
    // A Saturday is sky unless it is also a holiday, which outranks it — and then the panel has to name it.
    const oddSat = sat.filter((c) => c.tone !== "sky" && c.tone !== "rose");
    if (oddSat.length) throw new Error("Saturdays in neither tone: " + JSON.stringify(oddSat));
    if (!sat.some((c) => c.tone === "sky")) throw new Error("no Saturday kept the sky tone: " + JSON.stringify(sat));
    for (const c of sat.filter((x) => x.tone === "rose")) {
      await pickDay(c.day);
      if (!(await holidayLine())) throw new Error(`Saturday ${c.day} is rose but the panel names no holiday`);
    }
    const skyWeekday = cells.filter((c) => c.dow > 0 && c.dow < 6 && c.tone === "sky");
    if (skyWeekday.length) throw new Error("the Saturday tone leaked onto a weekday: " + JSON.stringify(skyWeekday));
    if (!cells.some((c) => c.dow > 0 && c.dow < 6 && c.tone === "zinc")) throw new Error("no weekday kept the plain tone");
    const cur = cells.find((c) => c.today);
    if (cur?.tone !== "amber") throw new Error("today must stay one unambiguous tone: " + JSON.stringify(cur));
  });

  await step("a holiday names itself on the selected day's panel", async () => {
    await clickExact("오늘");
    let found = null;
    for (let i = 0; i <= 12 && !found; i++) {
      // Never a Sunday: a Sunday is rose whether or not it is a holiday, so it proves nothing about the table.
      found = (await gridCells()).find((c) => c.tone === "rose" && c.dow !== 0 && !c.today) || null;
      if (!found && i < 12) await clickExact("›");
    }
    if (!found) throw new Error("the holiday table must cover at least one holiday within 12 months of today");
    await pickDay(found.day);
    const line = await holidayLine();
    if (!/^공휴일 · .+$/.test(line)) throw new Error("the holiday panel line: " + JSON.stringify(line));
    // The line is added under the panel's own date line, never appended to it.
    const mono = await panelLine();
    if (!mono) throw new Error("the holiday line displaced the panel's date line");
    if (Number(mono.slice(8, 10)) !== found.day) throw new Error(`the panel line ${mono} does not belong to the holiday cell ${found.day}`);
  });

  await step("a month outside the table marks no holiday and says which years it covers", async () => {
    await clickExact("오늘");
    let note = "";
    for (let i = 0; i < 24 && !note; i++) {
      if (await nextMonthDisabled()) break;
      await clickExact("›");
      note = await coverageNote();
    }
    if (!note) throw new Error("the holiday table must not reach beyond today + 24 months, or this step needs a new target month");
    if (!/^공휴일은 \d{4}~\d{4}년만 표시해요\.$/.test(note)) throw new Error("the coverage note: " + JSON.stringify(note));
    const cells = await gridCells();
    const marked = cells.filter((c) => c.tone === "rose" && c.dow !== 0);
    if (marked.length) throw new Error("an uncovered month still marks a holiday: " + JSON.stringify(marked));
    // Weekend colour comes from the date, not from the table, so it must survive out here.
    const paleSun = cells.filter((c) => c.dow === 0 && c.tone !== "rose");
    if (paleSun.length) throw new Error("Sundays lost their tone outside the table: " + JSON.stringify(paleSun));
    const paleSat = cells.filter((c) => c.dow === 6 && c.tone !== "sky");
    if (paleSat.length) throw new Error("Saturdays lost their tone outside the table: " + JSON.stringify(paleSat));
    await clickExact("오늘");
    if (await coverageNote()) throw new Error("the current month shows the coverage note — extend the holiday table past this year");
  });

  await step("no list view remains", async () => {
    await clickTab("일정");
    const chips = await page.evaluate(() => [...document.querySelectorAll("button")]
      .map((b) => (b.innerText || "").trim()).filter((t) => t === "목록" || t === "달력"));
    if (chips.length) throw new Error("view chips are still rendered: " + chips.join(", "));
    const adds = await addButtonCount();
    if (adds !== 1) throw new Error(`add-event buttons on the schedule tab: ${adds}, expected 1`);
    const counts = await page.evaluate(() => (document.body.innerText.match(/오늘 \d+건 · 이번 주 \d+건 · 지난 마감 \d+건/) || [""])[0]);
    if (!counts) throw new Error("the counts line is missing from the schedule tab");
  });
};
