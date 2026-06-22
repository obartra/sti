// Copy for Connect and its presentational sections. (Scan / in-person linkup copy
// was dropped with those screens; they return with the slice-7 device flow.)
export const COPY = {
  title: "Connect",
  sub: "Linkups stay private and live only on your device. There’s no search, you connect by sharing a link.",
  shareTile: "Share my link",
  shareTileSub: "Send your link for someone to open",
  favesTitle: "Faves",
  favesSub: "Star anyone to keep them at the top",
  pruneNote: "Linkups older than your 90-day window are removed automatically.",
  menuDelete: "Delete linkup",
  showMore: "Show more",
  recentTitle: "Recent linkups",
  privacyTitle: "How this stays private",
  privacy: [
    "No directory, no @-search, a stranger can’t look you up.",
    "You only appear to people you’ve sent a link to, and a link always takes both confirmations.",
    "Linkups are pairwise references stored on your device, never names. Delete any one anytime.",
  ],
  empty: "No linkups yet. Share a link to start.",
  favesEmpty: "Star anyone in your linkups to keep them here.",
} as const;
