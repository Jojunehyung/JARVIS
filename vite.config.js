import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { createRequire } from "node:module";

// The service-worker generator lives with the other harness scripts (CommonJS), so it is required, not imported.
const { swPlugin } = createRequire(import.meta.url)("./tools/harness/gen-sw.js");

export default defineConfig({
  // Relative base: the same build runs from a domain root, a project subpath, or a preview server.
  base: "./",
  plugins: [react(), swPlugin()],
});
