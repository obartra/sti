/**
 * Shared-group crypto primitives (doc 33, slice 1). A group is "one card key
 * shared by N people" plus a way to hand that key to each member. This module is
 * the pure, in-memory crypto for exactly that, and nothing else: no UI, no
 * server, no storage. Later slices (the group blob, the roster, the lifecycle,
 * key rotation) consume these building blocks.
 *
 * Two constructions, both reused from the existing crypto boundary rather than
 * hand-rolled:
 *
 * - **Group cards** are a member's status card sealed under the shared group key
 *   `Kg`, using the SAME fixed-size AEAD publish.ts uses for alias cards
 *   (sealToSize/openSized at ALIAS_PAYLOAD_SIZE). A group card is therefore the
 *   same length as any alias payload, so it adds no size oracle: on the wire it
 *   is indistinguishable from an ordinary card. Opening fails closed to the
 *   uniform null, exactly like backendStore.resolveAlias.
 * - **Wrapping `Kg`** to one member mirrors the recovery/passkey envelopes
 *   (auth/keyVault.ts, auth/passwordEnvelope.ts): the member's wrapping key seals
 *   `Kg` with the variable-length AEAD (seal/open). A wrong member key makes
 *   AES-GCM reject, so unwrap fails closed the same way unwrapRoot does.
 *
 * No key material is logged, serialized to plaintext, or sent anywhere here; the
 * only outputs are ciphertext (sealed cards, wrapped keys) and freshly minted
 * random keys the caller holds.
 */

import { ALIAS_PAYLOAD_SIZE } from "../api/contract.ts";
import {
  importAesKey,
  seal,
  open,
  sealToSize,
  openSized,
  type Bytes,
} from "../crypto/index.ts";
import { serializePublicCard, parsePublicCard } from "./publicCard.ts";
import type { ResolvedView } from "../ui/public/PublicResolution.tsx";

const GROUP_KEY_BYTES = 32; // AES-256, same width as an alias card key

/**
 * The shared symmetric group key `Kg`. Holding it is what lets a member read the
 * group (open every member's card) and is what a removal rotates away. Branded
 * so it cannot be confused with a member's wrapping key or any other Bytes at a
 * call site, and so the only ways to obtain one are minting a fresh key or
 * unwrapping a copy addressed to you. It is raw 32-byte key material on purpose:
 * it must be both usable as an AES key (to seal cards) and wrappable as plaintext
 * (to hand to a member), which a non-extractable CryptoKey could not be.
 */
export type GroupKey = Bytes & { readonly __groupKey: unique symbol };

/**
 * A member's wrapping key: the 32-byte AES key that encrypts `Kg` for one member.
 * This slice takes it as raw bytes (like the derived key keyVault.ts imports
 * before sealing the account root); later slices decide how it is derived per
 * member. Kept distinct from GroupKey so the two are not swapped at a call site.
 */
export type MemberKey = Bytes;

/**
 * Mint a fresh random group key `Kg`. A new group draws one of these; a removal
 * (doc 33) draws another to rotate. Same 32 random bytes an alias key is minted
 * from in publishCard.
 */
export function mintGroupKey(): GroupKey {
  return crypto.getRandomValues(new Uint8Array(GROUP_KEY_BYTES)) as GroupKey;
}

/**
 * Seal a member's status card under `Kg`, producing the fixed-size payload a
 * group card is published as. Identical AEAD to the alias path (sealAndPut in
 * publish.ts): the same versioned card codec, sealed to ALIAS_PAYLOAD_SIZE, so a
 * group card is byte-for-byte the same shape as an alias payload and reveals no
 * more by existing. A fresh random IV rides each seal (inside gcmSeal), so two
 * seals of the same card differ.
 */
export async function sealGroupCard(
  Kg: GroupKey,
  card: ResolvedView,
): Promise<Bytes> {
  const key = await importAesKey(Kg);
  return sealToSize(key, serializePublicCard(card), ALIAS_PAYLOAD_SIZE);
}

/**
 * Open a group card sealed under `Kg`. Fails closed to `null` on any failure (a
 * wrong `Kg`, tampered or decoy bytes, a malformed or wrong-version card),
 * mirroring backendStore.resolveAlias: every failure path lands on the same
 * uniform null (the gray card), so a card is never rendered under a key that
 * cannot open it and existence stays undetectable.
 */
export async function openGroupCard(
  Kg: GroupKey,
  bytes: Bytes,
): Promise<ResolvedView | null> {
  try {
    const key = await importAesKey(Kg);
    return parsePublicCard(await openSized(key, bytes));
  } catch {
    return null;
  }
}

/**
 * Wrap `Kg` so one member can recover it, encrypting it under that member's
 * wrapping key. Mirrors keyVault.ts's wrapRoot exactly: import the member key as
 * an AES key and seal the key material with the variable-length AEAD. A fresh IV
 * per call means the same `Kg` wrapped to the same member twice yields distinct
 * ciphertext.
 */
export async function wrapGroupKey(
  Kg: GroupKey,
  memberKey: MemberKey,
): Promise<Bytes> {
  return seal(await importAesKey(memberKey), Kg);
}

/**
 * Recover `Kg` from a wrapped copy and the member's wrapping key. A wrong member
 * key derives a different AES key, so AES-GCM rejects and this throws, failing
 * closed exactly like unwrapRoot. The length check is defense in depth: GCM
 * integrity already guarantees the plaintext is what was wrapped, and we only
 * ever wrap a 32-byte key, so anything else is a corrupt or wrong-shaped input
 * and is refused rather than returned as a bogus key.
 */
export async function unwrapGroupKey(
  wrapped: Bytes,
  memberKey: MemberKey,
): Promise<GroupKey> {
  const raw = await open(await importAesKey(memberKey), wrapped);
  if (raw.length !== GROUP_KEY_BYTES) {
    throw new Error("unwrapGroupKey: unexpected key length");
  }
  return raw as GroupKey;
}
