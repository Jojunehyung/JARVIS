// Full real-usage flow — required and run by run.js (helpers are injected as arguments)
module.exports = async (h) => {
  const { step, shot, clickText, clickExact, clickInModal, clickInModalExact, clickTab, modalError, hasText, expectText, typeInto, typeExact, setValue, completeQuest, closeModal, sleep, page, errors } = h;

  // Fill and submit one CV add form — the education and career forms share their shape, so they share this.
  // The chips are clicked by exact label: a chip row can hold a longer label that contains a shorter one.
  const addCvEntry = async ({ main, sub, chips, from, to, add }) => {
    await typeInto(main[0], main[1]);
    await typeInto(sub[0], sub[1]);
    for (const c of chips) await clickExact(c);
    await setValue('input[type="month"]', from, 0);
    await setValue('input[type="month"]', to, 1);
    await clickText(add);
    await sleep(250);
  };

  // ── Onboarding, 6 steps
  await step("onboarding start", async () => { await clickText("시작하기"); await expectText("1 / 6"); });
  await step("step 1 — basic info", async () => {
    // Exact placeholder match: the school-name field of the education form carries the same word.
    await typeExact("이름", "E2E테스터");
    await typeInto("닉네임", "E2E닉");
    await setValue('input[type="date"]', "1998-05-14"); // onboarding is not inside .fixed.inset-0, so unscoped
    for (const t of ["남성", "취업 준비"]) { try { await clickText(t); } catch { errors.push(`선택 실패: ${t}`); } }
  });
  await step("step 1 — education entry", async () => {
    await addCvEntry({
      main: ["학교 이름", "E2E대학교"], sub: ["전공·학과", "기계공학"],
      chips: ["학사", "졸업", "공학"], from: "2017-03", to: "2023-02", add: "학력 추가",
    });
    await expectText("E2E대학교");
    await expectText("2017-03 ~ 2023-02");
    await clickText("다음"); await expectText("2 / 6");
  });
  await step("step 2 — appearance", async () => { await clickText("무작위"); await clickText("다음"); await expectText("3 / 6"); });
  await step("step 3 — areas and knowledge directions", async () => {
    for (const t of ["기본지식", "커리어"]) { try { await clickText(t); } catch {} }
    for (const d of ["IT·개발", "데이터·AI"]) { try { await clickText(d); } catch {} }
    await clickText("다음"); await expectText("4 / 6");
  });
  await step("step 4 — certification search (1,011 rows)", async () => {
    await typeInto("자격증 검색", "정보처리기사");
    await sleep(250);
    await expectText("정보처리기사");
    // Scoped to buttons: the search input's own value carries the same text, and an unscoped click landed on the
    // input, so until 2026-09-15 no certification was ever declared in this save.
    await clickText("정보처리기사", "button");
    await expectText("(1개 선택)");
    await clickText("다음"); await expectText("5 / 6");
  });
  await step("step 5 — career entry", async () => {
    await expectText("경력·경험");
    await addCvEntry({
      main: ["회사·조직 이름", "E2E전장"], sub: ["직책·직무", "설계 엔지니어"],
      chips: ["정규·계약"], from: "2022-01", to: "2024-02", add: "경력 추가",
    });
    await expectText("E2E전장");
    // 26 months of practice, read straight out of the CAREER_OPTS bands — the derived line, not a stored value
    await expectText("합산 실무 2년 2개월 · 시작 등급 기준 실무 1~3년");
  });
  await step("step 5 — experience and outputs", async () => {
    for (const t of ["경험 없음", "개인 프로젝트 있음"]) { try { await clickText(t); } catch { errors.push(`선택 실패: ${t}`); } }
    await clickText("다음"); await expectText("6 / 6");
  });
  await step("step 6 — computed result → start", async () => {
    await expectText("학력 학사 졸 · 경력 실무 1~3년"); // the two derived keys, in the frozen tables' own labels
    await clickText("이 설정으로 시작"); await sleep(600); await expectText("영역 등급");
  });
  await shot("home");
  await step("fresh state schema version and CV records", async () => {
    const st = await page.evaluate(() => { try { return JSON.parse(localStorage.getItem("liferpg-state-v1")); } catch { return null; } });
    if (st?.v !== 21) throw new Error("fresh save schema v" + st?.v + " (expected 21)");
    const p = st.profile || {};
    if (p.name !== "E2E테스터" || p.nick !== "E2E닉" || p.birth !== "1998-05-14") throw new Error("personal facts not stored: " + JSON.stringify({ name: p.name, nick: p.nick, birth: p.birth }));
    const e0 = (p.edus || [])[0] || {};
    if (e0.school !== "E2E대학교" || e0.major !== "기계공학" || e0.degree !== "ba" || e0.status !== "grad" || e0.from !== "2017-03" || e0.to !== "2023-02") throw new Error("education record not stored: " + JSON.stringify(p.edus));
    const c0 = (p.careers || [])[0] || {};
    if (c0.company !== "E2E전장" || c0.role !== "설계 엔지니어" || c0.emp !== "full" || c0.from !== "2022-01" || c0.to !== "2024-02") throw new Error("career record not stored: " + JSON.stringify(p.careers));
    if (JSON.stringify(p.certs) !== JSON.stringify(["정보처리기사"])) throw new Error("the certification declared in step 4 was not stored: " + JSON.stringify(p.certs));
    // The keys the frozen tables are read with — derived once here, never again (rules 4, 11).
    if (p.edu !== "ba" || p.career !== "y13") throw new Error("starting-grade keys: " + JSON.stringify({ edu: p.edu, career: p.career }));
  });

  // ── Profile screen — the only way to see or change the CV after onboarding
  await step("profile modal — opens from the home card and lists the CV", async () => {
    await clickTab("홈");
    if (await hasText("업로드")) throw new Error("the home card still carries its own photo button");
    await clickText("프로필"); await sleep(400);
    // Everything typed at onboarding comes back, in both record sections
    for (const t of ["E2E대학교", "기계공학", "E2E전장", "설계 엔지니어"]) await expectText(t);
    await expectText("합산 실무 2년 2개월");
    await expectText("보유 기록");
    await expectText("여기서는 고칠 수 없어요 — 자격·시험은 목표의 핵심결과에서, 포트폴리오는 사업 탭에서 관리해요.");
    await expectText("학력·경력을 고쳐도 시작 등급은 바뀌지 않아요. 승급은 관문 증거로만 올라가요.");
    // Typed text must be legible on the dark field. On Android the rendered colour of autofilled and date/month
    // text comes from `-webkit-text-fill-color` and the page's colour scheme, not from `color` — both black
    // until 2026-09-14, which left the profile fields unreadable on a phone.
    const ink = await page.evaluate(() => {
      const light = (c) => { const m = (c || "").match(/\d+/g); return !!m && m.slice(0, 3).every((v) => Number(v) >= 200); };
      const fields = [...document.querySelectorAll('.fixed.inset-0 input:not([type="file"])')];
      const bad = fields.filter((i) => !light(getComputedStyle(i).webkitTextFillColor) || !light(getComputedStyle(i).color))
        .map((i) => `${i.type}:${i.placeholder || ""}=${getComputedStyle(i).webkitTextFillColor}`);
      const hint = fields.find((i) => i.placeholder);
      return {
        scheme: getComputedStyle(document.documentElement).colorScheme,
        count: fields.length, bad,
        hintIsDimmer: hint ? !light(getComputedStyle(hint, "::placeholder").webkitTextFillColor) : null,
      };
    });
    if (ink.scheme !== "dark") throw new Error("the page does not declare a dark colour scheme: " + ink.scheme);
    if (!ink.count) throw new Error("no profile input to check");
    if (ink.bad.length) throw new Error("profile inputs render dark text on the dark field: " + ink.bad.join(" | "));
    if (ink.hintIsDimmer !== true) throw new Error("placeholder hints render as light as typed text, so an empty field looks filled");
  });
  await step("profile modal — validation", async () => {
    await setValue('.fixed.inset-0 input[placeholder="이름"]', "");
    await clickInModalExact("저장");
    const noName = await modalError();
    if (!noName.includes("이름을 입력해 주세요.")) throw new Error("a profile without a name was accepted: " + noName);
    await typeExact("이름", "E2E테스터");
    await typeExact("이메일 (선택)", "not-an-address");
    await clickInModalExact("저장");
    const badMail = await modalError();
    if (!badMail.includes("이메일 형식이 올바르지 않아요.")) throw new Error("a malformed e-mail was accepted: " + badMail);
    // Real contact values from here on: flow8 asserts the packet carries neither of them
    await typeExact("이메일 (선택)", "e2e@example.com");
    await typeExact("연락처 (선택)", "010-1234-5678");
    // An education entry whose end month precedes its start month — the add form refuses it
    await typeInto("학교 이름", "E2E역순대학교");
    for (const c of ["석사", "졸업"]) await clickExact(c);
    await setValue('input[type="month"]', "2020-03", 0);
    await setValue('input[type="month"]', "2019-02", 1);
    await clickText("학력 추가"); await sleep(250);
    const backwards = await modalError();
    if (!backwards.includes("졸업 연월이 입학 연월보다 앞서요.")) throw new Error("an end month before its start month was accepted: " + backwards);
    // An input value is not part of innerText, so this can only match an entry row the form added
    if (await hasText("E2E역순대학교")) throw new Error("the rejected education entry was added to the list anyway");
  });
  // The load-bearing step: the CV is a record, the starting grade is a one-time snapshot (rules 4, 11).
  await step("profile modal — a CV edit never moves a grade", async () => {
    const read = () => page.evaluate(() => {
      const s = JSON.parse(localStorage.getItem("liferpg-state-v1"));
      return {
        grades: (s.areas || []).map((a) => `${a.name}:${a.grade}`).join(" · "),
        edu: s.profile.edu, career: s.profile.career, edus: (s.profile.edus || []).length,
        contact: `${s.profile.email}/${s.profile.phone}`,
      };
    });
    const before = await read();
    if (!before.grades) throw new Error("no area grades to compare");
    await addCvEntry({
      main: ["학교 이름", "E2E대학원"], sub: ["전공·학과", "기계공학"],
      chips: ["박사", "졸업"], from: "2023-03", to: "2026-02", add: "학력 추가",
    });
    await expectText("E2E대학원");
    await clickInModalExact("저장"); await sleep(500);
    await expectText("프로필을 저장했어요");
    await sleep(900);
    const after = await read();
    if (after.edus !== before.edus + 1) throw new Error(`the doctorate was not stored: ${before.edus} -> ${after.edus}`);
    if (after.contact !== "e2e@example.com/010-1234-5678") throw new Error("the contact fields were not stored: " + after.contact);
    if (after.grades !== before.grades) throw new Error(`a CV edit moved an area grade: ${before.grades} -> ${after.grades}`);
    if (after.edu !== before.edu) throw new Error(`a CV edit rewrote profile.edu: ${before.edu} -> ${after.edu}`);
    if (after.career !== before.career) throw new Error(`a CV edit rewrote profile.career: ${before.career} -> ${after.career}`);
  });

  // ── Goal (OKR) creation — metric, count and cert KRs
  await step("goals tab → new goal modal", async () => {
    await clickTab("목표");
    await clickText("새 목표"); await sleep(350);
    await expectText("새 목표");
  });
  await step("goal title and note input", async () => {
    await typeInto("목표 —", "하네스 설계 엔지니어 취업");
    await typeInto("메모", "E2E 검증용 목표");
  });
  await step("KR 1 — add count KR", async () => {
    await clickText("횟수");
    await typeInto("행동 —", "설계 실습");
    await typeInto("횟수", "10");
    await clickText("이 핵심결과 추가"); await sleep(200);
  });
  await step("KR 2 — add cert KR (1,011-row search)", async () => {
    await clickText("자격");
    await typeInto("자격증 검색 —", "전기기사");
    await sleep(300);
    await clickText("전기기사"); await sleep(150);
    await clickText("이 핵심결과 추가"); await sleep(200);
  });
  await step("KR 3 — add metric KR", async () => {
    await clickText("수치");
    await typeInto("지표명", "설계 산출물 수");
    await typeExact("시작", "0"); await typeExact("목표", "5"); await typeExact("단위", "건");
    await clickText("이 핵심결과 추가"); await sleep(200);
  });
  await step("create goal", async () => { await clickText("목표 만들기"); await sleep(500); await expectText("하네스 설계 엔지니어 취업"); });
  await shot("goal-created");

  // ── Register a task through the KR bridge
  await step("KR bridge — open task modal", async () => {
    await clickText("실행 연결"); await sleep(400);
  });
  await step("register daily task", async () => {
    try { await clickText("일일 실행"); } catch {}
    await sleep(200);
    await clickInModal("채우기 ›"); // count KR → the one path that registers a task without an activity kind
    await typeInto("무엇을 하나요", "설계 실습 1시간");
    for (const t of ["등록", "추가", "만들기"]) { try { await clickText(t); break; } catch {} }
    await sleep(1600); // until the toast disappears
    const e = await modalError();
    if (e) throw new Error("count-KR task refused: " + e);
    await closeModal();
  });
  await shot("quest-added");

  // ── Tasks tab — completion and catalogue
  await step("go to tasks tab", async () => { await clickTab("실행"); await expectText("실행 — 시간순 할 일"); });
  await step("complete daily task (goal progress delta)", async () => {
    const before = await page.evaluate(() => document.body.innerText);
    await completeQuest("설계 실습 1시간");
    const after = await page.evaluate(() => document.body.innerText);
    if (before === after) errors.push("no visible change after completing the task (check)");
  });
  await step("open achievement catalogue (1,011 rows)", async () => { await clickText("도감"); await sleep(400); await expectText("성취 도감"); });
  await step("catalogue category switch — education/welfare/counselling", async () => {
    try { await clickText("교육·복지·상담"); } catch { errors.push("신설 카테고리 버튼 없음"); }
    await sleep(300);
  });
  await step("catalogue search response", async () => {
    const t0 = Date.now();
    await typeInto("자격증 검색", "간호");
    await sleep(350);
    h.metrics.catalogSearchMs = Date.now() - t0;
    await expectText("간호");
  });
  await shot("catalog");
  await step("close catalogue", async () => { await page.keyboard.press("Escape"); await sleep(200); await h.closeModal(); });

  // ── Home CV — the records, the grade rows and the promotion gate, the settings sheet
  // Home is exactly two blocks: the CV and the proximity line. Every count is compared with the save it states.
  await step("home is one CV with the proximity line under it", async () => {
    await clickTab("홈");
    const res = await page.evaluate(() => {
      const norm = (t) => (t || "").replace(/\s+/g, " ").trim();
      const main = document.querySelector("main");
      const kids = main ? [...main.children] : [];
      const last = kids[kids.length - 1];
      const s = JSON.parse(localStorage.getItem("liferpg-state-v1"));
      return {
        count: kids.length, cv: norm(kids[0]?.innerText), lastTag: last?.tagName || "", last: norm(last?.innerText), all: norm(main?.innerText),
        settings: !!document.querySelector('main button[aria-label="설정"]'),
        areas: (s.areas || []).map((a) => a.name), folio: (s.folio || []).length, trophies: (s.room?.trophies || []).length,
        achievements: (s.areas || []).reduce((n, a) => n + (a.achievements || []).length, 0),
      };
    });
    if (res.count !== 2) throw new Error(`home has ${res.count} top-level blocks, expected the CV and the proximity line: ` + res.all.slice(0, 200));
    const want = ["영역 등급", "학력", "경력", "자격", "시험", "포트폴리오", "성취", "프로필", ...res.areas,
      `포트폴리오 ${res.folio}건`, `트로피 ${res.trophies}개 · 검증된 성취 ${res.achievements}건`];
    for (const t of want) if (!res.cv.includes(t)) throw new Error(`the CV does not state "${t}": ` + res.cv);
    if (!res.settings) throw new Error("the CV carries no settings button");
    if (res.lastTag !== "P" || res.last !== "롤모델 미설정 — 근접도 계산 대상 없음") throw new Error(`the block under the CV is a ${res.lastTag} reading: ${res.last}`);
    for (const t of ["오늘 브리핑", "오늘의 초점", "오늘 할 일", "브리핑 열기", "일지 쓰기", "주간 리뷰", "건 완료"]) {
      if (res.all.includes(t)) throw new Error(`home still carries a removed today surface ("${t}"): ` + res.all.slice(0, 200));
    }
  });
  await step("open promotion gate modal", async () => {
    await clickTab("홈");
    // The CV grade row is the control: nothing else on home promotes, so the gate modal is the only way up.
    if (!(await h.openAreaGate())) errors.push("no area row to open the promotion gate");
    await expectText("승급 심사");
    await h.closeModal();
  });
  await step("the settings button holds role model, backup and reset", async () => {
    await h.openSettings();
    const sheet = await h.overlayText();
    for (const t of ["롤모델 설정", "백업 내보내기", "백업 불러오기", "데이터 초기화", "기록은 이 기기에만 있어요."]) {
      if (!sheet.includes(t)) throw new Error(`the settings sheet does not offer "${t}": ` + sheet.slice(0, 200));
    }
    // The import button drives the input mounted on the app shell, so the sheet must not declare one of its own.
    if (await page.$('.fixed.inset-0 input[type="file"]')) throw new Error("the settings sheet declared a file input of its own");
    await clickInModal("롤모델");
    if (!(await h.overlayText()).includes("요구 등급")) throw new Error("the role model button did not open the role model form");
    await closeModal();
  });
  await shot("home-cv");

  // ── Tab sweep + persistence
  for (const tab of ["홈", "실행", "목표"]) {
    await step(`switch tab: ${tab}`, async () => { await clickTab(tab); });
  }
  await step("bottom nav order (home, goals, tasks, schedule, business)", async () => {
    const nav = await page.evaluate(() => ({
      labels: [...document.querySelectorAll("nav button")].map((b) => (b.innerText || "").trim()),
      cls: document.querySelector("nav")?.className || "",
    }));
    const want = ["홈", "목표", "실행", "일정", "사업"];
    if (nav.labels.join("·") !== want.join("·")) throw new Error("nav order: " + nav.labels.join("·"));
    if (!nav.cls.includes("grid-cols-5")) throw new Error("the nav bar is not a five-column grid: " + nav.cls);
  });
  await step("state persists after reload", async () => {
    const before = await page.evaluate(() => localStorage.length);
    await h.reload();
    await sleep(600);
    const after = await page.evaluate(() => localStorage.length);
    if (!before || after !== before) throw new Error(`localStorage key ${before} → ${after}`);
    if (await hasText("시작하기")) throw new Error("온보딩으로 되돌아감(상태 유실)");
    // Home no longer lists goal titles; the goal card is where a reloaded goal shows up.
    await clickTab("목표");
    await expectText("하네스 설계 엔지니어 취업");
  });
  await shot("after-reload");
  // Without a role model, home states the fact as an inert line; the briefing's next-step line is the one that
  // acts on it, so it must open the role model form rather than land on that line.
  await step("the no-role briefing line opens the role model form", async () => {
    await clickTab("실행");
    await clickText("브리핑 열기");
    await sleep(400);
    await clickInModal("롤모델 미설정");
    if (!(await h.overlayText()).includes("요구 등급")) throw new Error("the no-role next-step line did not open the role model form");
    await closeModal();
  });

  // ── Deep flows (evidence, study, activities, promotion, role model, migration)
  await require("./flow2.js")(h);

  await require("./flow3.js")(h);
  await require("./flow5.js")(h);
  await require("./flow7.js")(h);
  await require("./flow8.js")(h);
  await require("./flow9.js")(h);
  await require("./flow4.js")(h);
  await require("./flow6.js")(h);

  // ── Demo data path (separate session)
  await step("enter demo data", async () => {
    await page.evaluate(() => localStorage.clear());
    await h.reload();
    await sleep(500);
    await clickText("데모 데이터로 둘러보기");
    await sleep(700);
    await expectText("영역 등급");
  });
  // A stagnant-area line lands on home, where the area's grade row and its gate live. The demo's `건강` area has no
  // achievement at all, so its line exists whatever the date.
  await step("a briefing area line lands on the home CV", async () => {
    await clickTab("실행");
    await clickText("브리핑 열기");
    await sleep(400);
    await clickInModal("최근 30일 성취 기록 0건");
    const res = await page.evaluate(() => ({
      open: document.querySelectorAll(".fixed.inset-0").length,
      tab: [...document.querySelectorAll("nav button")].filter((b) => /text-cyan-300/.test(b.className)).map((b) => (b.innerText || "").trim()).join("·"),
      grades: (document.querySelector("main")?.innerText || "").includes("영역 등급"),
    }));
    if (res.open) throw new Error(`${res.open} overlay(s) still open after the area line was tapped`);
    if (res.tab !== "홈") throw new Error("the area line left the app on the tab: " + (res.tab || "none"));
    if (!res.grades) throw new Error("home does not show the grade rows after the area line was tapped");
  });
  await step("demo — sweep every tab", async () => {
    for (const tab of ["실행", "목표", "일정", "사업", "홈"]) { await clickTab(tab); }
  });
  await shot("demo");

  // ── Data reset — state and evidence photo keys must be cleared together (runs last)
  await step("data reset from settings — clears the photo keys and leaves no modal behind", async () => {
    // plant image keys as reset targets (same key convention the app uses)
    await page.evaluate(() => {
      localStorage.setItem("liferpg-img-ev-zzz", "data:image/png;base64,AAAA");
      localStorage.setItem("liferpg-img-profile", "data:image/png;base64,AAAA");
    });
    await h.openSettings();
    // Scoped to the open sheet: the reset button exists nowhere else.
    const clicked = await page.evaluate(() => {
      const ov = [...document.querySelectorAll(".fixed.inset-0")].pop();
      const b = ov && [...ov.querySelectorAll("button")].find((x) => x.innerText.includes("데이터 초기화"));
      if (!b) return false; b.scrollIntoView({ block: "center" }); b.click(); return true;
    });
    if (!clicked) throw new Error("data reset button not found");
    await sleep(900);
    if (!(await hasText("시작하기"))) throw new Error("초기화 후 온보딩으로 가지 않음");
    const left = await page.evaluate(() => ({
      state: localStorage.getItem("liferpg-state-v1"),
      profileImg: localStorage.getItem("liferpg-img-profile"),
    }));
    if (left.state) throw new Error("state key remains after reset");
    if (left.profileImg) throw new Error("profile photo key remains after reset");
    // `resetAll` never clears the modal slot: without closing the sheet first it would reappear over the app on
    // the next onboarding or demo entry.
    await clickText("데모 데이터로 둘러보기");
    await sleep(700);
    const open = await page.evaluate(() => document.querySelectorAll(".fixed.inset-0").length);
    if (open) throw new Error("a modal survived the reset");
  });
  await shot("reset");
};
