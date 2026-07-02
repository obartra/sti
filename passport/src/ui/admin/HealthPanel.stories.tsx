import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, waitFor, within } from "storybook/test";
import { HealthPanel, type HealthOps } from "./HealthPanel.tsx";
import type { AdminHealth } from "./adminApi.ts";

// The health panel (doc 20): the at-a-glance operational read. A single status chip
// summarizes the box, the tiles break it down (errors, send queue, background-loop
// heartbeat, concurrency). Everything shown is aggregate, never a fact about a person.
const meta: Meta<typeof HealthPanel> = {
  title: "Passport/Admin/HealthPanel",
  component: HealthPanel,
  args: { token: "demo-token", onUnauthorized: () => undefined },
};
export default meta;
type Story = StoryObj<typeof HealthPanel>;

const opsFor = (health: AdminHealth): HealthOps => ({
  get: () => Promise.resolve({ kind: "ok", health }),
});

// The all-clear: nothing logged, an empty queue, a fresh heartbeat -> green chip.
const CLEAR_HEALTH: AdminHealth = {
  errors: [
    { type: "store", count: 0 },
    { type: "enqueue", count: 0 },
    { type: "janitor", count: 0 },
    { type: "decode", count: 0 },
  ],
  sendQueueDepth: 0,
  sendQueueOldestAgeSeconds: 0,
  janitorAgeSeconds: 8,
  inflightCurrent: 0,
  inflightMax: 64,
};

// Needs a look: a couple of logged errors and a small send-queue backlog -> amber chip
// with the per-subsystem breakdown.
const WARN_HEALTH: AdminHealth = {
  errors: [
    { type: "store", count: 2 },
    { type: "enqueue", count: 0 },
    { type: "janitor", count: 0 },
    { type: "decode", count: 1 },
  ],
  sendQueueDepth: 3,
  sendQueueOldestAgeSeconds: 42,
  janitorAgeSeconds: 12,
  inflightCurrent: 1,
  inflightMax: 64,
};

// The all-clear read: the green "All clear" chip and zeroed tiles.
export const Clear: Story = {
  args: { ops: opsFor(CLEAR_HEALTH) },
  play: async ({ canvasElement }) => {
    await waitFor(() =>
      expect(within(canvasElement).getByText("All clear")).toBeInTheDocument(),
    );
  },
};

// The attention read: the amber "Needs a look" chip and the error breakdown.
export const NeedsALook: Story = {
  args: { ops: opsFor(WARN_HEALTH) },
  play: async ({ canvasElement }) => {
    await waitFor(() =>
      expect(
        within(canvasElement).getByText("Needs a look"),
      ).toBeInTheDocument(),
    );
  },
};
