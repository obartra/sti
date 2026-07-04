import type { Meta, StoryObj } from "@storybook/react-vite";
import { FirstRunSetup } from "./FirstRunSetup.tsx";

// B3: first-run setup. Reach defaults to "Ask first" (Gated, private by default);
// Direct is the instant-open opt-in, and only the selected mode's description
// shows. Findable is the third mode (the row points to Settings, where a name is
// claimed).
const meta: Meta<typeof FirstRunSetup> = {
  title: "Passport/Onboarding/First-run setup",
  component: FirstRunSetup,
};
export default meta;
type Story = StoryObj<typeof FirstRunSetup>;

export const Default: Story = {
  // Wire the "keep me signed in" toggle so the story shows it (doc 24); default ON.
  args: { keepSignedIn: true, onKeepSignedInChange: () => undefined },
};
