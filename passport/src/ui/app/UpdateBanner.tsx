import { useEffect, useState, type ReactElement } from "react";
import {
  isUpdateReady,
  subscribeUpdate,
  applyUpdate,
} from "../../pwa/swUpdate.ts";
import "./update-banner.css";

/**
 * The quiet "a new version is ready" affordance (doc 22 slice 3). It renders only
 * once a newer worker is actually installed and waiting, and is dismissible, so it
 * never nags. Reloading is the user's choice; the next cold start picks the update
 * up regardless. Copy follows the voice guide (doc 21): plain, calm, outcome-first.
 */
const COPY = {
  message: "A newer version is ready.",
  reload: "Reload",
  dismiss: "Not now",
};

export function UpdateBanner(): ReactElement | null {
  const [ready, setReady] = useState(isUpdateReady);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => subscribeUpdate(() => setReady(true)), []);

  if (!ready || dismissed) return null;
  return (
    <div className="update-banner" role="status" aria-live="polite">
      <span className="update-banner__text">{COPY.message}</span>
      <button
        type="button"
        className="update-banner__reload"
        onClick={applyUpdate}
      >
        {COPY.reload}
      </button>
      <button
        type="button"
        className="update-banner__dismiss"
        onClick={() => setDismissed(true)}
      >
        {COPY.dismiss}
      </button>
    </div>
  );
}
