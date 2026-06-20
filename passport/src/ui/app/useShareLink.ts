import { useCallback, useRef, useState, type RefObject } from "react";
import type { OwnerSession, SessionController } from "../../store/index.ts";

export interface ShareLinkControls {
  /** The owner's real shareable link, or null until the share sheet is opened. */
  readonly shareUrl: string | null;
  /** Open/close the share sheet; opening mints/refreshes the primary alias. */
  readonly setShareOpen: (open: boolean) => void;
  /** Copy the current real link to the clipboard (no-op if none / unavailable). */
  readonly copyShareLink: () => void;
}

/**
 * The share-sheet concern lifted out of App: opening the sheet asks the
 * controller for the owner's real link (minting/refreshing the primary alias and
 * folding the possibly-updated session back in), and copy writes that link to the
 * clipboard. A no-op while logged out. Wraps the router's setShareOpen so every
 * open path (home, rail, view-as) routes through the same mint-on-open step.
 */
export function useShareLink(
  controller: SessionController,
  sessionRef: RefObject<OwnerSession | null>,
  setSession: (s: OwnerSession) => void,
  setShareOpen: (open: boolean) => void,
): ShareLinkControls {
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  // Guards against a second open racing the first into a duplicate mint before
  // the first alias is recorded (each would see no alias yet and publish its
  // own). Reset on settle so a later reopen still republishes the fresh card.
  const preparing = useRef(false);

  const open = useCallback(
    (next: boolean) => {
      setShareOpen(next);
      if (!next) return;
      const current = sessionRef.current;
      if (current === null || preparing.current) return;
      // Drop any prior link before re-deriving: on a reopen after a sharing-mode
      // switch the stale URL could be the other mode's link (e.g. a public,
      // key-bearing URL under a now-private sheet). Null shows the inert
      // placeholder for the brief gap until the fresh link resolves.
      setShareUrl(null);
      preparing.current = true;
      void controller
        .shareLink(current)
        .then(({ session: updated, url }) => {
          sessionRef.current = updated;
          setSession(updated);
          setShareUrl(url);
        })
        .catch(() => undefined)
        .finally(() => {
          preparing.current = false;
        });
    },
    [controller, sessionRef, setSession, setShareOpen],
  );

  const copyShareLink = useCallback(() => {
    if (shareUrl === null) return;
    try {
      void navigator.clipboard.writeText(shareUrl).catch(() => undefined);
    } catch {
      // no clipboard available
    }
  }, [shareUrl]);

  return { shareUrl, setShareOpen: open, copyShareLink };
}
