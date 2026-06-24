import type { Meta, StoryObj } from "@storybook/react-vite";
import { FindableResolve } from "./FindableResolve.tsx";

// The resolve→knock handoff (doc 17, F5b). Only the not-found state is a static
// story: a successful resolve navigates away, and the transient "looking up" state
// needs a never-settling promise that the screenshot harness captures as blank, so
// it's covered by the unit test instead of a visual baseline.
const meta: Meta<typeof FindableResolve> = {
  title: "Passport/Findable/FindableResolve",
  component: FindableResolve,
  args: { name: "robin", onResolved: () => undefined },
};
export default meta;
type Story = StoryObj<typeof FindableResolve>;

// The name isn't registered (or is unreachable): the uniform not-found state.
export const NotFound: Story = {
  args: { name: "nobody", resolve: () => Promise.resolve(null) },
};
