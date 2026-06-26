import type { Meta, StoryObj } from "@storybook/react-vite";
import { LegalPage } from "./LegalPage.tsx";
import { PRIVACY_POLICY, TERMS } from "./trustCopy.ts";

// The privacy policy and terms pages (doc 22), rendered from the centralized,
// voice-checked copy.
const meta: Meta<typeof LegalPage> = {
  title: "Passport/Legal",
  component: LegalPage,
};
export default meta;
type Story = StoryObj<typeof LegalPage>;

export const Privacy: Story = { args: { doc: PRIVACY_POLICY } };
export const Terms: Story = { args: { doc: TERMS } };
