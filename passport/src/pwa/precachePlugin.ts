/**
 * Build-only Vite plugin that emits the offline shell's precache manifest (doc 22
 * slice 2): the data-free navigation shell plus every hashed JS/CSS asset, as a
 * list of URLs at /precache.json. The service worker fetches it at install, so the
 * two Vite builds (app, then the worker) stay decoupled, no shared generated code.
 *
 * It lives under src/ (not inline in vite.config.ts) so it is type-checked and
 * typed-linted like the rest of the code, rather than parsed as plain JS.
 */
import type { Plugin } from "vite";

export function precacheManifest(): Plugin {
  let base = "/";
  return {
    name: "precache-manifest",
    apply: "build",
    configResolved(config) {
      base = config.base;
    },
    generateBundle(_options, bundle) {
      // The shell is the entry document, its CSS, and the JS needed for first
      // paint: the entry chunk plus any statically-shared chunks. Dynamically
      // imported chunks (e.g. the QR scanner) are excluded so they don't bloat
      // every install; they runtime-cache cache-first the first time they load
      // online. Cache-busting is by the content hash already in each filename.
      const files = ["index.html"];
      for (const [fileName, output] of Object.entries(bundle)) {
        if (output.type === "chunk") {
          if (!output.isDynamicEntry) files.push(fileName);
        } else if (fileName.endsWith(".css")) {
          files.push(fileName);
        }
      }
      this.emitFile({
        type: "asset",
        fileName: "precache.json",
        source: JSON.stringify(files.map((file) => base + file)),
      });
    },
  };
}
