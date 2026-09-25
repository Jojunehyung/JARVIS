// Installable app — the service worker registers and controls the page, the app still opens with the
// network disabled, and a backup round-trips. Runs last: it toggles offline mode and reloads.
const fs = require("fs");
const path = require("path");
module.exports = async (h) => {
  const { step, expectText, closeModal, captureDownload, sleep, page, errors } = h;

  await step("service worker registers and controls the page", async () => {
    const ok = await page.evaluate(async () => {
      if (!("serviceWorker" in navigator)) return "no serviceWorker API";
      const reg = await navigator.serviceWorker.getRegistration();
      if (!reg) return "not registered";
      await navigator.serviceWorker.ready;
      return navigator.serviceWorker.controller ? "ok" : "registered but not controlling";
    });
    if (ok === "registered but not controlling") {
      await h.reload();
      const after = await page.evaluate(() => (navigator.serviceWorker.controller ? "ok" : "still not controlling"));
      if (after !== "ok") throw new Error(after);
      return;
    }
    if (ok !== "ok") throw new Error(ok);
  });

  await step("a first visit does not reload itself", async () => {
    // The first service worker claiming the page must not trigger a reload: on a slow phone it lands
    // seconds in and throws away whatever the user just tapped (reported 2026-09-09: the start button did nothing).
    const ctx = await page.browser().createBrowserContext();
    const fresh = await ctx.newPage();
    try {
      let navs = 0;
      fresh.on("framenavigated", (f) => { if (f === fresh.mainFrame()) navs++; });
      await fresh.goto(page.url(), { waitUntil: "domcontentloaded" });
      await sleep(4000);
      const registered = await fresh.evaluate(async () => !!(await navigator.serviceWorker.getRegistration()));
      if (!registered) throw new Error("the service worker did not register on a fresh profile");
      if (navs > 1) throw new Error(`the page reloaded itself ${navs - 1} time(s) on a first visit`);

      // The precache is what makes the app open offline. An empty or partial one fails silently
      // otherwise: the app looks fine online and simply will not start without a network.
      const cached = await fresh.evaluate(async () => {
        const names = await caches.keys();
        if (!names.length) return null;
        const c = await caches.open(names[0]);
        return (await c.keys()).map((r) => new URL(r.url).pathname);
      });
      if (!cached) throw new Error("the first visit cached nothing — the app would not open offline");
      if (!cached.some((p) => p.endsWith("/"))) throw new Error("the document is not precached: " + cached.join(", "));
      if (!cached.some((p) => p.endsWith(".js"))) throw new Error("the bundle is not precached: " + cached.join(", "));
    } finally {
      await ctx.close();
    }
  });

  await step("a controlled page does not reload when a new worker takes over", async () => {
    // The update case the first-visit step cannot reach: a page that already has a controller when it
    // loads, which is exactly the state the app used to reload on (reported 2026-09-13: the growth tab
    // jumped back to home a few seconds in — once per deploy, because every build emits a new sw.js).
    // Registering a second script URL at the same scope replaces the registration, so a new worker
    // installs, skipWaiting + clients.claim hand it this running page, and `controllerchange` fires.
    const ctx = await page.browser().createBrowserContext();
    const fresh = await ctx.newPage();
    // Polling, not an event: `controllerchange` fires inside the page, and a reload from the pre-fix
    // build destroys the execution context mid-evaluate, which must not read as a passing step.
  const until = async (ms, fn) => {
      const t0 = Date.now();
      while (Date.now() - t0 < ms) { try { if (await fn()) return true; } catch {} await sleep(250); }
      return false;
    };
    try {
      await fresh.goto(page.url(), { waitUntil: "domcontentloaded" });
      const claimed = await until(8000, () => fresh.evaluate(() => !!navigator.serviceWorker.controller));
      if (!claimed) throw new Error("the first worker never took control — the update case cannot be simulated");
      await fresh.reload({ waitUntil: "domcontentloaded" });

      let navs = 0;
      fresh.on("framenavigated", (f) => { if (f === fresh.mainFrame()) navs++; });
      const before = await fresh.evaluate(() => navigator.serviceWorker.controller?.scriptURL || "");
      if (!before) throw new Error("the reloaded page had no controller at load time — the update case cannot be simulated");
      await fresh.evaluate(async () => { await navigator.serviceWorker.register("./sw.js?e2e-update=1", { scope: "./" }); });

      const tookOver = await until(8000, async () => {
        if (navs > 0) return true; // a navigation is itself the takeover; the assertion below names it
        const now = await fresh.evaluate(() => navigator.serviceWorker.controller?.scriptURL || "");
        return !!now && now !== before;
      });
      if (!tookOver) throw new Error("the new worker never took control — this step proved nothing");
      await sleep(3000);
      if (navs !== 0) throw new Error(`the page reloaded itself ${navs} time(s) when a new worker took over`);
    } finally {
      await ctx.close();
    }
  });

  // ── The local check notification (2026-09-22). Headless Chrome cannot show an OS notification reliably, so these steps
  // assert what the app writes for the worker — the `life-check` cache entry — and the routing of a tap (`?open=`).
  // Written under the standing instruction that the suite is not run: every step parses, none has been executed.
  const KEY = "liferpg-state-v1";
  const readState = () => page.evaluate((k) => { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } }, KEY);
  const writeState = (st) => page.evaluate((k, s) => localStorage.setItem(k, JSON.stringify(s)), KEY, st);
  // Every check step ends here: the save it started from, no permission override, a fresh load. Used by the check
  // steps' `finally`; it must live at file level — 2026-09-25 (it was declared inside the takeover step's callback).
  const restore = async (saved) => {
    await writeState(saved);
    await page.browser().defaultBrowserContext().clearPermissionOverrides();
    await h.reload();
  };
  const dstrIn = (delta) => page.evaluate((d) => {
    const t = new Date(); t.setHours(12, 0, 0, 0); t.setDate(t.getDate() + d);
    const pad = (n) => String(n).padStart(2, "0");
    return [t.getFullYear(), pad(t.getMonth() + 1), pad(t.getDate())].join("-");
  }, delta);
  // The top-level keys whose JSON differs, `lastTick` excepted.
  const changedKeys = (a, b) => [...new Set([...Object.keys(a), ...Object.keys(b)])]
    .filter((k) => k !== "lastTick" && JSON.stringify(a[k]) !== JSON.stringify(b[k])).sort();
  const origin = () => new URL(page.url()).origin;
  const checkEntry = () => page.evaluate(async () => {
    try { const r = await (await caches.open("life-check")).match("./__check-summary"); return r ? await r.json() : null; } catch { return null; }
  });
  // A settings-sheet switch row by its label: the checkbox state, and a click on it. `checkBox` is the check-notification
  // row; `pushBox` (2026-09-25) the daily-push row.
  const switchBox = (labelText, click = false) => page.evaluate((t, c) => {
    const ov = [...document.querySelectorAll(".fixed.inset-0")].pop();
    const label = ov && [...ov.querySelectorAll("label")].find((l) => (l.innerText || "").trim() === t);
    const box = label?.querySelector('input[type="checkbox"]');
    if (!box) return null;
    if (c) box.click();
    return { checked: box.checked, disabled: box.disabled };
  }, labelText, click);
  const checkBox = (click = false) => switchBox("확인 필요 알림", click);
  const pushBox = (click = false) => switchBox("매일 푸시 알림", click);
  const until = async (ms, fn) => {
    const t0 = Date.now();
    while (Date.now() - t0 < ms) { const v = await fn(); if (v) return v; await sleep(250); }
    return null;
  };

  await step("the check-notification switch writes settings.checkNotify only and, with permission granted, writes the life-check cache entry", async () => {
    const saved = await readState();
    const today = await dstrIn(0);
    try {
      await page.browser().defaultBrowserContext().overridePermissions(origin(), ["notifications"]);
      const planted = structuredClone(saved);
      planted.work = [{ id: "e2e-check-carried", date: await dstrIn(-1), title: "E2E 이월 확인", done: false, createdAt: await dstrIn(-1), track: "biz" }];
      planted.act = { ...planted.act, briefingSeen: today };
      delete planted.settings?.checkNotify;
      await writeState(planted);
      await h.reload();
      await h.openSettings();
      await expectText("확인 알림");
      if (!(await h.overlayText()).includes("설치된 앱에서만 주기 갱신이 돼요")) throw new Error("the periodic-sync caption is missing (headless Chrome is not an installed app)");
      const box0 = await checkBox();
      if (!box0 || box0.checked || box0.disabled) throw new Error("the switch is not an enabled, unchecked box: " + JSON.stringify(box0));

      const before = await readState();
      await checkBox(true);
      await sleep(2500); // the refresh effect's debounce, then the cache write
      const after = await readState();
      if (JSON.stringify(changedKeys(before, after)) !== JSON.stringify(["settings"])) throw new Error("switch-on moved: " + JSON.stringify(changedKeys(before, after)));
      if (after.settings.checkNotify !== true) throw new Error("settings.checkNotify is " + after.settings.checkNotify);
      if (after.settings.workInAi !== before.settings.workInAi || after.settings.bizHoursPerWeek !== before.settings.bizHoursPerWeek) throw new Error("switch-on moved another setting: " + JSON.stringify(after.settings));
      const entry = await until(4000, checkEntry);
      if (!entry) throw new Error("no life-check cache entry after switch-on");
      if (!/^인생 관리 — 확인 필요 \d가지$/.test(entry.title || "")) throw new Error("entry title: " + entry.title);
      if (!(entry.body || "").includes("이월 업무 1건: E2E 이월 확인")) throw new Error("entry body lacks the carried line: " + entry.body);
      if ((entry.body || "").includes("오늘 읽을 것 안 봄")) throw new Error("the reader was seen today, the body says it was not: " + entry.body);
      if (typeof entry.ts !== "number") throw new Error("entry ts is " + typeof entry.ts);
      // Soft: headless Chrome may not surface notifications to getNotifications; the number is recorded, not asserted.
      h.metrics.checkNotificationsShown = await page.evaluate(async () => {
        try { return (await (await navigator.serviceWorker.ready).getNotifications({ tag: "life-check" })).length; } catch { return -1; }
      });

      const before2 = await readState();
      await checkBox(true);
      await sleep(800);
      const after2 = await readState();
      if (after2.settings.checkNotify !== false) throw new Error("switch-off left settings.checkNotify " + after2.settings.checkNotify);
      if (JSON.stringify(changedKeys(before2, after2)) !== JSON.stringify(["settings"])) throw new Error("switch-off moved: " + JSON.stringify(changedKeys(before2, after2)));
      if (await checkEntry()) throw new Error("switch-off left the cache entry");
      await closeModal();
    } finally {
      await restore(saved);
    }
  });

  await step("a denied permission leaves the switch off and writes nothing", async () => {
    const saved = await readState();
    try {
      // Every permission not listed is refused; the stub stands in for the prompt a real browser would show.
      await page.browser().defaultBrowserContext().overridePermissions(origin(), []);
      await h.openSettings();
      await page.evaluate(() => { Notification.requestPermission = () => Promise.resolve("denied"); });
      const before = await readState();
      await checkBox(true);
      await sleep(600);
      const after = await readState();
      if (after.settings && "checkNotify" in after.settings) throw new Error("a refused permission wrote settings.checkNotify = " + after.settings.checkNotify);
      if (JSON.stringify(changedKeys(before, after)) !== "[]") throw new Error("a refused permission moved: " + JSON.stringify(changedKeys(before, after)));
      await expectText("알림 권한이 꺼져 있어요 — 폰 설정에서 허용해요");
      const box = await checkBox();
      if (!box || box.checked) throw new Error("the switch reads checked after a refusal: " + JSON.stringify(box));
      await closeModal();
    } finally {
      await restore(saved);
    }
  });

  // ── The first-open stamp (2026-09-25): `act.opened[today]` written once at boot, pruned to 60 days, never overwritten
  // the same day; the settings sheet's `자동 실행` section and the gate's first-open line. Written, not run.
  const ROUTINE_STEPS = [
    "설정 › 모드 및 루틴 › 루틴 › + 를 눌러요",
    "조건: 시간 — 08:00, 매일 (두 번째 루틴은 20:00)",
    "실행: 앱 열기 — 인생 관리를 골라요",
    "저장하고 루틴을 켜요",
    "배터리 › 백그라운드 사용 제한 › 절전 예외 앱에 인생 관리를 더해요",
  ];
  const ROUTINE_CAPTIONS = [
    "앱은 스스로 열리지 않아요 — 정해진 시각에 여는 것은 폰의 루틴이에요.",
    "첫 실행 시각은 앱이 열릴 때 기록돼요. 루틴이 연 것인지 직접 연 것인지는 구분하지 못해요.",
  ];
  // The `자동 실행` section's `<ol>` items, read off the settings sheet.
  const routineItems = () => page.evaluate(() => {
    const ov = [...document.querySelectorAll(".fixed.inset-0")].pop();
    const label = ov && [...ov.querySelectorAll("div")].find((d) => (d.innerText || "").trim() === "자동 실행");
    const ol = label?.parentElement?.querySelector("ol");
    return ol ? [...ol.querySelectorAll("li")].map((li) => (li.innerText || "").trim()) : null;
  });

  await step("the first open of a day stamps act.opened[today] once as HH:MM, prunes keys older than 60 days, keeps a same-day stamp on reload, and the settings sheet states the line and the five routine steps", async () => {
    const saved = await readState();
    const today = await dstrIn(0);
    try {
      // Two planted stamps, one just outside the keep window and one on its edge; today's key is absent.
      const old = await dstrIn(-61), edge = await dstrIn(-60);
      const planted = structuredClone(saved);
      planted.act = { ...planted.act, opened: { [old]: "07:00", [edge]: "07:00" } };
      await writeState(planted);
      await h.reload();
      const after = await readState();
      const stamp = after.act?.opened?.[today];
      if (!/^\d\d:\d\d$/.test(stamp || "")) throw new Error("no HH:MM stamp for today after the load: " + JSON.stringify(after.act?.opened));
      if (old in after.act.opened) throw new Error("the 61-day-old key survived the stamp write: " + JSON.stringify(after.act.opened));
      if (after.act.opened[edge] !== "07:00") throw new Error("the 60-day-old key was dropped: " + JSON.stringify(after.act.opened));
      if (JSON.stringify(changedKeys(planted, after)) !== JSON.stringify(["act"])) throw new Error("the stamp moved another key: " + JSON.stringify(changedKeys(planted, after)));
      const actSansOpened = (a) => { const { opened, ...rest } = a || {}; return JSON.stringify(rest); };
      if (actSansOpened(after.act) !== actSansOpened(planted.act)) throw new Error("the stamp moved another act key: " + actSansOpened(after.act));

      // A same-day reload never overwrites the stamp.
      after.act.opened[today] = "00:01";
      await writeState(after);
      await h.reload();
      const again = await readState();
      if (again.act?.opened?.[today] !== "00:01") throw new Error("a same-day reload overwrote the stamp: " + again.act?.opened?.[today]);

      // The settings sheet: the line, the five steps in order, both captions, the section between `AI 요청문` and `확인 알림`.
      const month = Object.keys(again.act.opened).filter((d) => d.startsWith(today.slice(0, 7))).length;
      await h.openSettings();
      const text = await h.overlayText();
      if (!text.includes("자동 실행")) throw new Error("the settings sheet lacks the section: " + text.slice(0, 200));
      if (!text.includes(`오늘 첫 실행 00:01 · 이번 달 실행 ${month}일`)) throw new Error("the first-open line is missing or wrong: " + text.slice(0, 600));
      const items = await routineItems();
      if (JSON.stringify(items) !== JSON.stringify(ROUTINE_STEPS)) throw new Error("the routine steps differ: " + JSON.stringify(items));
      for (const cap of ROUTINE_CAPTIONS) if (!text.includes(cap)) throw new Error("a caption is missing: " + cap);
      const order = ["AI 요청문", "자동 실행", "확인 알림"].map((t) => text.indexOf(t));
      if (!(order[0] >= 0 && order[0] < order[1] && order[1] < order[2])) throw new Error("the section order is wrong: " + JSON.stringify(order));
      await closeModal();
    } finally {
      await restore(saved);
    }
  });

  await step("the gate states today's first-open time under its title, from the stamp the same load wrote", async () => {
    const saved = await readState();
    const today = await dstrIn(0);
    try {
      const planted = structuredClone(saved);
      if (planted.act?.gate) delete planted.act.gate[today];
      if (planted.act?.opened) delete planted.act.opened[today];
      await writeState(planted);
      await h.reload({}, { keepModal: true, keepGate: true });
      await sleep(400);
      const gate = await page.evaluate(() => (document.querySelector(".fixed.inset-0")?.innerText || "").trim());
      if (!gate.startsWith(`오늘의 관문 — ${today}`)) throw new Error("the gate is not the first overlay: " + gate.slice(0, 80));
      const line = gate.split("\n").map((l) => l.trim()).filter(Boolean)[1] || "";
      if (!/^오늘 첫 실행 \d\d:\d\d$/.test(line)) throw new Error("the second line is not the first-open line: " + line);
      const st = await readState();
      if (st.act?.opened?.[today] !== line.slice(-5)) throw new Error("the shown time differs from the stamp: " + JSON.stringify(st.act?.opened));
    } finally {
      await writeState(saved);
      await h.reload();
    }
  });

  // ── The daily push (2026-09-25): headless Chrome has no push service, so `pushManager` is stubbed at document start and
  // a push is delivered through CDP; the steps assert what the app controls — the subscribe options and key bytes, the
  // write order, the settings copy, the raw save, the cache entry, no navigation and no request. The real path was proven
  // once on desktop (the plan's throwaway (f)). Written, not run.
  const SECRET_STEPS = [
    "GitHub 저장소의 Settings › Secrets and variables › Actions를 열어요",
    "New repository secret을 누르고 Name에 PUSH_SUBSCRIPTION을 적어요",
    "Secret 칸에 복사한 구독 정보를 그대로 붙여넣고 Add secret을 눌러요",
    "Actions › Daily push › Run workflow로 한 번 보내 봐요",
  ];
  // The key send.mjs signs with, decoded the way the app decodes it (base64url → bytes): the subscribe call must carry it.
  const sendKey = (fs.readFileSync(path.join(__dirname, "..", "push", "send.mjs"), "utf8").match(/PUSH_VAPID_PUBLIC = "([^"]+)"/) || [])[1];
  const keyBytes = (key) => {
    const pad = "=".repeat((4 - (key.length % 4)) % 4);
    return Array.from(Buffer.from((key + pad).replace(/-/g, "+").replace(/_/g, "/"), "base64"));
  };
  // A push-manager stub installed before the app loads: records every call into `window.__pushCalls`, resolves `subscribe`
  // after 800 ms (so the write order is observable) or rejects when `refuse`; `window.__pushSub` is the one subscription.
  const installPushStub = (pg, { refuse = false } = {}) => pg.evaluateOnNewDocument((refuseIt) => {
    window.PushManager = window.PushManager || function PushManager() {};
    window.__pushSub = null;
    window.__pushCalls = [];
    const stub = {
      getSubscription() { return Promise.resolve(window.__pushSub); },
      subscribe(opts) {
        window.__pushCalls.push({ userVisibleOnly: opts.userVisibleOnly, key: Array.from(new Uint8Array(opts.applicationServerKey)) });
        if (refuseIt) return Promise.reject(new Error("e2e refuse"));
        return new Promise((resolve) => setTimeout(() => {
          window.__pushSub = {
            endpoint: "https://push.example/send/e2e-abcdef123456",
            toJSON() { return { endpoint: this.endpoint, expirationTime: null, keys: { p256dh: "e2e-p256dh", auth: "e2e-auth" } }; },
            unsubscribe() { window.__pushCalls.push({ unsubscribe: true }); window.__pushSub = null; return Promise.resolve(true); },
          };
          resolve(window.__pushSub);
        }, 800));
      },
    };
    Object.defineProperty(ServiceWorkerRegistration.prototype, "pushManager", { configurable: true, get() { return stub; } });
  }, refuse);
  const pushCalls = () => page.evaluate(() => window.__pushCalls || []);
  const subscribeCount = (calls) => calls.filter((c) => "userVisibleOnly" in c).length;
  const toastText = () => page.evaluate(() => (document.querySelector(".fixed.bottom-16")?.innerText || "").trim());

  await step("the push switch subscribes with the app's public key, writes settings.pushNotify only after the subscription resolved, states the subscription, copies it, and never lets it into the save", async () => {
    const saved = await readState();
    try {
      await page.browser().defaultBrowserContext().overridePermissions(origin(), ["notifications"]);
      await installPushStub(page);
      await page.evaluateOnNewDocument(() => { navigator.clipboard.writeText = (t) => { window.__copied = t; return Promise.resolve(); }; });
      const planted = structuredClone(saved);
      if (planted.settings) delete planted.settings.pushNotify;
      await writeState(planted);
      await h.reload();
      await h.openSettings();
      const text = await h.overlayText();
      const order = ["확인 알림", "푸시 알림", "오늘의 관문"].map((t) => text.indexOf(t));
      if (!(order[0] >= 0 && order[0] < order[1] && order[1] < order[2])) throw new Error("the section order is wrong: " + JSON.stringify(order));
      if (!text.includes("설치된 앱이 아니에요 — 알림을 누르면 Chrome 탭으로 열려요")) throw new Error("the tab caption is missing (headless Chrome is not an installed app)");
      if (text.includes("이 브라우저에서는 푸시를 쓸 수 없어요")) throw new Error("the no-push caption is shown although the stubbed push manager exists");
      const box0 = await pushBox();
      if (!box0 || box0.checked || box0.disabled) throw new Error("the push switch is not an enabled, unchecked box: " + JSON.stringify(box0));

      // The write waits for `subscribe`: nothing at 400 ms, `true` once the 800 ms stub resolved.
      const before = await readState();
      await pushBox(true);
      await sleep(400);
      const mid = await readState();
      if (mid.settings && "pushNotify" in mid.settings) throw new Error("settings.pushNotify was written before subscribe resolved: " + mid.settings.pushNotify);
      await sleep(900);
      const after = await readState();
      if (after.settings?.pushNotify !== true) throw new Error("settings.pushNotify is " + after.settings?.pushNotify);
      if (JSON.stringify(changedKeys(before, after)) !== JSON.stringify(["settings"])) throw new Error("switch-on moved: " + JSON.stringify(changedKeys(before, after)));
      if (after.settings.checkNotify !== before.settings.checkNotify || after.settings.workInAi !== before.settings.workInAi) throw new Error("switch-on moved another setting: " + JSON.stringify(after.settings));
      const calls = await pushCalls();
      if (subscribeCount(calls) !== 1 || calls[0].userVisibleOnly !== true) throw new Error("subscribe options: " + JSON.stringify(calls));
      const expected = keyBytes(sendKey || "");
      if (expected.length !== 65 || expected[0] !== 4) throw new Error("send.mjs's key is not a 65-byte uncompressed point: " + expected.length);
      if (JSON.stringify(calls[0].key) !== JSON.stringify(expected)) throw new Error("the subscribe key differs from send.mjs's public key");

      // The sheet states the subscription, shows it on request and copies it; the save never carries it.
      if (!(await h.overlayText()).includes("구독 등록됨 · …abcdef123456")) throw new Error("the status line is missing: " + (await h.overlayText()).slice(0, 800));
      await h.clickInModalExact("구독 정보 보기 ›");
      const shown = await page.evaluate(() => {
        const ta = document.querySelector('textarea[aria-label="푸시 구독 정보"]');
        const ol = ta?.closest("div")?.querySelector("ol");
        return ta ? { value: ta.value, items: ol ? [...ol.querySelectorAll("li")].map((li) => (li.innerText || "").trim()) : null } : null;
      });
      if (!shown) throw new Error("the subscription textarea did not open");
      let subJson = null;
      try { subJson = JSON.parse(shown.value); } catch { throw new Error("the textarea is not JSON: " + shown.value.slice(0, 120)); }
      if (!subJson.endpoint || !subJson.keys?.p256dh || !subJson.keys?.auth) throw new Error("the subscription JSON lacks a field: " + shown.value.slice(0, 200));
      if (JSON.stringify(shown.items) !== JSON.stringify(SECRET_STEPS)) throw new Error("the secret steps differ: " + JSON.stringify(shown.items));
      await h.clickInModalExact("복사");
      const copied = await page.evaluate(() => window.__copied);
      if (copied !== shown.value) throw new Error("the copied text differs from the textarea");
      if (!(await toastText()).includes("복사했어요 — 저장소 비밀에 붙여넣어요")) throw new Error("the copy toast is missing: " + (await toastText()));
      const raw = await page.evaluate((k) => localStorage.getItem(k) || "", KEY);
      if (raw.includes("push.example") || raw.includes("e2e-p256dh")) throw new Error("the subscription entered the save");

      // Off: unsubscribe first, then `false`; the status line goes.
      const before2 = await readState();
      await pushBox(true);
      await sleep(600);
      const after2 = await readState();
      if (after2.settings?.pushNotify !== false) throw new Error("switch-off left settings.pushNotify " + after2.settings?.pushNotify);
      if (JSON.stringify(changedKeys(before2, after2)) !== JSON.stringify(["settings"])) throw new Error("switch-off moved: " + JSON.stringify(changedKeys(before2, after2)));
      const calls2 = await pushCalls();
      if (JSON.stringify(calls2[calls2.length - 1]) !== JSON.stringify({ unsubscribe: true })) throw new Error("switch-off did not unsubscribe: " + JSON.stringify(calls2));
      if ((await h.overlayText()).includes("구독 등록됨")) throw new Error("the status line survived switch-off");
      await closeModal();
    } finally {
      await restore(saved);
    }
  });

  await step("a refused subscribe leaves the push switch off and writes nothing; a denied permission does the same and never touches checkNotify", async () => {
    const saved = await readState();
    try {
      await page.browser().defaultBrowserContext().overridePermissions(origin(), ["notifications"]);
      await installPushStub(page, { refuse: true });
      const planted = structuredClone(saved);
      if (planted.settings) delete planted.settings.pushNotify;
      await writeState(planted);
      await h.reload();
      await h.openSettings();
      const before = await readState();
      await pushBox(true);
      await sleep(600);
      const after = await readState();
      if (after.settings && "pushNotify" in after.settings) throw new Error("a refused subscribe wrote settings.pushNotify = " + after.settings.pushNotify);
      if (JSON.stringify(changedKeys(before, after)) !== "[]") throw new Error("a refused subscribe moved: " + JSON.stringify(changedKeys(before, after)));
      await expectText("푸시 구독에 실패했어요 — 설치된 앱(Chrome)에서 다시 켜요");
      const box = await pushBox();
      if (!box || box.checked) throw new Error("the switch reads checked after a refused subscribe: " + JSON.stringify(box));
      const n1 = subscribeCount(await pushCalls());
      if (n1 !== 1) throw new Error("subscribe was called " + n1 + " time(s)");

      // A denied permission: the stub stands in for the prompt; nothing is written and `subscribe` is never reached.
      await page.browser().defaultBrowserContext().overridePermissions(origin(), []);
      await page.evaluate(() => { Notification.requestPermission = () => Promise.resolve("denied"); });
      await pushBox(true);
      await sleep(600);
      const after2 = await readState();
      await expectText("알림 권한이 꺼져 있어요 — 폰 설정에서 허용해요");
      if (after2.settings && "pushNotify" in after2.settings) throw new Error("a refused permission wrote settings.pushNotify = " + after2.settings.pushNotify);
      if (JSON.stringify(changedKeys(before, after2)) !== "[]") throw new Error("a refused permission moved: " + JSON.stringify(changedKeys(before, after2)));
      if (after2.settings?.checkNotify !== before.settings?.checkNotify) throw new Error("checkNotify moved: " + after2.settings?.checkNotify);
      if (subscribeCount(await pushCalls()) !== n1) throw new Error("subscribe was called after a refused permission");
      await closeModal();
    } finally {
      await restore(saved);
    }
  });

  await step("a delivered push shows the cached text only: no payload read, no request, no navigation, the cache entry unchanged", async () => {
    const saved = await readState();
    const today = await dstrIn(0);
    let cdp = null;
    let navs = 0, reqs = 0;
    const onNav = (f) => { if (f === page.mainFrame()) navs++; };
    const onReq = () => { reqs++; };
    try {
      // No push stub is needed: the worker handles the push; the earlier steps' document scripts are harmless here.
      await page.browser().defaultBrowserContext().overridePermissions(origin(), ["notifications"]);
      const planted = structuredClone(saved);
      planted.settings = { ...(planted.settings || {}), checkNotify: true };
      planted.work = [{ id: "e2e-push-carried", date: await dstrIn(-1), title: "E2E 푸시 이월", done: false, createdAt: await dstrIn(-1), track: "biz" }];
      planted.act = { ...planted.act, briefingSeen: today };
      await writeState(planted);
      await h.reload();
      await sleep(2500); // the refresh effect's debounce, then the cache write
      const entryBefore = await until(4000, checkEntry);
      if (!entryBefore) throw new Error("no life-check cache entry to show");
      cdp = await page.createCDPSession();
      const regs = [];
      cdp.on("ServiceWorker.workerRegistrationUpdated", (e) => regs.push(...e.registrations));
      await cdp.send("ServiceWorker.enable");
      await sleep(500);
      const reg = regs.find((r) => r.scopeURL.startsWith(origin()) && !r.isDeleted);
      if (!reg) throw new Error("no worker registration for the origin: " + JSON.stringify(regs.map((r) => r.scopeURL)));
      page.on("framenavigated", onNav);
      page.on("request", onReq);
      await cdp.send("ServiceWorker.deliverPushMessage", { origin: origin(), registrationId: reg.registrationId, data: JSON.stringify({ open: "issues", secret: "PUSH-PAYLOAD-SENTINEL" }) });
      await sleep(1500);
      page.off("framenavigated", onNav);
      page.off("request", onReq);
      if (navs !== 0) throw new Error("the push navigated the page " + navs + " time(s)");
      if (reqs !== 0) throw new Error("the push made " + reqs + " request(s) from the page");
      if (JSON.stringify(await checkEntry()) !== JSON.stringify(entryBefore)) throw new Error("the push changed the cache entry");
      // Soft: headless Chrome may not surface shown notifications; the number is recorded, and asserted only when above zero.
      const notes = await page.evaluate(async () => {
        try { return (await (await navigator.serviceWorker.ready).getNotifications({ tag: "life-check" })).map((n) => ({ title: n.title, body: n.body, data: n.data })); } catch { return null; }
      });
      h.metrics.pushNotificationsShown = notes ? notes.length : -1;
      if (notes && notes.length) {
        const n0 = notes[0];
        if (n0.title !== entryBefore.title || n0.body !== entryBefore.body) throw new Error("the shown notification is not the cached text: " + JSON.stringify(n0));
        if (n0.data?.open !== "issues") throw new Error("the notification does not name the issue list: " + JSON.stringify(n0.data));
        if (JSON.stringify(n0).includes("PUSH-PAYLOAD-SENTINEL")) throw new Error("the payload reached the notification");
      }
      const sw = await page.evaluate(async () => (await fetch("./sw.js", { cache: "no-store" })).text());
      const at = sw.indexOf('addEventListener("push"');
      const pushBlock = at >= 0 ? sw.slice(at, sw.indexOf("});", at)) : "";
      if (!pushBlock || /e\.data|fetch\(|\.json\(/.test(pushBlock)) throw new Error("the served push handler reads the payload or makes a request: " + pushBlock);
    } finally {
      page.off("framenavigated", onNav);
      page.off("request", onReq);
      if (cdp) { try { await cdp.detach(); } catch { /* already detached */ } }
      await restore(saved);
    }
  });

  await step("?open=issues and ?open=reader open the named screen and strip the query; the served worker routes a tap to issues", async () => {
    const saved = await readState();
    const base = page.url().split("?")[0];
    try {
      // This step navigates with `page.goto`, not `reload`, so today's gate stamp (2026-09-24) is planted here by hand.
      const today = await dstrIn(0);
      await writeState({ ...saved, act: { ...saved.act, briefingSeen: today, gate: { ...(saved.act.gate || {}), [today]: { passedAt: "00:00" } } } });
      // Each param names its own screen: the issue list (Phase 3 of the 2026-09-22 plan) and the reader.
      for (const [open, title] of [["issues", "이슈 목록"], ["reader", "오늘 읽을 것 —"]]) {
        await page.goto(`${base}?open=${open}`, { waitUntil: "networkidle2" });
        await sleep(400);
        const sheet = await page.evaluate(() => ([...document.querySelectorAll(".fixed.inset-0")].pop()?.innerText || "").trim());
        if (!sheet.startsWith(title)) throw new Error(`?open=${open} opened another screen: ${sheet.slice(0, 80)}`);
        const search = await page.evaluate(() => location.search);
        if (search !== "") throw new Error(`?open=${open} left the query: ${search}`);
        await closeModal();
      }
      await h.reload({ waitUntil: "networkidle2" }, { keepModal: true });
      if (await page.evaluate(() => document.querySelectorAll(".fixed.inset-0").length)) throw new Error("a reload without the param opened a screen on a seen-today save");
      const sw = await page.evaluate(async () => (await fetch("./sw.js", { cache: "no-store" })).text());
      for (const t of ['open: "issues"', '"./?open=issues"', "periodicsync", "notificationclick", "k !== CHECK_CACHE", 'addEventListener("push"', "const showCheck", "showCheck(true)"]) {
        if (!sw.includes(t)) throw new Error("the served sw.js lacks " + t);
      }
      if (sw.includes("location.reload") || sw.includes("controllerchange")) throw new Error("the served sw.js reloads a client");
    } finally {
      await writeState(saved);
      await h.reload();
    }
  });

  await step("the app opens with the network disabled", async () => {
    await page.setOfflineMode(true);
    try {
      await h.reload({ waitUntil: "domcontentloaded" });
      await sleep(900);
      const shown = await page.evaluate(() => document.body.innerText.length > 40);
      if (!shown) throw new Error("blank page while offline");
      await expectText("LIFE MANAGER");
    } finally {
      await page.setOfflineMode(false);
    }
    await h.reload();
  });

  await step("backup export writes the state to a file", async () => {
    await h.openSettings(); // backup sits in the settings sheet behind the corner button of the home CV
    await expectText("백업");
    // Capture the download without touching the filesystem: the shared helper stubs the anchor click and reads the blob.
    const dl = await captureDownload(() => h.clickInModal("백업 내보내기"));
    const dump = dl && dl.text;
    if (!dump) throw new Error("no backup blob was produced");
    let data;
    try { data = JSON.parse(dump); } catch { throw new Error("backup is not valid JSON"); }
    if (data.app !== "life-manager") throw new Error("backup lacks its app marker");
    if (data.state?.v !== 28) throw new Error("backup schema version " + data.state?.v + " (expected 28)");
    if (!Array.isArray(data.state?.tasks) || !data.state.tasks.length) throw new Error("backup carries no tasks");
    if (typeof data.images !== "object") throw new Error("backup carries no image map");
    // v28 Phase 3: the time log and the weekly budget travel with the save.
    if (!Array.isArray(data.state?.timeLog)) throw new Error("backup carries no time log");
    if (!Number.isFinite(data.state?.settings?.bizHoursPerWeek)) throw new Error("backup carries no weekly business budget: " + JSON.stringify(data.state?.settings));
    await page.evaluate((d) => { window.__savedBackup = d; }, dump);
    await closeModal();
  });

  await step("backup import restores the saved state", async () => {
    const before = await page.evaluate(() => JSON.parse(localStorage.getItem("liferpg-state-v1")).tasks.length);
    // Change the save, then restore the captured backup through the same code path the file input uses.
    await page.evaluate(() => {
      const s = JSON.parse(localStorage.getItem("liferpg-state-v1"));
      s.tasks = s.tasks.slice(0, 1);
      localStorage.setItem("liferpg-state-v1", JSON.stringify(s));
    });
    await h.reload();
    await page.evaluate(() => { window.confirm = () => true; });
    const restored = await page.evaluate(async (dump) => {
      const input = document.querySelector('input[type="file"][accept*="json"]');
      if (!input) return "no import input";
      const file = new File([dump], "backup.json", { type: "application/json" });
      const dt = new DataTransfer();
      dt.items.add(file);
      input.files = dt.files;
      input.dispatchEvent(new Event("change", { bubbles: true }));
      return "dispatched";
    }, await page.evaluate(() => window.__savedBackup));
    if (restored !== "dispatched") throw new Error(restored);
    await sleep(1200);
    await closeModal();
    const after = await page.evaluate(() => JSON.parse(localStorage.getItem("liferpg-state-v1")).tasks.length);
    if (after !== before) errors.push(`restored task count ${after}, expected ${before}`);
    // v28 Phase 3: the restored save states the backup's time log and budget.
    const travelled = await page.evaluate(() => {
      const s = JSON.parse(localStorage.getItem("liferpg-state-v1"));
      const b = JSON.parse(window.__savedBackup).state;
      return JSON.stringify(s.timeLog) === JSON.stringify(b.timeLog) && JSON.stringify(s.settings) === JSON.stringify(b.settings);
    });
    if (!travelled) errors.push("the restored save does not carry the backup's timeLog and settings");
  });
};
