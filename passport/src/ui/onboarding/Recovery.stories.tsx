import type { Meta, StoryObj } from "@storybook/react-vite";
import { Recovery } from "./Recovery.tsx";

// B2: recovery phrase. The app-generated recovery token, shown once behind a
// tap-to-reveal, with copy and an "I've saved it" confirm.
const meta: Meta<typeof Recovery> = {
  title: "Passport/Onboarding/Recovery phrase",
  component: Recovery,
  // A fixed sample token (43-char base64url shape), never a real one.
  args: { phrase: "Ck9mq2Xb7wYt0Zr8Lv3Np6Aq1Ds4Gh5Jk8Mn2Pr7Tw0" },
};
export default meta;
type Story = StoryObj<typeof Recovery>;

// Covered (blurred) until the owner taps to reveal.
export const PhraseHidden: Story = {};

// Revealed: the token is shown with copy/hide controls and the save confirm.
export const PhraseRevealed: Story = {
  play: ({ canvasElement }) => {
    Array.from(canvasElement.querySelectorAll<HTMLButtonElement>("button"))
      .find((b) => b.textContent.includes("Tap to reveal"))
      ?.click();
  },
};
