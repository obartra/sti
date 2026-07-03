// Style lint for the passport app's editorial language (doc 37). The
// migration is complete, so the rules are ABSOLUTE (the burn-down ratchet and
// its baseline file are gone), with one explicit allowlist for the styling
// that legitimately stays inline or hex:
//
//   - data-driven inline styles: values computed from data (medallion and
//     pass sizes, avatar swatch colors, QR geometry) that a class cannot
//     express, plus NavLink's style passthrough;
//   - the wallet pass depictions (apple-pass, google-pass): mockups of
//     external physical artifacts, with those platforms' own colors;
//   - QR rendering (lib/qr): the matrix and the exported PNG paint with
//     canvas/SVG color values by nature;
//   - *.stories.tsx: fixture layout for Storybook, not product surface
//     (raw hex stays banned in stories except the QR/PWA fixtures below).
//
// Absolute rules:
//   1. no inline style={ props in .tsx outside the allowlist;
//   2. no raw hex colors in .tsx/.ts/.css outside styles/theme.css and the
//      allowlist (color decisions live in tokens);
//   3. no stranded surface components <Card>, <Badge>, <Row> (their
//      editorial replacements are the .e-* grammar; Button, forms, Avatar,
//      and Segmented stay);
//   4. no @media in src css except the 900px chrome breakpoint and
//      prefers-*/print feature queries; content responds to its container.
//
// src/design/** is the vendored design system and exempt from everything.
// Mirrors info/scripts/style-lint.mjs; node-only, zero dependencies.
import { readdirSync, statSync, readFileSync } from "node:fs";
import { join, extname, dirname, relative } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SRC = join(ROOT, "src");

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
const LEGACY_SURFACE = /<(?:Card|Badge|Row)\b/g;
const MEDIA = /@media\b([^{]*)/;
const ALLOWED_MEDIA = /min-width:\s*900px|prefers-|print/;

// The sanctioned exceptions, per rule. Keep this list SHORT and specific: an
// entry needs a reason a class or token cannot express the styling.
const ALLOW_STYLES = new Set([
  "src/ui/badge-card.tsx", // medallion size + per-label pill colors (data)
  "src/ui/wallet/shared.tsx", // pass avatar/QR sizes (data)
  "src/ui/wallet/apple-pass.tsx", // external-artifact depiction
  "src/ui/wallet/google-pass.tsx", // external-artifact depiction
  "src/ui/onboarding/AvatarBuilder.tsx", // swatch colors from avatar data
  "src/ui/app/NavLink.tsx", // style prop passthrough
  "src/lib/qr.tsx", // QR geometry
]);
const ALLOW_HEX = new Set([
  "src/styles/theme.css", // the one home for raw color values
  "src/ui/wallet/apple-pass.tsx", // the platforms' own pass colors
  "src/ui/wallet/google-pass.tsx",
  "src/lib/qr.tsx", // exported-PNG paint colors
  "src/lib/qr.test.ts",
  "src/lib/qr.stories.tsx",
  "src/ui/pwa/installScreenshots.stories.tsx", // device-frame fixture
]);
const isStory = (rel) => rel.endsWith(".stories.tsx");

const failures = [];
const fail = (where, msg) => failures.push(`${where}: ${msg}`);

for (const file of walk(SRC)) {
  const rel = relative(ROOT, file).replaceAll("\\", "/");
  if (rel.startsWith("src/design/")) continue;
  const ext = extname(file);
  if (![".tsx", ".ts", ".css"].includes(ext)) continue;
  const text = readFileSync(file, "utf8");

  if (ext === ".tsx") {
    if (!ALLOW_STYLES.has(rel) && !isStory(rel)) {
      const n = (text.match(INLINE_STYLE) ?? []).length;
      if (n > 0) {
        fail(rel, `inline style={} block (${n}); use a class and the tokens`);
      }
    }
    const legacy = (text.match(LEGACY_SURFACE) ?? []).length;
    if (legacy > 0) {
      fail(
        rel,
        `stranded surface component (Card/Badge/Row, ${legacy}); use the .e-* grammar`,
      );
    }
  }

  if (!ALLOW_HEX.has(rel)) {
    const n = (text.match(HEX) ?? []).length;
    if (n > 0)
      fail(rel, `raw hex color (${n}); color decisions live in tokens`);
  }

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

if (failures.length > 0) {
  console.error("style lint failed (doc 37):");
  for (const f of failures) console.error("  - " + f);
  process.exit(1);
}
console.log("style lint passed: the editorial rules are absolute.");
