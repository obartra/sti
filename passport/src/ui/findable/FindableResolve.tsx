import { useEffect, useRef, useState } from "react";
import { Button, Card } from "../../design/components/index.ts";
import { Globe, Lock } from "../../design/icons.tsx";
import { CREATE_ACCOUNT_CTA } from "../../copy/canonical.ts";

// The resolve→knock handoff (doc 17, F5b). A `/u/{name}` link lands here: look the
// name up to its opaque alias id, then hand into the normal knock flow against
// that id (a findable name carries no key, so it's the keyless gated path,
// resolveAlias yields gray-nothing and the public screen shows "ask to view").
// A miss/unreachable is the uniform "not found", so existence stays fail-closed.

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
      <Card
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          fontSize: 14,
          color: "var(--text-muted)",
        }}
      >
        <span style={{ color: "var(--text-accent)", flex: "none" }}>
          <Globe size={18} />
        </span>
        <span>
          {COPY.looking}{" "}
          <span
            style={{
              fontFamily: "var(--font-mono, ui-monospace, monospace)",
              fontWeight: 700,
              color: "var(--text-strong)",
            }}
          >
            {name}
          </span>
          …
        </span>
      </Card>
    );
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 16,
        width: "100%",
        maxWidth: 600,
      }}
    >
      <div>
        <h1
          style={{
            fontSize: 24,
            fontWeight: 800,
            letterSpacing: "-0.02em",
            color: "var(--text-strong)",
          }}
        >
          {COPY.notFoundTitle}
        </h1>
        <p
          style={{
            fontSize: 15,
            lineHeight: 1.55,
            color: "var(--text-body)",
            marginTop: 8,
          }}
        >
          {COPY.notFoundBody}
        </p>
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          gap: 7,
          color: "var(--text-subtle)",
          fontSize: 12,
          lineHeight: 1.5,
        }}
      >
        <Lock size={13} style={{ flex: "none", marginTop: 2 }} />
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
