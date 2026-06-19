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
