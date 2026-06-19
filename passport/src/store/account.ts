/**
 * Account lifecycle on top of AccountSync: create a new account, recover one
 * from a recovery phrase, and record a published alias into it. This is the
 * owner-side logic onboarding/login/recovery drive; both the passphrase path
 * (here) and the WebAuthn-PRF path produce the same master key, so this layer is
 * agnostic to how the key was minted.
 */

import type { ApiClient } from "../api/client.ts";
import {
  deriveMasterKey,
  randomRecoveryPhrase,
  type Bytes,
} from "../crypto/index.ts";
import { createAccountSync } from "./accountSync.ts";
import type { AccountBlob, AliasRecord } from "./accountBlob.ts";

export interface NewAccount {
  /** Shown once to the owner; the only way back into the account. */
  readonly recoveryPhrase: string;
  readonly master: Bytes;
  readonly blob: AccountBlob;
}

export interface RecoveredAccount {
  readonly master: Bytes;
  readonly blob: AccountBlob;
}

export interface AccountManager {
  /** Mint a new account: generate the recovery phrase, save an empty blob. */
  create(handle: string): Promise<NewAccount>;
  /** Recover with a phrase. Returns null when no account exists for it. */
  recover(phrase: string): Promise<RecoveredAccount | null>;
  /** Record a published alias into the account and persist it. */
  addAlias(master: Bytes, record: AliasRecord): Promise<AccountBlob>;
}

export function createAccountManager(api: ApiClient): AccountManager {
  const sync = createAccountSync(api);
  return {
    async create(handle) {
      const recoveryPhrase = randomRecoveryPhrase();
      const master = await deriveMasterKey(recoveryPhrase);
      const blob: AccountBlob = { handle, aliases: [] };
      await sync.save(master, blob);
      return { recoveryPhrase, master, blob };
    },

    async recover(phrase) {
      const master = await deriveMasterKey(phrase);
      const blob = await sync.load(master);
      return blob === null ? null : { master, blob };
    },

    async addAlias(master, record) {
      // Read-modify-write. Single device today; multi-device concurrent edits
      // are last-write-wins until the X-Version optimistic-concurrency path is
      // wired (the server reserves the header but does not yet enforce it).
      const blob = await sync.load(master);
      if (blob === null) {
        throw new Error("addAlias: no account exists for this key");
      }
      const next: AccountBlob = {
        ...blob,
        aliases: [...blob.aliases, record],
      };
      await sync.save(master, next);
      return next;
    },
  };
}
