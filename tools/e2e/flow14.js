// Transcript to minutes (2026-10-02, the seventh packet, `녹취록으로 정리`). The meeting form offers `녹취록으로 정리 ›`
// while its transcript holds text; the button is disabled, with one caption, for a hidden draft, a day-job draft while
// day-job records are switched off, and an over-cap transcript. The bridge replaces the form (never nests in it) and
// runs send → paste → confirm: the packet carries the draft's whole transcript and a little context and never a
// profile identifier, another meeting's transcript, an event's place or note, or a document; the confirm view shows each
// field's existing text beside the proposal with ticks that start on for empty fields only; `선택한 항목 적용` fills the
// form and writes nothing but the ticked work items until `등록`/`저장`. Runs after flow13 and before flow4, which
// replaces the save; the file ends by writing back the save it started from.
// Written under the standing instruction that the suite is not run: every step parses, none has been executed.
module.exports = async (h) => {
  const { step, clickTab, clickInModal, clickInModalExact, expectText, overlayText, setValue, closeModal, sleep, page } = h;
  const KEY = "liferpg-state-v1";
  const readState = () => page.evaluate((k) => { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } }, KEY);
  const writeState = (st) => page.evaluate((k, s) => localStorage.setItem(k, JSON.stringify(s)), KEY, st);
  const readRaw = () => page.evaluate((k) => localStorage.getItem(k), KEY);
  const writeRaw = (raw) => page.evaluate((k, r) => localStorage.setItem(k, r), KEY, raw);
  const dstrIn = (delta) => page.evaluate((d) => {
    const t = new Date(); t.setHours(12, 0, 0, 0); t.setDate(t.getDate() + d);
    const two = (n) => String(n).padStart(2, "0");
    return `${t.getFullYear()}-${two(t.getMonth() + 1)}-${two(t.getDate())}`;
  }, delta);
  // The top-level keys whose JSON differs, `lastTick` excepted.
  const changedKeys = (a, b) => [...new Set([...Object.keys(a), ...Object.keys(b)])]
    .filter((k) => k !== "lastTick" && JSON.stringify(a[k]) !== JSON.stringify(b[k])).sort();

  // The fixture: a business project with a previous meeting, a linked event today with checks, a work item today,
  // another meeting carrying a transcript, a document, and sentinels on every profile identifier.
  const PROJECT_ID = "e2e-min-proj", PROJECT = "E2E 정리 프로젝트";
  const PREV_ID = "e2e-min-prev", PREV = "E2E 지난 정리 회의", PREV_DECISIONS = "E2E 지난 결정 — 월 2회 점검";
  const FU_OPEN = "E2E 열린 후속 — 단가표 회신", FU_DONE = "E2E 끝난 후속 — 양식 확정";
  const EVENT_ID = "e2e-min-ev", EVENT = "E2E 정리 점검", EVENT_TIME = "23:50";
  const CHECK_OPEN = "E2E 열린 확인 — 일정표 지참", CHECK_DONE = "E2E 끝난 확인 — 계약서 사본";
  const WORK_TITLE = "E2E 오늘 정리 업무";
  const OTHER_ID = "e2e-min-other", OTHER_TRANSCRIPT = "E2E-OTHER-TRANSCRIPT-SENTINEL-3f2a";
  const SENT = {
    transcript: "E2E-MINUTES-SENTINEL-7c1d", name: "E2E-PROFILE-NAME-8a1b", birth: "1971-07-17", email: "e2e-min-8a1b@example.invalid",
    phone: "010-7171-1717", school: "E2E-SCHOOL-8a1b", company: "E2E-EMPLOYER-8a1b", place: "E2E-PLACE-8a1b", note: "E2E-EVENT-NOTE-8a1b",
    source: "E2E-DOC-SOURCE-8a1b.pdf",
  };
  const TRANSCRIPT = `첫 줄 ${SENT.transcript}\n둘째 줄 — 견적서 송부는 제가 맡아요.\n셋째 줄 — 다음 점검은 금요일이에요.`;
  let original = null;
  let taskTitle = null;
  const plantFixture = async () => {
    const today = await dstrIn(0), prevDay = await dstrIn(-3);
    const st = await readState();
    st.meetingProjects = [{ id: PROJECT_ID, name: PROJECT, createdAt: prevDay, track: "biz" }, ...(st.meetingProjects || []).filter((p) => p.id !== PROJECT_ID)];
    st.meetings = [
      { id: PREV_ID, projectId: PROJECT_ID, date: prevDay, title: PREV, attendees: "E2E 참석", summary: "지난 요약", decisions: PREV_DECISIONS, createdAt: prevDay,
        taskIds: [], progress: [], aiHidden: false,
        followUps: [{ id: "e2e-min-fu1", text: FU_OPEN, mine: true, done: false }, { id: "e2e-min-fu2", text: FU_DONE, mine: false, done: true }] },
      { id: OTHER_ID, projectId: null, date: prevDay, title: "E2E 다른 메모", summary: "다른 요약", transcript: OTHER_TRANSCRIPT, createdAt: prevDay,
        taskIds: [], progress: [], aiHidden: false, followUps: [], track: "biz" },
      ...(st.meetings || []).filter((m) => m.id !== PREV_ID && m.id !== OTHER_ID),
    ];
    st.events = [
      { id: EVENT_ID, title: EVENT, kind: "appt", date: today, time: EVENT_TIME, place: SENT.place, note: SENT.note, projectId: PROJECT_ID, track: "biz", createdAt: prevDay,
        checks: [{ id: "e2e-min-c1", text: CHECK_OPEN, done: false, source: "manual" }, { id: "e2e-min-c2", text: CHECK_DONE, done: true, source: "manual" }] },
      ...(st.events || []).filter((e) => e.id !== EVENT_ID),
    ];
    st.work = [{ id: "e2e-min-work", date: today, title: WORK_TITLE, done: false, source: "manual", track: "biz", createdAt: today },
      ...(st.work || []).filter((w) => w.id !== "e2e-min-work")];
    st.documents = [{ id: "e2e-min-doc", projectId: PROJECT_ID, title: "E2E 정리 문서", source: SENT.source, summary: "문서 요약", addedAt: prevDay, track: "biz" },
      ...(st.documents || []).filter((d) => d.id !== "e2e-min-doc")];
    const p = st.profile || {};
    st.profile = { ...p, name: SENT.name, birth: SENT.birth, email: SENT.email, phone: SENT.phone,
      edus: [{ id: "e2e-min-edu", school: SENT.school, degree: "ba", status: "grad" }, ...(p.edus || [])],
      careers: [{ id: "e2e-min-car", company: SENT.company, role: "E2E", emp: "full", from: "2020-01" }, ...(p.careers || [])] };
    st.settings = { ...(st.settings || {}) };
    delete st.settings.workInAi;
    await writeState(st);
    await h.reload();
  };

  // Screens and controls.
  const clickInSection = async (sectionText, label) => {
    const ok = await page.evaluate((s, l) => {
      const sec = [...document.querySelectorAll("main section")].find((x) => (x.innerText || "").includes(s));
      const b = sec && [...sec.querySelectorAll("button")].find((x) => (x.innerText || "").trim() === l);
      if (!b) return false;
      b.scrollIntoView({ block: "center" }); b.click(); return true;
    }, sectionText, label);
    if (!ok) throw new Error(`button "${label}" not found in the section "${sectionText}"`);
    await sleep(400);
  };
  const openProjectForm = async () => { await clickTab("미팅"); await clickInSection(PROJECT, "회의록 추가"); await expectText("새 회의록"); };
  const openMemoForm = async () => { await clickTab("미팅"); await clickInSection("프로젝트 없음 · 긴급 메모", "긴급 메모 추가"); await expectText("새 회의록"); };
  // The form's text areas once the transcript block is open: transcript, summary, decisions, actions.
  const AREA = { transcript: 0, summary: 1, decisions: 2, actions: 3 };
  const typeArea = (k, v) => setValue(".fixed.inset-0 textarea", v, AREA[k]);
  const typeInput = (prefix, v) => setValue(`.fixed.inset-0 input[placeholder^="${prefix}"]`, v);
  const areaValues = () => page.evaluate(() => [...document.querySelectorAll(".fixed.inset-0 textarea")].map((t) => t.value));
  const inputValues = () => page.evaluate(() => [...document.querySelectorAll(".fixed.inset-0 input")].map((i) => (i.type === "checkbox" ? String(i.checked) : i.value)));
  const sheetTitle = () => page.evaluate(() => [...document.querySelectorAll(".fixed.inset-0")].pop()?.querySelector("h3")?.innerText || "");
  const overlays = () => page.evaluate(() => document.querySelectorAll(".fixed.inset-0").length);
  const minutesButton = () => page.evaluate(() => {
    const b = [...[...document.querySelectorAll(".fixed.inset-0")].pop().querySelectorAll("button")].find((x) => (x.innerText || "").trim() === "녹취록으로 정리 ›");
    return b ? { disabled: b.disabled } : null;
  });
  const toggleAiHidden = () => page.evaluate(() => {
    const lab = [...[...document.querySelectorAll(".fixed.inset-0")].pop().querySelectorAll("label")].find((l) => (l.innerText || "").includes("AI에 보내지 않기"));
    lab.querySelector("input").click();
  });
  const startDraft = async ({ title = "E2E 정리 회의", transcript = TRANSCRIPT, project = true } = {}) => {
    if (project) await openProjectForm(); else await openMemoForm();
    await clickInModalExact("녹취록 붙여넣기");
    await typeInput("회의 이름", title);
    await typeArea("transcript", transcript);
  };
  const openBridge = async () => { await clickInModalExact("녹취록으로 정리 ›"); await sleep(300); };
  const packetText = () => page.evaluate(() => document.querySelector(".fixed.inset-0 textarea[readonly]")?.value || "");
  // From the send pane: the paste pane must take the sheet's title before the reply goes in.
  const pasteReply = async (reply) => {
    await clickInModalExact("AI 답변 붙여넣기 ›");
    if ((await sheetTitle()) !== "AI 답변 붙여넣기") throw new Error("the paste pane did not open: " + (await sheetTitle()));
    await setValue(".fixed.inset-0 textarea", reply);
    await clickInModalExact("답변 확인");
  };
  const fenced = (obj) => "분석 한 줄이에요.\n```json\n" + JSON.stringify(obj) + "\n```";
  // The three field cards: `{ text, ticked }` (`ticked` null when the card has no checkbox).
  const fieldCards = () => page.evaluate(() => [...[...document.querySelectorAll(".fixed.inset-0")].pop().querySelectorAll("div.border.border-zinc-800.rounded-xl")]
    .map((c) => { const box = c.querySelector('input[type="checkbox"]'); return { text: (c.innerText || "").replace(/\s+/g, " ").trim(), ticked: box ? box.checked : null }; }));
  // A proposal row whose text includes `t`: `{ text, checked, disabled }`, or null.
  const proposalRow = (t) => page.evaluate((x) => {
    const row = [...[...document.querySelectorAll(".fixed.inset-0")].pop().querySelectorAll("div.bg-zinc-950.rounded-xl.p-3")].find((r) => (r.innerText || "").includes(x));
    if (!row) return null;
    const box = row.querySelector('input[type="checkbox"]');
    return { text: (row.innerText || "").replace(/\s+/g, " ").trim(), checked: !!box?.checked, disabled: !!box?.disabled };
  }, t);
  const pickChipInRow = async (t, chip) => {
    const ok = await page.evaluate((x, c) => {
      const row = [...[...document.querySelectorAll(".fixed.inset-0")].pop().querySelectorAll("div.bg-zinc-950.rounded-xl.p-3")].find((r) => (r.innerText || "").includes(x));
      const b = row && [...row.querySelectorAll("button")].find((y) => (y.innerText || "").trim() === c);
      if (!b) return false;
      b.click(); return true;
    }, t, chip);
    if (!ok) throw new Error(`chip "${chip}" not found in the row "${t}"`);
    await sleep(150);
  };
  // The first open task the form's link picker offers (a struck-through row is a done one).
  const firstOpenTaskTitle = () => page.evaluate(() => {
    const ov = [...document.querySelectorAll(".fixed.inset-0")].pop();
    const s = [...ov.querySelectorAll('button[role="checkbox"] span.truncate')].find((x) => !/line-through/.test(x.className));
    return s ? s.textContent : null;
  });

  await step("the minutes button appears only with a transcript", async () => {
    original = await readRaw();
    await plantFixture();
    await openMemoForm();
    if (await minutesButton()) throw new Error("the button shows on a form without a transcript");
    await clickInModalExact("녹취록 붙여넣기");
    if (await minutesButton()) throw new Error("the button shows on an empty transcript");
    await typeArea("transcript", "E2E 녹취록 한 줄");
    const b = await minutesButton();
    if (!b || b.disabled) throw new Error("the button is missing or disabled with a transcript: " + JSON.stringify(b));
    const text = await overlayText();
    for (const s of ["녹취록은 붙여넣은 그대로 저장돼요 — '녹취록으로 정리'를 누를 때만 AI 요청문에 실려요.",
      "켜면 오늘 업무 만들기 패킷에 이 회의록의 날짜와 제목만 실리고, 녹취록 정리도 요청할 수 없어요."]) {
      if (!text.includes(s)) throw new Error("the form copy is missing: " + s);
    }
    await closeModal();
  });

  await step("the minutes button is disabled for a hidden meeting, a day-job meeting with the switch off, and an over-cap transcript", async () => {
    await openMemoForm();
    await clickInModalExact("녹취록 붙여넣기");
    await typeArea("transcript", "E2E 녹취록 한 줄");
    await toggleAiHidden(); await sleep(150);
    if (!(await minutesButton())?.disabled || !(await overlayText()).includes("AI에 보내지 않기가 켜져 있어 녹취록 정리를 요청할 수 없어요.")) throw new Error("a hidden draft is not refused");
    await toggleAiHidden(); await sleep(150);
    await typeArea("transcript", "가".repeat(30001));
    if (!(await minutesButton())?.disabled || !(await overlayText()).includes("녹취록은 30000자까지예요 — 지금 30001자예요.")) throw new Error("an over-cap transcript is not refused");
    await closeModal();
    const st = await readState();
    st.settings = { ...(st.settings || {}), workInAi: false };
    await writeState(st); await h.reload();
    await openMemoForm();
    await clickInModalExact("녹취록 붙여넣기");
    await typeArea("transcript", "E2E 녹취록 한 줄");
    await clickInModalExact("직장");
    if (!(await minutesButton())?.disabled || !(await overlayText()).includes("직장 트랙 회의록 — AI 패킷에 실리지 않아요")) throw new Error("a day-job draft is not refused with the switch off");
    await clickInModalExact("사업");
    if ((await minutesButton())?.disabled !== false) throw new Error("a business draft is refused with the switch off");
    await closeModal();
    const back = await readState();
    delete back.settings.workInAi;
    await writeState(back); await h.reload();
  });

  await step("the minutes packet carries the whole transcript and its context", async () => {
    await startDraft();
    await typeInput("참석자", "E2E 참석자 두 명");
    taskTitle = await firstOpenTaskTitle();
    if (!taskTitle) throw new Error("no open task in the link picker");
    await clickInModal(`${EVENT_TIME} ${EVENT}`);
    await openBridge();
    if ((await sheetTitle()) !== "녹취록으로 정리" || (await overlays()) !== 1) throw new Error("the bridge did not replace the form");
    const pk = await packetText();
    const today = await dstrIn(0);
    const want = [TRANSCRIPT, `- ${today} · 회의 · E2E 정리 회의 · 프로젝트 ${PROJECT}`, "- 참석: E2E 참석자 두 명", PREV_DECISIONS, FU_OPEN, CHECK_OPEN, WORK_TITLE, taskTitle];
    const missing = want.filter((s) => !pk.includes(s));
    if (missing.length) throw new Error("the packet lacks " + JSON.stringify(missing));
    for (const s of [FU_DONE, CHECK_DONE]) if (pk.includes(s)) throw new Error("the packet carries a closed item: " + s);
    if (!(await overlayText()).includes("이 회의의 녹취록 전체와")) throw new Error("the send caption is missing");
    await closeModal();
  });

  await step("the minutes packet carries no profile identifier, no other transcript and no event place or note", async () => {
    await startDraft();
    await clickInModal(`${EVENT_TIME} ${EVENT}`);
    await openBridge();
    const pk = await packetText();
    const leaked = [SENT.name, SENT.birth, SENT.email, SENT.phone, SENT.school, SENT.company, OTHER_TRANSCRIPT, SENT.place, SENT.note, SENT.source, "## 이력"].filter((s) => pk.includes(s));
    if (leaked.length) throw new Error("the minutes packet leaks " + JSON.stringify(leaked));
    await closeModal();
    // The flow11 sentinel on the new fixture: the work packet still carries no transcript.
    await clickTab("업무");
    const ok = await page.evaluate(() => { const b = [...document.querySelectorAll("main button")].find((x) => (x.innerText || "").trim() === "AI로 만들기 ›"); if (!b) return false; b.click(); return true; });
    if (!ok) throw new Error("the work bridge button is missing");
    await sleep(400);
    const wp = await packetText();
    if (!wp || wp.includes(OTHER_TRANSCRIPT)) throw new Error("the work packet carries a transcript or is empty");
    await closeModal();
  });

  await step("a hidden previous meeting lends its date and title only", async () => {
    const st = await readState();
    st.meetings = st.meetings.map((m) => (m.id === PREV_ID ? { ...m, aiHidden: true } : m));
    await writeState(st); await h.reload();
    await startDraft();
    await openBridge();
    const pk = await packetText();
    const prevDay = await dstrIn(-3);
    if (!pk.includes(`- ${prevDay} ${PREV}\n  내용 비공개 (AI에 보내지 않기)`)) throw new Error("the hidden meeting's line is missing: " + pk.slice(0, 600));
    if (pk.includes(PREV_DECISIONS) || pk.includes(FU_OPEN)) throw new Error("the hidden meeting lends its decisions or follow-ups");
    await closeModal();
    const back = await readState();
    back.meetings = back.meetings.map((m) => (m.id === PREV_ID ? { ...m, aiHidden: false } : m));
    await writeState(back); await h.reload();
  });

  const MAIN_REPLY = () => fenced({
    minutes: { summary: "제안 요약 — 점검 범위", decisions: ["결정 하나", "결정 둘 (확인 필요)"], actions: "조치 하나",
      followUps: [{ text: "E2E 견적서 송부", mine: true, due: "2026-12-01" }, { text: "E2E 자료 회신", mine: false, due: null }],
      taskLinks: [taskTitle], work: [] },
    note: "한 줄 메모",
  });
  await step("the confirm view shows existing and proposed text and ticks only empty fields", async () => {
    await startDraft();
    await typeArea("summary", "기존 요약 문장");
    await openBridge();
    await pasteReply(MAIN_REPLY());
    const text = await overlayText();
    for (const s of ["회의록 정리 제안", "한 줄 메모", "적용하면 폼의 내용이 제안으로 바뀌어요 — 저장을 눌러야 회의록에 기록돼요.", "후속 항목 제안 — 2건", "할 일 연결 제안 — 1건"]) {
      if (!text.includes(s)) throw new Error("the confirm view lacks " + s);
    }
    const cards = await fieldCards();
    if (cards.length !== 3 || !cards.every((c) => c.text.includes("기존 · ") && c.text.includes("제안 · "))) throw new Error("the field cards: " + JSON.stringify(cards));
    if (!cards[0].text.startsWith("회의 요약") || !cards[0].text.includes("기존 · 8자") || !cards[1].text.includes("비어 있음")) throw new Error("the card texts: " + JSON.stringify(cards));
    if (JSON.stringify(cards.map((c) => c.ticked)) !== "[false,true,true]") throw new Error("the default ticks: " + JSON.stringify(cards.map((c) => c.ticked)));
    const mine = await proposalRow("E2E 견적서 송부");
    if (!mine || !mine.checked || !mine.text.includes("기한 2026-12-01") || !mine.text.includes("내 담당")) throw new Error("the follow-up row: " + JSON.stringify(mine));
  });

  await step("applying fills the form but writes nothing until save", async () => {
    const before = await readState();
    await clickInModalExact("선택한 항목 적용");
    await expectText("회의록 정리 제안을 폼에 넣었어요 — 저장해야 기록돼요");
    const mid = await readState();
    if (changedKeys(before, mid).length) throw new Error("applying wrote " + JSON.stringify(changedKeys(before, mid)));
    if ((await sheetTitle()) !== "새 회의록") throw new Error("applying did not return to the form");
    const areas = await areaValues();
    if (areas[AREA.summary] !== "기존 요약 문장" || areas[AREA.decisions] !== "결정 하나\n결정 둘 (확인 필요)" || areas[AREA.actions] !== "조치 하나") throw new Error("the form fields: " + JSON.stringify(areas.slice(1)));
    const inputs = await inputValues();
    if (!inputs.includes("E2E 견적서 송부") || !inputs.includes("E2E 자료 회신") || !inputs.includes("2026-12-01")) throw new Error("the follow-up rows are missing");
    if (!(await overlayText()).includes("정리 제안 적용 — 결정 사항·후속 조치 · 후속 2건 · 할 일 1건. 저장해야 회의록에 기록돼요.")) throw new Error("the applied line is missing");
    await clickInModalExact("등록");
    await sleep(500);
    const after = await readState();
    const rec = (after.meetings || []).find((m) => m.title === "E2E 정리 회의" && m.projectId === PROJECT_ID);
    if (!rec || rec.summary !== "기존 요약 문장" || rec.decisions !== "결정 하나\n결정 둘 (확인 필요)" || rec.actions !== "조치 하나"
      || rec.followUps.length !== 2 || rec.taskIds.length !== 1 || rec.transcript !== TRANSCRIPT) throw new Error("the saved record: " + JSON.stringify(rec));
    const mineWork = (after.work || []).filter((w) => w.title === "E2E 견적서 송부");
    if (mineWork.length !== 1 || mineWork[0].source !== "meeting") throw new Error("the mine follow-up's work item: " + JSON.stringify(mineWork));
    if ((await readRaw()).includes("한 줄 메모")) throw new Error("the reply's note was stored");
  });

  await step("work proposals register on apply with the picked track and keep the form open", async () => {
    await startDraft({ title: "E2E 업무 제안 회의" });
    await openBridge();
    await pasteReply(fenced({ minutes: { summary: "", decisions: "", actions: "",
      followUps: [{ text: "E2E 내 후속 업무", mine: true, due: null }], taskLinks: [],
      work: [{ title: "E2E 제안 업무 하나", note: "메모", track: "개인" }, { title: "E2E 제안 업무 둘", track: "직장" }, { title: WORK_TITLE }, { title: "E2E 내 후속 업무" }] } }));
    if (!(await overlayText()).includes("업무 제안 — 4건") || !(await overlayText()).includes("업무는 적용할 때 바로 업무 탭에 등록돼요 — 회의록을 저장하지 않아도 남아요.")) throw new Error("the work section");
    const dup = await proposalRow(WORK_TITLE), mineDup = await proposalRow("후속 항목(내 담당)과 같아요");
    if (!dup?.disabled || !dup.text.includes("오늘 업무에 이미 있어요") || !mineDup?.disabled) throw new Error("the work rejections: " + JSON.stringify([dup, mineDup]));
    await pickChipInRow("E2E 제안 업무 둘", "사업");
    const before = await readState();
    await clickInModalExact("선택한 항목 적용");
    await sleep(400);
    const after = await readState();
    if (JSON.stringify(changedKeys(before, after)) !== JSON.stringify(["work"])) throw new Error("applying changed " + JSON.stringify(changedKeys(before, after)));
    const made = after.work.filter((w) => !before.work.some((b) => b.id === w.id));
    const one = made.find((w) => w.title === "E2E 제안 업무 하나"), two = made.find((w) => w.title === "E2E 제안 업무 둘");
    if (made.length !== 2 || one?.track !== "personal" || two?.track !== "biz" || !made.every((w) => w.source === "ai" && w.done === false && w.link?.kind === "project" && w.link.id === PROJECT_ID)) {
      throw new Error("the registered work: " + JSON.stringify(made));
    }
    if ((await sheetTitle()) !== "새 회의록" || !(await inputValues()).includes("E2E 업무 제안 회의")) throw new Error("the form or its draft is gone");
    await closeModal();
  });

  await step("a reply's other keys change nothing", async () => {
    await startDraft({ title: "E2E 다른 키 회의" });
    await openBridge();
    await pasteReply(fenced({ minutes: { summary: "다른 키 요약" },
      tasks: [{ goal: "x", title: "E2E 끼어든 실행" }], work: [{ title: "E2E 끼어든 업무" }], checks: [{ text: "E2E 끼어든 확인" }],
      quiz: [{ q: "x", options: ["a", "b"], answer: 0 }], verdict: { summary: "x" } }));
    const text = await overlayText();
    if (text.includes("E2E 끼어든") || !text.includes("업무 제안 — 0건")) throw new Error("a top-level key was read");
    const before = await readState();
    await clickInModalExact("선택한 항목 적용");
    await sleep(400);
    const after = await readState();
    if (changedKeys(before, after).length) throw new Error("the other keys changed " + JSON.stringify(changedKeys(before, after)));
    if ((await areaValues())[AREA.summary] !== "다른 키 요약") throw new Error("the summary was not applied");
    await closeModal();
  });

  await step("a reply without minutes is refused", async () => {
    await startDraft({ title: "E2E 거절 회의" });
    await openBridge();
    await pasteReply(fenced({ work: [{ title: "E2E 거절 업무" }] }));
    if (!(await overlayText()).includes("회의록 정리 답변이 아니에요 — 답변을 다시 받아요")) throw new Error("the refusal line is missing");
    await clickInModalExact("다시 붙여넣기");
    const back = await page.evaluate(() => [...[...document.querySelectorAll(".fixed.inset-0")].pop().querySelectorAll("button")].some((b) => (b.innerText || "").trim() === "답변 확인"));
    if (!back) throw new Error("the retry button did not return to the paste pane");
    await closeModal();
  });

  await step("a training record applies the three fields only", async () => {
    await openMemoForm();
    await clickInModalExact("교육");
    await clickInModalExact("녹취록 붙여넣기");
    await typeInput("교육 이름", "E2E 정리 교육");
    await typeArea("transcript", "E2E 교육 녹취록");
    await openBridge();
    if (!(await overlayText()).includes("이 교육의 녹취록 전체와 날짜·종류·제목·프로젝트·강사·주최가 실려요")) throw new Error("the training caption is missing");
    if (!(await packetText()).includes("## 교육")) throw new Error("the training packet lacks its heading");
    await pasteReply(fenced({ minutes: { summary: "배운 것 제안", decisions: "핵심 제안", actions: "기억 제안",
      followUps: [{ text: "E2E 교육 후속", mine: true }], taskLinks: [taskTitle], work: [{ title: "E2E 교육 업무" }] } }));
    const text = await overlayText();
    if (!text.includes("교육 기록 정리 제안") || !["배운 것", "핵심 정리", "기억할 점"].every((s) => text.includes(s))
      || text.includes("후속 항목 제안") || text.includes("업무 제안") || !text.includes("교육 기록은 배운 것·핵심 정리·기억할 점만 적용해요.")) throw new Error("the training confirm view: " + text.slice(0, 300));
    const before = await readState();
    await clickInModalExact("선택한 항목 적용");
    await sleep(400);
    if (changedKeys(before, await readState()).length) throw new Error("a training apply wrote something");
    const areas = await areaValues();
    if (areas[AREA.summary] !== "배운 것 제안" || areas[AREA.decisions] !== "핵심 제안" || areas[AREA.actions] !== "기억 제안") throw new Error("the training fields: " + JSON.stringify(areas.slice(1)));
    await closeModal();
  });

  await step("closing the bridge returns to the form with the draft intact", async () => {
    await startDraft({ title: "E2E 초안 유지", project: false });
    await typeArea("summary", "초안 요약"); await typeArea("decisions", "초안 결정");
    await clickInModalExact("항목 추가");
    await setValue('.fixed.inset-0 input[placeholder^="후속 항목"]', "초안 후속");
    const snap = JSON.stringify([await areaValues(), await inputValues()]);
    await openBridge();
    const x = await page.evaluate(() => { const ov = [...document.querySelectorAll(".fixed.inset-0")].pop(); const b = [...ov.querySelectorAll("button")].find((y) => y.querySelector("svg") && !(y.innerText || "").trim()); if (!b) return false; b.click(); return true; });
    await sleep(300);
    if (!x || (await sheetTitle()) !== "새 회의록" || JSON.stringify([await areaValues(), await inputValues()]) !== snap) throw new Error("the header X lost the draft");
    await openBridge();
    await clickInModalExact("AI 답변 붙여넣기 ›");
    await page.evaluate(() => [...document.querySelectorAll(".fixed.inset-0")].pop().click());
    await sleep(300);
    if ((await sheetTitle()) !== "새 회의록" || JSON.stringify([await areaValues(), await inputValues()]) !== snap) throw new Error("the backdrop lost the draft");
    await closeModal();
  });

  await step("exact task-title matching", async () => {
    await startDraft({ title: "E2E 제목 일치 회의" });
    await openBridge();
    const part = taskTitle.slice(0, Math.max(1, taskTitle.length - 1));
    await pasteReply(fenced({ minutes: { summary: "제목 확인", taskLinks: [part] } }));
    const row = await proposalRow("같은 제목의 할 일이 없어요");
    if (!row || !row.disabled || row.checked) throw new Error("a substring title was not refused: " + JSON.stringify(row));
    await closeModal();
    // Ends the file: the save it started from, so flow4 starts where it used to.
    await writeRaw(original);
    await h.reload();
  });
};
