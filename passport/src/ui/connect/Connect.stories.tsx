import type { Meta, StoryObj } from "@storybook/react-vite";
import { Connect } from "./Connect.tsx";
import { GroupsList } from "../groups/GroupsList.tsx";
import type { ContactRecord, GroupRecord } from "../../store/accountBlob.ts";

// People (connections): reached only by scan or shared link. No directory, no
// @-search. A connection IS a contact, shown by your private label and newest
// first; stars are device-local; the full contact list is secondary and collapses
// via "Show more". Nothing here surfaces a clinical badge or status. Order: scan
// tile, starred, groups (threaded in via groupsSlot on the People tab), then the
// full contact list. The privacy card renders last, on the People tab itself.
const meta: Meta<typeof Connect> = {
  title: "Passport/People",
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
    expiresAt: null,
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
    onSetEncounterDay: noop,
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
    onSetEncounterDay: noop,
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
    onSetEncounterDay: noop,
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
    onSetEncounterDay: noop,
  },
};

function group(
  groupId: string,
  handle: string,
  extra: Partial<GroupRecord>,
): GroupRecord {
  return {
    groupId,
    groupWriteToken: "w",
    kg: "k",
    myCardId: `${groupId}-card`,
    myCardWriteToken: "w",
    handle,
    visibility: "public",
    meetingKind: "recurring",
    isAdmin: true,
    ...extra,
  };
}

const groups: GroupRecord[] = [
  group("g1", "thursday_run", {
    members: [
      {
        cardId: "m1",
        memberKey: "k",
        lifecycleInbox: { inboxId: "i", writeToken: "w", key: "k" },
      },
      {
        cardId: "m2",
        memberKey: "k",
        lifecycleInbox: { inboxId: "i", writeToken: "w", key: "k" },
      },
    ],
  }),
  group("g2", "fern_house", { visibility: "private", meetingKind: "event" }),
];

// The People-tab composition: groups thread in between starred and the full
// contact list, so starred + groups read as the prominent surfaces. (On the tab
// the privacy card also renders below this; here we show the threaded column.)
export const WithGroups: Story = {
  args: {
    contacts,
    nowDay: NOW,
    faves: new Set(["a".padEnd(43, "0"), "c".padEnd(43, "0")]),
    onToggleFave: noop,
    onRemoveContact: noop,
    onSetEncounterDay: noop,
    groupsSlot: <GroupsList groups={groups} />,
  },
};
