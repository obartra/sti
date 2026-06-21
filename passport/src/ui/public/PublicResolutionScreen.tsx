import { useEffect, useState } from "react";
import { PublicResolution, type ResolvedView } from "./PublicResolution.tsx";
import type {
  AliasLink,
  ContactInvite,
  ContactLinkResult,
  PassportStore,
} from "../../store/index.ts";

// Resolves a shared link through the store and renders the public card. While
// resolving (and on any failure) `resolved` is null, which is the uniform gray
// state, so a viewer never sees a distinct loading or error surface that could
// leak whether the alias exists. The viewer holds the link, so they get the
// knock affordance on gray-nothing (linkHolder).
export interface PublicResolutionScreenProps {
  store: PassportStore;
  link: AliasLink;
  // When a logged-in viewer opened a contact invite: the parsed invite + the
  // accept action. "Add to contacts" then replaces the knock affordance.
  invite?: ContactInvite | undefined;
  onAcceptInvite?:
    | ((invite: ContactInvite, label: string) => Promise<ContactLinkResult>)
    | undefined;
  onBack?: () => void;
  onClaim?: () => void;
  onVerify?: () => void;
}

const noop = (): void => undefined;

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
  onBack = noop,
  onClaim = noop,
  onVerify = noop,
}: PublicResolutionScreenProps) {
  const [resolved, setResolved] = useState<ResolvedView | null>(null);
  const [requested, setRequested] = useState(false);

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

  // A logged-in viewer who opened an invite (not a return) can add the inviter as
  // a two-way contact; the action resolves with the return link to send back.
  const canAccept =
    invite !== undefined &&
    invite.ref === undefined &&
    onAcceptInvite !== undefined;
  const onAccept = canAccept
    ? (label: string) =>
        onAcceptInvite(invite, label).then((result) => result.url)
    : undefined;

  return (
    <PublicResolution
      resolved={resolved}
      linkHolder
      canAccept={canAccept}
      onAccept={onAccept}
      onBack={onBack}
      onClaim={onClaim}
      onVerify={onVerify}
      onKnock={onKnock}
    />
  );
}
