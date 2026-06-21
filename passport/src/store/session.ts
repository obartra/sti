/**
 * The owner's app session: the composition that onboarding, login, recovery, and
 * reload drive. It ties the account lifecycle (AccountManager, on AccountSync) to
 * the two key sources, with the recovery PHRASE as the root and a passkey as an
 * optional SECOND credential over the same account.
 *
 * Recovery model (locked, doc 11): an account is always created from a generated
 * phrase, so it is always phrase-recoverable. enrollPasskey wraps the existing
 * master under the passkey's PRF output and stores `{ credentialId, wrappedMaster }`
 * locally; resume() unwraps it on reload. There is no path that creates an account
 * from a passkey alone, so a passkey loss can never lock the owner out.
 *
 * The session carries the master in memory (needed to mutate owner state); it is
 * never persisted. Reload without an enrolled passkey returns null here, and the
 * owner re-enters the phrase.
 */

import {
  bytesToBase64url,
  base64urlToBytes,
  randomAliasId,
  type Bytes,
} from "../crypto/index.ts";
import { wrapMaster, unwrapMaster } from "../auth/keyVault.ts";
import type { PasskeyAuth } from "../auth/passkey.ts";
import type { DeviceStore } from "../auth/deviceStore.ts";
import type { ApiClient, PendingKnock } from "../api/client.ts";
import type { AccountManager, OwnerProfile } from "./account.ts";
import type { AccountSync } from "./accountSync.ts";
import {
  MAX_CONTACT_LABEL,
  type AccountBlob,
  type AliasRecord,
  type ContactRecord,
} from "./accountBlob.ts";
import { contactInviteUrl, type ContactInvite } from "./contactInvite.ts";
import {
  lockNotifyDraft,
  parsePartnerPing,
  type NotifyLockResult,
} from "./partnerNotify.ts";
import { pollInbox } from "./notifyInbox.ts";
import { grantAccess } from "./grant.ts";
import type { OwnerState } from "../core/badge.ts";
import { deriveOwnerCard } from "./ownerCard.ts";
import { todayEpochDay } from "../core/clock.ts";
import {
  publishCard,
  republishCard,
  revokeAlias,
  aliasLinkUrl,
} from "./publish.ts";

/** An unlocked session: the master (in memory only) and the loaded account. */
export interface OwnerSession {
  readonly master: Bytes;
  readonly blob: AccountBlob;
}

export interface SignUpResult {
  readonly session: OwnerSession;
  /** Shown once at signup; the only way back in. Never persisted. */
  readonly recoveryPhrase: string;
}

export interface SessionController {
  /** First run: mint a phrase-recoverable account. Persists nothing locally. */
  signUp(handle: string): Promise<SignUpResult>;
  /** Login / recovery by phrase. null when no account exists for it. */
  recover(phrase: string): Promise<OwnerSession | null>;
  /**
   * Reload: unlock via the enrolled passkey and load the account. null when no
   * passkey is enrolled on this device, the passkey is cancelled/unavailable, or
   * the binding does not unwrap (fail-closed; the device binding is left intact).
   */
  resume(): Promise<OwnerSession | null>;
  /**
   * Bind a passkey to the current session so reload can resume without the
   * phrase. Stores only `{ credentialId, wrappedMaster }`.
   */
  enrollPasskey(session: OwnerSession, userName: string): Promise<void>;
  /**
   * Persist a profile change (avatar + sharing default) and return the session
   * with the updated account blob.
   */
  setProfile(
    session: OwnerSession,
    profile: OwnerProfile,
  ): Promise<OwnerSession>;
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
  shareLink(session: OwnerSession): Promise<ShareLinkResult>;
  /**
   * Revoke the link for the current sharing mode (the old URL stops resolving to
   * any status) and mint a fresh one for the same card. "Revoke" is no future
   * reads, not "unsee" (doc 01). Returns the updated session and the new URL. A
   * no-op-with-mint when no alias exists yet (just produces a first link).
   */
  renewLink(session: OwnerSession): Promise<ShareLinkResult>;
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
   * revocable link, default 7-day expiry), publish the current card to it, and
   * record it. Returns the updated session, the new contact, and the link URL.
   */
  createContactLink(
    session: OwnerSession,
    label: string,
  ): Promise<ContactLinkResult>;
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
  /** Forget this device's passkey binding. The phrase still recovers. */
  forget(): void;
}

/** A per-contact link's default lifetime before it lapses to gray-nothing (doc 13). */
export const CONTACT_LINK_DAYS = 7;

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
  /** Transport for publishing/republishing the owner's shareable alias. */
  readonly api: ApiClient;
}

// Every alias a knock can land on: the public/casual aliases plus every
// per-contact link. Used by the owner-pull knock review and the approve flow.
function ownerLinks(session: OwnerSession): AliasRecord[] {
  return [
    ...session.blob.aliases,
    ...session.blob.contacts.map((c) => c.alias),
  ];
}

// One knock-review sweep across every owner link: sum the contentless count and
// collect the grantable knocks (those that carried a key), each tagged with its
// alias. A single pass per alias, so count and pending can't read a torn pair.
// Best-effort per alias: an unreachable one contributes nothing.
async function gatherKnocks(
  api: ApiClient,
  session: OwnerSession,
): Promise<OwnerKnocks> {
  const perAlias = await Promise.all(
    ownerLinks(session).map(async (alias) => {
      const review = await api
        .knockReview(alias.id, alias.writeToken)
        .catch(() => ({ count: 0, pending: [] }));
      return {
        count: review.count,
        pending: review.pending
          .filter((p) => p.pubKey)
          .map((pending) => ({ alias, pending })),
      };
    }),
  );
  return {
    count: perAlias.reduce((sum, r) => sum + r.count, 0),
    pending: perAlias.flatMap((r) => r.pending),
  };
}

// Seal each approval's alias key to its waiting requester (the in-app grant).
// Returns how many were granted. All-or-nothing for the caller: a single failure
// rejects the whole call (so the UI marks none as granted and the owner retries
// all); grantAccess is idempotent, so re-sealing the ones that already succeeded
// is harmless.
async function grantPending(
  api: ApiClient,
  approvals: PendingApproval[],
): Promise<number> {
  await Promise.all(approvals.map((x) => grantAccess(api, x.alias, x.pending)));
  return approvals.length;
}

// Mint a fresh private alias for one contact, publish the current card to it, and
// record it with a default expiry. The alias is private (unadvertised); the link is
// a contact INVITE (doc 13 path A) carrying the alias key plus the owner's notify
// capability, so the one recipient can read the card AND, on accept, notify back.
async function mintContactLink(
  api: ApiClient,
  accounts: AccountManager,
  session: OwnerSession,
  label: string,
): Promise<ContactLinkResult> {
  const { myNotify } = await accounts.ensureMyNotify(session.master);
  const nowDay = todayEpochDay();
  const card = deriveOwnerCard(
    session.blob.state,
    session.blob.handle,
    nowDay,
    session.blob.avatar,
  );
  const { record } = await publishCard(api, card, { isPublic: false });
  const contact: ContactRecord = {
    id: randomAliasId(),
    label: label.slice(0, MAX_CONTACT_LABEL),
    createdDay: nowDay,
    expiresDay: nowDay + CONTACT_LINK_DAYS,
    alias: record,
  };
  const blob = await accounts.addContact(session.master, contact);
  return {
    session: { master: session.master, blob },
    contact,
    url: contactInviteUrl(record, myNotify),
  };
}

// Accept an inviter's contact invite (doc 13 path A). The accepter mints its OWN
// alias for the inviter, publishes its current card there, and records a COMPLETE
// contact: the inviter's read-alias (to see their status) and notify capability (to
// notify them). Returns a RETURN invite carrying the accepter's alias + notify and
// `ref` = the inviter's alias id, so the inviter can match it to the pending side.
async function acceptContactInvite(
  api: ApiClient,
  accounts: AccountManager,
  session: OwnerSession,
  opts: { invite: ContactInvite; label: string },
): Promise<ContactLinkResult> {
  const { invite, label } = opts;
  // A return invite (it carries `ref`) is the inviter's to ingest, not to accept;
  // accepting it would mint a dangling third side that nobody can match back.
  if (invite.ref !== undefined) {
    throw new Error("cannot accept a return invite");
  }
  const { myNotify } = await accounts.ensureMyNotify(session.master);
  const nowDay = todayEpochDay();
  const card = deriveOwnerCard(
    session.blob.state,
    session.blob.handle,
    nowDay,
    session.blob.avatar,
  );
  const { record } = await publishCard(api, card, { isPublic: false });
  const contact: ContactRecord = {
    id: randomAliasId(),
    label: label.slice(0, MAX_CONTACT_LABEL),
    createdDay: nowDay,
    expiresDay: nowDay + CONTACT_LINK_DAYS,
    alias: record,
    theirNotify: invite.notify,
    theirStatusAlias: invite.alias,
  };
  const blob = await accounts.addContact(session.master, contact);
  return {
    session: { master: session.master, blob },
    contact,
    url: contactInviteUrl(record, myNotify, invite.alias.id),
  };
}

// Ingest a return invite, completing the pending contact the inviter created. The
// return's `ref` names the inviter's alias id, so it matches the one pending contact
// whose alias.id equals it and that has no status alias yet. A no-op (unchanged
// session) when there is no `ref` or no matching pending contact.
async function ingestContactReturn(
  accounts: AccountManager,
  session: OwnerSession,
  ret: ContactInvite,
): Promise<OwnerSession> {
  if (ret.ref === undefined) return session;
  const pending = session.blob.contacts.find(
    (c) => c.alias.id === ret.ref && c.theirStatusAlias === undefined,
  );
  if (pending === undefined) return session;
  const completed: ContactRecord = {
    ...pending,
    theirNotify: ret.notify,
    theirStatusAlias: ret.alias,
  };
  const blob = await accounts.addContact(session.master, completed);
  return { master: session.master, blob };
}

// Silently notify every linked contact (those with a notify capability) that a
// positive was reported: a contentless ping to each inbox + a wake. No window and
// no reporter choice, everyone you've linked with is told, automatically.
function notifyLinkedContacts(
  api: ApiClient,
  session: OwnerSession,
): Promise<NotifyLockResult> {
  const ids = session.blob.contacts
    .filter((c) => c.theirNotify !== undefined)
    .map((c) => c.id);
  return lockNotifyDraft(api, session.blob, ids);
}

// The recipient side: poll this device's own inbox for a partner-notify ping.
// False (not an error) when no inbox is minted yet, the inbox is empty/decoy, or
// the bytes do not decode to a well-formed ping. The ping is contentless, so this
// only ever answers "is there a nudge", never who sent it.
async function pollPartnerNudge(
  api: ApiClient,
  session: OwnerSession,
): Promise<boolean> {
  const cap = session.blob.myNotify;
  if (cap === undefined) return false;
  const ping = await pollInbox(api, cap);
  return ping !== null && parsePartnerPing(ping) !== null;
}

// Revoke one contact link: kill the payload first (overwrite to garbage), then
// drop the record. Fail-safe order: a failed revoke leaves the record for a retry.
async function revokeContactLink(
  api: ApiClient,
  accounts: AccountManager,
  session: OwnerSession,
  contactId: string,
): Promise<OwnerSession> {
  const contact = session.blob.contacts.find((c) => c.id === contactId);
  if (contact === undefined) return session;
  await revokeAlias(api, contact.alias);
  const blob = await accounts.removeContact(session.master, contactId);
  return { master: session.master, blob };
}

// Revoke one published alias (a public/casual link) by id: kill the payload first,
// then drop the record. Same fail-safe order as a contact link. A no-op for an
// unknown id.
async function revokeAliasLink(
  api: ApiClient,
  accounts: AccountManager,
  session: OwnerSession,
  aliasId: string,
): Promise<OwnerSession> {
  const alias = session.blob.aliases.find((a) => a.id === aliasId);
  if (alias === undefined) return session;
  await revokeAlias(api, alias);
  const blob = await accounts.removeAlias(session.master, aliasId);
  return { master: session.master, blob };
}

export function createSessionController(deps: SessionDeps): SessionController {
  const { accounts, sync, devices, passkey, api } = deps;

  // Produce a link for the owner's current sharing mode. Shared by shareLink and
  // renewLink (a free function, not a `this` method, so it survives destructuring
  // of the controller). One alias per visibility: reuse the alias whose
  // visibility matches the CURRENT sharing mode (republishing the current card so
  // an already-shared link reflects the latest badge), or mint one on first share
  // in this mode. Selecting by visibility, not array position, keeps the link's
  // key-presence aligned with the mode the sheet shows: a public link carries the
  // AES key in its `#k=` fragment, a private link never does. Reusing by position
  // would otherwise hand out a key-bearing URL under a "private link" sheet after
  // a public -> link switch.
  async function shareLinkFor(session: OwnerSession): Promise<ShareLinkResult> {
    const card = deriveOwnerCard(
      session.blob.state,
      session.blob.handle,
      todayEpochDay(),
      session.blob.avatar,
    );
    const wantPublic = session.blob.sharingMode === "public";
    const existing = session.blob.aliases.find(
      (a) => a.isPublic === wantPublic,
    );
    if (existing !== undefined) {
      await republishCard(api, existing, card);
      return { session, url: aliasLinkUrl(existing) };
    }
    const { link, record } = await publishCard(api, card, {
      isPublic: wantPublic,
    });
    const blob = await accounts.addAlias(session.master, record);
    return { session: { master: session.master, blob }, url: link };
  }

  return {
    async signUp(handle) {
      const created = await accounts.create(handle);
      return {
        session: { master: created.master, blob: created.blob },
        recoveryPhrase: created.recoveryPhrase,
      };
    },

    async recover(phrase) {
      const recovered = await accounts.recover(phrase);
      return recovered === null
        ? null
        : { master: recovered.master, blob: recovered.blob };
    },

    async resume() {
      const cred = devices.load();
      if (cred === null) return null;

      let prfOutput: Bytes;
      try {
        prfOutput = await passkey.unlock(cred.credentialId);
      } catch {
        // Cancelled, unavailable, or unknown credential: fall back to the phrase.
        return null;
      }

      let master: Bytes;
      try {
        master = await unwrapMaster(
          base64urlToBytes(cred.wrappedMaster),
          prfOutput,
        );
      } catch {
        // Wrong passkey or corrupt binding: GCM rejects. Leave the binding in
        // place (a later correct unlock still works) and fall back to the phrase.
        return null;
      }

      const blob = await sync.load(master);
      return blob === null ? null : { master, blob };
    },

    async enrollPasskey(session, userName) {
      const { credentialId, prfOutput } = await passkey.enroll(userName);
      const wrapped = await wrapMaster(session.master, prfOutput);
      devices.save({
        credentialId,
        wrappedMaster: bytesToBase64url(wrapped),
      });
    },

    async setProfile(session, profile) {
      const blob = await accounts.setProfile(session.master, profile);
      return { master: session.master, blob };
    },

    async setOwnerState(session, state) {
      const blob = await accounts.setOwnerState(session.master, state);
      return { master: session.master, blob };
    },

    shareLink(session) {
      return shareLinkFor(session);
    },

    async renewLink(session) {
      const wantPublic = session.blob.sharingMode === "public";
      const existing = session.blob.aliases.find(
        (a) => a.isPublic === wantPublic,
      );
      let working = session;
      if (existing !== undefined) {
        // Kill the old payload first, then drop the record. Order matters: if the
        // record were dropped first and the revoke then failed, the old link would
        // keep resolving with no capability left to revoke it.
        await revokeAlias(api, existing);
        const blob = await accounts.removeAlias(session.master, existing.id);
        working = { master: session.master, blob };
      }
      // Mint a fresh link for the current card (this is now the only alias for
      // the mode, since the old record is gone).
      return shareLinkFor(working);
    },

    async deleteAccount(session) {
      await accounts.deleteAccount(session.master);
      devices.clear();
    },

    reviewKnocks(session) {
      return gatherKnocks(api, session);
    },

    // The approvals already carry their alias + key, so the session is only in the
    // signature for symmetry with the other owner actions.
    approveKnocks(_session, approvals) {
      return grantPending(api, approvals);
    },

    createContactLink(session, label) {
      return mintContactLink(api, accounts, session, label);
    },

    revokeContact: (session, contactId) =>
      revokeContactLink(api, accounts, session, contactId),

    revokeAlias: (session, aliasId) =>
      revokeAliasLink(api, accounts, session, aliasId),

    acceptContactInvite(session, invite, label) {
      return acceptContactInvite(api, accounts, session, { invite, label });
    },

    ingestContactReturn(session, ret) {
      return ingestContactReturn(accounts, session, ret);
    },

    notifyContactsOfPositive: (session) => notifyLinkedContacts(api, session),

    hasPartnerNudge: (session) => pollPartnerNudge(api, session),

    forget() {
      devices.clear();
    },
  };
}
