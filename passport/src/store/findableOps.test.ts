// @vitest-environment node
import { describe, it, expect, vi } from "vitest";
import {
  primaryShareAlias,
  registerVanityName,
  releaseVanityName,
} from "./findableOps.ts";
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
  return { accounts, session: { master: created.master, blob: created.blob } };
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
    const reg = next.blob.findable;
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
    expect(next.blob.findable).toBeUndefined();
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
    expect(next.blob.findable).toBeUndefined();
    expect(next.blob.aliases).toHaveLength(0);
  });
});

describe("releaseVanityName", () => {
  it("drops the server binding, revokes the alias, and clears the registration", async () => {
    const { api, putAlias, release } = fakeApi({ registerResult: "registered" });
    const { accounts, session } = await freshSession(api);
    const claimed = (await registerVanityName(api, accounts, session, "robin"))
      .session;
    const alias = claimed.blob.aliases[0];
    putAlias.mockClear();

    const next = await releaseVanityName(api, accounts, claimed);

    expect(release).toHaveBeenCalledWith("robin", alias?.writeToken);
    expect(next.blob.findable).toBeUndefined();
    expect(next.blob.aliases).toHaveLength(0);
    // The alias was revoked (a PUT to its id).
    expect(putAlias.mock.calls.map((c) => c[0] as string)).toContain(
      alias?.id,
    );
  });

  it("is a no-op when no name is claimed", async () => {
    const { api, release } = fakeApi({});
    const { accounts, session } = await freshSession(api);

    const next = await releaseVanityName(api, accounts, session);

    expect(next).toBe(session);
    expect(release).not.toHaveBeenCalled();
  });
});

describe("primaryShareAlias", () => {
  const mk = (id: string, isPublic: boolean): AliasRecord => ({
    id: id.repeat(43).slice(0, 43),
    writeToken: "W".repeat(43),
    key: "K".repeat(43),
    isPublic,
  });

  it("excludes the findable alias when picking the share alias", () => {
    const findable = mk("F", true);
    const share = mk("S", true);
    const blob = {
      aliases: [findable, share],
      findable: { name: "robin", aliasId: findable.id },
    } as unknown as AccountBlob;

    // Both are public, but the findable alias must never be returned as the share
    // link, so the OTHER public alias is chosen.
    expect(primaryShareAlias(blob, true)?.id).toBe(share.id);
  });

  it("returns undefined when the only public alias is the findable one", () => {
    const findable = mk("F", true);
    const blob = {
      aliases: [findable],
      findable: { name: "robin", aliasId: findable.id },
    } as unknown as AccountBlob;

    expect(primaryShareAlias(blob, true)).toBeUndefined();
  });
});
