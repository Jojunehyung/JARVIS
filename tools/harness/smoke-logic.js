// Engine smoke: pure-function checks on the data tables and payout logic, no browser.
// Structure integrity → longest-name matching → ladder differential payouts → representative job × cert payouts.
const S = require("./lib/source");

const src = S.readSrc();
const CERTS = S.evalConst("CERTS", src), CERT_CATS = S.evalConst("CERT_CATS", src), WEIGHT_MATRIX = S.evalConst("WEIGHT_MATRIX", src);
const CERT_W_EXC = S.evalConst("CERT_W_EXC", src), TIER_MULT = S.evalConst("TIER_MULT", src), DIR_ALIAS = S.evalConst("DIR_ALIAS", src);
const DIR_CATS = S.evalConst("DIR_CATS", src), JOB_FIELDS = S.evalConst("JOB_FIELDS", src), KNOWLEDGE_FIELDS = S.evalConst("KNOWLEDGE_FIELDS", src);
const EXAMS = S.evalConst("EXAMS", src);

// Mirrors of the app formulas (kept in sync with core-beliefs rules 1, 5, 15).
const certP = (d) => Math.round((0.2 * d * d) / 10) * 10;
const achGrade = (d) => (d >= 82 ? "A" : d >= 65 ? "B" : d >= 50 ? "C" : d >= 35 ? "D" : "E");
const certByTitle = (t) => (t ? CERTS.filter((c) => t.includes(c.n)).sort((a, b) => b.n.length - a.n.length)[0] || null : null);
const normDirs = (dirs) => [...new Set((dirs || []).map((d) => (WEIGHT_MATRIX[d] ? d : DIR_ALIAS[d])).filter(Boolean))];
const jobWeight = (dirs, cert) => {
  const ds = normDirs(dirs); if (!ds.length) return null;
  let worst = null;
  for (const d of ds) { const tier = CERT_W_EXC[cert.n]?.[d] || WEIGHT_MATRIX[d][cert.c] || "C"; if (!worst || TIER_MULT[tier] < TIER_MULT[worst.tier]) worst = { tier, field: d }; }
  return { ...worst, mult: TIER_MULT[worst.tier] };
};
const certGain = (best, c) => { const base = certP(c.d); return c.sg ? Math.max(0, base - (best[c.sg]?.p || 0)) : base; };

let fail = 0;
const ok = (cond, msg) => { if (!cond) { fail++; console.log("  ✗", msg); } };

// 1) structural integrity
const cfg = (() => { try { return require("./finish.config.json").expectedCounts; } catch { return null; } })();
if (cfg) {
  ok(CERTS.length === cfg.certs, `CERTS count ${CERTS.length} ≠ expected ${cfg.certs}`);
  ok(EXAMS.length === cfg.examFamilies, `EXAMS families ${EXAMS.length} ≠ expected ${cfg.examFamilies}`);
  ok(Object.keys(WEIGHT_MATRIX).length === cfg.jobs, `WEIGHT_MATRIX jobs ${Object.keys(WEIGHT_MATRIX).length} ≠ expected ${cfg.jobs}`);
  ok(CERT_CATS.length === cfg.categories, `CERT_CATS ${CERT_CATS.length} ≠ expected ${cfg.categories}`);
  ok(Object.keys(CERT_W_EXC).length === cfg.exceptions, `CERT_W_EXC entries ${Object.keys(CERT_W_EXC).length} ≠ expected ${cfg.exceptions}`);
}
ok(new Set(CERTS.map((c) => c.n)).size === CERTS.length, "duplicate cert names");
for (const j of JOB_FIELDS) ok(WEIGHT_MATRIX[j], `JOB_FIELDS "${j}" has no WEIGHT_MATRIX row`);
for (const [j, row] of Object.entries(WEIGHT_MATRIX)) for (const c of Object.keys(row)) ok(CERT_CATS.includes(c), `WEIGHT_MATRIX ${j}: unknown category "${c}"`);
for (const d of KNOWLEDGE_FIELDS) ok(DIR_CATS[d], `KNOWLEDGE_FIELDS "${d}" has no DIR_CATS entry`);
for (const [d, v] of Object.entries(DIR_CATS)) { for (const c of v.cats || []) ok(CERT_CATS.includes(c), `DIR_CATS ${d}: unknown category "${c}"`); ok(WEIGHT_MATRIX[d] || DIR_ALIAS[d] || v.exam, `DIR_CATS "${d}" maps to no matrix row or alias`); }
for (const [a, j] of Object.entries(DIR_ALIAS)) ok(WEIGHT_MATRIX[j], `DIR_ALIAS ${a} → "${j}" has no row`);
for (const n of Object.keys(CERT_W_EXC)) ok(CERTS.some((c) => c.n === n), `CERT_W_EXC "${n}" is not in CERTS`);
for (const c of CERTS) { ok(CERT_CATS.includes(c.c), `cert "${c.n}": unknown category "${c.c}"`); ok(c.d >= 20 && c.d <= 100, `cert "${c.n}": D ${c.d} out of range`); }
console.log(`structure: certs ${CERTS.length} · categories ${CERT_CATS.length} · jobs ${Object.keys(WEIGHT_MATRIX).length}`);

// 2) longest-name matching (rule 15: a shorter cert name contained in a longer one must not win)
for (const [title, want] of [["치과의사 면허 취득", "치과의사"], ["한약사 합격", "한약사"], ["전문간호사 취득", "전문간호사"], ["정신건강사회복지사 1급", "정신건강사회복지사 1급"], ["실내건축기사 취득", "실내건축기사"], ["이산화탄소가스아크용접기능사", "이산화탄소가스아크용접기능사"]]) {
  const g = certByTitle(title)?.n; ok(g === want, `certByTitle("${title}") = ${g}, expected ${want}`);
}

// 3) stage-group ladders pay the difference only (rule 3) and are monotonic in D
const ladders = {};
for (const c of CERTS) if (c.sg) (ladders[c.sg] = ladders[c.sg] || []).push(c);
for (const [sg, arr] of Object.entries(ladders)) {
  arr.sort((a, b) => a.st - b.st);
  ok(new Set(arr.map((c) => c.st)).size === arr.length, `ladder ${sg}: duplicate st`);
  for (let i = 1; i < arr.length; i++) ok(arr[i].d > arr[i - 1].d, `ladder ${sg}: D not increasing at ${arr[i].n}`);
  const best = {}; let sum = 0;
  for (const c of arr) { sum += certGain(best, c); best[sg] = { p: certP(c.d) }; }
  ok(sum === certP(arr[arr.length - 1].d), `ladder ${sg}: cumulative payout ${sum} ≠ top step ${certP(arr[arr.length - 1].d)}`);
}
console.log(`ladders: ${Object.keys(ladders).length} checked`);

// 4) representative job × cert payouts (documented scenario values)
const expect = (job, name, tier, pay) => {
  const c = CERTS.find((x) => x.n === name); if (!c) { fail++; console.log(`  ✗ ${name} not in CERTS`); return; }
  const jw = jobWeight([job], c); const base = certP(c.d);
  const got = jw ? Math.round(base * jw.mult / 10) * 10 : base;
  ok(jw?.tier === tier && got === pay, `${job} × ${name}: got ${jw?.tier} ${got}P, expected ${tier} ${pay}P (D${c.d} ${achGrade(c.d)})`);
};
expect("전기·기계", "전기기사", "S", 900);       // scenario: harness design engineer, D67 → grade B, S ×1.0 = 900P
expect("개발", "정보처리기사", "A", 520);
expect("보건·의료", "간호사", "S", 870);
expect("교육·복지", "사회복지사 1급", "S", 560); // individual exception (rule 15)
expect("개발", "지게차운전기능사", "C", 0);
ok(achGrade(67) === "B", "D67 must be grade B");


// 4b) role stage conditions: every condition type the editor offers has a landing on the role screen (2026-09-18)
{
  const COND_TYPES = S.evalConst("COND_TYPES", src), ROLE_COND_ACTIONS = S.evalConst("ROLE_COND_ACTIONS", src);
  for (const [t] of COND_TYPES) ok(ROLE_COND_ACTIONS[t], `COND_TYPES "${t}" has no ROLE_COND_ACTIONS landing`);
  for (const t of Object.keys(ROLE_COND_ACTIONS)) ok(COND_TYPES.some(([x]) => x === t), `ROLE_COND_ACTIONS "${t}" is not a condition type`);
  for (const [t, a] of Object.entries(ROLE_COND_ACTIONS)) ok(a.label && (a.catalog || a.view), `ROLE_COND_ACTIONS "${t}" states no label or destination`);
  console.log(`role conditions: ${COND_TYPES.length} types, each with a landing`);
}

// 5) calendar file — the RFC 5545 builder, lifted from the app source and run without a browser
const ICS_NAMES = [
  "dstr", "shiftDay", "daysBetween", "EVENT_KIND_LABEL", "EVENT_HORIZON_DAYS", "MAX_OCC", "occurrencesOf",
  "ICS_RANGE_DAYS", "ICS_REMIND_DEFAULT", "ICS_APPT_LEAD_MIN", "ICS_APPT_MINUTES", "ICS_DIGEST_MINUTES", "ICS_LINE_OCTETS",
  "ICS_SEQ_EPOCH", "ICS_UID_HOST", "ICS_MILESTONE_LEAD_DAYS", "ICS_CHECK_LEAD_DAYS", "PAYMENT_KIND", "noticeOpen", "icsText", "icsFold", "icsDate", "icsLocal", "icsAddMinutes", "icsUtcStamp", "icsDuration",
  "icsUid", "isTraining", "followUpsOf", "calendarExportOf", "buildIcs",
];
const lift = (n) => { const b = S.grabBlock(n, src); if (!b) throw new Error(`smoke: ${n} is not a top-level declaration in the app source`); return b.text; };
const ICS = new Function(ICS_NAMES.map(lift).join("\n") + "\nreturn { buildIcs, calendarExportOf, icsFold, icsText, icsAddMinutes, ICS_RANGE_DAYS, MAX_OCC, occurrencesOf };")();
const NOW = Date.UTC(2026, 8, 14, 1, 30, 12);
const unfoldIcs = (t) => t.replace(/\r\n[ \t]/g, "");
// VEVENT bodies of the unfolded text; each still holds its VALARM, so property lookups anchor on line starts.
const veventsOf = (t) => unfoldIcs(t).split("BEGIN:VEVENT\r\n").slice(1).map((b) => b.split("END:VEVENT\r\n")[0]);
const lineValue = (body, name) => (body.match(new RegExp(`(?:^|\\r\\n)${name}:([^\\r\\n]*)\\r\\n`)) || [])[1];
const lineValues = (body, name) => [...body.matchAll(new RegExp(`(?:^|\\r\\n)${name}:([^\\r\\n]*)(?=\\r\\n)`, "g"))].map((m) => m[1]);
const mkEvent = (o) => ({ title: "일정", kind: "appt", createdAt: "2026-01-01", ...o });
const mkState = (o) => ({ events: [], tasks: [], goals: [], ...o });
const RICH = mkState({
  events: [
    mkEvent({ id: "due1", title: "원서 마감", kind: "due", date: "2026-09-20", time: "18:00" }),
    mkEvent({ id: "due2", title: "월말 서류", kind: "due", date: "2026-09-30" }),
    mkEvent({ id: "appt1", title: "면접", date: "2026-09-16", time: "14:00", place: "판교", note: "지참물" }),
    mkEvent({ id: "appt2", title: "통화", date: "2026-09-17" }),
    mkEvent({ id: "prep1", title: "병원 미팅", date: "2026-09-22", time: "10:00",
      checks: [{ id: "c1", text: "단가 근거 자료", done: false, source: "manual" }, { id: "c2", text: "끝난 확인", done: true, source: "ai" }] }),
  ],
  tasks: [
    { id: "t1", title: "이력서\n수정", type: "once", status: "todo", due: "2026-09-18", goalId: "g1" },
    { id: "t2", title: "지난 실행", type: "once", status: "todo", due: "2026-09-10", goalId: "g1" },
    { id: "d1", title: "영어 30분", type: "daily", status: "todo", doneDates: [] },
    { id: "d2", title: "운동 30분", type: "daily", status: "todo", doneDates: [] },
  ],
  goals: [
    { id: "g1", title: "취업", status: "active", deadline: "2026-10-01" },
    { id: "g2", title: "지난 목표", status: "active", deadline: "2026-09-01" },
  ],
  // v28 kinds: follow-ups, a milestone, a payment line and a notice — one inside the window and one past where it matters.
  meetings: [{ id: "mt1", projectId: null, title: "킥오프 회의", date: "2026-09-10", summary: "회의 본문", transcript: "녹취",
    followUps: [{ id: "f1", text: "견적서 송부", mine: true, due: "2026-09-25", done: false },
      { id: "f2", text: "지난 후속", mine: true, due: "2026-09-01", done: false },
      { id: "f3", text: "끝난 후속", mine: true, due: "2026-09-25", done: true }] }],
  milestones: [
    { id: "ms1", title: "챗봇 과제 계약", status: "active", due: "2026-10-15", dealIds: [], documentIds: [], workIds: [], createdAt: "2026-09-01" },
    { id: "ms2", title: "지난 마일스톤", status: "planned", due: "2026-09-05", dealIds: [], documentIds: [], workIds: [], createdAt: "2026-08-01" },
    { id: "ms3", title: "끝난 마일스톤", status: "done", due: "2026-10-01", doneAt: "2026-09-12", dealIds: [], documentIds: [], workIds: [], createdAt: "2026-08-01" },
  ],
  deals: [{ id: "dl1", client: "가나병원", title: "ETL 고도화", status: "won", monthly: 5000000, note: "메모",
    payments: [{ id: "p1", kind: "deposit", due: "2026-09-30", amount: 1234567 }, { id: "p2", kind: "final", due: "2026-10-30", amount: 1234567, paidAt: "2026-09-13" }] }],
  notices: [{ id: "nt1", title: "AI 바우처", agency: "진흥원", deadline: "2026-10-20", status: "writing", documentIds: [], note: "공고 메모" },
    { id: "nt2", title: "선정된 공고", agency: "진흥원", deadline: "2026-10-20", status: "selected", documentIds: [] }],
});

// (a) TEXT escaping, the backslash first
ok(ICS.icsText("a\\b;c,d\ne") === "a\\\\b\\;c\\,d\\ne", `icsText escaping: ${JSON.stringify(ICS.icsText("a\\b;c,d\ne"))}`);

// (b) folding counts UTF-8 bytes per code point and never splits a character; the emoji is walked across the 75-octet edge
{
  const syllables = Array.from({ length: 60 }, (_, i) => String.fromCodePoint(0xac00 + i * 97)).join("");
  const inputs = [`SUMMARY:${syllables}📌`, ...[70, 71, 72, 73, 74].map((k) => `DESCRIPTION:${"x".repeat(k - 12)}📌${syllables}`)];
  for (const input of inputs) {
    const folded = ICS.icsFold(input);
    const physical = folded.split("\r\n");
    const sizes = physical.map((l) => Buffer.byteLength(l, "utf8"));
    ok(physical.length >= 2, `fold: a ${Buffer.byteLength(input, "utf8")}-octet line was not folded`);
    ok(sizes.every((n) => n <= 75), `fold: physical line sizes ${sizes.join(",")} exceed 75 octets`);
    ok(!physical[0].startsWith(" ") && physical.slice(1).every((l) => l[0] === " " && l[1] !== " "), "fold: a continuation line does not start with exactly one space");
    ok(physical.every((l) => !/[\ud800-\udbff](?![\udc00-\udfff])|(?<![\ud800-\udbff])[\udc00-\udfff]/.test(l)), "fold: a physical line holds a lone surrogate");
    ok(folded.replace(/\r\n[ \t]/g, "") === input, "fold: unfolding does not restore the input");
  }
}

// (c) a monthly event on the 31st is written as the app's own dates, one VEVENT each; day 15 keeps one rule
{
  const today = "2026-02-01";
  const m31 = mkEvent({ id: "m31", kind: "due", date: "2026-01-31", repeat: { freq: "monthly" } });
  const out = ICS.buildIcs(mkState({ events: [m31] }), today, { days: 365, now: NOW });
  const starts = veventsOf(out.text).map((b) => lineValue(b, "DTSTART;VALUE=DATE"));
  const want = ICS.occurrencesOf(m31, today, out.end).map((d) => d.replace(/-/g, ""));
  ok(out.end === "2027-01-31", `monthly 31: window end ${out.end}, expected 2027-01-31`);
  ok(want.length === 12 && JSON.stringify(starts) === JSON.stringify(want), `monthly 31: VEVENT starts ${starts.join(",")} differ from occurrencesOf ${want.join(",")}`);
  ok(["20260228", "20260430", "20260930", "20270131"].every((d) => starts.includes(d)), `monthly 31: a clamped month-end is missing: ${starts.join(",")}`);
  ok(!/\r\nRRULE:/.test(out.text), "monthly 31: an RRULE was written for a clamped day of month");
  const m15 = mkEvent({ id: "m15", kind: "due", date: "2026-01-15", repeat: { freq: "monthly" } });
  const out15 = ICS.buildIcs(mkState({ events: [m15] }), today, { days: 365, now: NOW });
  const b15 = veventsOf(out15.text);
  ok(b15.length === 1 && lineValue(b15[0], "RRULE") === "FREQ=MONTHLY;UNTIL=20270115", `monthly 15: expected one VEVENT with RRULE:FREQ=MONTHLY;UNTIL=20270115, got ${b15.length} / ${b15[0] && lineValue(b15[0], "RRULE")}`);
}

// (d) a weekly timed repeat starts on its first included date, ends on its last, and lists exactly the cancelled and ticked dates between
{
  const w = mkEvent({ id: "w1", title: "주간", date: "2026-09-01", time: "20:00", repeat: { freq: "weekly" },
    skip: ["2026-09-08", "2026-09-15", "2026-09-29"], doneDates: ["2026-10-06"] });
  const [b] = veventsOf(ICS.buildIcs(mkState({ events: [w] }), "2026-09-14", { days: 90, now: NOW }).text);
  ok(lineValue(b, "DTSTART") === "20260922T200000", `weekly: DTSTART ${lineValue(b, "DTSTART")}, expected the first included date 20260922T200000`);
  ok(lineValue(b, "DTEND") === "20260922T210000", `weekly: DTEND ${lineValue(b, "DTEND")}`);
  ok(lineValue(b, "RRULE") === "FREQ=WEEKLY;UNTIL=20261208T200000", `weekly: RRULE ${lineValue(b, "RRULE")}`);
  const ex = lineValues(b, "EXDATE").sort();
  ok(JSON.stringify(ex) === JSON.stringify(["20260929T200000", "20261006T200000"]), `weekly: EXDATE ${ex.join(",")}, expected the skipped 0929 and the ticked 1006 only`);
}

// (e) a later export keeps every UID and never lowers SEQUENCE
{
  const a = ICS.buildIcs(RICH, "2026-09-14", { days: 90, now: NOW }).text;
  const b = ICS.buildIcs(RICH, "2026-09-14", { days: 90, now: NOW + 86400000 }).text;
  const uids = (t) => veventsOf(t).map((x) => lineValue(x, "UID"));
  const seqs = (t) => veventsOf(t).map((x) => Number(lineValue(x, "SEQUENCE")));
  ok(uids(a).length >= 6 && JSON.stringify(uids(a)) === JSON.stringify(uids(b)), `uid: UIDs differ between exports: ${uids(a).join(",")} / ${uids(b).join(",")}`);
  ok(seqs(a).every((s, i) => Number.isInteger(s) && seqs(b)[i] >= s) && seqs(b)[0] > seqs(a)[0], `uid: SEQUENCE did not grow: ${seqs(a)[0]} -> ${seqs(b)[0]}`);
}

// (f) CRLF only, including after the last line
{
  const t = ICS.buildIcs(RICH, "2026-09-14", { days: 365, now: NOW }).text;
  ok(t.endsWith("END:VCALENDAR\r\n"), "crlf: the text does not end with END:VCALENDAR and CRLF");
  ok(!/(^|[^\r])\n/.test(t), "crlf: a line feed without a carriage return");
  ok(!/\r(?!\n)/.test(t), "crlf: a carriage return without a line feed");
}

// (g) privacy by construction: the builder reads events, tasks, goals and the v28 alarm sources only — never the
// profile, the rates, the portfolio, the leads, the documents, the journal, the reviews, an event's place and note, a
// meeting's body or transcript, a contract's money or note, a payment's amount or a notice's note (each throws when read)
{
  const trap = (obj, keys) => { for (const k of keys) Object.defineProperty(obj, k, { enumerable: true, get() { throw new Error(`read ${k}`); } }); return obj; };
  // Every event branch is exercised: one-off, a rule with exceptions, and a day-31 monthly expansion.
  const repeats = [
    mkEvent({ id: "wk", title: "주간", date: "2026-09-15", time: "20:00", repeat: { freq: "weekly" }, skip: ["2026-09-22"] }),
    mkEvent({ id: "mo", title: "월말", kind: "due", date: "2026-01-31", repeat: { freq: "monthly" } }),
  ];
  const trapped = trap(mkState({ events: [...RICH.events, ...repeats].map((e) => trap({ ...e }, ["place", "note"])), tasks: RICH.tasks, goals: RICH.goals,
    meetings: RICH.meetings.map((m) => trap({ ...m }, ["summary", "decisions", "actions", "transcript", "progress", "attendees"])),
    milestones: RICH.milestones.map((m) => trap({ ...m }, ["condition", "dealIds", "documentIds", "workIds"])),
    deals: RICH.deals.map((d) => trap({ ...d, payments: d.payments.map((p) => trap({ ...p }, ["amount"])) }, ["monthly", "costMonthly", "note", "paidMonths"])),
    notices: RICH.notices.map((n) => trap({ ...n }, ["note", "documentIds", "postedAt"])) }),
    ["profile", "rates", "folio", "leads", "documents", "journal", "reviews", "timeLog"]);
  let threw = null;
  try { ICS.buildIcs(trapped, "2026-09-14", { days: 365, remindAt: "07:00", now: NOW }); } catch (e) { threw = e.message; }
  ok(!threw, `privacy: the calendar export ${threw}`);
}

// (h) wall-clock minutes roll over the day and the year
{
  const r = ICS.icsAddMinutes("2026-12-31", "23:30", 60);
  ok(r.date === "2027-01-01" && r.time === "00:30", `icsAddMinutes: ${JSON.stringify(r)}`);
}

// (i) the longest range cannot outrun the occurrence iteration stop
ok(Math.max(...ICS.ICS_RANGE_DAYS) <= ICS.MAX_OCC, `range: ${Math.max(...ICS.ICS_RANGE_DAYS)} days exceeds MAX_OCC ${ICS.MAX_OCC}`);

// (i2) a training record is reference only: its stored follow-ups write no calendar entry (2026-09-22)
{
  const train = { ...RICH.meetings[0], id: "tr1", kind: "training", title: "품질 교육" };
  const uids = (st) => veventsOf(ICS.buildIcs(st, "2026-09-14", { days: 90, now: NOW }).text).map((b) => lineValue(b, "UID")).filter((u) => u.startsWith("followup-"));
  const withMeeting = uids(RICH), withTraining = uids({ ...RICH, meetings: [...RICH.meetings, train] });
  ok(withMeeting.length === 1 && withTraining.join() === withMeeting.join(), `training follow-ups: ${withMeeting.join()} vs ${withTraining.join()}`);
}

// (j) nothing to include still makes a complete calendar
{
  const out = ICS.buildIcs(mkState({}), "2026-09-14", { days: 90, now: NOW });
  ok(out.entries.length === 0 && out.text.startsWith("BEGIN:VCALENDAR\r\n") && out.text.endsWith("END:VCALENDAR\r\n") && !out.text.includes("BEGIN:VEVENT"),
    `empty: ${out.entries.length} entries / ${JSON.stringify(out.text.slice(0, 40))}`);
}

// (k) forms: all-day dates with an exclusive next-day end, the reminder offset, the appointment lead, the digest
{
  const out = ICS.buildIcs(RICH, "2026-09-14", { days: 90, remindAt: "08:30", now: NOW });
  const byUid = Object.fromEntries(veventsOf(out.text).map((b) => [lineValue(b, "UID"), b]));
  const due1 = byUid["event-due1@life-manager"] || "";
  ok(lineValue(due1, "DTSTART;VALUE=DATE") === "20260920" && lineValue(due1, "DTEND;VALUE=DATE") === "20260921", "forms: all-day deadline start/end");
  ok(lineValue(due1, "SUMMARY") === "마감 18:00 · 원서 마감", `forms: a deadline keeps its time as text: ${lineValue(due1, "SUMMARY")}`);
  ok(lineValue(due1, "TRIGGER") === "PT8H30M", `forms: all-day TRIGGER ${lineValue(due1, "TRIGGER")}, expected PT8H30M`);
  const due2 = byUid["event-due2@life-manager"] || "";
  ok(lineValue(due2, "DTEND;VALUE=DATE") === "20261001", `forms: the all-day end after a month-end ${lineValue(due2, "DTEND;VALUE=DATE")}`);
  const appt1 = byUid["event-appt1@life-manager"] || "";
  ok(lineValue(appt1, "DTSTART") === "20260916T140000" && lineValue(appt1, "DTEND") === "20260916T150000", "forms: timed appointment start/end");
  ok(lineValue(appt1, "TRIGGER") === "-PT1H", `forms: appointment TRIGGER ${lineValue(appt1, "TRIGGER")}, expected -PT1H`);
  const digest = byUid["daily-tasks@life-manager"] || "";
  ok(lineValue(digest, "DTSTART") === "20260914T083000" && lineValue(digest, "RRULE") === "FREQ=DAILY;UNTIL=20261212T083000", "forms: digest start and rule");
  ok(lineValue(digest, "TRIGGER") === "PT0S", `forms: digest TRIGGER ${lineValue(digest, "TRIGGER")}, expected PT0S`);
  ok(lineValue(digest, "SUMMARY") === "매일 실행 2건 · 영어 30분 외 1건", `forms: digest summary ${lineValue(digest, "SUMMARY")}`);
  ok(lineValue(byUid["task-t1@life-manager"] || "", "SUMMARY") === "실행 기한 · 이력서\\n수정", "forms: a newline in a title is escaped");
  ok(out.skipped.tasks === 1 && out.skipped.goals === 1 && !byUid["task-t2@life-manager"] && !byUid["goal-g2@life-manager"], `forms: past-dated items are counted, not written: ${JSON.stringify(out.skipped)}`);
  ok(ICS.calendarExportOf(RICH, "2026-09-14", 45).end === "2026-12-12", "forms: a range outside the chips falls back to the 90-day horizon");
}

// (l) every VEVENT carries exactly one VALARM with ACTION:DISPLAY, TRIGGER and DESCRIPTION
{
  const blocks = veventsOf(ICS.buildIcs(RICH, "2026-09-14", { days: 365, now: NOW }).text);
  ok(blocks.length >= 6, `alarms: only ${blocks.length} VEVENTs to check`);
  for (const b of blocks) {
    const alarms = b.split("BEGIN:VALARM\r\n").slice(1);
    const body = (alarms[0] || "").split("END:VALARM\r\n")[0];
    ok(alarms.length === 1 && lineValue(body, "ACTION") === "DISPLAY" && lineValue(body, "TRIGGER") && lineValue(body, "DESCRIPTION"),
      `alarms: ${lineValue(b, "UID")} has ${alarms.length} VALARM(s) or an incomplete one`);
  }
}
// (m) an open follow-up with a due date inside the window: its UID, summary and description; a done one is not written
{
  const out = ICS.buildIcs(RICH, "2026-09-14", { days: 90, now: NOW });
  const byUid = Object.fromEntries(veventsOf(out.text).map((b) => [lineValue(b, "UID"), b]));
  const f1 = byUid["followup-mt1-f1@life-manager"] || "";
  ok(lineValue(f1, "SUMMARY") === "후속 기한 · 견적서 송부" && lineValue(f1, "DTSTART;VALUE=DATE") === "20260925", `followup: ${lineValue(f1, "SUMMARY")} / ${lineValue(f1, "DTSTART;VALUE=DATE")}`);
  ok((lineValue(f1, "DESCRIPTION") || "").startsWith("회의록 · 킥오프 회의\\n목표 기여 없음"), `followup: description ${lineValue(f1, "DESCRIPTION")}`);
  ok(!byUid["followup-mt1-f3@life-manager"] && out.counts.followup === 1, `followup: a done follow-up was written or the count is ${out.counts.followup}`);
}

// (n) open checks land on the day before the occurrence, with each open check's text and no done one
{
  const out = ICS.buildIcs(RICH, "2026-09-14", { days: 90, now: NOW });
  const b = veventsOf(out.text).find((x) => lineValue(x, "UID") === "check-prep1-20260922@life-manager") || "";
  ok(lineValue(b, "DTSTART;VALUE=DATE") === "20260921" && lineValue(b, "DTEND;VALUE=DATE") === "20260922", `check: start ${lineValue(b, "DTSTART;VALUE=DATE")}, expected 20260921`);
  ok(lineValue(b, "SUMMARY") === "확인할 것 1건 · 병원 미팅", `check: summary ${lineValue(b, "SUMMARY")}`);
  const desc = lineValue(b, "DESCRIPTION") || "";
  ok(desc.includes("- 단가 근거 자료") && !desc.includes("끝난 확인"), `check: description ${desc}`);
  ok(/^PT\d/.test(lineValue(b, "TRIGGER") || ""), `check: the reminder alarms at the reminder time: ${lineValue(b, "TRIGGER")}`);
  // An occurrence today has no day before it left: counted, not written.
  const today = ICS.calendarExportOf(RICH, "2026-09-22", 90);
  ok(!today.entries.some((e) => e.source === "check") && today.skipped.checks === 1, `check: an occurrence today wrote a reminder or was not counted: ${JSON.stringify(today.skipped)}`);
}

// (o) a milestone yields its due day and its D-7, whose UIDs differ by "-d7"; a done milestone is not written
{
  const out = ICS.buildIcs(RICH, "2026-09-14", { days: 90, now: NOW });
  const byUid = Object.fromEntries(veventsOf(out.text).map((b) => [lineValue(b, "UID"), b]));
  const due = byUid["milestone-ms1@life-manager"] || "";
  const early = byUid["milestone-ms1-d7@life-manager"] || "";
  ok(lineValue(due, "SUMMARY") === "마일스톤 기한 · 챗봇 과제 계약" && lineValue(due, "DTSTART;VALUE=DATE") === "20261015", `milestone: due entry ${lineValue(due, "SUMMARY")}`);
  ok(lineValue(early, "SUMMARY") === "마일스톤 D-7 · 챗봇 과제 계약" && lineValue(early, "DTSTART;VALUE=DATE") === "20261008", `milestone: D-7 entry ${lineValue(early, "SUMMARY")} / ${lineValue(early, "DTSTART;VALUE=DATE")}`);
  ok(out.counts.milestone === 2 && !Object.keys(byUid).some((u) => u.startsWith("milestone-ms3")), `milestone: count ${out.counts.milestone} or a done milestone was written`);
}

// (p) a payment entry names the kind, the client and the contract and never the amount, in any form; a paid line is not written
{
  const out = ICS.buildIcs(RICH, "2026-09-14", { days: 365, now: NOW });
  const pays = veventsOf(out.text).filter((b) => (lineValue(b, "UID") || "").startsWith("payment-"));
  ok(pays.length === 1 && lineValue(pays[0], "UID") === "payment-dl1-p1@life-manager", `payment: ${pays.map((b) => lineValue(b, "UID")).join(",")}`);
  ok(lineValue(pays[0] || "", "SUMMARY") === "입금 예정 · 계약금 · 가나병원 ETL 고도화", `payment: summary ${lineValue(pays[0] || "", "SUMMARY")}`);
  const flat = unfoldIcs(out.text);
  ok(!/1234567|1,234,567|123만|123\.5만|500만/.test(flat), "payment: the file carries an amount");
}

// (q) past-dated follow-ups, milestones, payments and notices are counted as skipped, never written
{
  const past = mkState({ meetings: RICH.meetings, milestones: RICH.milestones,
    deals: [{ id: "dl2", client: "다라", title: "지난 계약", status: "won", payments: [{ id: "p9", kind: "interim", due: "2026-09-02", amount: 10 }] }],
    notices: [{ id: "nt9", title: "지난 공고", agency: "기관", deadline: "2026-09-03", status: "review", documentIds: [] }] });
  const sel = ICS.calendarExportOf(past, "2026-09-14", 90);
  ok(sel.skipped.followups === 1 && sel.skipped.milestones === 1 && sel.skipped.payments === 1 && sel.skipped.notices === 1, `skipped: ${JSON.stringify(sel.skipped)}`);
  ok(!sel.entries.some((e) => /지난/.test(e.summary)), `skipped: a past item was written: ${sel.entries.map((e) => e.summary).join(" | ")}`);
  const nt = ICS.calendarExportOf(RICH, "2026-09-14", 90).entries.filter((e) => e.source === "notice");
  ok(nt.length === 1 && nt[0].summary === "공고 마감 · AI 바우처 · 진흥원" && nt[0].uid === "notice-nt1@life-manager", `notice: ${JSON.stringify(nt.map((e) => e.summary))}`);
}

// (r) a state without any of the v28 keys still builds, with zero counts for the five kinds
{
  const sel = ICS.calendarExportOf({ events: RICH.events.slice(0, 4), tasks: RICH.tasks, goals: RICH.goals }, "2026-09-14", 90);
  ok(["followup", "check", "milestone", "payment", "notice"].every((k) => sel.counts[k] === 0) && sel.entries.length >= 6, `legacy state: ${JSON.stringify(sel.counts)}`);
}
console.log("calendar file: 19 check groups");

// 6) since-mode work packet — `workSinceOf` selects what changed after the last AI work refresh (2026-09-22)
{
  let n = 0;
  const check = (cond, msg) => { n++; ok(cond, `since-mode: ${msg}`); };
  // `meetingTrack` is a three-line expression that grabBlock cannot close on its own; cut it at its first `;`.
  const liftExpr = (name) => { const t = lift(name).split("\n"); return t.slice(0, t.findIndex((l) => /;\s*(\/\/.*)?$/.test(l)) + 1).join("\n"); };
  const SINCE = new Function([
    ...["TRACKS", "PACKET_TRACKS_NO_WORK", "workInAiOf", "packetTracks", "trackOf", "meetingOrder", "docOrder", "isTraining"].map(lift),
    liftExpr("meetingTrack"), lift("workSinceOf"),
  ].join("\n") + "\nreturn { workSinceOf };")();
  const since = "2026-09-15";
  const mt = (id, date, extra = {}) => ({ id, projectId: "P", date, title: id, createdAt: date, progress: [], followUps: [], ...extra });
  const state = {
    meetingProjects: [{ id: "P", name: "사업 프로젝트", track: "biz" }],
    meetings: [
      mt("A", "2026-09-16", { progress: [{ id: "a1", date: "2026-09-16", text: "a" }] }),
      mt("B", "2026-09-10", { createdAt: "2026-09-15" }),
      mt("C", "2026-09-01", { progress: [{ id: "c1", date: "2026-09-14", text: "c1" }, { id: "c2", date: "2026-09-18", text: "c2" }],
        followUps: [{ id: "f1", text: "f1", mine: true, done: false }, { id: "f2", text: "f2", mine: false, done: false }, { id: "f3", text: "f3", mine: true, done: true }] }),
      mt("D", "2026-09-02"),
      mt("E", "2026-09-03", { aiHidden: true, progress: [{ id: "e1", date: "2026-09-18", text: "e" }] }),
      { id: "memo", projectId: null, track: "work", date: "2026-09-17", title: "memo", createdAt: "2026-09-17", progress: [], followUps: [] },
    ],
    documents: [
      { id: "d1", projectId: "P", title: "d1", summary: "s", addedAt: "2026-09-14", track: "biz" },
      { id: "d2", projectId: "P", title: "d2", summary: "s", addedAt: "2026-09-15", track: "biz" },
    ],
    settings: {},
  };
  const sel = SINCE.workSinceOf(state, since);
  check(JSON.stringify(sel.recent.map((m) => m.id)) === '["memo","A","B"]', `recent ${JSON.stringify(sel.recent.map((m) => m.id))}`);
  check(sel.older.length === 1 && sel.older[0].m.id === "C", `older ${JSON.stringify(sel.older.map((o) => o.m.id))}`);
  check(sel.older[0]?.progress.length === 1 && sel.older[0].progress[0].date === "2026-09-18", "older progress is the post-stamp entry only");
  check(sel.older[0]?.followUps.length === 1 && sel.older[0].followUps[0].id === "f1", "older follow-ups are the open mine ones");
  check(JSON.stringify(sel.docs.map((d) => d.id)) === '["d2"]', `docs ${JSON.stringify(sel.docs.map((d) => d.id))}`);
  check(JSON.stringify(sel.counts) === '{"meetings":3,"progress":2,"docs":1}', `counts ${JSON.stringify(sel.counts)}`);
  const off = SINCE.workSinceOf({ ...state, settings: { workInAi: false } }, since);
  check(!off.recent.some((m) => m.id === "memo") && off.counts.meetings === 2, `workInAi false: ${JSON.stringify(off.recent.map((m) => m.id))}`);
  const early = SINCE.workSinceOf(state, "2026-01-01");
  check(early.recent.length === state.meetings.length && early.older.length === 0, `early stamp: recent ${early.recent.length}, older ${early.older.length}`);
  // a training record never enters, recent or older, and adds nothing to the counts (reference only, 2026-09-22)
  const withTraining = { ...state, meetings: [...state.meetings,
    mt("T1", "2026-09-17", { kind: "training" }),
    mt("T2", "2026-09-01", { kind: "training", progress: [{ id: "t1", date: "2026-09-18", text: "t" }], followUps: [{ id: "tf", text: "tf", mine: true, done: false }] })] };
  check(JSON.stringify(SINCE.workSinceOf(withTraining, since)) === JSON.stringify(sel), "training records change nothing");
  console.log(`since-mode packet: ${n} checks`);
}

// 7) check summary — the `확인 필요` notification's three facts and its text, and the service worker's copy of its literals (2026-09-22)
{
  let n = 0;
  const check = (cond, msg) => { n++; ok(cond, `check summary: ${msg}`); };
  const CHECK = new Function([
    ...["dstr", "shiftDay", "daysBetween", "MAX_OCC", "occurrencesOf", "meetingOrder", "byCreated", "workOn", "eventProjectOf",
      "CHECK_MINUTES_DAYS", "CHECK_LIST_MAX", "CHECK_TAG", "CHECK_CACHE", "CHECK_CACHE_REQ", "CHECK_STALE_MS", "OPEN_PARAM_TYPES",
      "checkSummaryOf", "checkNotificationOf"].map(lift),
  ].join("\n") + "\nreturn { checkSummaryOf, checkNotificationOf, CHECK_TAG, CHECK_CACHE, CHECK_CACHE_REQ, CHECK_STALE_MS, OPEN_PARAM_TYPES };")();
  const today = "2026-09-22";
  const sum = (st) => CHECK.checkSummaryOf({ work: [], events: [], meetings: [], meetingProjects: [{ id: "P", name: "프로젝트" }], ...st }, today);
  const text = (st) => CHECK.checkNotificationOf(sum(st));
  const madeToday = { id: "w0", date: today, title: "오늘 것", done: false, createdAt: today };

  // (a) not refreshed: both reasons in order, then one, then none; the AI refresh date is appended as a fact
  check(sum({ act: { briefingSeen: "2026-09-21" } }).notRefreshed === "오늘 만든 업무 없음 · 오늘 읽을 것 안 봄", `both reasons: ${sum({ act: { briefingSeen: "2026-09-21" } }).notRefreshed}`);
  check(sum({ work: [madeToday], act: { briefingSeen: "2026-09-21" } }).notRefreshed === "오늘 읽을 것 안 봄", "a work item created today leaves the reader reason only");
  check(sum({ work: [madeToday], act: { briefingSeen: today } }).notRefreshed === null, "a work item created today and the reader seen today is refreshed");
  const line1 = (text({ act: { briefingSeen: "2026-09-21", workRefreshedAt: "2026-09-20" } })?.body || "").split("\n")[0];
  check(line1 === "오늘 할 일 미갱신 · 오늘 만든 업무 없음 · 오늘 읽을 것 안 봄 · AI 갱신 2026-09-20", `AI refresh suffix: ${line1}`);

  // (b) project appointments without minutes, last 14 days, newest first
  const appt = (id, date, extra = {}) => ({ id, kind: "appt", title: id, date, projectId: "P", ...extra });
  const minutesState = {
    work: [madeToday], act: { briefingSeen: today },
    events: [
      appt("현장 미팅", "2026-09-19"),
      appt("연결된 회의", "2026-09-19"),
      appt("개인 약속", "2026-09-19", { projectId: null }),
      appt("오래된 미팅", "2026-09-06"),
      { id: "마감", kind: "due", title: "마감", date: "2026-09-19", projectId: "P" },
      appt("주간 회의", "2026-09-20", { projectId: null }),
      appt("정기 점검", "2026-09-02", { repeat: { freq: "weekly" } }),
    ],
    meetings: [
      { id: "m1", projectId: "P", title: "연결된 회의", date: "2026-09-19", eventId: "연결된 회의", createdAt: "2026-09-19" },
      { id: "m2", projectId: "P", title: "주간 회의", date: "2026-08-23", createdAt: "2026-08-23" },
    ],
  };
  const mm = sum(minutesState).minutesMissing.map((r) => `${r.date} ${r.title}`);
  check(JSON.stringify(mm) === JSON.stringify(["2026-09-20 주간 회의", "2026-09-19 현장 미팅", "2026-09-16 정기 점검", "2026-09-09 정기 점검"]), `minutes missing: ${JSON.stringify(mm)}`);
  check(!mm.some((r) => r.includes("연결된 회의")), "an occurrence with linked minutes is not listed");
  check(text(minutesState)?.body === "회의록 없는 지난 일정 4건: 9/20 주간 회의 · 9/19 현장 미팅 · 9/16 정기 점검 외 1건", `minutes line: ${text(minutesState)?.body}`);
  const five = { work: [madeToday], act: { briefingSeen: today }, events: [1, 2, 3, 4, 5].map((d) => appt(`일정${d}`, `2026-09-${String(22 - d).padStart(2, "0")}`)) };
  check(/^회의록 없는 지난 일정 5건: 9\/21 일정1 · 9\/20 일정2 · 9\/19 일정3 외 2건$/.test(text(five)?.body || ""), `five rows: ${text(five)?.body}`);

  // (c) carried work in the work tab's order; a done item is not carried
  const w = (id, d, done = false) => ({ id, title: id, date: `2026-09-${String(22 - d).padStart(2, "0")}`, done, createdAt: "2026-09-01" });
  const carriedState = { work: [w("a", 4), w("b", 1), w("c", 2), w("d", 3), w("e", 5, true)], act: { briefingSeen: today } };
  const cs = sum(carriedState);
  check(cs.carried.map((x) => x.title).join(" ") === "a d c b", `carried order: ${cs.carried.map((x) => x.title).join(" ")}`);
  const ct = text(carriedState);
  check(ct?.body.split("\n").pop() === "이월 업무 4건: a · d · c 외 1건", `carried line: ${ct?.body}`);
  check(ct?.title === "인생 관리 — 확인 필요 2가지" && cs.counts.total === 2, `title ${ct?.title}`);
  check(text({ work: [...carriedState.work, madeToday], act: { briefingSeen: today } })?.title === "인생 관리 — 확인 필요 1가지", "one line, one thing");
  check(JSON.stringify(ct?.counts) === '{"notRefreshed":1,"minutes":0,"carried":4}', `counts ${JSON.stringify(ct?.counts)}`);

  // (d) nothing to state → no notification
  const quiet = sum({ work: [madeToday], act: { briefingSeen: today } });
  check(quiet.counts.total === 0 && CHECK.checkNotificationOf(quiet) === null, `empty: total ${quiet.counts.total}`);

  // (e) the service worker repeats the app's literals, keeps the summary cache on activate and never reloads a client
  const sw = require("./gen-sw.js").swSource("x", [], []);
  const swConst = (name) => { const m = sw.match(new RegExp(`const ${name} = (.+);`)); return m ? new Function(`return ${m[1]};`)() : undefined; };
  check(swConst("CHECK_CACHE") === CHECK.CHECK_CACHE && swConst("CHECK_TAG") === CHECK.CHECK_TAG && swConst("CHECK_REQ") === CHECK.CHECK_CACHE_REQ
    && swConst("CHECK_STALE_MS") === CHECK.CHECK_STALE_MS, "the worker's CHECK_* literals equal the app's");
  check((sw.match(/"life-check"/g) || []).length === 2 && sw.includes('"./__check-summary"'), "the worker names the cache and the tag once each");
  check(sw.includes('addEventListener("periodicsync"') && sw.includes('addEventListener("notificationclick"'), "the worker handles periodicsync and notificationclick");
  check(sw.includes("k !== CHECK_CACHE"), "activate keeps the summary cache");
  check(sw.includes('open: "issues"') && sw.includes('"./?open=issues"') && CHECK.OPEN_PARAM_TYPES.includes("issues"), "a tap names the issue list, which the app routes");
  check(!sw.includes("location.reload") && !sw.includes("controllerchange") && !/\.navigate\(/.test(sw), "the worker reloads no client");
  console.log(`check summary: ${n} checks`);
}

// 8) training records and the issue list — the `교육` labels, `lastMeetingOf` (a training record is never a project's
// last meeting while a meeting-kind record exists) and `issueListOf`'s four sections (2026-09-22); a training record is
// reference only, so its stored follow-ups reach neither `할 일` nor a marker (`followUpsOf`). The goal tasks come
// from `agendaOf` directly, so `todoOf` (and its business helpers) need not be lifted. `demoState` is not lifted (it
// calls `uid`/`dstr` and spans the whole seed); the E2E covers the demo.
{
  let n = 0;
  const check = (cond, msg) => { n++; ok(cond, `issue list: ${msg}`); };
  const liftExpr = (name) => { const t = lift(name).split("\n"); return t.slice(0, t.findIndex((l) => /;\s*(\/\/.*)?$/.test(l)) + 1).join("\n"); };
  const ISSUE = new Function([
    ...["dstr", "shiftDay", "daysBetween", "mondayOf", "MAX_OCC", "occurrencesOf", "eventsOn", "upcomingEvents", "EVENT_KIND_LABEL",
      "TRACKS", "TRACK_LABEL", "trackOf", "meetingOrder", "MEETING_KIND", "isTraining", "followUpsOf", "MEETING_FIELD_LABEL", "meetingLabels",
      "kindPrefix", "lastMeetingOf", "oneLineText", "byCreated", "workOn", "agendaOf", "TODO_GROUPS",
      "ISSUE_WORK_ROWS", "ISSUE_EVENT_DAYS", "ISSUE_EVENT_ROWS", "ISSUE_TRAINING_ROWS", "ISSUE_PREV_MEETINGS", "ISSUE_FOLLOWUPS",
      "ISSUE_DECISION_CLIP", "ISSUE_SUMMARY_CLIP", "ISSUE_LEARNED_CLIP", "ISSUE_PROJECT_TRACKS"].map(lift),
    liftExpr("meetingTrack"), lift("issueListOf"),
  ].join("\n") + "\nreturn { meetingLabels, lastMeetingOf, issueListOf, MEETING_FIELD_LABEL };")();
  const today = "2026-09-22";

  // (a) labels: absent and "meeting" read as a meeting; "training" relabels
  check(ISSUE.meetingLabels({}) === ISSUE.MEETING_FIELD_LABEL.meeting && ISSUE.meetingLabels({ kind: "meeting" }) === ISSUE.MEETING_FIELD_LABEL.meeting, "absent and meeting kinds read the meeting labels");
  const tl = ISSUE.meetingLabels({ kind: "training" });
  check(tl.summary === "배운 것" && tl.decisions === "핵심 정리" && tl.actions === "기억할 점" && tl.packetActions === "기억할 점" && tl.attendees === "강사·주최", `training labels ${JSON.stringify(tl)}`);

  // (b) lastMeetingOf: a newer training record never displaces a meeting; alone, the newest training record stands in
  const rec = (id, projectId, date, extra = {}) => ({ id, projectId, date, title: id, summary: `${id} 요약`, createdAt: date, taskIds: [], progress: [], followUps: [], ...extra });
  const mixed = [rec("m1", "P", "2026-09-10"), rec("t1", "P", "2026-09-20", { kind: "training" }), rec("m0", "P", "2026-09-01")];
  check(ISSUE.lastMeetingOf(mixed, "P")?.id === "m1", `a newer training record is not the last meeting: ${ISSUE.lastMeetingOf(mixed, "P")?.id}`);
  const trainingOnly = [rec("t1", "P", "2026-09-20", { kind: "training" }), rec("t2", "P", "2026-09-21", { kind: "training" })];
  check(ISSUE.lastMeetingOf(trainingOnly, "P")?.id === "t2" && ISSUE.lastMeetingOf([], "P") === null, "training-only → the newest training record; none → null");

  // (c) an empty save: four sections in order, all empty
  const empty = ISSUE.issueListOf({}, today);
  check(empty.sections.map((s) => s.key).join(",") === "todo,events,training,projects" && empty.sections.every((s) => s.empty),
    `empty save: ${JSON.stringify(empty.sections.map((s) => [s.key, s.empty]))}`);

  // (d) a fixture with every row kind
  const state = {
    meetingProjects: [{ id: "B", name: "사업 프로젝트", track: "biz", createdAt: "2026-09-01" }, { id: "W", name: "직장 프로젝트", track: "work", createdAt: "2026-09-01" }],
    meetings: [
      rec("biz-meet", "B", "2026-09-15", { followUps: [{ id: "f1", text: "견적 회신", mine: true, done: false }] }),
      rec("job-meet", "W", "2026-09-18", { decisions: "기준 확정", followUps: [{ id: "f2", text: "타인 할 일", mine: false, done: false }] }),
      rec("job-train", "W", "2026-09-20", { kind: "training", summary: "지표 6종\n두 번째 줄", followUps: [{ id: "f3", text: "지표 표 추가", mine: true, due: "2026-09-25", done: false }] }),
      rec("job-old", "W", "2026-09-05"),
      rec("memo", null, "2026-09-21", { track: "biz" }),
    ],
    work: [
      { id: "w1", date: "2026-09-20", title: "이월 업무", done: false, createdAt: "2026-09-20", track: "work" },
      { id: "w2", date: today, title: "오늘 업무", done: false, createdAt: today, track: "work" },
    ],
    events: [
      { id: "e1", kind: "appt", title: "점검", date: "2026-09-23", time: "10:00", checks: [{ id: "c1", text: "a", done: true }, { id: "c2", text: "b", done: false }] },
      { id: "e2", kind: "due", title: "제출", date: "2026-09-25" },
    ],
    tasks: [],
  };
  const il = ISSUE.issueListOf(state, today);
  const sec = (k) => il.sections.find((s) => s.key === k);
  const todo = sec("todo");
  check(todo.groups.map((g) => g.track).join(",") === "work,biz", `todo groups ${todo.groups.map((g) => g.label).join(",")}`);
  const jobRows = todo.groups.find((g) => g.track === "work").rows;
  check(jobRows[0].lead === "이월 2일" && jobRows[0].id === "w1" && jobRows[1].lead === "오늘", `the carried item leads the day-job group: ${JSON.stringify(jobRows.map((r) => r.lead))}`);
  check(todo.groups.find((g) => g.track === "biz").rows.some((r) => r.kind === "followUp" && r.text === "biz-meet · 견적 회신" && r.lead === "후속"), "follow-up rows carry `{meeting} · {text}`");
  check(!jobRows.some((r) => r.kind === "followUp") && jobRows.length === 2, `a training record's stored mine follow-up is no to-do: ${JSON.stringify(jobRows.map((r) => r.text))}`);
  const ev = sec("events");
  check(ev.rows.length === 2 && ev.rows[0].marker === "확인할 것 1/2" && ev.rows[0].lead === "09/23 10:00" && ev.rows[1].text === "마감 · 제출", `events ${JSON.stringify(ev.rows.map((r) => [r.lead, r.text, r.marker]))}`);
  const tr = sec("training");
  check(tr.rows.length === 1 && tr.rows[0].text === "job-train · 직장 프로젝트" && tr.rows[0].sub === "지표 6종", `training ${JSON.stringify(tr.rows)}`);
  const pg = sec("projects").groups;
  check(pg.map((g) => g.track).join(",") === "biz,work,", `project groups ${JSON.stringify(pg.map((g) => g.track))}`);
  const job = pg.find((g) => g.track === "work").rows[0];
  check(job.latest.meetingId === "job-meet" && job.latest.decisions === "기준 확정", `the day-job project's latest is the meeting, not the newer training record: ${job.latest.meetingId}`);
  check(job.previous.map((x) => x.title).join("|") === "교육 · job-train|job-old", `previous rows ${JSON.stringify(job.previous.map((x) => x.title))}`);
  check(job.previous[0].followUpsText === "", `a training row states no follow-up marker: ${job.previous[0].followUpsText}`);
  // a training record standing in for a project without meetings lends no follow-up lines
  const standIn = ISSUE.issueListOf({ ...state, meetings: state.meetings.filter((m) => m.id !== "job-meet" && m.id !== "job-old") }, today);
  const lone = standIn.sections.find((s) => s.key === "projects").groups.find((g) => g.track === "work").rows[0].latest;
  check(lone.meetingId === "job-train" && lone.marker === "" && lone.followUps.length === 0 && lone.followUpMore === 0, `training stand-in ${JSON.stringify(lone)}`);
  const memoGroup = pg[pg.length - 1];
  check(memoGroup.track === null && memoGroup.rows[0].latest.meetingId === "memo" && memoGroup.rows[0].previous.length === 0, "the memo group is last with no previous rows");
  console.log(`issue list: ${n} checks`);
}

console.log(fail ? `smoke: ${fail} failure(s)` : "smoke: all checks passed");
process.exit(fail ? 1 : 0);
