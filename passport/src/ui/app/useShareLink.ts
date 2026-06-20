import { useCallback, useRef, useState, type RefObject } from "react";
import type {
  OwnerSession,
  SessionController,
  ShareLinkResult,
} from "../../store/index.ts";

export interface ShareLinkControls {
  /** The owner's real shareable link, or null until the share sheet is opened. */
  readonly shareUrl: string | null;
  /** Open/close the share sheet; opening mints/refreshes the alias for the mode. */
  readonly setShareOpen: (open: boolean) => void;
  /** Copy the current real link to the clipboard (no-op if none / unavailable). */
  readonly copyShareLink: () => void;
  /** Revoke the current link (it stops resolving) and surface a fresh one. */
  readonly revokeLink: () => void;
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
      preparing.current = true;
      void produce(current)
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
    [sessionRef, setSession],
  );

  const open = useCallback(
    (next: boolean) => {
      setShareOpen(next);
      if (next) prepare((s) => controller.shareLink(s), true);
    },
    [controller, prepare, setShareOpen],
  );

  const revokeLink = useCallback(() => {
    prepare((s) => controller.renewLink(s), false);
  }, [controller, prepare]);

  const copyShareLink = useCallback(() => {
    if (shareUrl === null) return;
    try {
      void navigator.clipboard.writeText(shareUrl).catch(() => undefined);
    } catch {
      // no clipboard available
    }
  }, [shareUrl]);

  return { shareUrl, setShareOpen: open, copyShareLink, revokeLink };
}
