// Landing copy, inlined verbatim from copy.js (the desktop Landing reuses the
// mobile `landing` strings). Kept in its own module so the section components
// file stays under the length ceiling.
export const LANDING = {
  eyebrow: "The pocket STI passport",
  title: "Know where you stand.",
  sub: "Share a link or scan in person to see where someone stands. Just the status, never the details.",
  claim: "Claim your passport",
  sample: "See a sample card",
  points: [
    [
      "Know before you meet",
      "Open the link they share, or scan in person, and see if they’re up to date before you connect.",
    ],
    [
      "Share without oversharing",
      "Your card shows one simple status. It never shows what you tested for.",
    ],
    [
      "Hear when it matters",
      "If a recent partner tests positive, you get an anonymous alert to go get tested.",
    ],
  ],
} as const;
