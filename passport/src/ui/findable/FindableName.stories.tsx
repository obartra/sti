import type { Meta, StoryObj } from "@storybook/react-vite";
import { FindableName, type FindableOps } from "./FindableName.tsx";

// Findable owner registration (doc 17, F5): the consent-gated name picker and the
// registered/release state. Ops are stubbed so the states render without a server.
const meta: Meta<typeof FindableName> = {
  title: "Passport/Findable/FindableName",
  component: FindableName,
};
export default meta;
type Story = StoryObj<typeof FindableName>;

const ops: FindableOps = {
  register: () => Promise.resolve("registered"),
  release: () => Promise.resolve(),
};

// The first-time state: the consent disclosure + the name picker.
export const Register: Story = {
  args: { currentName: null, ops },
};

// The state once a name is held: the name + a release control.
export const Registered: Story = {
  args: { currentName: "robin", ops },
};
