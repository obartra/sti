import type { Meta, StoryObj } from "@storybook/react-vite";
import { CircleApprovals } from "./CircleApprovals.tsx";
import { makeCircleFixture, circleById } from "./shared.tsx";
import type { Circle } from "./shared.tsx";

// The approvals queue. Meaningful states: pending requests to approve/decline,
// and the empty state. Approving or declining a request mutates the local copy
// (decline is sticky, the row stays as "Declined").
const meta: Meta<typeof CircleApprovals> = {
  title: "Passport/Circles/Approvals",
  component: CircleApprovals,
};
export default meta;
type Story = StoryObj<typeof CircleApprovals>;

const emptyCircle: Circle = (() => {
  const base = circleById(makeCircleFixture(), "thu");
  return { ...base, requests: [] };
})();

// Pending: the Solstice event has two pending join requests.
export const Pending: Story = {};

// Empty: no pending requests.
export const Empty: Story = { args: { circle: emptyCircle } };
