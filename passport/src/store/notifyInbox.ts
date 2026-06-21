/**
 * The notify-inbox channel (doc 13, slice 3): a blind, alias-shaped per-device
 * mailbox holding ONE fixed-size encrypted ping. A device mints its own inbox and
 * hands the capability to contacts at link time; a contact writes an encrypted
 * ping to it; the owner polls and decrypts. The server moves only opaque,
 * fixed-size bytes and reads the inbox existence-uniformly (a decoy on a miss), so
 * it never learns who has an inbox, who wrote to one, or what it says.
 *
 * This slice is just the CHANNEL: write opaque bytes, poll opaque bytes. What a
 * ping MEANS (the partner-notify payload) and WHEN it is sent (the draft/lock
 * flow + the gated wake) are later slices; nothing here is wired into the app yet.
 */

import type { ApiClient } from "../api/client.ts";
import { ALIAS_PAYLOAD_SIZE } from "../api/contract.ts";
import {
  importAesKey,
  sealToSize,
  openSized,
  base64urlToBytes,
  bytesToBase64url,
  randomAliasId,
  randomWriteToken,
  type Bytes,
} from "../crypto/index.ts";

/**
 * One device's inbox: the opaque id others poll/write, the write token that gates
 * writes to it, and the AES key that encrypts its contents. The owner keeps all
 * three; a contact is given `{ inboxId, writeToken, key }` so it can notify back.
 */
export interface InboxCapability {
  readonly inboxId: string;
  readonly writeToken: string;
  /** base64url AES key; the ping is sealed under it, never sent to the server. */
  readonly key: string;
}

/** Mint a fresh inbox capability (random id + write token + key), all client-side. */
export function mintInbox(): InboxCapability {
  return {
    inboxId: randomAliasId(),
    writeToken: randomWriteToken(),
    key: bytesToBase64url(crypto.getRandomValues(new Uint8Array(32))),
  };
}

/**
 * Write an encrypted ping into `inbox`, overwriting any previous one. `plaintext`
 * is the opaque ping payload (its meaning is a later slice). Sealed to the fixed
 * alias size so the write is indistinguishable from any other inbox write.
 */
export async function writePing(
  api: ApiClient,
  inbox: InboxCapability,
  plaintext: Bytes,
): Promise<void> {
  const aesKey = await importAesKey(base64urlToBytes(inbox.key));
  const payload = await sealToSize(aesKey, plaintext, ALIAS_PAYLOAD_SIZE);
  await api.putInbox(inbox.inboxId, payload, inbox.writeToken);
}

/**
 * Poll `inbox` for a ping. Returns the decrypted ping bytes, or null when the
 * inbox is empty / never written (a decoy) / unreadable / unreachable — all
 * indistinguishable, so a poll never reveals whether an inbox exists. The write
 * token is not needed to read; only the key is.
 */
export async function pollInbox(
  api: ApiClient,
  inbox: { inboxId: string; key: string },
): Promise<Bytes | null> {
  try {
    const payload = await api.getInbox(inbox.inboxId);
    const aesKey = await importAesKey(base64urlToBytes(inbox.key));
    return await openSized(aesKey, payload);
  } catch {
    return null;
  }
}
