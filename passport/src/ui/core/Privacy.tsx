import type { CSSProperties } from "react";
import { COPY, usePrivacyState } from "./Privacy.parts.tsx";
import type { OwnerState } from "../../core/badge.ts";
import type { AliasRecord, ContactRecord } from "../../store/index.ts";
import type { PushControls } from "../app/usePush.ts";
import { LiveLinks } from "./Privacy.aliases.tsx";
import { FindableName, type FindableOps } from "../findable/FindableName.tsx";
import { AvatarCard } from "../onboarding/AvatarCard.tsx";
import {
  AttributesCard,
  ControlsCard,
  DangerZone,
} from "./Privacy.sections.tsx";

export interface PrivacyProps {
  ownerState: OwnerState;
  setOwnerState: (update: (prev: OwnerState) => OwnerState) => void;
  aliases?: AliasRecord[];
  contacts?: ContactRecord[];
  onRevokeAlias?: ((id: string) => void) | undefined;
  onRevokeContact?: ((id: string) => void) | undefined;
  push?: PushControls | undefined;
  onViewAs?: (() => void) | undefined;
  onDeleted?: (() => void) | undefined;
  /** Open the plain-English privacy promises page. */
  onViewPromises?: (() => void) | undefined;
  /** Open the privacy policy page (doc 23). */
  onViewPrivacyPolicy?: (() => void) | undefined;
  /** Open the terms page (doc 23). */
  onViewTerms?: (() => void) | undefined;
  /** Live preview src for the current avatar; with onEditAvatar, shows the editor entry. */
  avatarSrc?: string | undefined;
  onEditAvatar?: (() => void) | undefined;
  /** The owner's claimed findable name, or null when none (doc 17). */
  vanityName?: string | null | undefined;
  /** Findable claim/release transport; present (and the section shown) only when
   * the feature is enabled and the owner is logged in. */
  findableOps?: FindableOps | undefined;
}

const noop = (): void => undefined;

const legalLink: CSSProperties = {
  alignSelf: "flex-start",
  padding: 0,
  background: "none",
  border: "none",
  cursor: "pointer",
  fontSize: 13.5,
  fontWeight: 700,
  color: "var(--text-accent)",
};

// The app-native home for the trust links (doc 23): the logged-in app surfaces
// promises, privacy, and terms here in settings rather than wearing a footer.
function AboutLegal({
  onViewPromises,
  onViewPrivacyPolicy,
  onViewTerms,
}: {
  onViewPromises?: (() => void) | undefined;
  onViewPrivacyPolicy?: (() => void) | undefined;
  onViewTerms?: (() => void) | undefined;
}) {
  if (!onViewPromises && !onViewPrivacyPolicy && !onViewTerms) return null;
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 8,
        marginTop: -8,
      }}
    >
      {onViewPromises && (
        <button type="button" onClick={onViewPromises} style={legalLink}>
          See the promises we keep &rarr;
        </button>
      )}
      <div style={{ display: "flex", gap: 16 }}>
        {onViewPrivacyPolicy && (
          <button type="button" onClick={onViewPrivacyPolicy} style={legalLink}>
            Privacy
          </button>
        )}
        {onViewTerms && (
          <button type="button" onClick={onViewTerms} style={legalLink}>
            Terms
          </button>
        )}
      </div>
    </div>
  );
}

export function Privacy({
  ownerState,
  setOwnerState,
  aliases = [],
  contacts = [],
  onRevokeAlias = noop,
  onRevokeContact = noop,
  push,
  onViewAs,
  onDeleted,
  onViewPromises,
  onViewPrivacyPolicy,
  onViewTerms,
  avatarSrc,
  onEditAvatar,
  vanityName = null,
  findableOps,
}: PrivacyProps) {
  const state = usePrivacyState(ownerState, setOwnerState);
  return (
    <div style={{ display: "flex", justifyContent: "center" }}>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 18,
          width: "100%",
          maxWidth: 390,
        }}
      >
        <h1
          style={{
            fontSize: 24,
            fontWeight: 800,
            letterSpacing: "-0.02em",
            color: "var(--text-strong)",
          }}
        >
          {COPY.title}
        </h1>

        <AboutLegal
          onViewPromises={onViewPromises}
          onViewPrivacyPolicy={onViewPrivacyPolicy}
          onViewTerms={onViewTerms}
        />

        {onEditAvatar && avatarSrc !== undefined && (
          <AvatarCard src={avatarSrc} onEdit={onEditAvatar} />
        )}

        {/* One unified list of every live link (public/casual aliases + contact
            links), each individually revocable. */}
        <LiveLinks
          aliases={aliases}
          contacts={contacts}
          onRevokeAlias={onRevokeAlias}
          onRevokeContact={onRevokeContact}
          onViewAs={onViewAs}
        />

        {/* Findable name (doc 17), shown only when the feature is wired in (the
            caller gates on the flag + login). Self-contained claim/release card. */}
        {findableOps && (
          <FindableName currentName={vanityName} ops={findableOps} />
        )}

        <AttributesCard state={state} />
        <ControlsCard state={state} push={push} />
        <DangerZone state={state} onDeleted={onDeleted} />
      </div>
    </div>
  );
}
