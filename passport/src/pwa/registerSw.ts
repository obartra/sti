/**
 * Register the one service worker on startup, for everyone, so the installed app
 * opens offline (doc 22 slice 2) and can offer an in-app update (slice 3).
 * Best-effort: an unsupported browser or a missing build (dev serves no /sw.js) is
 * swallowed silently, never surfaced, so it can never break a normal load. The same
 * worker also handles push (doc 13); register is idempotent.
 */
import { notifyUpdateReady, reloadForUpdate } from "./swUpdate.ts";

export function registerServiceWorker(): void {
  if (
    typeof navigator === "undefined" ||
    !("serviceWorker" in navigator) ||
    typeof window === "undefined"
  ) {
    return;
  }
  window.addEventListener("load", () => {
    void registerAndWatch();
  });
}

async function registerAndWatch(): Promise<void> {
  try {
    const registration = await navigator.serviceWorker.register("/sw.js");
    registration.addEventListener("updatefound", () => {
      watchInstalling(registration.installing);
    });
    // When a waiting update is adopted at the next screen change (doc 22 E, silent),
    // the waiting worker activates and the controller changes; reload once onto it.
    navigator.serviceWorker.addEventListener(
      "controllerchange",
      reloadForUpdate,
    );
  } catch {
    // Offline shell is an enhancement; a failed register leaves a normal online app.
  }
}

function watchInstalling(worker: ServiceWorker | null): void {
  if (worker === null) return;
  worker.addEventListener("statechange", () => {
    // A worker that reaches "installed" while one is already controlling is an
    // UPDATE waiting to take over, not the first install. Record it; the router
    // adopts it silently at the user's next screen change (doc 22 E).
    if (
      worker.state === "installed" &&
      navigator.serviceWorker.controller !== null
    ) {
      notifyUpdateReady(worker);
    }
  });
}
