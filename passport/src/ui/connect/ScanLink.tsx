import { useState } from "react";
import { Button, Card, Avatar } from "../../design/components/index.ts";
import { Check, Lock, Clock } from "../../design/icons.tsx";
import { Matrix } from "../../lib/qr.tsx";
import { avatarFor } from "../../lib/avatars.ts";

// ScanLink: a scan PROPOSES a link both confirm; never silently binds.
// Exchanges an alias ref + a pairwise notify-token, never the handle/account.
// Faithful port of comps-reference/app/connect.jsx (the ScanLink component plus
// the HandleAvatar helper it uses), copy verbatim from the connect object in
// copy.js. No badge/status is surfaced anywhere on this screen.
const COPY = {
  scanTitle: "Scan to link",
  scanPropose: "Link with @{h}?",
  scanProposeSub: "From the code you just scanned",
  scanPoints: [
    "They’ll be added to your linkups, and you to theirs.",
    "Either of you can later send the other an anonymous heads-up to get tested.",
    "Nothing about your account or your other aliases is shared, just this alias.",
  ],
  scanCancel: "Not now",
  scanSend: "Send link request",
  scanPending: "Links only when @{h} confirms too.",
  scanExchangeNote:
    "You stay in control. Either of you can remove this linkup anytime, and there’s no directory, so no one can look you up.",
} as const;

function HandleAvatar({
  handle,
  size = "md",
}: {
  handle: string;
  size?: "sm" | "md" | "lg";
}) {
  const name = handle.replace(/[^a-z]/gi, " ").trim() || handle;
  return (
    <Avatar initials={name} alt={name} src={avatarFor(handle)} size={size} />
  );
}

// Faux scanner viewport: the scanned code rendered behind four corner brackets.
function ScannerViewport({ targetAlias }: { targetAlias: string }) {
  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        aspectRatio: "1 / 1",
        borderRadius: "var(--radius-lg)",
        overflow: "hidden",
        background: "var(--ink-900)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div style={{ width: "62%", height: "62%", opacity: 0.92 }}>
        <Matrix size={210} seed={targetAlias} hole={9} color="#fff" />
      </div>
      {(["tl", "tr", "bl", "br"] as const).map((p) => (
        <span
          key={p}
          style={{
            position: "absolute",
            width: 34,
            height: 34,
            border: "3px solid var(--accent)",
            ...(p.startsWith("t")
              ? { top: 18, borderBottom: "none" }
              : { bottom: 18, borderTop: "none" }),
            ...(p[1] === "l"
              ? { left: 18, borderRight: "none" }
              : { right: 18, borderLeft: "none" }),
            borderRadius:
              p === "tl"
                ? "10px 0 0 0"
                : p === "tr"
                  ? "0 10px 0 0"
                  : p === "bl"
                    ? "0 0 0 10px"
                    : "0 0 10px 0",
          }}
        />
      ))}
    </div>
  );
}

// The proposal card: who you scanned, what linking entails, and the action row.
function ProposalCard({
  target,
  sent,
  onCancel,
  onSend,
}: {
  target: string;
  sent: boolean;
  onCancel?: (() => void) | undefined;
  onSend: () => void;
}) {
  return (
    <Card style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <HandleAvatar handle={target} />
        <div style={{ flex: 1 }}>
          <div
            style={{
              fontSize: 16,
              fontWeight: 800,
              color: "var(--text-strong)",
            }}
          >
            {COPY.scanPropose.replace("{h}", target)}
          </div>
          <div
            style={{
              fontSize: 12.5,
              color: "var(--text-muted)",
              marginTop: 2,
            }}
          >
            {COPY.scanProposeSub}
          </div>
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
        {COPY.scanPoints.map((p, i) => (
          <div
            key={i}
            style={{
              display: "flex",
              gap: 9,
              fontSize: 13,
              lineHeight: 1.45,
              color: "var(--text-body)",
            }}
          >
            <span
              style={{
                flex: "none",
                marginTop: 1,
                color: "var(--text-accent)",
              }}
            >
              <Check size={15} />
            </span>
            {p}
          </div>
        ))}
      </div>
      {sent ? (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            justifyContent: "center",
            fontSize: 13,
            fontWeight: 600,
            color: "var(--text-accent)",
            padding: "6px 0",
          }}
        >
          <Clock size={15} /> {COPY.scanPending.replace("{h}", target)}
        </div>
      ) : (
        <div style={{ display: "flex", gap: 8 }}>
          <Button variant="ghost" size="lg" block onClick={onCancel}>
            {COPY.scanCancel}
          </Button>
          <Button variant="primary" size="lg" block onClick={onSend}>
            {COPY.scanSend}
          </Button>
        </div>
      )}
    </Card>
  );
}

export interface ScanLinkProps {
  onCancel?: (() => void) | undefined;
  /** Whether the link request has already been sent (defaults to false). */
  sent?: boolean;
}

export function ScanLink({ onCancel, sent: sentSeed = false }: ScanLinkProps) {
  const target = "kai_"; // the alias HANDLE the camera "found" (display only)
  // The code itself carries an OPAQUE alias id, never the handle, seed the
  // matrix by that id so the QR encodes /a/{id}, matching the settled model.
  const targetAlias = "k3v7m2p8";
  const [sent, setSent] = useState(sentSeed);
  return (
    <div style={{ width: "100%", maxWidth: 390 }}>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 18,
          paddingTop: 4,
        }}
      >
        <h1
          style={{
            fontSize: 23,
            fontWeight: 800,
            letterSpacing: "-0.02em",
            color: "var(--text-strong)",
          }}
        >
          {COPY.scanTitle}
        </h1>

        {/* faux scanner viewport */}
        <ScannerViewport targetAlias={targetAlias} />

        <ProposalCard
          target={target}
          sent={sent}
          onCancel={onCancel}
          onSend={() => setSent(true)}
        />

        <Card variant="tint" style={{ display: "flex", gap: 11 }}>
          <span
            style={{ color: "var(--text-accent)", flex: "none", marginTop: 1 }}
          >
            <Lock size={17} />
          </span>
          <div
            style={{
              fontSize: 12.5,
              lineHeight: 1.5,
              color: "var(--text-body)",
            }}
          >
            {COPY.scanExchangeNote}
          </div>
        </Card>
      </div>
    </div>
  );
}
