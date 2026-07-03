import type { Meta, StoryObj } from "@storybook/react-vite";
import { ContinuityNudgeCard } from "./ContinuityNudgeCard.tsx";

// The dismissible continuity reminders shown on Home when the rare cadence is due
// (doc 32): a recovery-phrase rehearsal, and a once-a-year password refresh
// suggestion. Both are calm and never block use.
const meta: Meta<typeof ContinuityNudgeCard> = {
  title: "Passport/Core/ContinuityNudgeCard",
  component: ContinuityNudgeCard,
  args: {
    onGoToSettings: () => undefined,
    onDismiss: () => undefined,
  },
  decorators: [
    // width (not just maxWidth): the preview wraps stories in a flex row, so a
    // widthless block here shrink-wraps, and the card's size containment
    // (nudge.css) would then collapse both to nothing.
    (Story) => (
      <div style={{ width: "100%", maxWidth: 420, padding: 16 }}>
        <Story />
      </div>
    ),
  ],
};
export default meta;

type Story = StoryObj<typeof ContinuityNudgeCard>;

// The gentle rehearsal: can you still find your recovery phrase?
export const PhraseRehearsal: Story = {
  args: { kind: "phrase" },
};

// The once-a-year suggestion, shown only when a password is set and a year old.
export const PasswordRefresh: Story = {
  args: { kind: "password" },
};
