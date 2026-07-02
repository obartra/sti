import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { ManagePanel, type ManageOps } from "./ManagePanel.tsx";
import type { AdminLookup } from "./adminApi.ts";

// The A3 management panel (doc 20): look up an opaque id's metadata, or disable an
// account / revoke a link. The stories stub the transport so each state (idle,
// a found record, a not-found id, and a primed two-click confirm) renders without a
// server. Everything shown is metadata only, never content.
const meta: Meta<typeof ManagePanel> = {
  title: "Passport/Admin/ManagePanel",
  component: ManagePanel,
  args: { token: "demo-token", onUnauthorized: () => undefined },
};
export default meta;
type Story = StoryObj<typeof ManagePanel>;

// A found record: the link namespace holds a small ciphertext, the others are empty
// (an id is namespace-specific in practice). Fixed UTC instants stay deterministic.
const FOUND: AdminLookup = {
  alias: {
    exists: true,
    sizeBytes: 2048,
    updatedAt: Date.UTC(2026, 5, 25, 14, 30, 0),
  },
  account: { exists: false, sizeBytes: 0, updatedAt: 0 },
  inbox: { exists: false, sizeBytes: 0, updatedAt: 0 },
};

const EMPTY: AdminLookup = {
  alias: { exists: false, sizeBytes: 0, updatedAt: 0 },
  account: { exists: false, sizeBytes: 0, updatedAt: 0 },
  inbox: { exists: false, sizeBytes: 0, updatedAt: 0 },
};

const opsFor = (record: AdminLookup): ManageOps => ({
  lookup: () => Promise.resolve({ kind: "ok", record }),
  disable: () => Promise.resolve("ok"),
  revoke: () => Promise.resolve("ok"),
});

// Type an id and look it up, so the record (or not-found) state renders.
async function lookUp(canvasElement: HTMLElement) {
  const canvas = within(canvasElement);
  await userEvent.type(canvas.getByLabelText(/record id/i), "a1b2c3d4");
  await userEvent.click(canvas.getByRole("button", { name: /look up/i }));
}

// The starting state: the id field and a prompt, before any lookup.
export const Idle: Story = {
  args: { ops: opsFor(EMPTY) },
};

// A looked-up record: the three metadata cards (present / byte size / last written).
export const FoundRecord: Story = {
  args: { ops: opsFor(FOUND) },
  play: async ({ canvasElement }) => {
    await lookUp(canvasElement);
    await waitFor(() =>
      expect(within(canvasElement).getByText("Present")).toBeInTheDocument(),
    );
  },
};

// A miss: the id resolves to nothing in any namespace.
export const NotFound: Story = {
  args: { ops: opsFor(EMPTY) },
  play: async ({ canvasElement }) => {
    await lookUp(canvasElement);
    await waitFor(() =>
      expect(
        within(canvasElement).getByText(/no record for that id/i),
      ).toBeInTheDocument(),
    );
  },
};

// A destructive action primed: the first click armed "Disable account", so it now
// shows its confirm copy, awaiting the deliberate second click.
export const ConfirmDisable: Story = {
  args: { ops: opsFor(FOUND) },
  play: async ({ canvasElement }) => {
    await lookUp(canvasElement);
    const canvas = within(canvasElement);
    const disable = await canvas.findByRole("button", {
      name: /disable account/i,
    });
    await userEvent.click(disable);
    await waitFor(() =>
      expect(canvas.getByText(/clears the sync backup/i)).toBeInTheDocument(),
    );
  },
};
