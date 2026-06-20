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
import { todayEpochDay } from "../core/clock.ts";
import { DEFAULT_AVATAR, isAvatarConfig } from "../lib/avatars.ts";
import { createAccountSync } from "./accountSync.ts";
import { republishOwnerCard } from "./ownerCard.ts";
import { revokeAlias } from "./publish.ts";
import { isValidHandle } from "./codec.ts";
import {
  isSharingMode,
  type AccountBlob,
  type AliasRecord,
  type ContactRecord,
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
  /** Record a per-contact link into the account and persist it. */
  addContact(master: Bytes, contact: ContactRecord): Promise<AccountBlob>;
  /** Drop a contact record (after its alias payload is revoked). */
  removeContact(master: Bytes, contactId: string): Promise<AccountBlob>;
  /**
   * Delete the account: revoke every published alias (so no shared link can ever
   * resolve to a status again) and remove the account blob. "Working delete"
   * (doc 01 data minimization). Idempotent and best-effort on the aliases.
   */
  deleteAccount(master: Bytes): Promise<void>;
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

  // Load-modify-save for the synced blob. Single device today; multi-device
  // concurrent edits are last-write-wins until X-Version is enforced. The list
  // mutations below are upsert/filter by id, so a retry is idempotent (a partial
  // save that landed but lost its response replays to the same result).
  const modify = async (
    master: Bytes,
    fn: (blob: AccountBlob) => AccountBlob,
  ): Promise<AccountBlob> => {
    const blob = await sync.load(master);
    if (blob === null) {
      throw new Error("account does not exist for this key");
    }
    const next = fn(blob);
    await sync.save(master, next);
    return next;
  };

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
        contacts: [],
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

    addAlias(master, record) {
      // Upsert by id so a lost-response retry does not record the alias twice
      // (which would orphan a write token and leave a link live after a revoke).
      return modify(master, (blob) => ({
        ...blob,
        aliases: [...blob.aliases.filter((a) => a.id !== record.id), record],
      }));
    },

    removeAlias(master, id) {
      return modify(master, (blob) => ({
        ...blob,
        aliases: blob.aliases.filter((a) => a.id !== id),
      }));
    },

    addContact(master, contact) {
      return modify(master, (blob) => ({
        ...blob,
        contacts: [
          ...blob.contacts.filter((c) => c.id !== contact.id),
          contact,
        ],
      }));
    },

    removeContact(master, contactId) {
      return modify(master, (blob) => ({
        ...blob,
        contacts: blob.contacts.filter((c) => c.id !== contactId),
      }));
    },

    async deleteAccount(master) {
      const blob = await sync.load(master);
      // Revoke every alias AND every per-contact link FIRST (overwrite each to
      // undecryptable bytes) so nothing can resolve after the account is gone;
      // only then drop the blob. A failed revoke leaves the blob for a retry.
      if (blob !== null) {
        const all = [...blob.aliases, ...blob.contacts.map((c) => c.alias)];
        await Promise.all(all.map((a) => revokeAlias(api, a)));
      }
      await sync.remove(master);
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
      const nowDay = todayEpochDay();
      const expired = blob.contacts.filter(
        (c) => c.expiresDay !== null && nowDay >= c.expiresDay,
      );
      const live = blob.contacts.filter(
        (c) => c.expiresDay === null || nowDay < c.expiresDay,
      );
      // Enforce expiry FIRST (overwrite each expired link to garbage so it stops
      // resolving), THEN drop the expired records + save. Order matters: if a
      // record were dropped before its revoke landed, the link would keep
      // resolving with no capability left to revoke it. "Expired" therefore means
      // "no future reads", enforced whenever the owner next acts. (A fully passive
      // owner who never changes state leaves links live until a later app-load
      // sweep; tracked as a follow-up.)
      await Promise.all(expired.map((c) => revokeAlias(api, c.alias)));
      const next: AccountBlob = { ...blob, state, contacts: live };
      await sync.save(master, next);
      // Propagate the new badge to every still-live shared link. Self-healing: a
      // retry reloads the saved state and republishes idempotently.
      const liveLinks = [...next.aliases, ...live.map((c) => c.alias)];
      await republishOwnerCard(api, liveLinks, {
        state,
        handle: next.handle,
        nowDay,
      });
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
