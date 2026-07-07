// @vitest-environment node
import { describe, it, expect, vi } from "vitest";
import {
  primaryShareAlias,
  registerVanityName,
  releaseVanityName,
} from "./findableOps.ts";
import { setShareLinkExpiry } from "./shareOps.ts";
import { createAccountManager } from "./account.ts";
import type { ApiClient, VanityRegisterResult } from "../api/client.ts";
import type { AccountBlob, AliasRecord } from "./accountBlob.ts";
import type { OwnerSession } from "./session.ts";
import { type Bytes } from "../crypto/index.ts";

// A stateful fake of the account endpoints over a Map (so the real account manager
// persists), plus recording stubs for the alias PUTs and the vanity calls. The
// register result is configurable; releaseVanityName records its args.
function fakeApi(opts: {
  registerResult?: VanityRegisterResult | (() => Promise<VanityRegisterResult>);
}): {
  api: ApiClient;
  putAlias: ReturnType<typeof vi.fn>;
  register: ReturnType<typeof vi.fn>;
  release: ReturnType<typeof vi.fn>;
} {
  const store = new Map<string, Bytes>();
  const unused = () => {
    throw new Error("not used in this test");
  };
  const putAlias = vi.fn(() => Promise.resolve());
  const register = vi.fn(
    (): Promise<VanityRegisterResult> =>
      typeof opts.registerResult === "function"
        ? opts.registerResult()
        : Promise.resolve(opts.registerResult ?? "registered"),
  );
  const release = vi.fn(() => Promise.resolve());
  const api: ApiClient = {
    getAlias: unused,
    putAlias,
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
    releaseVanityName: release,
    resolveVanityName: unused,
    reportVanityName: unused,
    submitFeedback: unused,
    getRecoveryEnvelope: unused,
    putRecoveryEnvelope: unused,
    deleteRecoveryEnvelope: unused,
    getGroupBlob: unused,
    putGroupBlob: unused,
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
  return { api, putAlias, register, release };
}

async function freshSession(api: ApiClient): Promise<{
  accounts: ReturnType<typeof createAccountManager>;
  session: OwnerSession;
}> {
  const accounts = createAccountManager(api);
  const created = await accounts.create("robin");
  return { accounts, session: { root: created.root, blob: created.blob } };
}

describe("registerVanityName", () => {
  it("mints a dedicated alias, claims the name, and records both", async () => {
    const { api, register } = fakeApi({ registerResult: "registered" });
    const { accounts, session } = await freshSession(api);

    const { session: next, result } = await registerVanityName(
      api,
      accounts,
      session,
      "robin",
    );

    expect(result).toBe("registered");
    const reg = next.blob.findables?.find((f) => f.name === "robin");
    expect(reg).toBeDefined();
    expect(reg?.name).toBe("robin");
    // The backing alias is in the blob (so knocks to it are reviewed) and public.
    const alias = next.blob.aliases.find((a) => a.id === reg?.aliasId);
    expect(alias).toBeDefined();
    expect(alias?.isPublic).toBe(true);
    // The server was asked to bind the name to that alias's id + write token.
    expect(register).toHaveBeenCalledWith(
      "robin",
      alias?.id,
      alias?.writeToken,
    );
  });

  it("on 'unavailable' persists nothing and revokes the minted alias", async () => {
    const { api, putAlias, register } = fakeApi({
      registerResult: "unavailable",
    });
    const { accounts, session } = await freshSession(api);

    const { session: next, result } = await registerVanityName(
      api,
      accounts,
      session,
      "taken",
    );

    expect(result).toBe("unavailable");
    expect(next.blob.findables).toBeUndefined();
    expect(next.blob.aliases).toHaveLength(0);
    expect(register).toHaveBeenCalledOnce();
    // Two PUTs to the same alias id: the publish, then the revoke (garbage).
    const ids = putAlias.mock.calls.map((c) => c[0] as string);
    expect(ids).toHaveLength(2);
    expect(ids[0]).toBe(ids[1]);
  });

  it("maps a transport error to 'error' and leaves no orphan registration", async () => {
    const { api } = fakeApi({
      registerResult: () => Promise.reject(new Error("boom")),
    });
    const { accounts, session } = await freshSession(api);

    const { session: next, result } = await registerVanityName(
      api,
      accounts,
      session,
      "robin",
    );

    expect(result).toBe("error");
    expect(next.blob.findables).toBeUndefined();
    expect(next.blob.aliases).toHaveLength(0);
  });

  it("appends a second name so both land in findables (doc 17 cap 5)", async () => {
    const { api } = fakeApi({ registerResult: "registered" });
    const { accounts, session } = await freshSession(api);

    const one = (await registerVanityName(api, accounts, session, "robin"))
      .session;
    const two = (await registerVanityName(api, accounts, one, "wren")).session;

    // Both registrations survive, each with its own dedicated public alias.
    expect(two.blob.findables?.map((f) => f.name)).toEqual(["robin", "wren"]);
    const aliasIds = new Set(two.blob.findables?.map((f) => f.aliasId));
    expect(aliasIds.size).toBe(2);
    for (const id of aliasIds) {
      expect(two.blob.aliases.find((a) => a.id === id)?.isPublic).toBe(true);
    }
  });

  it("returns 'error' and mints nothing when already at the cap of 5", async () => {
    const { api, putAlias, register } = fakeApi({
      registerResult: "registered",
    });
    const { accounts, session } = await freshSession(api);

    // Fill the list to MAX_PUBLIC_NAMES.
    let current = session;
    for (const name of ["a_one", "a_two", "a_three", "a_four", "a_five"]) {
      current = (await registerVanityName(api, accounts, current, name))
        .session;
    }
    expect(current.blob.findables).toHaveLength(5);
    putAlias.mockClear();
    register.mockClear();

    // A sixth claim is refused defensively: no alias minted, no server call, no change.
    const { session: next, result } = await registerVanityName(
      api,
      accounts,
      current,
      "a_six",
    );
    expect(result).toBe("error");
    expect(next).toBe(current);
    expect(next.blob.findables).toHaveLength(5);
    expect(putAlias).not.toHaveBeenCalled();
    expect(register).not.toHaveBeenCalled();
  });
});

describe("releaseVanityName", () => {
  it("drops the server binding, revokes the alias, and clears the registration", async () => {
    const { api, putAlias, release } = fakeApi({
      registerResult: "registered",
    });
    const { accounts, session } = await freshSession(api);
    const claimed = (await registerVanityName(api, accounts, session, "robin"))
      .session;
    const alias = claimed.blob.aliases[0];
    putAlias.mockClear();

    const next = await releaseVanityName(api, accounts, claimed, "robin");

    expect(release).toHaveBeenCalledWith("robin", alias?.writeToken);
    expect(next.blob.findables).toBeUndefined();
    expect(next.blob.aliases).toHaveLength(0);
    // The alias was revoked (a PUT to its id).
    expect(putAlias.mock.calls.map((c) => c[0] as string)).toContain(alias?.id);
  });

  it("releases one name and leaves the other in place", async () => {
    const { api, release } = fakeApi({ registerResult: "registered" });
    const { accounts, session } = await freshSession(api);
    const one = (await registerVanityName(api, accounts, session, "robin"))
      .session;
    const two = (await registerVanityName(api, accounts, one, "wren")).session;
    const wrenAliasId = two.blob.findables?.find(
      (f) => f.name === "wren",
    )?.aliasId;

    const next = await releaseVanityName(api, accounts, two, "robin");

    // Only "robin" is gone; "wren" and its backing alias survive.
    expect(release).toHaveBeenCalledWith("robin", expect.any(String));
    expect(next.blob.findables?.map((f) => f.name)).toEqual(["wren"]);
    expect(next.blob.aliases.map((a) => a.id)).toContain(wrenAliasId);
  });

  it("is a no-op when the name is not one the owner holds", async () => {
    const { api, release } = fakeApi({});
    const { accounts, session } = await freshSession(api);

    const next = await releaseVanityName(api, accounts, session, "nobody");

    expect(next).toBe(session);
    expect(release).not.toHaveBeenCalled();
  });

  // A revoke failure (the card overwrite did not land) must NOT tear down local
  // state: dropping the alias while its card is still live would leave a "deleted"
  // status card readable to anyone holding the bare alias id. The release rejects so
  // the owner retries, with the alias + registration still in the blob.
  it("keeps the alias and registration when the revoke fails", async () => {
    const { api } = fakeApi({ registerResult: "registered" });
    const accounts = createAccountManager(api);
    const created = await accounts.create("robin");
    const session: OwnerSession = {
      root: created.root,
      blob: created.blob,
    };
    const claimed = (await registerVanityName(api, accounts, session, "robin"))
      .session;
    const alias = claimed.blob.aliases[0];
    // The revoke is a PUT to the alias id; make that PUT fail (the mint already ran).
    api.putAlias = (id) =>
      id === alias?.id
        ? Promise.reject(new Error("network"))
        : Promise.resolve();

    await expect(
      releaseVanityName(api, accounts, claimed, "robin"),
    ).rejects.toThrow();

    // Nothing was torn down: the persisted blob still has the registration and its
    // alias, so the owner can retry.
    const reloaded = (await accounts.recover(created.recoveryPhrase))?.blob;
    expect(reloaded?.findables?.some((f) => f.name === "robin")).toBe(true);
    expect(reloaded?.aliases.map((a) => a.id)).toContain(alias?.id);
  });
});

// The findable alias must never be treated as the share-sheet link by ANY share
// path; setShareLinkExpiry re-PUTs the share alias's card (which would reset the
// findable alias's expiry + identity), so pin that it excludes it.
describe("share-link expiry has no private share alias to change", () => {
  it("is a no-op when the only alias is the findable public one", async () => {
    const { api, putAlias } = fakeApi({ registerResult: "registered" });
    const { accounts, session } = await freshSession(api);
    const claimed = (await registerVanityName(api, accounts, session, "robin"))
      .session;
    putAlias.mockClear();

    const next = await setShareLinkExpiry(api, accounts, claimed, 1000);

    // No private share alias exists (the findable one is excluded), so nothing is
    // re-PUT: the findable card's expiry/identity stays untouched.
    expect(next).toBe(claimed);
    expect(putAlias).not.toHaveBeenCalled();
  });
});

describe("primaryShareAlias", () => {
  const mk = (id: string, isPublic: boolean): AliasRecord => ({
    id: id.repeat(43).slice(0, 43),
    writeToken: "W".repeat(43),
    key: "K".repeat(43),
    isPublic,
  });

  it("picks the private alias, skipping public and findable ones", () => {
    const findable = mk("F", true);
    const publicShare = mk("P", true);
    const share = mk("S", false);
    const blob = {
      aliases: [findable, publicShare, share],
      findables: [{ name: "robin", aliasId: findable.id }],
    } as unknown as AccountBlob;

    // The share link is always the private alias (a keyed /a/ link), never a
    // public or a findable alias.
    expect(primaryShareAlias(blob)?.id).toBe(share.id);
  });

  it("returns undefined when there is no private share alias", () => {
    const findable = mk("F", true);
    const blob = {
      aliases: [findable],
      findables: [{ name: "robin", aliasId: findable.id }],
    } as unknown as AccountBlob;

    expect(primaryShareAlias(blob)).toBeUndefined();
  });
});
