/**
 * Local persistence of a device's passkey binding: exactly
 * `{ credentialId, wrappedRoot }` and nothing else. The wrapped root is the
 * account root sealed under the passkey's PRF output (auth/keyVault), so a
 * passkey re-unlocks the account on reload without re-typing the recovery phrase.
 *
 * SECURITY: this NEVER stores the root in the clear, the PRF output, or the
 * recovery phrase. The only at-rest secret is `wrappedRoot`, useless without
 * the passkey (GCM rejects a wrong/absent PRF output). Reads are fail-closed:
 * any structural surprise returns null, so the owner falls back to the phrase
 * rather than acting on a corrupt credential.
 *
 * Storage is injected (StorageLike) so the engine is unit-testable with an
 * in-memory map; the browser passes window.localStorage via browserDeviceStore().
 */

const KEY = "sti.device.v1";
const VERSION = 1;

/** The local passkey binding. base64url-encoded `wrappedRoot`. */
export interface DeviceCredential {
  readonly credentialId: string;
  readonly wrappedRoot: string;
  /** Transport hints from enroll, replayed on unlock to route back to the same
   * provider. A non-critical routing hint: a missing or malformed value just
   * drops it (the binding still loads), never fails the whole binding. */
  readonly transports?: AuthenticatorTransport[];
}

/** The subset of the Web Storage API this module uses. */
export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface DeviceStore {
  /** The stored binding, or null when absent or malformed (fail-closed). */
  load(): DeviceCredential | null;
  save(credential: DeviceCredential): void;
  /** Forget this device's passkey binding (the phrase still recovers). */
  clear(): void;
}

function isNonEmptyString(x: unknown): x is string {
  return typeof x === "string" && x.length > 0;
}

// Transports are a non-critical routing hint: read a list of strings, or drop
// it. Never fail the binding over a malformed hint (the unlock still works
// without it, just without the routing nudge).
function readTransports(x: unknown): AuthenticatorTransport[] | undefined {
  if (!Array.isArray(x)) return undefined;
  const list = x.filter((s): s is string => typeof s === "string");
  return list.length > 0 ? (list as AuthenticatorTransport[]) : undefined;
}

export function createDeviceStore(storage: StorageLike): DeviceStore {
  return {
    load() {
      const raw = storage.getItem(KEY);
      if (raw === null) return null;
      let parsed: unknown;
      try {
        parsed = JSON.parse(raw);
      } catch {
        return null;
      }
      if (typeof parsed !== "object" || parsed === null) return null;
      const o = parsed as Record<string, unknown>;
      if (o.v !== VERSION) return null;
      if (!isNonEmptyString(o.credentialId)) return null;
      if (!isNonEmptyString(o.wrappedRoot)) return null;
      const transports = readTransports(o.transports);
      return {
        credentialId: o.credentialId,
        wrappedRoot: o.wrappedRoot,
        ...(transports ? { transports } : {}),
      };
    },

    save(credential) {
      storage.setItem(
        KEY,
        JSON.stringify({
          v: VERSION,
          credentialId: credential.credentialId,
          wrappedRoot: credential.wrappedRoot,
          ...(credential.transports && credential.transports.length > 0
            ? { transports: credential.transports }
            : {}),
        }),
      );
    },

    clear() {
      storage.removeItem(KEY);
    },
  };
}

/**
 * A device store backed by window.localStorage, or null when it is unavailable
 * (server-side render, or a browser that throws on access in private mode). A
 * null return means the device cannot persist a passkey binding; the recovery
 * phrase remains the way back in.
 */
export function browserDeviceStore(): DeviceStore | null {
  try {
    if (typeof localStorage === "undefined") return null;
    // Touch the API: some browsers throw on access rather than at definition.
    localStorage.getItem(KEY);
    return createDeviceStore(localStorage);
  } catch {
    return null;
  }
}
