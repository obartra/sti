/**
 * Slice 7 push enable/disable (the client half). Enabling wires the browser's Web
 * Push to the partner-notify wake: register the service worker, ask permission,
 * subscribe with the server's VAPID key, tell the server which routing endpoint
 * this subscription answers (the hash of THIS device's notify routing token, the
 * SAME hash a notifier uses to wake it), and stash the device's notify capability
 * in IndexedDB so the worker can poll+decrypt its own inbox on a background wake.
 * Disabling unsubscribes and clears that context.
 *
 * The wake only actually fires once the server has a VAPID key and a real device
 * holds a subscription; this module is the in-browser flow, validated on a device.
 */

import type { ApiClient } from "../api/client.ts";
import type { NotifyCapability } from "./notifyInbox.ts";
import {
  savePushContext,
  clearPushContext,
  readPushContext,
} from "../sw/pushStore.ts";
import {
  base64urlToBytes,
  sha256Base64url,
  utf8ToBytes,
} from "../crypto/index.ts";

/** How enabling resolved, so the UI can explain a non-success honestly. */
export type PushEnableResult =
  | "enabled"
  | "denied" // the OS/browser permission prompt was declined
  | "unsupported" // this browser can't do Web Push
  | "unconfigured" // the server has no VAPID key yet (nothing to subscribe to)
  | "error"; // SW registration / subscribe / network failure

const SW_URL = "/sw.js";

/** Whether this browser can do Web Push at all (SW + PushManager + Notification). */
export function pushSupported(): boolean {
  return (
    typeof navigator !== "undefined" &&
    "serviceWorker" in navigator &&
    typeof window !== "undefined" &&
    "PushManager" in window &&
    typeof Notification !== "undefined"
  );
}

/**
 * True when push is enabled on this device FOR this account: the stored worker
 * context must belong to the given inbox. Checking the inbox (not mere existence)
 * keeps the toggle honest when more than one account is used on one device, since
 * the context is a single device-wide slot. Undefined (logged out) is never enabled.
 */
export async function pushEnabled(
  inboxId: string | undefined,
): Promise<boolean> {
  if (inboxId === undefined) return false;
  const ctx = await readPushContext();
  return ctx?.cap.inboxId === inboxId;
}

// The endpoint id the server keys this subscription by: the hash of THIS device's
// own notify routing token, identical to the hash a sender uses to wake it, so a
// notify for this inbox routes a push back to this device. The server only ever
// sees the hash, never the token.
function routingEndpointId(cap: NotifyCapability): Promise<string> {
  return sha256Base64url(utf8ToBytes(cap.routingToken));
}

// Subscribe to push with the server's VAPID key and register the subscription +
// store the worker context. Split from enablePush so each stays within its
// statement ceiling. Assumes permission is already granted.
async function subscribeAndRegister(
  api: ApiClient,
  apiBase: string,
  cap: NotifyCapability,
  reg: ServiceWorkerRegistration,
): Promise<PushEnableResult> {
  const vapid = await api.getVapidPublicKey();
  if (vapid === null) return "unconfigured";
  const sub = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: base64urlToBytes(vapid),
  });
  const json = sub.toJSON();
  const p256dh = json.keys?.p256dh;
  const auth = json.keys?.auth;
  if (
    json.endpoint === undefined ||
    p256dh === undefined ||
    auth === undefined
  ) {
    return "error";
  }
  await api.registerPush({
    routingEndpointId: await routingEndpointId(cap),
    subscription: { endpoint: json.endpoint, keys: { p256dh, auth } },
  });
  await savePushContext({ apiBase, cap });
  return "enabled";
}

/**
 * Turn on push for this device + account. Best-effort and idempotent: a repeat
 * call re-subscribes and re-registers. Returns a result the UI surfaces; only
 * "enabled" persisted a context (so a non-success never half-enables the worker).
 */
export async function enablePush(
  api: ApiClient,
  apiBase: string,
  cap: NotifyCapability,
): Promise<PushEnableResult> {
  if (!pushSupported()) return "unsupported";
  try {
    const reg = await navigator.serviceWorker.register(SW_URL);
    const permission = await Notification.requestPermission();
    if (permission !== "granted") return "denied";
    return await subscribeAndRegister(api, apiBase, cap, reg);
  } catch {
    return "error";
  }
}

/**
 * Turn off push: unsubscribe (best-effort) and clear the worker's context. Never
 * rejects, so callers (incl. account deletion) can fire-and-forget; clearing the
 * context is what actually stops the worker, even if unsubscribe is unavailable.
 */
export async function disablePush(): Promise<void> {
  try {
    const reg = await navigator.serviceWorker.getRegistration(SW_URL);
    const sub = await reg?.pushManager.getSubscription();
    await sub?.unsubscribe();
  } catch {
    // ignore: the context clear below is the source of truth.
  }
  try {
    await clearPushContext();
  } catch {
    // ignore: best-effort (e.g. no IndexedDB in this environment).
  }
}
