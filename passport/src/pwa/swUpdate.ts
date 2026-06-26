/**
 * The update bus between the service worker registration (outside React) and the
 * in-app reload affordance (doc 22 slice 3). When a NEW worker finishes installing
 * while an old one still controls the page, registerSw calls notifyUpdateReady; the
 * UpdateBanner subscribes and offers a reload. applyUpdate asks the waiting worker
 * to take over (the worker calls skipWaiting on the SKIP_WAITING message), and the
 * resulting controllerchange reloads the page once onto the new version.
 *
 * User-initiated only: nothing here activates a new worker without the reload tap,
 * so a running page is never swapped out mid-use (doc 22 section E).
 */

interface UpdatableWorker {
  postMessage(message: unknown): void;
}

let waitingWorker: UpdatableWorker | null = null;
let ready = false;
let reloading = false;
const listeners = new Set<() => void>();

/** Called by registerSw when a newer worker is installed and waiting. */
export function notifyUpdateReady(worker: UpdatableWorker): void {
  waitingWorker = worker;
  ready = true;
  for (const listener of listeners) listener();
}

/** Whether an update is waiting (the banner's initial state). */
export function isUpdateReady(): boolean {
  return ready;
}

/** Subscribe to "an update became ready"; returns an unsubscribe. */
export function subscribeUpdate(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Ask the waiting worker to activate; controllerchange then reloads the page. */
export function applyUpdate(): void {
  waitingWorker?.postMessage({ type: "SKIP_WAITING" });
}

/** Reload once when the new worker takes control. Idempotent (no reload loop). */
export function reloadForUpdate(): void {
  if (reloading) return;
  reloading = true;
  window.location.reload();
}
