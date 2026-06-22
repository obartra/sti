import { defineConfig } from "vite";
import { version as repoVersion } from "../deploy/report-lib.mjs";

// A second, tiny build that bundles the push service worker to a stable dist/sw.js
// (one self-contained file, served at /sw.js, scope "/"). Run AFTER the main build
// with emptyOutDir:false so it appends sw.js rather than wiping dist. Bundling
// (rather than a hand-written sw.js) lets the worker reuse the app's exact crypto.
export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(repoVersion()),
    __BUILD_DATE__: JSON.stringify(new Date().toISOString().slice(0, 10)),
  },
  build: {
    emptyOutDir: false,
    rollupOptions: {
      input: { sw: "src/sw/sw.ts" },
      output: {
        entryFileNames: "sw.js",
        format: "es",
        // Keep the worker a single file: inline static deps, no shared chunks to
        // also have to serve at predictable paths.
        inlineDynamicImports: true,
      },
    },
  },
});
