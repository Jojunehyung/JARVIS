// Schedule tab — appointments and deadlines. An event is a record, never a task: these steps assert that
// registering, ticking and cancelling one changes `events` only, and never the tasks, streak or trophies.
module.exports = async (h) => {
  const { step, clickTab, clickText, clickInModal, clickInModalExact, expectText, hasText, typeInto, setValue, closeModal, modalError, sleep, page, errors } = h;

  // Dates are computed in the page with the app's own local-date logic (never toISOString).
  const dstrIn = (delta) => page.evaluate((d) => {
    const t = new Date(); t.setHours(12, 0, 0, 0); t.setDate(t.getDate() + d);
    const p = (n) => String(n).padStart(2, "0");
    return `${t.getFullYear()}-${p(t.getMonth() + 1)}-${p(t.getDate())}`;
  }, delta);
  const readState = () => page.evaluate(() => { try { return JSON.parse(localStorage.getItem("liferpg-state-v1")); } catch { return null; } });
  const overlayText = () => page.evaluate(() => {
    const ov = [...document.querySelectorAll(".fixed.inset-0")].pop();
    return ov ? ov.innerText.replace(/\s+/g, " ").trim() : "";
  });
  // Occurrence rows, found structurally: every row carries a `수정` button and the card is its grandparent.
  // `texts` are the strings the row must show (title plus, for a repeat, the occurrence date);
  // with `label`, the button of that exact name is tapped on the first matching row.
  const rows = (texts, label = null) => page.evaluate((ts, l) => {
    const cards = [...document.querySelectorAll("button")]
      .filter((b) => (b.innerText || "").trim() === "수정")
      .map((b) => b.parentElement.parentElement)
      .filter((c) => ts.every((t) => (c.innerText || "").includes(t)));
    const out = cards.map((c) => c.innerText.replace(/\s+/g, " ").trim());
    if (!l) return { rows: out };
    const btn = cards[0] && [...cards[0].querySelectorAll("button")].find((b) => (b.innerText || "").trim() === l);
    if (!btn) return { rows: out, clicked: false };
    btn.scrollIntoView({ block: "center" });
    btn.click();
    return { rows: out, clicked: true };
  }, texts, label);
  const openEventModal = async () => { await clickText("일정 추가"); await sleep(400); };
  // Register one event through the modal: a title, a day offset from today, and optionally a time,
  // the `마감` kind chip and a repeat chip (all of them Korean UI copy, used here as selectors).
  const addEvent = async (title, delta, { kind = null, time = null, freq = null } = {}) => {
    await openEventModal();
    await typeInto("일정 이름", title);
    if (kind) await clickInModalExact(kind);
    await setValue('.fixed.inset-0 input[type="date"]', await dstrIn(delta));
    if (time) await setValue('.fixed.inset-0 input[type="time"]', time);
    if (freq) await clickInModalExact(freq);
    await clickInModalExact("등록");
    await sleep(700);
  };

  await step("schedule tab starts empty", async () => {
    await clickTab("일정");
    await expectText("다가오는 일정");
    await expectText("등록한 일정이 없어요");
  });

  await step("the form refuses an event without a title or a date", async () => {
    await openEventModal();
    await expectText("새 일정");
    await clickInModalExact("등록");
    const noTitle = await modalError();
    if (!noTitle.includes("일정 이름을 입력해 주세요.")) errors.push("an event without a title was accepted: " + noTitle);
    await typeInto("일정 이름", "면접 리허설");
    await clickInModalExact("등록");
    const noDate = await modalError();
    if (!noDate.includes("날짜를 선택해 주세요.")) errors.push("an event without a date was accepted: " + noDate);
    await closeModal();
    const st = await readState();
    if ((st.events || []).length) throw new Error("a rejected form stored an event anyway");
  });

  await step("appointment registers under its day group with its time", async () => {
    const before = await readState();
    await addEvent("면접 리허설", 1, { time: "14:00" });
    await expectText("내일");
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
    const r = await rows(["원서 접수 마감", await dstrIn(3)]);
    if (!r.rows.length) throw new Error("the deadline row is missing");
    if (!r.rows[0].includes("D-3")) throw new Error("the deadline row does not lead with D-3: " + r.rows[0]);
  });

  await step("weekly repeat shows next week and collapses the later occurrences", async () => {
    await addEvent("주간 스터디", 1, { time: "20:00", freq: "매주" });
    const next = await rows(["주간 스터디", await dstrIn(8)]);
    if (!next.rows.length) throw new Error("the weekly event has no occurrence on the same weekday next week");
    if (!next.rows[0].includes("반복 매주")) throw new Error("the occurrence does not state its repeat: " + next.rows[0]);
    // The later group keeps one row per event, so a weekly event shows twice: tomorrow and its earliest later date.
    const all = await rows(["주간 스터디"]);
    if (all.rows.length !== 2) throw new Error(`weekly event row count ${all.rows.length}, expected 2 (tomorrow plus the earliest later occurrence)`);
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
    const r = await rows(["주간 스터디", date], "이번 회차 취소");
    if (!r.clicked) throw new Error("the repeating row has no cancel-occurrence button: " + r.rows.join(" | "));
    await sleep(800);
    const gone = await rows(["주간 스터디", date]);
    if (gone.rows.length) throw new Error("the cancelled occurrence is still listed: " + gone.rows.join(" | "));
    const kept = await rows(["주간 스터디", await dstrIn(8)]);
    if (!kept.rows.length) throw new Error("the following occurrence disappeared with the cancelled one");
    const st = await readState();
    const ev = st.events.find((x) => x.title === "주간 스터디");
    if (!(ev.skip || []).includes(date)) throw new Error("the cancelled date was not stored: " + JSON.stringify(ev.skip));
  });

  await step("editing changes the stored event and its row", async () => {
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

  await step("deleting removes the event from the tab", async () => {
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
    await addEvent("서류 제출 마감", 0, { kind: "마감" });
    await clickTab("홈");
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
  });

  await step("the home card line states the counts and opens the tab", async () => {
    await clickTab("홈");
    const line = await page.evaluate(() => {
      const b = [...document.querySelectorAll("button")].find((x) => (x.innerText || "").startsWith("오늘 일정"));
      return b ? b.innerText.replace(/\s+/g, " ").trim() : "";
    });
    if (!line.includes("오늘 일정 1건 · 3일 내 마감 1건")) throw new Error("home briefing card schedule line: " + line);
    await clickText("오늘 일정 1건");
    await sleep(400);
    await expectText("다가오는 일정");
  });

  await step("the assistant packet lists the upcoming schedule", async () => {
    await clickTab("홈");
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

  /* ── Calendar view (2026-09-11) ──────────────────────────────────────────────────────────────────
     The grid is read structurally: leading and trailing cells are plain `div`s without a day number, so
     only the day buttons come back and a bare number inside a panel row can never pass for a cell. */
  const gridCells = () => page.evaluate(() => {
    const grid = [...document.querySelectorAll(".grid.grid-cols-7")].find((g) => g.querySelector("button"));
    if (!grid) return [];
    return [...grid.querySelectorAll("button")].map((b) => {
      const num = b.querySelector("span");
      const dots = [...b.querySelectorAll("span.rounded-full")];
      const more = [...b.querySelectorAll("span")].find((s) => /^\+\d+$/.test((s.textContent || "").trim()));
      return {
        day: Number((num?.textContent || "").trim()),
        dots: dots.map((d) => (/bg-rose-400/.test(d.className) ? "due" : "appt")),
        plus: more ? Number(more.textContent.trim().slice(1)) : 0,
        selected: /border-cyan-500/.test(b.className),   // the selection and today are separate marks
        today: /text-amber-300/.test(num?.className || ""),
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
  const monthLabelIn = (delta) => page.evaluate((d) => {
    const t = new Date(); t.setHours(12, 0, 0, 0); t.setDate(1); t.setMonth(t.getMonth() + d);
    return `${t.getFullYear()}년 ${t.getMonth() + 1}월`;
  }, delta);
  const daysThisMonth = () => page.evaluate(() => { const t = new Date(); return new Date(t.getFullYear(), t.getMonth() + 1, 0).getDate(); });
  // Click a page button by its exact label — the calendar controls sit outside any modal.
  const clickExact = async (label) => {
    const ok = await page.evaluate((l) => {
      const b = [...document.querySelectorAll("button")].find((x) => (x.innerText || "").trim() === l);
      if (!b) return false;
      b.scrollIntoView({ block: "center" }); b.click(); return true;
    }, label);
    if (!ok) throw new Error(`button not found: ${label}`);
    await sleep(350);
  };
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
  // Reload, reopen the tab, and report which view it came back on and which one the save holds.
  const reopenTab = async () => {
    await h.reload();
    await clickTab("일정");
    const st = await readState();
    return { calendar: await hasText("선택한 날짜"), stored: st.ui?.scheduleView };
  };
  let freeDate = ""; // the empty day the panel line and the prefilled add are checked on

  await step("the calendar view opens on this month with its weekday header", async () => {
    await clickTab("일정");
    await clickExact("달력");
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
    if (adds !== 1) throw new Error(`add-event buttons in calendar view: ${adds}, expected 1 (the header button is hidden here)`);
    const st = await readState();
    if (st.ui?.scheduleView !== "calendar") throw new Error("the chosen view was not stored: " + JSON.stringify(st.ui));
  });

  await step("the chosen view survives a reload", async () => {
    const back = await reopenTab();
    if (!back.calendar) throw new Error("the tab reopened on the list after a reload");
    if (await hasText("이후")) throw new Error("the list groups are still rendered in calendar view");
    if (back.stored !== "calendar") throw new Error("the stored view after a reload: " + back.stored);
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

  await step("the selected day's panel renders the list's own row", async () => {
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

  await step("the list view comes back with its groups and counts", async () => {
    await clickExact("목록");
    await expectText("다가오는 일정");
    await expectText("이후");
    if (await hasText("선택한 날짜")) throw new Error("the calendar is still rendered in list view");
    const counts = await page.evaluate(() => (document.body.innerText.match(/오늘 \d+건 · 이번 주 \d+건 · 지난 마감 \d+건/) || [""])[0]);
    if (!counts) throw new Error("the counts line is missing from the list view");
    const back = await reopenTab();
    if (back.calendar) throw new Error("the tab reopened on the calendar after the list was chosen");
    await expectText("다가오는 일정");
    if (back.stored !== "list") throw new Error("the stored view after a reload: " + back.stored);
  });
};
