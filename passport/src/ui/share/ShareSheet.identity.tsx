import type { ReactElement } from "react";
import { Button } from "../../design/components/index.ts";
import { Globe } from "../../design/icons.tsx";
import { anonymousFace } from "../../lib/avatars.ts";
import type { AliasIdentity } from "../../store/index.ts";

/* The share sheet's per-alias identity choice (doc 15): a link shows either the
   unlinkable id-derived face (default) or the owner's main identity, with the
   findability warning on the opt-in. Lifted out of ShareSheet to keep that file
   under its size/complexity caps. */

const COPY = {
  anonymous: "Anonymous",
  main: "Show my name",
  warn: "Anyone you share this with can recognize you, and can connect it to your other links.",
} as const;

/**
 * The face the preview (and the viewer) sees for this link: the owner's main
 * identity when chosen (or when no control is wired, e.g. Storybook), else the
 * deterministic id-derived anonymous face keyed off the alias id (`seed`).
 */
export function previewFace(opts: {
  choice: AliasIdentity;
  identity: { handle: string };
  avatarSrc: string | undefined;
  seed: string;
  hasControl: boolean;
}): { handle: string; avatarSrc: string | undefined } {
  const { choice, identity, avatarSrc, seed, hasControl } = opts;
  if (choice === "main" || !hasControl) {
    return { handle: identity.handle, avatarSrc };
  }
  // The anonymous identity: id-derived handle + id-seeded face (doc 19). Both come
  // from the opaque alias id, never the readable handle.
  return anonymousFace(seed);
}

export function IdentityChoiceRow({
  choice,
  onChange,
}: {
  choice: AliasIdentity;
  // Absent hides the control (e.g. Storybook), so the parent can render it
  // unconditionally without a wrapping guard.
  onChange?: ((choice: AliasIdentity) => void) | undefined;
}): ReactElement | null {
  if (onChange === undefined) return null;
  return (
    <div style={{ margin: "0 0 14px" }}>
      <div style={{ display: "flex", gap: 8 }}>
        <Button
          variant={choice === "anonymous" ? "primary" : "quiet"}
          size="md"
          block
          onClick={() => onChange("anonymous")}
        >
          {COPY.anonymous}
        </Button>
        <Button
          variant={choice === "main" ? "primary" : "quiet"}
          size="md"
          block
          onClick={() => onChange("main")}
        >
          {COPY.main}
        </Button>
      </div>
      {choice === "main" && (
        <div
          style={{
            marginTop: 8,
            display: "flex",
            gap: 6,
            fontSize: 12,
            lineHeight: 1.45,
            color: "var(--text-subtle)",
          }}
        >
          <Globe size={13} style={{ flex: "none", marginTop: 2 }} />
          {COPY.warn}
        </div>
      )}
    </div>
  );
}
