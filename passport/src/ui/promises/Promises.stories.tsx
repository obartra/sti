import type { Meta, StoryObj } from "@storybook/react-vite";
import { Promises } from "./Promises.tsx";

// The plain-English privacy promises page, rendered from the same data the CI gate
// (promises.test.ts) verifies.
const meta: Meta<typeof Promises> = {
  title: "Passport/Promises",
  component: Promises,
};
export default meta;
type Story = StoryObj<typeof Promises>;

export const Default: Story = {};
