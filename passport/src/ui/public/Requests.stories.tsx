import type { Meta, StoryObj } from "@storybook/react-vite";
import { Requests } from "./Requests.tsx";
import type { ResolvedView } from "./PublicResolution.tsx";

// The viewer's own list of access requests they've made: the way back for a
// logged-out viewer. A ready row resolves to a card; a not-yet row stays a calm
// "nothing yet" (no granted/denied signal).
const meta: Meta<typeof Requests> = {
  title: "Passport/Requests",
  component: Requests,
  args: {
    onOpen: () => undefined,
    onForget: () => undefined,
    onBack: () => undefined,
  },
};
export default meta;
type Story = StoryObj<typeof Requests>;

const SHARED: ResolvedView = {
  state: "blue",
  labels: ["hiv"],
  route: "hiv",
  identity: { handle: "robin" },
};

const ID_A = "A".repeat(43);
const ID_B = "B".repeat(43);

export const Empty: Story = {
  args: { requests: [], resolve: () => Promise.resolve(null) },
};

export const Waiting: Story = {
  args: {
    requests: [{ id: ID_A, at: 0 }],
    resolve: () => Promise.resolve(null),
  },
};

export const Shared: Story = {
  args: {
    requests: [{ id: ID_A, at: 0 }],
    resolve: () => Promise.resolve(SHARED),
  },
};

export const Mixed: Story = {
  args: {
    requests: [
      { id: ID_A, at: 0 },
      { id: ID_B, at: 0 },
    ],
    resolve: (id) => Promise.resolve(id === ID_A ? SHARED : null),
  },
};
