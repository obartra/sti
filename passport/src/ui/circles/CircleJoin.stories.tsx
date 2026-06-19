import type { Meta, StoryObj } from "@storybook/react-vite";
import { CircleJoin } from "./CircleJoin.tsx";

// The join flow has three meaningful screens: the invite landing, the
// waiting-for-approval state, and the approved + consent state. Each is shown
// directly via initialStep. (The live flow auto-advances waiting -> consent.)
const meta: Meta<typeof CircleJoin> = {
  title: "Passport/Circles/Join",
  component: CircleJoin,
};
export default meta;
type Story = StoryObj<typeof CircleJoin>;

// Invite landing: event details and what you'll share.
export const Invite: Story = { args: { initialStep: "invite" } };

// Waiting: request sent, waiting for an organizer to approve. autoAdvance off so
// the capture is deterministic (the live flow would move on to consent).
export const Waiting: Story = {
  args: { initialStep: "waiting", autoAdvance: false },
};

// Consent: approved, now confirming you'll share your status with the circle.
export const Consent: Story = { args: { initialStep: "consent" } };
