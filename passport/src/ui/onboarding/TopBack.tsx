import type { CSSProperties } from "react";
import { Chevron } from "../../design/icons.tsx";

const backBtn: CSSProperties = {
  appearance: "none",
  border: "none",
  background: "none",
  padding: "4px 6px 4px 0",
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  gap: 2,
  font: "inherit",
  fontSize: 14,
  fontWeight: 700,
  color: "var(--text-body)",
};

// Shared onboarding header row: a "Back" control on the left (chevron + label, a
// clear affordance) and the step progress on the right, so the two never read as
// the same thing.
export function TopBack({
  title,
  onBack,
}: {
  title: string;
  onBack?: (() => void) | undefined;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 8,
        paddingTop: 2,
      }}
    >
      <button type="button" onClick={onBack} style={backBtn}>
        <span
          style={{ display: "inline-flex", transform: "rotate(180deg)" }}
          aria-hidden="true"
        >
          <Chevron size={16} />
        </span>
        Back
      </button>
      {title && (
        <span
          style={{ fontSize: 12, fontWeight: 600, color: "var(--text-subtle)" }}
        >
          {title}
        </span>
      )}
    </div>
  );
}
