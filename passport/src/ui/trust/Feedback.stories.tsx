import type { Meta, StoryObj } from "@storybook/react-vite";
import { Feedback } from "./Feedback.tsx";

// The "Something wrong?" form (doc 35): a fixed category plus an optional note. The
// submit transport is stubbed so the form renders without a server.
const meta: Meta<typeof Feedback> = {
  title: "Passport/Trust/Feedback",
  component: Feedback,
  args: {
    submit: () => Promise.resolve(),
    onClose: () => undefined,
  },
};
export default meta;
type Story = StoryObj<typeof Feedback>;

export const Default: Story = {};
