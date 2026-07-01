import type { CSSProperties } from "react";
import {
  COPY,
  usePrivacyState,
  keepUntilLabel,
  fieldLbl,
} from "./Privacy.parts.tsx";
import type { OwnerState } from "../../core/badge.ts";
import type { AliasRecord, ContactRecord } from "../../store/index.ts";
import type { PushControls } from "../app/usePush.ts";
import { LiveLinks } from "./Privacy.aliases.tsx";
import { NameCard } from "./Privacy.name.tsx";
import { HomeViewCard } from "./Privacy.homeview.tsx";
import { FindableName, type FindableOps } from "../findable/FindableName.tsx";
import {
  RecoveryPassword,
  type RecoveryPasswordOps,
} from "../settings/RecoveryPassword.tsx";
import { ShareLinkGuide } from "../findable/ShareLinkGuide.tsx";
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
  /** Which face Home opens on; defaults to "criteria". */
  homeDefaultView?: "criteria" | "shared" | undefined;
  /** Persist the Home default-face preference; absent hides the control. */
  onSetHomeDefaultView?: ((view: "criteria" | "shared") => void) | undefined;
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

// The public-name section: the claim/release card, plus the share guide once a
// name is held. Both depend on the feature being wired in (findableOps present),
// so they live together; this keeps the Privacy body's branching low.
function FindableSection({
  vanityName,
  findableOps,
}: {
  vanityName: string | null | undefined;
  findableOps: FindableOps | undefined;
}) {
  if (!findableOps) return null;
  const name = vanityName ?? null;
  return (
    <>
      <FindableName currentName={name} ops={findableOps} />
      {name !== null && name !== "" && <ShareLinkGuide handle={name} />}
    </>
  );
}

// A calm transparency note (not an alarm): the server deletes an abandoned backup
// after the inactivity window (server STI_ACCOUNT_INACTIVITY_TTL), and using the app
// resets it. Since opening the app IS the reset, this is honest disclosure rather
// than an actionable countdown; the date is the reference instant plus the window.
function RetentionNote({ now }: { now: number }) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 4,
        padding: "2px 2px 0",
      }}
    >
      <div style={fieldLbl}>{COPY.keepTitle}</div>
      <p
        style={{
          margin: 0,
          fontSize: 13,
          lineHeight: 1.5,
          color: "var(--text-muted)",
        }}
      >
        {COPY.keepBody}
      </p>
      <p style={{ margin: 0, fontSize: 13, color: "var(--text-muted)" }}>
        {COPY.keepPrefix}
        <strong style={{ color: "var(--text-strong)", fontWeight: 700 }}>
          {keepUntilLabel(now)}
        </strong>
        .
      </p>
    </div>
  );
}

// The owner-only identity + preference cards (name, Home default face, avatar),
// each shown only when its setter is wired. Split out so Privacy stays within its
// complexity ceiling.
function OwnerCards({
  name,
  onSetName,
  homeDefaultView,
  onSetHomeDefaultView,
  avatarSrc,
  onEditAvatar,
}: {
  name: string | null;
  onSetName?: ((name: string | null) => void) | undefined;
  homeDefaultView: "criteria" | "shared";
  onSetHomeDefaultView?: ((view: "criteria" | "shared") => void) | undefined;
  avatarSrc?: string | undefined;
  onEditAvatar?: (() => void) | undefined;
}) {
  return (
    <>
      {onSetName && <NameCard name={name} onSave={onSetName} />}
      {onSetHomeDefaultView && (
        <HomeViewCard value={homeDefaultView} onChange={onSetHomeDefaultView} />
      )}
      {onEditAvatar && avatarSrc !== undefined && (
        <AvatarCard src={avatarSrc} onEdit={onEditAvatar} />
      )}
    </>
  );
}

// The password-factor card, wrapped so its presence check lives here (like
// FindableSection) rather than adding a branch to Privacy. Renders nothing until the
// caller wires the ops (recovery flag on + logged in).
function RecoverySection({
  recoveryName,
  recoveryOps,
}: {
  recoveryName: string | null | undefined;
  recoveryOps: RecoveryPasswordOps | undefined;
}) {
  if (!recoveryOps) return null;
  return (
    <RecoveryPassword recoveryName={recoveryName ?? null} ops={recoveryOps} />
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
  onLogOut,
  onViewPrivacyPolicy,
  onViewTerms,
  name = null,
  onSetName,
  homeDefaultView = "criteria",
  onSetHomeDefaultView,
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
          gap: 18,
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

        <AboutLegal
          onViewPromises={onViewPromises}
          onViewPrivacyPolicy={onViewPrivacyPolicy}
          onViewTerms={onViewTerms}
        />

        <OwnerCards
          name={name}
          onSetName={onSetName}
          homeDefaultView={homeDefaultView}
          onSetHomeDefaultView={onSetHomeDefaultView}
          avatarSrc={avatarSrc}
          onEditAvatar={onEditAvatar}
        />

        {/* One unified list of every live link (public/casual aliases + contact
            links), each individually revocable. */}
        <LiveLinks
          aliases={aliases}
          contacts={contacts}
          onRevokeAlias={onRevokeAlias}
          onRevokeContact={onRevokeContact}
          onViewAs={onViewAs}
        />

        {/* Public name (doc 17): the claim/release card, plus the share guide right
            after a name is claimed. Shown only when the section is wired in (the
            caller gates on the flag + login). */}
        <FindableSection vanityName={vanityName} findableOps={findableOps} />

        {/* The optional password factor (doc 32): shown only when the caller wires
            the ops (recovery flag on + logged in). */}
        <RecoverySection
          recoveryName={recoveryName}
          recoveryOps={recoveryOps}
        />

        <AttributesCard state={state} />
        <ControlsCard state={state} push={push} />
        {onLogOut && (
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
            Log out
          </button>
        )}
        <RetentionNote now={now ?? Date.now()} />
        <DangerZone state={state} onDeleted={onDeleted} />
      </div>
    </div>
  );
}
