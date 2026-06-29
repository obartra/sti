import type { Meta, StoryObj } from "@storybook/react-vite";
import { LegalPage } from "./LegalPage.tsx";
import { PRIVACY_POLICY, TERMS } from "./trustCopy.ts";

// The privacy policy and terms pages (doc 23), rendered as a layered notice from the
// centralized, voice-checked copy: a plain-language summary on top of each section,
// with the full binding text kept visible underneath.
const meta: Meta<typeof LegalPage> = {
  title: "Passport/Legal",
  component: LegalPage,
};
export default meta;
type Story = StoryObj<typeof LegalPage>;

// Desktop: the wider reading measure the trust pages use above the breakpoint.
export const Privacy: Story = {
  args: { doc: PRIVACY_POLICY },
  decorators: [
    (Story) => (
      <div style={{ width: 720 }}>
        <Story />
      </div>
    ),
  ],
};

export const Terms: Story = {
  args: { doc: TERMS },
  decorators: [
    (Story) => (
      <div style={{ width: 720 }}>
        <Story />
      </div>
    ),
  ],
};

// Mobile: a phone-width reading column.
export const PrivacyMobile: Story = {
  args: { doc: PRIVACY_POLICY },
  decorators: [
    (Story) => (
      <div style={{ width: 380 }}>
        <Story />
      </div>
    ),
  ],
};

export const TermsMobile: Story = {
  args: { doc: TERMS },
  decorators: [
    (Story) => (
      <div style={{ width: 380 }}>
        <Story />
      </div>
    ),
  ],
};
