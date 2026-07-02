// Site chrome copy: the header, nav, and footer strings shared by every page.
// Kept as data (not inline in Base.astro) so the voice lint scans it like the
// rest of the library copy.
export const SITE = {
  brand: "sti.care",
  tag: "Learn",
  backToApp: "Back to the app",
  nav: [
    { label: "STI basics", href: "/" },
    { label: "U=U", href: "/uu" },
  ],
  tagline: "Plain answers. No judgment.",
} as const;
