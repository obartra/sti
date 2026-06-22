import type { Meta, StoryObj } from "@storybook/react-vite";
import { Notifications } from "./Notifications.tsx";

// The activity inbox. Each row is a privacy-safe prompt: it never names a
// condition or a person in its own text. The empty state shows "All caught up".
const meta: Meta<typeof Notifications> = {
  title: "Passport/Core/Notifications",
  component: Notifications,
};
export default meta;
type Story = StoryObj<typeof Notifications>;

// Default: the four standard notification rows from the source copy.
export const Default: Story = {};

// Empty: nothing to act on, shows the "All caught up" card.
export const Empty: Story = { args: { items: [] } };

// A grantable knock: the contentless "someone asked" row gains an Approve action
// (in-app grant, doc 13). Still never names the requester or a count.
export const Approvable: Story = {
  args: {
    items: [
      {
        icon: "bell",
        title: "Time to re-test",
        sub: "Your status has gone gray. A fresh test brings it back.",
      },
      {
        icon: "users",
        title: "Someone with your link asked to see your status",
        sub: "Approve to let them see your current status",
        action: { label: "Approve", onAct: () => undefined },
      },
    ],
  },
};
