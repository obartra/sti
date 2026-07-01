import { COPY, usePrivacyState } from "./Privacy.parts.tsx";
import type { OwnerState } from "../../core/badge.ts";
import type { PushControls } from "../app/usePush.ts";
import { type FindableOps } from "../findable/FindableName.tsx";
import { type RecoveryPasswordOps } from "../settings/RecoveryPassword.tsx";
import { DangerZone } from "./Privacy.danger.tsx";
import { AccountSection } from "./Privacy.account.tsx";
import { ProfileSection } from "./Privacy.profile.tsx";
import { AboutFooter } from "./Privacy.about.tsx";

export interface PrivacyProps {
  ownerState: OwnerState;
  setOwnerState: (update: (prev: OwnerState) => OwnerState) => void;
  push?: PushControls | undefined;
  onDeleted?: (() => void) | undefined;
  /** Open the plain-English privacy promises page. */
  onViewPromises?: (() => void) | undefined;
  /** Log out of this device (forgets the saved sign-in; the phrase still works). */
  onLogOut?: (() => void) | undefined;
  /** Open the privacy policy page (doc 23). */
  onViewPrivacyPolicy?: (() => void) | undefined;
  /** Open the terms page (doc 23). */
  onViewTerms?: (() => void) | undefined;
  /** The owner's current local display name, or null when none is set. */
  name?: string | null | undefined;
  /** Persist a new (or cleared) local display name; absent hides the name editor
   * (e.g. logged-out preview / Storybook). */
  onSetName?: ((name: string | null) => void) | undefined;
  /** Live preview src for the current avatar; with onEditAvatar, shows the editor entry. */
  avatarSrc?: string | undefined;
  onEditAvatar?: (() => void) | undefined;
  /** Reference instant for the retention notice (defaults to now). Pinned by
   * stories/tests so the "kept until" date is deterministic. */
  now?: number | undefined;
  /** The owner's claimed findable name, or null when none (doc 17). */
  vanityName?: string | null | undefined;
  /** The owner's recovery name, or null when no password is set (doc 32). */
  recoveryName?: string | null | undefined;
  /** Turn the password factor on/off; present (and the card shown) only when
   * recovery is enabled and the owner is logged in. */
  recoveryOps?: RecoveryPasswordOps | undefined;
  /** Findable claim/release transport; present (and the section shown) only when
   * the feature is enabled and the owner is logged in. */
  findableOps?: FindableOps | undefined;
}

// A plain, safe log-out row at the top of Settings. Kept well away from the danger
// zone: logging out is reversible (the phrase still works), delete is not.
function LogOutRow({ onLogOut }: { onLogOut: () => void }) {
  return (
    <button
      type="button"
      onClick={onLogOut}
      style={{
        alignSelf: "flex-start",
        padding: 0,
        background: "none",
        border: "none",
        cursor: "pointer",
        fontSize: 14,
        fontWeight: 700,
        color: "var(--text-accent)",
      }}
    >
      {COPY.logOut}
    </button>
  );
}

export function Privacy({
  ownerState,
  setOwnerState,
  push,
  onDeleted,
  onViewPromises,
  onLogOut,
  onViewPrivacyPolicy,
  onViewTerms,
  name = null,
  onSetName,
  avatarSrc,
  onEditAvatar,
  now,
  vanityName = null,
  findableOps,
  recoveryName = null,
  recoveryOps,
}: PrivacyProps) {
  const state = usePrivacyState(ownerState, setOwnerState);
  return (
    <div style={{ display: "flex", justifyContent: "center" }}>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 22,
          width: "100%",
          maxWidth: 600,
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

        {onLogOut && <LogOutRow onLogOut={onLogOut} />}

        <AccountSection
          name={name}
          onSetName={onSetName}
          vanityName={vanityName}
          findableOps={findableOps}
          recoveryName={recoveryName}
          recoveryOps={recoveryOps}
        />

        <ProfileSection
          state={state}
          push={push}
          avatarSrc={avatarSrc}
          onEditAvatar={onEditAvatar}
        />

        <DangerZone state={state} onDeleted={onDeleted} />

        <AboutFooter
          now={now ?? Date.now()}
          onViewPromises={onViewPromises}
          onViewPrivacyPolicy={onViewPrivacyPolicy}
          onViewTerms={onViewTerms}
        />
      </div>
    </div>
  );
}
