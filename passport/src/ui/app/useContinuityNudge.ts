import { useCallback, useMemo, useState } from "react";
import type { StorageLike } from "../../auth/deviceStore.ts";
import {
  dueNudge,
  dismissNudge,
  type ContinuityNudge,
} from "./continuityNudge.ts";

// Device-local storage for the continuity cadence, mirroring useFaves: window
// localStorage when available, a volatile in-memory map otherwise (SSR / a private
// mode that throws). The cadence is timing, not account data, so it never leaves the
// device and never touches the synced blob (doc 32).
function browserContinuityStorage(): StorageLike {
  try {
    if (typeof window !== "undefined") return window.localStorage;
  } catch {
    // Access can throw (private mode); fall through to volatile.
  }
  const map = new Map<string, string>();
  return {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => void map.set(k, v),
    removeItem: (k) => void map.delete(k),
  };
}

// One stable default instance so the hook's default arg keeps a steady identity (and
// the volatile fallback does not drop state) across renders.
const DEFAULT_STORAGE = browserContinuityStorage();

/**
 * Which continuity nudge (if any) is due, plus a dismiss that records the time and
 * hides it for this session. `passwordSet` is whether the account has a password
 * factor (drives the yearly reminder). The due decision is read once per mount
 * (these prompts are rare, and re-checking on every render is needless), and a
 * dismiss both persists the timestamp and clears the on-screen nudge.
 */
export function useContinuityNudge(
  passwordSet: boolean,
  storage: StorageLike = DEFAULT_STORAGE,
): { nudge: ContinuityNudge | null; dismiss: () => void } {
  const initial = useMemo(
    () => dueNudge(storage, { passwordSet }),
    [storage, passwordSet],
  );
  const [nudge, setNudge] = useState<ContinuityNudge | null>(initial);

  const dismiss = useCallback(() => {
    setNudge((current) => {
      if (current !== null) dismissNudge(storage, current);
      return null;
    });
  }, [storage]);

  return { nudge, dismiss };
}
