import type { Meta, StoryObj } from "@storybook/react-vite";
import { Claim } from "./Claim.tsx";

// B1: claim account. The create flow builds the first alias (opaque + private by
// default, vanity off); the login variant collapses to the passkey unlock.
const meta: Meta<typeof Claim> = {
  title: "Passport/Onboarding/Claim account",
  component: Claim,
};
export default meta;
type Story = StoryObj<typeof Claim>;

// Default create flow: passkey, first alias, avatar builder, visibility, promise.
export const CreateAccount: Story = {
  args: { isLogin: false },
};

// Login variant: welcome back, unlock with passkey only.
export const LogIn: Story = {
  args: { isLogin: true },
};
