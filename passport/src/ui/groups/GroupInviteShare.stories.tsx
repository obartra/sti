import type { Meta, StoryObj } from "@storybook/react-vite";
import { GroupInviteShare } from "./GroupInviteShare.tsx";
import type { GroupRecord, PendingGroupInvite } from "../../store/index.ts";

// The admin invite-share panel (doc 33, slice 7b): create a bearer invite link (shown
// in the reused QR + copy card) and manage the invites sent but not yet accepted.
const meta: Meta<typeof GroupInviteShare> = {
  title: "Passport/Groups/InviteShare",
  component: GroupInviteShare,
};
export default meta;
type Story = StoryObj<typeof GroupInviteShare>;

function invite(id: string, label?: string): PendingGroupInvite {
  return {
    inviteId: id,
    lifecycleInbox: { inboxId: "i", writeToken: "w", key: "k" },
    createdDay: 20000,
    ...(label !== undefined ? { label } : {}),
  };
}

function group(pending: PendingGroupInvite[]): GroupRecord {
  return {
    groupId: "g1",
    groupWriteToken: "w",
    kg: "k",
    myCardId: "self",
    myCardWriteToken: "w",
    handle: "thursday_run",
    visibility: "public",
    meetingKind: "recurring",
    isAdmin: true,
    pendingInvites: pending,
  };
}

const args = {
  onCreateInvite: () => Promise.resolve("https://sti.care/g#g=ZGVtby1pbnZpdGU"),
  onRevokeInvite: () => undefined,
};

// One invite already sent (not accepted yet), with a private admin label.
export const WithPending: Story = {
  args: { group: group([invite("i1", "Sam")]), ...args },
};

// No invites out yet: just the create button and the share note.
export const Empty: Story = {
  args: { group: group([]), ...args },
};
