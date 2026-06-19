import type { Meta, StoryObj } from "@storybook/react-vite";
import { Linkup } from "./Linkup.tsx";

// Linkup: the in-app mutual-consent handshake. One side's tap only ARMS; the
// encounter write fires only once both have acted. Both-blue completes silently
// and warmly; one-gray shows a single neutral heads-up before Continue
// finalizes. The fully interactive flow starts from Ready (tap yourself, then
// tap the "other phone" stand-in). The remaining stories seed a phase directly
// (via the story-only initial* props) so each state has a deterministic
// baseline.
const meta: Meta<typeof Linkup> = {
  title: "Passport/Connect/Linkup",
  component: Linkup,
};
export default meta;
type Story = StoryObj<typeof Linkup>;

// Ready: in range, both about to tap. Drive the whole flow from here.
export const Ready: Story = {};

// ThemFirst: the other person tapped first; you are the one still to tap.
export const ThemFirst: Story = {
  args: { initialPhase: "armed", initialThemActed: true },
};

// Armed: you tapped, waiting on them. The real consent gate, nothing logged yet.
export const Armed: Story = {
  args: { initialPhase: "armed", initialMeActed: true },
};

// HeadsUp: one side is gray. The single neutral, non-decoding heads-up line.
export const HeadsUp: Story = {
  args: {
    partner: { handle: "devon" },
    partnerGray: true,
    initialPhase: "headsup",
  },
};

// Done: both blue, completed silently and warmly.
export const Done: Story = {
  args: { initialPhase: "done" },
};

// DoneRelog: you two were already linked; this time together is logged again.
export const DoneRelog: Story = {
  args: { alreadyLinked: true, initialPhase: "done" },
};
