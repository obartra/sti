// Regenerate the PWA install-dialog screenshots from their Storybook stories, so what
// ships in the manifest is always the curated "PWA/Install screenshots" story, in sync
// with the real UI (the story is the source of truth, doc 22 C/F). Fixture data only,
// never a real session (S7). The output PNGs are committed under public/screenshots/;
// run this only when the source story or the desired frame changes:
//
//   npm run build-storybook && node scripts/screenshots/generate.mjs
//
// Like scripts/icons/generate.mjs, it drives the headless Chromium that ships with the
// Playwright browser bundle directly (no Playwright module, no rsvg/sharp here), and
// serves the built Storybook over a tiny static server so the story can load its assets.
import {
  readFileSync,
  existsSync,
  readdirSync,
  statSync,
  mkdirSync,
} from "node:fs";
import { join, dirname, extname } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync, spawn } from "node:child_process";
import { createServer } from "node:http";

// Run a child to completion asynchronously. We must NOT block the event loop here
// (execFileSync would): the static server below runs IN THIS PROCESS, so a blocked
// loop could not answer Chrome's requests, and the capture would deadlock.
function run(cmd, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: "ignore" });
    child.on("error", reject);
    child.on("close", (code) =>
      code === 0 ? resolve() : reject(new Error(`${cmd} exited ${code}`)),
    );
  });
}

const here = dirname(fileURLToPath(import.meta.url));
const ROOT = join(here, "..", "..");
const SB = join(ROOT, "storybook-static");
const OUT = join(ROOT, "public", "screenshots");

if (!existsSync(join(SB, "index.html"))) {
  execFileSync("npm", ["run", "build-storybook"], {
    cwd: ROOT,
    stdio: "inherit",
  });
}
mkdirSync(OUT, { recursive: true });

// A minimal static server for storybook-static (the story iframe loads its bundle and
// assets by relative URL, so file:// is unreliable; a real origin is not).
const MIME = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".mjs": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2",
  ".woff": "font/woff",
  ".ico": "image/x-icon",
  ".map": "application/json",
  ".webmanifest": "application/manifest+json",
};
const server = createServer((req, res) => {
  let path = decodeURIComponent((req.url ?? "/").split("?")[0]);
  if (path.endsWith("/")) path += "index.html";
  const file = join(SB, path);
  if (
    !file.startsWith(SB) ||
    !existsSync(file) ||
    statSync(file).isDirectory()
  ) {
    res.statusCode = 404;
    res.end("not found");
    return;
  }
  res.setHeader(
    "Content-Type",
    MIME[extname(file)] ?? "application/octet-stream",
  );
  res.end(readFileSync(file));
});
await new Promise((resolve) => server.listen(0, resolve));
const { port } = server.address();

function findChrome() {
  const root = process.env.PLAYWRIGHT_BROWSERS_PATH || "/opt/pw-browsers";
  const dir = readdirSync(root).find((d) => d.startsWith("chromium-"));
  if (!dir) throw new Error(`no chromium-* under ${root}`);
  return join(root, dir, "chrome-linux", "chrome");
}
const CHROME = findChrome();

// Each shot: a story id, the output PNG, and the CSS-pixel frame. The capture is at
// device-scale-factor 2, so the PNG is 2x the window for a crisp phone screenshot.
const SCALE = 2;
const shots = [
  {
    id: "pwa-install-screenshots--mobile-home",
    out: "home.png",
    w: 440,
    h: 892,
  },
];

try {
  for (const { id, out, w, h } of shots) {
    const url = `http://localhost:${port}/iframe.html?id=${id}&viewMode=story`;
    await run(CHROME, [
      "--headless=new",
      "--no-sandbox",
      "--disable-gpu",
      "--hide-scrollbars",
      `--force-device-scale-factor=${SCALE}`,
      `--window-size=${w},${h}`,
      // Let the story mount and fonts settle before the capture.
      "--virtual-time-budget=6000",
      `--screenshot=${join(OUT, out)}`,
      url,
    ]);
    console.log(`wrote public/screenshots/${out} (${w * SCALE}x${h * SCALE})`);
  }
} finally {
  server.close();
}
