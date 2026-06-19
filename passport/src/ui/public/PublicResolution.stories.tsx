import type { Meta, StoryObj } from "@storybook/react-vite";
import { PublicResolution } from "./PublicResolution.tsx";

// A2: the logged-out public resolution surface and its states.
const meta: Meta<typeof PublicResolution> = {
  title: "Passport/Public resolution",
  component: PublicResolution,
};
export default meta;
type Story = StoryObj<typeof PublicResolution>;

// A stranger opened a public link (key in the fragment): the card resolves,
// with the stranger explainer and the claim/verify CTAs.
export const ResolvedForStranger: Story = {
  args: {
    resolved: {
      state: "blue",
      labels: ["hiv", "condoms_always"],
      identity: { handle: "sam" },
    },
  },
};

// The owner previewing their own card ("this is what others see"): banner, no CTAs.
export const SelfPreview: Story = {
  args: {
    self: true,
    resolved: { state: "blue", labels: ["hiv"], identity: { handle: "robin" } },
  },
};

// A link-holder hit a private (keyless) alias: uniform gray-nothing + the knock
// affordance + the footnote.
export const LinkHolderKnock: Story = {
  args: {
    linkHolder: true,
    resolved: null,
  },
};

export const LinkHolderKnockSent: Story = {
  args: {
    linkHolder: true,
    initialKnockSent: true,
    resolved: null,
  },
};

// A cold / guessed / anonymous open: uniform gray-nothing, button-free,
// byte-identical to a nonexistent alias.
export const ColdGrayNothing: Story = {
  args: {
    resolved: null,
  },
};
