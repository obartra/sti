# 36 - The editorial design language (info.sti.care)

## Status: BUILT (the info site runs on it; the app-side adoption is underway, owned by [37-app-editorial-adoption](37-app-editorial-adoption.md))

The info site's visual language and style architecture. Same tokens as the app,
different grammar: where the app is a product of cards and controls, the library
is a publication. This doc owns the rules; the live rendering of every piece is
the unlisted `/styleguide` page on the site itself. Doc 37 owns carrying the
language to the app and the other surfaces; what is info-only is marked.

## Why an editorial skin

The library must read as professional and authoritative while staying
approachable, and it must earn that through structure, not decoration. Tinted
cards, pill chips, and icon tiles read app-like and bubbly at desktop; a
publication reads through typographic hierarchy, hairline rules, density, and
restraint. The skin changes the grammar while keeping the palette, spacing, and
button primitives from `passport/src/design`, so the two surfaces still read as
one brand.

## Type

- **Display serif: Source Serif 4 SemiBold** (OFL), self-hosted as a single
  latin woff2, headings only. Chosen over more literary serifs for its sturdy,
  institutional register; it pairs naturally with Hanken Grotesk, which remains
  the body and UI face everywhere.
- The serif loads with a capsize-metric-tuned Georgia fallback (`size-adjust`
  and overrides in `info/src/styles/fonts.css`), so the swap cannot reflow.
- Scale (clamps interpolate 320px to 1120px viewports): display
  `clamp(32px, 2.8vw + 23px, 54px)`, article title `clamp(27px, 1.7vw + 21px,
  40px)`, section title `clamp(21px, 0.9vw + 18px, 28px)`, prose question 20px.
  Sans: lead `clamp(16px, 0.4vw + 15px, 18px)`, body 16px on 1.65, eyebrow 12px
  bold uppercase at 0.08em, micro 13px floor.
- Reading measure: 66ch (`--measure`).
- Motifs: a hairline rule opens every major section; index sections carry a
  serif numeral eyebrow (`01`), the skin's one decorative accent.

## Surfaces

- The page is the surface: warm-50 everywhere, content structured by hairlines
  (`--hairline` on the background, `--hairline-strong` inside white cards).
- White cards are reserved for exactly two callout types, both 8px radius,
  1px ink-200 border, no shadow: **urgent** (the PEP callout, with a 3px warm
  left rule) and **action** (CTA blocks).
- No tinted card surfaces, no icon tiles, no decorative gradients or glows, no
  shadows, no backdrop blur. Radius appears only on the two callouts and on
  interactive controls (the passport button primitives keep their own).

## Color

- Ink-forward text: headings ink-900, body ink-700, meta ink-500. Ink-400 is
  banned for copy (it fails AA on the warm background); it may only color
  decorative strokes like row chevrons.
- Teal appears only as: links, the primary button, focus rings, and the section
  numerals. It is never a surface.
- **Status labels** are the word in uppercase 12px bold plus the heart glyph,
  no background. The word takes a derived ink
  (`color-mix` toward ink-900 in `info/src/styles/theme.css`) measured at or
  above 4.5:1 on warm-50; the glyph keeps the raw status color. Word plus icon
  stays mandatory so status reads in grayscale and for color-blind users.
- Every text color choice is a token; raw hex exists only in the passport
  tokens and the theme file, enforced by lint.

## Density and rhythm

- The 4px spacing tokens remain the base. Section rhythm is
  `clamp(48px, 5vw + 32px, 88px)`; blocks inside a section sit on space-6.
- Hairline discipline: one rule per boundary, never two lines doing the same
  job, never a rule and a border-box edge together.
- List rows are dense but touchable: condition rows 52px minimum, guide rows
  padded on space-4.
- Motion is hover and focus only; nothing moves layout.

## Layout

- Frame: 1120px max (the app shell's width), gutters
  `clamp(16px, 5vw, 40px)`.
- **One viewport breakpoint: 900px** (shared with the app's desktop shell),
  used only for chrome and page-grid composition. Everything content-level
  responds to its **container** (`.l-zone`), not the viewport, so the same
  component adapts whether it sits beside a rail or full-width. The style lint
  enforces this split.
- The 12-column grid (`.l-grid`) exists at 900px and up; below it, templates
  are single-column and **source order is the phone priority order**. Desktop
  repositions by grid placement only: no `display: contents`, no `order`, and
  the only `display: none` is the header section nav below 900px.
- 320px is the floor and is gated by the visual baselines: single column, full
  gutters at 16px, fluid buttons that wrap their labels instead of clipping.

## Templates and their one action

- **Index**: lookup first (serif display beside the condition table), the one
  primary action (find free testing), the urgent PEP callout, numbered topic
  rails beside dense guide rows, the prevention band as three hairline
  columns, one closing action card.
- **Condition**: serif head with status label, a full-width facts strip (how
  to test, what the label means, related reading), measured prose beside a
  sticky action card, clinician list and share as quiet supportive pieces.
  Primary action: find free testing.
- **Guide**: the condition template minus label and facts; a guide's own
  resource CTA (find PrEP, find free condoms) takes primary when present.
- **U=U**: a centered typographic page; share is the primary action.
- One filled primary button per viewport, ever.

## Style architecture

- Entry: `info/src/styles/global.css` declares the cascade-layer order
  `passport, theme, layout, components, utilities` and imports the passport
  design CSS read-only into the lowest layer. Info-level tokens live in
  `theme.css` under the theme layer; the frame and grid in `layout.css`; the
  markdown body in `prose.css`; tiny helpers in `utilities.css`.
- Components are `.astro` files with **scoped styles**, which are unlayered
  and therefore final: global files never style component internals, and
  components never redeclare tokens.
- The only passport component classes used in info markup are the button
  primitives (`.sti-btn*`), composed but never overridden; contexts that need
  different behavior add a utility (`.u-btn-fluid`) on the element.
- **Style lint** (`info/scripts/style-lint.mjs`, in the `check-info` gate): no
  `style=` attributes, no raw hex outside the theme file, no viewport media
  queries beyond the 900px chrome breakpoint.

## The style guide page

`/styleguide` renders every text style, color, and component with the real CSS:
unlisted, `noindex`, but shipped, so it enters the lost-pixel corpus and the
whole system regresses as one dense target. It is also the review artifact for
adopting the language elsewhere.

## What generalizes to the app, and what stays info-only

Generalizes: the cascade-layer architecture over the shared tokens, the serif
display voice, ink-forward color rules and derived AA status inks, hairline
surface grammar, the container-query policy, the one-primary-action rule, and
the style-lint guardrails. Info-only: the 66ch article measure and prose
styles, the facts strip, and the publication templates; the app's interactive
screens keep the card and control grammar of `passport/src/design` until the
adoption effort defines their editorial equivalents.
