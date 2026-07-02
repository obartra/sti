import type { Meta, StoryObj } from "@storybook/react-vite";
import { LegalPage } from "./LegalPage.tsx";
import { PRIVACY_POLICY, TERMS } from "./trustCopy.ts";

// The privacy policy and terms pages (doc 23), rendered as a layered notice from the
// centralized, voice-checked copy: a plain-language summary AND the full binding text
// kept visible. On a wide screen the summary sits beside the binding text; on mobile
// they stack. The `wide` prop is pinned per story so the visual harness (fixed
// ~1280px viewport) captures both layouts deterministically.
const meta: Meta<typeof LegalPage> = {
  title: "Passport/Legal",
  component: LegalPage,
};
export default meta;
type Story = StoryObj<typeof LegalPage>;

// Desktop: the summary sits in a column beside the binding text.
export const Privacy: Story = {
  args: { doc: PRIVACY_POLICY, wide: true },
  decorators: [
    (Story) => (
      <div className="u-w-wide">
        <Story />
      </div>
    ),
  ],
};

export const Terms: Story = {
  args: { doc: TERMS, wide: true },
  decorators: [
    (Story) => (
      <div className="u-w-wide">
        <Story />
      </div>
    ),
  ],
};

// Mobile: a phone-width reading column, summary stacked on top of the binding text.
export const PrivacyMobile: Story = {
  args: { doc: PRIVACY_POLICY, wide: false },
  decorators: [
    (Story) => (
      <div className="u-w-phone">
        <Story />
      </div>
    ),
  ],
};

export const TermsMobile: Story = {
  args: { doc: TERMS, wide: false },
  decorators: [
    (Story) => (
      <div className="u-w-phone">
        <Story />
      </div>
    ),
  ],
};
