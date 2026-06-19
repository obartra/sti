import type { Meta, StoryObj } from "@storybook/react-vite";
import { Results } from "./Results.tsx";

// The owner's private test-results screen. Owner-only detail (exact dates,
// clinical outcomes, full history) lives here legitimately; partners only ever
// see the overall badge. Toggle Recent / History via the segmented control.
const meta: Meta<typeof Results> = {
  title: "Passport/Core/Results",
  component: Results,
};
export default meta;
type Story = StoryObj<typeof Results>;

// Default: lands on the Recent tab; switch to History in-story.
export const Default: Story = {};

// Empty Recent: someone who hasn't logged a recent test, with prior history.
export const NoRecent: Story = { args: { recent: [] } };
