import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { DesktopLanding, DesktopShell, type DesktopTab } from "./Desktop.tsx";
import { BadgeCard } from "../badge-card.tsx";

// Passport/Desktop: the >=desktop-breakpoint layer. Rendered fullscreen so the
// Storybook preview does not wrap them in the centered mobile surface.
const meta: Meta = {
  title: "Passport/Desktop",
  parameters: { layout: "fullscreen" },
};
export default meta;
type Story = StoryObj;

// A1: desktop marketing landing.
export const Landing: Story = {
  render: () => <DesktopLanding />,
};

// The desktop app shell: sidebar nav + centered content column. Sample content
// is the existing BadgeCard.
export const Shell: Story = {
  render: function ShellStory() {
    const [tab, setTab] = useState<DesktopTab>("home");
    return (
      <DesktopShell tab={tab} onTab={setTab}>
        <BadgeCard
          state="blue"
          labels={["hiv", "condoms_always"]}
          identity={{ handle: "robin" }}
          width="100%"
        />
      </DesktopShell>
    );
  },
};

// The wide (>=1400px) layout: a persistent right-hand share rail beside the
// content on top-level tabs, with the header Share button hidden. `wide` is
// forced so the rail is captured deterministically regardless of viewport.
export const WideWithShareRail: Story = {
  render: function WideStory() {
    const [tab, setTab] = useState<DesktopTab>("home");
    return (
      <DesktopShell tab={tab} onTab={setTab} wide>
        <BadgeCard
          state="blue"
          labels={["hiv", "condoms_always"]}
          identity={{ handle: "robin" }}
          width="100%"
        />
      </DesktopShell>
    );
  },
};
