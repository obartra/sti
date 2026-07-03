import { useEffect, useRef, useState } from "react";
import { Button } from "../../design/components/index.ts";
import { Globe, Lock } from "../../design/icons.tsx";
import { CREATE_ACCOUNT_CTA } from "../../copy/canonical.ts";
import "./findable.css";

// The resolve→knock handoff (doc 17, F5b). A `/u/{name}` link lands here: look the
// name up to its opaque alias id, then hand into the normal knock flow against
// that id (a findable name carries no key, so it's the keyless gated path,
// resolveAlias yields gray-nothing and the public screen shows "ask to view").
// A miss/unreachable is the uniform "not found", so existence stays fail-closed.
// Editorial grammar (doc 37): a quiet looking-up line, then a serif not-found
// page on the surface; no cards, no warning tint (a miss is not an error).

const COPY = {
  looking: "Looking up",
  notFoundTitle: "No one at that name",
  notFoundBody:
    "It might be unclaimed, recently released, or mistyped. Names aren't tied to a person, so double-check the spelling.",
  privacy: "Looking a name up reveals nothing about anyone's status.",
  claim: CREATE_ACCOUNT_CTA,
  back: "Back",
} as const;

export interface FindableResolveProps {
  /** The normalized vanity name from the /u/{name} link. */
  name: string;
  /** Resolve a name to its alias id, or null (unregistered / unreachable). */
  resolve: (name: string) => Promise<string | null>;
  /** Hand off to the knock flow against the resolved alias id. */
  onResolved: (aliasId: string) => void;
  onClaim?: () => void;
  onBack?: () => void;
}

export function FindableResolve({
  name,
  resolve,
  onResolved,
  onClaim,
  onBack,
}: FindableResolveProps) {
  const [state, setState] = useState<"resolving" | "notfound">("resolving");

  // Keep the latest callbacks in refs so the lookup effect depends only on `name`:
  // the screen renderer passes fresh `resolve`/`onResolved` closures each render,
  // and depending on them would re-run the lookup (and bounce the nav) every time.
  const resolveRef = useRef(resolve);
  resolveRef.current = resolve;
  const onResolvedRef = useRef(onResolved);
  onResolvedRef.current = onResolved;

  useEffect(() => {
    let active = true;
    setState("resolving");
    void resolveRef.current(name).then((aliasId) => {
      if (!active) return;
      if (aliasId !== null) onResolvedRef.current(aliasId);
      else setState("notfound");
    });
    return () => {
      active = false;
    };
  }, [name]);

  if (state === "resolving") {
    return (
      <div className="fres__looking">
        <span aria-hidden className="fres__looking-icon">
          <Globe size={18} />
        </span>
        <span>
          {COPY.looking} <span className="fres__name">{name}</span>…
        </span>
      </div>
    );
  }

  return (
    <div className="fres">
      <div>
        <h1 className="fres__title">{COPY.notFoundTitle}</h1>
        <p className="fres__body">{COPY.notFoundBody}</p>
      </div>
      <div className="fres__privacy">
        <span aria-hidden className="fres__privacy-icon">
          <Lock size={13} />
        </span>
        {COPY.privacy}
      </div>
      <Button variant="primary" size="md" block onClick={onClaim}>
        {COPY.claim}
      </Button>
      {onBack && (
        <Button variant="ghost" size="md" block onClick={onBack}>
          {COPY.back}
        </Button>
      )}
    </div>
  );
}
