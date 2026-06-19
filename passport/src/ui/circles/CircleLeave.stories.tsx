import type { Meta, StoryObj } from "@storybook/react-vite";
import { CircleLeave } from "./CircleLeave.tsx";
import { makeCircleFixture, circleById } from "./shared.tsx";

// Leave / revoke confirmation. The screen is presentational with a single
// layout; the meaningful variations are which circle name it confirms against.
const meta: Meta<typeof CircleLeave> = {
  title: "Passport/Circles/Leave",
  component: CircleLeave,
};
export default meta;
type Story = StoryObj<typeof CircleLeave>;

// Default: leaving the Thursday crew circle.
export const Default: Story = {};

// Leaving a dated event instead of an ongoing circle.
export const Event: Story = {
  args: { circle: circleById(makeCircleFixture(), "sol") },
};
