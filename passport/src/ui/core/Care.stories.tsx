import type { Meta, StoryObj } from "@storybook/react-vite";
import { Care } from "./Care.tsx";

// The Care screen: testing, at-home screening, local resource finders, and
// learn-and-talk rows. The only meaningful state difference is the two-state
// badge: a "gray" viewer (no status yet) also sees the at-home screening
// prompt; a "blue" viewer does not.
const meta: Meta<typeof Care> = {
  title: "Passport/Core/Care",
  component: Care,
};
export default meta;
type Story = StoryObj<typeof Care>;

// Gray: no status yet, so the at-home screening prompt is shown.
export const NoStatusYet: Story = { args: { badge: "gray" } };

// Blue: already has a status, so the at-home screening prompt is hidden.
export const HasStatus: Story = { args: { badge: "blue" } };
