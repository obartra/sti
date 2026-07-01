/**
 * Account lifecycle on top of AccountSync: create a new account, recover one
 * from a recovery phrase, and record a published alias into it. This is the
 * owner-side logic onboarding/login/recovery drive; both the passphrase path
 * (here) and the WebAuthn-PRF path produce the same root key, so this layer is
 * agnostic to how the key was minted.
 */

import type { ApiClient } from "../api/client.ts";
import {
  deriveRootKey,
  importRootKey,
  parseRecoveryPhrase,
  randomRecoveryPhrase,
  type RootKey,
} from "../crypto/index.ts";
import { wrapSignUpRecovery } from "./recoveryOps.ts";
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
  /**
   * The owner's local display name (the account `handle`), edited from Settings.
   * Omit the key to leave the existing name untouched (the avatar-only edit path);
   * pass a string to set it, or null / "" to clear it back to no name.
   */
  readonly handle?: string | null | undefined;
  /**
   * The Home hero's default face. Omit to leave it unchanged; a value sets it.
   */
  readonly homeDefaultView?: "criteria" | "shared" | undefined;
}

// The at-sign-up password factor (doc 32) lives with the rest of the recovery
// crypto in recoveryOps; re-exported here for the create() surface.
export type { SignUpRecovery, SignUpRecoveryOutcome } from "./recoveryOps.ts";
import type { SignUpRecovery, SignUpRecoveryOutcome } from "./recoveryOps.ts";

export interface NewAccount {
  /** Shown once to the owner; the only way back into the account. */
  readonly recoveryPhrase: string;
  readonly root: RootKey;
  readonly blob: AccountBlob;
  /**
   * The outcome of the optional at-sign-up password step (doc 32), or undefined when
   * none was requested. The account is always created regardless; a non-"set" value
   * means only the optional password step did not complete.
   */
  readonly recoveryOutcome?: SignUpRecoveryOutcome;
}

export interface RecoveredAccount {
  readonly root: RootKey;
  readonly blob: AccountBlob;
}

export interface AccountManager {
  /**
   * Mint a new account: generate the recovery phrase, save an empty blob. When
   * `recovery` is given, also wrap the fresh root under that password and store the
   * envelope at the public handle on the spot (doc 32, no phrase re-entry), recording
   * the name in the blob. The account is created and phrase/passkey-recoverable
   * regardless; `NewAccount.recoveryOutcome` reports whether the optional step landed.
   */
  create(handle?: string, recovery?: SignUpRecovery): Promise<NewAccount>;
  /** Recover with a phrase. Returns null when no account exists for it. */
  recover(phrase: string): Promise<RecoveredAccount | null>;
  /**
   * Load the account blob for an already-recovered root (doc 32 new-device unlock):
   * the password path unwraps the envelope to the root bytes itself, so it needs to
   * load the blob from the root rather than from a phrase. Null when no blob exists.
   */
  loadByRoot(root: RootKey): Promise<AccountBlob | null>;
  /** Record a published alias into the account and persist it. */
  addAlias(root: RootKey, record: AliasRecord): Promise<AccountBlob>;
  /** Drop an alias record from the account (after its payload is revoked). */
  removeAlias(root: RootKey, id: string): Promise<AccountBlob>;
  /** Record a per-contact link into the account and persist it. */
  addContact(root: RootKey, contact: ContactRecord): Promise<AccountBlob>;
  /**
   * Drop a contact record (after its alias payload is revoked). Also strips the
   * contact from every circle, so a circle never references a contact that is gone.
   */
  removeContact(root: RootKey, contactId: string): Promise<AccountBlob>;
  /**
   * Create or update a circle (doc 13 slice 6), upserting by id. Members are
   * normalized against current contacts (unknown/removed ids dropped, deduped), so
   * a circle never references a contact that does not exist.
   */
  upsertCircle(root: RootKey, circle: CircleRecord): Promise<AccountBlob>;
  /** Drop a circle by id. Purely local; the server never knew it existed. */
  removeCircle(root: RootKey, circleId: string): Promise<AccountBlob>;
  /**
   * Delete the account: revoke every published alias (so no shared link can ever
   * resolve to a status again) and remove the account blob. "Working delete"
   * (doc 01 data minimization). Idempotent and best-effort on the aliases.
   */
  deleteAccount(root: RootKey): Promise<void>;
  /**
   * Update the owner's state (a reported result, a pause), persist it, and
   * republish every alias so the new badge propagates to all shared links.
   */
  setOwnerState(root: RootKey, state: OwnerState): Promise<AccountBlob>;
  /**
   * Update the owner's presentation profile (avatar + sharing default) and
   * persist it. Does not touch the badge, so no republish is needed.
   */
  setProfile(root: RootKey, profile: OwnerProfile): Promise<AccountBlob>;
  /**
   * Record (or clear, when null) the owner's findable registration (doc 17): the
   * claimed name and the alias it resolves to. Pure persistence; the server-side
   * claim/release and the dedicated alias's lifecycle are driven a layer up
   * (findableOps), so this just writes the blob field after that has succeeded.
   */
  setFindable(
    root: RootKey,
    findable: FindableRegistration | null,
  ): Promise<AccountBlob>;
  /**
   * Record a findable claim atomically (doc 17): upsert the dedicated alias AND set
   * the registration in a SINGLE blob write, so there is no intermediate state where
   * the alias exists without its registration (which would surface it as a stray
   * public link). Called by findableOps after the server bind succeeds.
   */
  recordFindable(
    root: RootKey,
    alias: AliasRecord,
    findable: FindableRegistration,
  ): Promise<AccountBlob>;
  /**
   * Record (or clear, when null) the owner's recovery locator (doc 32): the name
   * their password-recovery envelope is stored under. Pure persistence; minting or
   * dropping the server-side envelope is driven a layer up (recoveryOps), so this
   * just writes the blob field after that has succeeded.
   */
  setRecoveryName(root: RootKey, name: string | null): Promise<AccountBlob>;
  /**
   * Enforce link expiry on load: revoke + drop any links (aliases or contact
   * links) past their expiry, then persist. A no-op (no write) when nothing is
   * expired. No republish, the badge is unchanged. This closes the passive-owner
   * gap so expiry no longer waits for the next setOwnerState.
   */
  sweepExpiredLinks(root: RootKey): Promise<AccountBlob>;
}

// A brand-new account: empty links, default avatar, private (link) sharing. The
// notify inbox is no longer account-level; each contact gets its own at link time
// (doc 13). Onboarding updates the avatar and sharing default via setProfile. The
// recovery phrase is stored in the (encrypted) blob so Settings can re-view it later
// (doc 32); it is the same phrase shown once at sign-up, kept only inside this vault.
function freshBlob(recoveryPhrase: string, handle?: string): AccountBlob {
  return {
    ...(handle ? { handle } : {}),
    aliases: [],
    contacts: [],
    state: INITIAL_OWNER_STATE,
    avatar: DEFAULT_AVATAR,
    sharingMode: "link",
    recoveryPhrase,
  };
}

// Apply a profile edit's optional local display name to a blob. `undefined` leaves
// the existing name untouched (the avatar-only edit path); `null` or "" clears it
// (omit the key, never store ""); a string sets it, validated like create() so a
// bad value can't seal fine and then throw on the next parseAccountBlob.
function applyProfileName(
  blob: AccountBlob,
  handle: string | null | undefined,
): AccountBlob {
  if (handle === undefined) return blob;
  if (handle === "" || handle === null) {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { handle: _drop, ...rest } = blob;
    return rest;
  }
  if (!isValidHandle(handle)) throw new Error("setProfile: invalid handle");
  return { ...blob, handle };
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

// Set or clear the optional recovery locator (doc 32). Like withFindable, a clear
// (null) deletes the key off a fresh copy rather than writing `recoveryName:
// undefined` (exactOptionalPropertyTypes).
function withRecoveryName(blob: AccountBlob, name: string | null): AccountBlob {
  if (name !== null) return { ...blob, recoveryName: name };
  const next = { ...blob };
  delete (next as { recoveryName?: string }).recoveryName;
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
  root: RootKey,
  fn: (blob: AccountBlob) => AccountBlob,
) => Promise<AccountBlob>;

// The findable (vanity-name) account mutations, split out so createAccountManager
// stays within its length ceiling. Pure persistence over `modify`; the server-side
// claim/release lives a layer up (findableOps).
function findableMethods(
  modify: BlobModify,
): Pick<AccountManager, "setFindable" | "recordFindable" | "setRecoveryName"> {
  return {
    setFindable: (root, findable) =>
      modify(root, (blob) => withFindable(blob, findable)),
    recordFindable: (root, alias, findable) =>
      modify(root, (blob) => withFindableAlias(blob, alias, findable)),
    setRecoveryName: (root, name) =>
      modify(root, (blob) => withRecoveryName(blob, name)),
  };
}

// Account lifecycle (mint + recover), split out so createAccountManager stays
// within its length ceiling. Both derive the root from an app-generated phrase:
// create mints one; recover validates the entered phrase against the app format
// (parseRecoveryPhrase) so a malformed one fails closed instead of deriving a key
// from arbitrary text.
function lifecycleMethods(
  api: ApiClient,
  sync: AccountSync,
): Pick<AccountManager, "create" | "recover" | "loadByRoot"> {
  return {
    loadByRoot: (root) => sync.load(root),
    async create(handle, recovery) {
      // Validate when set: an invalid handle would seal fine but throw on
      // parseAccountBlob during recovery, locking the owner out.
      if (handle !== undefined && !isValidHandle(handle)) {
        throw new Error("create: invalid handle");
      }
      const recoveryPhrase = randomRecoveryPhrase();
      // Keep the transient root bytes so an at-sign-up password can wrap them with
      // no phrase re-entry (doc 32), then import them into the non-extractable root
      // key (doc 24). The raw bytes are dropped at the end of this scope: no layer
      // below holds them, and they never outlive create.
      const rootBytes = await deriveRootKey(recoveryPhrase);
      const root = await importRootKey(rootBytes);
      let blob = freshBlob(recoveryPhrase, handle);
      // Wrap + store the optional password envelope BEFORE the account save, so a
      // "set" outcome folds the recovery name into the SAME blob write (one save, no
      // name-without-envelope gap). A failed optional step never blocks the account:
      // the name is null, the blob is unchanged, and the account is still created.
      const rec =
        recovery !== undefined
          ? await wrapSignUpRecovery(api, { rootBytes, root, recovery })
          : undefined;
      if (rec?.recoveryName != null)
        blob = { ...blob, recoveryName: rec.recoveryName };
      await sync.save(root, blob);
      return {
        recoveryPhrase,
        root,
        blob,
        ...(rec !== undefined ? { recoveryOutcome: rec.outcome } : {}),
      };
    },
    async recover(phrase) {
      const parsed = parseRecoveryPhrase(phrase);
      if (parsed === null) return null;
      const root = await importRootKey(await deriveRootKey(parsed));
      const blob = await sync.load(root);
      if (blob === null) return null;
      // Backfill the stored phrase for accounts created before it was kept in the
      // blob (doc 32): a successful phrase login is the one moment the phrase is
      // known, so persist it now (into the same encrypted blob) so Settings can
      // re-view it. A no-op when it is already stored.
      if (blob.recoveryPhrase === undefined) {
        const next: AccountBlob = { ...blob, recoveryPhrase: parsed };
        await sync.save(root, next);
        return { root, blob: next };
      }
      return { root, blob };
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
    root: RootKey,
    fn: (blob: AccountBlob) => AccountBlob,
  ): Promise<AccountBlob> => {
    const blob = await sync.load(root);
    if (blob === null) {
      throw new Error("account does not exist for this key");
    }
    const next = fn(blob);
    await sync.save(root, next);
    return next;
  };

  return {
    ...lifecycleMethods(api, sync),

    addAlias(root, record) {
      // Upsert by id so a lost-response retry does not record the alias twice
      // (which would orphan a write token and leave a link live after a revoke).
      return modify(root, (blob) => ({
        ...blob,
        aliases: [...blob.aliases.filter((a) => a.id !== record.id), record],
      }));
    },

    removeAlias(root, id) {
      return modify(root, (blob) => ({
        ...blob,
        aliases: blob.aliases.filter((a) => a.id !== id),
      }));
    },

    addContact(root, contact) {
      return modify(root, (blob) => ({
        ...blob,
        contacts: [
          ...blob.contacts.filter((c) => c.id !== contact.id),
          contact,
        ],
      }));
    },

    removeContact(root, contactId) {
      return modify(root, (blob) => withContactRemoved(blob, contactId));
    },

    upsertCircle(root, circle) {
      return modify(root, (blob) => withCircleUpserted(blob, circle));
    },

    removeCircle(root, circleId) {
      return modify(root, (blob) => withCircleRemoved(blob, circleId));
    },

    async deleteAccount(root) {
      const blob = await sync.load(root);
      // Revoke every alias AND every per-contact link FIRST (overwrite each to
      // undecryptable bytes) so nothing can resolve after the account is gone;
      // only then drop the blob. A failed revoke leaves the blob for a retry.
      if (blob !== null) {
        const all = [...blob.aliases, ...blob.contacts.map((c) => c.alias)];
        await Promise.all(all.map((a) => revokeAlias(api, a)));
      }
      await sync.remove(root);
    },

    async setOwnerState(root, state) {
      // Guard at write time, symmetric to the strict read: persisting an invalid
      // state would brick the account on the next load (parse fails closed).
      if (!isOwnerState(state)) {
        throw new Error("setOwnerState: invalid state");
      }
      const blob = await sync.load(root);
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
        await sync.save(root, swept);
        await republishLiveLinks(api, swept, nowDay);
        return swept;
      } catch {
        // Offline, or a server step failed. If the sweep already completed, keep its
        // pruned result (never the pre-sweep blob, which would resurrect the revoked
        // links); otherwise fall back to a state-only durable save that lets expired
        // links linger (doc 16, the genuinely-offline case). Either way the state
        // change is durable and the reconnect drain re-runs sweep + republish.
        const next: AccountBlob = swept ?? { ...blob, state };
        await sync.save(root, next);
        return next;
      }
    },

    async sweepExpiredLinks(root) {
      const blob = await sync.load(root);
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
      await sync.save(root, next);
      return next;
    },

    async setProfile(root, profile) {
      // Guard at write time, symmetric to the strict read, so a bad profile
      // cannot brick the account on the next load.
      if (!isAvatarConfig(profile.avatar)) {
        throw new Error("setProfile: invalid avatar");
      }
      if (!isSharingMode(profile.sharingMode)) {
        throw new Error("setProfile: invalid sharingMode");
      }
      const blob = await sync.load(root);
      if (blob === null) {
        throw new Error("setProfile: no account exists for this key");
      }
      const next: AccountBlob = {
        ...applyProfileName(blob, profile.handle),
        avatar: profile.avatar,
        sharingMode: profile.sharingMode,
        ...(profile.homeDefaultView !== undefined
          ? { homeDefaultView: profile.homeDefaultView }
          : {}),
      };
      await sync.save(root, next);
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
