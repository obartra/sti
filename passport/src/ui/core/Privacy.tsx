import { COPY, usePrivacyState } from "./Privacy.parts.tsx";
import type { OwnerState } from "../../core/badge.ts";
import type { PushControls } from "../app/usePush.ts";
import { type FindableOps } from "../findable/FindableName.tsx";
import { type RecoveryPasswordOps } from "../settings/RecoveryPassword.tsx";
import { DangerZone } from "./Privacy.danger.tsx";
import { AccountSection } from "./Privacy.account.tsx";
import { ProfileSection } from "./Privacy.profile.tsx";
import { AboutFooter } from "./Privacy.about.tsx";
import "./settings.css";

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
  /** The owner's stored recovery phrase for re-viewing (doc 32). null means it is
   * not stored on this device (the re-view card shows the sign-in fallback);
   * undefined hides the card entirely (a logged-out preview). */
  recoveryPhrase?: string | null | undefined;
  /** Whether a passkey is enrolled on this device (doc 32): gates the phrase re-view
   * behind a passkey check when true. */
  passkeyEnrolled?: boolean | undefined;
  /** Run the passkey "confirm it's you" check before revealing the phrase (doc 32).
   * A pure presence gate; never touches the session. */
  onVerifyPasskey?: (() => Promise<boolean>) | undefined;
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
    <button type="button" onClick={onLogOut} className="st__logout">
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
  recoveryPhrase,
  passkeyEnrolled,
  onVerifyPasskey,
}: PrivacyProps) {
  const state = usePrivacyState(ownerState, setOwnerState);
  return (
    <div className="st__center">
      <div className="st">
        <h1 className="st__title">{COPY.title}</h1>

        {onLogOut && <LogOutRow onLogOut={onLogOut} />}

        <AccountSection
          name={name}
          onSetName={onSetName}
          vanityName={vanityName}
          findableOps={findableOps}
          recoveryName={recoveryName}
          recoveryOps={recoveryOps}
          recoveryPhrase={recoveryPhrase}
          passkeyEnrolled={passkeyEnrolled}
          onVerifyPasskey={onVerifyPasskey}
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
