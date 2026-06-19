import { useEffect, useState } from "react";
import { PublicResolution, type ResolvedView } from "./PublicResolution.tsx";
import type { AliasLink, PassportStore } from "../../store/index.ts";

// Resolves a shared link through the store and renders the public card. While
// resolving (and on any failure) `resolved` is null, which is the uniform gray
// state, so a viewer never sees a distinct loading or error surface that could
// leak whether the alias exists. The viewer holds the link, so they get the
// knock affordance on gray-nothing (linkHolder).
export interface PublicResolutionScreenProps {
  store: PassportStore;
  link: AliasLink;
  onBack?: () => void;
  onClaim?: () => void;
  onVerify?: () => void;
}

const noop = (): void => undefined;

export function PublicResolutionScreen({
  store,
  link,
  onBack = noop,
  onClaim = noop,
  onVerify = noop,
}: PublicResolutionScreenProps) {
  const [resolved, setResolved] = useState<ResolvedView | null>(null);

  // Key on the primitive id + key, not the link object: the renderer builds a
  // fresh { id, key } each render, so depending on the object would refetch
  // every render.
  const { id, key } = link;
  useEffect(() => {
    let active = true;
    setResolved(null);
    void store
      .resolveAlias({ id, key })
      .then((r) => {
        if (active) setResolved(r);
      })
      .catch(() => {
        // Pin the fail-closed guarantee at the call site: any store impl that
        // rejects (against the contract) still lands on the uniform gray state,
        // never an unhandled rejection.
        if (active) setResolved(null);
      });
    return () => {
      active = false;
    };
  }, [store, id, key]);

  return (
    <PublicResolution
      resolved={resolved}
      linkHolder
      onBack={onBack}
      onClaim={onClaim}
      onVerify={onVerify}
    />
  );
}
