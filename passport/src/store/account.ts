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
import {
  INITIAL_OWNER_STATE,
  isOwnerState,
  type OwnerState,
} from "../core/badge.ts";
import { DEFAULT_AVATAR, isAvatarConfig } from "../lib/avatars.ts";
import { createAccountSync } from "./accountSync.ts";
import { republishOwnerCard } from "./ownerCard.ts";
import { isValidHandle } from "./codec.ts";
import {
  isSharingMode,
  type AccountBlob,
  type AliasRecord,
  type SharingMode,
} from "./accountBlob.ts";

/** The owner's presentation profile: avatar plus the account sharing default. */
export interface OwnerProfile {
  readonly avatar: AccountBlob["avatar"];
  readonly sharingMode: SharingMode;
}

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
  /** Drop an alias record from the account (after its payload is revoked). */
  removeAlias(master: Bytes, id: string): Promise<AccountBlob>;
  /**
   * Update the owner's state (a reported result, a pause), persist it, and
   * republish every alias so the new badge propagates to all shared links.
   */
  setOwnerState(master: Bytes, state: OwnerState): Promise<AccountBlob>;
  /**
   * Update the owner's presentation profile (avatar + sharing default) and
   * persist it. Does not touch the badge, so no republish is needed.
   */
  setProfile(master: Bytes, profile: OwnerProfile): Promise<AccountBlob>;
}

export function createAccountManager(api: ApiClient): AccountManager {
  const sync = createAccountSync(api);
  return {
    async create(handle) {
      // Validate up front: an invalid handle would seal fine but throw on
      // parseAccountBlob during recovery, locking the owner out of an account
      // that physically exists.
      if (!isValidHandle(handle)) {
        throw new Error("create: invalid handle");
      }
      const recoveryPhrase = randomRecoveryPhrase();
      const master = await deriveMasterKey(recoveryPhrase);
      const blob: AccountBlob = {
        handle,
        aliases: [],
        state: INITIAL_OWNER_STATE,
        // A fresh account starts with the default avatar and the private (link)
        // sharing default; onboarding updates both via setProfile.
        avatar: DEFAULT_AVATAR,
        sharingMode: "link",
      };
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
      // Upsert by id so a retry after a partially-succeeded save (PUT landed,
      // response lost) does not record the same alias twice, which would orphan
      // a write token and leave a link live after a revoke.
      const next: AccountBlob = {
        ...blob,
        aliases: [...blob.aliases.filter((a) => a.id !== record.id), record],
      };
      await sync.save(master, next);
      return next;
    },

    async removeAlias(master, id) {
      const blob = await sync.load(master);
      if (blob === null) {
        throw new Error("removeAlias: no account exists for this key");
      }
      // Idempotent: a retry after a partial save (the payload was revoked, the
      // record already dropped) is a no-op rather than an error.
      const next: AccountBlob = {
        ...blob,
        aliases: blob.aliases.filter((a) => a.id !== id),
      };
      await sync.save(master, next);
      return next;
    },

    async setOwnerState(master, state) {
      // Guard at write time, symmetric to the strict read: persisting an invalid
      // state would brick the account on the next load (parse fails closed).
      if (!isOwnerState(state)) {
        throw new Error("setOwnerState: invalid state");
      }
      const blob = await sync.load(master);
      if (blob === null) {
        throw new Error("setOwnerState: no account exists for this key");
      }
      const next: AccountBlob = { ...blob, state };
      await sync.save(master, next);
      // Propagate the new badge to every shared link. If this throws partway
      // (some aliases republished, some not), it is self-healing: a retry
      // reloads the already-saved state and republishes ALL aliases
      // idempotently, so the links converge.
      await republishOwnerCard(api, next.aliases, state, next.handle);
      return next;
    },

    async setProfile(master, profile) {
      // Guard at write time, symmetric to the strict read, so a bad profile
      // cannot brick the account on the next load.
      if (!isAvatarConfig(profile.avatar)) {
        throw new Error("setProfile: invalid avatar");
      }
      if (!isSharingMode(profile.sharingMode)) {
        throw new Error("setProfile: invalid sharingMode");
      }
      const blob = await sync.load(master);
      if (blob === null) {
        throw new Error("setProfile: no account exists for this key");
      }
      const next: AccountBlob = {
        ...blob,
        avatar: profile.avatar,
        sharingMode: profile.sharingMode,
      };
      await sync.save(master, next);
      return next;
    },
  };
}
