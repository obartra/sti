/**
 * Turning push on/off for a device (slice 7), app-side. Kept as a pure orchestration
 * over an injectable browser seam (PushPlatform) so the wiring is testable and the
 * one device-specific part (permission + PushManager) stays isolated.
 *
 * Enable: confirm support + that the server has VAPID keys, ask permission, subscribe
 * with the public key, register the subscription under hash(myNotify.routingToken)
 * (the SAME key a contact's wake targets), and save the inbox capability to
 * IndexedDB so the service worker can poll in the background. Disable: unsubscribe +
 * forget the capability so the worker stops.
 */

import type { ApiClient } from "../api/client.ts";
import type { PushSubscription } from "../api/contract.ts";
import type { NotifyCapability } from "./notifyInbox.ts";
import { routingHash } from "./partnerNotify.ts";
import { savePushContext, clearPushContext } from "../sw/pushStore.ts";

/** The browser-specific seam: SW registration + permission + PushManager. */
export interface PushPlatform {
  /** Web Push + service workers + notifications are all available here. */
  supported(): boolean;
  /** Prompt (or read) the notification permission. */
  requestPermission(): Promise<NotificationPermission>;
  /** Register the SW and subscribe with the VAPID key; returns the wire shape. */
  subscribe(vapidPublicKey: string): Promise<PushSubscription>;
  /** Drop the current push subscription, if any. */
  unsubscribe(): Promise<void>;
}

/** Why enabling push did not complete, or that it did. */
export type EnablePushResult =
  | "enabled"
  | "unsupported" // this browser can't do Web Push
  | "no-keys" // the server has no VAPID keys configured (push off server-side)
  | "denied"; // the user declined the permission prompt

export interface EnablePushDeps {
  api: Pick<ApiClient, "getVapidPublicKey" | "registerPush">;
  platform: PushPlatform;
  /** This device's own notify capability (from the account blob). */
  cap: NotifyCapability;
  /** The api origin the worker will call (stored for the background poll). */
  apiBase: string;
}

export async function enablePush(
  deps: EnablePushDeps,
): Promise<EnablePushResult> {
  if (!deps.platform.supported()) return "unsupported";
  const vapid = await deps.api.getVapidPublicKey();
  if (vapid === null) return "no-keys";
  const permission = await deps.platform.requestPermission();
  if (permission !== "granted") return "denied";

  const subscription = await deps.platform.subscribe(vapid);
  await deps.api.registerPush({
    routingEndpointId: await routingHash(deps.cap.routingToken),
    subscription,
  });
  // Last: persist the capability so the worker can poll. Done after a successful
  // register so a half-enabled device never leaves the worker polling for nothing.
  await savePushContext({ apiBase: deps.apiBase, cap: deps.cap });
  return "enabled";
}

export async function disablePush(platform: PushPlatform): Promise<void> {
  // Forget the capability first so the worker stops notifying even if unsubscribe
  // fails; then drop the subscription (best-effort).
  await clearPushContext();
  await platform.unsubscribe();
}
