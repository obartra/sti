import type { Meta, StoryObj } from "@storybook/react-vite";
import { Home } from "./Home.tsx";

// C1 Home: the badge card is the hero, plus the single next-best action, the
// "what this means" explainer, quick actions, and a re-test reminder. The
// meaningful states are the two-state badge (blue / gray) and the owner-only
// pause panel (manual hide vs. auto-pause), which always renders the hero as a
// uniform gray to viewers.
const meta: Meta<typeof Home> = {
  title: "Passport/Core/Home",
  component: Home,
};
export default meta;
type Story = StoryObj<typeof Home>;

// Blue: up to date, on HIV prevention. The action is "Share my passport".
export const BlueUpToDate: Story = {
  args: { badge: "blue", viewerBadge: "blue", labels: ["hiv"] },
};

// Gray: no status shared yet. The action is "Add a result".
export const GrayNoStatus: Story = {
  args: { badge: "gray", viewerBadge: "gray", labels: [] },
};

// Manual pause: owner hid their status. Viewers see gray; the owner sees the
// pause panel and a "Resume sharing" action.
export const PausedManual: Story = {
  args: { badge: "blue", viewerBadge: "gray", labels: ["hiv"], paused: true },
};

// Auto-pause: from a logged positive's clearance window. The panel shows an
// earliest auto-resume date and a "Keep paused longer" action.
export const PausedAuto: Story = {
  args: {
    badge: "blue",
    viewerBadge: "gray",
    labels: ["hiv"],
    autoPaused: true,
  },
};
