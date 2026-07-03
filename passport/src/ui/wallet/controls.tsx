import type { ReactNode } from "react";
import { Button } from "../../design/components/index.ts";
import { Check, Globe } from "../../design/icons.tsx";
import { cx } from "../../lib/cx.ts";
import { COPY, HANDLE } from "./shared.tsx";
import "./wallet.css";

/* ── Format chooser: selection through ink and border weight, never tint ── */
export function FormatOption({
  icon,
  title,
  sub,
  selected,
  disabled,
  onSelect,
  foot,
}: {
  icon: ReactNode;
  title: string;
  sub: string;
  selected?: boolean;
  disabled?: boolean;
  onSelect?: (() => void) | undefined;
  foot?: ReactNode;
}) {
  return (
    <div className={cx("wl__format", selected && "wl__format--on")}>
      <button
        type="button"
        onClick={disabled ? undefined : onSelect}
        aria-disabled={disabled}
        className="wl__format-btn"
      >
        <span aria-hidden className="wl__format-icon">
          {icon}
        </span>
        <span className="wl__format-body">
          <span className="wl__format-title">{title}</span>
          <span className="wl__format-sub">{sub}</span>
        </span>
        <span
          aria-hidden
          className={cx("wl__format-ring", selected && "wl__format-ring--on")}
        >
          {selected && <Check size={13} />}
        </span>
      </button>
      {foot}
    </div>
  );
}

/* ── Make-public confirmation (the only path to enable Live on a private
      alias). On confirm it flips this alias public, THEN switches to Live.
      An overlay sheet, so it keeps its elevation. ── */
export function ConfirmPublic({
  handle,
  onKeep,
  onConfirm,
}: {
  handle?: string | undefined;
  onKeep?: (() => void) | undefined;
  onConfirm?: (() => void) | undefined;
}) {
  return (
    <div className="wl__confirm">
      <div onClick={onKeep} className="wl__confirm-scrim" />
      <div className="wl__confirm-panel">
        <span aria-hidden className="wl__confirm-icon">
          <Globe size={24} />
        </span>
        <div>
          <div className="wl__confirm-title">
            {COPY.confirmTitle(handle ?? HANDLE)}
          </div>
          <p className="wl__confirm-body">{COPY.confirmBody}</p>
        </div>
        <div className="wl__confirm-points">
          {COPY.confirmPoints.map((tx, i) => (
            <div key={i} className="wl__confirm-point">
              <span aria-hidden className="wl__confirm-check">
                <Check size={15} />
              </span>
              {tx}
            </div>
          ))}
        </div>
        <div className="wl__confirm-buttons">
          <Button variant="ghost" size="lg" block onClick={onKeep}>
            {COPY.keepPrivate}
          </Button>
          <Button variant="primary" size="lg" block onClick={onConfirm}>
            {COPY.makePublicGoLive}
          </Button>
        </div>
      </div>
    </div>
  );
}

/* ── Add / already-added control. The add buttons follow Apple's and Google's
      own wallet-button conventions (dark, filled), not the app grammar. ── */
function AddButton({
  platform,
  onClick,
}: {
  platform: "apple" | "google";
  onClick?: (() => void) | undefined;
}) {
  const apple = platform === "apple";
  const Mark = apple ? (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
      <path d="M16.4 12.7c0-2 1.6-3 1.7-3.05-1-1.4-2.4-1.6-2.9-1.6-1.2-.13-2.4.72-3 .72-.6 0-1.6-.7-2.6-.68-1.3.02-2.6.78-3.3 1.97-1.4 2.45-.36 6.07 1 8.06.66.97 1.45 2.06 2.48 2.02 1-.04 1.37-.64 2.58-.64 1.2 0 1.54.64 2.6.62 1.07-.02 1.75-.99 2.4-1.97.76-1.13 1.07-2.22 1.08-2.28-.02-.01-2.07-.8-2.1-3.16zM14.5 6.3c.55-.67.92-1.6.82-2.53-.79.03-1.75.53-2.32 1.2-.51.58-.96 1.53-.84 2.43.88.07 1.78-.45 2.34-1.1z" />
    </svg>
  ) : (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <path d="M12 4 19 8v8l-7 4-7-4V8z" fill="currentColor" opacity="0.18" />
      <path
        d="M9 12l2 2 4-4"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
  return (
    <button type="button" onClick={onClick} className="wl__add">
      {Mark}
      <span className="wl__add-lines">
        <span className="wl__add-kicker">{COPY.addTo}</span>
        <span className="wl__add-name">
          {apple ? COPY.appleWallet : COPY.googleWallet}
        </span>
      </span>
    </button>
  );
}

export function WalletAction({
  platform,
  added,
  onAdd,
  onRemove,
}: {
  platform: "apple" | "google";
  added: boolean;
  onAdd?: (() => void) | undefined;
  onRemove?: (() => void) | undefined;
}) {
  const name = platform === "apple" ? COPY.appleWallet : COPY.googleWallet;
  if (!added) return <AddButton platform={platform} onClick={onAdd} />;
  return (
    <div className="wl__added">
      <span aria-hidden className="wl__added-check">
        <Check size={18} />
      </span>
      <div className="wl__added-body">
        <div className="wl__added-title">{COPY.inYourWallet(name)}</div>
        <div className="wl__added-sub">{COPY.keepsCurrent}</div>
      </div>
      <div className="wl__added-actions">
        <Button variant="quiet" size="sm" onClick={onRemove}>
          {COPY.remove}
        </Button>
        <Button variant="secondary" size="sm">
          {COPY.open}
        </Button>
      </div>
    </div>
  );
}
