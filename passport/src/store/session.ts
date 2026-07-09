/**
 * The owner's app session: the composition that onboarding, login, recovery, and
 * reload drive. It ties the account lifecycle (AccountManager, on AccountSync) to
 * the two key sources, with the recovery PHRASE as the root and a passkey as an
 * optional SECOND credential over the same account.
 *
 * Recovery model (locked, doc 11): an account is always created from a generated
 * phrase, so it is always phrase-recoverable. enrollPasskey wraps the existing
 * root under the passkey's PRF output and stores `{ credentialId, wrappedRoot }`
 * locally; resume() unwraps it on reload. There is no path that creates an account
 * from a passkey alone, so a passkey loss can never lock the owner out.
 *
 * The session carries the root in memory (needed to mutate owner state); it is
 * never persisted. Reload without an enrolled passkey returns null here, and the
 * owner re-enters the phrase.
 */

import {
  bytesToBase64url,
  parseRecoveryPhrase,
  deriveRootKey,
  type RootKey,
} from "../crypto/index.ts";
import { wrapRoot } from "../auth/keyVault.ts";
import type { PasskeyAuth } from "../auth/passkey.ts";
import {
  unlockRoot,
  hasPasskeyBinding,
  verifyPasskeyPresence,
  type ResumeFailure,
} from "./passkeyUnlock.ts";
import type { DeviceStore } from "../auth/deviceStore.ts";
import type { RootKeyStore } from "../auth/rootKeyStore.ts";
import type { ApiClient, PendingKnock } from "../api/client.ts";
import type {
  AccountManager,
  OwnerProfile,
  SignUpRecovery,
  SignUpRecoveryOutcome,
} from "./account.ts";
import type { AccountSync } from "./accountSync.ts";
import {
  type AccountBlob,
  type AliasRecord,
  type ContactRecord,
} from "./accountBlob.ts";
import {
  addCircle,
  editCircle,
  dropCircle,
  type CircleCreated,
} from "./circleOps.ts";
import type { ContactInvite } from "./contactInvite.ts";
import type { NotifyLockResult } from "./partnerNotify.ts";
import { notifyPositive, pollPartnerNudge } from "./notifyOps.ts";
import { gatherKnocks, grantPending, type GrantMode } from "./knockOps.ts";
import type { OwnerState } from "../core/badge.ts";
import { revokeAlias } from "./publish.ts";
import type { AliasIdentity } from "./ownerCard.ts";
import type { AvatarConfig } from "../lib/avatars.ts";
import {
  mintContactLink,
  acceptContactInvite,
  ingestContactReturn,
  completeInPersonContact,
  renameContactLabel,
  revokeContactLink,
  revokeAliasLink,
  setShareLinkExpiry,
  shareLinkFor,
  type RevealChoice,
  type ContactLinkOpts,
} from "./shareOps.ts";
import {
  primaryShareAlias,
  registerVanityName,
  releaseVanityName,
  checkVanityName,
  type VanityRegisterOutcome,
} from "./findableOps.ts";
import {
  createGroup,
  type CreateGroupInput,
  type GroupCreated,
} from "./groupOps.ts";
import {
  groupMembershipControllerMethods,
  type GroupMembershipController,
} from "./groupMembershipController.ts";
import {
  recoveryControllerMethods,
  type SetRecoveryPasswordInput,
  type SetRecoveryPasswordResult,
} from "./recoveryOps.ts";

/**
 * An unlocked session: the root and the loaded account. The root is a
 * non-extractable {@link RootKey} (doc 24): it derives the account id, blob key,
 * and write token but can never be exported as raw bytes, so it is safe to persist
 * for resume (see rootKeyStore).
 */
export interface OwnerSession {
  readonly root: RootKey;
  readonly blob: AccountBlob;
}

export interface SignUpResult {
  readonly session: OwnerSession;
  /** Shown once at signup; the only way back in. Never persisted. */
  readonly recoveryPhrase: string;
  /**
   * The outcome of the optional at-sign-up password step (doc 32), or undefined
   * when none was requested. The account is always created and phrase/passkey-
   * recoverable regardless; a non-"set" value means only the password step did not
   * land (e.g. the chosen Username is taken), so the UI can retry or skip without
   * losing the account.
   */
  readonly recoveryOutcome?: SignUpRecoveryOutcome;
}

export type { ResumeFailure } from "./passkeyUnlock.ts";
export type { GrantMode } from "./knockOps.ts";

export type ResumeResult =
  | { readonly ok: true; readonly session: OwnerSession }
  | { readonly ok: false; readonly reason: ResumeFailure };

export interface SessionController extends GroupMembershipController {
  /**
   * First run: mint a phrase-recoverable account. Persists nothing locally. When
   * `recovery` (a Username + password) is given, also wraps the fresh in-memory root
   * under the password and stores the envelope at the Username on the spot (doc 32,
   * no phrase re-entry). The account is always created regardless; a taken Username
   * surfaces as `SignUpResult.recoveryOutcome`, never an account-creation failure.
   */
  signUp(handle?: string, recovery?: SignUpRecovery): Promise<SignUpResult>;
  /** Login / recovery by phrase. null when no account exists for it. */
  recover(phrase: string): Promise<OwnerSession | null>;
  /**
   * New-device unlock by recovery name + password (doc 32): fetch and open the
   * password envelope, recover the root, and load the account. null on any failure
   * (unknown name, wrong password, no account), so the form shows one uniform message.
   */
  recoverByPassword(
    name: string,
    password: string,
  ): Promise<OwnerSession | null>;
  /**
   * Reload: unlock via the enrolled passkey and load the account. Returns a
   * tagged result so login can show a true message: `ok` with the session, or a
   * {@link ResumeFailure} reason (no binding on this device, the passkey was
   * cancelled/unavailable/can't-do-PRF, or the binding did not unwrap). Always
   * fail-closed: the device binding is left intact on any failure.
   */
  resume(): Promise<ResumeResult>;
  /**
   * Keep this device signed in across reloads (doc 24): persist the session's
   * non-extractable root so {@link resumeFromStore} can rebuild the session with
   * no passkey and no phrase. The root cannot be exported as bytes, so a stored
   * key can be used on this device but never copied out.
   */
  rememberDevice(session: OwnerSession): Promise<void>;
  /** Forget the persisted root (logout / the "keep me signed in" toggle off). */
  forgetDevice(): Promise<void>;
  /**
   * Silent resume from the persisted root (doc 24): if this device has a stored
   * key and an account blob still loads for it, return the session. null when no
   * key is stored or no blob loads (a deleted account). No passkey, no phrase.
   */
  resumeFromStore(): Promise<OwnerSession | null>;
  /**
   * Bind a passkey to this account so reload can resume without the phrase. The
   * passkey wrap needs raw root key bytes, which the non-extractable session root
   * cannot give back (doc 24), so enroll re-derives them from the recovery phrase
   * (held during onboarding to show at step 2), wraps them, stores only
   * `{ credentialId, wrappedRoot }`, and drops the bytes. Throws (fail-closed)
   * if the phrase is not a well-formed app phrase, so it never wraps a bad key.
   */
  enrollPasskey(phrase: string, userName: string): Promise<void>;
  /**
   * Persist a profile change (avatar + sharing default) and return the session
   * with the updated account blob.
   */
  setProfile(
    session: OwnerSession,
    profile: OwnerProfile,
  ): Promise<OwnerSession>;
  /**
   * Enforce link expiry on the current session: revoke + drop any alias/contact
   * link past its expiry, then return the session with the survivors. A no-op (no
   * write) when nothing is expired. Mirrors the load-time sweep so an app left open
   * across an expiry instant doesn't keep a dead link live until the next reload.
   */
  sweepExpiredLinks(session: OwnerSession): Promise<OwnerSession>;
  /**
   * Re-seal every still-live link's card at today's day (republish-on-open, doc 02),
   * so a snapshot that has aged out of or into blue is brought current for viewers
   * without waiting for the owner's next edit. Read-only on the blob, so it returns
   * nothing; best-effort at the call site.
   */
  refreshLiveLinks(session: OwnerSession): Promise<void>;
  /**
   * Persist a new owner state (a reported result, a pause), republish every
   * alias so the badge propagates, and return the session with the updated blob.
   */
  setOwnerState(
    session: OwnerSession,
    state: OwnerState,
  ): Promise<OwnerSession>;
  /**
   * Produce a shareable link to the owner's current card. Reuses the account's
   * primary alias (republishing the current card to it so the link stays fresh)
   * or mints one on first share and records it. Returns the (possibly updated)
   * session and the URL.
   */
  shareLink(
    session: OwnerSession,
    identity?: AliasIdentity,
    avatarOverride?: AvatarConfig,
  ): Promise<ShareLinkResult>;
  /**
   * Revoke the link for the current sharing mode (the old URL stops resolving to
   * any status) and mint a fresh one for the same card. "Revoke" is no future
   * reads, not "unsee" (doc 01). Returns the updated session and the new URL. A
   * no-op-with-mint when no alias exists yet (just produces a first link).
   */
  renewLink(
    session: OwnerSession,
    identity?: AliasIdentity,
    avatarOverride?: AvatarConfig,
  ): Promise<ShareLinkResult>;
  /**
   * Set how long the private link keeps working (doc 16): re-publish the current
   * private-link alias with a new expiry so the server stops answering for it once
   * it lapses. `durationMs` is counted from now; null keeps it working until the
   * owner turns it off. A no-op in public mode (a public profile never lapses) or
   * when no private link exists yet. Returns the (possibly updated) session.
   */
  setShareLinkExpiry(
    session: OwnerSession,
    durationMs: number | null,
  ): Promise<OwnerSession>;
  /**
   * Permanently delete the account: revoke every shared link and remove the
   * account blob, then forget this device's passkey binding. After this the
   * recovery phrase no longer recovers anything (the blob is gone).
   */
  deleteAccount(session: OwnerSession): Promise<void>;
  /**
   * Owner-pull knock review across all the owner's aliases (each queried with its
   * write token) in ONE sweep: the total `count` of current knocks (contentless,
   * never who) plus the grantable `pending` ones (those that carried an ephemeral
   * key), each tagged with the alias they landed on so {@link approveKnocks} can
   * seal that alias's key to them. Best-effort per alias: an unreachable one
   * contributes nothing rather than erroring the inbox.
   */
  reviewKnocks(session: OwnerSession): Promise<OwnerKnocks>;
  /**
   * Approve grantable knocks via the in-app grant slot (doc 13). `mode` chooses what
   * each requester gets: "standing" seals the alias key so they keep re-checking the
   * owner's live status until it is revoked; "once" seals a frozen snapshot of the
   * current card so they see the status this once with no live access. Idempotent and
   * re-runnable; a partial failure leaves the rest granted and the failed one still
   * pending for a retry. Returns how many grants were written.
   */
  approveKnocks(
    session: OwnerSession,
    approvals: PendingApproval[],
    mode: GrantMode,
  ): Promise<number>;
  /**
   * Mint a fresh PRIVATE link for one specific contact (a named, individually
   * revocable link), publish the current card to it, and record it. The owner
   * picks the face and the lifetime at mint time (`expiresAt` is an absolute
   * epoch-ms instant, or null for until-revoked, doc 16); revoking always cuts
   * it off immediately. Returns the session, the new contact, and the URL.
   */
  createContactLink(
    session: OwnerSession,
    label: string,
    opts?: ContactLinkOpts,
  ): Promise<ContactLinkResult>;
  /**
   * Rename one contact's local label (the owner-only nickname). Purely local: the
   * link and its published card are untouched, so the recipient sees no change.
   * An empty label clears it back to the placeholder. A no-op if the id is unknown.
   */
  renameContact(
    session: OwnerSession,
    contactId: string,
    label: string,
  ): Promise<OwnerSession>;
  /**
   * Revoke one contact's link (its old URL stops resolving) and drop the record.
   * A no-op if the contact id is unknown. Returns the updated session.
   */
  revokeContact(
    session: OwnerSession,
    contactId: string,
  ): Promise<OwnerSession>;
  /**
   * Revoke one published alias (a public/casual link) by id: its URL stops
   * resolving and the record is dropped. A no-op if unknown. Returns the session.
   */
  revokeAlias(session: OwnerSession, aliasId: string): Promise<OwnerSession>;
  /**
   * Accept a contact invite (doc 13 path A): mint and publish my own alias for the
   * inviter, record a complete two-way contact, and return a RETURN invite to send
   * back so the inviter can complete their side.
   */
  acceptContactInvite(
    session: OwnerSession,
    invite: ContactInvite,
    label: string,
    reveal?: RevealChoice,
  ): Promise<ContactLinkResult>;
  /**
   * Ingest a return invite, completing the pending contact it answers. A no-op
   * (unchanged session) when nothing matches. Returns the updated session.
   */
  ingestContactReturn(
    session: OwnerSession,
    ret: ContactInvite,
  ): Promise<OwnerSession>;
  /** Complete the in-person linkup's pending contact with the scanned offer
   * (doc 25). A no-op when the contact is unknown or already complete. */
  completeInPersonLinkup(
    session: OwnerSession,
    contactId: string,
    invite: ContactInvite,
  ): Promise<OwnerSession>;
  /**
   * Silently notify everyone a reported positive implies was exposed: every linked
   * contact (doc 13) AND every co-member of every group the owner is in (doc 33),
   * as one merged batch of contentless pings, each with a queued wake. Group pings
   * are never attributed to the group or the reporter, and a co-member who is also a
   * pairwise contact is pinged once. The reporter chooses nothing and this is never
   * surfaced at the report moment; it just happens. Returns the per-inbox outcome
   * (the caller ignores it). A no-op for contacts/groups not yet notifiable.
   */
  notifyContactsOfPositive(session: OwnerSession): Promise<NotifyLockResult>;
  /**
   * Poll this device's own notify inbox for a partner-notify ping (the recipient
   * side of {@link notifyContactsOfPositive}). True when a contact has flagged a
   * positive; the ping is contentless, so this never reveals who. False when the
   * inbox is empty, undecodable, unreachable, or not yet minted (all uniform).
   */
  hasPartnerNudge(session: OwnerSession): Promise<boolean>;
  /**
   * Create a circle (doc 13 slice 6): a private, local grouping of contacts under
   * a name. Members are normalized against current contacts. Purely client-side;
   * the server never learns a circle exists. Returns the new circle id + session.
   */
  createCircle(
    session: OwnerSession,
    name: string,
    memberContactIds: string[],
  ): Promise<CircleCreated>;
  /** Rename a circle and/or change its members (same id). Returns the session. */
  updateCircle(
    session: OwnerSession,
    circleId: string,
    name: string,
    memberContactIds: string[],
  ): Promise<OwnerSession>;
  /** Delete one circle by id (a local grouping; contacts are untouched). */
  removeCircle(session: OwnerSession, circleId: string): Promise<OwnerSession>;
  /**
   * Claim a public findable name (doc 17): mint + publish a dedicated alias, bind
   * the name to it server-side, and on success record both in the account. Returns
   * the (possibly updated) session and the outcome ("registered" / "unavailable" /
   * "error"); only "registered" changes the session. `name` must be normalized +
   * valid (the UI checks first; the server enforces too). Rejects only on an
   * unexpected error, not on the expected "unavailable".
   */
  registerVanityName(
    session: OwnerSession,
    name: string,
  ): Promise<VanityRegisterOutcome>;
  /**
   * Look up whether a findable name is free, WITHOUT claiming it, so the UI can
   * tell the owner as they type. `"taken"` when the name already resolves,
   * `"free"` when it doesn't, `"error"` when the lookup couldn't run. Reserved /
   * blocked names are caught locally / at register; this only answers "taken".
   */
  checkVanityName(name: string): Promise<"free" | "taken" | "error">;
  /**
   * Release one of the owner's claimed findable names: drop the server binding (into
   * the 24h lock), revoke its dedicated alias, and clear the registration. A no-op
   * when `name` is not one the owner holds. Returns the updated session.
   */
  releaseVanityName(session: OwnerSession, name: string): Promise<OwnerSession>;
  /**
   * Create a shared group (doc 33): mint the group key, publish the creator's own
   * group card sealed under it, write the group blob, and, for a public group,
   * claim the handle to a dedicated join pointer. In v1 the creator is the sole
   * admin and the only member. `input.handle` must be a valid vanity-shaped handle
   * (rejected before any network call). Returns the updated session, the group id,
   * and the outcome (whether a public handle was actually claimed); a group is
   * created even when a public handle could not be claimed.
   */
  createGroup(
    session: OwnerSession,
    input: CreateGroupInput,
  ): Promise<GroupCreated>;
  /**
   * Turn the optional password factor on, or change it (doc 32). Wraps the account
   * root under `password` and stores the envelope at the owner-chosen recovery
   * `name`, then records that name so it can be re-viewed and turned off. Requires
   * the recovery `phrase`: the session root is non-extractable (doc 24), so the raw
   * bytes are re-derived from the phrase, which also proves the phrase names this
   * account. Returns the outcome; only "set" advances the session.
   */
  setRecoveryPassword(
    session: OwnerSession,
    input: SetRecoveryPasswordInput,
  ): Promise<SetRecoveryPasswordResult>;
  /**
   * Turn the password factor off (doc 32): drop the stored envelope and clear the
   * recovery name. A no-op when no password is set. The phrase and passkey remain.
   */
  disableRecoveryPassword(session: OwnerSession): Promise<OwnerSession>;
  /**
   * Whether a passkey is enrolled on this device (doc 32). A pure local read, no
   * authenticator prompt, so a caller (the phrase re-view gate) can decide whether
   * to require a presence check before revealing the phrase.
   */
  passkeyEnrolled(): boolean;
  /**
   * A "confirm it's you" presence check against the enrolled passkey (doc 32):
   * run the WebAuthn assertion (biometric / user verification) and resolve true
   * only on success. It never unwraps the root, imports a key, or changes the live
   * session, so it is a pure yes/no gate, safe to run mid-session. Resolves false
   * when no passkey is bound here or the prompt is cancelled / unavailable.
   */
  verifyPasskey(): Promise<boolean>;
  /** Forget this device's passkey binding. The phrase still recovers. */
  forget(): void;
}

export interface ContactLinkResult {
  readonly session: OwnerSession;
  readonly contact: ContactRecord;
  readonly url: string;
}

export interface ShareLinkResult {
  readonly session: OwnerSession;
  readonly url: string;
}

/** A waiting knock the owner can grant: the requester's pending entry plus the
 * alias it landed on (whose read key gets sealed to them on approve). */
export interface PendingApproval {
  readonly alias: AliasRecord;
  readonly pending: PendingKnock;
}

/** One owner-pull knock review: the contentless total count plus the grantable
 * pending knocks. `count >= pending.length` (some knocks carry no key). */
export interface OwnerKnocks {
  readonly count: number;
  readonly pending: PendingApproval[];
}

export interface SessionDeps {
  readonly accounts: AccountManager;
  readonly sync: AccountSync;
  readonly devices: DeviceStore;
  readonly passkey: PasskeyAuth;
  /** Persists the root for silent resume across reloads (doc 24). */
  readonly keys: RootKeyStore;
  /** Transport for publishing/republishing the owner's shareable alias. */
  readonly api: ApiClient;
}

// Enforce link expiry on load, best-effort (closes the passive-owner gap). A
// sweep failure falls back to the already-loaded blob, so a network blip never
// blocks login; expiry is re-attempted on the next load.
async function sweptOnLoad(
  accounts: AccountManager,
  root: RootKey,
  fallback: AccountBlob,
): Promise<AccountBlob> {
  return accounts.sweepExpiredLinks(root).catch(() => fallback);
}

// The thin blob-folding controller delegators: each calls the matching account
// mutation and wraps the resulting blob back into the session. Split out so
// createSessionController stays within its length ceiling.
function blobMethods(
  accounts: AccountManager,
): Pick<
  SessionController,
  "setProfile" | "setOwnerState" | "sweepExpiredLinks" | "refreshLiveLinks"
> {
  return {
    setProfile: async (session, profile) => ({
      root: session.root,
      blob: await accounts.setProfile(session.root, profile),
    }),
    setOwnerState: async (session, state) => ({
      root: session.root,
      blob: await accounts.setOwnerState(session.root, state),
    }),
    sweepExpiredLinks: async (session) => ({
      root: session.root,
      blob: await accounts.sweepExpiredLinks(session.root),
    }),
    // Read-only on the blob (the badge is derived), so it folds nothing back.
    refreshLiveLinks: (session) => accounts.refreshLiveLinks(session.root),
  };
}

// The reload + passkey-gate paths, split out so createSessionController stays under
// its length ceiling. resume() unlocks via the enrolled passkey; resumeFromStore()
// uses the persisted non-extractable root (doc 24); rememberDevice/forgetDevice
// manage that store (the "keep me signed in" toggle + logout); passkeyEnrolled +
// verifyPasskey are the phrase re-view gate's presence check (doc 32), which shares
// the same devices + passkey layer but never touches the session.
function resumeMethods(
  deps: SessionDeps,
): Pick<
  SessionController,
  | "resume"
  | "rememberDevice"
  | "forgetDevice"
  | "resumeFromStore"
  | "passkeyEnrolled"
  | "verifyPasskey"
> {
  const { accounts, sync, devices, passkey, keys } = deps;
  return {
    passkeyEnrolled: () => hasPasskeyBinding(devices),
    verifyPasskey: () => verifyPasskeyPresence(devices, passkey),
    async resume(): Promise<ResumeResult> {
      const unlocked = await unlockRoot(devices, passkey);
      if (!unlocked.ok) return { ok: false, reason: unlocked.reason };
      const blob = await sync.load(unlocked.root);
      if (blob === null) return { ok: false, reason: "no-account" };
      return {
        ok: true,
        session: {
          root: unlocked.root,
          blob: await sweptOnLoad(accounts, unlocked.root, blob),
        },
      };
    },
    rememberDevice(session) {
      return keys.save(session.root);
    },
    forgetDevice() {
      return keys.clear();
    },
    async resumeFromStore() {
      const root = await keys.load();
      if (root === null) return null;
      const blob = await sync.load(root);
      if (blob === null) return null;
      return { root, blob: await sweptOnLoad(accounts, root, blob) };
    },
  };
}

export function createSessionController(deps: SessionDeps): SessionController {
  const { accounts, devices, passkey, keys, api } = deps;

  return {
    async signUp(handle, recovery) {
      const { root, blob, recoveryPhrase, recoveryOutcome } =
        await accounts.create(handle, recovery);
      return {
        session: { root, blob },
        recoveryPhrase,
        ...(recoveryOutcome !== undefined ? { recoveryOutcome } : {}),
      };
    },

    async recover(phrase) {
      const r = await accounts.recover(phrase);
      if (r === null) return null;
      return {
        root: r.root,
        blob: await sweptOnLoad(accounts, r.root, r.blob),
      };
    },

    ...resumeMethods(deps),

    async enrollPasskey(phrase, userName) {
      // Re-derive the transient root key bytes from the recovery phrase: the
      // session root is non-extractable and cannot be wrapped (doc 24). A
      // malformed phrase fails closed (no enroll), so a bad key is never wrapped.
      const parsed = parseRecoveryPhrase(phrase);
      if (parsed === null) {
        throw new Error("enrollPasskey: malformed recovery phrase");
      }
      const bytes = await deriveRootKey(parsed);
      const { credentialId, prfOutput, transports } =
        await passkey.enroll(userName);
      const wrapped = await wrapRoot(bytes, prfOutput);
      devices.save({
        credentialId,
        wrappedRoot: bytesToBase64url(wrapped),
        ...(transports ? { transports } : {}),
      });
    },

    ...blobMethods(accounts),

    shareLink(session, identity = "anonymous", avatarOverride) {
      return shareLinkFor(api, accounts, session, { identity, avatarOverride });
    },

    async renewLink(session, identity = "anonymous", avatarOverride) {
      const existing = primaryShareAlias(session.blob);
      let working = session;
      if (existing !== undefined) {
        // Kill the old payload first, then drop the record. Order matters: if the
        // record were dropped first and the revoke then failed, the old link would
        // keep resolving with no capability left to revoke it.
        await revokeAlias(api, existing);
        const blob = await accounts.removeAlias(session.root, existing.id);
        working = { root: session.root, blob };
      }
      // Mint a fresh link for the current card (this is now the only alias for
      // the mode, since the old record is gone).
      return shareLinkFor(api, accounts, working, { identity, avatarOverride });
    },

    setShareLinkExpiry: (session, durationMs) =>
      setShareLinkExpiry(api, accounts, session, durationMs),

    async deleteAccount(session) {
      // Best-effort: drop every public findable binding first (doc 17) so no name
      // lingers claimed after the account is gone (the aliases are revoked below).
      for (const reg of session.blob.findables ?? []) {
        const alias = session.blob.aliases.find((a) => a.id === reg.aliasId);
        const done = alias && api.releaseVanityName(reg.name, alias.writeToken);
        if (done) await done.catch(() => undefined);
      }
      // Wipe the local resumable key material FIRST (doc 24): if the server delete
      // below throws (a transient blip mid-revoke), the device must still be left
      // un-resumable rather than silently resuming into an account the owner believes
      // is gone. The server delete is retryable; the local wipe protects this device.
      devices.clear();
      await keys.clear();
      await accounts.deleteAccount(session.root);
    },

    reviewKnocks: (session) => gatherKnocks(api, session),

    // The session carries the owner's live state, needed to build a card snapshot for
    // a one-time grant; a standing grant seals only the alias key.
    approveKnocks: (session, approvals, mode) =>
      grantPending(api, session, approvals, mode),

    createContactLink: (session, label, opts = {}) =>
      mintContactLink(api, accounts, session, { label, ...opts }),

    renameContact: (session, contactId, label) =>
      renameContactLabel(accounts, session, { contactId, label }),

    revokeContact: (session, contactId) =>
      revokeContactLink(api, accounts, session, contactId),

    revokeAlias: (session, aliasId) =>
      revokeAliasLink(api, accounts, session, aliasId),

    acceptContactInvite(session, invite, label, reveal) {
      return acceptContactInvite(api, accounts, session, {
        invite,
        label,
        identity: reveal?.identity ?? "anonymous",
        avatarOverride: reveal?.avatarOverride,
      });
    },

    ingestContactReturn: (session, ret) =>
      ingestContactReturn(accounts, session, ret),

    completeInPersonLinkup: (session, contactId, invite) =>
      completeInPersonContact(accounts, session, { contactId, invite }),

    notifyContactsOfPositive: (session) =>
      notifyPositive(api, accounts, session),

    hasPartnerNudge: (session) => pollPartnerNudge(api, session),

    createCircle: (session, name, memberContactIds) =>
      addCircle(accounts, session, name, memberContactIds),

    updateCircle: (session, circleId, name, memberContactIds) =>
      editCircle(accounts, session, { circleId, name, memberContactIds }),

    removeCircle: (session, circleId) =>
      dropCircle(accounts, session, circleId),

    registerVanityName: (session, name) =>
      registerVanityName(api, accounts, session, name),

    checkVanityName: (name) => checkVanityName(api, name),

    releaseVanityName: (session, name) =>
      releaseVanityName(api, accounts, session, name),
    createGroup: (s, input) => createGroup(api, accounts, s, input),

    ...groupMembershipControllerMethods(api, accounts),

    ...recoveryControllerMethods(api, accounts),

    forget: () => devices.clear(),
  };
}
