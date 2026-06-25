import type { Meta, StoryObj } from "@storybook/react-vite";
import { FirstRunSetup } from "./FirstRunSetup.tsx";

// B3: first-run setup. Reach defaults to Direct (doc 16); "Ask first" (Gated) is
// the approve-each-viewer alternative, and Findable is the third mode (now
// launched; the row points to Settings, gated by FINDABLE_ENABLED).
const meta: Meta<typeof FirstRunSetup> = {
  title: "Passport/Onboarding/First-run setup",
  component: FirstRunSetup,
};
export default meta;
type Story = StoryObj<typeof FirstRunSetup>;

export const Default: Story = {};
