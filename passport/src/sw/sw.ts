/**
 * The push service worker (slice 7). On a wake it polls this device's own notify
 * inbox and shows the standard, contentless nudge ONLY when a real ping is present
 * (under broadcast cover-wake every device is woken; only the real recipient's
 * inbox decrypts). The notification names no contact and carries no detail; tapping
 * it opens Care.
 *
 * Bundled to dist/sw.js by vite.sw.config.ts so it runs the SAME crypto as the app.
 * The SW global is hand-typed to the small surface used here, so this file stays in
 * the app's DOM tsconfig without pulling in the conflicting WebWorker lib.
 */

import { createApiClient } from "../api/client.ts";
import { consumePartnerPing } from "./swInbox.ts";
import { readPushContext } from "./pushStore.ts";

interface ExtendableEventLike {
  waitUntil(p: Promise<unknown>): void;
}
interface NotificationEventLike extends ExtendableEventLike {
  readonly notification: { close(): void };
}
interface WindowClientLike {
  focus(): Promise<unknown>;
}
interface SwScope {
  addEventListener(t: "push", l: (e: ExtendableEventLike) => void): void;
  addEventListener(
    t: "notificationclick",
    l: (e: NotificationEventLike) => void,
  ): void;
  registration: {
    showNotification(
      title: string,
      opts?: { body?: string; tag?: string; data?: unknown },
    ): Promise<void>;
  };
  clients: {
    matchAll(opts?: {
      type?: string;
      includeUncontrolled?: boolean;
    }): Promise<WindowClientLike[]>;
    openWindow(url: string): Promise<unknown>;
  };
}

const sw = self as unknown as SwScope;

// Constant copy: contentless, never names the contact (matches the in-app nudge).
const NUDGE_TITLE = "sti.care";
const NUDGE_BODY = "A recent contact suggests getting tested";
const CARE_URL = "/#care";

sw.addEventListener("push", (event) => {
  event.waitUntil(handleWake());
});

async function handleWake(): Promise<void> {
  const ctx = await readPushContext();
  if (ctx === null) return; // push not enabled on this device; ignore the wake.
  const api = createApiClient(ctx.apiBase);
  // One inbox per contact (doc 13). Poll them all; show the single contentless nudge
  // if ANY holds a real ping. Each consume clears its own inbox so a later cover wake
  // does not re-notify. Concurrent, and a failed read of one never masks another.
  const hits = await Promise.all(
    ctx.caps.map((cap) => consumePartnerPing(api, cap)),
  );
  if (hits.some((hit) => hit)) {
    await sw.registration.showNotification(NUDGE_TITLE, {
      body: NUDGE_BODY,
      tag: "partner-notify",
      data: { url: CARE_URL },
    });
  }
}

sw.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(focusOrOpen());
});

async function focusOrOpen(): Promise<void> {
  const wins = await sw.clients.matchAll({
    type: "window",
    includeUncontrolled: true,
  });
  const open = wins[0];
  if (open !== undefined) {
    await open.focus();
    return;
  }
  await sw.clients.openWindow(CARE_URL);
}
