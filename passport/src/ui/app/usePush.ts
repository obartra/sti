import { useCallback, useEffect, useMemo, useState } from "react";
import type { ApiClient } from "../../api/client.ts";
import type { OwnerSession } from "../../store/index.ts";
import {
  pushSupported,
  pushEnabled,
  enablePush,
  disablePush,
  type PushEnableResult,
} from "../../store/push.ts";
import { API_BASE_URL } from "../../config.ts";

/** The device-push controls surfaced to the UI (a Privacy toggle). */
export interface PushControls {
  /** This browser can do Web Push at all. */
  supported: boolean;
  /** There is at least one contact inbox to be woken for, so enabling can do
   * something. Push wakes this device when a linked contact reports a positive,
   * so with no contacts yet there is nothing to subscribe to. */
  ready: boolean;
  /** Push is currently enabled on this device. */
  enabled: boolean;
  /** An enable/disable is in flight. */
  busy: boolean;
  /** A human-readable reason the last enable did not succeed, else null. */
  error: string | null;
  enable: () => void;
  disable: () => void;
}

function messageFor(result: PushEnableResult): string | null {
  // A real failure carries its cause; surface it rather than a dead-end "try
  // again", so the user sees (and can report) what actually broke.
  if (typeof result === "object") {
    return `Couldn’t turn on notifications: ${result.failed}`;
  }
  switch (result) {
    case "enabled":
      return null;
    case "denied":
      return "Allow notifications in your browser to turn this on.";
    case "unsupported":
      return "This device can’t show notifications here.";
    case "unconfigured":
      return "Push isn’t available yet. You’ll still see alerts in the app.";
  }
}

/**
 * Device push for the partner-notify wake (slice 7). Hydrates `enabled` from the
 * worker's stored context, and enables/disables via the browser push flow. A null
 * session (logged out) or an account without a notify capability can't enable.
 */
export function usePush(
  api: ApiClient,
  session: OwnerSession | null,
): PushControls {
  const supported = useMemo(() => pushSupported(), []);
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // The owner's per-contact receiving inboxes (one per contact). A stable key for
  // the effect dep: the sorted inbox ids, so it re-checks only when the set changes.
  const caps = useMemo(
    () =>
      (session?.blob.contacts ?? [])
        .map((c) => c.myInbox)
        .filter((cap): cap is NonNullable<typeof cap> => cap !== undefined),
    [session],
  );
  const inboxKey = useMemo(
    () =>
      caps
        .map((c) => c.inboxId)
        .sort()
        .join(","),
    [caps],
  );

  // Re-check the device's enabled state when the contact set changes: enabled only
  // if the stored worker context holds exactly THIS account's per-contact inboxes.
  useEffect(() => {
    void pushEnabled(inboxKey === "" ? [] : inboxKey.split(",")).then(
      setEnabled,
    );
  }, [inboxKey]);

  const enable = useCallback(() => {
    if (!supported || caps.length === 0 || busy) return;
    setBusy(true);
    setError(null);
    void enablePush(api, API_BASE_URL, caps)
      .then((result) => {
        setEnabled(result === "enabled");
        setError(messageFor(result));
      })
      .finally(() => setBusy(false));
  }, [api, caps, supported, busy]);

  const disable = useCallback(() => {
    if (busy) return;
    setBusy(true);
    setError(null);
    void disablePush()
      .then(() => setEnabled(false))
      .finally(() => setBusy(false));
  }, [busy]);

  return {
    supported,
    ready: caps.length > 0,
    enabled,
    busy,
    error,
    enable,
    disable,
  };
}
