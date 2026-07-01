import type { Meta, StoryObj } from "@storybook/react-vite";
import { Privacy } from "./Privacy.tsx";
import { INITIAL_OWNER_STATE } from "../../core/badge.ts";

// C6 settings: the name editor, the Home default-face preference, card
// attributes, controls, danger zone. The live-links list moved to the Links tab.
const meta: Meta<typeof Privacy> = {
  title: "Passport/Core/Settings",
  component: Privacy,
  // A fresh owner; the card-attribute toggles read from and write to this state.
  args: {
    ownerState: INITIAL_OWNER_STATE,
    setOwnerState: () => undefined,
    // The local display name editor (logged-in only in the app).
    name: "robin",
    onSetName: () => undefined,
    // Pin the retention-notice reference instant so the "kept until" date is stable
    // in the visual baseline (mid-June 2025 -> kept until June 2027).
    now: 1_750_000_000_000,
  },
};
export default meta;

type Story = StoryObj<typeof Privacy>;

export const Default: Story = {};

// Findable (doc 17) wired in: the claim card with its consent disclosure sits
// between the owner cards and the card attributes. The transport is stubbed so it
// renders without a server.
const findableOps = {
  register: () => Promise.resolve("registered" as const),
  check: () => Promise.resolve("free" as const),
  release: () => Promise.resolve(),
};

export const FindableUnclaimed: Story = {
  args: { vanityName: null, findableOps },
};

// The owner already holds a name: the registered view with the release control.
export const FindableClaimed: Story = {
  args: { vanityName: "robin", findableOps },
};
