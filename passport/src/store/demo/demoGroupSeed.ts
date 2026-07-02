/**
 * Demo seed for shared groups (doc 33): one group the demo owner made, plus a real
 * roster read for it, so the People slot and the group screens have live content in
 * the seeded `@demo` account. No server, no network; these are plain in-memory
 * fixtures the demo controller returns, faithful to the real create + roster shapes.
 */

import type { ResolvedView } from "../../ui/public/PublicResolution.tsx";
import type { GroupMemberSecret, GroupRecord } from "../accountBlob.ts";
import type { RosterMemberView } from "../groupMembershipOps.ts";
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
