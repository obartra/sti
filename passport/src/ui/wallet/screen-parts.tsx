import { Button, Card } from "../../design/components/index.ts";
import {
  Check,
  Copy,
  Download,
  Globe,
  Info,
  Lock,
  QrCode,
  Shield,
  ShieldCheck,
} from "../../design/icons.tsx";
import { downloadPNG } from "../../lib/qr.tsx";
import { ALIAS_ID, COPY, HANDLE } from "./shared.tsx";
import type { WalletFormat } from "./shared.tsx";
import { ShareCard } from "./share-card.tsx";
import { FormatOption } from "./controls.tsx";

export function FormatSection({
  isPublic,
  live,
  setFormat,
  selectLive,
  onMakePublic,
}: {
  isPublic: boolean;
  live: boolean;
  setFormat: (v: WalletFormat) => void;
  selectLive: () => void;
  onMakePublic: () => void;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <FormatOption
        icon={<QrCode size={21} />}
        dark
        title={COPY.qrPassTitle}
        sub={COPY.qrPassSub}
        selected={!live}
        onSelect={() => setFormat("qr")}
      />
      <FormatOption
        icon={<Shield size={21} />}
        title={COPY.livePassTitle}
        sub={isPublic ? COPY.livePassSubPublic : COPY.livePassSubPrivate}
        selected={live}
        disabled={!isPublic}
        onSelect={selectLive}
        foot={
          !isPublic && (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 10,
                marginTop: 1,
              }}
            >
              <div
                style={{
                  fontSize: 12.5,
                  lineHeight: 1.5,
                  color: "var(--status-treat-fg, #9A6A00)",
                  background: "var(--status-treat-bg, #FBF3D9)",
                  borderRadius: "var(--radius-sm)",
                  padding: "9px 11px",
                  display: "flex",
                  gap: 7,
                }}
              >
                <span style={{ flex: "none", marginTop: 1 }}>
                  <Lock size={14} />
                </span>
                <span>{COPY.liveNeedsPublic}</span>
              </div>
              <Button
                variant="secondary"
                size="sm"
                icon={<Globe size={15} />}
                onClick={onMakePublic}
              >
                {COPY.makeAliasPublic}
              </Button>
            </div>
          )
        }
      />
    </div>
  );
}

function ShareCardBlurb({ isPublic }: { isPublic: boolean }) {
  return (
    <div
      style={{
        fontSize: 13,
        color: "var(--text-body)",
        lineHeight: 1.5,
        textAlign: "center",
      }}
    >
      This card carries a{" "}
      <strong style={{ color: "var(--text-strong)" }}>link</strong>, not your
      status, so it’s safe to drop in a chat or profile and can’t go stale.
      Whoever opens it sees your current status
      {isPublic ? "" : " only if you’ve shared your key with them"}.
    </div>
  );
}

export function ShareSection({
  isPublic,
  avatarSrc,
}: {
  isPublic: boolean;
  avatarSrc: string;
}) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 12,
        paddingTop: 4,
      }}
    >
      <div
        style={{
          fontSize: 11,
          fontWeight: 800,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: "var(--text-subtle)",
        }}
      >
        {COPY.orShareCard}
      </div>
      <Card
        variant="flat"
        style={{ display: "flex", flexDirection: "column", gap: 14 }}
      >
        <div style={{ display: "flex", justifyContent: "center" }}>
          <ShareCard
            format="qr"
            handle={HANDLE}
            avatarSrc={avatarSrc}
            isPublic={isPublic}
          />
        </div>
        <ShareCardBlurb isPublic={isPublic} />
        <div
          style={{
            display: "flex",
            gap: 8,
            flexWrap: "wrap",
            justifyContent: "center",
          }}
        >
          <Button variant="secondary" size="sm" icon={<Copy size={15} />}>
            {COPY.copyLink}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            icon={<Download size={15} />}
            onClick={() => downloadPNG({ status: "logo", seed: ALIAS_ID })}
          >
            {COPY.saveCardImage}
          </Button>
        </div>
        {isPublic && (
          <div
            style={{
              fontSize: 11.5,
              color: "var(--text-subtle)",
              lineHeight: 1.45,
              textAlign: "center",
              display: "flex",
              gap: 6,
              alignItems: "flex-start",
              justifyContent: "center",
            }}
          >
            <span style={{ flex: "none", marginTop: 1 }}>
              <Info size={12.5} />
            </span>
            <span>
              Want a card with the status shown? That’s a labelled{" "}
              <strong style={{ color: "var(--text-body)" }}>snapshot</strong>, a
              still image, not live. The link card above is the safer default.
            </span>
          </div>
        )}
      </Card>
    </div>
  );
}

export function TrustFooter({ live }: { live: boolean }) {
  return (
    <Card
      variant="tint"
      style={{ display: "flex", flexDirection: "column", gap: 12 }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          color: "var(--text-accent)",
          fontSize: 13,
          fontWeight: 700,
        }}
      >
        <ShieldCheck size={16} /> {COPY.safeOnLock}
      </div>
      {(live ? COPY.trustLive : COPY.trustQr).map((p, i) => (
        <div
          key={i}
          style={{ display: "flex", gap: 9, alignItems: "flex-start" }}
        >
          <span
            style={{
              color: "var(--text-accent)",
              flex: "none",
              marginTop: 1,
            }}
          >
            <Check size={16} />
          </span>
          <span
            style={{
              fontSize: 13.5,
              color: "var(--text-body)",
              lineHeight: 1.5,
            }}
          >
            {p}
          </span>
        </div>
      ))}
    </Card>
  );
}

export function WalletHeader() {
  return (
    <div>
      <h1
        style={{
          fontSize: 24,
          fontWeight: 800,
          letterSpacing: "-0.02em",
          color: "var(--text-strong)",
        }}
      >
        {COPY.screenTitle}
      </h1>
      <p
        style={{
          fontSize: 14.5,
          lineHeight: 1.55,
          color: "var(--text-body)",
          marginTop: 6,
        }}
      >
        {COPY.screenSub}
      </p>
    </div>
  );
}
