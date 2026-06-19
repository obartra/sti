import type { Meta, StoryObj } from "@storybook/react-vite";
import { CircleManage } from "./CircleManage.tsx";
import { makeCircleFixture, circleById } from "./shared.tsx";

// Manage & roles (organizer). Meaningful states:
//   NoExpiration: an ongoing circle with expiration set to None.
//   WithExpiration: a circle that already has a dated expiry selected.
const meta: Meta<typeof CircleManage> = {
  title: "Passport/Circles/Manage",
  component: CircleManage,
};
export default meta;
type Story = StoryObj<typeof CircleManage>;

// Thursday crew: no expiry set; the segmented control sits on "None".
export const NoExpiration: Story = {};

// Fern house: an expiry date is already set, so "30 Jun 2026" is active.
export const WithExpiration: Story = {
  args: { circle: circleById(makeCircleFixture(), "fern") },
};
