/**
 * The in-person linkup's state machine (doc 25), separated from the camera and
 * the markup so it is testable without either. On mount it mints this device's
 * OFFER (a pending contact + the URL the shown QR carries); when the camera
 * decodes the other person's offer it completes that pending contact, and the
 * screen advances to its completion, independent of the other phone. Closing
 * before the scan lands discards the offer (revoking its alias), so walking away
 * means nothing happened; closing after completion keeps the link.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { todayEpochDay } from "../../core/clock.ts";
import {
  freshSnapshotBadge,
  type ContactInvite,
  type ScannedConnect,
} from "../../store/index.ts";
import type { AliasLink } from "../../store/index.ts";
import type { ResolvedView } from "../public/PublicResolution.tsx";
import type { BadgeState } from "../badge-card.tsx";

/** The other person, as the completion shows them: a name (may be empty until
 * their card resolves) and a badge (null until known; snapshot or live). */
export interface PeerView {
  readonly label: string;
  readonly badge: BadgeState | null;
}

/** What the linkup screen renders right now. */
export type LinkupPhase =
  | { readonly kind: "pending" }
  | { readonly kind: "failed" }
  | { readonly kind: "showing"; readonly url: string }
  | { readonly kind: "linked"; readonly peer: PeerView };

export interface LinkupDeps {
  /** Mint this device's offer: a pending contact + the URL the QR shows. */
  readonly createOffer: () => Promise<{ contactId: string; url: string }>;
  /** Complete the pending contact with the scanned offer (the store op). */
  readonly complete: (
    contactId: string,
    invite: ContactInvite,
  ) => Promise<void>;
  /** Discard the pending offer (revoke + drop) when the gesture is abandoned. */
  readonly discard: (contactId: string) => void;
  /** Resolve the peer's live card (fills the completion when online). */
  readonly resolvePeer: (link: AliasLink) => Promise<ResolvedView | null>;
  /** A scanned plain link is a view, not a linkup: route it as before. */
  readonly onViewLink: (link: AliasLink) => void;
  /** Leave the screen (both the cancel and the Done paths end here). */
  readonly onExit: () => void;
}

export interface LinkupFlow {
  readonly phase: LinkupPhase;
  /** Feed one classified scan result in (wired to the camera by the screen). */
  readonly onScanned: (scanned: ScannedConnect) => void;
  /** Re-attempt the offer mint after a failure. */
  readonly onRetry: () => void;
  /** Close the screen: discards a not-yet-linked offer, keeps a completed link. */
  readonly onClose: () => void;
}

export function useLinkupFlow(deps: LinkupDeps): LinkupFlow {
  const [offer, setOffer] = useState<{
    contactId: string;
    url: string;
  } | null>(null);
  const [failed, setFailed] = useState(false);
  const [peer, setPeer] = useState<PeerView | null>(null);
  const [attempt, setAttempt] = useState(0);
  // A scan can land before our own offer finishes minting; hold it and complete
  // once the offer exists (the effect below), so neither order is special.
  const [held, setHeld] = useState<ScannedConnect | null>(null);
  const depsRef = useRef(deps);
  depsRef.current = deps;

  useEffect(() => {
    let stale = false;
    setFailed(false);
    depsRef.current
      .createOffer()
      .then((minted) => {
        if (!stale) setOffer(minted);
      })
      .catch(() => {
        if (!stale) setFailed(true);
      });
    return () => {
      stale = true;
    };
  }, [attempt]);

  const completeWith = useCallback(
    (contactId: string, scanned: ScannedConnect & { kind: "offer" }) => {
      // Optimistic: the record write is local-first (it syncs later), so the
      // completion shows as soon as the scan lands; a failure is swallowed the
      // same way the other fire-and-fold contact actions are.
      depsRef.current
        .complete(contactId, scanned.invite)
        .catch(() => undefined);
      setPeer({
        label: scanned.invite.sharedName ?? "",
        badge: freshSnapshotBadge(scanned.snapshot, todayEpochDay()),
      });
      const alias = scanned.invite.alias;
      depsRef.current
        .resolvePeer({ id: alias.id, key: alias.key })
        .then((view) => {
          if (view === null) return;
          setPeer((prev) => {
            const kept = prev?.label ?? "";
            return {
              label: kept !== "" ? kept : view.identity.handle,
              badge: view.state,
            };
          });
        })
        .catch(() => undefined);
    },
    [],
  );

  useEffect(() => {
    if (offer === null || held?.kind !== "offer") return;
    setHeld(null);
    completeWith(offer.contactId, held);
  }, [offer, held, completeWith]);

  const onScanned = useCallback(
    (scanned: ScannedConnect) => {
      if (scanned.kind === "link") {
        depsRef.current.onViewLink(scanned.link);
        return;
      }
      if (offer === null) {
        setHeld(scanned);
        return;
      }
      completeWith(offer.contactId, scanned);
    },
    [offer, completeWith],
  );

  const onClose = useCallback(() => {
    if (peer === null && offer !== null)
      depsRef.current.discard(offer.contactId);
    depsRef.current.onExit();
  }, [peer, offer]);

  const phase: LinkupPhase =
    peer !== null
      ? { kind: "linked", peer }
      : offer !== null
        ? { kind: "showing", url: offer.url }
        : failed
          ? { kind: "failed" }
          : { kind: "pending" };

  return { phase, onScanned, onRetry: () => setAttempt((a) => a + 1), onClose };
}
