import type { ReactElement } from "react";
import { QrCode } from "../../design/icons.tsx";
import { ActionRow } from "../editorial/ActionRow.tsx";
import "./share-sheet.css";

/* Presentational bits of the share sheet, split out so ShareSheet.tsx stays under
   its size/complexity caps. Each gates its own visibility (returns null), so the
   parent renders them unconditionally. */

const COPY = {
  walletTitle: "Add to Apple or Google Wallet",
  walletSub: "Save your pass to your wallet",
} as const;

// The bottom-sheet grabber handle, mobile only.
export function Grabber({
  desktop,
}: {
  desktop: boolean;
}): ReactElement | null {
  if (desktop) return null;
  return <div className="sh__grabber" />;
}

// The add-to-wallet row. `show` gates it (the app passes features.WALLET_ENABLED,
// currently false: passes are built but gated off, pending signing certs). A
// hairline action row (doc 37), never a card with an icon tile.
export function WalletRow({
  show,
  onWallet,
}: {
  show: boolean;
  onWallet: (() => void) | undefined;
}): ReactElement | null {
  if (!show) return null;
  return (
    <div className="sh__wallet">
      <ActionRow
        lead={<QrCode size={18} />}
        title={COPY.walletTitle}
        sub={COPY.walletSub}
        onClick={onWallet}
      />
    </div>
  );
}
