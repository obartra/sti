// A report-only lens (like `make dupe`, never a CI gate): CSS class selectors and
// design tokens defined under src that are never referenced anywhere in the source.
//
// It is prefix-aware. Class names are often built dynamically (`sti-btn--${size}`,
// `bc__${key}`), so a naive "is the literal name in the code" check false-positives
// every modifier under such a prefix. This collects those `prefix${` fragments and
// treats any class under a dynamic prefix as used. What remains is high-signal: a
// class or token whose only appearance is its own definition.
//
// It is still a lens, not a gate: a class reached only through a computed name this
// heuristic cannot see would show up here, so confirm each finding before deleting.
import { readdirSync, statSync, readFileSync } from "node:fs";
import { join, extname, relative } from "node:path";

const ROOTS = process.argv.slice(2).length ? process.argv.slice(2) : ["src"];
const walk = (d) =>
  readdirSync(d).flatMap((n) => {
    const p = join(d, n);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });

const files = ROOTS.flatMap(walk);
const cssFiles = files.filter((f) => extname(f) === ".css");
const codeFiles = files.filter((f) =>
  [".ts", ".tsx", ".mjs", ".astro"].includes(extname(f)),
);
const codeText = codeFiles.map((f) => readFileSync(f, "utf8")).join("\n");
const cssText = cssFiles.map((f) => readFileSync(f, "utf8")).join("\n");

// Dynamic class prefixes: the literal chunk immediately before a `${` in code, e.g.
// `sti-btn--${size}` yields the prefix "sti-btn--".
const dynPrefixes = new Set();
for (const m of codeText.matchAll(/([-\w]+)\$\{/g)) dynPrefixes.add(m[1]);

// Class selectors defined in CSS: scan selector text only (left of `{`, at brace
// depth 0), skipping url()/@import/protocol lines so a font domain is not misread as
// a class.
const classDefs = new Map();
for (const f of cssFiles) {
  const css = readFileSync(f, "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
  let depth = 0;
  for (const line of css.split("\n")) {
    const sel = depth === 0 ? line.split("{")[0] : "";
    if (!/url\(|@import|:\/\//.test(sel)) {
      for (const m of sel.matchAll(/\.(-?[_a-zA-Z][\w-]*)/g))
        if (!classDefs.has(m[1])) classDefs.set(m[1], f);
    }
    depth +=
      (line.match(/\{/g) || []).length - (line.match(/\}/g) || []).length;
    if (depth < 0) depth = 0;
  }
}

// Token definitions: a `--name:` custom property declaration. The lookbehind
// rejects a modifier class in a selector, `.sti-btn--primary:hover`, where the
// dashes are preceded by a word char and would otherwise read as a `--primary`
// token def. A real declaration's `--` follows a brace, semicolon, or newline.
const tokenDefs = new Map();
for (const f of cssFiles)
  for (const m of readFileSync(f, "utf8").matchAll(/(?<![\w-])(--[\w-]+)\s*:/g))
    if (!tokenDefs.has(m[1])) tokenDefs.set(m[1], f);

const wordRe = (w) =>
  new RegExp(`(?<![\\w-])${w.replace(/-/g, "\\-")}(?![\\w-])`);
const underDynPrefix = (cls) =>
  [...dynPrefixes].some((p) => cls.startsWith(p) && cls !== p);

const deadClasses = [];
for (const [cls, file] of classDefs) {
  if (underDynPrefix(cls)) continue;
  if (wordRe(cls).test(codeText)) continue;
  deadClasses.push([cls, relative(process.cwd(), file)]);
}

const deadTokens = [];
for (const [tok, file] of tokenDefs) {
  const re = new RegExp(`var\\(\\s*${tok.replace(/-/g, "\\-")}\\b`);
  if (!re.test(cssText) && !re.test(codeText))
    deadTokens.push([tok, relative(process.cwd(), file)]);
}

console.log(
  `# CSS classes defined but never referenced (${deadClasses.length})`,
);
for (const [c, f] of deadClasses.sort()) console.log(`  .${c}  <-  ${f}`);
console.log(
  `\n# Tokens defined but never used via var() (${deadTokens.length})`,
);
for (const [t, f] of deadTokens.sort()) console.log(`  ${t}  <-  ${f}`);
console.log(
  "\nLens, not a gate: confirm each (a computed class name can look dead).",
);
