import { type ReactElement } from "react";
import { Button } from "../../design/components/index.ts";
import { X, Eye, Share, Refresh } from "../../design/icons.tsx";
import { BadgeCard } from "../badge-card.tsx";
import type { BadgeState, ProtectionLabel, Route } from "../badge-card.tsx";
import type { AliasIdentity } from "../../store/index.ts";
import {
  avatarSrc as renderAvatar,
  type AvatarConfig,
} from "../../lib/avatars.ts";
import {
  IdentityChoiceRow,
  FaceOverrideRow,
  previewFace,
} from "./ShareSheet.identity.tsx";
import { Grabber, WalletRow } from "./ShareSheet.parts.tsx";
import { LifetimeRow } from "./ShareSheet.lifetime.tsx";
import {
  UrlCard,
  urlStateOf,
  urlReady,
  displayLink,
} from "./ShareSheet.url.tsx";
import { cx } from "../../lib/cx.ts";
import "./share-sheet.css";

/* ShareSheet, the share modal opened by "Share my passport" and the share-rail
   buttons. It shows the badge card, the share URL + QR, a copy / save action,
   an add-to-wallet row, and (for private links) a revoke action. Two layouts:
   a centered desktop modal and a mobile bottom sheet with a grabber handle.
   The panel is a control surface (doc 37): it keeps radius and elevation;
   its interior sits on the editorial grammar (share-sheet.css). */

type SharingMode = "public" | "link";

// Copy strings live inline in the prototype (not in copy.js), so they are kept
// here verbatim rather than threaded through the shared copy module. The URL
// block's own strings live with it in ShareSheet.url.tsx.
const COPY = {
  titlePublic: "Share your passport",
  titleLink: "Share private link",
  reassurance: "Just your status, nothing else.",
  revoke: "Revoke and renew",
  share: "Share",
  done: "Done",
  shareTitle: "My sti.care passport",
} as const;

// Whether this browser can hand off to a native share sheet. When it can, the
// primary button opens it; when it can't (most desktops), there's nothing to
// share to, so the button reads "Done" and just closes (the copy / QR actions
// above are the share path there). Read at call time so tests/SSR stay safe.
function canNativeShare(): boolean {
  return (
    typeof navigator !== "undefined" && typeof navigator.share === "function"
  );
}

export interface ShareSheetProps {
  open: boolean;
  onClose?: (() => void) | undefined;
  sharingMode?: SharingMode | undefined;
  state: BadgeState;
  labels?: ProtectionLabel[] | undefined;
  route?: Route | undefined;
  /** The owner's main face. `handle` is absent when they set no display name;
   * the preview then falls back to the id-derived pseudonym (see previewFace). */
  identity: { handle?: string };
  avatarSrc?: string | undefined;
  /** The real shareable link. A string is the live link; null means the app is
   * still preparing it (or the attempt failed, see `error`); undefined means no
   * session is wired and a demo placeholder is shown (Storybook). */
  url?: string | null | undefined;
  /** The last prepare attempt failed. With a null `url` this shows a retry. */
  error?: boolean | undefined;
  /** Re-run the prepare after a failure. */
  onRetry?: (() => void) | undefined;
  /** Copy the real link to the clipboard; return false if no copy path was taken. */
  onCopy?: (() => boolean) | undefined;
  onRevoke?: (() => void) | undefined;
  onWallet?: (() => void) | undefined;
  /**
   * Show the "Add to wallet" row. Defaults true (the component's full form, kept
   * for Storybook); the app passes features.WALLET_ENABLED, which is currently
   * false (wallet passes are built but gated off, pending signing certs).
   */
  showWallet?: boolean | undefined;
  desktop?: boolean | undefined;
  /** The face this link shows (doc 15): anonymous (id-derived) or the owner's
   * main identity. Defaults to anonymous. */
  identityChoice?: AliasIdentity | undefined;
  /** Choose the link's face. When absent, the identity control is hidden (e.g.
   * Storybook), and the preview shows whatever `identity`/`avatarSrc` is passed. */
  onIdentityChange?: ((choice: AliasIdentity) => void) | undefined;
  /** The owner's default face config, edited when picking a per-link face with no
   * override set yet. Absent hides the per-link face control (e.g. Storybook). */
  avatar?: AvatarConfig | undefined;
  /** A per-link face override for a revealed link (doc 15), or undefined for the
   * account default. Only shown on a "main" link. */
  avatarOverride?: AvatarConfig | undefined;
  /** Pick a different face for this link, or undefined to fall back to the default.
   * Absent hides the per-link face control (Storybook). */
  onAvatarOverrideChange?:
    | ((avatar: AvatarConfig | undefined) => void)
    | undefined;
  /** How long the private link keeps working (doc 16): a duration in ms, or null
   * for until the owner turns it off. Only read when the lifetime control shows. */
  lifetime?: number | null | undefined;
  /** Set the private link's lifetime. When absent (public mode, or Storybook), the
   * lifetime control is hidden: only a private link lapses, a profile never does. */
  onLifetimeChange?: ((durationMs: number | null) => void) | undefined;
}

function SheetHeader({
  link,
  onClose,
}: {
  link: boolean;
  onClose: (() => void) | undefined;
}): ReactElement {
  return (
    <div className="sh__head">
      <div className="sh__title">
        {link ? COPY.titleLink : COPY.titlePublic}
      </div>
      <button
        type="button"
        onClick={onClose}
        aria-label="Close"
        className="sh__close"
      >
        <X size={16} />
      </button>
    </div>
  );
}

// Hand off to the OS share sheet when one exists, then close on a completed
// share; otherwise (no native share, e.g. desktop) there's nothing to share to,
// so just close. A dismissed native share (reject) leaves the sheet open.
function nativeShareOrClose(
  nativeShare: boolean,
  url: string,
  onClose: (() => void) | undefined,
): void {
  if (!nativeShare) {
    onClose?.();
    return;
  }
  void navigator
    .share({ title: COPY.shareTitle, url })
    .then(() => onClose?.())
    .catch(() => undefined);
}

// The revoke (private links only) + primary button row. The primary reads
// "Share" and opens the OS share sheet where available, else "Done" (close).
function SheetActions({
  link,
  nativeShare,
  onShare,
  onRevoke,
}: {
  link: boolean;
  nativeShare: boolean;
  onShare: () => void;
  onRevoke: (() => void) | undefined;
}): ReactElement {
  return (
    <div className="sh__actions">
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
        icon={nativeShare ? <Share size={18} /> : undefined}
        onClick={onShare}
      >
        {nativeShare ? COPY.share : COPY.done}
      </Button>
    </div>
  );
}

// The reassurance line under the badge card ("Just your status, nothing else").
function Reassurance(): ReactElement {
  return (
    <div className="sh__reassure">
      <Eye size={14} /> {COPY.reassurance}
    </div>
  );
}

// The two panel layouts: a centered desktop modal, or the mobile bottom sheet.
function panelClassFor(desktop: boolean): string {
  return cx("sh__panel", desktop ? "sh__panel--desktop" : "sh__panel--mobile");
}

// The sheet panel itself (the positioned card, or bottom sheet): badge preview,
// the identity / face / lifetime controls, the URL block, and the action row.
// Lifted out of ShareSheet so that component stays within its size/complexity
// caps; it just resolves props and mounts the overlay + this panel.
function SheetPanel(props: ShareSheetProps): ReactElement {
  const {
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
    showWallet = true,
    desktop = false,
    identityChoice = "anonymous",
    onIdentityChange,
    avatar,
    avatarOverride,
    onAvatarOverrideChange,
    lifetime = null,
    onLifetimeChange,
    error,
    onRetry,
  } = props;
  const link = sharingMode === "link";
  // The lifetime control belongs to the private link only (doc 16): a public
  // profile and a public name never lapse, so the handler is dropped outside
  // link mode and LifetimeRow then hides itself.
  const onLifetime = link ? onLifetimeChange : undefined;
  const urlState = urlStateOf(realUrl, error);
  const { url, seed } = displayLink(realUrl, link);
  const overrideSrc =
    avatarOverride !== undefined ? renderAvatar(avatarOverride) : undefined;
  // The preview shows the viewer's actual face for this link (see previewFace). A
  // per-link face override wins over the account face on a revealed link.
  const face = previewFace({
    choice: identityChoice,
    identity,
    avatarSrc,
    seed,
    hasControl: onIdentityChange !== undefined,
    overrideSrc,
  });

  // Only a ready link can be shared/handed off; while preparing or after a
  // failure there is nothing to share to, so the primary button just closes.
  const nativeShare = canNativeShare() && urlReady(urlState);
  const onShare = () =>
    nativeShareOrClose(nativeShare, realUrl ?? `https://${url}`, onClose);

  return (
    <div className={panelClassFor(desktop)}>
      <Grabber desktop={desktop} />
      <SheetHeader link={link} onClose={onClose} />
      <BadgeCard
        state={state}
        labels={labels}
        route={route}
        identity={{ handle: face.handle }}
        avatarSrc={face.avatarSrc}
        width="100%"
      />
      <Reassurance />
      <IdentityChoiceRow
        choice={identityChoice}
        hasName={identity.handle !== undefined && identity.handle.length > 0}
        onChange={onIdentityChange}
      />
      <FaceOverrideRow
        choice={identityChoice}
        override={avatarOverride}
        fallback={avatar}
        onChange={onAvatarOverrideChange}
      />
      <LifetimeRow choice={lifetime} onChange={onLifetime} />
      <UrlCard
        link={link}
        state={urlState}
        url={url}
        seed={seed}
        onCopy={onCopy}
        onRetry={onRetry}
      />
      <WalletRow show={showWallet} onWallet={onWallet} />
      <SheetActions
        link={link}
        nativeShare={nativeShare}
        onShare={onShare}
        onRevoke={onRevoke}
      />
    </div>
  );
}

export function ShareSheet(props: ShareSheetProps): ReactElement {
  const { open, onClose } = props;
  return (
    // Always viewport-fixed: the sheet is a modal layer, not page content. As
    // `absolute` it anchored to the document (the shell isn't a positioned
    // ancestor), so when closed the bottom sheet's translateY(100%) parked it
    // ~100vh down a long page, showing through and overlapping content. The
    // open/closed state drives the panel + scrim transitions from the root.
    <div
      aria-hidden={!open}
      data-share-overlay=""
      className={cx("sh", open ? "sh--open" : "sh--closed")}
    >
      <div onClick={onClose} className="sh__scrim" />
      <SheetPanel {...props} />
    </div>
  );
}
