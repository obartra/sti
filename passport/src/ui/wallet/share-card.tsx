import { Info, QrCode } from "../../design/icons.tsx";
import { LabelRow, Medallion, tagsFor } from "../badge-card.tsx";
import type { BadgeState, ProtectionLabel, Route } from "../badge-card.tsx";
import { cx } from "../../lib/cx.ts";
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
import "./wallet.css";

/* ── Standalone shareable card, the image you drop in a chat/profile ──────
   Default is a QR-carrier (safe to post anywhere, it only carries a link, so
   it can't go stale-blue in a chat history). A "live" share card is a STILL
   SNAPSHOT, clearly labelled, public-only. A physical-object mockup: it keeps
   its frame, radius, and shadow while the screen around it flattens. */
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
    <div className="shc__live">
      <Medallion state={state} size={84} />
      <div className={cx("shc__word", !blue && "shc__word--gray")}>
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
    <div className="shc__qrbody">
      <span className="shc__face">
        <img src={avatarSrc} alt="" />
      </span>
      <div className="shc__handle">@{handle}</div>
    </div>
  );
}

function ShareFootNote({ live }: { live: boolean }) {
  return (
    <div className="shc__foot">
      <span aria-hidden className="shc__foot-icon">
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
    <div className="shc">
      <div className="shc__inner">
        <div className="shc__head">
          <img src={LOGO_WORDMARK} alt="sti.care" className="shc__wordmark" />
          {snapshot && <span className="shc__snapshot">{COPY.snapshot}</span>}
        </div>

        {live ? (
          <ShareLiveBody state={state} labels={labels} route={route} />
        ) : (
          <ShareQrBody handle={handle} avatarSrc={avatarSrc} />
        )}

        <div className="shc__qrframe">
          <PassQR size={150} kind={qrKind} state={state} />
        </div>
        <UrlText url={url} center />
        <ShareFootNote live={live} />
      </div>
    </div>
  );
}
