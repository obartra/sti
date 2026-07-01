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
// one-tap switch to log in. The optional "add a username and password" affordance
// (doc 32) sits collapsed below the name, so the passkey/phrase default stays clean.
export const CreateAccount: Story = {
  args: {
    isLogin: false,
    onClaim: () => Promise.resolve({ created: true }),
    onSwitchMode: () => undefined,
  },
};

// Create flow with the optional password (doc 32) expanded: a Username (the public
// handle) and a password with the live strength gate, revealed behind the disclosure.
export const CreateAccountWithPassword: Story = {
  args: {
    isLogin: false,
    onClaim: () => Promise.resolve({ created: true }),
    onSwitchMode: () => undefined,
  },
  play: ({ canvasElement }) => {
    Array.from(canvasElement.querySelectorAll<HTMLButtonElement>("button"))
      .find((b) => b.textContent.includes("Add a username and password"))
      ?.click();
  },
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
