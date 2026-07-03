import type { ReactElement } from "react";
import { Button } from "../../design/components/index.ts";
import { DAY_MS, nowMs } from "../../core/clock.ts";
import "./share-sheet.css";

/* The private link's lifetime choice (doc 16): how long the link keeps working
   before it stops on its own. Changing it moves the link's expiry in place (the
   URL is unchanged). Only the private link has this; a public profile stays live
   until you turn it off. Lifted out of ShareSheet to keep that file under its
   size/complexity caps. The choice uses the sheet's button grammar (selected =
   filled), same as the identity choice above it; the Segmented control is
   retired (doc 37). */

// The lifetimes a private link can carry, as a duration in ms from now (doc 16);
// null means it keeps working until the owner turns it off.
const DURATIONS: { key: string; label: string; ms: number | null }[] = [
  { key: "1d", label: "1 day", ms: DAY_MS },
  { key: "7d", label: "7 days", ms: 7 * DAY_MS },
  { key: "30d", label: "30 days", ms: 30 * DAY_MS },
  { key: "none", label: "Until I turn it off", ms: null },
];

function msFor(key: string): number | null {
  return DURATIONS.find((d) => d.key === key)?.ms ?? null;
}

// Map a stored duration back to the choice to highlight. An expiry is stored as
// an absolute instant, so a saved link reopens with the offered length nearest to
// what remains; null (and any unmatched value) lands on "until I turn it off".
function keyFor(durationMs: number | null): string {
  if (durationMs === null) return "none";
  let best = "none";
  let bestGap = Infinity;
  for (const d of DURATIONS) {
    if (d.ms === null) continue;
    const gap = Math.abs(d.ms - durationMs);
    if (gap < bestGap) {
      bestGap = gap;
      best = d.key;
    }
  }
  return best;
}

// The current selection derived from an alias's absolute `expiresAt` (or
// undefined/null when the link has no expiry): the remaining time snapped to the
// nearest offered length, so the row highlights a sensible choice on reopen.
export function lifetimeFromExpiry(
  expiresAt: number | null | undefined,
): number | null {
  if (expiresAt === null || expiresAt === undefined) return null;
  return msFor(keyFor(expiresAt - nowMs()));
}

export function LifetimeRow({
  choice,
  onChange,
}: {
  choice: number | null;
  // Absent hides the control (e.g. Storybook / public mode), so the parent can
  // render it unconditionally without a wrapping guard.
  onChange?: ((durationMs: number | null) => void) | undefined;
}): ReactElement | null {
  if (onChange === undefined) return null;
  const current = keyFor(choice);
  return (
    <div className="sh__row">
      <div className="sh__label">Link lasts</div>
      <div
        className="sh__choice-row sh__choice-row--wrap"
        role="group"
        aria-label="Link lasts"
      >
        {DURATIONS.map((d) => (
          <Button
            key={d.key}
            variant={current === d.key ? "primary" : "quiet"}
            size="sm"
            onClick={() => onChange(d.ms)}
          >
            {d.label}
          </Button>
        ))}
      </div>
    </div>
  );
}
