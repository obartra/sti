import type { Meta, StoryObj } from "@storybook/react-vite";
import { CirclesList } from "./CirclesList.tsx";

// The circles & events list. Meaningful states: a populated list (with an
// organizer badge and a pending-requests count) and the empty state.
const meta: Meta<typeof CirclesList> = {
  title: "Passport/Circles/List",
  component: CirclesList,
};
export default meta;
type Story = StoryObj<typeof CirclesList>;

// Default: the seeded fixture, with organizer badges and a "2 pending" count.
export const Populated: Story = {};

// Empty: no circles yet, so the empty-state card with a Create CTA shows.
export const Empty: Story = { args: { initialCircles: [] } };
