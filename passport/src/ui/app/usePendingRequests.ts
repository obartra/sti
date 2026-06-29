import { useCallback, useState } from "react";
import {
  browserPendingKnockStore,
  type PendingKnock,
  type PendingKnockStore,
} from "../../store/index.ts";

// The device-local list of access requests this viewer has made, surfaced so a
// logged-out viewer has a way back to a status the owner may later share. Like
// useFaves it reads a browser-backed store and is never part of the synced blob.
// The list is read on each render so it reflects a knock made elsewhere (the
// public resolution screen writes through a sibling store instance over the same
// localStorage); App re-renders on navigation, so returning to the landing or the
// requests screen always shows the current set.

// One stable default instance, so the hook's default arg doesn't churn identity
// (or, in the volatile fallback, drop state) across renders.
const DEFAULT_STORE = browserPendingKnockStore();

export interface PendingRequests {
  requests: PendingKnock[];
  /** Forget one request by alias id (the viewer dismissed it). */
  forget: (aliasId: string) => void;
}

export function usePendingRequests(
  store: PendingKnockStore = DEFAULT_STORE,
): PendingRequests {
  // A version counter to force a re-read after a forget; the list itself is read
  // straight from the store below, so a knock made on another screen shows up on
  // the next render without any cross-component subscription.
  const [, bump] = useState(0);
  const forget = useCallback(
    (aliasId: string) => {
      store.remove(aliasId);
      bump((n) => n + 1);
    },
    [store],
  );
  return { requests: store.list(), forget };
}
