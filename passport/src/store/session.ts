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
import { unlockRoot, type ResumeFailure } from "./passkeyUnlock.ts";
import type { DeviceStore } from "../auth/deviceStore.ts";
import type { RootKeyStore } from "../auth/rootKeyStore.ts";
import type { ApiClient, PendingKnock } from "../api/client.ts";
import type { AccountManager, OwnerProfile } from "./account.ts";
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
import { notifyLinkedContacts, pollPartnerNudge } from "./notifyOps.ts";
import { gatherKnocks, grantPending } from "./knockOps.ts";
import type { OwnerState } from "../core/badge.ts";
import { revokeAlias } from "./publish.ts";
import type { AliasIdentity } from "./ownerCard.ts";
import {
  mintContactLink,
  acceptContactInvite,
  ingestContactReturn,
  renameContactLabel,
  revokeContactLink,
  setContactLinkExpiry,
  revokeAliasLink,
  shareLinkFor,
  setShareLinkExpiry,
} from "./shareOps.ts";
import {
  primaryShareAlias,
  registerVanityName,
  releaseVanityName,
  type VanityRegisterOutcome,
} from "./findableOps.ts";
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
}

export type { ResumeFailure } from "./passkeyUnlock.ts";

export type ResumeResult =
  | { readonly ok: true; readonly session: OwnerSession }
  | { readonly ok: false; readonly reason: ResumeFailure };

export interface SessionController {
  /** First run: mint a phrase-recoverable account. Persists nothing locally. */
  signUp(handle?: string): Promise<SignUpResult>;
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
  ): Promise<ShareLinkResult>;
  /**
   * Change the share-sheet link's lifetime in place (doc 16): the link for the
   * current sharing mode keeps resolving, only its expiry moves. `durationMs` is
   * counted from now (so it can be sub-day); null means until-revoked. Re-PUTs the
   * card so the server enforces the new expiry. A no-op if no link exists yet.
   */
  setShareLinkDuration(
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
   * Approve grantable knocks: seal each alias's read key to the waiting requester
   * via the in-app grant slot (doc 13). Idempotent and re-runnable; a partial
   * failure leaves the rest granted and the failed one still pending for a retry.
   * Returns how many grants were written.
   */
  approveKnocks(
    session: OwnerSession,
    approvals: PendingApproval[],
  ): Promise<number>;
  /**
   * Mint a fresh PRIVATE link for one specific contact (a named, individually
   * revocable link), publish the current card to it, and record it. `durationMs`
   * sets the link's lifetime (ms from now, or null for until-revoked); omitted, it
   * defaults to the 7-day expiry. Returns the session, the new contact, and the URL.
   */
  createContactLink(
    session: OwnerSession,
    label: string,
    identity?: AliasIdentity,
    durationMs?: number | null,
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
   * Change one contact link's lifetime in place (extend or shorten): the same
   * link keeps resolving, only its expiry moves. `durationMs` is counted from now;
   * null means until-revoked. Re-PUTs so the server enforces it. No-op if unknown.
   */
  setContactDuration(
    session: OwnerSession,
    contactId: string,
    durationMs: number | null,
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
    identity?: AliasIdentity,
  ): Promise<ContactLinkResult>;
  /**
   * Ingest a return invite, completing the pending contact it answers. A no-op
   * (unchanged session) when nothing matches. Returns the updated session.
   */
  ingestContactReturn(
    session: OwnerSession,
    ret: ContactInvite,
  ): Promise<OwnerSession>;
  /**
   * Silently notify every linked contact that a positive was reported (doc 13):
   * write one contentless ping to each contact's inbox and queue a wake. The
   * reporter chooses nothing and this is never surfaced at the report moment; it
   * just happens. Returns the per-contact outcome (the caller ignores it). A no-op
   * for contacts with no notify capability yet.
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
   * Release the owner's claimed findable name: drop the server binding (into the
   * 24h lock), revoke the dedicated alias, and clear the registration. A no-op when
   * no name is claimed. Returns the updated session.
   */
  releaseVanityName(session: OwnerSession): Promise<OwnerSession>;
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
  "setProfile" | "setOwnerState" | "sweepExpiredLinks"
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
  };
}

// The reload paths, split out so createSessionController stays under its length
// ceiling. resume() unlocks via the enrolled passkey; resumeFromStore() uses the
// persisted non-extractable root (doc 24); rememberDevice/forgetDevice manage
// that store (the "keep me signed in" toggle + logout).
function resumeMethods(
  deps: SessionDeps,
): Pick<
  SessionController,
  "resume" | "rememberDevice" | "forgetDevice" | "resumeFromStore"
> {
  const { accounts, sync, devices, passkey, keys } = deps;
  return {
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
    async signUp(handle) {
      const created = await accounts.create(handle);
      return {
        session: { root: created.root, blob: created.blob },
        recoveryPhrase: created.recoveryPhrase,
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

    shareLink(session, identity = "anonymous") {
      return shareLinkFor(api, accounts, session, identity);
    },

    async renewLink(session, identity = "anonymous") {
      const wantPublic = session.blob.sharingMode === "public";
      const existing = primaryShareAlias(session.blob, wantPublic);
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
      return shareLinkFor(api, accounts, working, identity);
    },

    setShareLinkDuration: (session, durationMs) =>
      setShareLinkExpiry(api, accounts, session, durationMs),

    async deleteAccount(session) {
      // Best-effort: drop any public findable binding first (doc 17), so the name
      // does not linger claimed after the account is gone. The alias itself is
      // revoked by deleteAccount's revoke-all below. Never blocks deletion.
      const reg = session.blob.findable;
      const alias = reg
        ? session.blob.aliases.find((a) => a.id === reg.aliasId)
        : undefined;
      if (reg !== undefined && alias !== undefined) {
        await api
          .releaseVanityName(reg.name, alias.writeToken)
          .catch(() => undefined);
      }
      // Wipe the local resumable key material FIRST (doc 24): a deleted account
      // must leave no resumable key, and these clears are local and cheap. If the
      // server-side delete below throws (a transient network blip mid-revoke), the
      // device must still be left un-resumable, not silently resume into an account
      // the owner believes is gone. The server delete is retryable; the local wipe
      // is the part that protects this device, so it can't be gated on the network.
      devices.clear();
      await keys.clear();
      await accounts.deleteAccount(session.root);
    },

    reviewKnocks(session) {
      return gatherKnocks(api, session);
    },

    // The approvals already carry their alias + key, so the session is only in the
    // signature for symmetry with the other owner actions.
    approveKnocks(_session, approvals) {
      return grantPending(api, approvals);
    },

    createContactLink(session, label, identity = "anonymous", durationMs) {
      return mintContactLink(api, accounts, session, {
        label,
        identity,
        durationMs,
      });
    },

    renameContact: (session, contactId, label) =>
      renameContactLabel(accounts, session, { contactId, label }),

    revokeContact: (session, contactId) =>
      revokeContactLink(api, accounts, session, contactId),

    setContactDuration: (session, contactId, durationMs) =>
      setContactLinkExpiry(api, accounts, session, { contactId, durationMs }),

    revokeAlias: (session, aliasId) =>
      revokeAliasLink(api, accounts, session, aliasId),

    acceptContactInvite(session, invite, label, identity = "anonymous") {
      return acceptContactInvite(api, accounts, session, {
        invite,
        label,
        identity,
      });
    },

    ingestContactReturn(session, ret) {
      return ingestContactReturn(accounts, session, ret);
    },

    notifyContactsOfPositive: (session) => notifyLinkedContacts(api, session),

    hasPartnerNudge: (session) => pollPartnerNudge(api, session),

    createCircle: (session, name, memberContactIds) =>
      addCircle(accounts, session, name, memberContactIds),

    updateCircle: (session, circleId, name, memberContactIds) =>
      editCircle(accounts, session, { circleId, name, memberContactIds }),

    removeCircle: (session, circleId) =>
      dropCircle(accounts, session, circleId),

    registerVanityName: (session, name) =>
      registerVanityName(api, accounts, session, name),

    async checkVanityName(name) {
      // A non-claiming public resolve: an id back means the name is taken, null
      // means it is free. The caller has already normalized + format-checked.
      try {
        const id = await api.resolveVanityName(name);
        return id === null ? "free" : "taken";
      } catch {
        return "error";
      }
    },

    releaseVanityName: (session) => releaseVanityName(api, accounts, session),

    ...recoveryControllerMethods(api, accounts),

    forget: () => devices.clear(),
  };
}
