import type { ReactNode } from "react";
import { AppShell, BackBar } from "../shell/AppShell.tsx";
import { DesktopShell, DesktopLanding } from "../desktop/Desktop.tsx";
import { ShareSheet } from "../share/ShareSheet.tsx";
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
import type { ScreenCtx } from "./screens/context.ts";
import type { OnboardingActions } from "./useOnboarding.ts";
import type { ReportOutcome } from "../../core/report.ts";
import type { OwnerState } from "../../core/badge.ts";

export interface ChromeProps {
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
  onCopyShareLink: () => boolean;
  onRevokeShareLink: () => void;
  shareIdentity: AliasIdentity;
  onShareIdentityChange: (choice: AliasIdentity) => void;
  shareDuration: number | null;
  onShareDurationChange: (durationMs: number | null) => void;
  onDeleteAccount: () => void;
  onSetAvatar: ScreenCtx["onSetAvatar"];
  knockCount: number;
  refreshKnocks: () => void;
  canApproveKnocks: boolean;
  showKnockInfo: boolean;
  approveKnocks: () => void;
  approvingKnocks: boolean;
  showPartnerNudge: boolean;
  dismissPartnerNudge: () => void;
  aliases: ScreenCtx["aliases"];
  onRevokeAlias: ScreenCtx["onRevokeAlias"];
  contacts: ScreenCtx["contacts"];
  onCreateContactLink: ScreenCtx["onCreateContactLink"];
  onRevokeContact: ScreenCtx["onRevokeContact"];
  onSetContactDuration: ScreenCtx["onSetContactDuration"];
  faves: ScreenCtx["faves"];
  onToggleFave: ScreenCtx["onToggleFave"];
  pendingRequests: ScreenCtx["pendingRequests"];
  onForgetRequest: ScreenCtx["onForgetRequest"];
  isLoggedIn: ScreenCtx["isLoggedIn"];
  onAcceptContactInvite: ScreenCtx["onAcceptContactInvite"];
  onIngestContactReturn: ScreenCtx["onIngestContactReturn"];
  circles: ScreenCtx["circles"];
  onCreateCircle: ScreenCtx["onCreateCircle"];
  onUpdateCircle: ScreenCtx["onUpdateCircle"];
  onRemoveCircle: ScreenCtx["onRemoveCircle"];
  vanityName: ScreenCtx["vanityName"];
  onRegisterVanityName: ScreenCtx["onRegisterVanityName"];
  onReleaseVanityName: ScreenCtx["onReleaseVanityName"];
  push: ScreenCtx["push"];
}

function MobileSub({ nav, children }: { nav: Nav; children: ReactNode }) {
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        display: "flex",
        flexDirection: "column",
        background: "var(--surface-app)",
      }}
    >
      <BackBar onBack={nav.back} />
      <main style={{ flex: 1, overflowY: "auto", padding: "2px 20px 28px" }}>
        {children}
      </main>
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
  onCopyShareLink,
  onRevokeShareLink,
  shareIdentity,
  onShareIdentityChange,
  shareDuration,
  onShareDurationChange,
}: ChromeProps) {
  return (
    <ShareSheet
      open={shareOpen}
      onClose={() => setShareOpen(false)}
      sharingMode={owner.sharingMode}
      state={owner.viewerBadge}
      labels={owner.labels}
      route={owner.blueRoute}
      identity={owner.handle !== undefined ? { handle: owner.handle } : {}}
      avatarSrc={avatarSrc(owner.avatar)}
      url={shareUrl}
      identityChoice={shareIdentity}
      onIdentityChange={onShareIdentityChange}
      durationChoice={shareDuration}
      onDurationChange={onShareDurationChange}
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
// once from the props so neither shell drifts as ScreenCtx grows.
function buildCtx(props: ChromeProps): ScreenCtx {
  const { route, setShareOpen } = props;
  return {
    nav: props.nav,
    owner: props.owner,
    ownerState: props.ownerState,
    onboarding: props.onboarding,
    onReport: props.onReport,
    setOwnerState: props.setOwnerState,
    openShare: () => setShareOpen(true),
    onDeleteAccount: props.onDeleteAccount,
    onLogOut: props.onLogOut,
    keepSignedIn: props.keepSignedIn,
    onKeepSignedInChange: props.onKeepSignedInChange,
    onSetAvatar: props.onSetAvatar,
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
    onRevokeContact: props.onRevokeContact,
    onSetContactDuration: props.onSetContactDuration,
    faves: props.faves,
    onToggleFave: props.onToggleFave,
    pendingRequests: props.pendingRequests,
    onForgetRequest: props.onForgetRequest,
    isLoggedIn: props.isLoggedIn,
    onAcceptContactInvite: props.onAcceptContactInvite,
    onIngestContactReturn: props.onIngestContactReturn,
    circles: props.circles,
    onCreateCircle: props.onCreateCircle,
    onUpdateCircle: props.onUpdateCircle,
    onRemoveCircle: props.onRemoveCircle,
    vanityName: props.vanityName,
    onRegisterVanityName: props.onRegisterVanityName,
    onReleaseVanityName: props.onReleaseVanityName,
    push: props.push,
    store: props.store,
    data: route.data,
  };
}

function AppChrome(props: ChromeProps) {
  const { route, nav, owner, desktop, setShareOpen, knockCount } = props;
  const tab: Tab = sectionOf(route.screen);
  const ctx: ScreenCtx = buildCtx(props);
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
          onShare={() => setShareOpen(true)}
          onBell={() => nav.go("notifications")}
          onReport={() => nav.go("report")}
          onViewAs={() => nav.go("a2-public", { self: true })}
          avatarSrc={avatarSrc(owner.avatar)}
        >
          {content}
        </DesktopShell>
        <ShareOverlay {...props} />
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
        <ShareOverlay {...props} />
      </>
    );
  }

  return (
    <>
      <MobileSub nav={nav}>{content}</MobileSub>
      <ShareOverlay {...props} />
    </>
  );
}

function PublicChrome(props: ChromeProps) {
  const { route, nav, desktop } = props;
  if (desktop && route.screen === "a1-landing") {
    return (
      <DesktopLanding
        onClaim={() => nav.go("b1-claim")}
        onSample={() => nav.go("a2-public")}
        onLogin={() => nav.go("b1-claim", { isLogin: true })}
        onHome={() => nav.jump("a1-landing", "public")}
        onPromises={() => nav.go("promises")}
        onPrivacyPolicy={() => nav.go("privacy-policy")}
        onTerms={() => nav.go("terms")}
        pendingCount={props.pendingRequests.length}
        onRequests={() => nav.go("requests")}
      />
    );
  }
  const ctx: ScreenCtx = buildCtx(props);
  return (
    <CanvasWrap
      desktop={desktop}
      // The promises page is a multi-column grid on desktop; the rest of the
      // public canvas stays a narrow reading column.
      wide={route.screen === "promises"}
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
