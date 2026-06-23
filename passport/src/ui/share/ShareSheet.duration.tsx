import type { ReactElement } from "react";
import { Segmented } from "../../design/components/index.ts";
import { HOUR_MS, DAY_MS } from "../../core/clock.ts";

/* The share sheet's link-lifetime choice (doc 16): how long the link keeps
   resolving before the server stops answering for it (and the device sweeps it).
   Changing it moves the link's expiry in place (the URL is unchanged). Lifted out
   of ShareSheet to keep that file under its size/complexity caps. */

// The lifetimes a link can carry, as a duration in ms from now (doc 16); null =
// until-revoked. Absolute ms so a link can be sub-day (the 1h option).
const DURATIONS: { key: string; label: string; ms: number | null }[] = [
  { key: "1h", label: "1h", ms: HOUR_MS },
  { key: "24h", label: "24h", ms: DAY_MS },
  { key: "7d", label: "7 days", ms: 7 * DAY_MS },
  { key: "30d", label: "30 days", ms: 30 * DAY_MS },
  { key: "none", label: "No expiry", ms: null },
];

function keyFor(ms: number | null): string {
  return DURATIONS.find((d) => d.ms === ms)?.key ?? "none";
}

function msFor(key: string): number | null {
  return DURATIONS.find((d) => d.key === key)?.ms ?? null;
}

export function DurationRow({
  choice,
  onChange,
}: {
  choice: number | null;
  // Absent hides the control (e.g. Storybook), so the parent can render it
  // unconditionally without a wrapping guard.
  onChange?: ((durationMs: number | null) => void) | undefined;
}): ReactElement | null {
  if (onChange === undefined) return null;
  return (
    <div style={{ margin: "0 0 14px" }}>
      <div
        style={{
          fontSize: 12,
          fontWeight: 700,
          letterSpacing: "0.05em",
          textTransform: "uppercase",
          color: "var(--text-subtle)",
          marginBottom: 8,
        }}
      >
        Link lasts
      </div>
      <Segmented
        aria-label="Link lifetime"
        value={keyFor(choice)}
        onChange={(key) => onChange(msFor(key))}
        options={DURATIONS.map((d) => ({ value: d.key, label: d.label }))}
      />
    </div>
  );
}
