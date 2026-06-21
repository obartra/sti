import type { Meta, StoryObj } from "@storybook/react-vite";
import { Exposed } from "./Exposed.tsx";

// The public, anonymous page the off-app heads-up text links to
// (sti.care/exposed): calm next steps (test, PEP, PrEP), no account, no identity.
const meta: Meta<typeof Exposed> = {
  title: "Passport/Public/Exposed",
  component: Exposed,
};
export default meta;
type Story = StoryObj<typeof Exposed>;

export const Default: Story = {};
