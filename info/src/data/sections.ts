// The library's topic sections. Array order is display order on the index and
// in the nav; ids double as the index anchor and the guides' topic frontmatter
// (the content schema imports SECTION_IDS, so a typo'd topic fails the build).
// Copy lives here so the voice lint scans it.
export const SECTION_IDS = [
  "getting-tested",
  "protection",
  "talking",
  "positive",
] as const;

export type SectionId = (typeof SECTION_IDS)[number];

export const SECTIONS: readonly {
  id: SectionId;
  title: string;
  navLabel: string;
  sub: string;
}[] = [
  {
    id: "getting-tested",
    title: "Getting tested",
    navLabel: "Testing",
    sub: "The visit, the tests, and why feeling fine proves nothing.",
  },
  {
    id: "protection",
    title: "Protection that works",
    navLabel: "Protection",
    sub: "Different tools, different jobs. Most people mix them.",
  },
  {
    id: "talking",
    title: "Talking about it",
    navLabel: "Talking",
    sub: "Short scripts for the conversations that feel big.",
  },
  {
    id: "positive",
    title: "If you test positive",
    navLabel: "Positive results",
    sub: "A result is a next step, not a verdict.",
  },
];
