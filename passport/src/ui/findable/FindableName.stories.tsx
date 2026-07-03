import type { Meta, StoryObj } from "@storybook/react-vite";
import { PublicNames, type FindableOps } from "./FindableName.tsx";

// The public-names manager (doc 17), on the Links tab: the empty state + add flow,
// a held list of up to five names, and the full state at the cap. Ops are stubbed so
// the states render without a server.
const meta: Meta<typeof PublicNames> = {
  title: "Passport/Findable/PublicNames",
  component: PublicNames,
};
export default meta;
type Story = StoryObj<typeof PublicNames>;

const ops: FindableOps = {
  register: () => Promise.resolve("registered"),
  check: () => Promise.resolve("free" as const),
  release: () => Promise.resolve(),
};

// No names yet: the calm empty state + the "Add a public name" action.
export const Empty: Story = {
  args: { names: [], ops },
};

// A couple of names held: each with its public link and a copy/remove control.
export const Held: Story = {
  args: { names: ["robin", "wren"], ops },
};

// One held name is also the sign-in username (doc 32), so it is pinned: its row
// shows the reason instead of a remove control.
export const Pinned: Story = {
  args: { names: ["robin", "wren"], ops, pinnedName: "robin" },
};

// The list is full: the add control is disabled with the "maximum of 5" note.
export const AtCap: Story = {
  args: { names: ["robin", "wren", "sam", "alex", "jules"], ops },
};
