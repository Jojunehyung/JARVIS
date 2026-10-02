// The image backend and the backup reminder (2026-10-02). Part 1 (Phase 1): photos (`liferpg-img-*`) live in IndexedDB
// (database `life-manager`, store `kv`) behind the `store` adapter under their unchanged keys; a photo written after the
// update adds nothing to localStorage; photos an older build left in localStorage are copied on boot and read back, and
// — under the user's option B — their localStorage copies stay until a backup export; IndexedDB wins over a stale
// localStorage copy; the settings data section states the record storage against 4.5MB, the photo storage, the eviction
// caption and the copies left behind; a portfolio image saves while the records sit at the budget; a task removal
// clears both backends. Runs after flow12 and before flow4, which replaces the save. The preview build serves over
// `http:`, so the IndexedDB path is the one under test (the single-file demo's `file:` stays on localStorage).
// Written under the standing instruction that the suite is not run: every step parses, none has been executed.
module.exports = async (h) => {
  const { step, clickTab, clickText, clickInModal, clickInModalExact, clickExact, openTodo, overlayText, openSettings,
    attach, typeInto, closeModal, sleep, page, idbGet, idbKeys, idbPut, idbClear } = h;
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
};
