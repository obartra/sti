/**
 * Demo seed for shared groups (doc 33): one group the demo owner made, plus a real
 * roster read for it, so the People slot and the group screens have live content in
 * the seeded `@demo` account. No server, no network; these are plain in-memory
 * fixtures the demo controller returns, faithful to the real create + roster shapes.
 */

import type { ResolvedView } from "../../ui/public/PublicResolution.tsx";
import type {
  GroupMemberSecret,
  GroupRecord,
  PendingGroupInvite,
} from "../accountBlob.ts";
import type { RosterMemberView } from "../groupMembershipOps.ts";
import type { PendingRequest } from "../groupJoinOps.ts";
import { todayEpochDay } from "../../core/clock.ts";
import { randomAliasId, randomWriteToken } from "../../crypto/keys.ts";

// A throwaway inbox capability for the demo (no server, so it is never polled).
export function demoInbox() {
  return {
    inboxId: randomAliasId(),
    writeToken: randomWriteToken(),
    key: randomAliasId(),
  };
}

function demoMemberSecret(): GroupMemberSecret {
  return {
    cardId: randomAliasId(),
    memberKey: randomAliasId(),
    lifecycleInbox: demoInbox(),
  };
}

// One invite the seeded admin sent but that is not accepted yet, so the invite-share
// panel shows a "invited, not joined yet" row with a working cancel in the demo.
function demoPendingInvite(): PendingGroupInvite {
  return {
    inviteId: randomAliasId(),
    lifecycleInbox: demoInbox(),
    createdDay: todayEpochDay(),
    label: "Sam",
  };
}

// One waiting join request for a public admin group, so the requests-review panel has
// a contentless "someone asked to join" row to act on in the demo.
function demoJoinRequest(): PendingRequest {
  return { requesterHash: randomAliasId(), pubKey: randomAliasId() };
}

/**
 * A device-local demo store of waiting join requests per public admin group (doc 33,
 * slice 7b): `review` seeds one request on first read so the requests-review panel has
 * content, and `drop` clears a row on approve/reject, faithful to the real path (an
 * approval delivers an invite; a reject hides the request). No server, all in-memory.
 */
export function demoJoinRequestStore(): {
  review: (group: GroupRecord | undefined) => PendingRequest[];
  drop: (groupId: string, requesterHash: string) => void;
} {
  const byGroup = new Map<string, PendingRequest[]>();
  return {
    review: (group) => {
      if (
        group === undefined ||
        !group.isAdmin ||
        group.visibility !== "public"
      ) {
        return [];
      }
      if (!byGroup.has(group.groupId)) {
        byGroup.set(group.groupId, [demoJoinRequest()]);
      }
      return byGroup.get(group.groupId) ?? [];
    },
    drop: (groupId, requesterHash) =>
      byGroup.set(
        groupId,
        (byGroup.get(groupId) ?? []).filter(
          (r) => r.requesterHash !== requesterHash,
        ),
      ),
  };
}

// One seeded group so the People slot and the group screens have real content: an
// admin, public, recurring group the demo owner made, with a few other members so
// the roster shows a calm mix of colors (see demoRoster).
export function demoGroup(): GroupRecord {
  return {
    groupId: randomAliasId(),
    groupWriteToken: randomWriteToken(),
    kg: randomAliasId(),
    myCardId: randomAliasId(),
    myCardWriteToken: randomWriteToken(),
    handle: "thursday_run",
    visibility: "public",
    meetingKind: "recurring",
    isAdmin: true,
    joinPointerId: randomAliasId(),
    joinWriteToken: randomWriteToken(),
    members: [demoMemberSecret(), demoMemberSecret(), demoMemberSecret()],
    pendingInvites: [demoPendingInvite()],
  };
}

// Build a real roster for a seeded group (doc 33): the owner's own row (self +
// admin), then each other member. All but the last read blue (the canned peer
// card); the last is null, so the roster shows the honest gray/absent state too.
export function demoRoster(
  group: GroupRecord,
  peerCard: ResolvedView,
): RosterMemberView[] {
  const others = group.members ?? [];
  const self: RosterMemberView = {
    cardId: group.myCardId,
    card: peerCard,
    isAdmin: true,
    isSelf: true,
  };
  const rest = others.map((m, i): RosterMemberView => {
    const last = i === others.length - 1;
    return {
      cardId: m.cardId,
      card: last
        ? null
        : { ...peerCard, identity: { handle: `member-${i + 1}` } },
      isAdmin: false,
      isSelf: false,
    };
  });
  return [self, ...rest];
}
