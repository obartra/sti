# sti.care — Design System

A warm, sex-positive sexual-health design system. This repository is the single
source of truth for sti.care's brand, visual foundations, reusable UI
components, and full-screen product recreations.

> **Product in one line.** People self-report their STI test results and share a
> single privacy-first **passport** card that shows only a traffic-light status —
> **Clear / In treatment / Out of date** — and never the details. The app guides
> people to testing and care, and lets a positive result **anonymously nudge**
> recent partners to get checked.

---

## Design direction

Clear, modern, and trustworthy — calm and reassuring, **never clinical, never
shaming.** Friendly and inclusive. Soft rounded cards on a warm off-white
background, generous whitespace, one confident accent color, and clear semantic
status colors that are **always paired with an icon + label** so they read in
grayscale and for color-blind users. Clean humanist sans throughout.
Apple Health / Headspace-level calm and clarity. **Mobile-first.**

## Sources & context

This design system defines the **sti.care passport app** — a *new* product
surface. It was authored from a written brand brief (the founding direction is
captured throughout this README).

**The existing sti.care site** — [github.com/obartra/sti](https://github.com/obartra/sti)
(live at [sti.care](https://sti.care)) — is a small, static, multilingual
(EN/ES/PT-BR/FR) information site that helps people find testing and read
simple, judgment-free info on six common STIs (gonorrhea, chlamydia, syphilis,
HIV, herpes, HPV). It is plain HTML/CSS/JS, no framework, published from
`public/` on Netlify.

> **Deliberate style split.** The existing site uses a playful “sticker”
> aesthetic — Bungee + Fredoka type, thick 3px ink outlines, hard offset
> shadows, candy-bright colors on a dotted-paper background. **The passport app
> does *not* inherit that look.** The passport handles sensitive health data and
> intentionally adopts the calm, trustworthy, Apple-Health/Headspace-grade
> system documented here (warm off-white, soft rounded cards, gentle shadows,
> one teal accent). Knowing the site exists tells you **where the passport
> feature will live**; it is not a visual reference for it.

Explore the repo to understand the surrounding product and shared content/voice:
the per-STI copy and four-language strings live in `public/src/data.js`, the
pure view layer in `public/src/render.js`, and all existing styles in
`public/styles.css`.

- _Repo:_ https://github.com/obartra/sti (default branch `main`)
- _Figma:_ none provided — add link when available.

---

## CONTENT FUNDAMENTALS — how sti.care writes

The voice is a **calm, warm friend who happens to be well-informed** — plain,
direct, and de-stigmatizing. It treats sexual health as ordinary self-care.

- **Person & address.** Speak to the user as **“you.”** Refer to sti.care as
  **“we”** sparingly (mostly in privacy/trust copy). The user owns their data,
  so framing is possessive and empowering: *“your passport,” “your results,”
  “what you share.”*
- **Casing.** **Sentence case everywhere** — buttons, titles, labels, nav.
  Never Title Case or ALL CAPS in UI copy. The only uppercase is the small
  letter-spaced eyebrow/overline used sparingly.
- **Tone.** Reassuring and matter-of-fact. Lead with the supportive frame, then
  the action. Normalize, never alarm. *“This happens a lot — here’s the next
  step.”* Avoid clinical jargon (“asymptomatic carrier”), fear words
  (“disease,” “dirty,” “risky”), and anything that implies blame.
- **Anti-stigma rules.** Never label a person by a result. Say *“out of date”*
  not *“lapsed/expired person”*; *“in treatment”* not *“infected.”* The product
  shares a **status**, never a diagnosis. Partner nudges are **anonymous** and
  framed as care, not accusation: *“Someone you’ve been close with suggested
  getting tested. No name, no details.”*
- **Length.** Short. One idea per line. A reassuring sentence may run longer
  (1.65 line-height supports it), but actions and labels are tight.
- **Emoji.** **Not used** in product UI — warmth comes from color, shape, and
  copy, not emoji. (Marketing may use them sparingly; product does not.)
- **Numbers & dates.** Friendly relative time in the UI (*“Updated 3 days ago,”
  “Due in 2 weeks”*). Exact dates are private by default and only shown to the
  owner.

**Examples**

- Title: *“You’re all set”* · sub: *“Your passport is up to date and ready to
  share.”*
- Empty state: *“No results yet. Adding your first test takes about a minute.”*
- Status explainer: *“Clear means your most recent tests came back negative and
  are still in date.”*
- CTA: *“Share my passport”* · secondary: *“Not now”*
- Nudge: *“Get checked when you can — it’s quick, often free, and nothing to
  worry about.”*

---

## VISUAL FOUNDATIONS

**Overall feeling.** Soft, spacious, confidence-inspiring. Lots of warm white
space. Everything sits on rounded cards; nothing is boxed in by harsh lines.

- **Color.** A warm off-white canvas (`#FBF9F4`) with **white cards** floating
  on it. Text is a **near-black ink** (`#1B1B2F`), never pure black. **One**
  confident accent — a calm, trustworthy **teal/blue `#2F9BB3`** — used for
  primary actions, links, and selected states. Status is a strict four-color
  semantic set, always with icon + word: **clear = green `#2E9E6B`**,
  **in treatment = amber `#E0A500`**, **out of date = red `#D7483B`**,
  **no status = neutral gray `#8A8A99`**. Status colors appear as soft tinted
  pills (10–12% backgrounds) or, for the single hero moment, a solid fill.
  No purple, no rainbow gradients.
- **Type.** One clean **humanist sans — Hanken Grotesk** — across display and
  body. Warm and friendly but highly legible for sensitive data. Tight tracking
  on large headings (`-0.02em`), generous line-height on body (1.5) and
  reassurance copy (1.65). Mobile-first scale: body 16px, never below ~13px in
  product. Weights: 400/500/600/700/800.
- **Spacing.** 4px base grid. Generous: 24px card padding, 20px screen gutters,
  32px between sections. Crowding reads as anxious — we stay roomy.
- **Backgrounds.** Flat warm off-white. **No photography-as-background, no
  full-bleed imagery, no repeating patterns.** Optional very-soft abstract
  blobs (teal/warm, low opacity) may sit behind a hero, never busy. Warmth comes
  from the off-white + tint surfaces, not texture.
- **Corner radii.** Soft and consistent: chips 8px, inputs/buttons 12px, cards
  16px, feature cards 20px, sheets & the passport card 28px, pills/avatars full.
- **Cards.** White fill, 16px radius, **gentle layered shadow** (warm-tinted,
  low-opacity — `--shadow-md`), **no border** by default. A `flat` variant uses
  a 1px hairline instead of shadow. The passport hero card carries a soft teal
  glow (`--shadow-accent`).
- **Shadows.** Soft, diffuse, warm-tinted (`rgba(27,27,47,…)`), never hard or
  high-contrast. Four steps sm→xl plus an accent glow. We lift on hover, never
  outline.
- **Borders.** Used sparingly: input outlines, dividers (`--warm-200`), and the
  `flat` card. Default surfaces rely on shadow + radius, not strokes.
- **Animation.** Calm and settled. Durations 120–320ms. Easing favors a gentle
  settle (`--ease-out` `cubic-bezier(0.22,1,0.36,1)`). Fades and small slides;
  the switch thumb glides. **No bounce, no infinite loops, no attention-grabbing
  motion.** All motion respects `prefers-reduced-motion`.
- **Hover states.** Buttons darken one step (teal-500→600); ghost/secondary get
  a teal-50 tint; cards lift 2px with a deeper shadow; rows fill with the sunken
  warm tone.
- **Press states.** Buttons sink slightly (`translateY(1px) scale(0.99)`) and
  darken another step (→teal-700). No color flash.
- **Focus.** A 3px soft teal ring (`--focus-ring`, teal-300) on a transparent
  outline — visible but calm. Always `:focus-visible`.
- **Transparency / blur.** Minimal. Used only for scrim overlays behind sheets
  and dialogs (ink at low alpha, optional light backdrop blur). UI surfaces are
  solid for trust and legibility.
- **Imagery vibe.** When imagery appears it is warm, inclusive, and human —
  soft, optimistic, never clinical or fear-based. Diverse and body-neutral.
  (No stock imagery ships in this system; use the abstract blobs or solid tint
  surfaces as placeholders and request real assets.)
- **Layout rules.** Mobile-first single column. A sticky top bar (logo + one
  action) and a bottom tab bar are the fixed elements. Primary CTAs are
  full-width at the bottom of a flow. Content max-width ~440px on larger screens,
  centered.

---

## ICONOGRAPHY

- **System.** Clean, rounded **line icons at ~2px stroke** with round caps and
  joins — the calm, friendly **[Lucide](https://lucide.dev)** style. UI kits and
  cards load Lucide from CDN; production should install `lucide-react` and keep
  the 2px round style.
- **Status icons are special and ship in this repo.** The four traffic-light
  statuses use **distinct shapes** so they never depend on color alone:
  - **Clear** → circle + check — `assets/icons/status-clear.svg`
  - **In treatment** → circle + clock — `assets/icons/status-treatment.svg`
  - **Out of date** → circle + exclamation — `assets/icons/status-expired.svg`
  - **No status** → circle + minus — `assets/icons/status-none.svg`

  These are also embedded directly inside the `StatusPill` component so a status
  is always color **+ icon + word** together. Use `currentColor` to inherit the
  status color.
- **Emoji / unicode as icons.** Never. Icons are SVG only.
- **Logo.** `assets/logo/` — a teal squircle holding a white verification check
  (the heart of the passport). `logo-mark.svg` (mark only),
  `logo-wordmark.svg` (mark + “sti.care”, dark wordmark for light surfaces),
  `logo-wordmark-light.svg` (white, for teal/dark surfaces). Keep clear space
  around the mark equal to its corner radius; don’t recolor or stretch.

---

## INDEX — what's in this repo

**Foundations / global CSS**
- `styles.css` — global entry point (consumers link this). `@import`s only.
- `tokens/colors.css` — palette + semantic aliases.
- `tokens/typography.css` — families, weights, scale, leading, tracking.
- `tokens/spacing.css` — 4px grid + semantic spacing.
- `tokens/radii.css` — radii, shadows, motion.
- `tokens/fonts.css` — Hanken Grotesk `@import` (Google Fonts).
- `tokens/base.css` — reset + base element styling.
- `components.css` — class styling for the React primitives.

**Components** (`window.StiCareDesignSystem_*`)
- Core: `Button`, `IconButton`, `Card`, `Badge`, `Avatar` (`components/core/`)
- Status: `StatusPill` — the signature traffic-light status (`components/status/`)
- Forms: `Input`, `Switch` (`components/forms/`)
- Navigation: `SegmentedControl`, `ListRow` (`components/navigation/`)

**UI kit**
- `ui_kits/mobile_app/` — the sti.care mobile app: passport, results, add a
  result, and the anonymous partner-nudge flow.

**Assets**
- `assets/logo/` — logo mark + wordmarks.
- `assets/icons/` — the four status SVGs.

**Specimen cards** — small `@dsCard` HTML files across `tokens/` and the
component directories populate the Design System tab (Colors, Type, Spacing,
Brand, Components).

**Skill**
- `SKILL.md` — makes this system usable as a downloadable Agent Skill.

---

## Notes & substitutions

- **Font:** Hanken Grotesk is served from **Google Fonts**, not self-hosted
  binaries. To fully self-host, drop `woff2` files in `assets/fonts/` and replace
  the `@import` in `tokens/fonts.css` with explicit `@font-face` rules.
- **Icons:** general UI uses **Lucide via CDN** (substitution for any future
  custom set). The four **status icons are first-party** and live in `assets/`.
- **Imagery:** no photographic assets ship here — request real, inclusive
  imagery before production.
