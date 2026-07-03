# 37 - The app adopts the editorial language

## Status: BUILT (every surface runs the language; the style lint is absolute)

The passport app runs on the editorial design language that
[36-info-design-language](36-info-design-language.md) built for info.sti.care.
Doc 36 owns the language (type, surfaces, color, density, the one-primary-action
rule); this doc owns the app-side mechanics: the style architecture, the
absolute style-lint rules, and the sanctioned exceptions. The same effort
carried the language to the logged-out pages, the labs docs site, and the api
landing page, so every surface reads as one product.

## Style architecture

The app's styles live in cascade layers, lowest to highest: `passport` (the
vendored design system), `theme`, `layout`, `components`, `utilities`. The
single entry is `passport/src/styles/global.css`, imported once by
`src/main.tsx`; Storybook imports `styles/storybook.css`, the same cascade
minus the app-only document frame (`document.css`), because stories render on
Storybook's own canvas. Component-adjacent CSS files stay unlayered on
purpose: unlayered beats every layer, so a component always wins over globals.

Rules that hold everywhere:

- **`src/design` is read-only.** It is the vendored design bundle and is never
  edited. The app layers over it: `styles/passport.css` is a skip-fonts barrel
  that imports the same files as `design/index.css` minus its Google Fonts
  loader, and a test pins that parity so a design-bundle sync cannot silently
  diverge. Token overrides happen in the `theme` layer, which beats the
  `passport` layer by declaration order.
- **Fonts are self-hosted.** Hanken Grotesk ships as one variable-weight latin
  woff2, Source Serif 4 SemiBold as another (the same file info serves), both
  under `public/fonts/` with capsize-computed metric fallbacks so the swap
  cannot reflow. No visitor is sent to Google for type; info imports the same
  barrel and self-hosts the same files.
- **Editorial vocabulary is app-owned.** Theme tokens go in `styles/theme.css`
  (the only place raw color values may appear), layout vocabulary in
  `styles/layout.css`, editorial component classes (the `.e-*` grammar) in
  `styles/components.css`, single-purpose helpers in `styles/utilities.css`.

## The editorial grammar in an app

Doc 36's rules generalize as written: serif display over the shared sans,
ink-forward color, derived AA status inks, hairline surfaces, container
queries, one filled primary action per viewport. The app adds the decisions an
interactive product needs:

- **Card taxonomy.** Exactly three kinds of surface keep card-ness: the badge
  card (the credential the product is about, on the `.e-artifact` certificate
  frame: a double printed rule, flat, never a glow), the wallet passes
  (depictions of physical objects), and overlays such as the share sheet
  (control surfaces keep radius and elevation). Everything else is
  hairline-structured page. Tinted cards, glow shadows, icon tiles, and pill
  chips retired from app markup; their classes stay in the vendored CSS,
  unused.
- **Stranded design components.** From `design/components`, the app keeps
  `Button`, `IconButton`, `Segmented` (a control surface), and the form
  controls. `Card`, `Badge`, and `Row` are stranded: never restyled, never
  wrapped; no screen uses them. The style lint bans them outright.
- **Status vocabulary.** Status renders as the uppercase word plus the heart
  glyph in a derived AA-safe ink (info's StatusLabel), never a colored pill,
  and never color alone.
- **Type.** The serif carries screen titles and display moments; body and
  controls stay Hanken Grotesk; sentence case per
  [21-voice-and-tone](21-voice-and-tone.md).
- **Breakpoints.** JS-driven breakpoints (`useDesktop`, 900px; the 1400px
  share rail) exist only to swap component trees, which CSS cannot do.
  Everything width-responsive inside a tree uses container queries. The style
  lint enforces the CSS half: no viewport `@media` beyond the 900px chrome
  breakpoint.

## The style lint

`passport/scripts/style-lint.mjs` enforces the language absolutely (the
migration burn-down ratchet it started as is retired): no inline `style={}`
blocks, no raw hex outside `styles/theme.css`, no stranded surface components
(`Card`/`Badge`/`Row`), and no viewport `@media` beyond the 900px chrome
breakpoint. A short explicit allowlist in the script covers what a class or
token cannot express: data-driven inline values (medallion and pass sizes,
avatar swatch colors, QR geometry, NavLink's style passthrough), the wallet
pass depictions with their platforms' own colors, QR/PNG paint colors, and
Storybook fixture layout (`*.stories.tsx`, inline styles only; hex stays
banned there too). An allowlist entry needs a reason of that kind; everything
else is a lint failure.

Rules that still hold for any styling change: stories update with their
screen, baselines regenerate through the `screenshot:update` label in the
same change, and copy touched along the way is held to the voice guide.

## Surfaces beyond the app

- **info.sti.care** runs the language (doc 36) and shares the fonts and the
  passport barrel.
- **labs.sti.care** runs it too: its deployed stylesheet is assembled at build
  time from the passport design tokens plus two authored sheets
  (`labs/labs-theme.css`, `labs/labs-site.css`), and it self-hosts the same
  font files the passport serves.
- **The api landing page** (`server/internal/server/landing.html`) stays a
  standalone Go-served file on the real token values (hex with token-name
  comments, system fonts only).

## What stays out of scope

The vendored design system itself does not change, in-app behavior and
navigation do not change (doc 31 owns the app shape), and the wallet pass
interiors keep their bespoke, physical-artifact styling.
