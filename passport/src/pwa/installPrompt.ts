/**
 * The install affordance's data layer (doc 22 section F). Chromium fires
 * `beforeinstallprompt` once, possibly before any screen has mounted, so we capture
 * it at app boot and let the Settings install row read it later. We suppress the
 * browser's own mini-infobar and surface a single quiet row instead, never a modal.
 *
 * This is client-only and reveals nothing: install-vs-browser is read here, never
 * sent (S5). On iOS there is no event (install is manual Add-to-Home-Screen), and
 * once installed the event never fires, so the row simply stays absent.
 */

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  readonly userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

declare global {
  interface WindowEventMap {
    beforeinstallprompt: BeforeInstallPromptEvent;
  }
}

let deferred: BeforeInstallPromptEvent | null = null;
const listeners = new Set<() => void>();
const notify = (): void => {
  for (const l of listeners) l();
};

/** Start listening for the install prompt. Idempotent intent; call once at boot. */
export function initInstallPrompt(): void {
  if (typeof window === "undefined") return;
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault(); // suppress the mini-infobar; we offer our own quiet row
    deferred = e;
    notify();
  });
  window.addEventListener("appinstalled", () => {
    deferred = null; // installed: the row disappears
    notify();
  });
}

/** Whether the browser has offered an install prompt we can fire. */
export function installAvailable(): boolean {
  return deferred !== null;
}

/**
 * Fire the stored prompt and resolve after the user's choice. The browser only
 * allows one use, so it is cleared either way; a decline just leaves no row.
 */
export async function promptInstall(): Promise<void> {
  const e = deferred;
  if (e === null) return;
  deferred = null;
  notify();
  await e.prompt();
}

/** Subscribe to availability changes (prompt captured, or app installed). */
export function subscribeInstall(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** True when the app is already running installed (standalone display mode). */
export function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  const displayMode = window.matchMedia("(display-mode: standalone)").matches;
  // iOS Safari predates display-mode and sets navigator.standalone instead.
  const iosStandalone =
    (navigator as Navigator & { standalone?: boolean }).standalone === true;
  return displayMode || iosStandalone;
}

/** True for iOS Safari, which has no install event (install is manual A2HS). */
export function isIOS(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  // iPhone/iPod, plus iPadOS which now reports as a Mac but has a touch screen.
  return (
    /iPad|iPhone|iPod/.test(ua) ||
    (ua.includes("Macintosh") && navigator.maxTouchPoints > 1)
  );
}
