import { useState, type ReactNode } from "react";
import { AppShell, BackBar } from "../shell/AppShell.tsx";
import { DesktopShell, DesktopLanding } from "../desktop/Desktop.tsx";
import { ShareSheet } from "../share/ShareSheet.tsx";
import { ShareChooser } from "../share/ShareChooser.tsx";
import { WALLET_ENABLED } from "../../features.ts";
import { avatarSrc } from "../../lib/avatars.ts";
import { CanvasWrap } from "./CanvasWrap.tsx";
import { VersionStamp } from "./VersionStamp.tsx";
import { ScreenView } from "./screens/index.tsx";
import { isTab, sectionOf, type Route, type Tab } from "./routes.ts";
import type { Nav } from "./useAppRouter.ts";
import type {
  AliasIdentity,
  OwnerView,
  PassportStore,
} from "../../store/index.ts";
import type { AvatarConfig } from "../../lib/avatars.ts";
import type { ScreenCtx } from "./screens/context.ts";
import type { GroupJoinActions } from "./useGroupJoinActions.ts";
import type { OnboardingActions } from "./useOnboarding.ts";
import type { ReportOutcome } from "../../core/report.ts";
import type { OwnerState } from "../../core/badge.ts";

export interface ChromeProps extends GroupJoinActions {
  route: Route;
  nav: Nav;
  owner: OwnerView;
  ownerState: OwnerState;
  onboarding: OnboardingActions;
  onLogOut: () => void;
  keepSignedIn: boolean;
  onKeepSignedInChange: (v: boolean) => void;
  onReport: (outcome: ReportOutcome) => void;
  setOwnerState: (update: (prev: OwnerState) => OwnerState) => void;
  store: PassportStore;
  desktop: boolean;
  shareOpen: boolean;
  setShareOpen: (open: boolean) => void;
  /** The owner's real shareable link (null while preparing / logged out). */
  shareUrl: string | null;
  /** The last link prepare failed; the share sheet offers a retry. */
  shareError: boolean;
  onRetryShareLink: () => void;
  onCopyShareLink: () => boolean;
  onRevokeShareLink: () => void;
  shareIdentity: AliasIdentity;
  onShareIdentityChange: (choice: AliasIdentity) => void;
  shareAvatarOverride: AvatarConfig | undefined;
  onShareAvatarOverrideChange: (avatar: AvatarConfig | undefined) => void;
  /** How long the private link keeps working, or null for until turned off. */
  shareLifetime: number | null;
  onShareLifetimeChange: (durationMs: number | null) => void;
  onDeleteAccount: () => void;
  onSetAvatar: ScreenCtx["onSetAvatar"];
  onSetName: ScreenCtx["onSetName"];
  knockCount: number;
  refreshKnocks: () => void;
  canApproveKnocks: boolean;
  showKnockInfo: boolean;
  approveKnocks: ScreenCtx["approveKnocks"];
  approvingKnocks: boolean;
  showPartnerNudge: boolean;
  dismissPartnerNudge: () => void;
  aliases: ScreenCtx["aliases"];
  onRevokeAlias: ScreenCtx["onRevokeAlias"];
  contacts: ScreenCtx["contacts"];
  onCreateContactLink: ScreenCtx["onCreateContactLink"];
  onRenameContact: ScreenCtx["onRenameContact"];
  onRevokeContact: ScreenCtx["onRevokeContact"];
  faves: ScreenCtx["faves"];
  onToggleFave: ScreenCtx["onToggleFave"];
  pendingRequests: ScreenCtx["pendingRequests"];
  onForgetRequest: ScreenCtx["onForgetRequest"];
  isLoggedIn: ScreenCtx["isLoggedIn"];
  demoMode: ScreenCtx["demoMode"];
  onTryDemo: ScreenCtx["onTryDemo"];
  onAcceptContactInvite: ScreenCtx["onAcceptContactInvite"];
  onIngestContactReturn: ScreenCtx["onIngestContactReturn"];
  groups: ScreenCtx["groups"];
  onCreateGroup: ScreenCtx["onCreateGroup"];
  onReadGroupRoster: ScreenCtx["onReadGroupRoster"];
  onLeaveGroup: ScreenCtx["onLeaveGroup"];
  onDeleteGroup: ScreenCtx["onDeleteGroup"];
  onGroupCatchup: ScreenCtx["onGroupCatchup"];
  vanityNames: ScreenCtx["vanityNames"];
  onRegisterVanityName: ScreenCtx["onRegisterVanityName"];
  onCheckVanityName: ScreenCtx["onCheckVanityName"];
  onReleaseVanityName: ScreenCtx["onReleaseVanityName"];
  recoveryName: ScreenCtx["recoveryName"];
  passwordSetAt: ScreenCtx["passwordSetAt"];
  recoveryPhrase: ScreenCtx["recoveryPhrase"];
  passkeyEnrolled: ScreenCtx["passkeyEnrolled"];
  onVerifyPasskey: ScreenCtx["onVerifyPasskey"];
  onSetRecoveryPassword: ScreenCtx["onSetRecoveryPassword"];
  onDisableRecoveryPassword: ScreenCtx["onDisableRecoveryPassword"];
  push: ScreenCtx["push"];
}

function MobileSub({ nav, children }: { nav: Nav; children: ReactNode }) {
  return (
    <div className="l-surface l-surface--column">
      <BackBar onBack={nav.back} />
      <main className="l-sub-main">{children}</main>
    </div>
  );
}

function ShareOverlay({
  nav,
  owner,
  desktop,
  shareOpen,
  setShareOpen,
  shareUrl,
  shareError,
  onRetryShareLink,
  onCopyShareLink,
  onRevokeShareLink,
  shareIdentity,
  onShareIdentityChange,
  shareAvatarOverride,
  onShareAvatarOverrideChange,
  shareLifetime,
  onShareLifetimeChange,
}: ChromeProps) {
  return (
    <ShareSheet
      open={shareOpen}
      onClose={() => setShareOpen(false)}
      state={owner.viewerBadge}
      labels={owner.labels}
      route={owner.blueRoute}
      identity={owner.handle !== undefined ? { handle: owner.handle } : {}}
      avatarSrc={avatarSrc(owner.avatar)}
      url={shareUrl}
      error={shareError}
      onRetry={onRetryShareLink}
      identityChoice={shareIdentity}
      onIdentityChange={onShareIdentityChange}
      avatar={owner.avatar}
      avatarOverride={shareAvatarOverride}
      onAvatarOverrideChange={onShareAvatarOverrideChange}
      lifetime={shareLifetime}
      onLifetimeChange={onShareLifetimeChange}
      onCopy={onCopyShareLink}
      onRevoke={onRevokeShareLink}
      onWallet={() => {
        setShareOpen(false);
        nav.go("wallet");
      }}
      showWallet={WALLET_ENABLED}
      desktop={desktop}
    />
  );
}

// The routed-screen context is identical for the app and public shells; build it
// once from the props so neither shell drifts as ScreenCtx grows. `openShare` is
// the "Share my passport" entry point; the app shell routes it through the chooser
// first, so it is passed in rather than hardcoded to open the sheet directly.
function buildCtx(
  props: ChromeProps,
  openShare: () => void = () => props.setShareOpen(true),
): ScreenCtx {
  const { route } = props;
  return {
    nav: props.nav,
    owner: props.owner,
    ownerState: props.ownerState,
    onboarding: props.onboarding,
    onReport: props.onReport,
    setOwnerState: props.setOwnerState,
    openShare,
    onDeleteAccount: props.onDeleteAccount,
    onLogOut: props.onLogOut,
    keepSignedIn: props.keepSignedIn,
    onKeepSignedInChange: props.onKeepSignedInChange,
    onSetAvatar: props.onSetAvatar,
    onSetName: props.onSetName,
    knockCount: props.knockCount,
    refreshKnocks: props.refreshKnocks,
    canApproveKnocks: props.canApproveKnocks,
    showKnockInfo: props.showKnockInfo,
    approveKnocks: props.approveKnocks,
    approvingKnocks: props.approvingKnocks,
    showPartnerNudge: props.showPartnerNudge,
    dismissPartnerNudge: props.dismissPartnerNudge,
    aliases: props.aliases,
    onRevokeAlias: props.onRevokeAlias,
    contacts: props.contacts,
    onCreateContactLink: props.onCreateContactLink,
    onRenameContact: props.onRenameContact,
    onRevokeContact: props.onRevokeContact,
    faves: props.faves,
    onToggleFave: props.onToggleFave,
    pendingRequests: props.pendingRequests,
    onForgetRequest: props.onForgetRequest,
    isLoggedIn: props.isLoggedIn,
    demoMode: props.demoMode,
    onTryDemo: props.onTryDemo,
    onAcceptContactInvite: props.onAcceptContactInvite,
    onIngestContactReturn: props.onIngestContactReturn,
    ownerHasName: (props.owner.handle ?? "").length > 0,
    groups: props.groups,
    onCreateGroup: props.onCreateGroup,
    onReadGroupRoster: props.onReadGroupRoster,
    onLeaveGroup: props.onLeaveGroup,
    onDeleteGroup: props.onDeleteGroup,
    onInviteToGroup: props.onInviteToGroup,
    onRevokeGroupInvite: props.onRevokeGroupInvite,
    onReviewJoinRequests: props.onReviewJoinRequests,
    onApproveJoinRequest: props.onApproveJoinRequest,
    onRejectJoinRequest: props.onRejectJoinRequest,
    onRemoveGroupMember: props.onRemoveGroupMember,
    onAcceptGroupInvite: props.onAcceptGroupInvite,
    onRejectGroupInvite: props.onRejectGroupInvite,
    onRequestToJoin: props.onRequestToJoin,
    onGroupCatchup: props.onGroupCatchup,
    vanityNames: props.vanityNames,
    onRegisterVanityName: props.onRegisterVanityName,
    onCheckVanityName: props.onCheckVanityName,
    onReleaseVanityName: props.onReleaseVanityName,
    recoveryName: props.recoveryName,
    passwordSetAt: props.passwordSetAt,
    recoveryPhrase: props.recoveryPhrase,
    passkeyEnrolled: props.passkeyEnrolled,
    onVerifyPasskey: props.onVerifyPasskey,
    onSetRecoveryPassword: props.onSetRecoveryPassword,
    onDisableRecoveryPassword: props.onDisableRecoveryPassword,
    push: props.push,
    store: props.store,
    data: route.data,
  };
}

// The share surfaces for the app shell: the chooser (which "Share my passport"
// opens first) and, behind it, the private-link share sheet. Kept together so the
// chooser's private-link choice hands straight off to the sheet, and its public
// choice jumps to the Public names section on the Links tab.
function ShareSurfaces({
  chrome,
  chooserOpen,
  setChooserOpen,
}: {
  chrome: ChromeProps;
  chooserOpen: boolean;
  setChooserOpen: (open: boolean) => void;
}) {
  return (
    <>
      <ShareChooser
        open={chooserOpen}
        onClose={() => setChooserOpen(false)}
        desktop={chrome.desktop}
        onPrivateLink={() => {
          setChooserOpen(false);
          chrome.setShareOpen(true);
        }}
        onPublicName={() => {
          setChooserOpen(false);
          chrome.nav.jump("links");
        }}
      />
      <ShareOverlay {...chrome} />
    </>
  );
}

function AppChrome(props: ChromeProps) {
  const { route, nav, owner, desktop, knockCount } = props;
  const tab: Tab = sectionOf(route.screen);
  const [chooserOpen, setChooserOpen] = useState(false);
  const openChooser = () => setChooserOpen(true);
  const ctx: ScreenCtx = buildCtx(props, openChooser);
  const shareSurfaces = (
    <ShareSurfaces
      chrome={props}
      chooserOpen={chooserOpen}
      setChooserOpen={setChooserOpen}
    />
  );
  const content = (
    <>
      <ScreenView screen={route.screen} ctx={ctx} />
      <VersionStamp />
    </>
  );

  if (desktop) {
    return (
      <>
        <DesktopShell
          tab={tab}
          onTab={(t) => nav.jump(t)}
          sub={!isTab(route.screen)}
          onBack={nav.back}
          onShare={openChooser}
          onBell={() => nav.go("notifications")}
          onReport={() => nav.go("report")}
          onViewAs={() => nav.go("a2-public", { self: true })}
          handle={owner.handle}
          avatarSrc={avatarSrc(owner.avatar)}
        >
          {content}
        </DesktopShell>
        {shareSurfaces}
      </>
    );
  }

  if (isTab(route.screen)) {
    return (
      <>
        <AppShell
          tab={tab}
          onTab={(t) => nav.jump(t)}
          onAdd={() => nav.go("report")}
          onBell={() => nav.go("notifications")}
          // The bell dot means "the inbox has something": a knock OR the
          // partner-notify nudge. The nudge leads the inbox for PEP timeliness, so
          // it must light the bell too, not wait to be discovered on a manual open.
          hasKnocks={knockCount > 0 || props.showPartnerNudge}
        >
          {content}
        </AppShell>
        {shareSurfaces}
      </>
    );
  }

  return (
    <>
      <MobileSub nav={nav}>{content}</MobileSub>
      {shareSurfaces}
    </>
  );
}

function PublicChrome(props: ChromeProps) {
  const { route, nav, desktop } = props;
  if (desktop && route.screen === "a1-landing") {
    return (
      <DesktopLanding
        onClaim={() => nav.go("b1-claim")}
        onSample={props.onTryDemo}
        onLogin={() => nav.go("b1-claim", { isLogin: true })}
        onHome={() => nav.jump("a1-landing", "public")}
        onPromises={() => nav.go("promises")}
        onPrivacyPolicy={() => nav.go("privacy-policy")}
        onTerms={() => nav.go("terms")}
        pendingCount={props.pendingRequests.length}
        onRequests={() => nav.go("requests")}
        onShareLink={() => nav.go("share-link")}
      />
    );
  }
  const ctx: ScreenCtx = buildCtx(props);
  // The trust pages (promises, privacy, terms, share-link) own a full-width
  // "trust center" layout on desktop; the rest of the public canvas stays a
  // narrow reading column.
  const isTrust =
    route.screen === "promises" ||
    route.screen === "privacy-policy" ||
    route.screen === "terms" ||
    route.screen === "share-link";
  return (
    <CanvasWrap
      desktop={desktop}
      full={isTrust}
      onHome={() => nav.jump("a1-landing", "public")}
    >
      <ScreenView screen={route.screen} ctx={ctx} />
    </CanvasWrap>
  );
}

export function Chrome(props: ChromeProps) {
  if (props.route.group === "app") return <AppChrome {...props} />;
  return <PublicChrome {...props} />;
}
