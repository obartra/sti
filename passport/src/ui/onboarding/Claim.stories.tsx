import type { Meta, StoryObj } from "@storybook/react-vite";
import { Claim } from "./Claim.tsx";

// B1: claim account. The create flow collects only a name (optional, private);
// the login variant leads with the passkey button.
const meta: Meta<typeof Claim> = {
  title: "Passport/Onboarding/Claim account",
  component: Claim,
};
export default meta;
type Story = StoryObj<typeof Claim>;

// Default create flow: the name field (with a shuffle button), Continue, and the
// one-tap switch to log in.
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

// Login variant: log in with a passkey (the one obvious action), the keep-signed-in
// toggle (doc 24), and the collapsed "other ways to log in" disclosure.
export const LogIn: Story = {
  args: loginArgs,
};

// Login variant with "other ways to log in" expanded: the recovery phrase and the
// handle + password forms revealed behind the disclosure.
export const LogInOtherWays: Story = {
  args: loginArgs,
  play: ({ canvasElement }) => {
    Array.from(canvasElement.querySelectorAll<HTMLButtonElement>("button"))
      .find((b) => b.textContent.includes("Other ways to log in"))
      ?.click();
  },
};
