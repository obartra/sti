import type { Meta, StoryObj } from "@storybook/react-vite";
import { FirstRunSetup } from "./FirstRunSetup.tsx";

// B3: first-run setup (sharing defaults to private; "Everyone" is an opt-in).
const meta: Meta<typeof FirstRunSetup> = {
  title: "Passport/Onboarding/First-run setup",
  component: FirstRunSetup,
};
export default meta;
type Story = StoryObj<typeof FirstRunSetup>;

export const Default: Story = {};
