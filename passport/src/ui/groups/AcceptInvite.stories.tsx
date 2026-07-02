import type { Meta, StoryObj } from "@storybook/react-vite";
import { AcceptInvite } from "./AcceptInvite.tsx";
import type { GroupInvite } from "../../store/index.ts";

// The accept-invite screen a `/g#g=...` link lands on (doc 33, slice 7b): the group
// handle, the join-time disclosure (event vs recurring), and join / no thanks. A
// logged-out visitor is pointed to make an account first.
const meta: Meta<typeof AcceptInvite> = {
  title: "Passport/Groups/AcceptInvite",
  component: AcceptInvite,
};
export default meta;
type Story = StoryObj<typeof AcceptInvite>;

function invite(handle: string, kind: "event" | "recurring"): GroupInvite {
  return {
    groupId: "g1",
    lifecycleInbox: { inboxId: "i", writeToken: "w", key: "k" },
    handle,
    visibility: "private",
    meetingKind: kind,
  };
}

const actions = {
  onAccept: () => Promise.resolve(),
  onReject: () => Promise.resolve(),
  onJoined: () => undefined,
  onClaim: () => undefined,
  onBack: () => undefined,
};

// A recurring group: the disclosure says everyone currently in it is told to test.
export const Recurring: Story = {
  args: {
    invite: invite("thursday_run", "recurring"),
    isLoggedIn: true,
    ...actions,
  },
};

// A one-time event: the disclosure names whoever was there.
export const Event: Story = {
  args: { invite: invite("party_2026", "event"), isLoggedIn: true, ...actions },
};

// Logged out: make an account before joining.
export const LoggedOut: Story = {
  args: {
    invite: invite("thursday_run", "recurring"),
    isLoggedIn: false,
    ...actions,
  },
};
