import type { ReactElement } from "react";
import "./demo-banner.css";

// Self-gating like NotBackedUp: the App renders it unconditionally and it returns
// null outside demo mode, so the demo branch never adds to the App's complexity.

/**
 * The persistent demo banner (doc 28, demo mode): an always-present bar marking
 * every demo screen, so a person can tell at a glance, even from a screenshot,
 * that this is the demo and never their real passport. It never dismisses; the
 * only control is the way out. Copy follows the voice guide (doc 21): plain and
 * honest about what the demo does and does not do.
 */
const COPY = "Demo. Nothing here is saved or sent.";
const LEAVE = "Leave demo";

export function DemoBanner({
  active,
  onExit,
}: {
  active: boolean;
  onExit: () => void;
}): ReactElement | null {
  // The bar sits in flow at the top of the .app-root flex column (doc 26): the
  // routed content fills the space below it, so it can never hide the top bar or
  // a sub-screen's back bar, with no measurement or offset bookkeeping.
  if (!active) return null;
  return (
    <div className="demo-banner" role="note">
      <span className="demo-banner__label">{COPY}</span>
      <button type="button" className="demo-banner__leave" onClick={onExit}>
        {LEAVE}
      </button>
    </div>
  );
}
