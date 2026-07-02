import type { Meta, StoryObj } from "@storybook/react-vite";
import { Promises } from "./Promises.tsx";

// The plain-English privacy promises page, rendered from the same data the CI gate
// (promises.test.ts) verifies. The `wide` prop is pinned per story so the visual
// harness (fixed ~1280px viewport) captures both layouts deterministically.
const meta: Meta<typeof Promises> = {
  title: "Passport/Promises",
  component: Promises,
};
export default meta;
type Story = StoryObj<typeof Promises>;

// Mobile: a phone-width accordion, one theme open at a time.
export const Default: Story = {
  args: { wide: false },
  decorators: [
    (Story) => (
      <div className="u-w-phone">
        <Story />
      </div>
    ),
  ],
};

// Desktop: the three themes stand open side by side as a wall of receipts.
export const Desktop: Story = {
  args: { wide: true },
  decorators: [
    (Story) => (
      <div className="u-w-wide">
        <Story />
      </div>
    ),
  ],
};
