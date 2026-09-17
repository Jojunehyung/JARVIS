// Business tab — period contracts, unit prices and the portfolio. A business record is a record, never a
// task: these steps assert that registering a contract and ticking a payment change `deals` only, and never
// the tasks, the goals, the streak or the trophies. They also prove the portfolio image path: a landscape
// source keeps its aspect in the stored thumbnail and its key disappears with the record.
module.exports = async (h) => {
  const { step, clickTab, clickText, clickExact, clickInModal, clickInModalExact, expectText, hasText, rows, todoRows, overlayText, typeInto, setValue, closeModal, modalError, sleep, page, errors } = h;

  // A 24 × 8 RGB PNG: wider than it is tall and far under the 640 px long edge, so the stored thumbnail
  // proves both that the aspect survives and that a small source is never upscaled.
  const WIDE_PNG = "iVBORw0KGgoAAAANSUhEUgAAABgAAAAICAIAAABsw6g0AAABNklEQVR4nAXBkQKAAAxAwXEcj+N4HMfjOB7H8TiOx/Hjcdx3dCciDMIoqDAJs2DCIqyCC5uwCyEcwimkcAm3UMIjILTwCp8gogzKqKgyKbNiyqKsiiubsiuhHMqppHIpt1LKo6C08iqfImIMxmioMRmzYcZirIYbm7EbYRzGaaRxGbdRxmNgtPEanyHiDM7oqDM5s2PO4qyOO5uzO+Eczumkczm3U87j4LTzOp8jEgzBGGgwBXNgwRKsgQdbsAcRHMEZZHAFd1DBExB08AZfIJIMyZhoMiVzYsmSrIknW7InkRzJmWRyJXdSyZOQdPImXyJSDMVYaDEVc2HFUqyFF1uxF1EcxVlkcRV3UcVTUHTxFl8h0gzN2GgzNXNjzdKsjTdbszfRHM3ZZHM1d1PN09B08zZf8wM8FzsQNTr4QAAAAABJRU5ErkJggg==";

  const readState = () => page.evaluate(() => { try { return JSON.parse(localStorage.getItem("liferpg-state-v1")); } catch { return null; } });
  // Months are computed in the page with the app's own local-date logic (never toISOString).
  const monthIn = (delta) => page.evaluate((d) => {
    const t = new Date(); t.setHours(12, 0, 0, 0); t.setDate(1); t.setMonth(t.getMonth() + d);
    return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}`;
  }, delta);
  // The two header summary lines, whitespace-normalised so a line break inside one cannot fail the compare.
  const headerLines = () => page.evaluate(() => [...document.querySelectorAll("p")]
    .map((p) => (p.innerText || "").replace(/\s+/g, " ").trim())
    .filter((t) => t.startsWith("이번 달 계약 ") || t.startsWith("남은 계약 ")));
  // One card, addressed by a string it shows: the group heading it sits under and, with `month`, that
  // month's payment chip — read as it stands, or tapped first when `tap` is set.
  const cardInfo = (text, month = null, tap = false) => page.evaluate((t, m, doTap) => {
    const card = [...document.querySelectorAll("button")]
      .filter((b) => (b.innerText || "").trim() === "수정")
      .map((b) => b.parentElement.parentElement)
      .find((c) => (c.innerText || "").includes(t));
    if (!card) return { found: false };
    const head = card.closest("section")?.firstElementChild;
    const out = { found: true, group: head ? (head.textContent || "").trim() : "" };
    if (!m) return out;
    const btn = [...card.querySelectorAll("button")].find((b) => (b.innerText || "").trim() === m);
    if (!btn) return { ...out, chip: false };
    if (doTap) { btn.scrollIntoView({ block: "center" }); btn.click(); }
    return { ...out, chip: true, paid: /border-emerald-700/.test(btn.className) };
  }, text, month, tap);
  // Decode the stored thumbnail in the page and report the pixel size the browser reads back.
  const thumbSize = (id) => page.evaluate((k) => new Promise((res) => {
    let src = null;
    try { src = JSON.parse(localStorage.getItem(k)); } catch { src = null; }
    if (!src) { res(null); return; }
    const im = new Image();
    im.onload = () => res({ w: im.naturalWidth, h: im.naturalHeight });
    im.onerror = () => res({ w: 0, h: 0 });
    im.src = src;
  }), `liferpg-img-folio-${id}`);
  const imgKeyExists = (id) => page.evaluate((k) => localStorage.getItem(k) != null, `liferpg-img-folio-${id}`);
  // The briefing is a stack of section cards inside the topmost overlay; a line is a button whose severity
  // is carried by its colour class, so the text (the shared `overlayText`) and the class are read separately.
  const briefLineClass = (text) => page.evaluate((t) => {
    const ov = [...document.querySelectorAll(".fixed.inset-0")].pop();
    const btn = ov && [...ov.querySelectorAll("button")].find((b) => (b.innerText || "").includes(t));
    return btn ? btn.className : "";
  }, text);
  // The packet, reached the way the app reaches it: `할 일` header → briefing → `AI에게 보내기` → its textarea.
  const packetText = async () => {
    await clickTab("할 일"); await clickText("브리핑 열기"); await sleep(600);
    await clickInModal("AI에게 보내기"); await sleep(500);
    return page.evaluate(() => document.querySelector(".fixed.inset-0 textarea")?.value || "");
  };

  // Everything a business record must never touch (rules 1, 18).
  const boundary = h.recordBoundary;
  const assertOnlyDeals = (before, after, what) => {
    const b = boundary(before), a = boundary(after);
    for (const k of Object.keys(b)) {
      if (b[k] !== a[k]) throw new Error(`${what} changed ${k}: ${String(b[k]).slice(0, 90)} -> ${String(a[k]).slice(0, 90)}`);
    }
    if (JSON.stringify(before.rates || []) !== JSON.stringify(after.rates || [])) throw new Error(`${what} changed the rate list`);
    if (JSON.stringify(before.folio || []) !== JSON.stringify(after.folio || [])) throw new Error(`${what} changed the portfolio list`);
  };

  const openAdd = async (label) => { await clickText(label); await sleep(400); };
  // Register one contract through the modal. Every argument is Korean UI copy used as a selector.
  const addDeal = async ({ client, title, status, start, months, monthly, cost }) => {
    await openAdd("계약 추가");
    await typeInto("고객사", client);
    await typeInto("일감 이름", title);
    if (status) await clickInModalExact(status);
    if (start) await setValue('.fixed.inset-0 input[type="month"]', start);
    if (months) await typeInto("개월 수", months);
    if (monthly) await typeInto("월 청구액", monthly);
    if (cost) await typeInto("월 원가", cost);
    await clickInModalExact("등록");
    await sleep(700);
  };
  const addRate = async ({ name, unit, price, cost }) => {
    await openAdd("단가 추가");
    await typeInto("단가 이름", name);
    if (unit) await clickInModalExact(unit);
    await typeInto("청구가", price);
    if (cost) await typeInto("원가 (원", cost);
    await clickInModalExact("등록");
    await sleep(700);
  };

  await step("business tab opens on the contract view and states its zeros", async () => {
    await clickTab("사업");
    const lines = await headerLines();
    if (lines[0] !== "이번 달 계약 0원 · 입금 확인 0원") throw new Error("contracted/collected line: " + JSON.stringify(lines));
    if (lines[1] !== "남은 계약 0원 · 견적 대기 0원 · 입금 미확인 0건") throw new Error("backlog/pipeline line: " + JSON.stringify(lines));
    await expectText("등록한 계약이 없어요 — 문의·견적부터 기록해요.");
    await expectText("최근 6개월");
  });

  await step("the deal form refuses a contract without a client, a title or a period", async () => {
    await openAdd("계약 추가");
    await expectText("새 계약");
    await clickInModalExact("등록");
    const noClient = await modalError();
    if (!noClient.includes("고객사를 입력해 주세요.")) errors.push("a contract without a client was accepted: " + noClient);
    await typeInto("고객사", "○○테크");
    await clickInModalExact("등록");
    const noTitle = await modalError();
    if (!noTitle.includes("일감 이름을 입력해 주세요.")) errors.push("a contract without a title was accepted: " + noTitle);
    await typeInto("일감 이름", "재고 관리 자동화 도구");
    await clickInModalExact("계약");
    await clickInModalExact("등록");
    const noPeriod = await modalError();
    if (!noPeriod.includes("계약 상태에서는 시작 월과 개월 수가 필요해요.")) errors.push("a signed contract without a period was accepted: " + noPeriod);
    await closeModal();
    const st = await readState();
    if ((st.deals || []).length) throw new Error("a rejected form stored a contract anyway");
  });

  let before3 = null; // the save as it stood before the first contract, compared in the next step

  await step("a won contract registers under the active group with its period, total and margin", async () => {
    before3 = await readState();
    const start = await monthIn(0);
    await addDeal({ client: "○○테크", title: "재고 관리 자동화 도구", status: "계약", start, months: "3", monthly: "1200000", cost: "300000" });
    const info = await cardInfo("재고 관리 자동화 도구");
    if (info.group !== "진행 중") throw new Error("the signed contract landed under: " + info.group);
    const r = await rows(["재고 관리 자동화 도구"]);
    if (r.rows.length !== 1) throw new Error(`contract row count ${r.rows.length}, expected 1`);
    const period = `${start} ~ ${await monthIn(2)} · 3개월 · 월 120만원`;
    if (!r.rows[0].includes(period)) throw new Error("the period line is not stated: " + r.rows[0]);
    if (!r.rows[0].includes("총 360만원 · 마진 270만원 (75%)")) throw new Error("the totals line is not stated: " + r.rows[0]);
    const lines = await headerLines();
    if (lines[0] !== "이번 달 계약 120만원 · 입금 확인 0원") throw new Error("contracted/collected line after the add: " + lines[0]);
    if (!lines[1].startsWith("남은 계약 240만원")) throw new Error("backlog line after the add: " + lines[1]);
  });

  await step("registering a contract changes deals and nothing else", async () => {
    const after = await readState();
    if ((after.deals || []).length !== (before3.deals || []).length + 1) throw new Error("the contract list did not grow by exactly one");
    assertOnlyDeals(before3, after, "registering a contract");
    const d = after.deals.find((x) => x.title === "재고 관리 자동화 도구");
    if (!d) throw new Error("the contract was not stored");
    for (const k of ["goalId", "pts", "diff", "areaId", "doneDates", "evidence"]) {
      if (k in d) throw new Error("the contract carries a task field: " + k);
    }
    if (d.monthly !== 1200000 || d.costMonthly !== 300000 || d.months !== 3) throw new Error("the billing rule was not stored as entered: " + JSON.stringify(d));
  });

  // Tracks (schema v28, Phase 1, 2026-09-17, written, not run): a contract is business by default.
  await step("a new deal defaults to the business track, stores it, and its row shows the tag", async () => {
    const d = ((await readState()).deals || []).find((x) => x.title === "재고 관리 자동화 도구");
    if (!d || d.track !== "biz") throw new Error("the contract's track: " + JSON.stringify(d));
    const tag = await page.evaluate((t) => {
      const card = [...document.querySelectorAll("button")].filter((b) => (b.innerText || "").trim() === "수정")
        .map((b) => b.parentElement.parentElement).find((c) => (c.innerText || "").includes(t));
      const span = card && [...card.querySelectorAll("span.font-mono")].find((s) => (s.innerText || "").trim() === "사업");
      return span ? span.className : null;
    }, "재고 관리 자동화 도구");
    if (!tag || !/text-cyan-300/.test(tag)) throw new Error("the contract row does not carry the business tag: " + JSON.stringify(tag));
    await openAdd("계약 추가");
    await expectText("직장 트랙은 AI 패킷에 실리지 않아요.");
    const on = await page.evaluate(() => {
      const ov = [...document.querySelectorAll(".fixed.inset-0")].pop();
      const b = ov && [...ov.querySelectorAll("button")].find((x) => (x.innerText || "").trim() === "사업");
      return b ? /bg-cyan-400/.test(b.className || "") : null;
    });
    if (on !== true) throw new Error("the new contract form does not open on the business track: " + JSON.stringify(on));
    await closeModal();
  });

  await step("a payment chip stores only its month stamp", async () => {
    const before = await readState();
    const month = await monthIn(0);
    const tapped = await cardInfo("재고 관리 자동화 도구", month, true);
    if (!tapped.chip) throw new Error("the contract row has no payment chip for this month");
    if (tapped.paid) throw new Error("the payment chip was already marked before the tap");
    await sleep(800);
    const chip = await cardInfo("재고 관리 자동화 도구", month);
    if (!chip.paid) throw new Error("the payment chip did not turn emerald after the tap");
    const after = await readState();
    const d = after.deals.find((x) => x.title === "재고 관리 자동화 도구");
    if (JSON.stringify(d.paidMonths) !== JSON.stringify([month])) throw new Error("the payment stamp stored: " + JSON.stringify(d.paidMonths));
    assertOnlyDeals(before, after, "ticking a payment");
    const lines = await headerLines();
    if (lines[0] !== "이번 달 계약 120만원 · 입금 확인 120만원") throw new Error("the collected figure after the tick: " + lines[0]);
  });

  await step("un-ticking removes the stamp", async () => {
    const month = await monthIn(0);
    await cardInfo("재고 관리 자동화 도구", month, true);
    await sleep(800);
    const chip = await cardInfo("재고 관리 자동화 도구", month);
    if (chip.paid) throw new Error("the payment chip stayed emerald after the second tap");
    const st = await readState();
    const d = st.deals.find((x) => x.title === "재고 관리 자동화 도구");
    if ((d.paidMonths || []).length) throw new Error("the payment stamp survived the un-tick: " + JSON.stringify(d.paidMonths));
    const lines = await headerLines();
    if (!lines[1].includes("입금 미확인 1건")) throw new Error("the unpaid count after the un-tick: " + lines[1]);
  });

  await step("a lead registers with no numbers", async () => {
    await addDeal({ client: "◇◇스튜디오", title: "예약 페이지 개편" });
    const info = await cardInfo("예약 페이지 개편");
    if (info.group !== "문의") throw new Error("the lead landed under: " + info.group);
    const r = await rows(["예약 페이지 개편"]);
    if (!r.rows[0]?.includes("기간 미정")) throw new Error("the lead row does not state its missing period: " + r.rows.join(" | "));
    if (/총 |마진 |원가 미입력/.test(r.rows[0])) throw new Error("a lead with no numbers printed a totals line: " + r.rows[0]);
    const st = await readState();
    const d = st.deals.find((x) => x.title === "예약 페이지 개편");
    for (const k of ["monthly", "months", "costMonthly", "startMonth"]) {
      if (k in d) throw new Error("a blank number field was stored anyway: " + k);
    }
  });

  await step("a quote feeds the pipeline line", async () => {
    const before = await headerLines();
    await addDeal({ client: "□□랩스", title: "리드 수집 크롤러", status: "견적", months: "2", monthly: "1500000" });
    const after = await headerLines();
    if (before[1] === after[1]) throw new Error("the pipeline line did not move when a quote was registered: " + after[1]);
    if (!after[1].includes("견적 대기 300만원")) throw new Error("pipeline line: " + after[1]);
    const info = await cardInfo("리드 수집 크롤러");
    if (info.group !== "견적 대기") throw new Error("the quote landed under: " + info.group);
  });

  await step("a contract without a cost prints the cost-missing line", async () => {
    await addDeal({ client: "△△랩스", title: "문서 검색 AI 구축", status: "계약", start: await monthIn(0), months: "2", monthly: "2000000" });
    const r = await rows(["문서 검색 AI 구축"]);
    if (!r.rows[0]?.includes("원가 미입력 — 마진은 계산하지 않아요")) throw new Error("the row of a contract without a cost: " + r.rows.join(" | "));
    if (!r.rows[0]?.includes("총 400만원")) throw new Error("a contract without a cost lost its total: " + r.rows.join(" | "));
    const st = await readState();
    const d = st.deals.find((x) => x.title === "문서 검색 AI 구축");
    if ("costMonthly" in d) throw new Error("a blank cost was stored as a zero");
  });

  await step("the rate view lists rates and counts the ones with a cost", async () => {
    await clickExact("단가");
    await expectText("등록한 단가가 없어요 — 청구가와 원가를 넣으면 마진이 계산돼요.");
    await addRate({ name: "웹 앱 개발 (월)", price: "3000000", cost: "800000" });
    await addRate({ name: "랜딩 페이지 제작 (프로젝트)", unit: "건", price: "1200000" });
    await expectText("단가 2건 · 원가 입력 1건");
    const priced = await rows(["웹 앱 개발 (월)"]);
    if (!priced.rows[0]?.includes("청구 300만원 · 원가 80만원 · 마진 220만원 (73%)")) throw new Error("rate row with a cost: " + priced.rows.join(" | "));
    const bare = await rows(["랜딩 페이지 제작 (프로젝트)"]);
    if (!bare.rows[0]?.includes("원가 미입력 — 마진은 계산하지 않아요")) throw new Error("rate row without a cost: " + bare.rows.join(" | "));
    if (!bare.rows[0]?.includes("청구 120만원")) throw new Error("the rate without a cost lost its price: " + bare.rows.join(" | "));
    const st = await readState();
    if ((st.rates || []).length !== 2) throw new Error(`stored rate count ${(st.rates || []).length}, expected 2`);
    if ("cost" in st.rates[0]) throw new Error("a blank cost was stored as a zero");
  });

  await step("a landscape image keeps its aspect in the stored thumbnail", async () => {
    await clickExact("포트폴리오");
    await expectText("등록한 포트폴리오가 없어요 — 링크와 대표 이미지 1장을 넣어요.");
    await openAdd("포트폴리오 추가");
    await typeInto("제목", "사내 문서 검색 AI");
    await typeInto("기술 (선택", "React, FastAPI");
    await typeInto("링크 주소", "https://example.com/doc-search");
    await clickInModalExact("GitHub");
    const dropped = await page.evaluate((b64) => {
      const bin = atob(b64);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      const input = document.querySelector('.fixed.inset-0 input[type="file"]');
      if (!input) return "the portfolio form has no file input";
      const dt = new DataTransfer();
      dt.items.add(new File([bytes], "wide.png", { type: "image/png" }));
      input.files = dt.files;
      input.dispatchEvent(new Event("change", { bubbles: true }));
      return "ok";
    }, WIDE_PNG);
    if (dropped !== "ok") throw new Error(dropped);
    await sleep(900);
    const pickErr = await modalError();
    if (pickErr) throw new Error("the landscape fixture was refused: " + pickErr);
    await clickInModalExact("등록");
    await sleep(1000);
    const st = await readState();
    const item = (st.folio || []).find((f) => f.title === "사내 문서 검색 AI");
    if (!item) throw new Error("the portfolio entry was not stored");
    if ((item.links || []).length !== 1 || item.links[0].label !== "GitHub") throw new Error("the label chip did not attach the url: " + JSON.stringify(item.links));
    if (JSON.stringify(item.stack) !== JSON.stringify(["React", "FastAPI"])) throw new Error("the stack was not split on commas: " + JSON.stringify(item.stack));
    const size = await thumbSize(item.id);
    if (!size) throw new Error("the portfolio image key was not written");
    if (!(size.w > size.h)) throw new Error(`stored thumbnail ${size.w}x${size.h} — a landscape source came back without its aspect`);
    if (size.w !== 24 || size.h !== 8) throw new Error(`stored thumbnail ${size.w}x${size.h}, expected 24x8 — a source under the long edge must never be upscaled`);
    if (!(await hasText("포트폴리오 1건 · 대표 이미지 1장 · 저장 공간"))) throw new Error("the portfolio footer does not count the stored image");
    if (await hasText("대표 이미지 없음")) throw new Error("the card still shows the no-image line after a successful write");
  });

  await step("deleting a portfolio item removes its image key", async () => {
    const item = (await readState()).folio[0];
    if (!(await imgKeyExists(item.id))) throw new Error("the image key is already missing before the deletion");
    // the confirmation is a real window.confirm; stub it the way flow4 does
    await page.evaluate(() => { window.confirm = () => false; });
    const r = await rows(["사내 문서 검색 AI"], "수정");
    if (!r.clicked) throw new Error("the portfolio card has no edit button: " + r.rows.join(" | "));
    await sleep(400);
    await expectText("포트폴리오 수정");
    await clickInModalExact("삭제");
    await sleep(700);
    if (!(await readState()).folio.length) throw new Error("cancelling the confirmation still deleted the portfolio entry");
    await page.evaluate(() => { window.confirm = () => true; });
    await clickInModalExact("삭제");
    await sleep(900);
    const st = await readState();
    if ((st.folio || []).length) throw new Error("the portfolio entry survived the confirmed deletion");
    if (await imgKeyExists(item.id)) throw new Error("the portfolio image key survived the deletion");
    if ((st.deals || []).length !== 4 || (st.rates || []).length !== 2) throw new Error("deleting a portfolio entry touched the other business lists");
  });

  await step("the chosen business view survives a reload", async () => {
    const stored = (await readState()).ui?.bizView;
    if (stored !== "folio") throw new Error("the chosen view was not stored: " + stored);
    await h.reload();
    await clickTab("사업");
    await expectText("등록한 포트폴리오가 없어요 — 링크와 대표 이미지 1장을 넣어요.");
    if (await hasText("최근 6개월")) throw new Error("the tab reopened on the contract view after a reload");
    const after = await readState();
    if (after.ui?.bizView !== "folio") throw new Error("the stored view after a reload: " + after.ui?.bizView);
    if ("scheduleView" in (after.ui || {})) throw new Error("the retired schedule view came back: " + JSON.stringify(after.ui));
  });

  /* ── The assistant surfaces: the briefing, the `할 일` header and list, and the packet all read one `bizSummary`, so
     the figures below are the ones the tab header stated above. Two contracts are billed this month, 1,200,000
     and 2,000,000 won, and neither month is stamped paid, so two unpaid months are outstanding. ── */

  await step("the briefing states the business section after the goal pace", async () => {
    const month = await monthIn(0);
    await clickTab("할 일");
    await clickText("브리핑 열기");
    await sleep(600);
    const brief = await overlayText();
    const pos = ["목표 페이스", "사업", "영역·활동"].map((t) => brief.indexOf(t));
    if (pos.some((i) => i < 0)) throw new Error("the briefing has no business section: " + brief.slice(0, 300));
    if (!(pos[0] < pos[1] && pos[1] < pos[2])) throw new Error("the business section is not between the goal pace and the areas: " + pos.join(","));
    const unpaid = `○○테크 재고 관리 자동화 도구 — ${month} 입금 미확인 120만원`;
    if (!brief.includes(unpaid)) throw new Error("the unpaid month is not named: " + brief.slice(pos[1], pos[1] + 300));
    const cls = await briefLineClass(unpaid);
    if (!/text-rose-400/.test(cls)) throw new Error("the unpaid line is not severity 3: " + cls);
    if (!brief.includes("이번 달 계약 매출 320만원 · 입금 확인 0원 · 남은 계약 440만원")) {
      throw new Error("the business summary line: " + brief.slice(pos[1], pos[1] + 300));
    }
  });

  await step("the business briefing line opens the tab", async () => {
    await clickInModal("입금 미확인");
    await sleep(600);
    const open = await page.evaluate(() => document.querySelectorAll(".fixed.inset-0").length);
    if (open) { await closeModal(); throw new Error("the briefing stayed open after its business line was tapped"); }
    const lines = await headerLines();
    if (lines.length !== 2 || !lines[1].startsWith("남은 계약 ")) throw new Error("the business line did not land on the tab: " + JSON.stringify(lines));
  });

  /* The `할 일` list names the same unpaid months, capped at BIZ_ALERT_MAX, and the header line states the full
     counts beside the cap. A business row opens a sheet whose only action is a link into this tab: it completes
     nothing and pays nothing. */
  await step("the tasks tab lists the unpaid month as a business row that completes nothing", async () => {
    await clickTab("할 일");
    await expectText("사업 입금 미확인 2건");
    // The unpaid count is rose while payments are outstanding — the severity the removed home line carried.
    const rose = await page.evaluate(() => {
      const line = [...document.querySelectorAll("main button")].find((b) => (b.innerText || "").startsWith("사업 "));
      const count = line && [...line.querySelectorAll("span")].find((s) => (s.innerText || "").trim().startsWith("입금 미확인"));
      return count ? /text-rose-400/.test(count.className) : null;
    });
    if (rose !== true) throw new Error(`the header's unpaid count is not rose while payments are outstanding (${rose})`);
    const all = (await todoRows()) || [];
    // The row no longer prints its business text; the same contract also has a later `계약 종료` row, and rows are
    // date-ordered, so the first row of that title is this month's unpaid one (its sheet below confirms it).
    const biz = all.find((r) => r.title.includes("재고 관리 자동화 도구"));
    if (!biz) throw new Error("the unpaid month is not listed: " + all.map((r) => `${r.group}/${r.title}`).join(" | "));
    if (!(biz.text.includes("기한 지남") || biz.text.includes("D-")) || !biz.text.includes("목표 기여 없음")) {
      throw new Error("the business row does not lead with its month-end chip and state that it moves no goal: " + biz.text);
    }
    // The rule boundary: no checkbox, no lock, no action row — tapping the row is its only behaviour (rules 1, 18).
    if (biz.controls) throw new Error(`the business row carries ${biz.controls} control(s): ` + JSON.stringify(biz.buttons));
    await todoRows(null, { title: biz.title });
    await sleep(500);
    const sheet = await overlayText();
    if (!sheet.includes("사업 — ") || !sheet.includes("입금 미확인")) throw new Error("the business row did not open its sheet: " + sheet.slice(0, 300));
    const doneButtons = await page.evaluate(() => {
      const ov = [...document.querySelectorAll(".fixed.inset-0")].pop();
      return ov ? [...ov.querySelectorAll("button")].map((b) => (b.innerText || "").trim()).filter((t) => t.includes("완료")) : [];
    });
    if (doneButtons.length) throw new Error("the business sheet offers a completion control: " + JSON.stringify(doneButtons));
    await clickInModalExact("사업 탭에서 보기 ›");
    await sleep(600);
    const lines = await headerLines();
    if (lines.length !== 2 || !lines[0].startsWith("이번 달 계약 320만원")) throw new Error("the business row did not open the business tab: " + JSON.stringify(lines));
    await expectText("최근 6개월"); // the revenue roll-up only exists in the contract view
  });

  await step("the packet carries the business section and a pasted reply creates nothing", async () => {
    const month = await monthIn(0);
    const txt = await packetText();
    const iSchedule = txt.indexOf("## 다가오는 일정 (14일)");
    const iBiz = txt.indexOf("## 사업 (계약·매출)");
    const iJournal = txt.indexOf("## 최근 일지 (7일)");
    if (iBiz < 0) throw new Error("the packet has no business section");
    if (!(iSchedule < iBiz && iBiz < iJournal)) throw new Error(`the business section is not between the schedule and the journal: ${iSchedule},${iBiz},${iJournal}`);
    if (!txt.includes("- 이번 달 계약 320만원 · 입금 확인 0원 · 남은 계약 440만원 · 견적 대기 300만원")) {
      throw new Error("the packet summary line: " + txt.slice(iBiz, iBiz + 200));
    }
    if (!txt.includes(`- 미수 ${month} ○○테크 재고 관리 자동화 도구 120만원`)) {
      throw new Error("the packet does not name the unpaid month: " + txt.slice(iBiz, iBiz + 300));
    }
    if (!txt.includes("계약·단가·포트폴리오는 제안하지 않아요")) throw new Error("the packet rules do not exclude business proposals");
    if (txt.length > 4000) errors.push("packet longer than the 4000-char cap: " + txt.length);
    // A reply full of business data and one appointment: `parseAssistantReply` reads `tasks` and nothing else,
    // so no deal, rate, portfolio entry or event lands.
    const before = await readState();
    await clickInModal("AI 답변 붙여넣기");
    await sleep(400);
    const reply = [
      "이번 달 계약 320만원 · 입금 미확인 2건.",
      "```json",
      JSON.stringify({
        tasks: [{ goal: "하네스 설계 엔지니어 취업", title: "재고 관리 자동화 도구 유지보수 계약", diff: "D", type: "once", client: "○○테크", monthly: 1200000, months: 3 }],
        deals: [{ client: "◎◎커머스", title: "정산 자동화 구축", status: "won", monthly: 2500000, months: 5, startMonth: month }],
        rates: [{ name: "데이터 파이프라인 구축 (월)", unit: "month", price: 2800000, cost: 700000 }],
        folio: [{ title: "정산 자동화 데모", links: [{ label: "GitHub", url: "https://example.com/settle" }] }],
        events: [{ title: "◎◎커머스 킥오프 미팅", kind: "appt", date: `${month}-18`, time: "14:00" }],
        note: "계약 1건과 단가 1건을 등록해요.",
      }),
      "```",
    ].join("\n");
    await setValue(".fixed.inset-0 textarea", reply);
    await clickInModalExact("답변 확인");
    await sleep(500);
    await clickInModal("선택한 실행 등록");
    await sleep(900);
    const after = await readState();
    for (const list of ["deals", "rates", "folio", "events"]) {
      if (JSON.stringify(before[list] || []) !== JSON.stringify(after[list] || [])) throw new Error(`a pasted reply changed ${list}`);
    }
    if ((after.tasks || []).length !== (before.tasks || []).length) throw new Error("a pasted business reply created a task");
  });

  /* The packet is the only place data deliberately leaves the device, so what it carries about the person is
     asserted both ways: the CV facts are present, and every identifying field typed at onboarding is absent.
     The absence checks are non-vacuous because those values are distinctive strings this run typed itself. */
  await step("the packet states the CV at degree and role level and no identifying field", async () => {
    await closeModal();
    const txt = await packetText();
    const iBrief = txt.indexOf("## 오늘 브리핑");
    const iCv = txt.indexOf("## 이력");
    const iGoals = txt.indexOf("## 목표");
    if (iCv < 0) throw new Error("the packet has no CV section");
    if (!(iBrief < iCv && iCv < iGoals)) throw new Error(`the CV section is not between the briefing and the goals: ${iBrief},${iCv},${iGoals}`);
    const line = txt.slice(iCv, iGoals);
    // Degree, department, practice months and the most recent role — the four facts the section exists to carry
    for (const t of ["박사 졸업", "기계공학", "실무 2년 2개월", "설계 엔지니어"]) {
      if (!line.includes(t)) throw new Error("the CV section does not state a fact it must carry: " + t + " — " + line.trim());
    }
    // Name, birth date, e-mail, phone, school names and the employer name: all typed during this run, all absent
    const p = (await readState()).profile || {};
    const schools = (p.edus || []).map((e) => e.school);
    const companies = (p.careers || []).map((c) => c.company);
    if (!schools.includes("E2E대학교") || !companies.includes("E2E전장")) {
      throw new Error("the distinctive values this step checks for are not in the save: " + JSON.stringify({ schools, companies }));
    }
    const identifying = [p.name, p.birth, p.email, p.phone, ...schools, ...companies];
    for (const t of identifying) {
      if (!t) throw new Error("an identifying field is empty, so its absence would prove nothing: " + JSON.stringify(identifying));
      if (txt.includes(t)) throw new Error("the packet carries an identifying field: " + t);
    }
    await closeModal();
  });

  await step("the month's revenue line survives a section full of alerts", async () => {
    // `add()` caps a briefing section at five items. Three unpaid months plus two contracts ending this month
    // fill that cap exactly, and the line the section exists to state must still be there (rule 13).
    await closeModal();
    const before = await readState();
    const kept = JSON.stringify(before.deals || []);
    const months = [await monthIn(-1), await monthIn(-2), await monthIn(-3), await monthIn(0)];
    const planted = [
      // Billed before this month and never marked paid — one severity-3 line each.
      ...[0, 1, 2].map((i) => ({ id: `cap-u${i}`, client: `미수${i}사`, title: "밀린 건", status: "won",
        monthly: 1000000, months: 1, startMonth: months[i], paidMonths: [], createdAt: "2026-01-01" })),
      // Billed this month, so they end now and are not yet overdue — one severity-2 line each.
      ...[0, 1].map((i) => ({ id: `cap-e${i}`, client: `종료${i}사`, title: "끝나가는 건", status: "won",
        monthly: 1000000, months: 1, startMonth: months[3], paidMonths: [], createdAt: "2026-01-01" })),
    ];
    await page.evaluate((d) => {
      const k = "liferpg-state-v1";
      const s = JSON.parse(localStorage.getItem(k));
      s.deals = d;
      localStorage.setItem(k, JSON.stringify(s));
    }, planted);
    // The planted deals are restored in `finally`, so a failure here cannot cascade into the steps that follow.
    try {
      await h.reload();
      await clickTab("할 일");
      await clickText("브리핑 열기");
      await sleep(600);
      const txt = await overlayText();
      const iBiz = txt.indexOf("사업");
      if (iBiz < 0) throw new Error("the briefing has no business section");
      const unpaidLines = txt.split("입금 미확인").length - 1;
      if (unpaidLines < 3) throw new Error(`planted unpaid months shown: ${unpaidLines}, expected 3 — ` + txt.slice(iBiz, iBiz + 400));
      if (!txt.includes("이번 달 계약 매출")) {
        throw new Error("the alerts pushed the revenue line out of the section: " + txt.slice(iBiz, iBiz + 400));
      }
    } finally {
      await closeModal();
      await page.evaluate((d) => {
        const k = "liferpg-state-v1";
        const s = JSON.parse(localStorage.getItem(k));
        s.deals = JSON.parse(d);
        localStorage.setItem(k, JSON.stringify(s));
      }, kept);
      await h.reload();
    }
  });

  /* ── Roadmap (schema v28, Phase 2, 2026-09-18, written, not run). A milestone is a record: these steps assert that the
     seed, the form and the status changes write `milestones` only, and that D-day, linked-work completion, pace and the
     stage-order note are derived. Every plant is removed and the roadmap reset to `[]` at the end of the last step. ── */
  const dayIn = (delta) => page.evaluate((d) => {
    const t = new Date(); t.setHours(12, 0, 0, 0); t.setDate(t.getDate() + d);
    const pad = (n) => String(n).padStart(2, "0");
    return [t.getFullYear(), pad(t.getMonth() + 1), pad(t.getDate())].join("-");
  }, delta);
  // Plants and resets go through the page's own storage, each with the mutation written inline (flow8's convention).
  const KEY = "liferpg-state-v1";
  // A milestone write may move `milestones` and nothing else: the record boundary plus the business and work lists.
  const assertOnlyMilestones = (before, after, what) => {
    assertOnlyDeals(before, after, what);
    for (const k of ["deals", "work", "documents", "meetingProjects", "meetings", "events"]) {
      if (JSON.stringify(before[k] || []) !== JSON.stringify(after[k] || [])) throw new Error(`${what} changed ${k}`);
    }
  };
  const roadmapNote = () => page.evaluate(() => {
    const p = [...document.querySelectorAll("main p")].find((x) => (x.innerText || "").startsWith("단계 순서:"));
    return p ? p.innerText.trim() : null;
  });
  const tickLink = async (text) => {
    const ok = await page.evaluate((t) => {
      const ov = [...document.querySelectorAll(".fixed.inset-0")].pop();
      const b = ov && [...ov.querySelectorAll('[role="checkbox"]')].find((x) => (x.innerText || "").includes(t));
      if (!b) return false; b.scrollIntoView({ block: "center" }); b.click(); return true;
    }, text);
    if (!ok) throw new Error("link row not found: " + text);
    await sleep(150);
  };
  const openRoadmap = async () => { await clickTab("사업"); await clickExact("로드맵"); await sleep(300); };

  await step("the roadmap view seeds nine milestones once and states their D-days and stage order", async () => {
    await closeModal();
    await page.evaluate((k) => {
      const s = JSON.parse(localStorage.getItem(k));
      s.milestones = [];
      localStorage.setItem(k, JSON.stringify(s));
    }, KEY);
    await h.reload();
    await openRoadmap();
    await expectText("로드맵이 비어 있어요.");
    await expectText("상황에 맞춘 9단계를 넣어요 — 날짜·조건은 수정할 수 있어요.");
    await expectText("마일스톤 추가");
    const before = await readState();
    const today = await dayIn(0);
    await clickExact("기본 로드맵 채우기");
    await sleep(400);
    await expectText("기본 로드맵 9건을 채웠어요");
    const after = await readState();
    const ms = after.milestones || [];
    if (ms.length !== 9) throw new Error("seeded milestones: " + ms.length);
    if (JSON.stringify(ms.map((m) => m.stage).sort((a, b) => a - b)) !== "[1,2,3,4,5,6,7,8,9]") throw new Error("seeded stages: " + JSON.stringify(ms.map((m) => m.stage)));
    for (const m of ms) {
      if (m.status !== "planned" || m.createdAt !== today || "doneAt" in m) throw new Error("a seed is not a fresh planned record: " + JSON.stringify(m));
      if (m.dealIds.length || m.documentIds.length || m.workIds.length || "projectId" in m) throw new Error("a seed carries links: " + JSON.stringify(m));
    }
    assertOnlyMilestones(before, after, "seeding the roadmap");
    if (await hasText("기본 로드맵 채우기")) throw new Error("the seed button is still shown on a filled roadmap");
    await expectText("예정 9 · 진행 중 0 · 완료 0");
    const marker = await page.evaluate(() => {
      const s = [...document.querySelectorAll("main span.font-mono.whitespace-nowrap")].find((x) => /업무 \d+\/\d+/.test(x.innerText || ""));
      return s ? s.innerText.replace(/\s+/g, " ").trim() : "";
    });
    if (!/^(D-\d+|D-DAY|D\+\d+) · 업무 0\/0$/.test(marker)) throw new Error("the first roadmap row's marker: " + JSON.stringify(marker));
    if (await roadmapNote()) throw new Error("a stage-order note on an all-planned roadmap");
  });

  await step("a milestone registers with links, moves to done with a stamped date, and the out-of-order note appears and disappears", async () => {
    const today = await dayIn(0);
    await page.evaluate((k, a) => {
      const s = JSON.parse(localStorage.getItem(k));
      s.work = [{ id: "e2e-ms-work", date: a, title: "E2E 마일스톤 업무", done: false, source: "manual", createdAt: a, track: "biz" }, ...(s.work || []).filter((w) => w.id !== "e2e-ms-work")];
      localStorage.setItem(k, JSON.stringify(s));
    }, KEY, today);
    await h.reload();
    await openRoadmap();
    let before = await readState();
    await clickText("마일스톤 추가");
    await sleep(400);
    await typeInto("마일스톤 — 예", "E2E 마일스톤");
    await clickInModalExact("5");
    await clickInModalExact("진행 중");
    await typeInto("달성 조건 (선택)", "E2E 조건 — 시연 1건");
    await tickLink("재고 관리 자동화 도구");
    await tickLink("E2E 마일스톤 업무");
    await clickInModalExact("등록");
    await sleep(500);
    let after = await readState();
    const added = (after.milestones || []).find((m) => m.title === "E2E 마일스톤");
    if (!added || added.stage !== 5 || added.status !== "active" || added.dealIds.length !== 1 || JSON.stringify(added.workIds) !== '["e2e-ms-work"]' || "doneAt" in added) {
      throw new Error("the registered milestone: " + JSON.stringify(added));
    }
    if (added.createdAt !== today || added.condition !== "E2E 조건 — 시연 1건") throw new Error("the milestone's stamps: " + JSON.stringify(added));
    assertOnlyMilestones(before, after, "registering a milestone");
    if ((await roadmapNote()) !== "단계 순서: 1단계 미완 · 5단계 진행 중") throw new Error("the stage-order note: " + (await roadmapNote()));

    before = after;
    await h.openTodo("계약금 입금 확인 — ETL 고도화 계약");
    await clickInModalExact("완료");
    await clickInModalExact("저장");
    await sleep(500);
    after = await readState();
    const first = after.milestones.find((m) => m.stage === 1);
    if (first.status !== "done" || first.doneAt !== today) throw new Error("the stage-1 milestone after done: " + JSON.stringify(first));
    assertOnlyMilestones(before, after, "marking a milestone done");
    if ((await roadmapNote()) !== "단계 순서: 2단계 미완 · 5단계 진행 중") throw new Error("the note after stage 1 is done: " + (await roadmapNote()));
    await expectText("예정 8 · 진행 중 1 · 완료 1");

    await h.openTodo("E2E 마일스톤");
    await clickInModalExact("예정");
    await clickInModalExact("저장");
    await sleep(500);
    if (await roadmapNote()) throw new Error("the stage-order note survived with no active milestone: " + (await roadmapNote()));
    after = await readState();
    if ("doneAt" in after.milestones.find((m) => m.title === "E2E 마일스톤")) throw new Error("a planned milestone carries doneAt");

    await h.openTodo("E2E 마일스톤");
    await setValue('.fixed.inset-0 input[placeholder^="마일스톤 — 예"]', "가".repeat(61));
    await clickInModalExact("저장");
    const err = await modalError();
    if (err !== "마일스톤 이름은 60자까지예요 — 지금 61자예요.") throw new Error("the title refusal: " + JSON.stringify(err));
    before = await readState();
    await page.evaluate(() => { window.confirm = () => true; });
    await clickInModalExact("삭제");
    await sleep(500);
    after = await readState();
    if (after.milestones.length !== 9 || after.milestones.some((m) => m.title === "E2E 마일스톤")) throw new Error("milestones after the delete: " + after.milestones.length);
    assertOnlyMilestones(before, after, "deleting a milestone");
  });

  await step("milestone pace follows linked work and the reader states the roadmap", async () => {
    const [today, back, ahead] = [await dayIn(0), await dayIn(-10), await dayIn(10)];
    try {
      await page.evaluate((k, a) => {
        const s = JSON.parse(localStorage.getItem(k));
        s.work = [
          { id: "e2e-pace-w1", date: a.today, title: "E2E 페이스 업무 1", done: true, source: "manual", createdAt: a.today, track: "biz" },
          { id: "e2e-pace-w2", date: a.today, title: "E2E 페이스 업무 2", done: false, source: "manual", createdAt: a.today, track: "biz" },
          ...(s.work || []).filter((w) => !w.id.startsWith("e2e-pace-")),
        ];
        s.milestones = [{ id: "e2e-pace-ms", title: "E2E 페이스 마일스톤", stage: 3, due: a.ahead, status: "active", dealIds: [], documentIds: [],
          workIds: ["e2e-pace-w1", "e2e-pace-w2"], createdAt: a.back }, ...(s.milestones || []).filter((m) => m.id !== "e2e-pace-ms")];
        localStorage.setItem(k, JSON.stringify(s));
      }, KEY, { today, back, ahead });
      await h.reload();
      await openRoadmap();
      await h.openTodo("E2E 페이스 마일스톤");
      let sheet = await overlayText();
      if (!sheet.includes("페이스 궤도 유지") || !sheet.includes("연결 업무 1/2")) throw new Error("the sheet at 1/2 done, half elapsed: " + sheet.slice(0, 200));
      await closeModal();
      await page.evaluate((k) => {
      const s = JSON.parse(localStorage.getItem(k));
      s.work.find((w) => w.id === "e2e-pace-w2").done = true;
      localStorage.setItem(k, JSON.stringify(s));
    }, KEY);
      await h.reload();
      await openRoadmap();
      await h.openTodo("E2E 페이스 마일스톤");
      sheet = await overlayText();
      if (!sheet.includes("페이스 50%p 앞섬") || !sheet.includes("연결 업무 2/2")) throw new Error("the sheet at 2/2 done, half elapsed: " + sheet.slice(0, 200));
      await closeModal();
      await clickTab("프로필");
      await clickText("오늘 읽을 것");
      await sleep(500);
      const reader = await overlayText();
      const i = reader.indexOf("사업 로드맵");
      if (i < 0) throw new Error("the reader has no roadmap section: " + reader.slice(0, 300));
      const section = reader.slice(i, reader.indexOf("뒤처진 목표 페이스", i) > 0 ? reader.indexOf("뒤처진 목표 페이스", i) : undefined);
      if (!section.includes("3단계 · E2E 페이스 마일스톤 · D-10 · 업무 2/2 · 50%p 앞섬")) throw new Error("the reader's roadmap line: " + section.slice(0, 300));
      if (reader.indexOf("계약·입금 미확인") > i) throw new Error("the roadmap section is not after the contracts section");
      await closeModal();
    } finally {
      // Leave the save as the next flow expects it: no plants, an empty roadmap, the contract view.
      await closeModal();
      await page.evaluate((k) => {
      const s = JSON.parse(localStorage.getItem(k));
      s.work = (s.work || []).filter((w) => !w.id.startsWith("e2e-pace-") && w.id !== "e2e-ms-work");
      s.milestones = [];
      s.ui = { ...(s.ui || {}), bizView: "deals" };
      localStorage.setItem(k, JSON.stringify(s));
    }, KEY);
      await h.reload();
    }
  });
};
