// Schedule tab — appointments and deadlines. An event is a record, never a task: these steps assert that
// registering, ticking and cancelling one changes `events` only, and never the tasks, streak or trophies.
module.exports = async (h) => {
  const { step, clickTab, clickText, clickInModal, clickInModalExact, expectText, typeInto, setValue, closeModal, modalError, sleep, page, errors } = h;

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
};
