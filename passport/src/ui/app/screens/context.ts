import type { ReactNode } from "react";
import type { Nav } from "../useAppRouter.ts";
import type { RouteData, Screen } from "../routes.ts";
import type {
  AliasRecord,
  CircleRecord,
  ContactInvite,
  ContactLinkResult,
  ContactRecord,
  OwnerView,
  PassportStore,
} from "../../../store/index.ts";
import type { VanityRegisterResult } from "../../../api/client.ts";
import type { OnboardingActions } from "../useOnboarding.ts";
import type { PushControls } from "../usePush.ts";
import type { ReportOutcome } from "../../../core/report.ts";
import type { OwnerState } from "../../../core/badge.ts";
import type { AvatarConfig } from "../../../lib/avatars.ts";

// What every routed screen gets: navigation, the owner's derived view, the raw
// owner state + its setter (for settings), the onboarding/login actions, the
// report-result action, the share-sheet opener, the backend boundary, and the
// current route's payload.
export interface ScreenCtx {
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
  /** Log out: forget the persisted master and return to the landing (doc 24). */
  onLogOut: () => void;
  /** Persist a new account-wide avatar (logged-in only; keeps sharing mode). */
  onSetAvatar: (avatar: AvatarConfig) => void;
  /** Count of current knocks across the owner's aliases (contentless; 0 logged out). */
  knockCount: number;
  /** Re-pull the knock count + pending approvals (e.g. when the inbox opens). */
  refreshKnocks: () => void;
  /** Whether any waiting knock can be granted in-app (it carried a key). */
  canApproveKnocks: boolean;
  /** Whether to show the contentless "someone asked" row (knocks with no key). */
  showKnockInfo: boolean;
  /** Grant every waiting knock (seals each alias key to its requester). */
  approveKnocks: () => void;
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
  /** Mint a new per-contact link for `label` with a chosen lifetime (days, or
   * null for until-revoked); resolves with the contact + URL. */
  onCreateContactLink: (
    label: string,
    durationMs: number | null,
  ) => Promise<ContactLinkResult>;
  /** Revoke one contact link by id. */
  onRevokeContact: (id: string) => void;
  /** Change one contact link's lifetime in place (days from today, or null for
   * until-revoked). */
  onSetContactDuration: (id: string, durationMs: number | null) => void;
  /** Starred contact ids (device-local display preference); empty logged out. */
  faves: ReadonlySet<string>;
  /** Toggle one contact's star. */
  onToggleFave: (id: string) => void;
  /** Whether a session is active (a logged-in owner), for screens shown to both. */
  isLoggedIn: boolean;
  /**
   * Accept a contact invite (doc 13 path A): record the inviter as a two-way
   * contact and resolve with a RETURN invite to send back. Rejects if logged out.
   */
  onAcceptContactInvite: (
    invite: ContactInvite,
    label: string,
  ) => Promise<ContactLinkResult>;
  /** Ingest a return invite a contact sent back, completing the pending link. */
  onIngestContactReturn: (ret: ContactInvite) => void;
  /** The owner's circles (private contact groupings); empty logged out. */
  circles: CircleRecord[];
  /** Create a circle from a name + chosen contact ids; resolves the new circle id. */
  onCreateCircle: (name: string, memberContactIds: string[]) => Promise<string>;
  /** Rename a circle and/or change its members (same id). */
  onUpdateCircle: (
    id: string,
    name: string,
    memberContactIds: string[],
  ) => void;
  /** Delete one circle by id (a local grouping; contacts are untouched). */
  onRemoveCircle: (id: string) => void;
  /** The owner's claimed findable name, or null (logged out, or none claimed). */
  vanityName: string | null;
  /** Claim a public findable name; resolves with the outcome (doc 17, gated). */
  onRegisterVanityName: (name: string) => Promise<VanityRegisterResult>;
  /** Release the owner's claimed findable name (no-op if none). */
  onReleaseVanityName: () => Promise<void>;
  /** Device push controls (the partner-notify wake), for the Privacy toggle. */
  push: PushControls;
  store: PassportStore;
  data: RouteData | null;
}

export type ScreenRenderer = (ctx: ScreenCtx) => ReactNode;
export type ScreenRenderers = Partial<Record<Screen, ScreenRenderer>>;
