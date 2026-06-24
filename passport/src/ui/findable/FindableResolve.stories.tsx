import type { Meta, StoryObj } from "@storybook/react-vite";
import { FindableResolve } from "./FindableResolve.tsx";

// The resolve→knock handoff (doc 17, F5b). The "looking up" state and the
// not-found state; a successful resolve navigates away, so it isn't a static story.
const meta: Meta<typeof FindableResolve> = {
  title: "Passport/Findable/FindableResolve",
  component: FindableResolve,
  args: { name: "robin", onResolved: () => undefined },
};
export default meta;
type Story = StoryObj<typeof FindableResolve>;

// Mid-lookup: a resolve that never settles holds the "Looking up …" state.
export const Resolving: Story = {
  args: { resolve: () => new Promise<string | null>(() => undefined) },
};

// The name isn't registered (or is unreachable): the uniform not-found state.
export const NotFound: Story = {
  args: { name: "nobody", resolve: () => Promise.resolve(null) },
};
