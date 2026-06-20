import { useCallback, useEffect, useState } from "react";
import { Segmented } from "../../design/components/index.ts";
import {
  avatarSrc as avatarSrcFor,
  type AvatarConfigInput,
} from "../../lib/avatars.ts";
import type { BadgeState, ProtectionLabel, Route } from "../badge-card.tsx";
import { COPY, HANDLE, WALLET_FRESH_HOURS, livePassState } from "./shared.tsx";
import type { SharingMode, WalletFormat } from "./shared.tsx";
import { ApplePass, GooglePass } from "./passes.tsx";
import { ConfirmPublic, WalletAction } from "./controls.tsx";
import {
  FormatSection,
  ShareSection,
  TrustFooter,
  WalletHeader,
} from "./screen-parts.tsx";

// Public re-exports kept on Wallet.tsx so existing importers (stories, etc.)
// keep resolving the same names from the same module.
export {
  WALLET_FRESH_HOURS,
  aliasUrl,
  livePassState,
  wordFor,
} from "./shared.tsx";
export type {
  LivePassStateInput,
  PassProps,
  SharingMode,
  WalletFormat,
} from "./shared.tsx";
export { ApplePass, GooglePass } from "./passes.tsx";
export { ShareCard } from "./share-card.tsx";

/* ── The Wallet screen ───────────────────────────────────────────────── */
export interface WalletProps {
  sharingMode?: SharingMode;
  // The owner's viewer-facing badge (already gray when paused). Live applies
  // the fail-closed resolver on top; QR-carrier never shows status at all.
  viewerBadge?: BadgeState;
  labels?: ProtectionLabel[];
  blueRoute?: Route;
  avatar?: AvatarConfigInput;
  // Driven by the dev panel in the real app so a reviewer can reach the
  // QR-carrier, Live-fresh, and Live-stale→gray faces; in-screen controls write
  // back through onSetTweak.
  walletFormat?: WalletFormat;
  walletFresh?: "fresh" | "stale";
  // nav.* / setTweak replacement: optional callbacks the screen routes its
  // writes through. Left undefined in isolation (e.g. Storybook).
  onSetTweak?: ((key: string, value: string) => void) | undefined;
}

interface WalletDerived {
  isPublic: boolean;
  format: WalletFormat;
  live: boolean;
  setFormat: (v: WalletFormat) => void;
  setReachable: (v: boolean) => void;
  passState: BadgeState;
  avatarSrc: string;
}

function useWalletDerived({
  sharingMode = "public",
  viewerBadge = "blue",
  avatar = 2,
  walletFormat = "qr",
  walletFresh = "fresh",
  onSetTweak,
}: WalletProps): WalletDerived {
  const isPublic = sharingMode === "public";
  // Format + Live freshness are driven by walletFormat / walletFresh so a
  // reviewer can reach the QR-carrier, Live-fresh, and Live-stale→gray faces;
  // the in-screen controls write back.
  const format: WalletFormat = walletFormat === "live" ? "live" : "qr";
  const setFormat = useCallback(
    (v: WalletFormat) => onSetTweak?.("walletFormat", v),
    [onSetTweak],
  );
  // The "Live freshness" tweak (walletFresh) stands in for "the pass can't reach
  // the server / its last read is stale" so a reviewer can SEE the fail-closed
  // face. It is NOT a user-facing control and never appears on the pass itself.
  const reachable = walletFresh !== "stale";
  const setReachable = (v: boolean) =>
    onSetTweak?.("walletFresh", v ? "fresh" : "stale");

  // A live pass can only exist on a public alias. If the alias goes private
  // while Live is selected, fall back to the QR format.
  useEffect(() => {
    if (!isPublic && format === "live") setFormat("qr");
  }, [isPublic, format, setFormat]);

  const now = Date.now();
  const lastSyncAt = reachable ? now : now - (WALLET_FRESH_HOURS + 6) * 3.6e6;
  const passState = livePassState({
    ownerBadge: viewerBadge,
    reachable,
    lastSyncAt,
    now,
  });

  return {
    isPublic,
    format,
    live: format === "live",
    setFormat,
    setReachable,
    passState,
    avatarSrc: avatarSrcFor(avatar),
  };
}

export function Wallet(props: WalletProps) {
  const { labels = [], blueRoute = null } = props;
  const {
    isPublic,
    format,
    live,
    setFormat,
    setReachable,
    passState,
    avatarSrc,
  } = useWalletDerived(props);
  const [platform, setPlatform] = useState<"apple" | "google">("apple");
  const [added, setAdded] = useState<{ apple: boolean; google: boolean }>({
    apple: false,
    google: false,
  });
  const [confirm, setConfirm] = useState(false);

  const PassEl = platform === "apple" ? ApplePass : GooglePass;

  const selectLive = () => {
    if (isPublic) {
      setFormat("live");
      return;
    }
    setConfirm(true); // private alias → must confirm make-public first
  };

  return (
    <div
      style={{
        width: "100%",
        maxWidth: 390,
        display: "flex",
        flexDirection: "column",
        gap: 18,
        position: "relative",
      }}
    >
      <WalletHeader />

      {/* 1 · format choice, gated by privacy */}
      <FormatSection
        isPublic={isPublic}
        live={live}
        setFormat={setFormat}
        selectLive={selectLive}
        onMakePublic={() => setConfirm(true)}
      />

      {/* 2 · platform + the live preview-state control */}
      <Segmented<"apple" | "google">
        options={[
          { value: "apple", label: COPY.appleWallet },
          { value: "google", label: COPY.googleWallet },
        ]}
        value={platform}
        onChange={setPlatform}
      />

      <div
        style={{
          display: "flex",
          justifyContent: "center",
          padding: "4px 0 6px",
        }}
      >
        <PassEl
          format={format}
          state={passState}
          labels={labels}
          route={blueRoute}
          handle={HANDLE}
          avatarSrc={avatarSrc}
          isPublic={isPublic}
        />
      </div>

      {/* The fail-closed "stale → gray" behavior is driven by the dev panel
          (Tweaks › Wallet › Live freshness); a real user just sees their pass,
          never a "see how this behaves" demo control. */}

      {/* 3 · add to wallet */}
      <WalletAction
        platform={platform}
        added={added[platform]}
        onAdd={() => setAdded((p) => ({ ...p, [platform]: true }))}
        onRemove={() => setAdded((p) => ({ ...p, [platform]: false }))}
      />

      {/* 4 · standalone shareable card */}
      <ShareSection isPublic={isPublic} avatarSrc={avatarSrc} />

      {/* trust footer, format-aware */}
      <TrustFooter live={live} />

      {confirm && (
        <ConfirmPublic
          onKeep={() => setConfirm(false)}
          onConfirm={() => {
            props.onSetTweak?.("sharing", "public");
            setFormat("live");
            setReachable(true);
            setConfirm(false);
          }}
        />
      )}
    </div>
  );
}
