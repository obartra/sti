// @vitest-environment node
import { describe, it, expect, vi } from "vitest";
import { createGroup } from "./groupOps.ts";
import { createAccountManager } from "./account.ts";
import { openGroupCard, type GroupKey } from "./groupCrypto.ts";
import { deriveOwnerCard } from "./ownerCard.ts";
import { pseudonymFor } from "../lib/avatars.ts";
import { todayEpochDay } from "../core/clock.ts";
import type { ApiClient, VanityRegisterResult } from "../api/client.ts";
import type { OwnerSession } from "./session.ts";
import { base64urlToBytes, type Bytes } from "../crypto/index.ts";

interface PutAliasCall {
  id: string;
  payload: Bytes;
  writeToken: string;
}

// A stateful fake over a Map (so the real account manager persists), recording the
// alias PUT (the group card), the group-blob PUT, and the vanity register call. The
// register result is configurable.
function fakeApi(opts: { registerResult?: VanityRegisterResult } = {}): {
  api: ApiClient;
  putAlias: PutAliasCall[];
  putGroupBlob: ReturnType<typeof vi.fn>;
  register: ReturnType<typeof vi.fn>;
} {
  const store = new Map<string, Bytes>();
  const unused = () => {
    throw new Error("not used in this test");
  };
  const putAlias: PutAliasCall[] = [];
  const putGroupBlob = vi.fn(() => Promise.resolve());
  const register = vi.fn(
    (): Promise<VanityRegisterResult> =>
      Promise.resolve(opts.registerResult ?? "registered"),
  );
  const api: ApiClient = {
    getAlias: unused,
    putAlias: (id: string, payload: Bytes, writeToken: string) => {
      putAlias.push({ id, payload, writeToken });
      return Promise.resolve();
    },
    notify: unused,
    republish: unused,
    knockCount: () => Promise.resolve(0),
    knockReview: () => Promise.resolve({ count: 0, pending: [] }),
    getInbox: unused,
    putInbox: unused,
    knock: unused,
    registerPush: unused,
    getVapidPublicKey: unused,
    registerVanityName: register,
    releaseVanityName: unused,
    resolveVanityName: unused,
    reportVanityName: unused,
    submitFeedback: unused,
    getRecoveryEnvelope: unused,
    putRecoveryEnvelope: unused,
    deleteRecoveryEnvelope: unused,
    getGroupBlob: unused,
    putGroupBlob,
    deleteGroupBlob: unused,
    health: unused,
    getAccount: (id) => {
      const blob = store.get(id);
      return Promise.resolve(blob ? { blob, version: "1" } : null);
    },
    putAccount: (id, body) => {
      store.set(id, body);
      return Promise.resolve({ version: "1" });
    },
    deleteAccount: (id) => {
      store.delete(id);
      return Promise.resolve();
    },
  };
  return { api, putAlias, putGroupBlob, register };
}

async function freshSession(api: ApiClient): Promise<{
  accounts: ReturnType<typeof createAccountManager>;
  session: OwnerSession;
}> {
  const accounts = createAccountManager(api);
  const created = await accounts.create("robin");
  return { accounts, session: { root: created.root, blob: created.blob } };
}

describe("createGroup", () => {
  it("public path: claims the handle to a join pointer and records the group", async () => {
    const { api, register, putGroupBlob } = fakeApi({
      registerResult: "registered",
    });
    const { accounts, session } = await freshSession(api);

    const {
      session: next,
      groupId,
      handle,
      result,
    } = await createGroup(api, accounts, session, {
      handle: "book_club",
      visibility: "public",
      meetingKind: "recurring",
    });

    expect(result).toBe("registered");
    expect(handle).toBe("book_club");
    const group = next.blob.groups?.find((g) => g.groupId === groupId);
    expect(group).toBeDefined();
    expect(group?.visibility).toBe("public");
    expect(group?.isAdmin).toBe(true);
    // A dedicated join pointer was recorded, distinct from the group blob id.
    expect(group?.joinPointerId).toBeDefined();
    expect(group?.joinPointerId).not.toBe(groupId);
    // The server bound the handle to the join pointer (not the blob id).
    expect(register).toHaveBeenCalledWith(
      "book_club",
      group?.joinPointerId,
      group?.joinWriteToken,
    );
    // The group blob was written to its own id.
    expect(putGroupBlob).toHaveBeenCalledOnce();
    expect(putGroupBlob.mock.calls[0]?.[0]).toBe(groupId);
  });

  it("private path: never calls registerVanityName and records no join pointer", async () => {
    const { api, register } = fakeApi();
    const { accounts, session } = await freshSession(api);

    const {
      session: next,
      groupId,
      result,
    } = await createGroup(api, accounts, session, {
      handle: "party_2026",
      visibility: "private",
      meetingKind: "event",
    });

    expect(result).toBe("created");
    expect(register).not.toHaveBeenCalled();
    const group = next.blob.groups?.find((g) => g.groupId === groupId);
    expect(group?.visibility).toBe("private");
    expect(group?.joinPointerId).toBeUndefined();
    expect(group?.joinWriteToken).toBeUndefined();
  });

  it("publishes the creator's card under Kg to myCardId", async () => {
    const { api, putAlias } = fakeApi();
    const { accounts, session } = await freshSession(api);

    const { session: next, groupId } = await createGroup(
      api,
      accounts,
      session,
      {
        handle: "book_club",
        visibility: "private",
        meetingKind: "event",
      },
    );

    const group = next.blob.groups?.find((g) => g.groupId === groupId);
    if (group === undefined) throw new Error("expected a recorded group");
    // The card was PUT to the group card id with its write token.
    const put = putAlias.find((p) => p.id === group.myCardId);
    if (put === undefined) throw new Error("expected the card PUT");
    expect(put.writeToken).toBe(group.myCardWriteToken);
    // The published bytes open under Kg to the owner's current card, with the
    // anonymous (id-derived) face keyed to the card id.
    const Kg = base64urlToBytes(group.kg) as GroupKey;
    const card = await openGroupCard(Kg, put.payload);
    expect(card).toEqual(
      deriveOwnerCard(
        session.blob.state,
        pseudonymFor(group.myCardId),
        todayEpochDay(),
      ),
    );
  });

  it("keeps a usable group even when the public handle is unavailable", async () => {
    const { api, putGroupBlob } = fakeApi({ registerResult: "unavailable" });
    const { accounts, session } = await freshSession(api);

    const {
      session: next,
      groupId,
      result,
    } = await createGroup(api, accounts, session, {
      handle: "book_club",
      visibility: "public",
      meetingKind: "recurring",
    });

    expect(result).toBe("unavailable");
    // The group is still created (blob written, record kept), just without a claimed
    // handle: no join pointer is recorded.
    expect(putGroupBlob).toHaveBeenCalledOnce();
    const group = next.blob.groups?.find((g) => g.groupId === groupId);
    expect(group).toBeDefined();
    expect(group?.joinPointerId).toBeUndefined();
  });

  it("rejects an invalid handle before any network call", async () => {
    const { api, putAlias, putGroupBlob, register } = fakeApi();
    const { accounts, session } = await freshSession(api);

    await expect(
      createGroup(api, accounts, session, {
        handle: "AB", // too short for the vanity rules
        visibility: "public",
        meetingKind: "event",
      }),
    ).rejects.toThrow();

    expect(putAlias).toHaveLength(0);
    expect(putGroupBlob).not.toHaveBeenCalled();
    expect(register).not.toHaveBeenCalled();
  });
});
