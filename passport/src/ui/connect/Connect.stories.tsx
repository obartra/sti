import type { Meta, StoryObj } from "@storybook/react-vite";
import { Connect } from "./Connect.tsx";
import type { ContactRecord } from "../../store/accountBlob.ts";

// Connect: your linkups (contacts), reached only by scan or shared link. No
// directory, no @-search. A linkup IS a contact, shown by your private label and
// newest first; faves are a device-local star; recent paginates via "Show more".
// Nothing here surfaces a clinical badge or status.
const meta: Meta<typeof Connect> = {
  title: "Passport/Connect",
  component: Connect,
};
export default meta;
type Story = StoryObj<typeof Connect>;

const NOW = 200;

function contact(id: string, label: string, daysAgo: number): ContactRecord {
  return {
    id: id.padEnd(43, "0"),
    label,
    createdDay: NOW - daysAgo,
    expiresDay: null,
    alias: {
      id: id.padEnd(43, "0"),
      writeToken: "w",
      key: "k",
      isPublic: false,
    },
  };
}

const contacts: ContactRecord[] = [
  contact("a", "the gym one", 0),
  contact("b", "sam from sat", 1),
  contact("c", "blue shirt", 3),
  contact("d", "rooftop", 6),
  contact("e", "kai", 10),
  contact("f", "the dj", 18),
  contact("g", "march", 40),
  contact("h", "festival", 80),
];

const noop = () => undefined;

// Default: a full list (paginates) with two faves starred.
export const Default: Story = {
  args: {
    contacts,
    nowDay: NOW,
    faves: new Set(["a".padEnd(43, "0"), "c".padEnd(43, "0")]),
    onToggleFave: noop,
    onRemoveContact: noop,
  },
};

// No faves: the faves card shows its empty prompt.
export const NoFaves: Story = {
  args: {
    contacts,
    nowDay: NOW,
    faves: new Set<string>(),
    onToggleFave: noop,
    onRemoveContact: noop,
  },
};

// Empty: no linkups yet and nothing starred.
export const Empty: Story = {
  args: {
    contacts: [],
    nowDay: NOW,
    faves: new Set<string>(),
    onToggleFave: noop,
    onRemoveContact: noop,
  },
};

// Short list: fewer than the page size, so no "Show more" control appears.
export const FewLinkups: Story = {
  args: {
    contacts: contacts.slice(0, 2),
    nowDay: NOW,
    faves: new Set<string>(),
    onToggleFave: noop,
    onRemoveContact: noop,
  },
};
