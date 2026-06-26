// Regenerate the PWA PNG icons from their SVG sources.
//
// The environment has no rsvg/imagemagick/sharp and no installed Playwright
// module, but a headless Chromium ships with the Playwright browser bundle, so
// we drive it directly. The output PNGs are committed under public/icons/; run
// this only when the source mark or sizes change.
//
//   node scripts/icons/generate.mjs
//
import { readFileSync, writeFileSync, mkdtempSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

const here = dirname(fileURLToPath(import.meta.url));
const PUBLIC_ICONS = join(here, "..", "..", "public", "icons");
const FAVICON = join(here, "..", "..", "public", "favicon.svg");
const MASKABLE_SRC = join(here, "icon-maskable-src.svg");

// Find the Chromium that ships with the Playwright browser bundle.
function findChrome() {
  const root = process.env.PLAYWRIGHT_BROWSERS_PATH || "/opt/pw-browsers";
  const dir = readdirSync(root).find((d) => d.startsWith("chromium-"));
  if (!dir) throw new Error(`no chromium-* under ${root}`);
  return join(root, dir, "chrome-linux", "chrome");
}
const CHROME = findChrome();
const work = mkdtempSync(join(tmpdir(), "icons-"));

const jobs = [
  { src: FAVICON, size: 192, out: "icon-192.png", transparent: true },
  { src: FAVICON, size: 512, out: "icon-512.png", transparent: true },
  {
    src: MASKABLE_SRC,
    size: 512,
    out: "icon-maskable-512.png",
    transparent: false,
  },
  {
    src: MASKABLE_SRC,
    size: 180,
    out: "apple-touch-icon-180.png",
    transparent: false,
  },
];

for (const { src, size, out, transparent } of jobs) {
  const svg = readFileSync(src, "utf8")
    .replace(/width="\d+"/, `width="${size}"`)
    .replace(/height="\d+"/, `height="${size}"`);
  const wrapper = join(work, `w-${out}.html`);
  writeFileSync(
    wrapper,
    `<!doctype html><html><head><meta charset="utf-8"><style>html,body{margin:0;padding:0}svg{display:block}</style></head><body>${svg}</body></html>`,
  );
  execFileSync(
    CHROME,
    [
      "--headless=new",
      "--no-sandbox",
      "--disable-gpu",
      "--hide-scrollbars",
      "--force-device-scale-factor=1",
      `--default-background-color=${transparent ? "00000000" : "2F9BB3FF"}`,
      `--window-size=${size},${size}`,
      `--screenshot=${join(PUBLIC_ICONS, out)}`,
      `file://${wrapper}`,
    ],
    { stdio: "ignore" },
  );
  console.log(`wrote public/icons/${out} (${size}px)`);
}
