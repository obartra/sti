import type { CSSProperties, ReactElement } from "react";
import { Button } from "../../design/components/index.ts";
import {
  X,
  Eye,
  Share,
  Link,
  Globe,
  Copy,
  Download,
  QrCode,
  ArrowRight,
  Refresh,
} from "../../design/icons.tsx";
import { BadgeCard } from "../badge-card.tsx";
import type { BadgeState, ProtectionLabel, Route } from "../badge-card.tsx";
import { Matrix, downloadPNG } from "../../lib/qr.tsx";

/* ShareSheet, the share modal opened by "Share my passport" and the share-rail
   buttons. Faithful port of the design prototype's ShareSheet (app/shell.jsx).
   It shows the badge card, the share URL + QR, a copy / save action, an
   add-to-wallet row, and (for private links) a revoke action. Two layouts:
   a centered desktop modal and a mobile bottom sheet with a grabber handle. */

type SharingMode = "public" | "link";

// Copy strings live inline in the prototype (not in copy.js), so they are kept
// here verbatim rather than threaded through the shared copy module.
const COPY = {
  titlePublic: "Share your passport",
  titleLink: "Share private link",
  reassurance: "This is everything they see. No test names, no dates.",
  labelPublic: "Public profile",
  labelLink: "Private link",
  notePublic: "Anyone who scans sees just this status.",
  noteLink: "Only people you send this private link to can open it.",
  copyLink: "Copy link",
  saveQr: "Save QR image",
  walletTitle: "Add to Apple or Google Wallet",
  walletSub: "Keep your pass a swipe away",
  revoke: "Revoke & renew",
  share: "Share",
} as const;

// Canonical opaque alias. Public carries the #fragment key; the private (link)
// form is the bare /a/{id}, its key is handed at share time.
const URL_PUBLIC = "sti.care/a/a7f3k9q2#k=Zr8";
const URL_LINK = "sti.care/a/a7f3k9q2";

// Resolve what the URL card renders: the real link when present (scheme stripped
// for display), else the placeholder so Storybook renders without a session. The
// QR seed tracks the alias id so it varies per link (the matrix is stylized).
function displayLink(
  realUrl: string | null | undefined,
  link: boolean,
): { url: string; seed: string } {
  const display = realUrl ?? `https://${link ? URL_LINK : URL_PUBLIC}`;
  const url = display.replace(/^https?:\/\//, "");
  const seed = url.split("/a/")[1]?.split(/[#?]/)[0] ?? "a7f3k9q2";
  return { url, seed };
}

export interface ShareSheetProps {
  open: boolean;
  onClose?: (() => void) | undefined;
  sharingMode?: SharingMode | undefined;
  state: BadgeState;
  labels?: ProtectionLabel[] | undefined;
  route?: Route | undefined;
  identity: { handle: string };
  avatarSrc?: string | undefined;
  /** The real shareable link. Null/absent falls back to a placeholder (Storybook). */
  url?: string | null | undefined;
  /** Copy the real link to the clipboard. */
  onCopy?: (() => void) | undefined;
  onRevoke?: (() => void) | undefined;
  onWallet?: (() => void) | undefined;
  desktop?: boolean | undefined;
}

function SheetHeader({
  link,
  onClose,
}: {
  link: boolean;
  onClose: (() => void) | undefined;
}): ReactElement {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: 16,
      }}
    >
      <div
        style={{ fontSize: 18, fontWeight: 700, color: "var(--text-strong)" }}
      >
        {link ? COPY.titleLink : COPY.titlePublic}
      </div>
      <button
        type="button"
        onClick={onClose}
        aria-label="Close"
        style={{
          appearance: "none",
          border: "none",
          background: "var(--surface-sunken)",
          width: 32,
          height: 32,
          borderRadius: "50%",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
          color: "var(--text-muted)",
        }}
      >
        <X size={16} />
      </button>
    </div>
  );
}

function UrlCard({
  link,
  url,
  seed,
  onCopy,
}: {
  link: boolean;
  url: string;
  seed: string;
  onCopy: (() => void) | undefined;
}): ReactElement {
  return (
    <div
      style={{
        display: "flex",
        gap: 12,
        alignItems: "center",
        background: "var(--surface-card)",
        borderRadius: "var(--radius-md)",
        padding: 14,
        boxShadow: "var(--shadow-sm)",
      }}
    >
      <Matrix seed={seed} size={64} color="var(--ink-900)" />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 12,
            fontWeight: 700,
            letterSpacing: "0.05em",
            textTransform: "uppercase",
            color: "var(--text-subtle)",
            display: "flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          {link ? <Link size={13} /> : <Globe size={13} />}{" "}
          {link ? COPY.labelLink : COPY.labelPublic}
        </div>
        <div
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 13.5,
            color: "var(--text-strong)",
            margin: "6px 0 6px",
            wordBreak: "break-all",
          }}
        >
          {url}
        </div>
        <div
          style={{
            fontSize: 11.5,
            color: "var(--text-subtle)",
            lineHeight: 1.45,
            marginBottom: 10,
          }}
        >
          {link ? COPY.noteLink : COPY.notePublic}
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Button
            variant="secondary"
            size="sm"
            icon={<Copy size={15} />}
            onClick={onCopy}
          >
            {COPY.copyLink}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            icon={<Download size={15} />}
            onClick={() => {
              downloadPNG({ status: "logo", seed });
            }}
          >
            {COPY.saveQr}
          </Button>
        </div>
      </div>
    </div>
  );
}

function WalletRow({
  onWallet,
}: {
  onWallet: (() => void) | undefined;
}): ReactElement {
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

function sheetStyleFor(desktop: boolean, open: boolean): CSSProperties {
  if (desktop)
    return {
      position: "absolute",
      top: "50%",
      left: "50%",
      width: 460,
      maxWidth: "calc(100vw - 48px)",
      maxHeight: "90vh",
      overflowY: "auto",
      background: "var(--surface-app)",
      borderRadius: "var(--radius-xl)",
      padding: "22px 22px 24px",
      boxShadow: "var(--shadow-xl)",
      transform: open
        ? "translate(-50%,-50%) scale(1)"
        : "translate(-50%,-47%) scale(0.98)",
      opacity: open ? 1 : 0,
      transition:
        "transform var(--dur-slow) var(--ease-out), opacity var(--dur-base) var(--ease-gentle)",
    };
  return {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    maxHeight: "92%",
    overflowY: "auto",
    background: "var(--surface-app)",
    borderTopLeftRadius: "var(--radius-xl)",
    borderTopRightRadius: "var(--radius-xl)",
    padding: "14px 20px 24px",
    boxShadow: "var(--shadow-xl)",
    transform: open ? "translateY(0)" : "translateY(100%)",
    transition: "transform var(--dur-slow) var(--ease-out)",
  };
}

export function ShareSheet(props: ShareSheetProps): ReactElement {
  const {
    open,
    onClose,
    sharingMode = "public",
    state,
    labels = [],
    route = null,
    identity,
    avatarSrc,
    url: realUrl,
    onCopy,
    onRevoke,
    onWallet,
    desktop = false,
  } = props;
  const link = sharingMode === "link";
  const { url, seed } = displayLink(realUrl, link);

  return (
    <div
      aria-hidden={!open}
      style={{
        position: desktop ? "fixed" : "absolute",
        inset: 0,
        zIndex: 30,
        pointerEvents: open ? "auto" : "none",
      }}
    >
      <div
        onClick={onClose}
        style={{
          position: "absolute",
          inset: 0,
          background: "rgba(27,27,47,0.42)",
          backdropFilter: "blur(2px)",
          WebkitBackdropFilter: "blur(2px)",
          opacity: open ? 1 : 0,
          transition: "opacity var(--dur-base) var(--ease-gentle)",
        }}
      />
      <div style={sheetStyleFor(desktop, open)}>
        {!desktop && (
          <div
            style={{
              width: 40,
              height: 4,
              borderRadius: 999,
              background: "var(--ink-200)",
              margin: "0 auto 16px",
            }}
          />
        )}
        <SheetHeader link={link} onClose={onClose} />
        <BadgeCard
          state={state}
          labels={labels}
          route={route}
          identity={identity}
          avatarSrc={avatarSrc}
          width="100%"
        />
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            justifyContent: "center",
            margin: "14px 0 14px",
            color: "var(--text-subtle)",
            fontSize: 12.5,
            textAlign: "center",
          }}
        >
          <Eye size={14} /> {COPY.reassurance}
        </div>
        <UrlCard link={link} url={url} seed={seed} onCopy={onCopy} />
        <WalletRow onWallet={onWallet} />
        <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
          {link && (
            <Button
              variant="quiet"
              size="lg"
              block
              icon={<Refresh size={17} />}
              onClick={onRevoke}
            >
              {COPY.revoke}
            </Button>
          )}
          <Button
            variant="primary"
            size="lg"
            block
            icon={<Share size={18} />}
            onClick={onClose}
          >
            {COPY.share}
          </Button>
        </div>
      </div>
    </div>
  );
}
