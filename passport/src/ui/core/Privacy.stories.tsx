import type { Meta, StoryObj } from "@storybook/react-vite";
import { Privacy } from "./Privacy.tsx";

// C6 privacy & sharing: alias management (list / create / visibility / revoke),
// knock requests, card attributes, controls, and the danger zone.
const meta: Meta<typeof Privacy> = {
  title: "Passport/Core/Privacy & sharing",
  component: Privacy,
};
export default meta;

type Story = StoryObj<typeof Privacy>;

export const Default: Story = {};
