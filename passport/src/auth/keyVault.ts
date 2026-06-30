/**
 * Bind a passkey to a phrase-recoverable account. The account root is derived
 * from the recovery phrase, which is the recovery root (the one substitute for a
 * lost passkey, per Data & storage). A passkey is a SECOND credential over the
 * same account: its PRF output wraps (encrypts) the root, so the stored wrapped
 * copy is unwrapped on reload without re-typing the phrase. Losing the passkey
 * falls back to the phrase; the account is never passkey-only.
 *
 * Onboarding stores `{ credentialId, wrappedRoot }` locally; it never stores
 * the root or the PRF output. A wrong/absent passkey fails closed (GCM
 * rejects), and the phrase remains the way in.
 */

import {
  wrapKeyFromPrf,
  importAesKey,
  seal,
  open,
  type Bytes,
} from "../crypto/index.ts";

/** Encrypt the account root under the passkey's PRF output. */
export async function wrapRoot(root: Bytes, prfOutput: Bytes): Promise<Bytes> {
  return seal(await importAesKey(await wrapKeyFromPrf(prfOutput)), root);
}

/** Recover the account root from a wrapped copy and the passkey's PRF output. */
export async function unwrapRoot(
  wrapped: Bytes,
  prfOutput: Bytes,
): Promise<Bytes> {
  return open(await importAesKey(await wrapKeyFromPrf(prfOutput)), wrapped);
}
