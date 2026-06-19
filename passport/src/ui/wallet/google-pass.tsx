import { QrCode } from "../../design/icons.tsx";
import { LabelRow, Medallion } from "../badge-card.tsx";
import {
  COPY,
  HANDLE,
  LOGO_MARK,
  PassAvatar,
  PassQR,
  UrlText,
  passFace,
  wordFor,
} from "./shared.tsx";
import type { PassHead, PassProps } from "./shared.tsx";

/* ── Google Wallet, Material pass: brand header, content row, barcode ─── */
function GoogleLiveRow({ state, labels, route, handle, avatarSrc }: PassHead) {
  const blue = state === "blue";
  return (
    <div
      style={{
        padding: "16px 18px 6px",
        display: "flex",
        alignItems: "center",
        gap: 13,
      }}
    >
      <Medallion state={state} size={50} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: blue ? 20 : 16,
            fontWeight: 800,
            letterSpacing: "-0.02em",
            color: "var(--text-strong)",
            textWrap: "balance",
            lineHeight: 1.1,
          }}
        >
          {wordFor(state, labels, route)}
        </div>
        <div
          style={{
            fontSize: 12.5,
            color: "var(--text-muted)",
            marginTop: 3,
            display: "flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          <PassAvatar src={avatarSrc} handle={handle} size={18} /> @{handle}
        </div>
      </div>
    </div>
  );
}

function GoogleQrRow({
  handle,
  avatarSrc,
}: {
  handle: string;
  avatarSrc?: string | undefined;
}) {
  return (
    <div
      style={{
        padding: "16px 18px 6px",
        display: "flex",
        alignItems: "center",
        gap: 13,
      }}
    >
      <span
        style={{
          flex: "none",
          display: "inline-flex",
          width: 50,
          height: 50,
          borderRadius: "50%",
          overflow: "hidden",
          background: "var(--accent-soft)",
        }}
      >
        <img src={avatarSrc} alt="" style={{ width: "100%", height: "100%" }} />
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 18,
            fontWeight: 800,
            letterSpacing: "-0.01em",
            color: "var(--text-strong)",
            lineHeight: 1.1,
          }}
        >
          @{handle}
        </div>
        <div
          style={{
            fontSize: 12.5,
            color: "var(--text-muted)",
            marginTop: 3,
            display: "flex",
            alignItems: "center",
            gap: 5,
          }}
        >
          <QrCode size={13} style={{ color: "var(--text-subtle)" }} />{" "}
          {COPY.scanToOpen}
        </div>
      </div>
    </div>
  );
}

export function GooglePass({
  format = "qr",
  state = "blue",
  labels = [],
  route = null,
  handle = HANDLE,
  avatarSrc,
  isPublic = true,
}: PassProps) {
  const { live, url, tags, showTags, qrKind } = passFace({
    format,
    state,
    labels,
    route,
    isPublic,
  });
  const headBg = live ? "var(--accent)" : "#26222e";
  return (
    <div
      style={{
        width: 322,
        borderRadius: 18,
        overflow: "hidden",
        boxShadow: "0 24px 50px -18px rgba(27,27,47,0.4)",
        background: "var(--surface-card)",
        border: "1px solid var(--warm-200)",
      }}
    >
      <div
        style={{
          background: headBg,
          color: "#fff",
          padding: "13px 18px",
          display: "flex",
          alignItems: "center",
          gap: 11,
        }}
      >
        <img
          src={LOGO_MARK}
          alt=""
          style={{
            height: 28,
            borderRadius: 8,
            background: "#fff",
            padding: 3,
          }}
        />
        <div style={{ lineHeight: 1.2 }}>
          <div style={{ fontSize: 11, fontWeight: 600, opacity: 0.85 }}>
            {COPY.sticare}
          </div>
          <div style={{ fontSize: 14.5, fontWeight: 700 }}>
            {COPY.healthPassport}
          </div>
        </div>
      </div>

      {live ? (
        <GoogleLiveRow
          state={state}
          labels={labels}
          route={route}
          handle={handle}
          avatarSrc={avatarSrc}
        />
      ) : (
        <GoogleQrRow handle={handle} avatarSrc={avatarSrc} />
      )}

      {showTags && (
        <div
          style={{
            padding: "6px 18px 0",
            display: "flex",
            justifyContent: "center",
          }}
        >
          <LabelRow labels={tags} />
        </div>
      )}

      <div
        style={{
          padding: "14px 18px 18px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 10,
        }}
      >
        <PassQR size={140} kind={qrKind} state={state} />
        <UrlText url={url} center />
      </div>
    </div>
  );
}
