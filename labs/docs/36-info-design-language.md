# 36 - The editorial design language (info.sti.care)

The info site's visual language and style architecture. Same tokens as the app,
different grammar: where the app is a product of cards and controls, the library
is a publication. This doc owns the rules; the live rendering of every piece is
the unlisted style-guide page on the site itself. Where a decision generalizes
to the app or the other surfaces, that is noted, and what is info-only is marked.

## Why an editorial skin

The library must read as professional and authoritative while staying
approachable, and it must earn that through structure, not decoration. Tinted
cards, pill chips, and icon tiles read app-like and bubbly at desktop; a
publication reads through typographic hierarchy, hairline rules, density, and
restraint. The skin changes the grammar while keeping the palette, spacing, and
button primitives shared with the app, so the two surfaces still read as one
brand.

## Type

- **Display serif: Source Serif 4 SemiBold** (OFL), self-hosted as a single
  latin font file, headings only. Chosen over more literary serifs for its
  sturdy, institutional register; it pairs naturally with Hanken Grotesk, which
  remains the body and UI face everywhere.
- The serif loads with a capsize-metric-tuned Georgia fallback, so the swap
  cannot reflow.
- A fluid type scale runs from a large display size at the top, down through
  article title, section title, and prose question sizes, to body. The sans
  scale runs from a lead size down through body (set on generous line height),
  a small bold uppercase eyebrow with wide tracking, and a micro floor.
- A comfortable reading measure of roughly 66 characters.
- Motifs: a hairline rule opens every major section; index sections carry a
  serif numeral eyebrow (01), the skin's one decorative accent.

## Surfaces

- The page is the surface: the warm background everywhere, content structured
  by hairlines (a lighter hairline on the background, a stronger one inside
  white cards).
- White cards are reserved for exactly two callout types, both with a small
  radius, a thin ink border, and no shadow: **urgent** (the PEP callout, with a
  warm left rule) and **action** (CTA blocks).
- No tinted card surfaces, no icon tiles, no decorative gradients or glows, no
  shadows, no backdrop blur. Radius appears only on the two callouts and on
  interactive controls (the button primitives keep their own).

## Color

- Ink-forward text: headings in the darkest ink, body in a mid ink, meta in a
  lighter ink. The lightest ink is banned for copy (it fails AA on the warm
  background); it may only color decorative strokes like row chevrons.
- Teal appears only as: links, the primary button, focus rings, and the section
  numerals. It is never a surface.
- **Status labels** are the word in small bold uppercase plus the heart glyph,
  no background. The word takes a derived ink pushed toward the darkest ink and
  measured at or above 4.5:1 on the warm background; the glyph keeps the raw
  status color. Word plus icon stays mandatory so status reads in grayscale and
  for color-blind users.
- Every text color choice is a token; raw hex exists only in the shared token
  and theme definitions, enforced by lint.

## Density and rhythm

- The base spacing scale remains the base. Section rhythm is fluid, and blocks
  inside a section sit on a consistent smaller step.
- Hairline discipline: one rule per boundary, never two lines doing the same
  job, never a rule and a border-box edge together.
- List rows are dense but touchable: condition rows keep a comfortable touch
  minimum, guide rows are padded.
- Motion is hover and focus only; nothing moves layout.

## Layout

- Frame: a fixed max width matching the app shell, with fluid gutters.
- **One shared desktop breakpoint** (the same one the app's desktop shell uses),
  used only for chrome and page-grid composition. Everything content-level
  responds to its **container**, not the viewport, so the same component adapts
  whether it sits beside a rail or full-width. The style lint enforces this
  split.
- The 12-column grid exists at desktop and up; below it, templates are
  single-column and **source order is the phone priority order**. Desktop
  repositions by grid placement only, without reordering tricks, and the only
  thing hidden below desktop is the header section nav.
- The narrow floor is gated by the visual baselines: single column, full
  gutters, fluid buttons that wrap their labels instead of clipping.

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

- The cascade is ordered in explicit layers, lowest to highest: the shared
  design tokens, then theme, layout, components, and utilities. The shared
  design CSS is imported read-only into the lowest layer. Info-level tokens
  live in the theme layer; the frame and grid in the layout layer; the markdown
  body and small helpers in their own files.
- Components carry **scoped styles**, which are unlayered and therefore final:
  global files never style component internals, and components never redeclare
  tokens.
- The only shared component classes used in info markup are the button
  primitives, composed but never overridden; contexts that need different
  behavior add a utility on the element rather than reaching into the primitive.
- **Style lint** (in the info gate): no inline style attributes, no raw hex
  outside the theme definition, no viewport media queries beyond the one shared
  chrome breakpoint.

## The style guide page

The style-guide page renders every text style, color, and component with the
real CSS: unlisted and noindex, but shipped, so it enters the visual-baseline
corpus and the whole system regresses as one dense target. It is also the
review artifact for adopting the language elsewhere.

## What generalizes to the app, and what stays info-only

Generalizes to the app: the layered cascade over the shared tokens, the serif
display voice, ink-forward color rules and derived AA status inks, the hairline
surface grammar, the container-query policy, the one-primary-action rule, and
the style-lint guardrails, with the app carrying its own editorial equivalents
of cards and rows. Info-only: the article reading measure and prose styles, the
facts strip, and the publication templates.
