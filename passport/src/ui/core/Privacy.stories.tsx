import type { Meta, StoryObj } from "@storybook/react-vite";
import { Privacy } from "./Privacy.tsx";
import { INITIAL_OWNER_STATE } from "../../core/badge.ts";

// C6 privacy & sharing: alias management (list / create / visibility / revoke),
// knock requests, card attributes, controls, and the danger zone.
const meta: Meta<typeof Privacy> = {
  title: "Passport/Core/Privacy & sharing",
  component: Privacy,
  // A fresh owner; the card-attribute toggles read from and write to this state.
  args: { ownerState: INITIAL_OWNER_STATE, setOwnerState: () => undefined },
};
export default meta;

type Story = StoryObj<typeof Privacy>;

export const Default: Story = {};
