import type { Meta, StoryObj } from "@storybook/react-vite";
import { Claim } from "./Claim.tsx";

// B1: claim account. The create flow builds the owner's main identity (the face
// they can choose to show) and previews the anonymous default link; the login
// variant collapses to the passkey unlock.
const meta: Meta<typeof Claim> = {
  title: "Passport/Onboarding/Claim account",
  component: Claim,
};
export default meta;
type Story = StoryObj<typeof Claim>;

// Default create flow: passkey, identity (name + avatar), default-link preview,
// promise, and the one-tap switch to log in.
export const CreateAccount: Story = {
  args: { isLogin: false, onSwitchMode: () => undefined },
};

const loginArgs = {
  isLogin: true,
  keepSignedIn: true,
  onKeepSignedInChange: () => undefined,
  onRecover: () => undefined,
  onRecoverPassword: () => undefined,
  onSwitchMode: () => undefined,
} satisfies Story["args"];

// Login variant: welcome back, unlock with passkey (the one obvious action), the
// keep-signed-in toggle (doc 24), and the collapsed "other ways to log in"
// disclosure holding the phrase and handle + password paths.
export const LogIn: Story = {
  args: loginArgs,
};

// Login variant with "other ways to log in" expanded: the recovery phrase and the
// handle + password cards revealed behind the disclosure.
export const LogInOtherWays: Story = {
  args: loginArgs,
  play: ({ canvasElement }) => {
    Array.from(canvasElement.querySelectorAll<HTMLButtonElement>("button"))
      .find((b) => b.textContent.includes("Other ways to log in"))
      ?.click();
  },
};
