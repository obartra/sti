import { QrCode } from "../../design/icons.tsx";
import { LabelRow, Medallion } from "../badge-card.tsx";
import {
  COPY,
  HANDLE,
  LOGO_WORDMARK_LIGHT,
  PassAvatar,
  PassQR,
  UrlText,
  passFace,
  wordFor,
} from "./shared.tsx";
import type { PassHead, PassProps } from "./shared.tsx";

/* ── Apple Wallet, store-card: brand top, perforation, barcode base ───── */
function AppleLiveHead({ state, labels, route, handle, avatarSrc }: PassHead) {
  const blue = state === "blue";
  return (
    <>
      <div
        style={{
          marginTop: 15,
          display: "flex",
          alignItems: "center",
          gap: 13,
        }}
      >
        <Medallion state={state} size={46} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: 9,
              fontWeight: 700,
              letterSpacing: "0.05em",
              textTransform: "uppercase",
              opacity: 0.75,
            }}
          >
            {COPY.status}
          </div>
          <div
            style={{
              fontSize: blue ? 21 : 16.5,
              fontWeight: 800,
              letterSpacing: "-0.02em",
              lineHeight: 1.1,
              marginTop: 3,
              textWrap: "balance",
            }}
          >
            {wordFor(state, labels, route)}
          </div>
        </div>
      </div>

      <div
        style={{
          marginTop: 14,
          display: "flex",
          alignItems: "center",
          gap: 8,
        }}
      >
        <PassAvatar src={avatarSrc} handle={handle} size={22} />
        <span
          style={{
            fontSize: 12.5,
            fontWeight: 600,
            color: "#fff",
            opacity: 0.92,
          }}
        >
          @{handle}
        </span>
      </div>
    </>
  );
}

function AppleQrHead({
  handle,
  avatarSrc,
}: {
  handle: string;
  avatarSrc?: string | undefined;
}) {
  return (
    <div
      style={{
        marginTop: 15,
        display: "flex",
        alignItems: "center",
        gap: 13,
      }}
    >
      <PassAvatar src={avatarSrc} handle={handle} size={46} ring />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 17,
            fontWeight: 800,
            letterSpacing: "-0.01em",
            lineHeight: 1.1,
          }}
        >
          @{handle}
        </div>
        <div
          style={{
            fontSize: 11.5,
            opacity: 0.8,
            marginTop: 3,
            display: "flex",
            alignItems: "center",
            gap: 5,
          }}
        >
          <QrCode size={12.5} /> {COPY.scanToOpen}
        </div>
      </div>
    </div>
  );
}

export function ApplePass({
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
  // Live is public-only → always the teal brand top. The QR-carrier top is a
  // calm neutral ink so it makes no status promise.
  const topBg = live
    ? "linear-gradient(165deg, var(--accent), var(--text-accent))"
    : "linear-gradient(165deg, #34303f, #1B1B2F)";
  return (
    <div
      style={{
        width: 322,
        borderRadius: 18,
        overflow: "hidden",
        boxShadow: "0 24px 50px -18px rgba(27,27,47,0.45)",
        background: "var(--surface-card)",
      }}
    >
      <div
        style={{ background: topBg, color: "#fff", padding: "15px 18px 17px" }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <img
            src={LOGO_WORDMARK_LIGHT}
            alt="sti.care"
            style={{ height: 18 }}
          />
          <span
            style={{
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: "0.14em",
              opacity: 0.85,
            }}
          >
            {COPY.passport}
          </span>
        </div>

        {live ? (
          <AppleLiveHead
            state={state}
            labels={labels}
            route={route}
            handle={handle}
            avatarSrc={avatarSrc}
          />
        ) : (
          <AppleQrHead handle={handle} avatarSrc={avatarSrc} />
        )}
      </div>

      {/* perforation + barcode base */}
      <div
        style={{
          position: "relative",
          background: "#fff",
          padding: "17px 18px 18px",
        }}
      >
        <span
          style={{
            position: "absolute",
            top: -9,
            left: -9,
            width: 18,
            height: 18,
            borderRadius: "50%",
            background: "var(--surface-app)",
          }}
        />
        <span
          style={{
            position: "absolute",
            top: -9,
            right: -9,
            width: 18,
            height: 18,
            borderRadius: "50%",
            background: "var(--surface-app)",
          }}
        />
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 11,
          }}
        >
          {showTags && <LabelRow labels={tags} />}
          <PassQR size={140} kind={qrKind} state={state} />
          <UrlText url={url} center />
        </div>
      </div>
    </div>
  );
}
