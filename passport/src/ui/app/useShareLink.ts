import { useCallback, useRef, useState, type RefObject } from "react";
import type {
  AliasIdentity,
  OwnerSession,
  SessionController,
  ShareLinkResult,
} from "../../store/index.ts";
import { copyText } from "../../lib/clipboard.ts";

export interface ShareLinkControls {
  /** The owner's real shareable link, or null until the share sheet is opened. */
  readonly shareUrl: string | null;
  /** The last link-prepare attempt failed (e.g. offline). With a null shareUrl
   * the share sheet shows a retry instead of a fake placeholder link. */
  readonly shareError: boolean;
  /** Re-run the link prepare after a failure (the share-sheet "Try again"). */
  readonly retryShareLink: () => void;
  /** Open/close the share sheet; opening mints/refreshes the alias for the mode. */
  readonly setShareOpen: (open: boolean) => void;
  /** Copy the current real link to the clipboard; true if a copy path was taken. */
  readonly copyShareLink: () => boolean;
  /** Revoke the current link (it stops resolving) and surface a fresh one. */
  readonly revokeLink: () => void;
  /** The face this link shows: anonymous (id-derived) or the owner's main identity. */
  readonly identity: AliasIdentity;
  /**
   * Choose the link's face. Changing it rotates to a fresh alias carrying the new
   * face (a renew), since an already-shared alias keeps the face it was minted with.
   */
  readonly setIdentity: (choice: AliasIdentity) => void;
  /** The link's lifetime: a duration in ms, or null for until-revoked (default). */
  readonly duration: number | null;
  /**
   * Set the link's lifetime in place (ms from now, or null for until-revoked).
   * The same link keeps working, only its expiry moves; the server is told too.
   */
  readonly setDuration: (durationMs: number | null) => void;
}

/**
 * The share-sheet concern lifted out of App: opening the sheet asks the
 * controller for the owner's real link (minting/refreshing the alias and folding
 * the possibly-updated session back in), copy writes that link to the clipboard,
 * and revoke kills the current link and mints a fresh one. A no-op while logged
 * out. Wraps the router's setShareOpen so every open path (home, rail, view-as)
 * routes through the same mint-on-open step.
 */
export function useShareLink(
  controller: SessionController,
  sessionRef: RefObject<OwnerSession | null>,
  setSession: (s: OwnerSession) => void,
  setShareOpen: (open: boolean) => void,
): ShareLinkControls {
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  // Whether the last prepare attempt failed. Cleared at the start of every
  // attempt and on success, set on a rejected/throwing produce. Lets the share
  // sheet distinguish "still minting" from "minting failed" so it can offer a
  // retry instead of leaving an honest-but-stuck pending state.
  const [shareError, setShareError] = useState(false);
  // The chosen face for the link, mirrored in a ref so callbacks read the latest
  // without re-subscribing. Defaults to anonymous (the unlinkable id-derived face).
  const [identity, setIdentityState] = useState<AliasIdentity>("anonymous");
  const identityRef = useRef<AliasIdentity>("anonymous");
  // The link's lifetime, mirrored in a ref like identity. Defaults to null
  // (until-revoked), matching how an alias is minted, and is reset to null
  // whenever a renew mints a fresh alias (see resetDuration).
  // KNOWN LIMITATION (cosmetic): opening the sheet for an alias that already
  // carries an expiry does not pre-select that lifetime here, it shows "No
  // expiry" until the owner picks. Reflecting a stored expiry exactly would need
  // a control that can show an arbitrary remaining duration (the presets
  // can't), so it is deferred; the underlying expiry mechanism is unaffected.
  const [duration, setDurationState] = useState<number | null>(null);
  const durationRef = useRef<number | null>(null);
  // Serializes link work (mint / republish / revoke) against the session: a
  // second call while one is in flight is dropped, so two opens cannot race into
  // duplicate mints and a revoke cannot interleave with an open. Reset on settle.
  const preparing = useRef(false);

  // Run a controller call that produces a link and fold the result back into the
  // session + displayed URL. `clearFirst` blanks the URL during the gap: used on
  // open so a stale cross-mode (e.g. key-bearing) link never flashes under the
  // wrong sheet. Revoke leaves the still-valid old link showing until the fresh
  // one resolves, so the gap is honest (the old link IS live until revoke lands)
  // and a failed revoke leaves it visible rather than a misleading "it's gone".
  const prepare = useCallback(
    (
      produce: (s: OwnerSession) => Promise<ShareLinkResult>,
      clearFirst: boolean,
    ) => {
      const current = sessionRef.current;
      if (current === null || preparing.current) return;
      if (clearFirst) setShareUrl(null);
      setShareError(false);
      preparing.current = true;
      void produce(current)
        .then(({ session: updated, url }) => {
          sessionRef.current = updated;
          setSession(updated);
          setShareUrl(url);
        })
        .catch(() => setShareError(true))
        .finally(() => {
          preparing.current = false;
        });
    },
    [sessionRef, setSession],
  );

  // Opening (and the share sheet's "Try again", which re-opens in place) mints
  // the alias for the current mode and face. Reused as the retry so a failed
  // prepare can be re-run without a second code path.
  const open = useCallback(
    (next: boolean) => {
      setShareOpen(next);
      if (next)
        prepare((s) => controller.shareLink(s, identityRef.current), true);
    },
    [controller, prepare, setShareOpen],
  );

  // A renew mints a fresh alias with NO expiry, so the lifetime control must
  // reset to match: otherwise it shows a lifetime the new link does not have, and
  // the setDuration dedupe (below) silently blocks re-applying that same value.
  const resetDuration = useCallback(() => {
    durationRef.current = null;
    setDurationState(null);
  }, []);

  const revokeLink = useCallback(() => {
    resetDuration();
    prepare((s) => controller.renewLink(s, identityRef.current), false);
  }, [controller, prepare, resetDuration]);

  // Changing the face rotates to a fresh alias carrying it (renew), because an
  // already-minted alias keeps the face it was sealed with. A no-op if unchanged.
  const setIdentity = useCallback(
    (choice: AliasIdentity) => {
      if (choice === identityRef.current) return;
      identityRef.current = choice;
      setIdentityState(choice);
      resetDuration();
      prepare((s) => controller.renewLink(s, choice), false);
    },
    [controller, prepare, resetDuration],
  );

  // Changing the lifetime moves the current link's expiry in place (no renew, so
  // the URL is unchanged), then folds the updated session back in. A no-op if
  // unchanged or logged out / before the link is minted.
  const setDuration = useCallback(
    (durationMs: number | null) => {
      if (durationMs === durationRef.current) return;
      durationRef.current = durationMs;
      setDurationState(durationMs);
      const current = sessionRef.current;
      if (current === null) return;
      void controller
        .setShareLinkDuration(current, durationMs)
        .then((updated) => {
          sessionRef.current = updated;
          setSession(updated);
        })
        .catch(() => undefined);
    },
    [controller, sessionRef, setSession],
  );

  const copyShareLink = useCallback(() => {
    if (shareUrl === null) return false;
    return copyText(shareUrl);
  }, [shareUrl]);

  return {
    shareUrl,
    shareError,
    retryShareLink: () => open(true),
    setShareOpen: open,
    copyShareLink,
    revokeLink,
    identity,
    setIdentity,
    duration,
    setDuration,
  };
}
