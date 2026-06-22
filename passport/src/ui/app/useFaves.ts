import { useCallback, useState } from "react";
import type { StorageLike } from "../../auth/deviceStore.ts";

// Starred contacts ("faves") are a DEVICE-LOCAL display preference, never part of
// the synced account blob: keeping them off-blob means they add no server-visible
// data and no blob-size signal (doc 01 data minimization). They persist per device
// via localStorage and simply don't follow a recovery onto a new device, which is
// the right trade for a cosmetic pin. Stored as a JSON array of contact ids.
const FAVES_KEY = "sti.faves.v1";

function browserFavesStorage(): StorageLike {
  try {
    if (typeof window !== "undefined") return window.localStorage;
  } catch {
    // localStorage access can throw (e.g. private mode); fall through to volatile.
  }
  const map = new Map<string, string>();
  return {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => void map.set(k, v),
    removeItem: (k) => void map.delete(k),
  };
}

// One stable default instance, so the hook's default arg doesn't churn identity
// (or, in the volatile fallback, drop state) across renders.
const DEFAULT_STORAGE = browserFavesStorage();

function loadFaves(storage: StorageLike): Set<string> {
  try {
    const raw = storage.getItem(FAVES_KEY);
    if (raw === null) return new Set();
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((x): x is string => typeof x === "string"));
  } catch {
    return new Set();
  }
}

/**
 * The owner's starred contacts, device-local. Returns the current set and a toggle
 * that flips one contact's star and persists the whole set. A toggle for a revoked
 * contact's id is harmless (an orphan id is simply never rendered).
 */
export function useFaves(storage: StorageLike = DEFAULT_STORAGE): {
  faves: ReadonlySet<string>;
  toggleFave: (contactId: string) => void;
} {
  const [faves, setFaves] = useState<ReadonlySet<string>>(() =>
    loadFaves(storage),
  );

  const toggleFave = useCallback(
    (contactId: string) => {
      setFaves((prev) => {
        const next = new Set(prev);
        if (next.has(contactId)) next.delete(contactId);
        else next.add(contactId);
        try {
          storage.setItem(FAVES_KEY, JSON.stringify([...next]));
        } catch {
          // Best-effort persist; an unavailable store just keeps faves in memory.
        }
        return next;
      });
    },
    [storage],
  );

  return { faves, toggleFave };
}
