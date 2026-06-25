/**
 * The owner's alias/contact sharing operations: minting and revoking the links an
 * owner hands out (a per-contact invite, a public/casual share link), accepting a
 * contact invite, and ingesting the return. Extracted from the session controller
 * so that file stays the lifecycle composition; these are free functions taking the
 * api + account manager, called by the controller's thin method wrappers.
 *
 * The `OwnerSession` and result types are type-only imports from session.ts (erased
 * at emit, so there is no runtime import cycle).
 */

import type { ApiClient } from "../api/client.ts";
import type { AccountManager } from "./account.ts";
import {
  MAX_CONTACT_LABEL,
  type AliasRecord,
  type ContactRecord,
} from "./accountBlob.ts";
import { contactInviteUrl, type ContactInvite } from "./contactInvite.ts";
import { primaryShareAlias } from "./findableOps.ts";
import {
  deriveAliasCard,
  withIdentity,
  type AliasIdentity,
} from "./ownerCard.ts";
import { todayEpochDay, nowMs, DAY_MS } from "../core/clock.ts";
import { randomAliasId } from "../crypto/index.ts";
import {
  publishCard,
  republishCard,
  revokeAlias,
  aliasLinkUrl,
} from "./publish.ts";
import type {
  OwnerSession,
  ContactLinkResult,
  ShareLinkResult,
} from "./session.ts";

/** A per-contact link's default lifetime before it lapses to gray-nothing (doc 13). */
export const CONTACT_LINK_MS = 7 * DAY_MS;

// An absolute expiry instant for a duration in ms from now, or null for none.
function expiryFor(durationMs: number | null): number | null {
  return durationMs === null ? null : nowMs() + durationMs;
}

// Mint a fresh private alias for one contact, publish the current card to it, and
// record it with a default expiry. The alias is private (unadvertised); the link is
// a contact INVITE (doc 13 path A) carrying the alias key plus the owner's notify
// capability, so the one recipient can read the card AND, on accept, notify back.
export async function mintContactLink(
  api: ApiClient,
  accounts: AccountManager,
  session: OwnerSession,
  opts: {
    label: string;
    identity: AliasIdentity;
    durationMs?: number | null | undefined;
  },
): Promise<ContactLinkResult> {
  const { label, identity } = opts;
  // The link's lifetime in ms from now, or null for until-revoked. Defaults to
  // CONTACT_LINK_MS so an omitted choice keeps the prior behaviour.
  const expiresAt = expiryFor(
    opts.durationMs === undefined ? CONTACT_LINK_MS : opts.durationMs,
  );
  const { myNotify } = await accounts.ensureMyNotify(session.master);
  const nowDay = todayEpochDay();
  const stamp = (rec: AliasRecord): AliasRecord =>
    withIdentity(rec, identity, session.blob);
  const { record } = await publishCard(
    api,
    (rec) => deriveAliasCard(session.blob.state, stamp(rec), nowDay),
    { isPublic: false, expiresAt },
  );
  const contact: ContactRecord = {
    id: randomAliasId(),
    label: label.slice(0, MAX_CONTACT_LABEL),
    createdDay: nowDay,
    expiresAt,
    alias: stamp(record),
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
export async function acceptContactInvite(
  api: ApiClient,
  accounts: AccountManager,
  session: OwnerSession,
  opts: { invite: ContactInvite; label: string; identity: AliasIdentity },
): Promise<ContactLinkResult> {
  const { invite, label, identity } = opts;
  // A return invite (it carries `ref`) is the inviter's to ingest, not to accept;
  // accepting it would mint a dangling third side that nobody can match back.
  if (invite.ref !== undefined) {
    throw new Error("cannot accept a return invite");
  }
  const { myNotify } = await accounts.ensureMyNotify(session.master);
  const nowDay = todayEpochDay();
  const stamp = (rec: AliasRecord): AliasRecord =>
    withIdentity(rec, identity, session.blob);
  const expiresAt = expiryFor(CONTACT_LINK_MS);
  const { record } = await publishCard(
    api,
    (rec) => deriveAliasCard(session.blob.state, stamp(rec), nowDay),
    { isPublic: false, expiresAt },
  );
  const contact: ContactRecord = {
    id: randomAliasId(),
    label: label.slice(0, MAX_CONTACT_LABEL),
    createdDay: nowDay,
    expiresAt,
    alias: stamp(record),
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
export async function ingestContactReturn(
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

// Revoke one contact link: kill the payload first (overwrite to garbage), then
// drop the record. Fail-safe order: a failed revoke leaves the record for a retry.
export async function revokeContactLink(
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

// Change one contact link's lifetime in place (extend or shorten): the same link
// keeps working, only its expiry moves. `durationMs` is counted from now; null
// means until-revoked. A no-op for an unknown id. Re-PUTs the card carrying the
// new expiry so the SERVER stops resolving it on time (doc 16), not just the
// device's local sweep, then records the new expiry in the blob.
export async function setContactLinkExpiry(
  api: ApiClient,
  accounts: AccountManager,
  session: OwnerSession,
  opts: { contactId: string; durationMs: number | null },
): Promise<OwnerSession> {
  const { contactId, durationMs } = opts;
  const contact = session.blob.contacts.find((c) => c.id === contactId);
  if (contact === undefined) return session;
  const expiresAt = expiryFor(durationMs);
  const nowDay = todayEpochDay();
  await republishCard(
    api,
    contact.alias,
    deriveAliasCard(session.blob.state, contact.alias, nowDay),
    expiresAt,
  );
  const blob = await accounts.addContact(session.master, {
    ...contact,
    expiresAt,
    alias: { ...contact.alias, expiresAt },
  });
  return { master: session.master, blob };
}

// Change the share-sheet link's lifetime in place (doc 16): the primary alias for
// the current sharing mode keeps resolving, only its expiry moves. `durationMs` is
// counted from now; null means until-revoked. A no-op if no such alias exists yet.
// Re-PUTs the card with the new expiry so the server enforces it.
export async function setShareLinkExpiry(
  api: ApiClient,
  accounts: AccountManager,
  session: OwnerSession,
  durationMs: number | null,
): Promise<OwnerSession> {
  const wantPublic = session.blob.sharingMode === "public";
  const alias = primaryShareAlias(session.blob, wantPublic);
  if (alias === undefined) return session;
  const expiresAt = expiryFor(durationMs);
  const nowDay = todayEpochDay();
  await republishCard(
    api,
    alias,
    deriveAliasCard(session.blob.state, alias, nowDay),
    expiresAt,
  );
  const blob = await accounts.addAlias(session.master, { ...alias, expiresAt });
  return { master: session.master, blob };
}

// Revoke one published alias (a public/casual link) by id: kill the payload first,
// then drop the record. Same fail-safe order as a contact link. A no-op for an
// unknown id.
export async function revokeAliasLink(
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

// Produce a link for the owner's current sharing mode. Shared by shareLink and
// renewLink. One alias per visibility: reuse the alias whose visibility matches the
// CURRENT sharing mode (republishing the current card so an already-shared link
// reflects the latest badge), or mint one on first share in this mode. Selecting by
// visibility, not array position, keeps the link's key-presence aligned with the
// mode the sheet shows: a public link carries the AES key in its `#k=` fragment, a
// private link never does. Reusing by position would otherwise hand out a
// key-bearing URL under a "private link" sheet after a public -> link switch.
export async function shareLinkFor(
  api: ApiClient,
  accounts: AccountManager,
  session: OwnerSession,
  identity: AliasIdentity,
): Promise<ShareLinkResult> {
  const nowDay = todayEpochDay();
  const wantPublic = session.blob.sharingMode === "public";
  const existing = primaryShareAlias(session.blob, wantPublic);
  if (existing !== undefined) {
    // Reuse keeps the existing alias's own identity (changing it = renewLink with a
    // fresh choice); only its badge is refreshed.
    await republishCard(
      api,
      existing,
      deriveAliasCard(session.blob.state, existing, nowDay),
    );
    return { session, url: aliasLinkUrl(existing) };
  }
  const stamp = (rec: AliasRecord): AliasRecord =>
    withIdentity(rec, identity, session.blob);
  const { link, record } = await publishCard(
    api,
    (rec) => deriveAliasCard(session.blob.state, stamp(rec), nowDay),
    { isPublic: wantPublic },
  );
  const blob = await accounts.addAlias(session.master, stamp(record));
  return { session: { master: session.master, blob }, url: link };
}
