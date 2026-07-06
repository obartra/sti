import type { Meta, StoryObj } from "@storybook/react-vite";
import { Requests } from "./Requests.tsx";
import type { ResolvedView } from "./PublicResolution.tsx";
import { todayEpochDay } from "../../core/clock.ts";

// Anchor the "asked" days to today so the relative label ("2 days ago") is stable
// across calendar days: with a fixed epoch day the label drifts with the wall clock
// and the screenshot diffs on a boundary. `at` and today move together, so the
// rendered text never changes.
const TODAY = todayEpochDay();

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
    requests: [{ id: ID_A, at: TODAY - 1 }],
    resolve: () => Promise.resolve(null),
  },
};

export const Shared: Story = {
  args: {
    requests: [{ id: ID_A, at: TODAY - 3 }],
    resolve: () => Promise.resolve(SHARED),
  },
};

export const Mixed: Story = {
  args: {
    requests: [
      { id: ID_A, at: TODAY - 2 },
      { id: ID_B, at: TODAY - 5 },
    ],
    resolve: (id) => Promise.resolve(id === ID_A ? SHARED : null),
  },
};
