import type { Meta, StoryObj } from "@storybook/react-vite";
import { CircleCreate } from "./CircleCreate.tsx";
import type { ContactRecord } from "../../store/accountBlob.ts";

// Create a circle: name it and pick from your existing contacts. The primary CTA
// is disabled until a name is entered. With no contacts, a prompt to link first.
const meta: Meta<typeof CircleCreate> = {
  title: "Passport/Circles/Create",
  component: CircleCreate,
};
export default meta;
type Story = StoryObj<typeof CircleCreate>;

function contact(id: string, label: string): ContactRecord {
  return {
    id,
    label,
    createdDay: 1,
    expiresAt: null,
    alias: { id, writeToken: "w", key: "k", isPublic: false },
  };
}

const contacts: ContactRecord[] = [
  contact("a", "sam"),
  contact("b", "ari"),
  contact("c", "leo"),
  contact("d", "kit"),
];

// Default: the form with a few contacts to pick from.
export const Default: Story = { args: { contacts } };

// No contacts yet: a prompt to link with people first.
export const NoContacts: Story = { args: { contacts: [] } };
