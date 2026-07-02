import type { Meta, StoryObj } from "@storybook/react-vite";
import { TrustBoundary } from "./TrustBoundary.tsx";

// The blind-store boundary drawn for the /promises page. `wide` is pinned per
// story so the visual harness captures both the across (desktop) and stacked
// (mobile) layouts deterministically.
const meta: Meta<typeof TrustBoundary> = {
  title: "Passport/TrustBoundary",
  component: TrustBoundary,
};
export default meta;
type Story = StoryObj<typeof TrustBoundary>;

// Mobile: the three nodes stack top to bottom, arrows pointing down.
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

// Desktop: the spine runs across, your phone to our server to a viewer.
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
