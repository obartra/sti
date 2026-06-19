import type { Meta, StoryObj } from "@storybook/react-vite";
import { UU } from "./UU.tsx";

// The shareable U=U education card.
const meta: Meta<typeof UU> = {
  title: "Passport/Learn/U=U",
  component: UU,
};
export default meta;
type Story = StoryObj<typeof UU>;

export const Default: Story = {};
