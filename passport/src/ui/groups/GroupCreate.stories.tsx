import type { Meta, StoryObj } from "@storybook/react-vite";
import { GroupCreate } from "./GroupCreate.tsx";

// Create a group (doc 33): a name with live availability, a who-can-join choice, a
// how-often choice, and the join-time disclosure. The disclosure line switches with
// the meeting kind. The primary CTA is disabled until a valid, free name is entered.
const meta: Meta<typeof GroupCreate> = {
  title: "Passport/Groups/Create",
  component: GroupCreate,
};
export default meta;
type Story = StoryObj<typeof GroupCreate>;

// Default: a free-name form. onCreate reports a claimed public group; onCheckName
// answers "free" so a typed name reads available.
export const Default: Story = {
  args: {
    onCreate: (input) =>
      Promise.resolve({ result: "registered", groupId: input.handle }),
    onCreated: () => undefined,
    onCheckName: () => Promise.resolve("free"),
  },
};

// A taken public name: onCheckName answers "taken", so the field flags it and the
// CTA stays disabled.
export const NameTaken: Story = {
  args: {
    onCreate: () => Promise.resolve({ result: "unavailable", groupId: "" }),
    onCreated: () => undefined,
    onCheckName: () => Promise.resolve("taken"),
  },
};
