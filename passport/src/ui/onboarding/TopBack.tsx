import type { CSSProperties } from "react";
import { Back } from "../../design/icons.tsx";

const backBtn: CSSProperties = {
  appearance: "none",
  border: "none",
  background: "var(--surface-card)",
  boxShadow: "var(--shadow-sm)",
  width: 36,
  height: 36,
  borderRadius: "50%",
  flex: "none",
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  color: "var(--text-body)",
};

// Shared onboarding step header: a round back button + the step label.
export function TopBack({
  title,
  onBack,
}: {
  title: string;
  onBack?: (() => void) | undefined;
}) {
  return (
    <div
      style={{ display: "flex", alignItems: "center", gap: 8, paddingTop: 2 }}
    >
      <button type="button" onClick={onBack} aria-label="Back" style={backBtn}>
        <Back size={20} />
      </button>
      <span
        style={{ fontSize: 13, fontWeight: 600, color: "var(--text-muted)" }}
      >
        {title}
      </span>
    </div>
  );
}
