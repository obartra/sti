// @vitest-environment node
import { describe, it, expect } from "vitest";
import {
  inviteToGroup,
  revokeGroupInvite,
  acceptGroupInvite,
  rejectGroupInvite,
  removeGroupMember,
  readGroupRoster,
  groupNotifyTargets,
  GroupInviteSpentError,
} from "./groupMembershipOps.ts";
import { notifyPositive, pollPartnerNudge } from "./notifyOps.ts";
import { parsePartnerPing } from "./partnerNotify.ts";
import { pollGroupLifecycle } from "./groupIngestOps.ts";
import {
  requestToJoin,
  reviewJoinRequests,
  approveJoinRequest,
  rejectJoinRequest,
  redeemJoinRequests,
  leaveGroup,
  deleteGroup,
  type JoinRequesterDeps,
} from "./groupJoinOps.ts";
import { createGroup } from "./groupOps.ts";
import { pseudonymFor } from "../lib/avatars.ts";
import {
  parseGroupInvite,
  encodeLifecycleLeave,
  type GroupInvite,
} from "./groupInvite.ts";
import { writePing, pollInbox } from "./notifyInbox.ts";
import { createAccountManager, type AccountManager } from "./account.ts";
import { createGrantKeyStore } from "./grantKeyStore.ts";
import { createGroupJoinStore } from "./groupJoinStore.ts";
import type { StorageLike } from "../auth/deviceStore.ts";
import {
  serializeGroupBlob,
  parseGroupBlobForMember,
  parseGroupBlobWithKg,
  GROUP_MEMBER_CAP,
} from "./groupObject.ts";
import { openGroupCard, wrapGroupKey, type GroupKey } from "./groupCrypto.ts";
import type {
  ContactRecord,
  GroupMemberSecret,
  GroupRecord,
  PendingGroupInvite,
} from "./accountBlob.ts";
import type {
  ApiClient,
  PendingKnock,
  VanityRegisterResult,
} from "../api/client.ts";
import type { OwnerSession } from "./session.ts";
import { ALIAS_PAYLOAD_SIZE, GROUP_BLOB_SIZE } from "../api/contract.ts";
import {
  base64urlToBytes,
  bytesToBase64url,
  deriveGroupMemberKey,
  deriveGroupNotify,
  randomAliasId,
  randomWriteToken,
  type Bytes,
} from "../crypto/index.ts";

// Throw-on-nullish so the tests can read narrowed values without a `!` assertion
// (which the lint config forbids) and without optional chains (which push the test
// arrow over the complexity ceiling).
function must<T>(v: T | null | undefined, label: string): T {
  if (v === null || v === undefined) throw new Error(`expected ${label}`);
  return v;
}

// A stateful in-memory server: alias / inbox / group-blob / account stores over Maps,
// each read returning a random decoy on a miss (existence-uniform, like the real
// server). It also carries the knock + vanity-name state the request path (slice 4b)
// needs: knock records a pending entry per id, knockReview returns them, and
// register/resolveVanityName maps a handle to its join pointer. `aliasTokens` records
// the write token each alias PUT bound, so the join-pointer token bind is assertable.
// Two account managers over the same api sit at distinct key-derived account ids, so
// the admin and the requester/invitee are genuinely separate accounts.
function fakeServer(): {
  api: ApiClient;
  groups: Map<string, Bytes>;
  aliasTokens: Map<string, string>;
  releases: { name: string; writeToken: string }[];
} {
  const aliases = new Map<string, Bytes>();
  const aliasTokens = new Map<string, string>();
  const inboxes = new Map<string, Bytes>();
  const groups = new Map<string, Bytes>();
  const accounts = new Map<string, Bytes>();
  const knocks = new Map<string, PendingKnock[]>();
  const vanity = new Map<string, string>();
  // Every vanity-name release, so a disband's handle teardown is assertable.
  const releases: { name: string; writeToken: string }[] = [];
  const unused = () => {
    throw new Error("not used in this test");
  };
  const decoy = (n: number) => crypto.getRandomValues(new Uint8Array(n));
  const api: ApiClient = {
    getAlias: (id) =>
      Promise.resolve(aliases.get(id) ?? decoy(ALIAS_PAYLOAD_SIZE)),
    putAlias: (id, payload, writeToken) => {
      aliases.set(id, payload);
      aliasTokens.set(id, writeToken);
      return Promise.resolve();
    },
    getInbox: (id) =>
      Promise.resolve(inboxes.get(id) ?? decoy(ALIAS_PAYLOAD_SIZE)),
    putInbox: (id, payload) => {
      inboxes.set(id, payload);
      return Promise.resolve();
    },
    getGroupBlob: (id) =>
      Promise.resolve(groups.get(id) ?? decoy(GROUP_BLOB_SIZE)),
    putGroupBlob: (id, blob) => {
      groups.set(id, blob);
      return Promise.resolve();
    },
    deleteGroupBlob: (id) => {
      groups.delete(id);
      return Promise.resolve();
    },
    getAccount: (id) => {
      const blob = accounts.get(id);
      return Promise.resolve(blob ? { blob, version: "1" } : null);
    },
    putAccount: (id, body) => {
      accounts.set(id, body);
      return Promise.resolve({ version: "1" });
    },
    deleteAccount: (id) => {
      accounts.delete(id);
      return Promise.resolve();
    },
    notify: unused,
    republish: unused,
    knock: (id, hash, pubKey) => {
      const list = knocks.get(id) ?? [];
      list.push(
        pubKey ? { requesterHash: hash, pubKey } : { requesterHash: hash },
      );
      knocks.set(id, list);
      return Promise.resolve();
    },
    knockCount: unused,
    knockReview: (id) =>
      Promise.resolve({
        count: (knocks.get(id) ?? []).length,
        pending: knocks.get(id) ?? [],
      }),
    registerPush: unused,
    getVapidPublicKey: unused,
    registerVanityName: (name, aliasId): Promise<VanityRegisterResult> => {
      vanity.set(name, aliasId);
      return Promise.resolve("registered");
    },
    releaseVanityName: (name, writeToken) => {
      releases.push({ name, writeToken });
      vanity.delete(name);
      return Promise.resolve();
    },
    resolveVanityName: (name) => Promise.resolve(vanity.get(name) ?? null),
    reportVanityName: unused,
    submitFeedback: unused,
    getRecoveryEnvelope: unused,
    putRecoveryEnvelope: unused,
    deleteRecoveryEnvelope: unused,
    health: unused,
  };
  return { api, groups, aliasTokens, releases };
}

// An in-memory StorageLike for the device-local requester stores.
function memoryStorage(): StorageLike {
  const map = new Map<string, string>();
  return {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => void map.set(k, v),
    removeItem: (k) => void map.delete(k),
  };
}

// One requester device's local capabilities (a fresh requester secret + grant key
// store + join store), the same primitives the viewer knock path uses.
function requesterDeps(): JoinRequesterDeps {
  return {
    requesterSecret: bytesToBase64url(
      crypto.getRandomValues(new Uint8Array(32)),
    ),
    grantKeys: createGrantKeyStore(memoryStorage()),
    joinStore: createGroupJoinStore(memoryStorage()),
  };
}

// Create a PUBLIC admin group and return the admin's manager, session, groupId, and
// the join pointer its handle resolves to.
async function adminWithPublicGroup(api: ApiClient): Promise<{
  accounts: AccountManager;
  session: OwnerSession;
  groupId: string;
  joinPointerId: string;
}> {
  const { accounts, session } = await freshSession(api, "robin");
  const created = await createGroup(api, accounts, session, {
    handle: "book_club",
    visibility: "public",
    meetingKind: "recurring",
  });
  const group = groupOf(created.session, created.groupId);
  return {
    accounts,
    session: created.session,
    groupId: created.groupId,
    joinPointerId: must(group.joinPointerId, "joinPointerId"),
  };
}

async function freshSession(
  api: ApiClient,
  handle: string,
): Promise<{ accounts: AccountManager; session: OwnerSession }> {
  const accounts = createAccountManager(api);
  const created = await accounts.create(handle);
  return { accounts, session: { root: created.root, blob: created.blob } };
}

// Create a private admin group and return the admin's manager, session, and groupId.
async function adminWithGroup(api: ApiClient): Promise<{
  accounts: AccountManager;
  session: OwnerSession;
  groupId: string;
}> {
  const { accounts, session } = await freshSession(api, "robin");
  const created = await createGroup(api, accounts, session, {
    handle: "book_club",
    visibility: "private",
    meetingKind: "event",
  });
  return { accounts, session: created.session, groupId: created.groupId };
}

function groupOf(session: OwnerSession, groupId: string): GroupRecord {
  return must(
    session.blob.groups?.find((g) => g.groupId === groupId),
    "group record",
  );
}

function membersOf(
  session: OwnerSession,
  groupId: string,
): GroupMemberSecret[] {
  return groupOf(session, groupId).members ?? [];
}

function pendingOf(
  session: OwnerSession,
  groupId: string,
): PendingGroupInvite[] {
  return groupOf(session, groupId).pendingInvites ?? [];
}

function inviteFrom(url: string): GroupInvite {
  const u = new URL(url);
  return must(parseGroupInvite(u.pathname, u.hash), "parsed invite");
}

// The Kg an admin group holds, as a GroupKey.
function kgOf(session: OwnerSession, groupId: string): GroupKey {
  return base64urlToBytes(must(groupOf(session, groupId).kg, "kg")) as GroupKey;
}

describe("group membership lifecycle (doc 33, slice 4a)", () => {
  it("invite -> accept -> ingest adds a slot + roster entry -> the member reads the roster", async () => {
    const server = fakeServer();
    const admin = await adminWithGroup(server.api);

    // INVITE: a pending invite is recorded and a link is produced (no server call).
    const invited = await inviteToGroup(admin.accounts, admin.session, {
      groupId: admin.groupId,
      label: "Sam",
    });
    expect(pendingOf(invited.session, admin.groupId)).toHaveLength(1);
    const invite = inviteFrom(invited.url);

    // ACCEPT (a separate account): writes the accept to the lifecycle inbox and
    // records a member-side group with no write token and no Kg yet.
    const invitee = await freshSession(server.api, "sam");
    const accepted = await acceptGroupInvite(
      server.api,
      invitee.accounts,
      invitee.session,
      { invite },
    );
    const memberGroup = groupOf(accepted, admin.groupId);
    expect(memberGroup.isAdmin).toBe(false);
    expect(memberGroup.groupWriteToken).toBeUndefined();
    expect(memberGroup.kg).toBeUndefined();

    // ADMIN INGEST: fills a slot and grows the roster; promotes the invite to member.
    const ingested = await pollGroupLifecycle(
      server.api,
      admin.accounts,
      invited.session,
    );
    expect(pendingOf(ingested, admin.groupId)).toHaveLength(0);
    expect(membersOf(ingested, admin.groupId)).toHaveLength(1);
    // The blob roster now has both the admin and the new member.
    const obj = await parseGroupBlobWithKg(
      must(server.groups.get(admin.groupId), "blob"),
      kgOf(ingested, admin.groupId),
    );
    expect(must(obj, "obj").roster).toHaveLength(2);

    // MEMBER ROSTER READ: trial-unwraps Kg, publishes its own card, opens both cards.
    const view = await readGroupRoster(
      server.api,
      invitee.accounts,
      accepted,
      admin.groupId,
    );
    expect(view.obj).not.toBeNull();
    expect(view.members).toHaveLength(2);
    // Kg is now cached on the member's record.
    expect(groupOf(view.session, admin.groupId).kg).toBeDefined();
    // The other member's card (the admin) opens under Kg to a real view.
    const other = must(
      view.members.find((m) => !m.isSelf),
      "the admin roster row",
    );
    expect(other.card).not.toBeNull();
    expect(other.isAdmin).toBe(true);
    // The member's own freshly published card opens too.
    expect(
      must(
        view.members.find((m) => m.isSelf),
        "self row",
      ).card,
    ).not.toBeNull();
  });

  it("show-as-you: a member who joins as main shows their name on their card", async () => {
    const server = fakeServer();
    const admin = await adminWithGroup(server.api);
    const invited = await inviteToGroup(admin.accounts, admin.session, {
      groupId: admin.groupId,
      label: "Sam",
    });
    const invite = inviteFrom(invited.url);

    // ACCEPT as main: the chosen face is snapshotted onto the member record now,
    // before any card is published (that waits for the first roster read + Kg).
    const invitee = await freshSession(server.api, "sam");
    const accepted = await acceptGroupInvite(
      server.api,
      invitee.accounts,
      invitee.session,
      { invite, identity: "main" },
    );
    const memberGroup = groupOf(accepted, admin.groupId);
    expect(memberGroup.myHandle).toBe(invitee.session.blob.handle);
    expect(memberGroup.myAvatar).toEqual(invitee.session.blob.avatar);

    await pollGroupLifecycle(server.api, admin.accounts, invited.session);
    // The first roster read publishes the member's own card under Kg; it must open
    // to their account name, not the id-derived pseudonym.
    const view = await readGroupRoster(
      server.api,
      invitee.accounts,
      accepted,
      admin.groupId,
    );
    const self = must(
      view.members.find((m) => m.isSelf),
      "self row",
    );
    expect(must(self.card, "self card").identity.handle).toBe("sam");
  });

  it("show-as-you: an anonymous joiner keeps the id-derived pseudonym on their card", async () => {
    const server = fakeServer();
    const admin = await adminWithGroup(server.api);
    const invited = await inviteToGroup(admin.accounts, admin.session, {
      groupId: admin.groupId,
      label: "Sam",
    });
    const invite = inviteFrom(invited.url);

    const invitee = await freshSession(server.api, "sam");
    // No identity arg: the default is anonymous, so nothing is snapshotted.
    const accepted = await acceptGroupInvite(
      server.api,
      invitee.accounts,
      invitee.session,
      { invite },
    );
    const memberGroup = groupOf(accepted, admin.groupId);
    expect(memberGroup.myHandle).toBeUndefined();
    expect(memberGroup.myAvatar).toBeUndefined();

    await pollGroupLifecycle(server.api, admin.accounts, invited.session);
    const view = await readGroupRoster(
      server.api,
      invitee.accounts,
      accepted,
      admin.groupId,
    );
    const self = must(
      view.members.find((m) => m.isSelf),
      "self row",
    );
    // The card's face is the pseudonym derived from the opaque card id, never "sam".
    expect(must(self.card, "self card").identity.handle).toBe(
      pseudonymFor(memberGroup.myCardId),
    );
  });

  it("show-as-you: a key rotation keeps a revealed admin's face (does not revert to anonymous)", async () => {
    const server = fakeServer();
    // An admin who created the group showing their name.
    const { accounts, session } = await freshSession(server.api, "robin");
    const created = await createGroup(server.api, accounts, session, {
      handle: "book_club",
      visibility: "private",
      meetingKind: "event",
      identity: "main",
    });
    const admin = {
      accounts,
      session: created.session,
      groupId: created.groupId,
    };

    // Bring in a member, then remove them: removal rotates Kg and republishes the
    // admin's own card under the new key.
    const invited = await inviteToGroup(admin.accounts, admin.session, {
      groupId: admin.groupId,
    });
    const invite = inviteFrom(invited.url);
    const invitee = await freshSession(server.api, "sam");
    await acceptGroupInvite(server.api, invitee.accounts, invitee.session, {
      invite,
    });
    const ingested = await pollGroupLifecycle(
      server.api,
      admin.accounts,
      invited.session,
    );
    const memberCardId = must(
      membersOf(ingested, admin.groupId)[0],
      "the member",
    ).cardId;
    const removed = await removeGroupMember(
      server.api,
      admin.accounts,
      ingested,
      { groupId: admin.groupId, cardId: memberCardId },
    );

    // The admin's card, opened under the ROTATED key, still shows their name.
    const adminGroup = groupOf(removed, admin.groupId);
    const rotatedCard = await openGroupCard(
      kgOf(removed, admin.groupId),
      await server.api.getAlias(adminGroup.myCardId),
    );
    expect(must(rotatedCard, "rotated admin card").identity.handle).toBe(
      "robin",
    );
  });

  it("revoke kills a pending accept: a later poll does not add the member", async () => {
    const server = fakeServer();
    const admin = await adminWithGroup(server.api);
    const invited = await inviteToGroup(admin.accounts, admin.session, {
      groupId: admin.groupId,
    });
    const invite = inviteFrom(invited.url);
    const pending = must(
      pendingOf(invited.session, admin.groupId)[0],
      "invite",
    );

    // The invitee accepts (writes to the inbox)...
    const invitee = await freshSession(server.api, "sam");
    await acceptGroupInvite(server.api, invitee.accounts, invitee.session, {
      invite,
    });
    // ...but the admin revokes before ingesting: the inbox is overwritten and the
    // pending invite dropped.
    const revoked = await revokeGroupInvite(
      server.api,
      admin.accounts,
      invited.session,
      { groupId: admin.groupId, inviteId: pending.inviteId },
    );
    expect(pendingOf(revoked, admin.groupId)).toHaveLength(0);

    // A poll now ingests nothing: no member is added.
    const polled = await pollGroupLifecycle(
      server.api,
      admin.accounts,
      revoked,
    );
    expect(membersOf(polled, admin.groupId)).toHaveLength(0);
  });

  it("a forwarded link admits one person: the second accept is refused, the first still lands", async () => {
    const server = fakeServer();
    const admin = await adminWithGroup(server.api);
    const invited = await inviteToGroup(admin.accounts, admin.session, {
      groupId: admin.groupId,
    });
    const invite = inviteFrom(invited.url);

    // The first opener accepts; the link is now spent.
    const first = await freshSession(server.api, "sam");
    const firstAccepted = await acceptGroupInvite(
      server.api,
      first.accounts,
      first.session,
      { invite },
    );

    // A second person the link was forwarded to is refused (never overwrites) and
    // records nothing locally.
    const second = await freshSession(server.api, "kim");
    await expect(
      acceptGroupInvite(server.api, second.accounts, second.session, {
        invite,
      }),
    ).rejects.toBeInstanceOf(GroupInviteSpentError);
    expect(second.session.blob.groups ?? []).toHaveLength(0);

    // The admin's ingest still lands the FIRST accept: sam becomes the member.
    const ingested = await pollGroupLifecycle(
      server.api,
      admin.accounts,
      invited.session,
    );
    const member = must(membersOf(ingested, admin.groupId)[0], "member");
    expect(member.cardId).toBe(groupOf(firstAccepted, admin.groupId).myCardId);
  });

  it("a person's own accept does not spend the link for them: a retry still lands", async () => {
    const server = fakeServer();
    const admin = await adminWithGroup(server.api);
    const invited = await inviteToGroup(admin.accounts, admin.session, {
      groupId: admin.groupId,
    });
    const invite = inviteFrom(invited.url);

    // First attempt wrote the accept; retry from a session that never saw the local
    // record (the write landed but the record did not) must not read as "spent".
    const invitee = await freshSession(server.api, "sam");
    await acceptGroupInvite(server.api, invitee.accounts, invitee.session, {
      invite,
    });
    const retried = await acceptGroupInvite(
      server.api,
      invitee.accounts,
      invitee.session,
      { invite },
    );
    expect(groupOf(retried, admin.groupId).isAdmin).toBe(false);

    // And a session that already holds the group record short-circuits unchanged.
    const again = await acceptGroupInvite(
      server.api,
      invitee.accounts,
      retried,
      { invite },
    );
    expect(again).toBe(retried);

    // The admin ingests the accept and sam is in.
    const ingested = await pollGroupLifecycle(
      server.api,
      admin.accounts,
      invited.session,
    );
    expect(membersOf(ingested, admin.groupId)).toHaveLength(1);
  });

  it("a decline through a spent link is a no-op: the waiting accept is not clobbered", async () => {
    const server = fakeServer();
    const admin = await adminWithGroup(server.api);
    const invited = await inviteToGroup(admin.accounts, admin.session, {
      groupId: admin.groupId,
    });
    const invite = inviteFrom(invited.url);

    // sam accepts; then kim, holding the forwarded link, declines.
    const first = await freshSession(server.api, "sam");
    await acceptGroupInvite(server.api, first.accounts, first.session, {
      invite,
    });
    const second = await freshSession(server.api, "kim");
    await rejectGroupInvite(server.api, second.session, invite);

    // The decline did not overwrite the accept: the admin still ingests sam.
    const ingested = await pollGroupLifecycle(
      server.api,
      admin.accounts,
      invited.session,
    );
    expect(membersOf(ingested, admin.groupId)).toHaveLength(1);
  });

  it("remove drops the member's slot + roster entry", async () => {
    const server = fakeServer();
    const admin = await adminWithGroup(server.api);
    const invited = await inviteToGroup(admin.accounts, admin.session, {
      groupId: admin.groupId,
    });
    const invite = inviteFrom(invited.url);
    const invitee = await freshSession(server.api, "sam");
    await acceptGroupInvite(server.api, invitee.accounts, invitee.session, {
      invite,
    });
    const ingested = await pollGroupLifecycle(
      server.api,
      admin.accounts,
      invited.session,
    );
    const memberCardId = must(
      membersOf(ingested, admin.groupId)[0],
      "member",
    ).cardId;

    const removed = await removeGroupMember(
      server.api,
      admin.accounts,
      ingested,
      {
        groupId: admin.groupId,
        cardId: memberCardId,
      },
    );
    expect(membersOf(removed, admin.groupId)).toHaveLength(0);
    // The blob roster is back to just the admin.
    const obj = await parseGroupBlobWithKg(
      must(server.groups.get(admin.groupId), "blob"),
      kgOf(removed, admin.groupId),
    );
    expect(must(obj, "obj").roster).toHaveLength(1);
  });

  it("a full group leaves the accept pending (fail clean, no drop)", async () => {
    const server = fakeServer();
    const admin = await adminWithGroup(server.api);
    const invited = await inviteToGroup(admin.accounts, admin.session, {
      groupId: admin.groupId,
    });
    const invite = inviteFrom(invited.url);
    const invitee = await freshSession(server.api, "sam");
    await acceptGroupInvite(server.api, invitee.accounts, invitee.session, {
      invite,
    });

    // Overwrite the server blob with a roster already at the cap.
    const Kg = kgOf(invited.session, admin.groupId);
    const current = must(
      await parseGroupBlobWithKg(
        must(server.groups.get(admin.groupId), "blob"),
        Kg,
      ),
      "obj",
    );
    const roster = Array.from({ length: GROUP_MEMBER_CAP }, () => ({
      cardId: randomAliasId(),
    }));
    const wrapped = await Promise.all(
      roster.map(() =>
        wrapGroupKey(Kg, crypto.getRandomValues(new Uint8Array(32))),
      ),
    );
    server.groups.set(
      admin.groupId,
      await serializeGroupBlob(Kg, { ...current, roster }, wrapped),
    );

    const polled = await pollGroupLifecycle(
      server.api,
      admin.accounts,
      invited.session,
    );
    // The invite stays pending (not dropped) and no member was recorded.
    expect(pendingOf(polled, admin.groupId)).toHaveLength(1);
    expect(membersOf(polled, admin.groupId)).toHaveLength(0);
  });

  it("reject drops the pending invite", async () => {
    const server = fakeServer();
    const admin = await adminWithGroup(server.api);
    const invited = await inviteToGroup(admin.accounts, admin.session, {
      groupId: admin.groupId,
    });
    const invite = inviteFrom(invited.url);
    // The invitee rejects (seals a reject into the lifecycle inbox); the admin ingest
    // then drops the pending invite.
    const invitee = await freshSession(server.api, "sam");
    await rejectGroupInvite(server.api, invitee.session, invite);

    const polled = await pollGroupLifecycle(
      server.api,
      admin.accounts,
      invited.session,
    );
    expect(pendingOf(polled, admin.groupId)).toHaveLength(0);
    expect(membersOf(polled, admin.groupId)).toHaveLength(0);
  });
});

describe("group request lifecycle (doc 33, slice 4b)", () => {
  it("createGroup binds a write token at the public join pointer (slice-3 touch-up)", async () => {
    const server = fakeServer();
    const admin = await adminWithPublicGroup(server.api);
    const group = groupOf(admin.session, admin.groupId);
    // The join pointer now has a bound write token, so knockReview there will not
    // 403; the pointer's payload is a pure decoy (never a card).
    expect(server.aliasTokens.get(admin.joinPointerId)).toBe(
      must(group.joinWriteToken, "joinWriteToken"),
    );
  });

  it("request -> approve -> redeem -> ingest adds the requester as a member", async () => {
    const server = fakeServer();
    const admin = await adminWithPublicGroup(server.api);
    const deps = requesterDeps();

    // REQUEST: resolve the handle, knock at the join pointer, record locally.
    expect(await requestToJoin(server.api, deps, "book_club")).toBe(
      "requested",
    );
    expect(deps.joinStore.listPending()).toHaveLength(1);

    // REVIEW: the admin sees exactly one grantable request.
    const requests = await reviewJoinRequests(
      server.api,
      deps.joinStore,
      admin.session,
      admin.groupId,
    );
    expect(requests).toHaveLength(1);

    // APPROVE: records a pending invite and seals the grant to the requester.
    const approved = await approveJoinRequest(
      server.api,
      admin.accounts,
      admin.session,
      { groupId: admin.groupId, request: must(requests[0], "request") },
    );
    expect(pendingOf(approved, admin.groupId)).toHaveLength(1);

    // REDEEM (a separate requester account): opens the grant and runs the SAME
    // accept back-half an invited member runs, then clears the pending join.
    const requester = await freshSession(server.api, "sam");
    const joined = await redeemJoinRequests(
      server.api,
      requester.accounts,
      deps,
      requester.session,
    );
    const memberGroup = groupOf(joined, admin.groupId);
    expect(memberGroup.isAdmin).toBe(false);
    expect(memberGroup.kg).toBeUndefined();
    expect(deps.joinStore.listPending()).toHaveLength(0);

    // INGEST (admin, reusing the 4a accept ingest): fills a slot + grows the roster.
    const ingested = await pollGroupLifecycle(
      server.api,
      admin.accounts,
      approved,
    );
    expect(membersOf(ingested, admin.groupId)).toHaveLength(1);
    const obj = await parseGroupBlobWithKg(
      must(server.groups.get(admin.groupId), "blob"),
      kgOf(ingested, admin.groupId),
    );
    expect(must(obj, "obj").roster).toHaveLength(2);
  });

  it("requestToJoin fails closed to not-found for an unknown handle", async () => {
    const server = fakeServer();
    const deps = requesterDeps();
    expect(await requestToJoin(server.api, deps, "no_such_group")).toBe(
      "not-found",
    );
    expect(deps.joinStore.listPending()).toHaveLength(0);
  });

  it("reject hides the request from later reviews (device-local, no server write)", async () => {
    const server = fakeServer();
    const admin = await adminWithPublicGroup(server.api);
    const deps = requesterDeps();
    await requestToJoin(server.api, deps, "book_club");
    const before = await reviewJoinRequests(
      server.api,
      deps.joinStore,
      admin.session,
      admin.groupId,
    );
    expect(before).toHaveLength(1);

    rejectJoinRequest(deps.joinStore, admin.session, {
      groupId: admin.groupId,
      requesterHash: must(before[0], "request").requesterHash,
    });
    const after = await reviewJoinRequests(
      server.api,
      deps.joinStore,
      admin.session,
      admin.groupId,
    );
    expect(after).toHaveLength(0);
  });

  it("leave writes the marker + grays the card; the admin ingest drops the member (like remove)", async () => {
    const server = fakeServer();
    const admin = await adminWithGroup(server.api);
    const invited = await inviteToGroup(admin.accounts, admin.session, {
      groupId: admin.groupId,
    });
    const invite = inviteFrom(invited.url);
    const member = await freshSession(server.api, "sam");
    const accepted = await acceptGroupInvite(
      server.api,
      member.accounts,
      member.session,
      { invite },
    );
    const ingested = await pollGroupLifecycle(
      server.api,
      admin.accounts,
      invited.session,
    );
    expect(membersOf(ingested, admin.groupId)).toHaveLength(1);

    // LEAVE (member): write the leave marker, gray our own card, drop the record.
    const left = await leaveGroup(
      server.api,
      member.accounts,
      accepted,
      admin.groupId,
    );
    expect(
      left.blob.groups?.find((g) => g.groupId === admin.groupId),
    ).toBeUndefined();

    // INGEST (admin): the leave drops the member + slot, back to the admin alone,
    // byte-identical to a remove.
    const dropped = await pollGroupLifecycle(
      server.api,
      admin.accounts,
      ingested,
    );
    expect(membersOf(dropped, admin.groupId)).toHaveLength(0);
    const obj = await parseGroupBlobWithKg(
      must(server.groups.get(admin.groupId), "blob"),
      kgOf(dropped, admin.groupId),
    );
    expect(must(obj, "obj").roster).toHaveLength(1);
  });
});

describe("group leave hardening: member-minted leave channel (doc 33)", () => {
  it("the member's leave channel is a fresh inbox, not the invite inbox", async () => {
    const server = fakeServer();
    const admin = await adminWithGroup(server.api);
    const invited = await inviteToGroup(admin.accounts, admin.session, {
      groupId: admin.groupId,
    });
    const invite = inviteFrom(invited.url);
    const member = await freshSession(server.api, "sam");
    const accepted = await acceptGroupInvite(
      server.api,
      member.accounts,
      member.session,
      { invite },
    );

    // The member's own lifecycle channel is a fresh inbox it minted at accept, NOT the
    // invite inbox whose write token rode in the shareable link.
    const memberInbox = must(
      groupOf(accepted, admin.groupId).lifecycleInbox,
      "member lifecycleInbox",
    );
    expect(memberInbox.inboxId).not.toBe(invite.lifecycleInbox.inboxId);

    // After ingest the admin stores that SAME member-minted inbox as the member's
    // leave channel, again distinct from the invite inbox.
    const ingested = await pollGroupLifecycle(
      server.api,
      admin.accounts,
      invited.session,
    );
    const secret = must(membersOf(ingested, admin.groupId)[0], "member");
    expect(secret.lifecycleInbox.inboxId).toBe(memberInbox.inboxId);
    expect(secret.lifecycleInbox.inboxId).not.toBe(
      invite.lifecycleInbox.inboxId,
    );
  });

  it("a leave written to the INVITE inbox no longer evicts the member", async () => {
    const server = fakeServer();
    const admin = await adminWithGroup(server.api);
    const invited = await inviteToGroup(admin.accounts, admin.session, {
      groupId: admin.groupId,
    });
    const invite = inviteFrom(invited.url);
    const member = await freshSession(server.api, "sam");
    await acceptGroupInvite(server.api, member.accounts, member.session, {
      invite,
    });
    const ingested = await pollGroupLifecycle(
      server.api,
      admin.accounts,
      invited.session,
    );
    expect(membersOf(ingested, admin.groupId)).toHaveLength(1);

    // An old holder of the invite LINK writes a leave to the invite inbox (whose write
    // token traveled in the link). The admin polls the member-minted leave channel,
    // not this one, so the member stays: the griefing vector is closed.
    await writePing(server.api, invite.lifecycleInbox, encodeLifecycleLeave());
    const polled = await pollGroupLifecycle(
      server.api,
      admin.accounts,
      ingested,
    );
    expect(membersOf(polled, admin.groupId)).toHaveLength(1);
  });
});

// One joined member: their own account manager + accepted session, and the card id
// their group record publishes to. Bundled so a test can read + remove them.
interface JoinedMember {
  readonly accounts: AccountManager;
  readonly session: OwnerSession;
  readonly cardId: string;
}

// Build a private group with `handles.length` accepted members, ingested in one poll.
// Returns the admin (session already ingested) and each member. Invites are threaded
// through the admin session, every invitee accepts, then a single poll fills every
// slot, so the admin's Kg wraps to the admin + every member.
async function setupWithMembers(
  api: ApiClient,
  handles: string[],
): Promise<{
  accounts: AccountManager;
  session: OwnerSession;
  groupId: string;
  members: JoinedMember[];
}> {
  const admin = await adminWithGroup(api);
  let adminSession = admin.session;
  const members: JoinedMember[] = [];
  for (const handle of handles) {
    const invited = await inviteToGroup(admin.accounts, adminSession, {
      groupId: admin.groupId,
    });
    adminSession = invited.session;
    const m = await freshSession(api, handle);
    const accepted = await acceptGroupInvite(api, m.accounts, m.session, {
      invite: inviteFrom(invited.url),
    });
    members.push({
      accounts: m.accounts,
      session: accepted,
      cardId: groupOf(accepted, admin.groupId).myCardId,
    });
  }
  const ingested = await pollGroupLifecycle(api, admin.accounts, adminSession);
  return {
    accounts: admin.accounts,
    session: ingested,
    groupId: admin.groupId,
    members,
  };
}

describe("group key rotation on remove/leave (doc 33, slice 5)", () => {
  it("remove rotates Kg: the old key opens nothing and the removed member's key no longer unwraps", async () => {
    const server = fakeServer();
    const g = await setupWithMembers(server.api, ["sam"]);
    const sam = must(g.members[0], "member");
    const oldKg = kgOf(g.session, g.groupId);
    const samKey = await deriveGroupMemberKey(sam.session.root, g.groupId);

    const removed = await removeGroupMember(server.api, g.accounts, g.session, {
      groupId: g.groupId,
      cardId: sam.cardId,
    });
    const blob = must(server.groups.get(g.groupId), "blob");

    // The old Kg no longer opens the re-sealed core.
    expect(await parseGroupBlobWithKg(blob, oldKg)).toBeNull();
    // The removed member's own key no longer trial-unwraps a slot.
    expect(await parseGroupBlobForMember(blob, samKey)).toBeNull();
    // The admin cached a fresh, different Kg that opens the core (roster back to one).
    const newKg = kgOf(removed, g.groupId);
    expect(bytesToBase64url(newKg)).not.toBe(bytesToBase64url(oldKg));
    const obj = await parseGroupBlobWithKg(blob, newKg);
    expect(must(obj, "obj").roster).toHaveLength(1);
    // The rebuilt blob is still exactly one fixed-size, random-looking payload.
    expect(blob.length).toBe(GROUP_BLOB_SIZE);
  });

  it("a surviving member re-syncs on the next read: cached Kg fails, trial-unwrap recovers Kg', card republishes", async () => {
    const server = fakeServer();
    const g = await setupWithMembers(server.api, ["sam", "kim"]);
    const sam = must(g.members[0], "sam");
    const kim = must(g.members[1], "kim");

    // Both members read once: caches Kg, publishes their card under it.
    const kimRead1 = await readGroupRoster(
      server.api,
      kim.accounts,
      kim.session,
      g.groupId,
    );
    const oldKg = kgOf(g.session, g.groupId);
    expect(groupOf(kimRead1.session, g.groupId).kg).toBe(
      bytesToBase64url(oldKg),
    );

    // The admin removes sam, rotating to Kg'. Kim's cached Kg is now stale.
    const removed = await removeGroupMember(server.api, g.accounts, g.session, {
      groupId: g.groupId,
      cardId: sam.cardId,
    });
    const newKg = kgOf(removed, g.groupId);

    // Kim's next read fails on the cached key, trial-unwraps Kg', re-caches, and
    // republishes their card under Kg'.
    const kimRead2 = await readGroupRoster(
      server.api,
      kim.accounts,
      kimRead1.session,
      g.groupId,
    );
    expect(kimRead2.obj).not.toBeNull();
    expect(groupOf(kimRead2.session, g.groupId).kg).toBe(
      bytesToBase64url(newKg),
    );
    // A peer opening kim's card under Kg' sees it; under the old Kg it is gray (null).
    const bytes = await server.api.getAlias(kim.cardId);
    expect(await openGroupCard(newKg, bytes)).not.toBeNull();
    expect(await openGroupCard(oldKg, bytes)).toBeNull();
  });

  it("a member offline during the rotation reads as gray to peers until they republish", async () => {
    const server = fakeServer();
    const g = await setupWithMembers(server.api, ["sam", "kim"]);
    const sam = must(g.members[0], "sam");
    const kim = must(g.members[1], "kim");
    // Kim publishes under the old Kg, then stays offline (never re-reads).
    await readGroupRoster(server.api, kim.accounts, kim.session, g.groupId);

    // The admin removes sam, rotating to Kg'. Kim's card is still under the old key.
    const removed = await removeGroupMember(server.api, g.accounts, g.session, {
      groupId: g.groupId,
      cardId: sam.cardId,
    });

    // The admin reads the roster under Kg': kim is listed but their card is gray
    // (null), never a wrong color, because it is still sealed under the old key.
    const view = await readGroupRoster(
      server.api,
      g.accounts,
      removed,
      g.groupId,
    );
    expect(view.members).toHaveLength(2);
    const kimRow = must(
      view.members.find((m) => m.cardId === kim.cardId),
      "kim row",
    );
    expect(kimRow.card).toBeNull();
  });

  it("the removed member is locked out: their own roster read is empty", async () => {
    const server = fakeServer();
    const g = await setupWithMembers(server.api, ["sam"]);
    const sam = must(g.members[0], "member");
    // Sam reads once (caches Kg, publishes), then the admin removes them.
    const samRead1 = await readGroupRoster(
      server.api,
      sam.accounts,
      sam.session,
      g.groupId,
    );
    await removeGroupMember(server.api, g.accounts, g.session, {
      groupId: g.groupId,
      cardId: sam.cardId,
    });

    // Sam's cached Kg no longer opens the core and their slot is gone, so trial-unwrap
    // fails too: an empty roster, the removed member correctly locked out.
    const samRead2 = await readGroupRoster(
      server.api,
      sam.accounts,
      samRead1.session,
      g.groupId,
    );
    expect(samRead2.obj).toBeNull();
    expect(samRead2.members).toHaveLength(0);
  });

  it("a leave rotates the key too, proving leave and remove are identical", async () => {
    const server = fakeServer();
    const g = await setupWithMembers(server.api, ["sam"]);
    const sam = must(g.members[0], "member");
    const oldKg = kgOf(g.session, g.groupId);
    const samKey = await deriveGroupMemberKey(sam.session.root, g.groupId);

    // Sam leaves (writes the leave marker on their member inbox).
    await leaveGroup(server.api, sam.accounts, sam.session, g.groupId);

    // The admin's poll ingests the leave, which routes through removeGroupMember and
    // therefore rotates: the old Kg opens nothing and sam's key no longer unwraps.
    const polled = await pollGroupLifecycle(server.api, g.accounts, g.session);
    expect(membersOf(polled, g.groupId)).toHaveLength(0);
    const blob = must(server.groups.get(g.groupId), "blob");
    expect(await parseGroupBlobWithKg(blob, oldKg)).toBeNull();
    expect(await parseGroupBlobForMember(blob, samKey)).toBeNull();
    const obj = await parseGroupBlobWithKg(blob, kgOf(polled, g.groupId));
    expect(must(obj, "obj").roster).toHaveLength(1);
  });
});

describe("group notify scoping (doc 33, slice 6)", () => {
  it("a positive fans out a decodable ping to each OTHER member, never to the reporter", async () => {
    const server = fakeServer();
    const g = await setupWithMembers(server.api, ["sam", "kim"]);
    const Kg = kgOf(g.session, g.groupId);
    const sam = must(g.members[0], "sam");
    const kim = must(g.members[1], "kim");
    const adminCardId = groupOf(g.session, g.groupId).myCardId;

    // The admin reports a positive: the fan-out opens the group and pings co-members.
    await notifyPositive(server.api, g.accounts, g.session);

    // Each other member's derived inbox holds the SAME contentless PartnerPing the
    // pairwise path produces, openable with that member's OWN derived channel key.
    for (const cardId of [sam.cardId, kim.cardId]) {
      const cap = await deriveGroupNotify(Kg, cardId);
      const bytes = must(await pollInbox(server.api, cap), "ping bytes");
      expect(must(parsePartnerPing(bytes), "ping").kind).toBe("partner-notify");
    }

    // The reporter does NOT ping itself: its own derived inbox is a decoy (opens to
    // nothing), exactly like an untouched inbox.
    const selfCap = await deriveGroupNotify(Kg, adminCardId);
    expect(await pollInbox(server.api, selfCap)).toBeNull();
  });

  it("dedups by inboxId: a co-member who is also a pairwise contact is pinged once", async () => {
    const server = fakeServer();
    const g = await setupWithMembers(server.api, ["sam", "kim"]);
    const Kg = kgOf(g.session, g.groupId);
    const sam = must(g.members[0], "sam");
    const kim = must(g.members[1], "kim");

    // A pairwise contact whose notify channel is EXACTLY sam's group-notify channel
    // (the same person reachable two ways): the merged burst must write it once.
    const shared = await deriveGroupNotify(Kg, sam.cardId);
    const contact: ContactRecord = {
      id: randomAliasId(),
      label: "sam",
      createdDay: 0,
      expiresAt: null,
      alias: {
        id: randomAliasId(),
        writeToken: randomWriteToken(),
        key: randomAliasId(),
        isPublic: false,
      },
      theirNotify: shared,
    };
    const session: OwnerSession = {
      root: g.session.root,
      blob: { ...g.session.blob, contacts: [contact] },
    };

    // Count writes per inbox by wrapping putInbox.
    const writes: string[] = [];
    const countingApi: ApiClient = {
      ...server.api,
      putInbox: (id, payload, token) => {
        writes.push(id);
        return server.api.putInbox(id, payload, token);
      },
    };

    await notifyPositive(countingApi, g.accounts, session);

    // Sam's shared inbox is written exactly once (deduped), and kim once too.
    expect(writes.filter((id) => id === shared.inboxId)).toHaveLength(1);
    const kimCap = await deriveGroupNotify(Kg, kim.cardId);
    expect(writes.filter((id) => id === kimCap.inboxId)).toHaveLength(1);
  });

  it("pollPartnerNudge returns true (aggregate, no group attribution) after a co-member reports", async () => {
    const server = fakeServer();
    const g = await setupWithMembers(server.api, ["sam"]);
    const sam = must(g.members[0], "sam");

    // The member syncs so it holds Kg and can derive its own group-notify inbox.
    const synced = await readGroupRoster(
      server.api,
      sam.accounts,
      sam.session,
      g.groupId,
    );
    expect(await pollPartnerNudge(server.api, synced.session)).toBe(false);

    // The admin reports; the member now sees the single aggregate nudge.
    await notifyPositive(server.api, g.accounts, g.session);
    expect(await pollPartnerNudge(server.api, synced.session)).toBe(true);
  });

  it("after a Kg rotation the fan-out uses the NEW channels: the new kg sees it, the old is dead", async () => {
    const server = fakeServer();
    const g = await setupWithMembers(server.api, ["sam", "kim"]);
    const sam = must(g.members[0], "sam");
    const kim = must(g.members[1], "kim");

    // Kim syncs on the OLD key first.
    const kimOld = await readGroupRoster(
      server.api,
      kim.accounts,
      kim.session,
      g.groupId,
    );

    // The admin removes sam, rotating to Kg', then reports: the fan-out opens under
    // the fresh Kg' and pings the NEW channels only.
    const removed = await removeGroupMember(server.api, g.accounts, g.session, {
      groupId: g.groupId,
      cardId: sam.cardId,
    });
    await notifyPositive(server.api, g.accounts, removed);

    // Kim re-syncs to Kg' and sees the nudge; the stale session still on the old Kg
    // polls a dead channel and sees nothing.
    const kimNew = await readGroupRoster(
      server.api,
      kim.accounts,
      kimOld.session,
      g.groupId,
    );
    expect(await pollPartnerNudge(server.api, kimNew.session)).toBe(true);
    expect(await pollPartnerNudge(server.api, kimOld.session)).toBe(false);
  });

  it("a removed reporter cannot open the group and pings no one", async () => {
    const server = fakeServer();
    const g = await setupWithMembers(server.api, ["sam"]);
    const sam = must(g.members[0], "sam");
    // Sam syncs (caches Kg), then the admin removes them (rotating Kg').
    const synced = await readGroupRoster(
      server.api,
      sam.accounts,
      sam.session,
      g.groupId,
    );
    await removeGroupMember(server.api, g.accounts, g.session, {
      groupId: g.groupId,
      cardId: sam.cardId,
    });

    // groupNotifyTargets fails closed for the locked-out reporter (no targets), and
    // notifyPositive therefore sends nothing (sam has no pairwise contacts either).
    const { targets } = await groupNotifyTargets(
      server.api,
      sam.accounts,
      synced.session,
      g.groupId,
    );
    expect(targets).toHaveLength(0);
    const result = await notifyPositive(
      server.api,
      sam.accounts,
      synced.session,
    );
    expect(result.sent).toHaveLength(0);
    expect(result.failed).toHaveLength(0);
  });
});

// Record every alias PUT id (revokeAlias overwrites via putAlias), so a disband's
// pointer/card revokes are assertable without inspecting opaque payloads.
function aliasWriteSpy(api: ApiClient): { api: ApiClient; writes: string[] } {
  const writes: string[] = [];
  return {
    writes,
    api: {
      ...api,
      putAlias: (id, payload, token, expiresAt) => {
        writes.push(id);
        return api.putAlias(id, payload, token, expiresAt);
      },
    },
  };
}

describe("group admin disband (doc 33, deleteGroup)", () => {
  it("public admin group: releases the handle, deletes the blob, revokes the join pointer + own card, drops the record", async () => {
    const server = fakeServer();
    const admin = await adminWithPublicGroup(server.api);
    const group = groupOf(admin.session, admin.groupId);
    const joinWriteToken = must(group.joinWriteToken, "joinWriteToken");
    const spy = aliasWriteSpy(server.api);

    const disbanded = await deleteGroup(
      spy.api,
      admin.accounts,
      admin.session,
      admin.groupId,
    );

    // The handle no longer resolves, released under the join write token.
    expect(await server.api.resolveVanityName(group.handle)).toBeNull();
    expect(server.releases).toContainEqual({
      name: group.handle,
      writeToken: joinWriteToken,
    });
    // The group blob is gone: a later read returns the existence-uniform decoy.
    expect(server.groups.has(admin.groupId)).toBe(false);
    // The join-pointer decoy and the admin's own card were revoked (overwritten).
    expect(spy.writes).toContain(admin.joinPointerId);
    expect(spy.writes).toContain(group.myCardId);
    // The local record is dropped last.
    expect(
      disbanded.blob.groups?.find((g) => g.groupId === admin.groupId),
    ).toBeUndefined();
  });

  it("private admin group: deletes the blob + own card and drops the record, no handle/pointer teardown", async () => {
    const server = fakeServer();
    const admin = await adminWithGroup(server.api);
    const group = groupOf(admin.session, admin.groupId);
    const spy = aliasWriteSpy(server.api);

    const disbanded = await deleteGroup(
      spy.api,
      admin.accounts,
      admin.session,
      admin.groupId,
    );

    // A private group has no handle to release.
    expect(server.releases).toHaveLength(0);
    // The blob is gone and the admin's own card was revoked; the record is dropped.
    expect(server.groups.has(admin.groupId)).toBe(false);
    expect(spy.writes).toContain(group.myCardId);
    expect(
      disbanded.blob.groups?.find((g) => g.groupId === admin.groupId),
    ).toBeUndefined();
  });

  it("no-op for a non-admin member and for an unknown group id", async () => {
    const server = fakeServer();
    const admin = await adminWithGroup(server.api);
    const invited = await inviteToGroup(admin.accounts, admin.session, {
      groupId: admin.groupId,
    });
    const invite = inviteFrom(invited.url);
    const member = await freshSession(server.api, "sam");
    const accepted = await acceptGroupInvite(
      server.api,
      member.accounts,
      member.session,
      { invite },
    );

    // A member disbanding is a no-op (they leave, not disband): the record stays and
    // nothing is torn down. The member has no admin record for the group, so a call
    // that touched the server would blow up on the fake's unused primitives.
    const afterMember = await deleteGroup(
      server.api,
      member.accounts,
      accepted,
      admin.groupId,
    );
    expect(
      afterMember.blob.groups?.find((g) => g.groupId === admin.groupId),
    ).toBeDefined();
    expect(server.groups.has(admin.groupId)).toBe(true);

    // An unknown group id is likewise a no-op: the admin's own groups are untouched.
    const afterUnknown = await deleteGroup(
      server.api,
      admin.accounts,
      admin.session,
      "no-such-group",
    );
    expect(afterUnknown.blob.groups).toHaveLength(
      admin.session.blob.groups?.length ?? 0,
    );
  });

  it("a member reading a disbanded group gets an empty roster (blob deleted -> decoy)", async () => {
    const server = fakeServer();
    const g = await setupWithMembers(server.api, ["sam"]);
    const sam = must(g.members[0], "member");

    // Sam reads once (caches Kg, publishes their card): the roster is admin + sam.
    const samRead1 = await readGroupRoster(
      server.api,
      sam.accounts,
      sam.session,
      g.groupId,
    );
    expect(samRead1.members).toHaveLength(2);

    // The admin disbands: the blob is deleted (no notify, doc 31).
    await deleteGroup(server.api, g.accounts, g.session, g.groupId);
    expect(server.groups.has(g.groupId)).toBe(false);

    // Sam's next read hits the existence-uniform decoy, which opens to nothing, so the
    // fail-closed roster path returns empty: the group has simply vanished.
    const samRead2 = await readGroupRoster(
      server.api,
      sam.accounts,
      samRead1.session,
      g.groupId,
    );
    expect(samRead2.obj).toBeNull();
    expect(samRead2.members).toHaveLength(0);
  });
});
