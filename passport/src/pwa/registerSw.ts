/**
 * Register the one service worker on startup, for everyone, so the installed app
 * opens offline (doc 22 slice 2). Best-effort: an unsupported browser or a missing
 * build (dev serves no /sw.js) is swallowed silently, never surfaced, so it can
 * never break a normal load. The same worker also handles push (doc 13); register
 * is idempotent, so the push-enable flow reusing it stays fine.
 */
export function registerServiceWorker(): void {
  if (
    typeof navigator === "undefined" ||
    !("serviceWorker" in navigator) ||
    typeof window === "undefined"
  ) {
    return;
  }
  window.addEventListener("load", () => {
    // The offline shell is an enhancement; if it can't register, the app runs as
    // a normal online page. Swallow rather than log, so a clean console stays clean.
    void navigator.serviceWorker.register("/sw.js").catch(() => undefined);
  });
}
