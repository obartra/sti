/**
 * Contact-invite link codec (doc 13 path A). A contact invite is an ordinary alias
 * link (`/a/{id}#k={key}`, so it still resolves to the inviter's card) plus, in the
 * fragment, the inviter's notify capability (`n=`) and, on a RETURN invite, the
 * inviter's alias id being answered (`ref=`).
 *
 * Everything rides in the fragment, so the server never sees the key or the notify
 * capability. The notify capability is the inviter's `myNotify`, so opening an
 * invite gives the accepter both the means to read the inviter's status (the alias)
 * and to notify them back (the capability).
 */

import {
  bytesToBase64url,
  base64urlToBytes,
  utf8ToBytes,
  bytesToUtf8,
} from "../crypto/index.ts";
import { validId } from "../api/contract.ts";
import type { AliasRecord, StatusAlias } from "./accountBlob.ts";
import type { NotifyCapability } from "./notifyInbox.ts";
import { parseAliasLink } from "./aliasLink.ts";
import { keyedAliasLinkUrl } from "./publish.ts";

/**
 * A parsed contact invite: the inviter's alias to read their status, their notify
 * capability, and (on a return invite) `ref` = the inviter's alias id being
 * answered, which lets the original inviter match the return to the pending contact.
 */
export interface ContactInvite {
  readonly alias: StatusAlias;
  readonly notify: NotifyCapability;
  readonly ref?: string;
}

function encodeNotify(notify: NotifyCapability): string {
  return bytesToBase64url(utf8ToBytes(JSON.stringify(notify)));
}

function decodeNotify(encoded: string): NotifyCapability | null {
  try {
    const o: unknown = JSON.parse(bytesToUtf8(base64urlToBytes(encoded)));
    if (typeof o !== "object" || o === null) return null;
    const r = o as Record<string, unknown>;
    const fields = [r.inboxId, r.writeToken, r.key, r.routingToken];
    if (!fields.every((f) => typeof f === "string" && validId(f))) return null;
    return {
      inboxId: r.inboxId as string,
      writeToken: r.writeToken as string,
      key: r.key as string,
      routingToken: r.routingToken as string,
    };
  } catch {
    return null;
  }
}

/**
 * Build an invite URL: the keyed alias link plus the notify capability, and
 * optionally `ref` (set only on a return invite, to the inviter's alias id).
 */
export function contactInviteUrl(
  record: AliasRecord,
  notify: NotifyCapability,
  ref?: string,
): string {
  let url = `${keyedAliasLinkUrl(record)}&n=${encodeNotify(notify)}`;
  if (ref !== undefined) url += `&ref=${ref}`;
  return url;
}

/**
 * Parse a contact invite from a link, or null when it is not one (a plain alias
 * link with no `n=` is not an invite; a malformed capability fails closed to null).
 * The alias part reuses parseAliasLink, so a plain link still resolves as a card.
 */
export function parseContactInvite(
  pathname: string,
  hash: string,
): ContactInvite | null {
  const link = parseAliasLink(pathname, hash);
  if (link === null) return null;
  const params = new URLSearchParams(hash.replace(/^#/, ""));
  const n = params.get("n");
  if (n === null) return null;
  const notify = decodeNotify(n);
  if (notify === null) return null;
  const ref = params.get("ref");
  if (ref !== null && !validId(ref)) return null;
  return {
    alias: { id: link.id, key: link.key },
    notify,
    ...(ref !== null ? { ref } : {}),
  };
}
