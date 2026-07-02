// Style lint for the passport app's editorial migration (doc 37). The app
// cannot ban its legacy styling day one (~1,100 inline style blocks), so the
// heavy rules are RATCHETS against scripts/style-lint-baseline.json: every
// file's count of each violation may only go DOWN. Above the baseline fails
// ("new violation"); below it fails too, telling you to shrink the baseline
// (run with --write), so every improvement is recorded and can never regress.
// When the baseline file is empty the rules are absolute and the migration is
// done.
//
// Ratcheted rules:
//   1. inline style={ props in .tsx (classes and the token system instead);
//   2. raw hex colors in .tsx/.ts/.css outside styles/theme.css (color
//      decisions live in tokens);
//   3. the legacy surface components <Card>, <Badge>, <Row>, <Segmented>
//      (their editorial replacements are the .e-* grammar; Button, forms,
//      Avatar stay).
// Absolute rule, no baseline (the app has none today):
//   4. no @media in src css except the 900px chrome breakpoint and
//      prefers-*/print feature queries; content responds to its container.
//
// src/design/** is the vendored design system and exempt from everything.
// Mirrors info/scripts/style-lint.mjs; node-only, zero dependencies.
import { readdirSync, statSync, readFileSync, writeFileSync } from "node:fs";
import { join, extname, dirname, relative } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SRC = join(ROOT, "src");
const BASELINE_PATH = join(ROOT, "scripts", "style-lint-baseline.json");
// --write ratchets the baseline down after a migration; --init is the one-time
// bootstrap that records the pre-migration state (it skips the loosen guard,
// so it has no place in CI or normal work).
const INIT = process.argv.includes("--init");
const WRITE = INIT || process.argv.includes("--write");

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else out.push(p);
  }
  return out;
}

const HEX = /#[0-9a-fA-F]{3,8}\b/g;
const INLINE_STYLE = /style=\{/g;
const LEGACY_SURFACE = /<(?:Card|Badge|Row|Segmented)\b/g;
const MEDIA = /@media\b([^{]*)/;
const ALLOWED_MEDIA = /min-width:\s*900px|prefers-|print/;

const METRICS = /** @type {const} */ ({
  styles: "inline style={} block",
  hex: "raw hex color",
  legacy: "legacy surface component (Card/Badge/Row/Segmented)",
});

const failures = [];
const fail = (where, msg) => failures.push(`${where}: ${msg}`);

// --- Count the current state -------------------------------------------------
const current = {};
for (const file of walk(SRC)) {
  const rel = relative(ROOT, file).replaceAll("\\", "/");
  if (rel.startsWith("src/design/")) continue;
  const ext = extname(file);
  if (![".tsx", ".ts", ".css"].includes(ext)) continue;
  const text = readFileSync(file, "utf8");

  const counts = { styles: 0, hex: 0, legacy: 0 };
  if (ext === ".tsx") {
    counts.styles = (text.match(INLINE_STYLE) ?? []).length;
    counts.legacy = (text.match(LEGACY_SURFACE) ?? []).length;
  }
  if (rel !== "src/styles/theme.css") {
    counts.hex = (text.match(HEX) ?? []).length;
  }
  if (counts.styles || counts.hex || counts.legacy) current[rel] = counts;

  if (ext === ".css") {
    text.split("\n").forEach((line, i) => {
      const media = line.match(MEDIA);
      if (media && !ALLOWED_MEDIA.test(media[1])) {
        fail(
          `${rel}:${i + 1}`,
          "viewport @media outside the 900px chrome breakpoint; use a container query",
        );
      }
    });
  }
}

// --- Ratchet against the baseline ---------------------------------------------
const baseline = JSON.parse(readFileSync(BASELINE_PATH, "utf8"));

if (WRITE) {
  // Refuse to loosen: --write records improvements, never new violations.
  if (!INIT) {
    for (const [file, counts] of Object.entries(current)) {
      for (const [metric, label] of Object.entries(METRICS)) {
        const allowed = baseline[file]?.[metric] ?? 0;
        if (counts[metric] > allowed) {
          fail(
            file,
            `refusing --write: ${label} count rose (${allowed} -> ${counts[metric]})`,
          );
        }
      }
    }
  }
  if (failures.length === 0) {
    const sorted = Object.fromEntries(
      Object.entries(current)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([file, counts]) => [
          file,
          Object.fromEntries(Object.entries(counts).filter(([, n]) => n > 0)),
        ]),
    );
    writeFileSync(BASELINE_PATH, JSON.stringify(sorted, null, 2) + "\n");
    console.log(
      `style-lint baseline written: ${Object.keys(sorted).length} files still carry legacy styling.`,
    );
    process.exit(0);
  }
} else {
  for (const [file, counts] of Object.entries(current)) {
    for (const [metric, label] of Object.entries(METRICS)) {
      const allowed = baseline[file]?.[metric] ?? 0;
      if (counts[metric] > allowed) {
        fail(
          file,
          `${label}: ${counts[metric]} found, baseline allows ${allowed}`,
        );
      } else if (counts[metric] < (baseline[file]?.[metric] ?? 0)) {
        fail(
          file,
          `${label} dropped ${baseline[file][metric]} -> ${counts[metric]}; run \`npm run lint:styles -- --write\` to ratchet the baseline down`,
        );
      }
    }
  }
  for (const [file, counts] of Object.entries(baseline)) {
    const cur = current[file];
    for (const metric of Object.keys(counts)) {
      if ((cur?.[metric] ?? 0) === 0 && counts[metric] > 0 && !cur) {
        fail(
          file,
          `stale baseline entry (file clean or gone); run \`npm run lint:styles -- --write\``,
        );
        break;
      }
    }
  }
}

if (failures.length > 0) {
  console.error("style lint failed (doc 37):");
  for (const f of failures) console.error("  - " + f);
  process.exit(1);
}
const remaining = Object.keys(baseline).length;
console.log(
  remaining === 0
    ? "style lint passed: the editorial migration is complete; rules are absolute."
    : `style lint passed: no regressions; ${remaining} files still on the ratchet.`,
);
