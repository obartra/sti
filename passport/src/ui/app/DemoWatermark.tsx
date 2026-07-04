import type { ReactElement } from "react";
import "./demo-watermark.css";

// Self-gating like DemoBanner/NotBackedUp: the App renders it unconditionally and it
// returns null outside demo mode, so the demo branch never adds to App's complexity.

/**
 * The persistent demo watermark (doc 28 D): a fixed, non-interactive accent frame
 * drawn over every demo screen. Paired with the top banner, it makes the demo
 * unmistakable at a glance and, unlike a one-line banner that a tight crop can miss,
 * rings the whole viewport so a full-screen capture is obviously the demo and never
 * reads as a real, shared card. Pointer-events are off, so it is purely visual and
 * never intercepts a tap. Editorial (doc 37): tokens only, no raw hex, no surface
 * teal, just the accent as a hairline ring and a quiet corner wordmark.
 */
const MARK = "Demo";

export function DemoWatermark({
  active,
}: {
  active: boolean;
}): ReactElement | null {
  if (!active) return null;
  return (
    <div className="demo-watermark" aria-hidden="true">
      <span className="demo-watermark__mark">{MARK}</span>
    </div>
  );
}
