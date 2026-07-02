// @vitest-environment node
import { describe, it, expect } from "vitest";
import {
  inviteToGroup,
  revokeGroupInvite,
  acceptGroupInvite,
  rejectGroupInvite,
  pollGroupLifecycle,
  removeGroupMember,
  readGroupRoster,
} from "./groupMembershipOps.ts";
import { createGroup } from "./groupOps.ts";
import { parseGroupInvite, type GroupInvite } from "./groupInvite.ts";
import { createAccountManager, type AccountManager } from "./account.ts";
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
import type { ApiClient, VanityRegisterResult } from "../api/client.ts";
import type { OwnerSession } from "./session.ts";
import { ALIAS_PAYLOAD_SIZE, GROUP_BLOB_SIZE } from "../api/contract.ts";
import {
  base64urlToBytes,
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
// server). Two account managers over the same api sit at distinct key-derived account
// ids, so the admin and the invitee are genuinely separate accounts.
function fakeServer(): { api: ApiClient; groups: Map<string, Bytes> } {
  const aliases = new Map<string, Bytes>();
  const inboxes = new Map<string, Bytes>();
  const groups = new Map<string, Bytes>();
  const accounts = new Map<string, Bytes>();
  const unused = () => {
    throw new Error("not used in this test");
  };
  const decoy = (n: number) => crypto.getRandomValues(new Uint8Array(n));
  const api: ApiClient = {
    getAlias: (id) =>
      Promise.resolve(aliases.get(id) ?? decoy(ALIAS_PAYLOAD_SIZE)),
    putAlias: (id, payload) => {
      aliases.set(id, payload);
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
    knock: unused,
    knockCount: unused,
    knockReview: unused,
    registerPush: unused,
    getVapidPublicKey: unused,
    registerVanityName: (): Promise<VanityRegisterResult> =>
      Promise.resolve("registered"),
    releaseVanityName: unused,
    resolveVanityName: unused,
    reportVanityName: unused,
    submitFeedback: unused,
    getRecoveryEnvelope: unused,
    putRecoveryEnvelope: unused,
    deleteRecoveryEnvelope: unused,
    health: unused,
  };
  return { api, groups };
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
