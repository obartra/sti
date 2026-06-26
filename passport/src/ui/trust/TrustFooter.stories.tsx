import type { Meta, StoryObj } from "@storybook/react-vite";
import { TrustFooter } from "./TrustFooter.tsx";

// The quiet public-surface footer (doc 22): promises, privacy, terms, plus a
// one-line, voice-compliant tagline.
const meta: Meta<typeof TrustFooter> = {
  title: "Passport/TrustFooter",
  component: TrustFooter,
};
export default meta;
type Story = StoryObj<typeof TrustFooter>;

export const Default: Story = {};
