import { useState, type ReactElement } from "react";
import { Button } from "../../design/components/index.ts";
import { Globe } from "../../design/icons.tsx";
import { AvatarBuilder } from "../onboarding/AvatarBuilder.tsx";
import {
  anonymousFace,
  pseudonymFor,
  type AvatarConfig,
} from "../../lib/avatars.ts";
import type { AliasIdentity } from "../../store/index.ts";

/* The share sheet's per-alias identity choice (doc 15): a link shows either the
   unlinkable id-derived face (default) or the owner's main identity, with the
   findability warning on the opt-in. When showing the name, the owner can pick a
   different face for this one link, so two revealed links can't be tied together
   by an identical avatar. Lifted out of ShareSheet to keep that file under its
   size/complexity caps. */

const COPY = {
  anonymous: "Anonymous",
  main: "Show my name",
  warn: "If you show your name on this link, anyone who receives it can recognize you and connect it to your other shares.",
  faceTitle: "Face for this link",
  faceDefault:
    "Your default face. Pick a different one to keep this link apart.",
  facePick: "Pick a face",
  faceReset: "Use my default",
  faceDone: "Done",
} as const;

/**
 * The face the preview (and the viewer) sees for this link: the owner's main
 * identity when chosen (or when no control is wired, e.g. Storybook), else the
 * deterministic id-derived anonymous face keyed off the alias id (`seed`). A
 * per-link face override (doc 15) swaps the avatar on a "main" link.
 */
export function previewFace(opts: {
  choice: AliasIdentity;
  identity: { handle?: string };
  avatarSrc: string | undefined;
  seed: string;
  hasControl: boolean;
  overrideSrc?: string | undefined;
}): { handle: string; avatarSrc: string | undefined } {
  const { choice, identity, avatarSrc, seed, hasControl, overrideSrc } = opts;
  if (choice === "main" || !hasControl) {
    // An owner with no display name has no name to show, but their "main" link
    // still resolves (for the viewer) to the id-derived pseudonym handle, keeping
    // their real avatar. Mirror that here so the preview never shows a blank "@".
    // A per-link override wins over the account face when set.
    return {
      handle: identity.handle ?? pseudonymFor(seed),
      avatarSrc: overrideSrc ?? avatarSrc,
    };
  }
  // The anonymous identity: id-derived handle + id-seeded face (doc 19). Both come
  // from the opaque alias id, never the readable handle.
  return anonymousFace(seed);
}

export function IdentityChoiceRow({
  choice,
  hasName = true,
  onChange,
}: {
  choice: AliasIdentity;
  // Whether the owner set a display name. With no name there is nothing to show
  // (the link stays anonymous), so the choice is hidden rather than offering a
  // misleading "show my name".
  hasName?: boolean;
  // Absent hides the control (e.g. Storybook), so the parent can render it
  // unconditionally without a wrapping guard.
  onChange?: ((choice: AliasIdentity) => void) | undefined;
}): ReactElement | null {
  if (onChange === undefined || !hasName) return null;
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

/**
 * The per-link face control (doc 15), shown only when the owner is showing their
 * name AND a control is wired. Collapsed, it says which face this link uses (the
 * account default until overridden) and offers to pick a different one; expanded, it
 * shows the avatar builder plus "use my default" to clear the override. The chosen
 * face applies to this link only, so two revealed links can carry different faces.
 */
export function FaceOverrideRow({
  choice,
  override,
  fallback,
  onChange,
}: {
  choice: AliasIdentity;
  // The current per-link override, or undefined when the link uses the default face.
  override: AvatarConfig | undefined;
  // The account's default face, edited from here when there is no override yet.
  // Absent hides the control (e.g. Storybook), so the parent renders it unguarded.
  fallback: AvatarConfig | undefined;
  // Absent hides the control (e.g. Storybook), matching IdentityChoiceRow.
  onChange?: ((avatar: AvatarConfig | undefined) => void) | undefined;
}): ReactElement | null {
  const [editing, setEditing] = useState(false);
  if (onChange === undefined || fallback === undefined || choice !== "main") {
    return null;
  }
  const working = override ?? fallback;
  return (
    <div style={{ margin: "0 0 14px" }}>
      <div
        style={{
          fontSize: 13,
          fontWeight: 700,
          color: "var(--text-strong)",
          marginBottom: 4,
        }}
      >
        {COPY.faceTitle}
      </div>
      {!editing ? (
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div
            style={{
              flex: 1,
              fontSize: 12,
              lineHeight: 1.45,
              color: "var(--text-subtle)",
            }}
          >
            {COPY.faceDefault}
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setEditing(true)}
          >
            {COPY.facePick}
          </Button>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <AvatarBuilder config={working} onChange={onChange} />
          <div style={{ display: "flex", gap: 8 }}>
            {override !== undefined && (
              <Button
                variant="quiet"
                size="md"
                block
                onClick={() => {
                  onChange(undefined);
                  setEditing(false);
                }}
              >
                {COPY.faceReset}
              </Button>
            )}
            <Button
              variant="primary"
              size="md"
              block
              onClick={() => setEditing(false)}
            >
              {COPY.faceDone}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
