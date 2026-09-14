// Calendar export — the `일정` header opens a sheet that writes an RFC 5545 file for the phone's calendar to import.
// These steps parse the exported text rather than trust the download: one VEVENT per included record, the same UIDs
// on a second export, an alarm on every entry, the repeat rules, byte-counted folding, and no identifying or business
// field. Runs between flow8 and flow4, so the save carries the full CV, the business records and every event kind.
module.exports = async (h) => {
  const { step, clickTab, clickExact, clickInModalExact, expectText, hasText, setValue, closeModal, modalError, captureDownload, sleep, page } = h;

  const KEY = "liferpg-state-v1";
  const HOST = "@life-manager";
  // UI copy and file text, copied verbatim from the plan: every string below is asserted somewhere in this file.
  const COPY = {
    open: "캘린더로 내보내기",
    title: "휴대폰 캘린더로 내보내기",
    intro: "이 앱은 알림을 보내지 않아요. 내보낸 파일을 휴대폰 캘린더 앱에서 가져오면 캘린더 앱이 알림을 울려요.",
    timeRule: "마감·실행 기한·목표 기한·시간 없는 약속과 매일 실행 목록은 이 시각에 알려요. 시간이 있는 약속은 시작 1시간 전에 알려요.",
    excluded: "넣지 않는 것: 이름·생년월일·연락처·학력·경력, 사업 기록과 금액, 일정의 장소·메모.",
    howTo: "파일은 브라우저의 다운로드로 저장돼요. 휴대폰 캘린더 앱에서 이 파일을 열어 가져와요.",
    appNotes: [
      "다시 가져올 때 같은 항목을 바꿔 넣을지 하나 더 만들지는 캘린더 앱마다 달라요.",
      "파일에 적힌 알림 대신 캘린더 앱의 기본 알림을 쓰는 앱도 있어요.",
      "구글 계정 캘린더로 가져오면 제목이 구글 서버에 저장돼요.",
    ],
    button: "파일 내보내기",
    year: "1년",
    needTime: "알림 시각을 입력해 주세요.",
    calName: "인생 관리",
  };
  const snapshotLines = (end) => [
    "내보낸 순간의 기록만 들어가요. 앱에서 추가·수정·완료·삭제해도 휴대폰 캘린더는 바뀌지 않아요 — 바뀐 내용은 다시 내보내야 들어가요.",
    "앱에서 완료해도 캘린더의 알림은 꺼지지 않아요.",
    "매일 알림에는 내보낼 때의 매일 실행 목록이 그대로 남아요.",
    `${end} 뒤로는 알림이 없어요.`,
  ];
  const skippedLine = (x, y) => `기한이 지난 실행 ${x}건 · 목표 ${y}건은 날짜가 지나 넣지 않아요.`;
  const emptyLine = (today, end) => `넣을 항목이 없어요 — ${today} ~ ${end}에 일정·실행 기한·매일 실행·목표 기한이 없어요.`;
  const toastLine = (n, end) => `캘린더 파일을 내보냈어요 · ${n}건 · ${end}까지`;
  const PREFIX = { appt: "약속 · ", due: "마감 · ", goal: "목표 기한 · " };
  // Fixture titles: the three flow7 left in the save, the goal flow.js created, and the two events planted below.
  const FIX = {
    weekly: "주간 스터디",
    ticked: "원서 접수 마감",
    dueToday: "서류 제출 마감",
    goal: "하네스 설계 엔지니어 취업",
    monthly: "월말 정산 확인",
    long: "전기기사 실기 원서 접수 마감, 수험표 출력; 사진 규격 확인 \\ 결제 영수증 보관 📌 오후 6시 전까지 끝내기",
    place: "E2E장소",
    note: "E2E메모",
  };

  const stateString = () => page.evaluate((k) => localStorage.getItem(k), KEY);
  const writeState = (text) => page.evaluate((k, v) => localStorage.setItem(k, v), KEY, text);
  const readState = async () => JSON.parse(await stateString());
  const storageKeys = () => page.evaluate(() => Object.keys(localStorage).sort().join("|"));
  // Dates are computed in the page with the app's own noon-anchored local-date logic (never toISOString).
  const dstrIn = (delta) => page.evaluate((d) => {
    const t = new Date(); t.setHours(12, 0, 0, 0); t.setDate(t.getDate() + d);
    const p = (n) => String(n).padStart(2, "0");
    return `${t.getFullYear()}-${p(t.getMonth() + 1)}-${p(t.getDate())}`;
  }, delta);
  const compact = (date) => date.replace(/-/g, "");

  // A continuation line is CRLF followed by one space or tab (RFC 5545 3.1); unfolding removes exactly that.
  const unfold = (text) => text.replace(/\r\n[ \t]/g, "");
  const unescapeText = (v) => v.replace(/\\([\\;,nN])/g, (_, c) => (c === "n" || c === "N" ? "\n" : c));
  // VEVENT blocks: `props` and each of `alarms` are lists of { name, params, value, lines }, `lines` being the
  // number of physical lines the property was folded into. VALARM properties never mix with the event's own.
  const parseIcs = (text) => {
    const logical = [];
    for (const raw of text.split("\r\n")) {
      const prev = logical[logical.length - 1];
      if (prev && /^[ \t]/.test(raw)) { prev.text += raw.slice(1); prev.lines += 1; } else if (raw) logical.push({ text: raw, lines: 1 });
    }
    const out = [];
    let ev = null;
    let alarm = null;
    for (const { text, lines } of logical) {
      if (text === "BEGIN:VEVENT") { ev = { props: [], alarms: [] }; continue; }
      if (text === "END:VEVENT") { out.push({ ...ev, uid: (ev.props.find((x) => x.name === "UID") || {}).value }); ev = null; continue; }
      if (!ev) continue;
      if (text === "BEGIN:VALARM") { alarm = []; continue; }
      if (text === "END:VALARM") { ev.alarms.push(alarm); alarm = null; continue; }
      const colon = text.indexOf(":");
      const [name, ...params] = text.slice(0, colon).split(";");
      (alarm || ev.props).push({ name, params, value: text.slice(colon + 1), lines });
    }
    return out;
  };
  const propOf = (list, name) => list.find((x) => x.name === name) || null;
  const valueOf = (list, name) => (propOf(list, name) || {}).value;
  const summaryOf = (ev) => unescapeText(valueOf(ev.props, "SUMMARY") || "");

  const openSheet = async () => {
    await clickTab("일정");
    await clickExact(COPY.open);
    await expectText(COPY.title);
  };
  const setRemind = (value) => setValue('.fixed.inset-0 input[type="time"]', value);
  // Preview line 1, `{today} ~ {end} · 항목 {n}건`, read from the open sheet only.
  const previewLine = () => page.evaluate(() => {
    const ov = [...document.querySelectorAll(".fixed.inset-0")].pop();
    const el = ov && [...ov.querySelectorAll("p")].find((x) => /^\d{4}-\d{2}-\d{2} ~ \d{4}-\d{2}-\d{2} · 항목 \d+건$/.test((x.textContent || "").trim()));
    return el ? el.textContent.trim() : "";
  });
  // Open the sheet with a 07:45 reminder over one year and take the file it offers.
  const exportYear = async () => {
    await openSheet();
    await setRemind("07:45");
    await clickInModalExact(COPY.year);
    return captureDownload(() => clickInModalExact(COPY.button));
  };

  await step("calendar export — the sheet states the snapshot limit and stores nothing", async () => {
    const before = { state: await stateString(), keys: await storageKeys() };
    const today = await dstrIn(0);
    const end90 = await dstrIn(89);
    const end365 = await dstrIn(364);
    await openSheet();
    for (const t of [COPY.intro, COPY.timeRule, ...snapshotLines(end90), ...COPY.appNotes, COPY.excluded, COPY.howTo]) await expectText(t);
    const remind = await page.evaluate(() => (document.querySelector('.fixed.inset-0 input[type="time"]') || {}).value || "");
    if (remind !== "08:00") throw new Error(`the reminder time opens on "${remind}", expected 08:00`);
    const line90 = await previewLine();
    const m = line90.match(/^(\S+) ~ (\S+) · \S+ (\d+)\S$/);
    if (!m || m[1] !== today || m[2] !== end90 || !(Number(m[3]) > 0)) throw new Error(`preview line 1 for the default range: "${line90}"`);
    await setRemind("");
    const refused = await captureDownload(() => clickInModalExact(COPY.button));
    if (refused) throw new Error("a file was offered without a reminder time: " + refused.name);
    const err = await modalError();
    if (err !== COPY.needTime) throw new Error("the missing-time message: " + err);
    await clickInModalExact(COPY.year);
    const line365 = await previewLine();
    if (!line365.startsWith(`${today} ~ ${end365} · `)) throw new Error(`preview line 1 after the one-year chip: "${line365}"`);
    await expectText(snapshotLines(end365)[3]);
    await closeModal();
    const after = { state: await stateString(), keys: await storageKeys() };
    if (after.state !== before.state) throw new Error("opening the sheet and changing its options rewrote the save");
    if (after.keys !== before.keys) throw new Error(`the storage keys changed: ${before.keys} -> ${after.keys}`);
  });

  /* Steps 2–7 read one export of a planted save: a monthly event on the 31st, an appointment with a long title and a
     place and note, a second cancelled date on the weekly repeat, and two goal deadlines — one ahead, one past. The
     plant is undone in `finally`, so a failing step cannot carry the fixture into flow4 and the steps after it. */
  let first = null;
  const need = () => { if (!first) throw new Error("the first export was not captured, so there is nothing to check"); return first; };
  const original = await stateString();
  try {
    await step("calendar export — one VEVENT per included record, each with its alarm", async () => {
      const today = await dstrIn(0);
      const end = await dstrIn(364);
      const days = { plus2: await dstrIn(2), plus15: await dstrIn(15), plus20: await dstrIn(20), minus3: await dstrIn(-3) };
      const planted = await page.evaluate((k, fx, d) => {
        const s = JSON.parse(localStorage.getItem(k));
        const weekly = (s.events || []).find((e) => e.title === fx.weekly);
        const goal = (s.goals || []).find((g) => g.title === fx.goal);
        const other = (s.goals || []).find((g) => g.status === "active" && g.title !== fx.goal);
        if (!weekly || !goal || !other) return { missing: { weekly: !!weekly, goal: !!goal, otherActiveGoal: !!other } };
        weekly.skip = [...(weekly.skip || []), d.plus15].sort();
        goal.deadline = d.plus20;
        other.deadline = d.minus3;
        s.events = [
          { id: "ics-monthly31", title: fx.monthly, kind: "due", date: "2026-01-31", repeat: { freq: "monthly" }, createdAt: "2026-01-01" },
          { id: "ics-long", title: fx.long, kind: "appt", date: d.plus2, time: "09:30", place: fx.place, note: fx.note, createdAt: "2026-01-01" },
          ...(s.events || []),
        ];
        localStorage.setItem(k, JSON.stringify(s));
        return { otherId: other.id, otherTitle: other.title };
      }, KEY, FIX, days);
      if (planted.missing) throw new Error("the fixture this step needs is not in the save: " + JSON.stringify(planted.missing));
      await h.reload();
      await sleep(300);
      const plantedState = await stateString();
      const plantedKeys = await storageKeys();
      const s = JSON.parse(plantedState);

      // Month-ends in the window, computed in the page the way the app clamps a day-31 repeat.
      const monthEnds = await page.evaluate((from, to) => {
        const out = [];
        const p = (n) => String(n).padStart(2, "0");
        const y = Number(from.slice(0, 4));
        const m0 = Number(from.slice(5, 7)) - 1;
        for (let i = 0; i < 15; i++) {
          const d = new Date(y, m0 + i + 1, 0, 12);
          const iso = `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
          if (iso > to) break;
          if (iso >= from) out.push(iso);
        }
        return out;
      }, today, end);

      const open = (q) => q.type !== "daily" && q.status !== "done" && q.due;
      const lateTasks = s.tasks.filter((q) => open(q) && q.due < today).length;
      const lateGoals = s.goals.filter((g) => g.status === "active" && g.deadline && g.deadline < today).length;
      if (!lateGoals) throw new Error("the planted past deadline is not counted in the save");

      await openSheet();
      await setRemind("07:45");
      await clickInModalExact(COPY.year);
      await expectText(skippedLine(lateTasks, lateGoals));
      const dl = await captureDownload(() => clickInModalExact(COPY.button));
      const screen = await page.evaluate(() => document.body.innerText);
      if (!dl) throw new Error("the export offered no file");

      if (dl.name !== `life-manager-calendar-${today}.ics`) throw new Error("file name: " + dl.name);
      if (!/^text\/calendar/.test(dl.type || "")) throw new Error("blob type: " + dl.type);
      const text = dl.text || "";
      if (!text.startsWith("BEGIN:VCALENDAR\r\nVERSION:2.0\r\n")) throw new Error("the file does not open with BEGIN:VCALENDAR and VERSION:2.0 on CRLF lines");
      if (!text.endsWith("END:VCALENDAR\r\n")) throw new Error("the file does not end with END:VCALENDAR and CRLF");
      if (/(^|[^\r])\n/.test(text) || /\r(?!\n)/.test(text)) throw new Error("the file holds a bare LF or CR");
      if (!text.includes(`\r\nX-WR-CALNAME:${COPY.calName}\r\n`)) throw new Error("the calendar name line is missing");
      const flat = unfold(text);
      if (/TZID/.test(flat) || /VTIMEZONE/.test(flat) || /(^|\r\n)METHOD[:;]/.test(flat)) throw new Error("the file asserts a time zone or a scheduling method");

      const expected = [];
      for (const ev of s.events) {
        const freq = ev.repeat && ev.repeat.freq;
        if (!freq) {
          const skipped = (ev.doneDates || []).includes(ev.date) || (ev.skip || []).includes(ev.date);
          if (ev.date >= today && ev.date <= end && !skipped) expected.push(`event-${ev.id}${HOST}`);
        } else if (ev.id === "ics-monthly31") {
          for (const d of monthEnds) expected.push(`event-ics-monthly31-${compact(d)}${HOST}`);
        } else if (ev.title === FIX.weekly) {
          expected.push(`event-${ev.id}${HOST}`);
        } else {
          throw new Error("the save holds a repeating event this step does not model: " + ev.id);
        }
      }
      for (const q of s.tasks) if (open(q) && q.due >= today && q.due <= end) expected.push(`task-${q.id}${HOST}`);
      if (s.tasks.some((q) => q.type === "daily")) expected.push(`daily-tasks${HOST}`);
      for (const g of s.goals) if (g.status === "active" && g.deadline && g.deadline >= today && g.deadline <= end) expected.push(`goal-${g.id}${HOST}`);

      const events = parseIcs(text);
      const uids = events.map((e) => e.uid);
      if (new Set(uids).size !== uids.length) throw new Error("duplicate UIDs: " + uids.filter((u, i) => uids.indexOf(u) !== i).join(", "));
      const missing = expected.filter((u) => !uids.includes(u));
      const extra = uids.filter((u) => !expected.includes(u));
      if (missing.length || extra.length) throw new Error(`UIDs differ from the save — missing: ${missing.join(", ") || "none"} · unexpected: ${extra.join(", ") || "none"}`);

      for (const e of events) {
        if (e.alarms.length !== 1) throw new Error(`${e.uid} carries ${e.alarms.length} VALARM blocks`);
        const [a] = e.alarms;
        if (valueOf(a, "ACTION") !== "DISPLAY" || !valueOf(a, "TRIGGER") || !valueOf(a, "DESCRIPTION")) throw new Error(`${e.uid} has an incomplete VALARM: ${JSON.stringify(a)}`);
        if (!/^\d{8}T\d{6}Z$/.test(valueOf(e.props, "DTSTAMP") || "")) throw new Error(`${e.uid} DTSTAMP ${valueOf(e.props, "DTSTAMP")}`);
        if (!/^\d+$/.test(valueOf(e.props, "SEQUENCE") || "")) throw new Error(`${e.uid} SEQUENCE ${valueOf(e.props, "SEQUENCE")}`);
      }

      const withSummary = (t) => events.filter((e) => summaryOf(e) === t);
      const [dueToday, ...moreDue] = withSummary(PREFIX.due + FIX.dueToday);
      if (!dueToday || moreDue.length) throw new Error("today's deadline VEVENT count is not 1");
      const dueStart = propOf(dueToday.props, "DTSTART");
      if (dueStart.params.join(";") !== "VALUE=DATE" || dueStart.value !== compact(today)) throw new Error("today's deadline DTSTART: " + JSON.stringify(dueStart));
      if (valueOf(dueToday.alarms[0], "TRIGGER") !== "PT7H45M") throw new Error("today's deadline TRIGGER: " + valueOf(dueToday.alarms[0], "TRIGGER"));

      const long = events.find((e) => e.uid === `event-ics-long${HOST}`);
      if (valueOf(long.props, "DTSTART") !== `${compact(days.plus2)}T093000` || propOf(long.props, "DTSTART").params.length) throw new Error("appointment DTSTART: " + JSON.stringify(propOf(long.props, "DTSTART")));
      if (valueOf(long.props, "DTEND") !== `${compact(days.plus2)}T103000`) throw new Error("appointment DTEND: " + valueOf(long.props, "DTEND"));
      if (valueOf(long.alarms[0], "TRIGGER") !== "-PT1H") throw new Error("appointment TRIGGER: " + valueOf(long.alarms[0], "TRIGGER"));

      const digest = events.find((e) => e.uid === `daily-tasks${HOST}`);
      if (valueOf(digest.props, "DTSTART") !== `${compact(today)}T074500`) throw new Error("digest DTSTART: " + valueOf(digest.props, "DTSTART"));
      if (valueOf(digest.props, "RRULE") !== `FREQ=DAILY;UNTIL=${compact(end)}T074500`) throw new Error("digest RRULE: " + valueOf(digest.props, "RRULE"));
      if (valueOf(digest.alarms[0], "TRIGGER") !== "PT0S") throw new Error("digest TRIGGER: " + valueOf(digest.alarms[0], "TRIGGER"));
      const digestLines = unescapeText(valueOf(digest.props, "DESCRIPTION") || "").split("\n");
      const unlisted = s.tasks.filter((q) => q.type === "daily" && !digestLines.includes(`- ${q.title}`));
      if (unlisted.length) throw new Error("the digest description does not list every daily task: " + unlisted.map((q) => q.id).join(", "));

      if (withSummary(PREFIX.goal + FIX.goal).length !== 1) throw new Error("the goal deadline inside the window is not exported once");
      if (withSummary(PREFIX.due + FIX.ticked).length) throw new Error("the ticked one-off deadline was exported");
      if (uids.includes(`goal-${planted.otherId}${HOST}`) || withSummary(PREFIX.goal + planted.otherTitle).length) throw new Error("the past goal deadline was exported");

      if (!screen.includes(toastLine(events.length, end))) throw new Error(`the export toast does not state ${events.length} entries up to ${end}`);
      if (await stateString() !== plantedState) throw new Error("exporting rewrote the save");
      if (await storageKeys() !== plantedKeys) throw new Error("exporting added or removed a storage key");
      first = { dl, events, today, end, days, monthEnds };
    });

    await step("calendar export — a weekly repeat carries its RRULE, UNTIL and cancelled date", async () => {
      const f = need();
      const weekly = f.events.filter((e) => summaryOf(e) === PREFIX.appt + FIX.weekly);
      if (weekly.length !== 1) throw new Error(`weekly repeat VEVENT count ${weekly.length}, expected 1`);
      const [w] = weekly;
      const start = await dstrIn(8);
      let last = start;
      for (let k = 1; ; k++) { const d = await dstrIn(8 + 7 * k); if (d > f.end) break; last = d; }
      if (valueOf(w.props, "DTSTART") !== `${compact(start)}T200000`) throw new Error("weekly DTSTART: " + valueOf(w.props, "DTSTART"));
      if (valueOf(w.props, "DTEND") !== `${compact(start)}T210000`) throw new Error("weekly DTEND: " + valueOf(w.props, "DTEND"));
      if (valueOf(w.props, "RRULE") !== `FREQ=WEEKLY;UNTIL=${compact(last)}T200000`) throw new Error(`weekly RRULE ${valueOf(w.props, "RRULE")}, expected UNTIL ${compact(last)}T200000`);
      const exdates = w.props.filter((x) => x.name === "EXDATE").flatMap((x) => x.value.split(","));
      if (!exdates.includes(`${compact(f.days.plus15)}T200000`)) throw new Error("the cancelled date is not an EXDATE: " + exdates.join(","));
      if (exdates.includes(`${compact(await dstrIn(1))}T200000`)) throw new Error("a cancelled date before DTSTART is listed as an EXDATE");
    });

    await step("calendar export — a monthly event on the 31st lists the app's own dates instead of a rule", async () => {
      const f = need();
      const monthly = f.events.filter((e) => /^event-ics-monthly31-\d{8}@life-manager$/.test(e.uid || ""));
      const starts = monthly.map((e) => propOf(e.props, "DTSTART")).map((x) => (x.params.join(";") === "VALUE=DATE" ? x.value : `timed:${x.value}`)).sort();
      const want = f.monthEnds.map(compact);
      if (starts.join(",") !== want.join(",")) throw new Error(`monthly start dates ${starts.join(",")}, expected the month-ends ${want.join(",")}`);
      if (!want.some((d) => !d.endsWith("31"))) throw new Error("no month-end in the window falls before the 31st, so the clamp went untested");
      if (monthly.some((e) => propOf(e.props, "RRULE"))) throw new Error("an expanded monthly entry carries an RRULE");
      if (monthly.some((e) => !e.uid.endsWith(`-${valueOf(e.props, "DTSTART")}${HOST}`))) throw new Error("an expanded monthly UID does not name its own date");
    });

    await step("calendar export — lines fold at 75 octets and a Korean title unfolds to the original", async () => {
      const f = need();
      const bytes = Buffer.from(f.dl.b64 || "", "base64");
      if (bytes.toString("utf8") !== f.dl.text) throw new Error("the captured bytes and text disagree");
      const decoder = new TextDecoder("utf-8", { fatal: true });
      let from = 0;
      let lineNo = 0;
      for (let i = 0; i + 1 < bytes.length; i++) {
        if (bytes[i] !== 0x0d || bytes[i + 1] !== 0x0a) continue;
        const seg = bytes.subarray(from, i);
        lineNo += 1;
        if (seg.length > 75) throw new Error(`physical line ${lineNo} is ${seg.length} octets: ${seg.toString("utf8").slice(0, 40)}`);
        try { decoder.decode(seg); } catch { throw new Error(`physical line ${lineNo} cuts a UTF-8 sequence`); }
        from = i + 2;
        i += 1;
      }
      if (from !== bytes.length) throw new Error("bytes follow the last CRLF");
      const long = f.events.find((e) => e.uid === `event-ics-long${HOST}`);
      const summary = long && propOf(long.props, "SUMMARY");
      if (!summary) throw new Error("the long-title appointment has no SUMMARY");
      if (summary.lines < 2) throw new Error(`the long SUMMARY spans ${summary.lines} physical line, so no fold was exercised`);
      if (unescapeText(summary.value) !== PREFIX.appt + FIX.long) throw new Error("the unfolded summary is not the stored title: " + unescapeText(summary.value));
      for (const esc of ["\\,", "\\;", "\\\\"]) if (!summary.value.includes(esc)) throw new Error(`the escaped summary lacks ${esc}`);
    });

    await step("calendar export — a second export keeps every UID", async () => {
      const f = need();
      const dl = await exportYear();
      if (!dl) throw new Error("the second export offered no file");
      const again = parseIcs(dl.text || "");
      const bag = (list) => list.map((e) => e.uid).sort().join("\n");
      if (again.length !== f.events.length) throw new Error(`VEVENT count ${f.events.length} -> ${again.length}`);
      if (bag(again) !== bag(f.events)) throw new Error("the second export changed the UIDs");
      const firstSeq = new Map(f.events.map((e) => [e.uid, Number(valueOf(e.props, "SEQUENCE"))]));
      const lower = again.filter((e) => !(Number(valueOf(e.props, "SEQUENCE")) >= firstSeq.get(e.uid)));
      if (lower.length) throw new Error("SEQUENCE went down for " + lower.map((e) => e.uid).join(", "));
    });

    await step("calendar export — no profile, contact or business field is in the file", async () => {
      const f = need();
      const s = await readState();
      const p = s.profile || {};
      const edus = p.edus || [];
      const careers = p.careers || [];
      if (!edus.length || !careers.length) throw new Error("the save has no education or career record, so their absence would prove nothing");
      const identifying = [["name", p.name], ["nick", p.nick], ["birth", p.birth], ["email", p.email], ["phone", p.phone],
        ...edus.map((e, i) => [`school ${i}`, e.school]), ...careers.map((c, i) => [`employer ${i}`, c.company])];
      const empty = identifying.filter(([, v]) => !v).map(([k]) => k);
      if (empty.length) throw new Error("identifying fields are empty, so their absence would prove nothing: " + empty.join(", "));
      identifying.push(["birth digits", p.birth.replace(/-/g, "")], ["phone digits", p.phone.replace(/\D/g, "")]);
      const raw = f.dl.text;
      const flat = unfold(raw);
      const values = f.events.flatMap((e) => [...e.props, ...e.alarms.flat()]).filter((x) => x.name === "SUMMARY" || x.name === "DESCRIPTION").map((x) => unescapeText(x.value));
      for (const [k, v] of identifying) {
        if (raw.includes(v) || flat.includes(v) || values.some((t) => t.includes(v))) throw new Error(`the file carries the profile field: ${k}`);
      }

      // Business records, the event place and note, and the journal: absent from every text value. Amounts are only
      // searched in text values, since a SEQUENCE or DTSTAMP could hold the same digits by chance.
      const deals = s.deals || [];
      const rates = s.rates || [];
      if (!deals.length || !rates.length) throw new Error("the save has no deal or rate, so their absence would prove nothing");
      const planted = (s.events || []).find((e) => e.id === "ics-long");
      if (!planted || planted.place !== FIX.place || planted.note !== FIX.note) throw new Error("the planted place and note are not in the save");
      const journal = (s.journal || []).map((j) => j.text).filter(Boolean);
      if (!journal.length) throw new Error("the save has no journal text, so its absence would prove nothing");
      const amounts = [...deals.flatMap((d) => [d.monthly, d.costMonthly]), ...rates.flatMap((r) => [r.price, r.cost])].filter((n) => Number.isFinite(n) && n > 0);
      const forbidden = [
        ...deals.flatMap((d) => [["deal client", d.client], ["deal title", d.title]]),
        ...rates.map((r) => ["rate name", r.name]),
        ...(s.folio || []).map((x) => ["portfolio title", x.title]),
        ...amounts.flatMap((n) => [["amount", String(n)], ["amount", n.toLocaleString("en-US")]]),
        ["event place", planted.place], ["event note", planted.note],
        ...journal.map((t) => ["journal text", t]),
      ].filter(([, v]) => v);
      for (const [k, v] of forbidden) {
        if (values.some((t) => t.includes(v))) throw new Error(`a SUMMARY or DESCRIPTION carries the ${k}: ${v}`);
      }
    });
  } finally {
    await closeModal();
    await writeState(original);
    await h.reload();
  }

  await step("calendar export — with nothing to include the sheet says so and writes no file", async () => {
    const kept = await stateString();
    try {
      await page.evaluate((k) => {
        const s = JSON.parse(localStorage.getItem(k));
        s.events = [];
        s.tasks = [];
        s.goals = [];
        localStorage.setItem(k, JSON.stringify(s));
      }, KEY);
      await h.reload();
      const today = await dstrIn(0);
      const end90 = await dstrIn(89);
      await openSheet();
      await expectText(emptyLine(today, end90));
      if (await previewLine()) throw new Error("the preview line is still shown with nothing to include");
      const disabled = await page.evaluate((label) => {
        const ov = [...document.querySelectorAll(".fixed.inset-0")].pop();
        const b = ov && [...ov.querySelectorAll("button")].find((x) => (x.innerText || "").trim() === label);
        return b ? b.disabled : null;
      }, COPY.button);
      if (disabled !== true) throw new Error(`the export button disabled state is ${disabled}`);
      const dl = await captureDownload(() => clickInModalExact(COPY.button));
      if (dl) throw new Error("a file was offered with nothing to include: " + dl.name);
      if (await hasText(toastLine(0, end90))) throw new Error("an empty export still toasted");
    } finally {
      await closeModal();
      await writeState(kept);
      await h.reload();
    }
  });
};
