import type { Meta, StoryObj } from "@storybook/react-vite";
import { BadgeCard } from "./badge-card.tsx";

// The badge card is the product's load-bearing surface (the A2 public resolution
// and the C1 home hero render it). These stories pin its meaningful states.
const meta: Meta<typeof BadgeCard> = {
  title: "Passport/Badge card",
  component: BadgeCard,
};
export default meta;

type Story = StoryObj<typeof BadgeCard>;

export const BlueOnHivPrevention: Story = {
  args: { state: "blue", labels: ["hiv"], identity: { handle: "robin" } },
};

export const BlueHivAndCondoms: Story = {
  args: {
    state: "blue",
    labels: ["hiv", "condoms_always"],
    identity: { handle: "kai" },
  },
};

export const CondomsRoute: Story = {
  args: {
    state: "blue",
    labels: ["condoms_always"],
    identity: { handle: "sam" },
  },
};

export const GrayWithIdentity: Story = {
  args: {
    state: "gray",
    labels: ["condoms_always"],
    identity: { handle: "alex" },
  },
};

// Uniform gray-nothing: an unauthorized viewer or a nonexistent alias, identical
// either way (no handle, no avatar, no labels).
export const GrayNothing: Story = {
  args: { state: "gray", identity: null },
};
