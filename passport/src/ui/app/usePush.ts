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
  switch (result) {
    case "enabled":
      return null;
    case "denied":
      return "Allow notifications in your browser to turn this on.";
    case "unsupported":
      return "This device can’t show notifications here.";
    case "unconfigured":
      return "Push isn’t available yet. You’ll still see alerts in the app.";
    case "error":
      return "Couldn’t turn on notifications. Try again.";
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

  // Re-check the device's enabled state when the account changes: enabled only if
  // the stored worker context belongs to THIS account's inbox.
  const inboxId = session?.blob.myNotify?.inboxId;
  useEffect(() => {
    void pushEnabled(inboxId).then(setEnabled);
  }, [inboxId]);

  const enable = useCallback(() => {
    const cap = session?.blob.myNotify;
    if (!supported || cap === undefined || busy) return;
    setBusy(true);
    setError(null);
    void enablePush(api, API_BASE_URL, cap)
      .then((result) => {
        setEnabled(result === "enabled");
        setError(messageFor(result));
      })
      .finally(() => setBusy(false));
  }, [api, session, supported, busy]);

  const disable = useCallback(() => {
    if (busy) return;
    setBusy(true);
    setError(null);
    void disablePush()
      .then(() => setEnabled(false))
      .finally(() => setBusy(false));
  }, [busy]);

  return { supported, enabled, busy, error, enable, disable };
}
