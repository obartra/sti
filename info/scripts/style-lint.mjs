// Style lint for info.sti.care (doc 36). Fails the build when markup or styles
// step outside the editorial system's rules:
//   1. no style= attributes in .astro templates (classes and tokens only);
//   2. no raw hex colors outside styles/theme.css (color decisions live in
//      tokens, passport's or the theme's);
//   3. no @media in component scoped styles or global sheets except the one
//      sanctioned chrome breakpoint (min-width: 900px) and print/motion/etc
//      feature queries; width-responsive components use container queries.
// Mirrors the voice-lint pattern: node-only, zero dependencies.
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

const failures = [];
const fail = (file, line, msg) => {
  failures.push(`${relative(ROOT, file)}:${line}: ${msg}`);
};

const HEX = /#[0-9a-fA-F]{3,8}\b/;
const MEDIA = /@media\b([^{]*)/;
const ALLOWED_MEDIA = /min-width:\s*900px|prefers-|print/;

for (const file of walk(SRC)) {
  const ext = extname(file);
  if (ext !== ".astro" && ext !== ".css") continue;
  const isThemeFile = file.endsWith(join("styles", "theme.css"));
  const lines = readFileSync(file, "utf8").split("\n");
  lines.forEach((text, i) => {
    const line = i + 1;
    if (ext === ".astro" && /\sstyle=/.test(text)) {
      fail(file, line, "style= attribute; use a class and the token system");
    }
    if (!isThemeFile && HEX.test(text)) {
      fail(file, line, "raw hex color; use a passport or theme token");
    }
    const media = text.match(MEDIA);
    if (media && !ALLOWED_MEDIA.test(media[1])) {
      fail(
        file,
        line,
        "viewport @media outside the 900px chrome breakpoint; use a container query",
      );
    }
  });
}

if (failures.length > 0) {
  console.error("style lint failed (doc 36):");
  for (const f of failures) console.error("  - " + f);
  process.exit(1);
}
console.log(
  "style lint passed: no inline styles, raw hex, or rogue media queries.",
);
