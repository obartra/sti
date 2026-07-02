# 34 - Education library on a static subdomain (info.sti.care)

## Status: BUILT (the library, its guides, and the desktop layout are live in `info/`; visual baselines and a clinician review pass remain follow-ups)

The STI education library lives on its own static subdomain, **info.sti.care**, built
from markdown with Astro in the top-level `info/` package. The app links out to it and
does not ship or render it. This doc owns that site: its content model, its routes, its
desktop layout, how the app links to it, and how it deploys. All copy on it is governed
by [21-voice-and-tone](21-voice-and-tone.md).

The legal and trust content stays put: the privacy policy, the terms, the promises
page, and the share-your-link guide live in the app under
[23-privacy-terms-and-trust-links](23-privacy-terms-and-trust-links.md). This site is
only the education library, so it grows as its own effort.

## Why it is its own site

The education library is pure reading material: condition explainers, practical
guides, a U=U page, and testing and prevention framing. It changes on a
clinician-review cadence, not an app-release cadence, and it is the content most
likely to grow. On its own static site an edit is a markdown change and a deploy; it
needs no SPA router, no service worker, and it never shifts the app's visual
baselines.

## Information architecture

### Routes on info.sti.care

The whole site is the library, so pages sit at the root with no section prefix:

- `/` the library index (the landing for info.sti.care).
- `/{id}` a condition explainer (for example `/gonorrhea`) or a guide (for example
  `/testing`), one per markdown file; the filename is the slug.
- `/uu` the U=U page.

Slugs from both collections share the root, so every slug across the conditions, the
guides, and the reserved pages (`uu`, the index) must be unique. The dynamic route
throws at build time on any duplicate, so a clash can never ship silently.

### The app side

The in-app education screens are gone; the app renders real outbound anchors to
info.sti.care instead:

- The landing's "verify" link (the logged-out path into the library).
- The Care hub's "Learn" action.
- The report flow's link into a specific condition explainer.

The report-flow and Care-hub links sit inside the signed-in app, so they open the info
site in a **new tab** rather than navigating the app's tab away from itself. The
landing link is a plain navigation. The app pins these links to real info routes with
a small routing test.

## Architecture

### A separate Astro project

The top-level package `info/` is an Astro site that builds to static HTML. It is its
own build and its own Netlify site (see "Deploy"); it does not share the passport
bundle, router, or service worker. Astro is markdown-first (content collections),
emits plain static HTML with zero client JS by default, and reuses the app's design
tokens so the pages match the product.

### Content model (markdown plus small data modules)

Two Astro content collections, both authored as markdown:

- **Condition explainers** (`info/src/content/conditions/{id}.md`). Frontmatter
  carries the display name, the status label ("Curable" / "Treatable" / "Usually goes
  away") and the tone token that drives the chip color, the index sort order, the
  one-line "how to test", the intro, and the source links. The body is the
  question-and-answer copy.
- **Guides** (`info/src/content/guides/{id}.md`): practical reading, from getting
  tested through protection choices to the conversations around sex. Frontmatter
  carries the page title, the topic section it lives in (ids come from
  `info/src/data/sections.ts`, so a typo'd topic fails the build), the one-line
  card sub and icon for the index card, the sort order within its topic, an
  optional extra aside action (find PrEP, find free condoms) drawn from the shared
  resource links, the intro, and the source links. The body is plain markdown
  sections.

Conditions can also carry **related** links in frontmatter; they render as quiet
link cards in the page's aside (the HIV page's U=U and PrEP cards are this, not a
special case).

Adding a condition or a guide is one new markdown file; the index cards, the topic
sections, and the routes are all generated from the collections.

### Topic sections

The index groups the guide cards into titled sections, defined in
`info/src/data/sections.ts` (array order is display order): **Getting tested**,
**Protection that works**, **Talking about it**, and **If you test positive** (which
also holds the U=U card). A section with no guides stays hidden. The protection and
vaccines guides carry the education the app's design docs say the product owes
users (the honest condoms/PrEP/U=U efficacy comparison and the vaccination and
screening ramp; see the education layer in
[03-design](03-design.md)), and the living-with guide carries the de-stigmatized
teaching for the chronic conditions the badge deliberately leaves off.

The library deliberately does not cover anatomy, pleasure, identity, or
contraception beyond condoms. That boundary is chosen, not forgotten; widening it
is a product decision, not a missing file.

The copy that is not a page lives in small data modules the voice lint scans:
`info/src/data/library.ts` (index framing, shared explainer labels, the
when-to-see-a-clinician block, what each status label means), `uu.ts` (the U=U page),
`site.ts` (header, nav, footer, the what-this-site-is note), and `resources.ts` (the
outbound testing / clinic / PEP / PrEP links, kept in step with the app's
`passport/src/lib/resources.ts`).

### Shared branding

The site pulls the app's look from a single source rather than re-inventing it: it
imports the passport design tokens (the CSS custom properties and font setup under
`passport/src/design`) so colors, type, and spacing match exactly. A shared Astro
layout provides the header, a back-to-app affordance, and a footer that crosses the
library and back to sti.care. The design-tokens directory is never edited from the
info site; everything site-specific lives in `info/src/styles/`.

### Desktop layout

The site is composed for wide screens, not a scaled-up phone column. It shares the
app's desktop breakpoint (the 900px the desktop shell uses) and the landing's design
grammar: 1120px max-width sections with 40px gutters, a sticky blurred header with
the site nav, and a footer row of brand, nav, and the what-this-site-is note.

The nav is the index, the topic sections (as index anchors), and U=U, so it stays
the same size however many guides exist. Anchor jumps clear the sticky desktop
header via scroll-margin on the section headings; the phone header is not sticky,
so no offset applies there.

- `info/src/styles/site.css` is the phone column; `desktop.css` is one
  `min-width: 900px` layer on top. Pages opt into the wide frame with a modifier on
  the main column; below the breakpoint nothing in the desktop sheet applies.
- **Index**: a hero row (the copy beside the condition list, with a soft accent
  glow), the PEP callout as a single row with its action on the right, the titled
  topic sections with their guide cards two across, a full-bleed value band
  (prevention, vaccines and screening, when to see a clinician; terms link into
  the guides that own the depth), and a closing testing call to action.
- **Explainers and guides**: the article is the reading column (16px type on a
  capped measure) and the practical pieces (how to test, what the label means, when
  to see a clinician, the testing action, share) sit in a sticky aside.
- **U=U**: a wide hero band, the questions two across, and the privacy note beside
  the share action.

Desktop-only values (the frame width, gutters, clamped display type) are local to the
info stylesheets, the same way the app's desktop landing hardcodes its own; the
shared tokens stay the single source for color, type, and spacing.

### Authority signals

The pages earn trust by being concrete and true, never by borrowed credentials:

- Every explainer and guide ends with a quiet **sources** block linking the public
  health pages the copy is based on (frontmatter-driven; CDC today). The wording is
  always "based on", never "reviewed by": no clinician review has happened, and the
  site never claims one. A clinician review pass stays on the follow-up list.
- A shared **when to see a clinician** block (symptoms, a partner tested positive,
  possible HIV exposure inside the 72-hour PEP window) renders on the index band and
  in every explainer aside.
- A one-line **what this site is** note (plain guides from the team behind sti.care,
  based on U.S. CDC guidance, not medical advice) sits in the index hero and the
  desktop footer, alongside the per-page disclaimer.

### Outbound resources and interactivity islands

Two behaviors are the site's only client JavaScript:

- **Find testing / find a clinic / PEP / PrEP / condoms.** Outbound
  `target="_blank"` links to the same external resources the app opens, from the
  ported `resources.ts`. No geolocation, matching the app.
- **Share this page.** A button that uses the Web Share API where available and falls
  back to copying the page URL.

## Deploy

- **Second Netlify site** rooted at `info/`, building the Astro project to static
  output. Its own `netlify.toml` sets the same security headers the app uses (HSTS,
  `X-Content-Type-Options`, `Referrer-Policy`, `X-Frame-Options`,
  `Permissions-Policy`) and long-lived caching for fingerprinted assets with a
  revalidated HTML shell.
- **DNS**: a CNAME for `info` on the `sti.care` zone pointing at the info Netlify
  site.
- **CI**: the info build and its checks run from the `Makefile` (`check-info`) the
  same way the app and server gates run. Both sites auto-deploy on merge to main via
  their own Netlify Git integration.
- **No service worker** on info. It is plain static content; freshness is
  HTTP-header driven.

## Testing gates (code beats manual)

- **Voice / jargon lint.** `info/scripts/voice-lint.mjs` fails the build on any
  banned vocabulary from doc 21 and on any em or en dash. It scans the markdown
  collections whole-file (frontmatter included) and the string literals in
  `src/data`.
- **Build and type check.** `astro check` plus a production build run in CI; a broken
  content collection, a schema violation, or a slug collision fails.
- **Link check.** The app's outbound links into the library are pinned to a real info
  route by a small test in the app.
- **Formatting.** The repo-root `prettier --check .` covers `info/`'s markdown,
  styles, and config.

## Resolved decisions

1. **Subdomain: info.sti.care.** A broad umbrella, so if more static content ever
   moves it has a home; today it hosts the education library.
2. **Tooling: Astro**, for markdown-first authoring, static HTML output, and reuse of
   the app's design tokens.
3. **Only the education library lives here.** Promises, privacy, terms, and the share
   guide stay in the app under doc 23; the Care hub stays in the app.
4. **No backwards-compatibility redirects** for the old in-app education paths.
5. **In-app links into the library open a new tab**, so a cross-domain navigation
   never throws away app state or an in-progress flow.
6. **Guides are their own collection**, not stretched condition entries: they carry
   no status label or how-to-test line, and their frontmatter drives the index
   cards and topic grouping.
7. **The nav lists sections, not pages.** Guides join the nav by joining a topic;
   the chrome never grows with the page count.

## Residual for later (not blockers)

- Visual regression coverage for the info site (the app's lostpixel setup is
  passport-specific).
- A clinician review pass on the education copy; until it happens the site claims
  none.
