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
  importMasterKey,
  parseRecoveryPhrase,
  randomRecoveryPhrase,
  type MasterKey,
} from "../crypto/index.ts";
import {
  INITIAL_OWNER_STATE,
  isOwnerState,
  type OwnerState,
} from "../core/badge.ts";
import { todayEpochDay, nowMs } from "../core/clock.ts";
import { DEFAULT_AVATAR, isAvatarConfig } from "../lib/avatars.ts";
import { createAccountSync, type AccountSync } from "./accountSync.ts";
import { republishOwnerCard } from "./ownerCard.ts";
import { revokeAlias } from "./publish.ts";
import { isValidHandle } from "./codec.ts";
import {
  isSharingMode,
  type AccountBlob,
  type AliasRecord,
  type ContactRecord,
  type CircleRecord,
  type FindableRegistration,
  type SharingMode,
} from "./accountBlob.ts";
import { normalizeCircleMembers } from "./circles.ts";

/** The owner's presentation profile: avatar plus the account sharing default. */
export interface OwnerProfile {
  readonly avatar: AccountBlob["avatar"];
  readonly sharingMode: SharingMode;
}

export interface NewAccount {
  /** Shown once to the owner; the only way back into the account. */
  readonly recoveryPhrase: string;
  readonly master: MasterKey;
  readonly blob: AccountBlob;
}

export interface RecoveredAccount {
  readonly master: MasterKey;
  readonly blob: AccountBlob;
}

export interface AccountManager {
  /** Mint a new account: generate the recovery phrase, save an empty blob. */
  create(handle: string): Promise<NewAccount>;
  /** Recover with a phrase. Returns null when no account exists for it. */
  recover(phrase: string): Promise<RecoveredAccount | null>;
  /** Record a published alias into the account and persist it. */
  addAlias(master: MasterKey, record: AliasRecord): Promise<AccountBlob>;
  /** Drop an alias record from the account (after its payload is revoked). */
  removeAlias(master: MasterKey, id: string): Promise<AccountBlob>;
  /** Record a per-contact link into the account and persist it. */
  addContact(master: MasterKey, contact: ContactRecord): Promise<AccountBlob>;
  /**
   * Drop a contact record (after its alias payload is revoked). Also strips the
   * contact from every circle, so a circle never references a contact that is gone.
   */
  removeContact(master: MasterKey, contactId: string): Promise<AccountBlob>;
  /**
   * Create or update a circle (doc 13 slice 6), upserting by id. Members are
   * normalized against current contacts (unknown/removed ids dropped, deduped), so
   * a circle never references a contact that does not exist.
   */
  upsertCircle(master: MasterKey, circle: CircleRecord): Promise<AccountBlob>;
  /** Drop a circle by id. Purely local; the server never knew it existed. */
  removeCircle(master: MasterKey, circleId: string): Promise<AccountBlob>;
  /**
   * Delete the account: revoke every published alias (so no shared link can ever
   * resolve to a status again) and remove the account blob. "Working delete"
   * (doc 01 data minimization). Idempotent and best-effort on the aliases.
   */
  deleteAccount(master: MasterKey): Promise<void>;
  /**
   * Update the owner's state (a reported result, a pause), persist it, and
   * republish every alias so the new badge propagates to all shared links.
   */
  setOwnerState(master: MasterKey, state: OwnerState): Promise<AccountBlob>;
  /**
   * Update the owner's presentation profile (avatar + sharing default) and
   * persist it. Does not touch the badge, so no republish is needed.
   */
  setProfile(master: MasterKey, profile: OwnerProfile): Promise<AccountBlob>;
  /**
   * Record (or clear, when null) the owner's findable registration (doc 17): the
   * claimed name and the alias it resolves to. Pure persistence; the server-side
   * claim/release and the dedicated alias's lifecycle are driven a layer up
   * (findableOps), so this just writes the blob field after that has succeeded.
   */
  setFindable(
    master: MasterKey,
    findable: FindableRegistration | null,
  ): Promise<AccountBlob>;
  /**
   * Record a findable claim atomically (doc 17): upsert the dedicated alias AND set
   * the registration in a SINGLE blob write, so there is no intermediate state where
   * the alias exists without its registration (which would surface it as a stray
   * public link). Called by findableOps after the server bind succeeds.
   */
  recordFindable(
    master: MasterKey,
    alias: AliasRecord,
    findable: FindableRegistration,
  ): Promise<AccountBlob>;
  /**
   * Enforce link expiry on load: revoke + drop any links (aliases or contact
   * links) past their expiry, then persist. A no-op (no write) when nothing is
   * expired. No republish, the badge is unchanged. This closes the passive-owner
   * gap so expiry no longer waits for the next setOwnerState.
   */
  sweepExpiredLinks(master: MasterKey): Promise<AccountBlob>;
}

// A brand-new account: empty links, default avatar, private (link) sharing. The
// notify inbox is no longer account-level; each contact gets its own at link time
// (doc 13). Onboarding updates the avatar and sharing default via setProfile.
function freshBlob(handle: string): AccountBlob {
  return {
    handle,
    aliases: [],
    contacts: [],
    state: INITIAL_OWNER_STATE,
    avatar: DEFAULT_AVATAR,
    sharingMode: "link",
  };
}

// Drop a contact and strip it from every circle, so no circle dangles a member
// that no longer exists.
function withContactRemoved(blob: AccountBlob, contactId: string): AccountBlob {
  return {
    ...blob,
    contacts: blob.contacts.filter((c) => c.id !== contactId),
    ...(blob.circles !== undefined
      ? {
          circles: blob.circles.map((circle) => ({
            ...circle,
            memberContactIds: circle.memberContactIds.filter(
              (id) => id !== contactId,
            ),
          })),
        }
      : {}),
  };
}

// Upsert a circle by id, normalizing its members against current contacts so it
// never references a contact that does not exist.
function withCircleUpserted(
  blob: AccountBlob,
  circle: CircleRecord,
): AccountBlob {
  const normalized: CircleRecord = {
    ...circle,
    memberContactIds: normalizeCircleMembers(blob, circle.memberContactIds),
  };
  const others = (blob.circles ?? []).filter((c) => c.id !== circle.id);
  return { ...blob, circles: [...others, normalized] };
}

function withCircleRemoved(blob: AccountBlob, circleId: string): AccountBlob {
  return {
    ...blob,
    circles: (blob.circles ?? []).filter((c) => c.id !== circleId),
  };
}

// Set or clear the optional findable registration. exactOptionalPropertyTypes
// forbids assigning `undefined`, so a clear (null) deletes the key off a fresh copy
// rather than writing `findable: undefined`.
function withFindable(
  blob: AccountBlob,
  findable: FindableRegistration | null,
): AccountBlob {
  if (findable !== null) return { ...blob, findable };
  const next = { ...blob };
  delete (next as { findable?: FindableRegistration }).findable;
  return next;
}

// Upsert the dedicated findable alias AND set the registration in one step, so a
// claim's two facts land in a single blob write (no alias-without-registration gap).
function withFindableAlias(
  blob: AccountBlob,
  alias: AliasRecord,
  findable: FindableRegistration,
): AccountBlob {
  return {
    ...blob,
    aliases: [...blob.aliases.filter((a) => a.id !== alias.id), alias],
    findable,
  };
}

// A link with an expiry is expired once now reaches its instant; a null/absent
// expiry (until-revoked) never is. Times are absolute epoch ms (doc 16). Shared by
// the sweep and the republish-skip so an expired link is treated the same.
function isExpired(expiresAt: number | null | undefined, now: number): boolean {
  return expiresAt !== null && expiresAt !== undefined && now >= expiresAt;
}

// Sweep expired links: overwrite each expired alias / contact link to garbage
// (revoke) so it stops resolving, then return the blob carrying only the live
// links plus the new state. Revoke runs BEFORE the records are dropped so a link
// always still has a capability to kill it; "expired" therefore means "no future
// reads", enforced whenever the owner next acts. (A fully passive owner leaves
// links live until a later app-load sweep; tracked as a follow-up.)
async function sweepExpired(
  api: ApiClient,
  blob: AccountBlob,
  state: OwnerState,
  now: number,
): Promise<AccountBlob> {
  await Promise.all([
    ...blob.contacts
      .filter((c) => isExpired(c.expiresAt, now))
      .map((c) => revokeAlias(api, c.alias)),
    ...blob.aliases
      .filter((a) => isExpired(a.expiresAt, now))
      .map((a) => revokeAlias(api, a)),
  ]);
  return {
    ...blob,
    state,
    contacts: blob.contacts.filter((c) => !isExpired(c.expiresAt, now)),
    aliases: blob.aliases.filter((a) => !isExpired(a.expiresAt, now)),
  };
}

/**
 * Republish the owner's current card (the current badge, plus each alias's own
 * per-alias display identity, doc 15) to every still-live shared link: every
 * non-expired alias plus every non-expired contact link. Shared by setOwnerState
 * (a badge change) and setProfile (an avatar/profile edit) so both re-seal via one
 * path. setOwnerState sweeps expired links first; setProfile does not, so this
 * helper also skips expired links itself, and a re-seal can never resurrect a dead
 * link. The decorrelation gap documented on republishOwnerCard applies to both.
 * Per-alias identity does not propagate from the account: an alias keeps its own
 * face, so a main-identity edit re-seals each card with that card's unchanged
 * identity (doc 15 non-goal).
 */
async function republishLiveLinks(
  api: ApiClient,
  blob: AccountBlob,
  nowDay: number,
): Promise<void> {
  // Expiry is absolute ms; the badge derivation still uses the day clock.
  const now = nowMs();
  const liveAliases = blob.aliases.filter((a) => !isExpired(a.expiresAt, now));
  const liveContacts = blob.contacts.filter(
    (c) => !isExpired(c.expiresAt, now),
  );
  const liveLinks = [...liveAliases, ...liveContacts.map((c) => c.alias)];
  await republishOwnerCard(api, liveLinks, { state: blob.state, nowDay });
}

// A load-modify-save over the synced blob (the closure createAccountManager builds).
type BlobModify = (
  master: MasterKey,
  fn: (blob: AccountBlob) => AccountBlob,
) => Promise<AccountBlob>;

// The findable (vanity-name) account mutations, split out so createAccountManager
// stays within its length ceiling. Pure persistence over `modify`; the server-side
// claim/release lives a layer up (findableOps).
function findableMethods(
  modify: BlobModify,
): Pick<AccountManager, "setFindable" | "recordFindable"> {
  return {
    setFindable: (master, findable) =>
      modify(master, (blob) => withFindable(blob, findable)),
    recordFindable: (master, alias, findable) =>
      modify(master, (blob) => withFindableAlias(blob, alias, findable)),
  };
}

// Account lifecycle (mint + recover), split out so createAccountManager stays
// within its length ceiling. Both derive the master from an app-generated phrase:
// create mints one; recover validates the entered phrase against the app format
// (parseRecoveryPhrase) so a malformed one fails closed instead of deriving a key
// from arbitrary text.
function lifecycleMethods(
  sync: AccountSync,
): Pick<AccountManager, "create" | "recover"> {
  return {
    async create(handle) {
      // Validate up front: an invalid handle would seal fine but throw on
      // parseAccountBlob during recovery, locking the owner out of an account
      // that physically exists.
      if (!isValidHandle(handle)) {
        throw new Error("create: invalid handle");
      }
      const recoveryPhrase = randomRecoveryPhrase();
      // Derive the transient bytes, import them into the non-extractable master
      // key (doc 24), then drop the bytes: no layer below holds raw master bytes.
      const master = await importMasterKey(
        await deriveMasterKey(recoveryPhrase),
      );
      const blob = freshBlob(handle);
      await sync.save(master, blob);
      return { recoveryPhrase, master, blob };
    },
    async recover(phrase) {
      const parsed = parseRecoveryPhrase(phrase);
      if (parsed === null) return null;
      const master = await importMasterKey(await deriveMasterKey(parsed));
      const blob = await sync.load(master);
      return blob === null ? null : { master, blob };
    },
  };
}

// The sync is injectable so the app can pass the offline-tolerant, local-first
// sync (doc 22 slice 4); it defaults to the plain server sync for tests and any
// caller that does not need offline durability.
export function createAccountManager(
  api: ApiClient,
  sync: AccountSync = createAccountSync(api),
): AccountManager {
  // Load-modify-save for the synced blob. Concurrent multi-device edits are
  // handled by the injected sync: the offline sync (the app's default) carries an
  // X-Version precondition and 3-way merges on a 409 (offlineSync.ts, doc 22 S8),
  // so a concurrent edit is reconciled, not clobbered. The list mutations below
  // are upsert/filter by id, so a retry is idempotent (a partial save that landed
  // but lost its response replays to the same result).
  const modify = async (
    master: MasterKey,
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
    ...lifecycleMethods(sync),

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
      return modify(master, (blob) => withContactRemoved(blob, contactId));
    },

    upsertCircle(master, circle) {
      return modify(master, (blob) => withCircleUpserted(blob, circle));
    },

    removeCircle(master, circleId) {
      return modify(master, (blob) => withCircleRemoved(blob, circleId));
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
      // swept holds the pruned blob once the sweep (server revoke + drop) lands, so
      // the catch can persist THAT rather than the pre-sweep blob. Resurrecting the
      // already-revoked expired links (the old behavior) would list dead links whose
      // server payloads are gone.
      let swept: AccountBlob | null = null;
      try {
        // Online path: sweep expired links (revoke + drop), save, then republish
        // the new badge to the survivors. Expiry is ms; the clock is day-granular.
        swept = await sweepExpired(api, blob, state, nowMs());
        await sync.save(master, swept);
        await republishLiveLinks(api, swept, nowDay);
        return swept;
      } catch {
        // Offline, or a server step failed. If the sweep already completed, keep its
        // pruned result (never the pre-sweep blob, which would resurrect the revoked
        // links); otherwise fall back to a state-only durable save that lets expired
        // links linger (doc 16, the genuinely-offline case). Either way the state
        // change is durable and the reconnect drain re-runs sweep + republish.
        const next: AccountBlob = swept ?? { ...blob, state };
        await sync.save(master, next);
        return next;
      }
    },

    async sweepExpiredLinks(master) {
      const blob = await sync.load(master);
      if (blob === null) {
        throw new Error("sweepExpiredLinks: no account exists for this key");
      }
      const now = nowMs();
      const anyExpired =
        blob.contacts.some((c) => isExpired(c.expiresAt, now)) ||
        blob.aliases.some((a) => isExpired(a.expiresAt, now));
      // Nothing to do: skip the revoke + write entirely so a clean load is a
      // pure read.
      if (!anyExpired) return blob;
      // Reuse the same revoke + drop sweep as setOwnerState, with the state
      // unchanged (a load does not move the badge), and no republish (the
      // surviving links' cards are unchanged).
      const next = await sweepExpired(api, blob, blob.state, now);
      await sync.save(master, next);
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
      // No republish: the account avatar/handle is the owner's main identity, NOT
      // an alias's face. Each alias carries its own per-alias identity (doc 15), so
      // editing the main identity changes Home and the mint pre-fill but not any
      // already-published card. Re-sealing here would also needlessly republish
      // every link in one window (the decorrelation-timing gap) for no change.
      return next;
    },

    ...findableMethods(modify),
  };
}
