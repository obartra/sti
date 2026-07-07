// @vitest-environment node
import { describe, it, expect } from "vitest";
import {
  setRecoveryPassword,
  disableRecoveryPassword,
  recoverByPassword,
} from "./recoveryOps.ts";
import type { OwnerSession } from "./session.ts";
import type { AccountManager } from "./account.ts";
import type { ApiClient } from "../api/client.ts";
import { RECOVERY_ENVELOPE_SIZE } from "../api/contract.ts";
import {
  importRootKey,
  deriveRootKey,
  randomRecoveryPhrase,
  type RootKey,
  type Bytes,
} from "../crypto/index.ts";
import type { AccountBlob } from "./accountBlob.ts";
import { INITIAL_OWNER_STATE } from "../core/badge.ts";
import { DEFAULT_AVATAR } from "../lib/avatars.ts";

const STRONG = "correct-horse-battery-staple";

// A faithful in-memory stand-in for the server's recovery-envelope store: one
// fixed-size blob per locator, bound to the first writer's token, a silent no-op on
// a token mismatch (collision), and a random decoy on a miss (doc 32).
function fakeRecoveryApi() {
  const store = new Map<string, { bytes: Bytes; auth: string }>();
  const api: Partial<ApiClient> = {
    putRecoveryEnvelope: (locator, envelope, token) => {
      const existing = store.get(locator);
      if (existing === undefined)
        store.set(locator, { bytes: envelope, auth: token });
      else if (existing.auth === token) existing.bytes = envelope;
      // else: a collision under a different token is a silent no-op.
      return Promise.resolve();
    },
    getRecoveryEnvelope: (locator) =>
      Promise.resolve(
        store.get(locator)?.bytes ?? new Uint8Array(RECOVERY_ENVELOPE_SIZE),
      ),
    deleteRecoveryEnvelope: (locator, token) => {
      if (store.get(locator)?.auth === token) store.delete(locator);
      return Promise.resolve();
    },
  };
  return { api: api as ApiClient, store };
}

function baseBlob(): AccountBlob {
  return {
    aliases: [],
    contacts: [],
    state: INITIAL_OWNER_STATE,
    avatar: DEFAULT_AVATAR,
  };
}

// A stable fake "now" so the injected clock produces a deterministic passwordSetAt.
const FAKE_NOW = 1_700_000_000_000;

// A minimal AccountManager whose only exercised method is setRecoveryName, folding
// the name (and, mirroring the real withRecoveryName, the passwordSetAt timestamp)
// into a mutable blob as the real load-modify-save would persist it. A clear drops
// both the name and the timestamp.
function fakeAccounts(
  blobRef: { blob: AccountBlob },
  opts: { noAccount?: boolean } = {},
): AccountManager {
  const setRecoveryName = (
    _root: RootKey,
    name: string | null,
  ): Promise<AccountBlob> => {
    const next: AccountBlob =
      name === null
        ? baseBlob()
        : { ...blobRef.blob, recoveryName: name, passwordSetAt: FAKE_NOW };
    blobRef.blob = next;
    return Promise.resolve(next);
  };
  return {
    setRecoveryName,
    // The new-device unlock path loads the account from the recovered root; noAccount
    // simulates a valid password whose account blob no longer exists.
    loadByRoot: () => Promise.resolve(opts.noAccount ? null : blobRef.blob),
    sweepExpiredLinks: () => Promise.resolve(blobRef.blob),
  } as Pick<
    AccountManager,
    "setRecoveryName" | "loadByRoot" | "sweepExpiredLinks"
  > as AccountManager;
}

async function rootFor(phrase: string): Promise<RootKey> {
  return importRootKey(await deriveRootKey(phrase as never));
}

describe("recovery password ops", () => {
  it("sets the password: stores an openable envelope and records the name", async () => {
    const phrase = randomRecoveryPhrase();
    const root = await rootFor(phrase);
    const ref = { blob: baseBlob() };
    const session: OwnerSession = { root, blob: ref.blob };
    const { api, store } = fakeRecoveryApi();

    const res = await setRecoveryPassword(api, fakeAccounts(ref), session, {
      name: "MeoW",
      password: STRONG,
      phrase: phrase,
    });
    expect(res.outcome).toBe("set");
    expect(res.session.blob.recoveryName).toBe("meow"); // normalized
    // Setting the password records when it was set (doc 32), so the yearly refresh
    // nudge can date the factor across devices.
    expect(res.session.blob.passwordSetAt).toBe(FAKE_NOW);
    // The stored blob is exactly the fixed wire size, bound under the locator.
    expect(store.get("meow")?.bytes).toHaveLength(RECOVERY_ENVELOPE_SIZE);
  });

  it("rejects a phrase that names a different account", async () => {
    const mine = randomRecoveryPhrase();
    const other = randomRecoveryPhrase();
    const ref = { blob: baseBlob() };
    const session: OwnerSession = { root: await rootFor(mine), blob: ref.blob };
    const { api } = fakeRecoveryApi();

    const res = await setRecoveryPassword(api, fakeAccounts(ref), session, {
      name: "meow",
      password: STRONG,
      phrase: other,
    });
    expect(res.outcome).toBe("wrongPhrase");
    expect(res.session.blob.recoveryName).toBeUndefined();
  });

  it("rejects a weak password before wrapping anything", async () => {
    const phrase = randomRecoveryPhrase();
    const ref = { blob: baseBlob() };
    const session: OwnerSession = {
      root: await rootFor(phrase),
      blob: ref.blob,
    };
    const { api, store } = fakeRecoveryApi();

    const res = await setRecoveryPassword(api, fakeAccounts(ref), session, {
      name: "meow",
      password: "password",
      phrase: phrase,
    });
    expect(res.outcome).toBe("weakPassword");
    expect(store.size).toBe(0);
  });

  it("reports nameUnavailable when the locator is held by another account", async () => {
    const phrase = randomRecoveryPhrase();
    const ref = { blob: baseBlob() };
    const session: OwnerSession = {
      root: await rootFor(phrase),
      blob: ref.blob,
    };
    const { api, store } = fakeRecoveryApi();
    // Pre-seed "meow" under a different owner's token, so our write no-ops and the
    // read-back returns their envelope (which our password cannot open).
    store.set("meow", {
      bytes: crypto.getRandomValues(new Uint8Array(RECOVERY_ENVELOPE_SIZE)),
      auth: "someone-elses-token",
    });

    const res = await setRecoveryPassword(api, fakeAccounts(ref), session, {
      name: "meow",
      password: STRONG,
      phrase: phrase,
    });
    expect(res.outcome).toBe("nameUnavailable");
    expect(res.session.blob.recoveryName).toBeUndefined();
  });

  it("disables the password: drops the envelope and clears the name", async () => {
    const phrase = randomRecoveryPhrase();
    const root = await rootFor(phrase);
    const ref = { blob: baseBlob() };
    const { api, store } = fakeRecoveryApi();

    // Turn it on, then off.
    const set = await setRecoveryPassword(
      api,
      fakeAccounts(ref),
      { root, blob: ref.blob },
      { name: "meow", password: STRONG, phrase: phrase },
    );
    expect(store.has("meow")).toBe(true);

    const off = await disableRecoveryPassword(
      api,
      fakeAccounts(ref),
      set.session,
    );
    expect(off.blob.recoveryName).toBeUndefined();
    // Turning the password off clears the set date with the name (doc 32), so the
    // nudge never fires for a factor that is gone.
    expect(off.blob.passwordSetAt).toBeUndefined();
    expect(store.has("meow")).toBe(false);
  });

  it("disable is a no-op when no password is set", async () => {
    const root = await rootFor(randomRecoveryPhrase());
    const ref = { blob: baseBlob() };
    const { api } = fakeRecoveryApi();
    const session: OwnerSession = { root, blob: ref.blob };
    const same = await disableRecoveryPassword(api, fakeAccounts(ref), session);
    expect(same).toBe(session);
  });
});

describe("recoverByPassword (new-device unlock)", () => {
  // Set the password up on the "old device", then unlock from a fresh accounts.
  async function withEnvelope(): Promise<{
    api: ApiClient;
    ref: { blob: AccountBlob };
    phrase: string;
    root: RootKey;
  }> {
    const phrase = randomRecoveryPhrase();
    const root = await rootFor(phrase);
    const ref = { blob: baseBlob() };
    const { api } = fakeRecoveryApi();
    await setRecoveryPassword(
      api,
      fakeAccounts(ref),
      { root, blob: ref.blob },
      {
        name: "meow",
        password: STRONG,
        phrase,
      },
    );
    return { api, ref, phrase, root };
  }

  it("recovers with the right recovery name + password", async () => {
    const { api, ref } = await withEnvelope();
    const session = await recoverByPassword(
      api,
      fakeAccounts(ref),
      "MeoW", // normalized
      STRONG,
    );
    expect(session).not.toBeNull();
    expect(session?.blob).toBeDefined();
  });

  it("returns null on the wrong password", async () => {
    const { api, ref } = await withEnvelope();
    const session = await recoverByPassword(
      api,
      fakeAccounts(ref),
      "meow",
      "a-different-strong-passphrase",
    );
    expect(session).toBeNull();
  });

  it("returns null for an unknown recovery name (a decoy that won't open)", async () => {
    const { api, ref } = await withEnvelope();
    const session = await recoverByPassword(
      api,
      fakeAccounts(ref),
      "nobodyhome",
      STRONG,
    );
    expect(session).toBeNull();
  });

  it("returns null when no account loads for the recovered root", async () => {
    const { api, ref } = await withEnvelope();
    const session = await recoverByPassword(
      api,
      fakeAccounts(ref, { noAccount: true }),
      "meow",
      STRONG,
    );
    expect(session).toBeNull();
  });
});
