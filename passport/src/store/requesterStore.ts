/**
 * The viewer's per-device "requester secret": a single local random used to
 * derive the opaque requesterHash a knock carries (see knock.ts). It is NOT an
 * identity and names no one; it only lets the server dedupe and rate-limit one
 * device's repeated knocks on the same alias without learning who knocked.
 *
 * It must be STABLE per device (a fresh secret each load would defeat dedupe and
 * show the owner the same knock as many distinct ones), so it is persisted. It is
 * never sent anywhere directly (only the salted hash leaves the device) and is
 * safe to regenerate: a corrupt/absent value just mints a new, equally anonymous
 * one. Storage is injected (StorageLike) so it is unit-testable in memory.
 */

import { bytesToBase64url } from "../crypto/index.ts";
import type { StorageLike } from "../auth/deviceStore.ts";

const KEY = "sti.requester.v1";

export interface RequesterStore {
  /** The stable per-device requester secret, generated + persisted on first use. */
  secret(): string;
}

function newSecret(): string {
  return bytesToBase64url(crypto.getRandomValues(new Uint8Array(32)));
}

export function createRequesterStore(storage: StorageLike): RequesterStore {
  return {
    secret() {
      const existing = storage.getItem(KEY);
      if (existing !== null && existing.length > 0) return existing;
      const secret = newSecret();
      storage.setItem(KEY, secret);
      return secret;
    },
  };
}

/**
 * A requester secret backed by window.localStorage, or a volatile per-session one
 * when localStorage is unavailable (SSR / private mode that throws). A volatile
 * secret still works for a single session; it only loses cross-session dedupe.
 */
export function browserRequesterSecret(): string {
  try {
    if (typeof localStorage === "undefined") return newSecret();
    localStorage.getItem(KEY); // some browsers throw on access, not definition
    return createRequesterStore(localStorage).secret();
  } catch {
    return newSecret();
  }
}
