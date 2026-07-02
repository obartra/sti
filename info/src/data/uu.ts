// The U=U page copy, ported verbatim from the app's learn/UU.tsx. Kept as data (not
// markdown) because the page is a single fixed layout with a themed hero; the copy
// still lives in one scannable place for the voice lint. Emphasis is written with
// **markers** and rendered via the shared emph() helper.
export const UU = {
  label: "U=U",
  title: "Undetectable = Untransmittable",
  intro:
    "A person with HIV who's on treatment and undetectable can't pass HIV through sex. Not lower risk, none. Share this page to say exactly that.",
  qa: [
    [
      'What "undetectable" means',
      "Daily HIV medicine lowers the virus until a test can't find it. Most people get there within about 6 months and stay there.",
    ],
    [
      "Undetectable = Untransmittable",
      "An undetectable person **cannot** pass HIV to sexual partners. Not lower risk, zero. This is settled science, backed by large studies and the U.S. CDC.",
    ],
    [
      "What it means for a partner",
      "Sex with an undetectable partner carries **no** risk of HIV. (Condoms still help with other STIs and pregnancy.)",
    ],
    [
      "Sharing this is the responsible move",
      "An undetectable status isn't a warning, it's good news. No stigma, no transmission risk.",
    ],
  ],
  privacyNote:
    "This card is education anyone can share. Your own passport never shows U=U; an undetectable result simply reads as up to date.",
  disclaimer:
    "U=U is backed by large studies and public health agencies, including the U.S. CDC.",
  sources: [
    {
      label: "U.S. CDC, HIV treatment",
      href: "https://www.cdc.gov/stophivtogether/hiv-treatment/index.html",
    },
    {
      label: "U.S. CDC, Undetectable = untransmittable",
      href: "https://www.cdc.gov/global-hiv-tb/php/our-approach/undetectable-untransmittable.html",
    },
  ],
} as const;
