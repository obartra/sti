import { useRef, type RefObject } from "react";

/**
 * A ref that always holds the latest value, readable synchronously. Used where a
 * callback must see the current value (not a render-time capture), e.g. the owner
 * session so a write in flight never clobbers a later edit.
 */
export function useSyncedRef<T>(value: T): RefObject<T> {
  const ref = useRef(value);
  ref.current = value;
  return ref;
}
