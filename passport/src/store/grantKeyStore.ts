/**
 * The viewer's per-alias GRANT keypair (doc 13, slice 2). When a viewer knocks on
 * a private alias they can't yet read, they send an ephemeral public key and keep
 * the private half here; if the owner approves, they seal the alias key to that
 * public key and the viewer opens it with this private key (see store/grant +
 * crypto/grant).
 *
 * The keypair must be STABLE per (device, alias): the server's knock dedup keeps
 * the FIRST key it saw, so a fresh key each visit would leave the owner sealing to
 * a key the viewer no longer holds. So it is persisted, keyed by alias id. It is
 * an ephemeral throwaway, not an identity, and only the public half ever leaves
 * the device. A corrupt/absent value just mints a new keypair (the viewer re-knocks
 * with it). Storage is injected (StorageLike) so it is unit-testable in memory.
 */

import { generateGrantKeyPair, type GrantKeyPair } from "../crypto/index.ts";
import type { StorageLike } from "../auth/deviceStore.ts";

const KEY = "sti.grantkeys.v1";

export interface GrantKeyStore {
  /** The stable grant keypair for `aliasId`, generated + persisted on first use. */
  forAlias(aliasId: string): Promise<GrantKeyPair>;
  /** The stored private key for `aliasId`, or null if this device never knocked it. */
  privateKey(aliasId: string): string | null;
  /** Forget every stored grant keypair (e.g. on logout). */
  clear(): void;
}

type Stored = Record<string, GrantKeyPair>;

function isKeyPair(v: unknown): v is GrantKeyPair {
  if (typeof v !== "object" || v === null) return false;
  const o = v as { publicKey?: unknown; privateKey?: unknown };
  return typeof o.publicKey === "string" && typeof o.privateKey === "string";
}

// Read the persisted map, fail-closed to empty on anything unexpected (absent,
// non-JSON, wrong shape), so a corrupt store never throws into a knock.
function load(storage: StorageLike): Stored {
  try {
    const raw = storage.getItem(KEY);
    if (raw === null || raw.length === 0) return {};
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return {};
    const out: Stored = {};
    for (const [id, kp] of Object.entries(parsed)) {
      if (isKeyPair(kp)) out[id] = kp;
    }
    return out;
  } catch {
    return {};
  }
}

export function createGrantKeyStore(storage: StorageLike): GrantKeyStore {
  return {
    async forAlias(aliasId) {
      const map = load(storage);
      const existing = map[aliasId];
      if (existing !== undefined) return existing;
      const kp = await generateGrantKeyPair();
      map[aliasId] = kp;
      try {
        storage.setItem(KEY, JSON.stringify(map));
      } catch {
        // A full / unavailable store just means no cross-session persistence; the
        // freshly minted key still works for this session's knock + poll.
      }
      return kp;
    },
    privateKey(aliasId) {
      return load(storage)[aliasId]?.privateKey ?? null;
    },
    clear() {
      storage.removeItem(KEY);
    },
  };
}

/**
 * A grant-key store backed by window.localStorage, or a volatile in-memory one
 * when localStorage is unavailable (SSR / private mode that throws). Volatile
 * still works within a session; it only loses the keypair across reloads.
 */
export function browserGrantKeyStore(): GrantKeyStore {
  try {
    if (typeof localStorage === "undefined")
      return createGrantKeyStore(memory());
    localStorage.getItem(KEY); // some browsers throw on access, not definition
    return createGrantKeyStore(localStorage);
  } catch {
    return createGrantKeyStore(memory());
  }
}

/**
 * Forget every persisted grant keypair (e.g. on logout from a shared device), so
 * the next person on the device cannot tell which aliases this one knocked.
 * Best-effort: an unavailable store has nothing persisted to forget. Any pending
 * grant on this device is abandoned, which is the intent when leaving.
 */
export function browserForgetGrantKeys(): void {
  try {
    if (typeof localStorage !== "undefined") localStorage.removeItem(KEY);
  } catch {
    // Storage unavailable (private mode / SSR): nothing was persisted.
  }
}

function memory(): StorageLike {
  const map = new Map<string, string>();
  return {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => void map.set(k, v),
    removeItem: (k) => void map.delete(k),
  };
}
