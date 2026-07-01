// Voice lint for info.sti.care (doc 34, doc 21). Fails the build if any of the
// library copy uses the app's internal vocabulary or an em/en dash. It scans the two
// places copy actually lives: the markdown explainers (whole file, frontmatter and
// body) and the string literals in the src/data copy tables. Astro pages pull their
// text from those, so they are not re-scanned, mirroring how the app's jargonFree
// test scopes to centralized copy rather than every component.
import { readdirSync, statSync, readFileSync } from "node:fs";
import { join, extname, dirname, relative } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SRC = join(ROOT, "src");

// The same banned-vocabulary regex the app's trustCopy / jargonFree tests use.
const BANNED = /\b(alias(es)?|linkups?|knocks?|findable|decoys?|resolv\w*)\b/i;
// No em dashes, en dashes, or spaced double-hyphen connectors (repo-wide rule).
const DASH = /[—–]| -- /;

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else out.push(p);
  }
  return out;
}

// Pull quoted string literals out of TS/JS so we scan the copy, not comments or code.
function stringLiterals(src) {
  const re = /(['"`])((?:\\.|(?!\1)[\s\S])*?)\1/g;
  const out = [];
  let m;
  while ((m = re.exec(src)) !== null) out.push(m[2]);
  return out;
}

const failures = [];
function check(file, label, text) {
  const rel = relative(ROOT, file);
  if (BANNED.test(text)) {
    failures.push(`${rel}: banned vocabulary in ${label}: "${text.trim()}"`);
  }
  if (DASH.test(text)) {
    failures.push(`${rel}: em/en/-- dash in ${label}: "${text.trim()}"`);
  }
}

for (const file of walk(SRC)) {
  const ext = extname(file);
  if (ext === ".md") {
    check(file, "content", readFileSync(file, "utf8"));
  } else if (ext === ".ts" && file.includes(join("src", "data"))) {
    for (const lit of stringLiterals(readFileSync(file, "utf8"))) {
      check(file, "string", lit);
    }
  }
}

if (failures.length > 0) {
  console.error("voice lint failed (doc 21):");
  for (const f of failures) console.error("  - " + f);
  process.exit(1);
}
console.log("voice lint passed: no banned vocabulary or dashes in info copy.");
