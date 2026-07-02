import { useEffect } from "react";
import { GroupsList } from "../../groups/GroupsList.tsx";
import { GroupCreate } from "../../groups/GroupCreate.tsx";
import { GroupDetail } from "../../groups/GroupDetail.tsx";
import { AcceptInvite } from "../../groups/AcceptInvite.tsx";
import type { ScreenCtx, ScreenRenderers } from "./context.ts";

// The groups list plus the "join a group by name" entry (doc 33), used both on the
// standalone /groups screen and in the People slot. On mount it runs the group
// catch-up so an arrived join / approval shows without waiting for a reconnect. The
// request-to-join section is wired only for a logged-in owner.
export function GroupsSlot({ ctx }: { ctx: ScreenCtx }) {
  const { nav, groups, onRequestToJoin, onGroupCatchup, isLoggedIn } = ctx;
  useEffect(() => {
    void onGroupCatchup();
  }, [onGroupCatchup]);
  return (
    <GroupsList
      groups={groups}
      onCreate={() => nav.go("group-create")}
      onOpenGroup={(id) => nav.go("group-detail", { id })}
      onRequestToJoin={isLoggedIn ? onRequestToJoin : undefined}
    />
  );
}

// The shared-group screens (doc 33): the list, the create form, the roster detail
// with its admin controls (slice 7b), and the accept-invite screen a `/g#g=...` link
// lands on. All read the group model from the session blob and drive the controller
// through the folded owner actions.
export const groupRenderers: ScreenRenderers = {
  groups: (ctx) => <GroupsSlot ctx={ctx} />,
  "group-create": ({ nav, onCreateGroup, onCheckVanityName, ownerHasName }) => (
    <GroupCreate
      onCreate={onCreateGroup}
      onCreated={(id) => nav.go("group-detail", { id })}
      onCheckName={onCheckVanityName}
      hasName={ownerHasName ?? false}
    />
  ),
  "group-detail": (ctx) => {
    const { nav, data, groups } = ctx;
    const group = groups.find((g) => g.groupId === data?.id);
    if (group === undefined) {
      // The group is gone (disbanded, left, or a stale deep link): fall back to the
      // list rather than a dead screen.
      return <GroupsSlot ctx={ctx} />;
    }
    return (
      <GroupDetail
        group={group}
        onReadRoster={ctx.onReadGroupRoster}
        onPollLifecycle={ctx.onGroupCatchup}
        onLeave={() => {
          ctx.onLeaveGroup(group.groupId);
          nav.go("people");
        }}
        onDisband={() => {
          ctx.onDeleteGroup(group.groupId);
          nav.go("people");
        }}
        onCreateInvite={ctx.onInviteToGroup}
        onRevokeInvite={ctx.onRevokeGroupInvite}
        onReviewRequests={ctx.onReviewJoinRequests}
        onApproveRequest={ctx.onApproveJoinRequest}
        onRejectRequest={ctx.onRejectJoinRequest}
        onRemoveMember={ctx.onRemoveGroupMember}
      />
    );
  },
  // A group invite link (doc 33): the router parsed the fragment into data.invite.
  // Join accepts and routes to People; No thanks declines. A logged-out visitor is
  // pointed to make an account first.
  "group-invite": (ctx) => {
    const invite = ctx.data?.invite;
    if (invite === undefined) return <GroupsSlot ctx={ctx} />;
    return (
      <AcceptInvite
        invite={invite}
        isLoggedIn={ctx.isLoggedIn}
        onAccept={ctx.onAcceptGroupInvite}
        onReject={ctx.onRejectGroupInvite}
        onJoined={() => ctx.nav.jump("people")}
        onClaim={() => ctx.nav.go("b1-claim")}
        hasName={ctx.ownerHasName ?? false}
        onBack={ctx.nav.back}
      />
    );
  },
};
