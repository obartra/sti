/**
 * Build-only Vite plugin that emits the offline shell's precache manifest (doc 22
 * slice 2): the data-free navigation shell plus every hashed JS/CSS asset, as a
 * list of URLs at /precache.json. The service worker fetches it at install, so the
 * two Vite builds (app, then the worker) stay decoupled, no shared generated code.
 *
 * It also enforces a size budget (doc 22 section N): the shell must stay small
 * enough to install fast on a weak connection, so the build FAILS if the precached
 * bytes exceed the budget, caught here rather than on a phone.
 *
 * It lives under src/ (not inline in vite.config.ts) so it is type-checked and
 * typed-linted like the rest of the code, rather than parsed as plain JS.
 */
import type { Plugin } from "vite";

/**
 * The offline-shell precache budget. Keep the shell small enough to install fast on
 * a weak connection; the build fails when the precached bytes exceed this. Raise it
 * DELIBERATELY (a one-line change that surfaces the growth in review), never silently.
 */
export const PRECACHE_BUDGET_BYTES = 700 * 1024;

// The minimal shape we read from a Rollup output entry: a chunk's code, or an asset's
// source. The real OutputChunk / OutputAsset satisfy this structurally.
type BundleItem =
  | { type: "chunk"; code: string; isDynamicEntry: boolean }
  | { type: "asset"; source: string | Uint8Array };
export type Bundle = Record<string, BundleItem>;

/**
 * The files that make up the offline shell: the entry document, its CSS, and the JS
 * needed for first paint (the entry chunk plus any statically-shared chunks).
 * Dynamically imported chunks (e.g. the QR scanner) are excluded so they don't bloat
 * every install; they runtime-cache cache-first the first time they load online.
 */
export function selectPrecacheFiles(bundle: Bundle): string[] {
  const files = ["index.html"];
  for (const [fileName, output] of Object.entries(bundle)) {
    if (output.type === "chunk") {
      if (!output.isDynamicEntry) files.push(fileName);
    } else if (fileName.endsWith(".css")) {
      files.push(fileName);
    }
  }
  return files;
}

const encoder = new TextEncoder();
function itemBytes(output: BundleItem): number {
  if (output.type === "chunk") return encoder.encode(output.code).length;
  return typeof output.source === "string"
    ? encoder.encode(output.source).length
    : output.source.byteLength;
}

/** Total bytes of the precached shell files that are present in the bundle. */
export function precacheBytes(bundle: Bundle, files: string[]): number {
  let bytes = 0;
  for (const file of files) {
    const output = bundle[file];
    if (output !== undefined) bytes += itemBytes(output);
  }
  return bytes;
}

export function precacheManifest(): Plugin {
  let base = "/";
  return {
    name: "precache-manifest",
    apply: "build",
    configResolved(config) {
      base = config.base;
    },
    generateBundle(_options, bundle) {
      const shell = bundle as unknown as Bundle;
      const files = selectPrecacheFiles(shell);
      const bytes = precacheBytes(shell, files);
      if (bytes > PRECACHE_BUDGET_BYTES) {
        this.error(
          `offline-shell precache is ${Math.round(bytes / 1024)} KB, over the ` +
            `${Math.round(PRECACHE_BUDGET_BYTES / 1024)} KB budget (doc 22 N). ` +
            `Trim the shell, or raise PRECACHE_BUDGET_BYTES deliberately.`,
        );
      }
      this.emitFile({
        type: "asset",
        fileName: "precache.json",
        source: JSON.stringify(files.map((file) => base + file)),
      });
    },
  };
}
