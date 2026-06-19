import type { Meta, StoryObj } from "@storybook/react-vite";
import { CircleCreate } from "./CircleCreate.tsx";

// Create circle / event. The screen starts in the "circle" type; switching the
// Type segmented control to "event" reveals the event-date field and changes
// the expiration options and CTA. Both states are interactive here.
const meta: Meta<typeof CircleCreate> = {
  title: "Passport/Circles/Create",
  component: CircleCreate,
};
export default meta;
type Story = StoryObj<typeof CircleCreate>;

// Default: the empty create form (the primary CTA is disabled until a name is
// entered).
export const Default: Story = {};
