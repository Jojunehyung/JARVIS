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
  window.addEventListener("load", () => {
    // "./sw.js" resolves against the document, not this module, so it works from a domain root or a subpath.
    navigator.serviceWorker.register("./sw.js", { scope: "./" }).catch(() => {});
    let reloading = false;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      // A newer build took over. Reload once so the running page matches the assets it will be served.
      if (reloading) return;
      reloading = true;
      window.location.reload();
    });
  });
  navigator.storage?.persist?.().catch(() => {});
}
