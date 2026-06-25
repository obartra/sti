import type { Meta, StoryObj } from "@storybook/react-vite";
import { Privacy } from "./Privacy.tsx";
import { INITIAL_OWNER_STATE } from "../../core/badge.ts";

const ID = (c: string) => c.repeat(43);
const sampleAlias = (seed: string, isPublic: boolean) => ({
  id: ID(seed),
  writeToken: ID("W"),
  key: ID("K"),
  isPublic,
});

// C6 privacy & sharing: the unified live-links list (public/casual aliases +
// per-contact links, each revocable), card attributes, controls, danger zone.
const meta: Meta<typeof Privacy> = {
  title: "Passport/Core/Privacy & sharing",
  component: Privacy,
  // A fresh owner; the card-attribute toggles read from and write to this state.
  args: {
    ownerState: INITIAL_OWNER_STATE,
    setOwnerState: () => undefined,
    aliases: [sampleAlias("A", true), sampleAlias("B", false)],
    contacts: [
      {
        id: ID("C"),
        label: "Sam",
        createdDay: 19_000,
        expiresAt: 19_007,
        alias: sampleAlias("D", false),
      },
    ],
  },
};
export default meta;

type Story = StoryObj<typeof Privacy>;

export const Default: Story = {};

// No links shared yet: the empty state.
export const NoLinks: Story = { args: { aliases: [], contacts: [] } };

// Findable (doc 17) wired in: the claim card with its consent disclosure sits
// between the live links and the card attributes. The transport is stubbed so it
// renders without a server.
const findableOps = {
  register: () => Promise.resolve("registered" as const),
  release: () => Promise.resolve(),
};

export const FindableUnclaimed: Story = {
  args: { vanityName: null, findableOps },
};

// The owner already holds a name: the registered view with the release control.
export const FindableClaimed: Story = {
  args: { vanityName: "robin", findableOps },
};
