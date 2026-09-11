// Installable app — the service worker registers and controls the page, the app still opens with the
// network disabled, and a backup round-trips. Runs last: it toggles offline mode and reloads.
module.exports = async (h) => {
  const { step, clickText, clickTab, expectText, closeModal, sleep, page, errors } = h;

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
    await clickTab("성장");
    await expectText("백업");
    // Capture the download without touching the filesystem: stub the anchor click and read the blob.
    await page.evaluate(() => {
      window.__backup = null;
      const realCreate = URL.createObjectURL.bind(URL);
      URL.createObjectURL = (blob) => { blob.text().then((t) => { window.__backup = t; }); return realCreate(blob); };
      const proto = HTMLAnchorElement.prototype;
      window.__realClick = proto.click;
      proto.click = function () { if (!this.download) return window.__realClick.call(this); };
    });
    await clickText("백업 내보내기");
    await sleep(900);
    const dump = await page.evaluate(() => window.__backup);
    await page.evaluate(() => { HTMLAnchorElement.prototype.click = window.__realClick; });
    if (!dump) throw new Error("no backup blob was produced");
    let data;
    try { data = JSON.parse(dump); } catch { throw new Error("backup is not valid JSON"); }
    if (data.app !== "life-manager") throw new Error("backup lacks its app marker");
    if (data.state?.v !== 18) throw new Error("backup schema version " + data.state?.v + " (expected 18)");
    if (!Array.isArray(data.state?.tasks) || !data.state.tasks.length) throw new Error("backup carries no tasks");
    if (typeof data.images !== "object") throw new Error("backup carries no image map");
    await page.evaluate((d) => { window.__savedBackup = d; }, dump);
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
  });
};
