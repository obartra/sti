// The index page's framing copy (everything on the library index that is not a
// condition explainer), ported from the app's learn/conditions.ts COPY. The
// condition explainers themselves are markdown under content/conditions. Shared
// labels used by the explainer pages live here too, so all library copy has one
// home the voice lint can scan.
// A framing card's item row: a bold term, a one-line sub, and optionally the
// guide the term links into.
export type LibraryItem = { term: string; sub: string; href?: string };

export const LIBRARY = {
  title: "STI basics",
  sub: "Learn and share what to do. No judgment. One page each.",
  eyebrow: "Free STI guides",
  sourcesLabel: "Sources",
  labelsTitle: "What the label means",
  labelNotes: {
    clear: "Medicine clears it completely.",
    treat: "Medicine keeps it in check for the long run.",
    none: "Most of the time it clears on its own. A vaccine blocks the types that cause harm.",
  },
  shareLabel: "Share this page",
  copied: "Link copied",
  howToTest: "How to test for it",
  footer:
    "This is general info, not medical advice. A clinic or doctor can tell you what is right for you. Based on U.S. CDC guidance.",
  uuCard: {
    title: "Undetectable = Untransmittable",
    sub: "A made-to-share card. Good news, no stigma.",
  },
  uuFromHiv: "Undetectable? Share what U=U means",
  pep: {
    title: "PEP, emergency HIV prevention",
    body: "If you might have been exposed to HIV, PEP can still prevent it, but only if you start within 72 hours. You don't need an alert to ask for it; go now if it's been recent.",
    chip: "72-hour window",
    cta: "Find PEP near me",
  },
  guideCtas: {
    prep: "Find PrEP near me",
    condoms: "Find free condoms near me",
  },
  tools: {
    title: "Ways to lower HIV risk",
    body: "These are different tools, not a ranking, many people use more than one.",
    items: [
      {
        term: "Condoms",
        sub: "Lower the chance of HIV and many other STIs, and prevent pregnancy.",
        href: "/condoms",
      },
      {
        term: "PrEP",
        sub: "A daily pill (or a shot) that prevents HIV when taken as prescribed. HIV-only.",
        href: "/prep",
      },
      {
        term: "U=U",
        sub: "Someone living with HIV who's undetectable on treatment can't pass it on through sex.",
        href: "/uu",
      },
    ] as readonly LibraryItem[],
  },
  vax: {
    title: "Vaccines and screening",
    body: "Free or low-cost at many clinics, and good for everyone, whatever your status.",
    items: [
      {
        term: "HPV vaccine",
        sub: "Protects against the HPV types that cause most warts and, rarely, cancers. You can get it up to age 45.",
      },
      {
        term: "Cervical and anal screening",
        sub: "Routine checks catch changes early. Ask a clinic which screening is right for you.",
      },
    ] as readonly LibraryItem[],
    cta: "Find a clinic near me",
  },
  clinician: {
    title: "When to see a clinician",
    body: "Clinics handle this every day. No lecture, no judgment.",
    items: [
      {
        term: "You have symptoms",
        sub: "Sores, discharge, or burning. Most are easy to treat.",
      },
      {
        term: "A partner tested positive",
        sub: "Get tested too, even if you feel fine. Many STIs show no signs.",
      },
      {
        term: "You may have been exposed to HIV",
        sub: "Ask about PEP right away. It works best within 72 hours.",
      },
    ] as readonly LibraryItem[],
  },
  testing: {
    disclaimer:
      "Getting tested is quick, and many clinics are free or low-cost. If you test positive, treatment usually starts the same day.",
    findTesting: "Find free testing near you",
    findTestingSub: "Opens a map of clinics close to you",
    official: "Or see the official CDC testing list",
  },
} as const;
