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

// 5) calendar file — the RFC 5545 builder, lifted from the app source and run without a browser
const ICS_NAMES = [
  "dstr", "shiftDay", "daysBetween", "EVENT_KIND_LABEL", "EVENT_HORIZON_DAYS", "MAX_OCC", "occurrencesOf",
  "ICS_RANGE_DAYS", "ICS_REMIND_DEFAULT", "ICS_APPT_LEAD_MIN", "ICS_APPT_MINUTES", "ICS_DIGEST_MINUTES", "ICS_LINE_OCTETS",
  "ICS_SEQ_EPOCH", "ICS_UID_HOST", "icsText", "icsFold", "icsDate", "icsLocal", "icsAddMinutes", "icsUtcStamp", "icsDuration",
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

// (g) privacy by construction: the builder reads events, tasks and goals only — never the profile, the business
// lists, the journal, the reviews, or an event's place and note (every one of these throws when read)
{
  const trap = (obj, keys) => { for (const k of keys) Object.defineProperty(obj, k, { enumerable: true, get() { throw new Error(`read ${k}`); } }); return obj; };
  // Every event branch is exercised: one-off, a rule with exceptions, and a day-31 monthly expansion.
  const repeats = [
    mkEvent({ id: "wk", title: "주간", date: "2026-09-15", time: "20:00", repeat: { freq: "weekly" }, skip: ["2026-09-22"] }),
    mkEvent({ id: "mo", title: "월말", kind: "due", date: "2026-01-31", repeat: { freq: "monthly" } }),
  ];
  const trapped = trap(mkState({ events: [...RICH.events, ...repeats].map((e) => trap({ ...e }, ["place", "note"])), tasks: RICH.tasks, goals: RICH.goals }),
    ["profile", "deals", "rates", "folio", "journal", "reviews"]);
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
console.log("calendar file: 12 check groups");

console.log(fail ? `smoke: ${fail} failure(s)` : "smoke: all checks passed");
process.exit(fail ? 1 : 0);
