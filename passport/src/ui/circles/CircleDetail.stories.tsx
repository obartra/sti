import type { Meta, StoryObj } from "@storybook/react-vite";
import { CircleDetail } from "./CircleDetail.tsx";
import { makeCircleFixture, circleById } from "./shared.tsx";
import type { Circle } from "./shared.tsx";

// Circle / event detail. Meaningful states:
//   Organizer: invite + approvals + manage controls, full roster.
//   Event: a dated event with the date card and a pending-approvals count.
//   Member: no organizer controls (no invite/approvals/manage), only leave.
//   SmallCircle: under the min-5 floor, so the roster is replaced by the
//     small-circle aggregate notice.
const meta: Meta<typeof CircleDetail> = {
  title: "Passport/Circles/Detail",
  component: CircleDetail,
};
export default meta;
type Story = StoryObj<typeof CircleDetail>;

// Thursday crew: organizer, ongoing circle, 8 members (roster shown).
export const Organizer: Story = {};

// Solstice: organizer of a dated event with two pending join requests.
export const Event: Story = {
  args: { circle: circleById(makeCircleFixture(), "sol") },
};

// Fern house: you're a plain member, so only the leave control shows.
export const Member: Story = {
  args: { circle: circleById(makeCircleFixture(), "fern") },
};

// Under 5 people: the roster gives way to the aggregate privacy notice.
const smallCircle: Circle = (() => {
  const base = circleById(makeCircleFixture(), "thu");
  return { ...base, members: base.members.slice(0, 3) };
})();

export const SmallCircle: Story = {
  args: { circle: smallCircle },
};
