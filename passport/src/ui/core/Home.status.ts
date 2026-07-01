import type { ReportPreview } from "../../core/report.ts";
import type { HomeBadge } from "./Home.parts.tsx";

// The owner's real standing, derived from the badge plus whether they have ever
// tested. This is the honest lead line: a fresh owner who has never tested reads
// as "not set up", never as green/clear. Order matters: paused first (an owner
// choice or a recovery window), then untested, then blue, then a lapsed or
// still-gray status.
export type Standing = "paused" | "untested" | "blue" | "lapsed" | "gray";

interface StandingArgs {
  badge: HomeBadge;
  paused: boolean;
  tested: boolean;
  daysLeft: number;
}

// The freshness window has lapsed when the owner has tested before but has no
// days left; distinct from never having tested, which is "not set up".
export function standingOf({
  badge,
  paused,
  tested,
  daysLeft,
}: StandingArgs): Standing {
  if (paused) return "paused";
  if (!tested) return "untested";
  if (badge === "blue") return "blue";
  if (daysLeft === 0) return "lapsed";
  return "gray";
}

// The lead-line copy for each standing: a plain status word plus a one-line read
// of what it means for the owner. No paragraphs, no mechanism.
export const STANDING_COPY: Record<
  Standing,
  { title: string; sub: string; tone: "blue" | "gray" }
> = {
  paused: {
    title: "Your status is paused",
    sub: "People see gray until you turn it back on.",
    tone: "gray",
  },
  untested: {
    title: "Not set up yet",
    sub: "Add your first test to start sharing where you stand.",
    tone: "gray",
  },
  blue: {
    title: "Up to date",
    sub: "Your card is blue and ready to share.",
    tone: "blue",
  },
  lapsed: {
    title: "Time to re-test",
    sub: "Your last test aged out, so your card is gray.",
    tone: "gray",
  },
  gray: {
    title: "Gray for now",
    sub: "A couple of things still need to be met for blue.",
    tone: "gray",
  },
};

// The prominent "next test" line. An untested owner takes their first test; a
// lapsed owner is overdue; otherwise it counts down to the freshness lapse.
export interface NextTest {
  label: string;
  overdue: boolean;
}

export function nextTest(
  standing: Standing,
  daysLeft: number,
  dueLabel: string,
): NextTest {
  if (standing === "untested")
    return { label: "Take your first test", overdue: false };
  // Overdue is keyed to the LAPSED standing, not daysLeft === 0: on the last day
  // of the window (age 90) the card is still blue while daysLeft is already 0, so
  // "overdue" there would contradict the "up to date" lead line. That day reads
  // "due today"; only a genuinely lapsed card is overdue.
  if (standing === "lapsed")
    return { label: "Overdue, test now", overdue: true };
  if (daysLeft === 0) return { label: "Due today", overdue: false };
  const days = daysLeft === 1 ? "1 day" : `${daysLeft} days`;
  return { label: `Due ${dueLabel} · in ${days}`, overdue: false };
}

// The three blue requirements as checklist rows: the criterion, whether it is
// met, and the one action word that advances it. Kept in sync with the badge via
// the shared {@link ReportPreview}.
export interface ChecklistRow {
  met: boolean;
  title: string;
  action: string;
  kind: "test" | "clear" | "route";
}

export function checklistRows(standing: ReportPreview): ChecklistRow[] {
  return [
    {
      met: standing.recentPanel,
      title: "A recent test",
      action: "Add a result",
      kind: "test",
    },
    {
      met: standing.clear,
      title: "Clear right now",
      action: "Update care",
      kind: "clear",
    },
    {
      met: standing.route,
      title: "HIV prevention in place",
      action: "Set prevention",
      kind: "route",
    },
  ];
}
