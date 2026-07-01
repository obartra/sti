import type { CSSProperties } from "react";
import type { BadgeState } from "../badge-card.tsx";

// Shared Home helpers: the copy the pause panel still uses, the anchored owner
// dates for stable relative labels, and the lead-tile style shared by the
// dashboard cards. Owner-facing dates only; viewers never see any of this.
export const COPY = {
  pause: {
    manualOn: "Status hidden",
    manualOnSub: "Everyone sees plain gray. Resume whenever you like.",
    resume: "Resume sharing",
    autoTitle: "Status paused while you recover",
    autoSub:
      "After a positive, your card pauses on its own until you’re likely past the window. To anyone else it’s just gray.",
    autoUntil: "Earliest auto-resume",
    autoNote:
      "You can keep it paused longer, but not lift it before the guideline window.",
    extend: "Keep paused longer",
    extended: "Extended",
    ownerOnly: "Only you can see this. Viewers only ever see gray.",
  },
} as const;

// Anchored "today" so the relative owner copy is stable, matching copy.js.
export const TODAY = new Date(2026, 5, 10); // 10 Jun 2026
const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

export function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}
export function fmtDate(d: Date): string {
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

export const leadTile: CSSProperties = {
  flex: "none",
  width: 40,
  height: 40,
  borderRadius: "var(--radius-sm)",
  background: "var(--accent-soft)",
  color: "var(--text-accent)",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
};

// Two-state badge only (blue / gray). Drives the owner's standing; the
// viewer-facing `viewerBadge` drives the honest mirror.
export type HomeBadge = BadgeState;
