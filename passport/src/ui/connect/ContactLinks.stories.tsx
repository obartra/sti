import type { Meta, StoryObj } from "@storybook/react-vite";
import { ContactLinks } from "./ContactLinks.tsx";
import type { ContactRecord } from "../../store/accountBlob.ts";
import { DAY_MS } from "../../core/clock.ts";

// The Links screen's private-link manager (doc 13, doc 16): mint a link for one
// person with a chosen lifetime, and see how long each existing link has left.
// Expiries are stored as absolute instants, so fixtures compute them from "now"
// at render, landing mid-window (6.5 days reads as "Expires in 7 days") to keep
// the day count stable in captures.
const meta: Meta<typeof ContactLinks> = {
  title: "Passport/Links",
  component: ContactLinks,
};
export default meta;
type Story = StoryObj<typeof ContactLinks>;

function contact(
  id: string,
  label: string,
  expiresAt: number | null,
  linked = false,
): ContactRecord {
  const base: ContactRecord = {
    id: id.padEnd(43, "0"),
    label,
    createdDay: 20_000,
    expiresAt,
    alias: {
      id: id.padEnd(43, "0"),
      writeToken: "w",
      key: "k",
      isPublic: false,
    },
  };
  return linked
    ? { ...base, theirStatusAlias: { id: "t".padEnd(43, "0"), key: "k" } }
    : base;
}

const noop = () => undefined;
const noCreate = () => Promise.resolve({ url: "" });

// The create card with the lifetime choice, above links both with and without
// an expiry: the timed row carries its countdown, the durable one stays bare.
export const Default: Story = {
  args: {
    contacts: [
      contact("a", "sam from sat", Date.now() + 6.5 * DAY_MS, true),
      contact("b", "the gym one", null),
    ],
    onCreate: noCreate,
    onRevoke: noop,
    onRename: noop,
    canShowName: true,
  },
};

// No links yet: just the create card.
export const Empty: Story = {
  args: {
    contacts: [],
    onCreate: noCreate,
    onRevoke: noop,
  },
};
