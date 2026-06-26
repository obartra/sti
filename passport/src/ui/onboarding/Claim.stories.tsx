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

// Default create flow: passkey, identity (name + avatar), default-link preview, promise.
export const CreateAccount: Story = {
  args: { isLogin: false },
};

// Login variant: welcome back, unlock with passkey, plus the keep-signed-in
// toggle (doc 24) so a returning user can opt out on a shared device.
export const LogIn: Story = {
  args: {
    isLogin: true,
    keepSignedIn: true,
    onKeepSignedInChange: () => undefined,
  },
};
