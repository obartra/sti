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

// Mobile: a phone-width reading column.
export const Default: Story = {
  decorators: [
    (Story) => (
      <div style={{ width: 380 }}>
        <Story />
      </div>
    ),
  ],
};

// Desktop: the wider reading measure the promises page uses above the breakpoint.
export const Desktop: Story = {
  decorators: [
    (Story) => (
      <div style={{ width: 720 }}>
        <Story />
      </div>
    ),
  ],
};
