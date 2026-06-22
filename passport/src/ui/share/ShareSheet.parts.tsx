import type { ReactElement } from "react";
import { QrCode, ArrowRight } from "../../design/icons.tsx";

/* Presentational bits of the share sheet, split out so ShareSheet.tsx stays under
   its size/complexity caps. Each gates its own visibility (returns null), so the
   parent renders them unconditionally. */

const COPY = {
  walletTitle: "Add to Apple or Google Wallet",
  walletSub: "Keep your pass a swipe away",
} as const;

// The bottom-sheet grabber handle, mobile only.
export function Grabber({
  desktop,
}: {
  desktop: boolean;
}): ReactElement | null {
  if (desktop) return null;
  return (
    <div
      style={{
        width: 40,
        height: 4,
        borderRadius: 999,
        background: "var(--ink-200)",
        margin: "0 auto 16px",
      }}
    />
  );
}

// The add-to-wallet row. `show` gates it (the app passes features.WALLET_ENABLED,
// currently false: passes are built but gated off, pending signing certs).
export function WalletRow({
  show,
  onWallet,
}: {
  show: boolean;
  onWallet: (() => void) | undefined;
}): ReactElement | null {
  if (!show) return null;
  return (
    <button
      type="button"
      onClick={onWallet}
      style={{
        appearance: "none",
        cursor: "pointer",
        width: "100%",
        marginTop: 12,
        textAlign: "left",
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "12px 14px",
        borderRadius: "var(--radius-md)",
        border: "1px solid var(--border-card)",
        background: "var(--surface-card)",
        boxShadow: "var(--shadow-sm)",
      }}
    >
      <span
        style={{
          flex: "none",
          width: 38,
          height: 38,
          borderRadius: "var(--radius-sm)",
          background: "#1B1B2F",
          color: "#fff",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <QrCode size={19} />
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 14.5,
            fontWeight: 700,
            color: "var(--text-strong)",
          }}
        >
          {COPY.walletTitle}
        </div>
        <div style={{ fontSize: 12.5, color: "var(--text-muted)" }}>
          {COPY.walletSub}
        </div>
      </div>
      <ArrowRight
        size={18}
        style={{ color: "var(--text-subtle)", flex: "none" }}
      />
    </button>
  );
}
