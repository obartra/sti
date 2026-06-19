import type { Meta, StoryObj } from "@storybook/react-vite";
import { Landing } from "./Landing.tsx";

// A1: the logged-out marketing landing.
const meta: Meta<typeof Landing> = {
  title: "Passport/Landing",
  component: Landing,
};
export default meta;
type Story = StoryObj<typeof Landing>;

export const Default: Story = {};
