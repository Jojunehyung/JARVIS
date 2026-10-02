// The image backend and the backup reminder (2026-10-02). Part 1 (Phase 1): photos (`liferpg-img-*`) live in IndexedDB
// (database `life-manager`, store `kv`) behind the `store` adapter under their unchanged keys; a photo written after the
// update adds nothing to localStorage; photos an older build left in localStorage are copied on boot and read back, and
// — under the user's option B — their localStorage copies stay until a backup export; IndexedDB wins over a stale
// localStorage copy; the settings data section states the record storage against 4.5MB, the photo storage, the eviction
// caption and the copies left behind; a portfolio image saves while the records sit at the budget; a task removal
// clears both backends. Part 2 (Phase 2): a backup export stamps `act.backupAt` in the save and the file, writes every
// photo into the file and — option B — removes the localStorage copies of exactly those photos once IndexedDB reads back
// the same value; an import restores the photos into IndexedDB; a missing or 7-day-old stamp puts `백업` first in the
// reader and the backup line last in the cached `확인 필요` text. Runs after flow12 and before flow4, which replaces the
// save. The preview build serves over `http:`, so the IndexedDB path is the one under test (the single-file demo's
// `file:` stays on localStorage).
// Written under the standing instruction that the suite is not run: every step parses, none has been executed.
module.exports = async (h) => {
  const { step, clickTab, clickText, clickInModal, clickInModalExact, clickExact, openTodo, overlayText, openSettings,
    attach, typeInto, closeModal, sleep, page, idbGet, idbKeys, idbPut, idbDel, idbClear, captureDownload } = h;
  const KEY = "liferpg-state-v1";
  const BUDGET = 4718592; // STORAGE_BUDGET = 4.5 × 1,048,576, counted in string length
  const readState = () => page.evaluate((k) => { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } }, KEY);
  const writeState = (st) => page.evaluate((k, s) => localStorage.setItem(k, JSON.stringify(s)), KEY, st);
  const localRaw = (k) => page.evaluate((key) => localStorage.getItem(key), k);
  const localPut = (k, v) => page.evaluate((key, val) => localStorage.setItem(key, JSON.stringify(val)), k, v);
  const localDel = (k) => page.evaluate((key) => localStorage.removeItem(key), k);
  const dstrIn = (delta) => page.evaluate((d) => {
    const t = new Date(); t.setHours(12, 0, 0, 0); t.setDate(t.getDate() + d);
    const two = (n) => String(n).padStart(2, "0");
    return `${t.getFullYear()}-${two(t.getMonth() + 1)}-${two(t.getDate())}`;
  }, delta);
  // Two valid, different PNG data URLs (a 1×1 and a 24×8) — planted values the app must hand back unchanged.
  const PNG_A = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
  const PNG_B = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABgAAAAICAIAAABsw6g0AAABNklEQVR4nAXBkQKAAAxAwXEcj+N4HMfjOB7H8TiOx/Hjcdx3dCciDMIoqDAJs2DCIqyCC5uwCyEcwimkcAm3UMIjILTwCp8gogzKqKgyKbNiyqKsiiubsiuhHMqppHIpt1LKo6C08iqfImIMxmioMRmzYcZirIYbm7EbYRzGaaRxGbdRxmNgtPEanyHiDM7oqDM5s2PO4qyOO5uzO+Eczumkczm3U87j4LTzOp8jEgzBGGgwBXNgwRKsgQdbsAcRHMEZZHAFd1DBExB08AZfIJIMyZhoMiVzYsmSrIknW7InkRzJmWRyJXdSyZOQdPImXyJSDMVYaDEVc2HFUqyFF1uxF1EcxVlkcRV3UcVTUHTxFl8h0gzN2GgzNXNjzdKsjTdbszfRHM3ZZHM1d1PN09B08zZf8wM8FzsQNTr4QAAAAABJRU5ErkJggg==";
  // The profile card's portrait sources on the profile tab.
  const portraitSrcs = async () => {
    await clickTab("프로필");
    await sleep(400);
    return page.evaluate(() => [...document.querySelectorAll("main img")].map((i) => i.getAttribute("src") || ""));
  };
  const uploadProfilePhoto = async () => {
    await clickTab("프로필");
    await clickText("프로필 편집"); await sleep(400);
    await clickInModal("사진 등록");
    await attach();
    await sleep(700);
    await closeModal();
  };
  // The done task the migration steps use: its photos are planted, read through `증거 보기`, then removed with it.
  let migrated = null;

  await step("a photo written after the update goes to IndexedDB under its own key and adds nothing to localStorage", async () => {
    await localDel("liferpg-img-profile");
    await uploadProfilePhoto();
    const v = await idbGet("liferpg-img-profile");
    if (!(typeof v === "string" && v.startsWith("data:image/jpeg"))) throw new Error("the profile photo is not in IndexedDB: " + String(v).slice(0, 40));
    if ((await localRaw("liferpg-img-profile")) !== null) throw new Error("the profile photo was also written to localStorage");
    await h.reload();
    await sleep(500);
    const srcs = await portraitSrcs();
    if (!srcs.includes(v)) throw new Error("the profile card does not render the IndexedDB photo after a reload: " + JSON.stringify(srcs.map((s) => s.slice(0, 30))));
  });

  await step("photos an older build left in localStorage are copied to IndexedDB on boot and read back identically", async () => {
    const st = await readState();
    const today = await dstrIn(0);
    const task = (st.tasks || []).find((t) => t.status === "done" && t.evidence && t.type !== "daily");
    if (!task) throw new Error("the save holds no completed task with evidence to plant photos for");
    migrated = { id: task.id, title: task.title };
    // Dated today, the completed task shows in today's list, where `증거 보기` sits in its sheet; step 6 removes the task.
    task.doneAt = today;
    await writeState(st);
    await idbClear();
    await localPut(`liferpg-img-ev-${task.id}`, PNG_A);
    await localPut(`liferpg-img-study-${task.id}-1`, PNG_B);
    await h.reload();
    await sleep(800);
    if ((await idbGet(`liferpg-img-ev-${task.id}`)) !== PNG_A) throw new Error("the evidence photo was not copied to IndexedDB identically");
    if ((await idbGet(`liferpg-img-study-${task.id}-1`)) !== PNG_B) throw new Error("the study photo was not copied to IndexedDB identically");
    // Option B (the user's answer, 2026-10-02): the boot copy never removes the localStorage copies.
    if ((await localRaw(`liferpg-img-ev-${task.id}`)) !== JSON.stringify(PNG_A)) throw new Error("the evidence photo's localStorage copy was removed on boot");
    if ((await localRaw(`liferpg-img-study-${task.id}-1`)) !== JSON.stringify(PNG_B)) throw new Error("the study photo's localStorage copy was removed on boot");
    await clickTab("할 일");
    await openTodo(task.title);
    await clickInModalExact("증거 보기");
    await sleep(900);
    const srcs = await page.evaluate(() => [...document.querySelectorAll(".fixed.inset-0 img")].map((i) => i.getAttribute("src") || ""));
    if (!srcs.includes(PNG_A) || !srcs.includes(PNG_B)) throw new Error("the evidence viewer does not show both migrated photos: " + srcs.length);
    await closeModal();
    await closeModal();
  });

  await step("IndexedDB wins over a stale localStorage copy, and a replaced photo leaves no localStorage copy", async () => {
    await localPut("liferpg-img-profile", PNG_A);
    await idbPut("liferpg-img-profile", PNG_B);
    await h.reload();
    await sleep(600);
    const srcs = await portraitSrcs();
    if (!srcs.includes(PNG_B) || srcs.includes(PNG_A)) throw new Error("the profile card did not render the IndexedDB value over the localStorage copy");
    await uploadProfilePhoto();
    const v = await idbGet("liferpg-img-profile");
    if (!(typeof v === "string" && v.startsWith("data:image/jpeg"))) throw new Error("the replacement photo is not in IndexedDB: " + String(v).slice(0, 40));
    if ((await localRaw("liferpg-img-profile")) !== null) throw new Error("the replaced photo left its localStorage copy behind");
  });

  await step("the settings data section states the record storage against 4.5MB, the photo storage and the eviction caption", async () => {
    await openSettings();
    await sleep(400);
    const sheet = await overlayText();
    if (!/저장 공간 \d+\.\dMB \/ 4\.5MB · 사진 \d+\.\dMB/.test(sheet)) throw new Error("the settings storage line: " + sheet.slice(0, 300));
    if (!sheet.includes("사진 저장소: 기기 사정으로 지워질 수 있어요 — 백업 파일에 포함돼요")) throw new Error("the eviction caption is missing");
    await closeModal();
    // Step 2 left two localStorage copies; with only one planted copy the line counts one.
    if (!migrated) throw new Error("step 2 did not run");
    await localDel(`liferpg-img-study-${migrated.id}-1`);
    await openSettings();
    await sleep(400);
    if (!(await overlayText()).includes("기록 공간에 남은 이전 사진 사본 1장")) throw new Error("the copies line does not count the one localStorage copy left");
    await closeModal();
  });

  await step("a portfolio image saves while the records sit at the budget, because photos no longer count against it", async () => {
    try {
      await page.evaluate((budget) => {
        let used = 0;
        for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); used += k.length + (localStorage.getItem(k) || "").length; }
        localStorage.setItem("e2e-filler", "x".repeat(Math.max(0, budget - used - 50)));
      }, BUDGET);
      await clickTab("사업");
      await clickExact("포트폴리오");
      await clickText("포트폴리오 추가"); await sleep(400);
      await typeInto("제목", "e2e image at budget");
      const pickErr = await h.dropImage(PNG_B.split(",")[1], "wide.png");
      if (pickErr) throw new Error("the image was refused at pick time: " + pickErr);
      await clickInModalExact("등록");
      await sleep(3200); // the image warning toast is delayed 2.7 s after the record toast
      if (await h.hasText("저장 공간이 부족해요")) throw new Error("the portfolio image was refused against the record budget");
      const item = ((await readState()).folio || []).find((f) => f.title === "e2e image at budget");
      if (!item) throw new Error("the portfolio entry was not stored");
      const v = await idbGet(`liferpg-img-folio-${item.id}`);
      if (!(typeof v === "string" && v.startsWith("data:image"))) throw new Error("the portfolio image is not in IndexedDB");
    } finally {
      await page.evaluate(() => localStorage.removeItem("e2e-filler"));
      await h.reload();
    }
  });

  await step("task removal deletes its images from IndexedDB as well", async () => {
    if (!migrated) throw new Error("step 2 did not run");
    const { id, title } = migrated;
    // Plant the second photo again so the removal has both backends to clear.
    await idbPut(`liferpg-img-study-${id}-1`, PNG_B);
    await clickTab("할 일");
    await openTodo(title);
    await clickInModalExact("삭제");
    await sleep(800);
    if (((await readState()).tasks || []).some((t) => t.id === id)) throw new Error("the task survived its removal");
    const keys = await idbKeys();
    for (const k of [`liferpg-img-ev-${id}`, `liferpg-img-study-${id}-1`]) {
      if (keys.includes(k)) throw new Error(`${k} survived the task removal in IndexedDB`);
      if ((await localRaw(k)) !== null) throw new Error(`${k} survived the task removal in localStorage`);
    }
  });
  // ── Part 2 (Phase 2): the backup stamp, option B's removal after an export, the round trip, the reminder.
  const ORPHAN = "liferpg-img-ev-e2e-orphan"; // an image key no record names: never written into a file, never removed
  let exported = null; // { data, evKey, localOnlyKey, viewTitle } from step 7, imported in step 8
  const readerBlocks = async () => {
    await clickTab("프로필");
    await clickText("오늘 읽을 것"); await sleep(500);
    return page.evaluate(() => {
      const ov = [...document.querySelectorAll(".fixed.inset-0")].pop();
      return ov ? [...ov.querySelectorAll(".bg-zinc-950.rounded-xl")].map((b) => b.innerText.replace(/\s+/g, " ").trim()) : [];
    });
  };

  await step("backup export stamps act.backupAt with today, writes the stamp and every IndexedDB photo into the file, and removes only the verified localStorage copies of those photos", async () => {
    const today = await dstrIn(0);
    const st = await readState();
    st.act = { ...st.act };
    delete st.act.backupAt;
    // The viewer check in step 8 needs a completed task with evidence, dated today; any task carries the planted keys otherwise.
    const tasks = (st.tasks || []).filter((t) => t.type !== "daily");
    const viewed = tasks.find((t) => t.status === "done" && t.evidence);
    if (viewed) viewed.doneAt = today;
    const evTask = viewed || tasks[0];
    if (!evTask) throw new Error("the save holds no task to plant photos for");
    const keys0 = await idbKeys();
    const lone = tasks.find((t) => t.id !== evTask.id && !keys0.includes(`liferpg-img-study-${t.id}-2`));
    if (!lone) throw new Error("the save holds no second task to plant a localStorage-only photo for");
    const evKey = `liferpg-img-ev-${evTask.id}`, localOnlyKey = `liferpg-img-study-${lone.id}-2`;
    await writeState(st);
    await h.reload();
    // Planted after the load, so the boot copy does not run over them: a photo in both backends with the same value (a
    // verified copy), a photo only in localStorage (IndexedDB lacks it), and an orphan in both backends.
    await idbPut(evKey, PNG_A); await localPut(evKey, PNG_A);
    await localPut(localOnlyKey, PNG_B);
    await idbPut(ORPHAN, PNG_A); await localPut(ORPHAN, PNG_A);
    await openSettings();
    await sleep(400);
    if (!(await overlayText()).includes("백업 기록 없음")) throw new Error("settings does not state the missing backup");
    const dl = await captureDownload(() => h.clickInModal("백업 내보내기"), { waitMs: 1500 });
    if (!dl || !dl.text) throw new Error("no backup blob was produced");
    const data = JSON.parse(dl.text);
    if (data.state?.act?.backupAt !== today) throw new Error("the file's act.backupAt: " + data.state?.act?.backupAt);
    const images = data.images || {};
    const prof = await idbGet("liferpg-img-profile");
    if (!prof || images["liferpg-img-profile"] !== prof) throw new Error("the file's profile photo differs from IndexedDB");
    if (images[evKey] !== PNG_A) throw new Error("the file lacks the evidence photo");
    if (images[localOnlyKey] !== PNG_B) throw new Error("the file lacks the photo held only in localStorage");
    if (ORPHAN in images) throw new Error("the file carries an image key no record names");
    // Every IndexedDB photo a record names is in the file, with the IndexedDB value.
    const saved = await readState();
    const named = new Set(["liferpg-img-profile", ...(saved.folio || []).map((f) => `liferpg-img-folio-${f.id}`),
      ...(saved.tasks || []).flatMap((t) => [`liferpg-img-ev-${t.id}`, `liferpg-img-study-${t.id}-1`, `liferpg-img-study-${t.id}-2`])]);
    for (const k of await idbKeys()) {
      if (!named.has(k)) continue;
      if (images[k] !== (await idbGet(k))) throw new Error(`${k} is in IndexedDB but not in the file with the same value`);
    }
    if (saved.act?.backupAt !== today) throw new Error("the save's act.backupAt: " + saved.act?.backupAt);
    // Option B: the verified copy in the file is gone from localStorage and stays in IndexedDB; the rest is untouched.
    if ((await localRaw(evKey)) !== null) throw new Error("the exported, verified photo kept its localStorage copy");
    if ((await idbGet(evKey)) !== PNG_A) throw new Error("the exported photo is no longer in IndexedDB");
    if ((await localRaw(localOnlyKey)) !== JSON.stringify(PNG_B)) throw new Error("a photo IndexedDB lacks lost its localStorage copy");
    if ((await localRaw(ORPHAN)) !== JSON.stringify(PNG_A)) throw new Error("an image key outside the file lost its localStorage copy");
    const sheet = await overlayText();
    if (!sheet.includes(`마지막 백업 ${today} · 오늘`)) throw new Error("settings does not state today's backup: " + sheet.slice(-400));
    if (!sheet.includes("기록 공간에 남은 이전 사진 사본 2장 · 백업을 내보내면 정리돼요")) throw new Error("the copies line was not re-read after the export: " + sheet.slice(-400));
    await closeModal();
    exported = { data, evKey, localOnlyKey, viewTitle: viewed ? viewed.title : null };
  });

  await step("a photo written after the export keeps no localStorage copy, and backup import restores every photo into IndexedDB", async () => {
    if (!exported) throw new Error("step 7 did not run");
    const { data, evKey, localOnlyKey, viewTitle } = exported;
    await uploadProfilePhoto();
    if ((await localRaw("liferpg-img-profile")) !== null) throw new Error("a photo written after the export has a localStorage copy");
    await idbClear();
    await localDel(localOnlyKey); await localDel(ORPHAN);
    await page.evaluate(() => { window.confirm = () => true; });
    const fired = await page.evaluate((dump) => {
      const input = document.querySelector('input[type="file"][accept*="json"]');
      if (!input) return "no import input";
      const dt = new DataTransfer();
      dt.items.add(new File([dump], "backup.json", { type: "application/json" }));
      input.files = dt.files;
      input.dispatchEvent(new Event("change", { bubbles: true }));
      return "dispatched";
    }, JSON.stringify(data));
    if (fired !== "dispatched") throw new Error(fired);
    await sleep(1500);
    for (const [k, v] of Object.entries(data.images || {})) {
      if ((await idbGet(k)) !== v) throw new Error(`${k} was not restored into IndexedDB`);
      if ((await localRaw(k)) !== null) throw new Error(`${k} was restored into localStorage as well`);
    }
    if (((await readState()).act || {}).backupAt !== data.state.act.backupAt) throw new Error("the import did not restore the file's act.backupAt");
    if (viewTitle) {
      await clickTab("할 일");
      await openTodo(viewTitle);
      await clickInModalExact("증거 보기");
      await sleep(900);
      const srcs = await page.evaluate(() => [...document.querySelectorAll(".fixed.inset-0 img")].map((i) => i.getAttribute("src") || ""));
      if (!srcs.includes(PNG_A)) throw new Error("the evidence viewer does not show the restored photo");
      await closeModal();
      await closeModal();
    }
    // The planted photo of the second task leaves with the plant (it names no real photo).
    await idbDel(localOnlyKey);
    if ((await idbGet(evKey)) !== PNG_A) throw new Error("the evidence photo left IndexedDB");
  });

  await step("a backup 7 or more days old puts the backup section first in the reader; 6 days adds nothing", async () => {
    const saved = await readState();
    const plantBackup = async (delta) => {
      const st = structuredClone(saved);
      st.act = { ...st.act };
      if (delta === null) delete st.act.backupAt; else st.act.backupAt = await dstrIn(delta);
      await writeState(st);
      await h.reload();
    };
    try {
      const d7 = await dstrIn(-7);
      await plantBackup(-7);
      let secs = await readerBlocks();
      if (!secs[0] || !secs[0].startsWith("백업") || !secs[0].includes(`마지막 백업 ${d7} · 7일 전`)) throw new Error("7 days: the first section is " + (secs[0] || "").slice(0, 80));
      await closeModal();
      await plantBackup(-6);
      secs = await readerBlocks();
      if (secs.some((x) => x.startsWith("백업 ") && x.includes("마지막 백업"))) throw new Error("6 days: the reader states the backup");
      await closeModal();
      await plantBackup(null);
      secs = await readerBlocks();
      if (!secs[0] || !secs[0].startsWith("백업") || !secs[0].includes("백업 기록 없음")) throw new Error("no stamp: the first section is " + (secs[0] || "").slice(0, 80));
      await closeModal();
    } finally {
      await writeState(saved);
      await h.reload();
    }
  });

  await step("with the check notification on, a stale backup adds its line to the cached notification text", async () => {
    const saved = await readState();
    const origin = new URL(page.url()).origin;
    const entry = () => page.evaluate(async () => {
      try { const r = await (await caches.open("life-check")).match("./__check-summary"); return r ? await r.json() : null; } catch { return null; }
    });
    const until = async (ms, fn) => {
      const t0 = Date.now();
      while (Date.now() - t0 < ms) { const v = await fn(); if (v) return v; await sleep(250); }
      return null;
    };
    try {
      await page.browser().defaultBrowserContext().overridePermissions(origin, ["notifications"]);
      const st = structuredClone(saved);
      st.settings = { ...st.settings, checkNotify: true };
      st.act = { ...st.act };
      delete st.act.backupAt;
      await page.evaluate(async () => { try { await caches.delete("life-check"); } catch {} });
      await writeState(st);
      await h.reload();
      const stale = await until(6000, entry);
      if (!stale) throw new Error("no life-check cache entry with the switch on");
      if ((stale.body || "").split("\n").pop() !== "백업 기록 없음" || stale.counts?.backup !== 1) throw new Error("stale: " + JSON.stringify(stale));
      st.act.backupAt = await dstrIn(0);
      await page.evaluate(async () => { try { await caches.delete("life-check"); } catch {} });
      await writeState(st);
      await h.reload();
      await sleep(2500);
      const fresh = await entry();
      if (fresh && ((fresh.body || "").includes("백업") || "backup" in (fresh.counts || {}))) throw new Error("fresh: " + JSON.stringify(fresh));
    } finally {
      await writeState(saved);
      await page.browser().defaultBrowserContext().clearPermissionOverrides();
      await page.evaluate(async () => { try { await caches.delete("life-check"); } catch {} });
      await h.reload();
    }
  });
};
