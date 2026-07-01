import { useEffect, useState } from "react";
import { PublicResolution, type ResolvedView } from "./PublicResolution.tsx";
import { ReportName } from "../findable/ReportName.tsx";
import type {
  AliasLink,
  ContactInvite,
  ContactLinkResult,
  PassportStore,
} from "../../store/index.ts";
import type { VanityReportReason } from "../../api/client.ts";

// Resolves a shared link through the store and renders the public card. While
// resolving (and on any failure) `resolved` is null, which is the uniform gray
// state, so a viewer never sees a distinct loading or error surface that could
// leak whether the alias exists. The viewer holds the link, so they get the
// knock affordance on gray-nothing (linkHolder).
export interface PublicResolutionScreenProps {
  store: PassportStore;
  link: AliasLink;
  // When a logged-in viewer opened a contact invite: the parsed invite + the
  // accept action. "Add to contacts" then replaces the knock affordance. When the
  // invite is a RETURN link (it carries `ref`), onIngestReturn completes the
  // two-way link in one tap instead (doc 13 path A).
  invite?: ContactInvite | undefined;
  onAcceptInvite?:
    | ((invite: ContactInvite, label: string) => Promise<ContactLinkResult>)
    | undefined;
  onIngestReturn?: ((ret: ContactInvite) => void) | undefined;
  onBack?: () => void;
  onClaim?: () => void;
  onVerify?: () => void;
  // Set when the viewer reached this card through a public findable name (doc 17):
  // the name plus the report transport enable the "report this name" affordance.
  name?: string | undefined;
  reportName?:
    | ((name: string, reason: VanityReportReason) => Promise<void>)
    | undefined;
}

const noop = (): void => undefined;

// The two-way link actions the opened invite unlocks for a logged-in viewer:
// a fresh invite (no `ref`) offers accept (mint + return link); a RETURN link
// (`ref` present) offers connect (ingest, completing the link in one tap). Split
// out so the screen body stays under its complexity cap.
function inviteActions(
  invite: ContactInvite | undefined,
  onAcceptInvite:
    | ((invite: ContactInvite, label: string) => Promise<ContactLinkResult>)
    | undefined,
  onIngestReturn: ((ret: ContactInvite) => void) | undefined,
): {
  canAccept: boolean;
  onAccept: ((label: string) => Promise<string>) | undefined;
  canConnect: boolean;
  onConnect: (() => void) | undefined;
} {
  if (invite === undefined) {
    return {
      canAccept: false,
      onAccept: undefined,
      canConnect: false,
      onConnect: undefined,
    };
  }
  const isReturn = invite.ref !== undefined;
  const acceptable = !isReturn && onAcceptInvite !== undefined;
  const connectable = isReturn && onIngestReturn !== undefined;
  return {
    canAccept: acceptable,
    onAccept: acceptable
      ? (label) => onAcceptInvite(invite, label).then((r) => r.url)
      : undefined,
    canConnect: connectable,
    onConnect: connectable ? () => onIngestReturn(invite) : undefined,
  };
}

// How often the viewer re-checks for an approved in-app grant after knocking.
// Owner approval is a human action, so a few seconds is responsive enough and
// keeps the polling light.
const GRANT_POLL_MS = 4000;
// Cap the live poll (~5 min) so an open-but-forgotten screen doesn't poll forever;
// a later approval still resolves via the mount fallback on the next visit.
const GRANT_POLL_MAX_ATTEMPTS = 75;

export function PublicResolutionScreen({
  store,
  link,
  invite,
  onAcceptInvite,
  onIngestReturn,
  onBack = noop,
  onClaim = noop,
  onVerify = noop,
  name,
  reportName,
}: PublicResolutionScreenProps) {
  const [resolved, setResolved] = useState<ResolvedView | null>(null);
  const [requested, setRequested] = useState(false);
  const [reporting, setReporting] = useState(false);

  // Key on the primitive id + key, not the link object: the renderer builds a
  // fresh { id, key } each render, so depending on the object would refetch
  // every render.
  const { id, key } = link;
  useEffect(() => {
    let active = true;
    setResolved(null);
    setRequested(false);
    // First try the link's own key; if that's gray-nothing, fall back to an in-app
    // grant this device may already hold (the owner could have approved a knock
    // from a previous visit). Both fail closed to the uniform null.
    void store
      .resolveAlias({ id, key })
      .catch(() => null)
      .then((direct) => {
        if (!active || direct !== null) {
          if (active) setResolved(direct);
          return null;
        }
        return store.redeemGrant(id).catch(() => null);
      })
      .then((granted) => {
        if (active && granted !== null) setResolved(granted);
      });
    return () => {
      active = false;
    };
  }, [store, id, key]);

  // After the viewer has knocked, poll for the owner's approval until the card
  // resolves, a bounded window passes, or the screen unmounts; the status then
  // flips in silently. A longer-delayed approval still resolves via the mount
  // fallback on the viewer's next visit, so the poll need not run forever.
  useEffect(() => {
    if (!requested || resolved !== null) return;
    let active = true;
    let attempts = 0;
    const timer = setInterval(() => {
      if (++attempts > GRANT_POLL_MAX_ATTEMPTS) {
        clearInterval(timer);
        return;
      }
      void store
        .redeemGrant(id)
        .then((r) => {
          if (active && r !== null) setResolved(r);
        })
        .catch(() => undefined);
    }, GRANT_POLL_MS);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [requested, resolved, store, id]);

  // The viewer holds the link, so they may knock when they land on gray-nothing.
  // The knock carries this device's grant key; once it settles we start polling
  // for the owner's approval. A failure is swallowed (existence-uniform) but we
  // still poll: the key was stored, so a later approval can still resolve.
  const onKnock = () => {
    void store
      .knock(id)
      .catch(() => undefined)
      .finally(() => setRequested(true));
  };

  // The two-way link actions a logged-in viewer gets from the opened invite: accept
  // (a fresh invite) or connect (a RETURN link). Derived once, off the hot path.
  const { canAccept, onAccept, canConnect, onConnect } = inviteActions(
    invite,
    onAcceptInvite,
    onIngestReturn,
  );

  // The report affordance exists only when the viewer arrived via a findable name
  // and a transport was wired (the gated path); otherwise it stays absent.
  const canReport = name !== undefined && reportName !== undefined;
  if (reporting && name !== undefined && reportName !== undefined) {
    return (
      <ReportName
        name={name}
        report={(reason) => reportName(name, reason)}
        onClose={() => setReporting(false)}
      />
    );
  }

  return (
    <PublicResolution
      resolved={resolved}
      aliasId={id}
      linkHolder
      canAccept={canAccept}
      onAccept={onAccept}
      canConnect={canConnect}
      onConnect={onConnect}
      onBack={onBack}
      onClaim={onClaim}
      onVerify={onVerify}
      onKnock={onKnock}
      onReport={canReport ? () => setReporting(true) : undefined}
    />
  );
}
