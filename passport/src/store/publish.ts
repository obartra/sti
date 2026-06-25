/**
 * Publishing an owner's card to the blind store. Minting a new alias generates
 * its three capabilities (a random read id, a random write token, a random AES
 * key), seals the card to the fixed size, and PUTs it. The returned record holds
 * everything a fresh device needs to republish or revoke the alias later (it is
 * what gets stored in the account blob); the link is the shareable URL, with the
 * key in the `#k=` fragment for a public alias.
 *
 * Republishing reuses an existing record's id/token/key, so the shared link stays
 * valid and viewers see the updated card.
 */

import type { ApiClient } from "../api/client.ts";
import { ALIAS_PAYLOAD_SIZE, PATHS } from "../api/contract.ts";
import {
  importAesKey,
  sealToSize,
  bytesToBase64url,
  base64urlToBytes,
  randomAliasId,
  randomWriteToken,
} from "../crypto/index.ts";
import { serializePublicCard } from "./publicCard.ts";
import type { AliasRecord } from "./accountBlob.ts";
import type { ResolvedView } from "../ui/public/PublicResolution.tsx";

// The canonical origin a shared link points at (where viewers open it), distinct
// from the api origin.
const SHARE_ORIGIN = "https://sti.care";

export interface PublishedAlias {
  /** The shareable URL: `/a/{id}` plus `#k={key}` for a public alias. */
  readonly link: string;
  /** The capabilities to keep (persisted in the account blob). */
  readonly record: AliasRecord;
}

export function aliasLinkUrl(record: AliasRecord): string {
  const base = `${SHARE_ORIGIN}${PATHS.aliasPrefix}${record.id}`;
  return record.isPublic ? `${base}#k=${record.key}` : base;
}

/**
 * A link that ALWAYS carries the key in the fragment, for a per-contact link
 * handed to one specific person (one-tap open). Unlike aliasLinkUrl, this does
 * not gate on isPublic: a per-contact alias stays private (unadvertised) but its
 * recipient gets the key so they can resolve it directly rather than knocking.
 */
export function keyedAliasLinkUrl(record: AliasRecord): string {
  return `${SHARE_ORIGIN}${PATHS.aliasPrefix}${record.id}#k=${record.key}`;
}

// Seal `view` under `key` and write it to the alias. Shared by publish (new key)
// and republish (the existing key), so both encode a card identically. The
// record's own `expiresAt` rides the PUT (doc 16) and is sent every time, so the
// server's expiry stays in lock-step with the blob (idempotent on a republish).
async function sealAndPut(
  api: ApiClient,
  key: CryptoKey,
  record: Pick<AliasRecord, "id" | "writeToken" | "expiresAt">,
  view: ResolvedView,
): Promise<void> {
  const payload = await sealToSize(
    key,
    serializePublicCard(view),
    ALIAS_PAYLOAD_SIZE,
  );
  await api.putAlias(
    record.id,
    payload,
    record.writeToken,
    record.expiresAt ?? null,
  );
}

/**
 * Seal a card to the fixed-size payload for this record's key and return it
 * base64url-encoded, ready for a deferred republish batch (api.republish). These
 * are the same bytes a direct PUT would carry; the batch just hands them to the
 * server to apply at a jittered time (decorrelation, doc 11). Expiry is not carried
 * here: a batch never changes a link's lifetime, so the deferred write preserves it.
 */
export async function sealCardPayload(
  record: Pick<AliasRecord, "key">,
  view: ResolvedView,
): Promise<string> {
  const key = await importAesKey(base64urlToBytes(record.key));
  const payload = await sealToSize(
    key,
    serializePublicCard(view),
    ALIAS_PAYLOAD_SIZE,
  );
  return bytesToBase64url(payload);
}

/**
 * Mint a new alias and publish a card to it. Takes a `buildView(record)` callback
 * rather than a prebuilt view because the card's display identity is resolved from
 * the alias's own id (doc 15), which only exists once the record is minted here.
 * `expiresAt` (epoch ms, or null/absent for no expiry) is recorded on the alias
 * and sent to the server so the link expires on time (doc 16).
 */
export async function publishCard(
  api: ApiClient,
  buildView: (record: AliasRecord) => ResolvedView,
  opts: { isPublic?: boolean; expiresAt?: number | null } = {},
): Promise<PublishedAlias> {
  const raw = crypto.getRandomValues(new Uint8Array(32));
  const expiresAt = opts.expiresAt ?? null;
  const record: AliasRecord = {
    id: randomAliasId(),
    writeToken: randomWriteToken(),
    key: bytesToBase64url(raw),
    isPublic: opts.isPublic ?? true,
    expiresAt,
  };
  await sealAndPut(api, await importAesKey(raw), record, buildView(record));
  return { link: aliasLinkUrl(record), record };
}

/**
 * Overwrite an existing alias with an updated card (same link, same key). By
 * default a badge republish keeps the record's current expiry; pass `expiresAt`
 * (number or null) to change the link's lifetime in the same write (doc 16).
 */
export async function republishCard(
  api: ApiClient,
  record: AliasRecord,
  view: ResolvedView,
  expiresAt?: number | null,
): Promise<void> {
  const key = await importAesKey(base64urlToBytes(record.key));
  const rec = expiresAt === undefined ? record : { ...record, expiresAt };
  await sealAndPut(api, key, rec, view);
}

/**
 * Revoke an alias: overwrite its payload with random bytes (the owner holds the
 * write token). The old link can never decrypt again, so it resolves to the same
 * uniform gray-nothing as a never-existed link, honouring "revoke = no future
 * reads" (doc 01) without a distinguishable delete. The account drops the record
 * separately, so the orphaned row carries no recoverable content.
 */
export async function revokeAlias(
  api: ApiClient,
  record: Pick<AliasRecord, "id" | "writeToken">,
): Promise<void> {
  const garbage = crypto.getRandomValues(new Uint8Array(ALIAS_PAYLOAD_SIZE));
  await api.putAlias(record.id, garbage, record.writeToken);
}
