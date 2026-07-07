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

// A grantable knock: the contentless "someone asked" row offers two choices (doc
// 13), show once (a point-in-time snapshot) or let them keep checking (live access).
// Still never names the requester or a count.
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
        sub: "Choose how much they get to see.",
        choices: [
          {
            label: "Show once",
            sub: "They see your status now, this once.",
            onAct: () => undefined,
          },
          {
            label: "Let them keep checking",
            sub: "They can check your status until you turn it off.",
            onAct: () => undefined,
          },
        ],
      },
    ],
  },
};
