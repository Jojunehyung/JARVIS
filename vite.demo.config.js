// 데모 배포용 단일 HTML 빌드 — JS·CSS를 전부 내장해 폰/PC에서 파일 하나로 열 수 있게 한다.
// 사용: npm run build:demo  →  release/life-demo.html
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
          // 클래식 스크립트는 defer가 없으므로 #root 뒤(</body> 직전)에 배치
          html = html.replace(re, "").replace("</body>", () => `<script>${code}</script>\n  </body>`);
          delete bundle[key];
        } else if (f.type === "asset" && f.fileName.endsWith(".css")) {
          const re = new RegExp(`<link[^>]*href="[^"]*${esc(f.fileName)}"[^>]*>`);
          const css = f.source.toString().replace(/<\/style/gi, "<\\/style");
          html = html.replace(re, () => `<style>${css}</style>`);
          delete bundle[key];
        }
      }

      // file:// 환경에서 의미 없는 링크 제거
      html = html
        .replace(/\s*<link rel="manifest"[^>]*>/g, "")
        .replace(/\s*<link rel="modulepreload"[^>]*>/g, "");

      if (/(?:src|href)="(?!data:)/.test(html)) {
        this.warn("외부 참조가 남아 있습니다 — 단일 파일이 아닐 수 있음");
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
        format: "iife", // 클래식 스크립트 — file:// 에서 모듈 CORS 제약 없이 실행
        inlineDynamicImports: true,
      },
    },
  },
});
