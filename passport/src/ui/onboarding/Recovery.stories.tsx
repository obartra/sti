import type { Meta, StoryObj } from "@storybook/react-vite";
import { Recovery } from "./Recovery.tsx";

// B2: recovery phrase. The phrase view (generated, shown once, save-confirmed)
// and the verify-a-word step are separate internal phases of one component.
const meta: Meta<typeof Recovery> = {
  title: "Passport/Onboarding/Recovery phrase",
  component: Recovery,
};
export default meta;
type Story = StoryObj<typeof Recovery>;

// Phrase view: tap to reveal the 12 words, then confirm you've saved them.
export const PhraseView: Story = {};

// Verify step: tap the asked word to prove the phrase is saved.
export const VerifyStep: Story = {
  play: ({ canvasElement }) => {
    const byText = (text: string) =>
      Array.from(
        canvasElement.querySelectorAll<HTMLButtonElement>("button"),
      ).find((b) => b.textContent.includes(text));
    // Reveal the phrase, then advance to the verify step.
    byText("Tap to reveal")?.click();
    byText("I’ve saved it")?.click();
  },
};
