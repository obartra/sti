import { Button } from "../../design/components/index.ts";
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
import "./wallet.css";

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
    <div className="wl__formats">
      <FormatOption
        icon={<QrCode size={21} />}
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
            <div className="wl__format-foot">
              <div className="wl__needs-public">
                <span aria-hidden className="wl__needs-public-icon">
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
    <div className="wl__share-blurb">
      This card carries a <strong className="wl__share-strong">link</strong>,
      not your status, so it’s safe to drop in a chat or profile and can’t go
      stale. Whoever opens it sees your current status
      {isPublic ? "" : " only if you’ve shared your key with them"}.
    </div>
  );
}

export function ShareSection({
  isPublic,
  avatarSrc,
  handle,
}: {
  isPublic: boolean;
  avatarSrc: string;
  handle?: string | undefined;
}) {
  return (
    <div className="wl__share">
      <div className="e-eyebrow">{COPY.orShareCard}</div>
      <div className="wl__share-center">
        <ShareCard
          format="qr"
          handle={handle ?? HANDLE}
          avatarSrc={avatarSrc}
          isPublic={isPublic}
        />
      </div>
      <ShareCardBlurb isPublic={isPublic} />
      <div className="wl__share-actions">
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
        <div className="wl__share-note">
          <span aria-hidden className="wl__share-note-icon">
            <Info size={12.5} />
          </span>
          <span>
            Want a card with the status shown? That’s a labeled{" "}
            <strong className="wl__share-note-strong">snapshot</strong>, a still
            image, not live. The link card above is the safer default.
          </span>
        </div>
      )}
    </div>
  );
}

export function TrustFooter({ live }: { live: boolean }) {
  return (
    <div className="wl__trust">
      <div className="wl__trust-title">
        <ShieldCheck size={16} /> {COPY.safeOnLock}
      </div>
      {(live ? COPY.trustLive : COPY.trustQr).map((p, i) => (
        <div key={i} className="wl__trust-row">
          <span aria-hidden className="wl__trust-check">
            <Check size={16} />
          </span>
          <span className="wl__trust-text">{p}</span>
        </div>
      ))}
    </div>
  );
}

export function WalletHeader() {
  return (
    <div>
      <h1 className="wl__title">{COPY.screenTitle}</h1>
      <p className="wl__sub">{COPY.screenSub}</p>
    </div>
  );
}
