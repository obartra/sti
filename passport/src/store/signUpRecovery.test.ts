// @vitest-environment node
// Sign-up with an optional password (doc 32): the account is minted from the
// phrase as always, and when a Username + password is chosen the fresh in-memory
// root is wrapped and stored on the spot (no phrase re-entry). These run against the
// REAL createAccountManager + shared storeRecoveryEnvelope over an in-memory api, so
// the wrap/store/confirm/record sequence is exercised end to end, and the
// recoverByPassword round trip proves the stored envelope actually opens the account.
import { describe, it, expect } from "vitest";
import { createAccountManager } from "./account.ts";
import { createAccountSync } from "./accountSync.ts";
import { recoverByPassword } from "./recoveryOps.ts";
import type { ApiClient } from "../api/client.ts";
import { RECOVERY_ENVELOPE_SIZE } from "../api/contract.ts";
import { type Bytes } from "../crypto/index.ts";

const STRONG = "correct-horse-battery-staple";
const WEAK = "password";

// A minimal in-memory api: the account store (id -> ciphertext + write token) plus
// the recovery-envelope store (locator -> fixed-size blob + write token), faithful to
// the server's silent-collision (a PUT under a different token no-ops) and fixed-size
// decoy-on-miss behavior (doc 32). Everything else throws (unused here).
function fakeApi() {
  let seq = 0;
  const accounts = new Map<string, { blob: Bytes; auth: string; v: string }>();
  const envelopes = new Map<string, { bytes: Bytes; auth: string }>();
  const api: Partial<ApiClient> = {
    getAccount: (id) => {
      const rec = accounts.get(id);
      return Promise.resolve(rec ? { blob: rec.blob, version: rec.v } : null);
    },
    putAccount: (id, blob, writeToken) => {
      const v = String(++seq);
      accounts.set(id, { blob, auth: writeToken, v });
      return Promise.resolve({ version: v });
    },
    deleteAccount: (id) => {
      accounts.delete(id);
      return Promise.resolve();
    },
    putRecoveryEnvelope: (locator, envelope, token) => {
      const existing = envelopes.get(locator);
      if (existing === undefined)
        envelopes.set(locator, { bytes: envelope, auth: token });
      else if (existing.auth === token) existing.bytes = envelope;
      // else: a collision under a different token is a silent no-op (doc 32).
      return Promise.resolve();
    },
    getRecoveryEnvelope: (locator) =>
      Promise.resolve(
        envelopes.get(locator)?.bytes ?? new Uint8Array(RECOVERY_ENVELOPE_SIZE),
      ),
    deleteRecoveryEnvelope: (locator, token) => {
      if (envelopes.get(locator)?.auth === token) envelopes.delete(locator);
      return Promise.resolve();
    },
  };
  return { api: api as ApiClient, envelopes };
}

describe("sign-up with an optional password (doc 32)", () => {
  it("wraps + stores an openable envelope at the Username and records the name", async () => {
    const { api, envelopes } = fakeApi();
    const accounts = createAccountManager(api, createAccountSync(api));

    const created = await accounts.create("robin", {
      recoveryName: "RobIn_Backup",
      password: STRONG,
    });

    expect(created.recoveryOutcome).toBe("set");
    // The name is normalized and recorded in the (persisted) blob.
    expect(created.blob.recoveryName).toBe("robin_backup");
    // A real fixed-size envelope landed at the normalized locator.
    expect(envelopes.get("robin_backup")?.bytes).toHaveLength(
      RECOVERY_ENVELOPE_SIZE,
    );

    // The stored envelope truly opens the account: a fresh AccountManager (a "new
    // device") recovers by Username + password.
    const fresh = createAccountManager(api, createAccountSync(api));
    const session = await recoverByPassword(api, fresh, "robin_backup", STRONG);
    expect(session).not.toBeNull();
    expect(session?.blob.handle).toBe("robin");
    expect(session?.blob.recoveryName).toBe("robin_backup");
  });

  it("is unchanged when no password is requested (no envelope, no outcome)", async () => {
    const { api, envelopes } = fakeApi();
    const accounts = createAccountManager(api, createAccountSync(api));

    const created = await accounts.create("robin");

    expect(created.recoveryOutcome).toBeUndefined();
    expect(created.blob.recoveryName).toBeUndefined();
    expect(envelopes.size).toBe(0);
  });

  it("rejects a weak password without storing anything, but still creates the account", async () => {
    const { api, envelopes } = fakeApi();
    const accounts = createAccountManager(api, createAccountSync(api));

    const created = await accounts.create("robin", {
      recoveryName: "robin_backup",
      password: WEAK,
    });

    expect(created.recoveryOutcome).toBe("weakPassword");
    // No name recorded, no envelope stored: only the optional step declined.
    expect(created.blob.recoveryName).toBeUndefined();
    expect(envelopes.size).toBe(0);
    // The account itself exists and is phrase-recoverable.
    const recovered = await accounts.recover(created.recoveryPhrase);
    expect(recovered?.blob.handle).toBe("robin");
  });

  it("reports nameUnavailable on a taken Username without failing account creation", async () => {
    const { api, envelopes } = fakeApi();
    const accounts = createAccountManager(api, createAccountSync(api));
    // Pre-seed the locator under a stranger's token: our PUT no-ops and the read-back
    // returns their envelope, which our password cannot open (the collision signal).
    envelopes.set("robin_backup", {
      bytes: crypto.getRandomValues(new Uint8Array(RECOVERY_ENVELOPE_SIZE)),
      auth: "someone-elses-token",
    });

    const created = await accounts.create("robin", {
      recoveryName: "robin_backup",
      password: STRONG,
    });

    expect(created.recoveryOutcome).toBe("nameUnavailable");
    // The account is still created and phrase-recoverable; only the name was not ours.
    expect(created.blob.recoveryName).toBeUndefined();
    const recovered = await accounts.recover(created.recoveryPhrase);
    expect(recovered?.blob.handle).toBe("robin");
    // The password cannot open the stranger's envelope, so no false unlock.
    const session = await recoverByPassword(
      api,
      accounts,
      "robin_backup",
      STRONG,
    );
    expect(session).toBeNull();
  });
});
