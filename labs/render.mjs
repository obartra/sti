// Render the labs site: turn the published markdown docs into sti.care-styled
// HTML pages and generate the landing page. Pure file-in / file-out; no network.
//
// Usage: node labs/render.mjs --out <dir>
//   Reads labs/labs.config.json (which docs publish, in order) and the markdown
//   from labs/docs/, and writes <dir>/index.html + <dir>/docs/<slug>.html.
//   labs.css and favicon are copied in by build-labs.sh, not here.

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { marked } from "marked";

const HERE = dirname(fileURLToPath(import.meta.url));

function arg(name) {
  const i = process.argv.indexOf(name);
  return i !== -1 ? process.argv[i + 1] : undefined;
}
const OUT = arg("--out");
if (!OUT) {
  console.error("render.mjs: --out <dir> is required");
  process.exit(1);
}

const config = JSON.parse(readFileSync(join(HERE, "labs.config.json"), "utf8"));

const esc = (s) =>
  String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const slugify = (s) =>
  s
    .toLowerCase()
    .replace(/<[^>]+>/g, "")
    .replace(/&#?\w+;/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

marked.setOptions({ gfm: true, breaks: false });

const FONTS = `
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link
      href="https://fonts.googleapis.com/css2?family=Bungee&family=Fredoka:wght@400;500;600;700&display=swap"
      rel="stylesheet"
    />`;

const FOOTER = `<footer>
        <a href="https://sti.care">sti.care</a> · prototypes and design notes ·
        not medical advice
      </footer>`;

function page({ title, description, bodyClass, body }) {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${esc(title)}</title>
    <meta name="description" content="${esc(description)}" />
    <meta name="theme-color" content="#fbf2dd" />
    <link rel="icon" href="/favicon.svg" type="image/svg+xml" />${FONTS}
    <link rel="stylesheet" href="/labs.css" />
  </head>
  <body>
    <div class="wrap${bodyClass ? " " + bodyClass : ""}">
${body}
    </div>
  </body>
</html>
`;
}

// Add stable ids to h2/h3 so deep links work, and collect h2s for a TOC.
function addAnchors(html) {
  const toc = [];
  const used = new Set();
  const out = html.replace(
    /<h([23])>([\s\S]*?)<\/h\1>/g,
    (_m, level, inner) => {
      let id = slugify(inner) || "section";
      let n = 2;
      const base = id;
      while (used.has(id)) id = `${base}-${n++}`;
      used.add(id);
      if (level === "2") {
        toc.push({ id, text: inner.replace(/<[^>]+>/g, "").trim() });
      }
      return `<h${level} id="${id}">${inner}</h${level}>`;
    },
  );
  return { html: out, toc };
}

// Decision-status pills. The decisions doc tags each bullet with a status word
// (LOCKED, REJECTED, …) as a bold lead-in: `**LOCKED — headline.**`. We turn that
// lead-in into a hoverable icon+word pill and keep the headline bold, then drop a
// legend at the top so the icons are never cryptic. Pure string rewrite on the
// rendered HTML; no JS ships to the page (the tooltip is a native `title`).
const STATUS = {
  LOCKED: {
    label: "Locked",
    icon: "🔒",
    cls: "locked",
    def: "Decided — won't reopen without a strong new reason.",
  },
  BUILT: {
    label: "Built",
    icon: "✅",
    cls: "built",
    def: "Locked and already implemented in the prototype.",
  },
  REJECTED: {
    label: "Rejected",
    icon: "⛔",
    cls: "rejected",
    def: "Considered and deliberately ruled out.",
  },
  DEFERRED: {
    label: "Deferred",
    icon: "⏳",
    cls: "deferred",
    def: "Decided, but intentionally not in the MVP.",
  },
  OPEN: {
    label: "Open",
    icon: "❓",
    cls: "open",
    def: "Not yet decided — wants outside input.",
  },
  LIMIT: {
    label: "Limit",
    icon: "⚖️",
    cls: "limit",
    def: "A known tradeoff we accept rather than solve.",
  },
};

const SCOPE_DEF = {
  MVP: "In the MVP build scope.",
  "Post-MVP": "Planned after the MVP.",
};

const pill = (key) => {
  const s = STATUS[key];
  return `<span class="pill pill-${s.cls}" title="${esc(s.def)}"><span class="pill-i" aria-hidden="true">${s.icon}</span>${esc(s.label)}</span>`;
};

const scopeChip = (scope) =>
  `<span class="pill pill-scope" title="${esc(SCOPE_DEF[scope] || scope)}">${esc(scope)}</span>`;

// Match a bold lead-in that *starts* with a known status word: an optional
// `+ BUILT` companion, an optional `(MVP)` / `(Post-MVP)` scope, then an em dash.
// Anchored on the status keyword, so ordinary bold headlines are left untouched.
const STATUS_RE =
  /<strong>\s*(LOCKED|BUILT|REJECTED|DEFERRED|OPEN|LIMIT)(?:\s*\+\s*(BUILT))?(?:\s*\((MVP|Post-MVP)\))?\s*—\s*/g;

function legend() {
  const rows = Object.values(STATUS)
    .map(
      (s) =>
        `<div class="lg-row"><span class="pill pill-${s.cls}"><span class="pill-i" aria-hidden="true">${s.icon}</span>${esc(s.label)}</span><span class="lg-def">${esc(s.def)}</span></div>`,
    )
    .join("\n        ");
  return `<aside class="legend" aria-label="What the status labels mean">
        <div class="legend-h">Status key</div>
        ${rows}
      </aside>`;
}

// Rewrite status lead-ins into pills. Returns the html unchanged (and adds no
// legend) for docs that don't use the vocabulary.
function statusPills(html) {
  let n = 0;
  const out = html.replace(STATUS_RE, (_m, s1, s2, scope) => {
    n++;
    const parts = [pill(s1)];
    if (s2) parts.push(pill(s2));
    if (scope) parts.push(scopeChip(scope));
    return `${parts.join("")} <strong>`;
  });
  // Inject the legend after the intro rule so it sits below the title/blurb and
  // above the first section. String replace touches only the first `<hr>`.
  return n ? out.replace("<hr>", `<hr>\n      ${legend()}`) : out;
}

function tocBlock(toc) {
  if (toc.length < 3) return "";
  // t.text is already HTML-escaped (it comes from marked's rendered heading with
  // tags stripped), so emit it as-is rather than escaping a second time.
  const items = toc
    .map((t) => `<li><a href="#${t.id}">${t.text}</a></li>`)
    .join("\n          ");
  return `      <nav class="toc">
        <div class="toc-h">On this page</div>
        <ul>
          ${items}
        </ul>
      </nav>
`;
}

function crossnav(currentSlug) {
  const links = [
    `<a href="${esc(config.prototype.path)}">${esc(config.prototype.label)} prototype</a>`,
  ];
  for (const d of config.docs) {
    if (d.slug === currentSlug) continue;
    links.push(`<a href="/docs/${esc(d.slug)}">${esc(d.title)}</a>`);
  }
  return `      <nav class="crossnav">
        ${links.join("\n        ")}
      </nav>
`;
}

// A feedback call-to-action for docs flagged with `feedback: true`. Renders a
// live button when feedbackUrl is set, otherwise a neutral "coming soon" note so
// a deploy never ships a dead link.
function feedbackBlock() {
  const url = (config.feedbackUrl || "").trim();
  const label = esc(config.feedbackLabel || "Share feedback");
  if (!url) {
    return `      <div class="feedbackcta">
        <p class="feedback-note">A feedback form is on the way. Check back soon.</p>
      </div>
`;
  }
  return `      <div class="feedbackcta">
        <p>Have a perspective on any of these? I'd genuinely value your read.</p>
        <a class="feedbackbtn" href="${esc(url)}">${label} →</a>
      </div>
`;
}

// ---- doc pages ----
mkdirSync(join(OUT, "docs"), { recursive: true });
for (const d of config.docs) {
  const md = readFileSync(join(HERE, "docs", d.file), "utf8");
  const h1 = md.match(/^#\s+(.+)$/m);
  const pageTitle = `${d.title} — ${config.title}`;
  const rendered = addAnchors(statusPills(marked.parse(md)));
  const body = `      <a class="back" href="/">← ${esc(config.title)}</a>
${tocBlock(rendered.toc)}      <article class="prose">
${rendered.html}
      </article>
${d.feedback ? feedbackBlock() : ""}${crossnav(d.slug)}      ${FOOTER}`;
  writeFileSync(
    join(OUT, "docs", `${d.slug}.html`),
    page({
      title: pageTitle,
      description: d.blurb || (h1 ? h1[1] : d.title),
      bodyClass: "doc",
      body,
    }),
  );
  console.error(`  docs/${d.slug}.html  (from ${d.file})`);
}

// ---- landing page ----
const p = config.prototype;
const tiles = config.docs
  .map(
    (d, i) => `        <a class="doctile" href="/docs/${esc(d.slug)}">
          <span class="dt-n">${i + 1}</span>
          <span>
            <span class="dt-title">${esc(d.title)}</span>
            <span class="dt-blurb">${esc(d.blurb)}</span>
          </span>
          <span class="dt-ar">→</span>
        </a>`,
  )
  .join("\n");

const landingBody = `      <h1>${esc(config.title)}</h1>
      <p class="tagline">${esc(config.tagline)}</p>
      <p class="lead">${esc(config.intro)}</p>

      <section>
        <div class="seclabel">Prototype</div>
        <a class="feature" href="${esc(p.path)}">
          <span class="badge">Live prototype</span>
          <span class="ftitle">${esc(p.label)}</span>
          <p class="fblurb">${esc(p.blurb)}</p>
          <span class="fcta">${esc(p.cta)} →</span>
        </a>
      </section>

      <section>
        <div class="seclabel">${esc(config.docsHeading)}</div>
        <p class="lead" style="margin-bottom: 18px">${esc(config.docsIntro)}</p>
        <div class="doclist">
${tiles}
        </div>
      </section>

      ${FOOTER}`;

writeFileSync(
  join(OUT, "index.html"),
  page({
    title: config.title,
    description: config.intro,
    bodyClass: "",
    body: landingBody,
  }),
);
console.error("  index.html  (landing)");

// ---- 404 page ----
// Labs has no client-side URL routing (docs are real files; the prototype
// navigates in-app), so an unknown path is a genuine miss — serve an honest,
// branded "not found" rather than the SPA-style copy of the landing page.
// publish.sh sees this file exists and skips its SPA fallback.
const notFoundBody = `      <h1>404</h1>
      <p class="tagline">Page not found</p>
      <p class="lead">That page isn't here — it may have moved, or the link may be off.</p>
      <nav class="crossnav" style="margin-top: 22px">
        <a href="/">${esc(config.title)}</a>
        <a href="${esc(p.path)}">${esc(p.label)} prototype</a>
      </nav>

      ${FOOTER}`;

writeFileSync(
  join(OUT, "404.html"),
  page({
    title: `Page not found — ${config.title}`,
    description: "That page isn't here.",
    bodyClass: "",
    body: notFoundBody,
  }),
);
console.error("  404.html  (not found)");
