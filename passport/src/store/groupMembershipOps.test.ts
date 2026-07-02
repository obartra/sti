// @vitest-environment node
import { describe, it, expect } from "vitest";
import {
  inviteToGroup,
  revokeGroupInvite,
  acceptGroupInvite,
  rejectGroupInvite,
  removeGroupMember,
  readGroupRoster,
} from "./groupMembershipOps.ts";
import { pollGroupLifecycle } from "./groupIngestOps.ts";
import {
  requestToJoin,
  reviewJoinRequests,
  approveJoinRequest,
  rejectJoinRequest,
  redeemJoinRequests,
  leaveGroup,
  type JoinRequesterDeps,
} from "./groupJoinOps.ts";
import { createGroup } from "./groupOps.ts";
import { parseGroupInvite, type GroupInvite } from "./groupInvite.ts";
import { createAccountManager, type AccountManager } from "./account.ts";
import { createGrantKeyStore } from "./grantKeyStore.ts";
import { createGroupJoinStore } from "./groupJoinStore.ts";
import type { StorageLike } from "../auth/deviceStore.ts";
import {
  serializeGroupBlob,
  parseGroupBlobWithKg,
  GROUP_MEMBER_CAP,
} from "./groupObject.ts";
import { wrapGroupKey, type GroupKey } from "./groupCrypto.ts";
import type {
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
  randomAliasId,
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
} {
  const aliases = new Map<string, Bytes>();
  const aliasTokens = new Map<string, string>();
  const inboxes = new Map<string, Bytes>();
  const groups = new Map<string, Bytes>();
  const accounts = new Map<string, Bytes>();
  const knocks = new Map<string, PendingKnock[]>();
  const vanity = new Map<string, string>();
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
    deleteGroupBlob: unused,
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
    releaseVanityName: unused,
    resolveVanityName: (name) => Promise.resolve(vanity.get(name) ?? null),
    reportVanityName: unused,
    submitFeedback: unused,
    getRecoveryEnvelope: unused,
    putRecoveryEnvelope: unused,
    deleteRecoveryEnvelope: unused,
    health: unused,
  };
  return { api, groups, aliasTokens };
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
      invite,
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
    await acceptGroupInvite(
      server.api,
      invitee.accounts,
      invitee.session,
      invite,
    );
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

  it("remove drops the member's slot + roster entry", async () => {
    const server = fakeServer();
    const admin = await adminWithGroup(server.api);
    const invited = await inviteToGroup(admin.accounts, admin.session, {
      groupId: admin.groupId,
    });
    const invite = inviteFrom(invited.url);
    const invitee = await freshSession(server.api, "sam");
    await acceptGroupInvite(
      server.api,
      invitee.accounts,
      invitee.session,
      invite,
    );
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
    await acceptGroupInvite(
      server.api,
      invitee.accounts,
      invitee.session,
      invite,
    );

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
      invite,
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
