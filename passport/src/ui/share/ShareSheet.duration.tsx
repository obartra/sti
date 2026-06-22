import type { ReactElement } from "react";
import { Segmented } from "../../design/components/index.ts";

/* The share sheet's link-lifetime choice (doc 16): how long the link keeps
   resolving before the device sweeps it. Changing it moves the link's expiry in
   place (the URL is unchanged). Lifted out of ShareSheet to keep that file under
   its size/complexity caps; parallel to the identity choice row. */

// The lifetimes a link can carry. `days` is added to today; null = until-revoked.
// 24h is one epoch day (expiry is day-granular). Mirrors the per-contact options.
const DURATIONS: { key: string; label: string; days: number | null }[] = [
  { key: "1", label: "24h", days: 1 },
  { key: "7", label: "7 days", days: 7 },
  { key: "30", label: "30 days", days: 30 },
  { key: "none", label: "No expiry", days: null },
];

function keyFor(days: number | null): string {
  return DURATIONS.find((d) => d.days === days)?.key ?? "none";
}

function daysFor(key: string): number | null {
  return DURATIONS.find((d) => d.key === key)?.days ?? null;
}

export function DurationRow({
  choice,
  onChange,
}: {
  choice: number | null;
  // Absent hides the control (e.g. Storybook), so the parent can render it
  // unconditionally without a wrapping guard.
  onChange?: ((durationDays: number | null) => void) | undefined;
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
        onChange={(key) => onChange(daysFor(key))}
        options={DURATIONS.map((d) => ({ value: d.key, label: d.label }))}
      />
    </div>
  );
}
