import type { Meta, StoryObj } from "@storybook/react-vite";
import { Home } from "./Home.tsx";

// Home is a single scannable dashboard: the owner's honest standing, the next
// test, the three things blue needs, what people see on your links, and the
// actions. The meaningful states are the standing kinds (untested, blue, lapsed,
// a positive/treatment gray) plus the owner-only pause panel.
const meta: Meta<typeof Home> = {
  title: "Passport/Core/Home",
  component: Home,
};
export default meta;
type Story = StoryObj<typeof Home>;

// Blue: up to date, on HIV prevention. The primary action is "Share my passport".
export const BlueUpToDate: Story = {
  args: {
    badge: "blue",
    viewerBadge: "blue",
    labels: ["hiv"],
    handle: "robin",
  },
};

// Untested: never recorded a panel. Reads as "Not set up yet", not clear/green.
// The next-test line invites the first test and the checklist is all unmet.
export const Untested: Story = {
  args: {
    badge: "gray",
    viewerBadge: "gray",
    labels: [],
    handle: "robin",
    standing: {
      recentPanel: false,
      clear: false,
      route: false,
      willBeBlue: false,
    },
    tested: false,
    daysLeft: 0,
  },
};

// Lapsed: tested before, but the last panel aged out of the 90-day window.
// Reads "Time to re-test" and the next test is overdue.
export const Lapsed: Story = {
  args: {
    badge: "gray",
    viewerBadge: "gray",
    labels: [],
    handle: "robin",
    standing: {
      recentPanel: false,
      clear: true,
      route: true,
      willBeBlue: false,
    },
    tested: true,
    daysLeft: 0,
  },
};

// Positive/treatment: a reported positive holds the badge gray on its own until
// the clearance window passes. The owner sees the pause panel; viewers see gray.
export const PositiveInTreatment: Story = {
  args: {
    badge: "gray",
    viewerBadge: "gray",
    labels: [],
    handle: "robin",
    autoPaused: true,
  },
};

// Manual pause: owner hid their status. Viewers see gray; the owner can resume.
export const PausedManual: Story = {
  args: {
    badge: "blue",
    viewerBadge: "gray",
    labels: ["hiv"],
    paused: true,
    handle: "robin",
  },
};

// No display name set: the greeting falls back to "Your passport".
export const NoName: Story = {
  args: { badge: "blue", viewerBadge: "blue", labels: ["hiv"] },
};

// Re-test due soon: fresh-but-approaching, so the next-test line counts down.
export const RetestDueSoon: Story = {
  args: {
    badge: "blue",
    viewerBadge: "blue",
    labels: ["hiv"],
    handle: "robin",
    daysLeft: 6,
  },
};

// A continuity nudge is due (doc 32): the dismissible phrase-rehearsal card sits
// near the top of the dashboard. It never blocks anything and skipping is a no-op.
export const ContinuityNudgeDue: Story = {
  args: {
    badge: "blue",
    viewerBadge: "blue",
    labels: ["hiv"],
    handle: "robin",
    continuityNudge: "phrase",
    onNudgeSettings: () => undefined,
    onNudgeDismiss: () => undefined,
  },
};
