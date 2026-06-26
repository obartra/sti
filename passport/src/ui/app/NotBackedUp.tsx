import type { ReactElement } from "react";
import "./not-backed-up.css";

/**
 * The passive not-backed-up marker (doc 22 slice 4): a single quiet pill shown only
 * while this device holds owner edits the server has not received yet. It never
 * nags, takes no action, and clears itself the moment the drain backs the edits up.
 * Copy follows the voice guide (doc 21): plain, calm, honest about the local stake.
 */
const COPY = "Saved on this device. It backs up when you're online.";

export function NotBackedUp({
  pending,
}: {
  pending: boolean;
}): ReactElement | null {
  if (!pending) return null;
  return (
    <div className="not-backed-up" role="status" aria-live="polite">
      {COPY}
    </div>
  );
}
