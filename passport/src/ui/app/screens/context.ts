import type { ReactNode } from "react";
import type { Nav } from "../useAppRouter.ts";
import type { RouteData, Screen } from "../routes.ts";
import type {
  AliasIdentity,
  AliasRecord,
  ContactInvite,
  ContactLinkResult,
  ContactRecord,
  CreateGroupInput,
  CreateGroupResult,
  GrantMode,
  GroupRecord,
  OwnerView,
  DoorStore,
  PassportStore,
  PendingKnock,
  RosterMemberView,
} from "../../../store/index.ts";
import type { VanityRegisterResult } from "../../../api/client.ts";
import type {
  SetRecoveryPasswordInput,
  SetRecoveryPasswordOutcome,
} from "../../../store/recoveryOps.ts";
import type { OnboardingActions } from "../useOnboarding.ts";
import type { GroupJoinActions } from "../useGroupJoinActions.ts";
import type { PushControls } from "../usePush.ts";
import type { ReportOutcome } from "../../../core/report.ts";
import type { OwnerState } from "../../../core/badge.ts";
import type { AvatarConfig } from "../../../lib/avatars.ts";

// What every routed screen gets: navigation, the owner's derived view, the raw
// owner state + its setter (for settings), the onboarding/login actions, the
// report-result action, the share-sheet opener, the backend boundary, and the
// current route's payload.
export interface ScreenCtx extends GroupJoinActions {
  nav: Nav;
  owner: OwnerView;
  /** The owner's raw badge inputs, for settings screens to read and edit. */
  ownerState: OwnerState;
  onboarding: OnboardingActions;
  /** Apply a reported test result to the owner's state (logged-in only). */
  onReport: (outcome: ReportOutcome) => void;
  /**
   * Apply an update to the owner state and republish (logged-in only). Takes an
   * updater (not a value) so concurrent edits compose against the latest state.
   */
  setOwnerState: (update: (prev: OwnerState) => OwnerState) => void;
  openShare: () => void;
  /** Permanently delete the account and return to the logged-out landing. */
  onDeleteAccount: () => void;
  /** Log out: forget the persisted root and return to the landing (doc 24). */
  onLogOut: () => void;
  /** "Keep me signed in on this device" choice + setter (doc 24). */
  keepSignedIn: boolean;
  onKeepSignedInChange: (v: boolean) => void;
  /** Persist a new account-wide avatar (logged-in only; keeps sharing mode). */
  onSetAvatar: (avatar: AvatarConfig) => void;
  /** Persist the owner's local display name (logged-in only; null clears it). */
  onSetName: (name: string | null) => void;
  /** Count of current knocks across the owner's aliases (contentless; 0 logged out). */
  knockCount: number;
  /** Re-pull the knock count + pending approvals (e.g. when the inbox opens). */
  refreshKnocks: () => void;
  /** Whether any waiting knock can be granted in-app (it carried a key). */
  canApproveKnocks: boolean;
  /** Whether to show the contentless "someone asked" row (knocks with no key). */
  showKnockInfo: boolean;
  /** Grant every waiting knock. "standing" seals each alias key (live access);
   * "once" seals a frozen card snapshot (seen once, no live access). */
  approveKnocks: (mode: GrantMode) => void;
  /** An approve is in flight (disable the control). */
  approvingKnocks: boolean;
  /** A linked contact reported a positive: show the contentless "get tested" row. */
  showPartnerNudge: boolean;
  /** Dismiss the partner-notify row for this session (the ping carries no nonce). */
  dismissPartnerNudge: () => void;
  /** The owner's published aliases (public/casual links); empty logged out. */
  aliases: AliasRecord[];
  /** Revoke one published alias by id (its link stops resolving). */
  onRevokeAlias: (id: string) => void;
  /** The owner's per-contact links (newest last); empty logged out. */
  contacts: ContactRecord[];
  /** Mint a new per-contact link for `label` with a face (anonymous, or the
   * owner's name) and a lifetime: `expiresAt` is the absolute instant the link
   * stops working, or null for until-revoked. Resolves with the contact + URL. */
  onCreateContactLink: (
    label: string,
    identity: AliasIdentity,
    expiresAt: number | null,
  ) => Promise<ContactLinkResult>;
  /** Rename one contact link's local label (owner-only nickname; never shared). */
  onRenameContact: (id: string, label: string) => void;
  /** Back-date the day you met a contact (doc 25); seeds partner-notify. */
  onSetEncounterDay: (id: string, day: number) => void;
  /** Revoke one contact link by id. */
  onRevokeContact: (id: string) => void;
  /** Starred contact ids (device-local display preference); empty logged out. */
  faves: ReadonlySet<string>;
  /** Toggle one contact's star. */
  onToggleFave: (id: string) => void;
  /** The device-local list of access requests this viewer has made, newest first;
   * the way back for a logged-out viewer. Empty on a device that never knocked. */
  pendingRequests: PendingKnock[];
  /** Forget one pending request by alias id (the viewer dismissed it). */
  onForgetRequest: (aliasId: string) => void;
  /** Whether a session is active (a logged-in owner), for screens shown to both. */
  isLoggedIn: boolean;
  /** Whether the app is running the seeded in-memory demo (doc 28), so screens with
   * no honest demo behavior (the camera scanner) can simulate instead. */
  demoMode: boolean;
  /** Enter the demo (the landing's "try the demo" action, doc 28). */
  onTryDemo: () => void;
  /**
   * Accept a contact invite (doc 13 path A): record the inviter as a two-way
   * contact and resolve with a RETURN invite to send back. Rejects if logged out.
   */
  onAcceptContactInvite: (
    invite: ContactInvite,
    label: string,
    identity?: AliasIdentity,
    avatarOverride?: AvatarConfig,
  ) => Promise<ContactLinkResult>;
  /** Ingest a return invite a contact sent back, completing the pending link. */
  onIngestContactReturn: (ret: ContactInvite) => void;
  /** Complete the in-person linkup's pending contact with the scanned offer
   * (doc 25); resolves once the two-way link is recorded. */
  onCompleteLinkup: (contactId: string, invite: ContactInvite) => Promise<void>;
  /** The open door's server plumbing (doc 25); absent in fixture/demo contexts,
   * where the door simply never opens. */
  doorStore?: DoorStore;
  /** Whether the owner set a display name, so the group "show as you" choice is
   * offered (doc 33); with no name there is nothing to show. Optional so non-app ctx
   * builders (demo, stories) may omit it (treated as no name). */
  ownerHasName?: boolean;
  /** The shared groups the owner is in (doc 33); empty logged out. */
  groups: GroupRecord[];
  /** Create a shared group; resolves the outcome + new group id (doc 33). */
  onCreateGroup: (
    input: CreateGroupInput,
  ) => Promise<{ result: CreateGroupResult; groupId: string }>;
  /** Read a group's roster on open (folds the returned session). */
  onReadGroupRoster: (groupId: string) => Promise<RosterMemberView[]>;
  /** Leave a group (member self-exit). */
  onLeaveGroup: (groupId: string) => void;
  /** Disband a group the owner admins (teardown for everyone). */
  onDeleteGroup: (groupId: string) => void;
  /** Shared-group catch-up (doc 33): ingest arrived accepts/leaves and pick up
   * approvals, folding the session. Triggered on People / group-detail mount. */
  onGroupCatchup: () => Promise<void>;
  /** The owner's claimed findable names, in claim order (empty logged out or none). */
  vanityNames: string[];
  /** Claim a public findable name; resolves with the outcome (doc 17, gated). */
  onRegisterVanityName: (name: string) => Promise<VanityRegisterResult>;
  /** Check if a findable name is free as the owner types (no claim). */
  onCheckVanityName: (name: string) => Promise<"free" | "taken" | "error">;
  /** Release one of the owner's claimed findable names (no-op if not held). */
  onReleaseVanityName: (name: string) => Promise<void>;
  /** The owner's recovery name, or null when no password factor is set (doc 32). */
  recoveryName: string | null;
  /** When the recovery password was last set or changed (epoch ms, doc 32), or
   * undefined when no password is set, logged out, or the password predates the
   * field. Drives the yearly refresh nudge. */
  passwordSetAt: number | undefined;
  /** The owner's stored recovery phrase, for re-viewing in Settings (doc 32), or
   * null when it is not stored on this device (logged out, or a passkey-only resume). */
  recoveryPhrase: string | null;
  /** Whether a passkey is enrolled on this device (doc 32): the phrase re-view
   * requires a passkey check before revealing when true. */
  passkeyEnrolled: boolean;
  /** Run the passkey "confirm it's you" check before revealing the phrase (doc 32);
   * resolves true on success. A pure presence gate; never touches the session. */
  onVerifyPasskey: () => Promise<boolean>;
  /** Turn the password factor on (or change it); resolves with the outcome. */
  onSetRecoveryPassword: (
    input: SetRecoveryPasswordInput,
  ) => Promise<SetRecoveryPasswordOutcome>;
  /** Turn the password factor off (a no-op when none is set). */
  onDisableRecoveryPassword: () => Promise<void>;
  /** Device push controls (the partner-notify wake), for the Privacy toggle. */
  push: PushControls;
  store: PassportStore;
  data: RouteData | null;
}

type ScreenRenderer = (ctx: ScreenCtx) => ReactNode;
export type ScreenRenderers = Partial<Record<Screen, ScreenRenderer>>;
