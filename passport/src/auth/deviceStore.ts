/**
 * Local persistence of a device's passkey binding: exactly
 * `{ credentialId, wrappedMaster }` and nothing else. The wrapped master is the
 * account master sealed under the passkey's PRF output (auth/keyVault), so a
 * passkey re-unlocks the account on reload without re-typing the recovery phrase.
 *
 * SECURITY: this NEVER stores the master in the clear, the PRF output, or the
 * recovery phrase. The only at-rest secret is `wrappedMaster`, useless without
 * the passkey (GCM rejects a wrong/absent PRF output). Reads are fail-closed:
 * any structural surprise returns null, so the owner falls back to the phrase
 * rather than acting on a corrupt credential.
 *
 * Storage is injected (StorageLike) so the engine is unit-testable with an
 * in-memory map; the browser passes window.localStorage via browserDeviceStore().
 */

const KEY = "sti.device.v1";
const VERSION = 1;

/** The local passkey binding. base64url-encoded `wrappedMaster`. */
export interface DeviceCredential {
  readonly credentialId: string;
  readonly wrappedMaster: string;
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
      if (!isNonEmptyString(o.wrappedMaster)) return null;
      return {
        credentialId: o.credentialId,
        wrappedMaster: o.wrappedMaster,
      };
    },

    save(credential) {
      storage.setItem(
        KEY,
        JSON.stringify({
          v: VERSION,
          credentialId: credential.credentialId,
          wrappedMaster: credential.wrappedMaster,
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
