// Single-file HTML build for demo distribution — inlines all JS and CSS so the app opens from one file on a phone or PC.
// Usage: npm run build:demo  →  release/life-demo.html
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const OUT_FILE = "life-demo.html";

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function singleFileDemo() {
  return {
    name: "single-file-demo",
    enforce: "post",
    generateBundle(_, bundle) {
      const htmlKey = Object.keys(bundle).find((k) => k.endsWith(".html"));
      let html = bundle[htmlKey].source.toString();

      for (const [key, f] of Object.entries(bundle)) {
        if (f.type === "chunk") {
          const re = new RegExp(`<script[^>]*src="[^"]*${esc(f.fileName)}"[^>]*></script>`);
          const code = f.code.replace(/<\/script/gi, "<\\/script");
          // classic scripts have no defer, so place it after #root (just before </body>)
          html = html.replace(re, "").replace("</body>", () => `<script>${code}</script>\n  </body>`);
          delete bundle[key];
        } else if (f.type === "asset" && f.fileName.endsWith(".css")) {
          const re = new RegExp(`<link[^>]*href="[^"]*${esc(f.fileName)}"[^>]*>`);
          const css = f.source.toString().replace(/<\/style/gi, "<\\/style");
          html = html.replace(re, () => `<style>${css}</style>`);
          delete bundle[key];
        }
      }

      // remove links that mean nothing under file://
      html = html
        .replace(/\s*<link rel="manifest"[^>]*>/g, "")
        .replace(/\s*<link rel="modulepreload"[^>]*>/g, "");

      if (/(?:src|href)="(?!data:)/.test(html)) {
        this.warn("external references remain — the output may not be a single file");
      }

      delete bundle[htmlKey];
      this.emitFile({ type: "asset", fileName: OUT_FILE, source: html });
    },
  };
}

export default defineConfig({
  base: "./",
  publicDir: false,
  plugins: [react(), singleFileDemo()],
  build: {
    outDir: "release",
    emptyOutDir: false,
    target: "es2020",
    cssCodeSplit: false,
    assetsInlineLimit: 100_000_000,
    modulePreload: { polyfill: false },
    rollupOptions: {
      output: {
        format: "iife", // classic script — runs from file:// without module CORS restrictions
        inlineDynamicImports: true,
      },
    },
  },
});
