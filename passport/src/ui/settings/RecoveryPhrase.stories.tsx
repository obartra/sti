import type { Meta, StoryObj } from "@storybook/react-vite";
import { RecoveryPhrase } from "./RecoveryPhrase.tsx";

// A stand-in 43-char app phrase (base64url) so the reveal shows the real shape.
const PHRASE = "abcdefghijklmnopqrstuvwxyz0123456789-_ABCDEF";

const meta: Meta<typeof RecoveryPhrase> = {
  title: "Passport/Settings/RecoveryPhrase",
  component: RecoveryPhrase,
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 420, padding: 16 }}>
        <Story />
      </div>
    ),
  ],
};
export default meta;

type Story = StoryObj<typeof RecoveryPhrase>;

// The phrase is stored, no passkey on this device: the collapsed row, gated behind
// the plain two-step confirm ("Show it") before it reveals.
export const Stored: Story = {
  args: { phrase: PHRASE },
};

// The phrase is stored and a passkey is enrolled on this device: the confirm step
// requires a passkey check ("Confirm it's you") before revealing. The check is
// stubbed to resolve true so the reveal is reachable in the story.
export const PasskeyGated: Story = {
  args: {
    phrase: PHRASE,
    passkeyEnrolled: true,
    onVerifyPasskey: () => Promise.resolve(true),
  },
};

// The phrase is not on this device (a passkey-only resume): the honest fallback.
export const NotStored: Story = {
  args: { phrase: null },
};
