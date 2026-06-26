/**
 * Silent update adoption (doc 22 section E). When a NEWER worker finishes installing
 * while an old one still controls the page, we do NOT interrupt with a banner.
 * registerSw records the waiting worker here; the router adopts it at the user's NEXT
 * screen change (applyPendingUpdate), so the swap lands at a navigation boundary the
 * user initiated, never mid-interaction.
 *
 * Applying at a navigation (rather than immediately) also keeps a still-running old
 * page from requesting a code chunk the new deploy has dropped: the reload that the
 * controllerchange triggers happens right at that boundary, onto the new version. If
 * the user never navigates, the waiting worker adopts naturally on the next cold
 * start (standard lifecycle). Nothing here ever swaps a page out mid-use.
 */

interface UpdatableWorker {
  postMessage(message: unknown): void;
}

let waitingWorker: UpdatableWorker | null = null;
let reloading = false;

/** Called by registerSw when a newer worker is installed and waiting. */
export function notifyUpdateReady(worker: UpdatableWorker): void {
  waitingWorker = worker;
}

/**
 * Adopt a waiting update, if any: ask it to take over (the resulting
 * controllerchange reloads the page once onto the new version). A no-op when none is
 * waiting, so the router can call it on every navigation. Cleared after one apply.
 */
export function applyPendingUpdate(): void {
  const worker = waitingWorker;
  if (worker === null) return;
  waitingWorker = null;
  worker.postMessage({ type: "SKIP_WAITING" });
}

/** Reload once when the new worker takes control. Idempotent (no reload loop). */
export function reloadForUpdate(): void {
  if (reloading) return;
  reloading = true;
  window.location.reload();
}
