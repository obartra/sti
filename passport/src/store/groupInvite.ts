/**
 * Group-invite link + lifecycle-payload codec (doc 33, slice 4a). An admin invites
 * someone into a group by handing them a link; the invitee opens it, and everything
 * the invitee needs rides in the URL FRAGMENT so the server never sees it, exactly
 * like the contact invite (contactInvite.ts). The fragment carries the group blob
 * id, the admin<->member lifecycle inbox capability (the channel an accept/reject is
 * written to), and the display fields (handle, visibility, meetingKind) so the app
 * can show the join-time disclosure (doc 33) before the invitee accepts.
 *
 * The fragment carries NO group key and NO blob write token: the invitee gets `Kg`
 * only once the admin has added their slot (a later roster poll trial-unwraps it),
 * and never gets the blob write token at all (only the admin may rewrite the group).
 *
 * The lifecycle payload is the small message the invitee seals under the inbox key
 * and writes into the lifecycle inbox: an ACCEPT (their freshly derived member key,
 * so the admin can wrap `Kg` to them, plus the card id they will publish under) or a
 * REJECT. Here it is only plaintext<->object; the seal/open is the inbox layer
 * (writePing/pollInbox), so a wrong key fails closed there to the uniform null.
 * Every parse fails CLOSED to null on any surprise, like every other codec here.
 */

import {
  bytesToBase64url,
  base64urlToBytes,
  utf8ToBytes,
  bytesToUtf8,
  type Bytes,
} from "../crypto/index.ts";
import { validId } from "../api/contract.ts";
import { hasVanityNameShape } from "./vanityName.ts";
import {
  isGroupVisibility,
  isMeetingKind,
  type GroupVisibility,
  type MeetingKind,
} from "./groupObject.ts";
import type { InboxCapability } from "./notifyInbox.ts";

// The canonical origin a shared link points at (mirrors publish.ts's SHARE_ORIGIN,
// which is not exported); an invite is opened on this host and parsed locally.
const SHARE_ORIGIN = "https://sti.care";
// A dedicated path so the app router can tell a group invite from an alias link.
// The whole payload rides in the fragment, so nothing here reaches the server.
const GROUP_INVITE_PATH = "/g";

/**
 * A parsed group invite: the group blob id, the admin<->member lifecycle inbox, and
 * the display fields used for the join-time disclosure. No key, no write token.
 */
export interface GroupInvite {
  readonly groupId: string;
  readonly lifecycleInbox: InboxCapability;
  readonly handle: string;
  readonly visibility: GroupVisibility;
  readonly meetingKind: MeetingKind;
}

// An inbox capability as it rides the fragment: three id-shaped base64url tokens.
// Kept local (mirrors contactInvite's inline decodeNotify) rather than reaching
// into accountBlob's private validator.
function isInboxShape(x: unknown): x is InboxCapability {
  if (typeof x !== "object" || x === null) return false;
  const r = x as Record<string, unknown>;
  return [r.inboxId, r.writeToken, r.key].every(
    (f) => typeof f === "string" && validId(f),
  );
}

// The canonical JSON for an invite: the exact fields the URL fragment carries and
// the same fields a join grant seals to a requester (doc 33, slice 4b), so the two
// carriers stay in lockstep and both parse back through validateInvite.
function inviteToJson(invite: GroupInvite): string {
  return JSON.stringify({
    groupId: invite.groupId,
    lifecycleInbox: invite.lifecycleInbox,
    handle: invite.handle,
    visibility: invite.visibility,
    meetingKind: invite.meetingKind,
  });
}

/** Build the invite URL: the whole invite base64url-encoded into the `#g=` fragment. */
export function groupInviteUrl(invite: GroupInvite): string {
  return `${SHARE_ORIGIN}${GROUP_INVITE_PATH}#g=${bytesToBase64url(utf8ToBytes(inviteToJson(invite)))}`;
}

// Strictly validate a decoded fragment as a well-formed invite, or null. Every
// false path is a fail-closed null upstream, so a tampered or garbage fragment
// never half-parses into an invite.
function validateInvite(o: unknown): GroupInvite | null {
  if (typeof o !== "object" || o === null) return null;
  const r = o as Record<string, unknown>;
  if (typeof r.groupId !== "string" || !validId(r.groupId)) return null;
  if (!isInboxShape(r.lifecycleInbox)) return null;
  if (!hasVanityNameShape(r.handle)) return null;
  if (!isGroupVisibility(r.visibility)) return null;
  if (!isMeetingKind(r.meetingKind)) return null;
  return {
    groupId: r.groupId,
    lifecycleInbox: r.lifecycleInbox,
    handle: r.handle,
    visibility: r.visibility,
    meetingKind: r.meetingKind,
  };
}

/**
 * Parse a group invite from a link, or null when it is not one (a wrong path, no
 * `g=` fragment, or a malformed/garbage fragment all fail closed to null).
 */
export function parseGroupInvite(
  pathname: string,
  hash: string,
): GroupInvite | null {
  if (!/^\/g\/?$/.test(pathname)) return null;
  const g = new URLSearchParams(hash.replace(/^#/, "")).get("g");
  if (g === null) return null;
  try {
    return validateInvite(JSON.parse(bytesToUtf8(base64urlToBytes(g))));
  } catch {
    return null;
  }
}

/**
 * An accept: the invitee's derived member key (base64url) so the admin can wrap `Kg`
 * to a slot, and the card id the invitee will publish their group card under. The
 * member key is safe to hand the admin (HKDF is one-way and the admin already holds
 * `Kg`); the invitee's card WRITE token is never in here, so only they can overwrite
 * their card.
 */
export interface LifecycleAccept {
  readonly kind: "accept";
  readonly memberKey: string;
  readonly cardId: string;
}

// A reject carries no data: it just tells the admin to drop the pending invite.
interface LifecycleReject {
  readonly kind: "reject";
}

// A leave carries no data either (doc 33, slice 4b): a member writes it to the
// admin<->member inbox they kept from accept, and the admin drops them from the
// roster. It is byte-shape identical (through the sealed fixed-size inbox) to an
// accept or reject, so the server cannot tell a leave from any other lifecycle
// write; and to the rest of the group a leave and an admin remove look the same
// (the roster simply shrinks), which is the indistinguishability doc 33 requires.
interface LifecycleLeave {
  readonly kind: "leave";
}

/** The lifecycle messages a member writes back through the inbox: an accept or
 * reject on the way in, a leave on the way out. */
export type LifecyclePayload =
  | LifecycleAccept
  | LifecycleReject
  | LifecycleLeave;

/** Encode an accept payload (plaintext bytes) to hand to writePing. */
export function encodeLifecycleAccept(memberKey: Bytes, cardId: string): Bytes {
  return utf8ToBytes(
    JSON.stringify({
      kind: "accept",
      memberKey: bytesToBase64url(memberKey),
      cardId,
    }),
  );
}

/** Encode a reject payload (plaintext bytes) to hand to writePing. */
export function encodeLifecycleReject(): Bytes {
  return utf8ToBytes(JSON.stringify({ kind: "reject" }));
}

/** Encode a leave payload (plaintext bytes) to hand to writePing (doc 33, slice 4b). */
export function encodeLifecycleLeave(): Bytes {
  return utf8ToBytes(JSON.stringify({ kind: "leave" }));
}

/**
 * Parse a decrypted lifecycle payload, or null on any surprise (a decoy, a wrong
 * key that opened to garbage, a bad shape). Fails closed so the admin ingest treats
 * anything it cannot recognize as "still pending" rather than acting on garbage.
 */
export function parseLifecyclePayload(bytes: Bytes): LifecyclePayload | null {
  try {
    const o: unknown = JSON.parse(bytesToUtf8(bytes));
    if (typeof o !== "object" || o === null) return null;
    const r = o as Record<string, unknown>;
    if (r.kind === "reject") return { kind: "reject" };
    if (r.kind === "leave") return { kind: "leave" };
    if (
      r.kind === "accept" &&
      typeof r.memberKey === "string" &&
      validId(r.memberKey) &&
      typeof r.cardId === "string" &&
      validId(r.cardId)
    ) {
      return { kind: "accept", memberKey: r.memberKey, cardId: r.cardId };
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Encode an invite as the join-grant payload bytes (doc 33, slice 4b): the same
 * fields the invite URL fragment carries, sealed to a requester's key on approve so
 * they can run the SAME accept back-half an invited member runs. Carrying every
 * field here (not just groupId + inbox) is what lets the requester reconstruct a
 * full {@link GroupInvite} without having stored the group's meetingKind, which a
 * requester never knew.
 */
export function encodeJoinGrant(invite: GroupInvite): Bytes {
  return utf8ToBytes(inviteToJson(invite));
}

/**
 * Parse a decrypted join-grant payload back into a {@link GroupInvite}, or null on
 * any surprise (a decoy that opened to garbage, a wrong key, a bad shape). Reuses
 * the invite validator, so it fails CLOSED exactly like parseGroupInvite: a payload
 * that is not a well-formed invite is treated as "no grant for me", never acted on.
 */
export function parseJoinGrant(bytes: Bytes): GroupInvite | null {
  try {
    return validateInvite(JSON.parse(bytesToUtf8(bytes)));
  } catch {
    return null;
  }
}
