import React from "react";
import { createRoot } from "react-dom/client";
import LifeManager from "./LifeManager.jsx";
import "./index.css";

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <LifeManager />
  </React.StrictMode>
);

/* Installable app: register the generated service worker so the app opens offline, and ask the browser
   to keep the saved records instead of evicting them under storage pressure. Production build only —
   `sw.js` is emitted by the build, and the single-file demo has no service worker. */
if (import.meta.env.PROD && location.protocol !== "file:" && "serviceWorker" in navigator) {
  // Update policy: a new build installs and takes over in the background, this page keeps running the
  // bundle it already loaded, and the new version applies the next time the app is opened. Nothing here
  // reloads the page — the running page is where the user is working, and a reload resets the tab and
  // discards whatever is half-typed in an open form (reported 2026-09-13: the app returned to the home
  // tab a few seconds after a tab switch, once per deploy, because every build emits a new `sw.js`).
  window.addEventListener("load", () => {
    // "./sw.js" resolves against the document, not this module, so it works from a domain root or a subpath.
    navigator.serviceWorker.register("./sw.js", { scope: "./" }).catch(() => {});
  });
  navigator.storage?.persist?.().catch(() => {});
}
