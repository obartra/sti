import type { CSSProperties, ReactNode } from "react";
import { Back } from "../../design/icons.tsx";
import { TrustFooter, type TrustFooterProps } from "./TrustFooter.tsx";

// Layout for a public trust page (promises, privacy, terms): a back control (the
// pages are always navigated TO, and the public canvas provides none of its own)
// plus the shared trust footer under the content.

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

export interface TrustPageProps extends TrustFooterProps {
  onBack?: (() => void) | undefined;
  /** Use the full desktop measure (the promises grid) rather than the narrow
   * reading column the legal pages want. */
  wide?: boolean;
  children: ReactNode;
}

export function TrustPage({
  onBack,
  wide = false,
  children,
  ...footer
}: TrustPageProps) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 16,
        width: "100%",
        maxWidth: wide ? 720 : 460,
      }}
    >
      {onBack && (
        <div style={{ alignSelf: "flex-start" }}>
          <button
            type="button"
            onClick={onBack}
            aria-label="Back"
            style={backBtn}
          >
            <Back size={20} />
          </button>
        </div>
      )}
      {children}
      <TrustFooter {...footer} />
    </div>
  );
}
