import { Info, QrCode } from "../../design/icons.tsx";
import { LabelRow, Medallion, tagsFor } from "../badge-card.tsx";
import type { BadgeState, ProtectionLabel, Route } from "../badge-card.tsx";
import {
  COPY,
  HANDLE,
  LOGO_WORDMARK,
  PassQR,
  UrlText,
  passFace,
  wordFor,
} from "./shared.tsx";
import type { PassProps } from "./shared.tsx";

/* ── Standalone shareable card, the image you drop in a chat/profile ──────
   Default is a QR-carrier (safe to post anywhere, it only carries a link, so
   it can't go stale-blue in a chat history). A "live" share card is a STILL
   SNAPSHOT, clearly labelled, public-only. */
function ShareLiveBody({
  state,
  labels,
  route,
}: {
  state: BadgeState;
  labels: ProtectionLabel[];
  route: Route;
}) {
  const blue = state === "blue";
  const tags = tagsFor(labels, route);
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 10,
        padding: "4px 0 2px",
      }}
    >
      <Medallion state={state} size={84} />
      <div
        style={{
          fontSize: blue ? 22 : 17,
          fontWeight: 800,
          letterSpacing: "-0.02em",
          color: blue ? "var(--text-strong)" : "var(--neutral-600)",
          textAlign: "center",
          textWrap: "balance",
          lineHeight: 1.15,
        }}
      >
        {wordFor(state, labels, route)}
      </div>
      {blue && tags.length > 0 && <LabelRow labels={tags} />}
    </div>
  );
}

function ShareQrBody({
  handle,
  avatarSrc,
}: {
  handle: string;
  avatarSrc?: string | undefined;
}) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 9,
        padding: "2px 0",
      }}
    >
      <span
        style={{
          width: 60,
          height: 60,
          borderRadius: "50%",
          overflow: "hidden",
          background: "var(--accent-soft)",
          display: "inline-flex",
        }}
      >
        <img src={avatarSrc} alt="" style={{ width: "100%", height: "100%" }} />
      </span>
      <div
        style={{
          fontSize: 18,
          fontWeight: 800,
          letterSpacing: "-0.01em",
          color: "var(--text-strong)",
        }}
      >
        @{handle}
      </div>
    </div>
  );
}

function ShareFootNote({ live }: { live: boolean }) {
  return (
    <div
      style={{
        fontSize: 11.5,
        color: "var(--text-subtle)",
        textAlign: "center",
        lineHeight: 1.4,
        display: "flex",
        alignItems: "center",
        gap: 6,
      }}
    >
      <span style={{ flex: "none" }}>
        {live ? <Info size={12.5} /> : <QrCode size={12.5} />}
      </span>
      {live ? COPY.shareNotLive : COPY.shareOpenLink}
    </div>
  );
}

export function ShareCard({
  format = "qr",
  state = "blue",
  labels = [],
  route = null,
  handle = HANDLE,
  avatarSrc,
  isPublic = true,
  snapshot,
}: PassProps & { snapshot?: boolean }) {
  const { live, url, qrKind } = passFace({
    format,
    state,
    labels,
    route,
    isPublic,
  });
  return (
    <div
      style={{
        width: 300,
        borderRadius: 24,
        overflow: "hidden",
        background: "var(--surface-card)",
        boxShadow: "0 26px 60px -22px rgba(27,27,47,0.5)",
        border: "1px solid var(--warm-200)",
      }}
    >
      <div
        style={{
          padding: "20px 22px 18px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 14,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            width: "100%",
          }}
        >
          <img
            src={LOGO_WORDMARK}
            alt="sti.care"
            style={{ height: 17, opacity: 0.92 }}
          />
          {snapshot && (
            <span
              style={{
                fontSize: 9.5,
                fontWeight: 700,
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                color: "var(--text-subtle)",
              }}
            >
              {COPY.snapshot}
            </span>
          )}
        </div>

        {live ? (
          <ShareLiveBody state={state} labels={labels} route={route} />
        ) : (
          <ShareQrBody handle={handle} avatarSrc={avatarSrc} />
        )}

        <div
          style={{
            background: "#fff",
            borderRadius: 16,
            padding: 12,
            boxShadow: "inset 0 0 0 1px var(--warm-200)",
          }}
        >
          <PassQR size={150} kind={qrKind} state={state} />
        </div>
        <UrlText url={url} center />
        <ShareFootNote live={live} />
      </div>
    </div>
  );
}
