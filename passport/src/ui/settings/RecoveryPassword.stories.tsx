import type { Meta, StoryObj } from "@storybook/react-vite";
import {
  RecoveryPassword,
  type RecoveryPasswordOps,
} from "./RecoveryPassword.tsx";

// A no-server ops for the stories: setting always "succeeds", disabling resolves.
const ops: RecoveryPasswordOps = {
  set: () => Promise.resolve("set"),
  disable: () => Promise.resolve(),
};

const meta: Meta<typeof RecoveryPassword> = {
  title: "Passport/Settings/RecoveryPassword",
  component: RecoveryPassword,
  args: { ops },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 420, padding: 16 }}>
        <Story />
      </div>
    ),
  ],
};
export default meta;

type Story = StoryObj<typeof RecoveryPassword>;

// No password set yet: the setup form (recovery name, password, confirm, phrase).
export const Off: Story = {
  args: { recoveryName: null },
};

// A password is set: the enabled view showing the recovery name, change, turn-off.
export const On: Story = {
  args: { recoveryName: "robin" },
};
