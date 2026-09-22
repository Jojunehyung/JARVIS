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
  "icsUid", "calendarExportOf", "buildIcs",
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
console.log("calendar file: 18 check groups");

// 6) since-mode work packet — `workSinceOf` selects what changed after the last AI work refresh (2026-09-22)
{
  let n = 0;
  const check = (cond, msg) => { n++; ok(cond, `since-mode: ${msg}`); };
  // `meetingTrack` is a three-line expression that grabBlock cannot close on its own; cut it at its first `;`.
  const liftExpr = (name) => { const t = lift(name).split("\n"); return t.slice(0, t.findIndex((l) => /;\s*(\/\/.*)?$/.test(l)) + 1).join("\n"); };
  const SINCE = new Function([
    ...["TRACKS", "PACKET_TRACKS_NO_WORK", "workInAiOf", "packetTracks", "trackOf", "meetingOrder", "docOrder"].map(lift),
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
  console.log(`since-mode packet: ${n} checks`);
}

console.log(fail ? `smoke: ${fail} failure(s)` : "smoke: all checks passed");
process.exit(fail ? 1 : 0);
