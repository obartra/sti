# 34 - Education library on a static subdomain (info.sti.care)

## Status: PROPOSED (design)

The STI education library (today the in-app `learn`, `learn-detail`, and `learn-uu`
screens) moves out of the app onto its own static subdomain, **info.sti.care**, built
from markdown with Astro. The app links out to it and no longer ships or renders it.
This doc owns that site: its content model, its routes, how the app links to it, and
how it deploys. All copy on it is still governed by
[21-voice-and-tone](21-voice-and-tone.md).

The legal and trust content stays put: the privacy policy, the terms, the promises
page, and the share-your-link guide keep living in the app under
[23-privacy-terms-and-trust-links](23-privacy-terms-and-trust-links.md). This move is
only the education library, so it can grow as its own effort.

## Why now

The education library is pure reading material: condition explainers, a U=U page, and
some testing and prevention guidance. It changes on a clinician-review cadence, not an
app-release cadence, and it is the content most likely to grow. Yet today every edit to
it means an app build, a new bundle, shifted visual baselines, and a redeploy of the
whole passport surface. It also sits on the SPA router and the offline shell for no
interactive reason.

Pulling it onto a small static site authored in markdown makes it cheap to maintain
(edit a `.md`, deploy), lets it expand and get reviewed on its own, and keeps the app
bundle and router focused on the interactive product.

## Scope and non-goals

Moves to info.sti.care:

- The education library **index** (the condition list plus the prevention, vaccine, and
  testing guidance that frames it).
- Each **condition explainer** (today `learn-detail`).
- The **U=U** page (today `learn-uu`).

Stays in the app, unchanged:

- The **Care hub** (`care`). It reads the owner's status badge and offers status-aware
  next steps. It is app state, not static content. It keeps a "Learn" action that now
  links out to info.sti.care.
- **Promises, privacy, terms, and the share-your-link guide.** These stay under doc 23.
  Promises in particular is a CI-gated artifact tied to the app's test suite; it belongs
  with the app.

Non-goals:

- No new data collection, analytics, cookies, or trackers on the info site. It is
  static HTML and stays that way.
- No rewrite of the copy. This is a move plus a format change (structured TS to
  markdown), not a content edit. Voice fixes that surface during the port are folded in
  per doc 21, but the substance is preserved.
- No backwards-compatibility redirects. The old in-app education paths simply go away;
  every link to them is repointed. (Confirmed acceptable: stranding an old bookmark is
  not a concern here.)

## Information architecture

### Routes on info.sti.care

The whole site is the library, so pages sit at the root with no section prefix:

- `/` the library index (the landing for info.sti.care).
- `/{id}` a condition explainer, one per slug (for example `/gonorrhea`).
- `/uu` the U=U page.

The condition slug is its id, so it must be URL-safe and cannot collide with a
reserved page (`uu`, and the root index). The build fails on a collision, so a clash
can never ship silently.

### The app side after the move

The in-app screens `learn`, `learn-detail`, and `learn-uu` are removed from the router
and the screen registry, along with their route-table and path-param entries. The three
places that link into the library today render real outbound anchors to info.sti.care
instead of `nav.go(...)`:

- The landing's "verify" link (the logged-out `a1-landing` path into the library).
- The Care hub's "Learn" action.
- The report flow's link into a specific condition explainer.

The report-flow and Care-hub links sit inside the signed-in app, so they open the info
site in a **new tab** rather than navigating the app's tab away from itself. The
landing link is a plain navigation.

## Architecture

### A separate Astro project

A new top-level package, `info/`, is an Astro site that builds to static HTML. It is its
own build and its own Netlify site (see "Deploy"); it does not share the passport
bundle, router, or service worker. Astro is chosen because it is markdown-first (content
collections), emits plain static HTML with zero client JS by default, and can reuse the
app's design tokens so the pages match the product. It slots into the existing Netlify +
monorepo setup without new infrastructure.

### Content model (markdown)

The library is one Astro content collection authored as markdown:

- **Condition explainers** (`info/src/content/learn/{id}.md`). Frontmatter carries the
  display name, the status label ("Curable" / "Manageable"), and the tone token that
  drives the chip color. The body is normal markdown sections ("How to test for it", and
  so on). Adding a condition is one new markdown file; the index list is generated from
  the collection.
- **The U=U page** (`info/src/content/learn/uu.md`), same shape.
- **Index framing copy** (the intro, the "ways to lower HIV risk" and "vaccines and
  screening" blocks, the PEP note, and the testing call to action) lives in the index
  page's own content, with the outbound resource links pulled from a small shared data
  file (below).

The current `learn/conditions.ts` (the `COPY` object) and `UU.tsx` are the input for a
one-time port to these files. After the move, the markdown is the single source and the
TS copy modules and their screens are deleted.

### Shared branding

The site pulls the app's look from a single source rather than re-inventing it: it
imports the passport design tokens (the CSS custom properties and font setup under
`passport/src/design`) so colors, type, and spacing match exactly. A small shared Astro
layout provides the header, a back-to-app affordance, and a footer that links across the
library and back to the app at sti.care. Because these are static pages, most need no
client JavaScript at all.

### Outbound resources and interactivity islands

Two behaviors carry over from the in-app library; each is a small Astro island, not a
reason to keep the pages in the app:

- **Find testing / find a clinic / PEP / PrEP / condoms.** These are outbound links to
  the same external resources the app opens today. The app centralizes them in
  `passport/src/lib/resources.ts`; the info site ports that small set of URLs into its
  own data file and renders plain `target="_blank"` links. No geolocation, matching the
  app (which only opens a resource link).
- **Share this page.** A button that uses the Web Share API where available and falls
  back to copying the page URL.

## Deploy

- **Second Netlify site** rooted at `info/`, building the Astro project to static
  output. Its own `netlify.toml` sets the same security headers the app uses (HSTS,
  `X-Content-Type-Options`, `Referrer-Policy`, `X-Frame-Options`, `Permissions-Policy`)
  and long-lived caching for fingerprinted assets with a revalidated HTML shell.
- **DNS**: a CNAME for `info` on the `sti.care` zone pointing at the info Netlify site,
  set up by the operator (the same shape as the existing app and mail records).
- **CI**: the info build and its checks are added to the `Makefile` so the workflow runs
  them the same way it runs the app and server gates. Both sites auto-deploy on merge to
  main via their own Netlify Git integration, matching how the app deploys today.
- **No service worker** on info. It is plain static content; freshness is HTTP-header
  driven, and there is no offline shell to precache.

## Testing gates (code beats manual)

The move must not drop the coverage the content has today. The info site carries its own
gates:

- **Voice / jargon lint.** Port the spirit of the app's jargon-free check to run over the
  info markdown: it fails the build on any banned vocabulary (alias, knock, findable,
  decoy, linkup, resolve, and the rest from doc 21) and on any em dash. This replaces the
  app's coverage of the copy that moved.
- **Build and type check.** `astro check` plus a production build run in CI; a broken
  content collection or a dead internal link fails.
- **Link check.** Internal links resolve, and the app's outbound links into the library
  are pinned to a real info route by a small test in the app (the same spirit as today's
  routing tests).
- **Formatting.** The repo-root `prettier --check .` already covers `info/`'s markdown
  and config; no new formatter.
- **Visual baselines** for the info site are a follow-up, not a blocker: the app's
  lostpixel setup is passport-specific. The initial move ships without info baselines and
  adds them once the pages settle.

## Migration plan (after approval)

1. Scaffold the `info/` Astro project: config, the shared layout importing the design
   tokens, and the index page.
2. Port the condition explainers and the U=U page from `learn/conditions.ts` and
   `UU.tsx` into the `learn` collection.
3. Build the index (condition list plus the prevention, vaccine, testing, and PEP
   framing) with the share and resource islands, driven by a ported resource-links data
   file.
4. App side: add an `INFO_BASE_URL` to config (env-overridable for previews) plus a tiny
   `infoUrl(path)` helper; repoint the landing, Care hub, and report-flow links to
   outbound anchors (in-app ones opening a new tab); delete the `learn` screens, their
   routes and route-table entries, and the now-unused `src/ui/learn` modules; update the
   affected router and screen tests; drop the stale learn visual baselines.
5. Wire the info build and its gates into the `Makefile` and CI; add the second Netlify
   site; hand the operator the `info` CNAME.
6. Docs consolidation pass: re-read the set for coherence and confirm doc 23 still reads
   correctly with the library gone from the app.

## Resolved decisions

1. **Subdomain: info.sti.care.** The operator-facing name the library lands on. It is a
   broad umbrella, so if more static content ever moves it has a home; today it hosts
   only the education library.
2. **Tooling: Astro**, for markdown-first authoring, static HTML output, and reuse of the
   app's design tokens.
3. **Only the education library moves.** Promises, privacy, terms, and the share guide
   stay in the app under doc 23; the Care hub stays in the app.
4. **No backwards-compatibility redirects.** Old education paths are removed and every
   link repointed.
5. **In-app links into the library open a new tab**, so a cross-domain navigation never
   throws away app state or an in-progress flow.

## Residual for later (not blockers for this build)

- Visual regression coverage for the info site is a fast follow.
- A clinician review pass on the education copy is easier to run now that it is plain
  markdown on its own site; worth scheduling, but out of scope for the move itself.
