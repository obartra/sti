import type { ReactNode } from "react";
import { AppShell, BackBar } from "../shell/AppShell.tsx";
import { DesktopShell, DesktopLanding } from "../desktop/Desktop.tsx";
import { ShareSheet } from "../share/ShareSheet.tsx";
import { avatarSrc } from "../../lib/avatars.ts";
import { CanvasWrap } from "./CanvasWrap.tsx";
import { VersionStamp } from "./VersionStamp.tsx";
import { ScreenView } from "./screens/index.tsx";
import { isTab, sectionOf, type Route, type Tab } from "./routes.ts";
import type { Nav } from "./useAppRouter.ts";
import type { OwnerView, PassportStore } from "../../store/index.ts";
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
  onReport: (outcome: ReportOutcome) => void;
  setOwnerState: (update: (prev: OwnerState) => OwnerState) => void;
  store: PassportStore;
  desktop: boolean;
  shareOpen: boolean;
  setShareOpen: (open: boolean) => void;
  /** The owner's real shareable link (null while preparing / logged out). */
  shareUrl: string | null;
  onCopyShareLink: () => void;
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
}: ChromeProps) {
  return (
    <ShareSheet
      open={shareOpen}
      onClose={() => setShareOpen(false)}
      sharingMode={owner.sharingMode}
      state={owner.viewerBadge}
      labels={owner.labels}
      route={owner.blueRoute}
      identity={{ handle: owner.handle }}
      avatarSrc={avatarSrc(owner.avatar)}
      url={shareUrl}
      onCopy={onCopyShareLink}
      onRevoke={() => setShareOpen(false)}
      onWallet={() => {
        setShareOpen(false);
        nav.go("wallet");
      }}
      desktop={desktop}
    />
  );
}

function AppChrome(props: ChromeProps) {
  const {
    route,
    nav,
    owner,
    ownerState,
    onboarding,
    onReport,
    setOwnerState,
    store,
    desktop,
    setShareOpen,
  } = props;
  const tab: Tab = sectionOf(route.screen);
  const ctx: ScreenCtx = {
    nav,
    owner,
    ownerState,
    onboarding,
    onReport,
    setOwnerState,
    openShare: () => setShareOpen(true),
    store,
    data: route.data,
  };
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
          showAdd={route.screen === "results"}
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

function PublicChrome({
  route,
  nav,
  owner,
  ownerState,
  onboarding,
  onReport,
  setOwnerState,
  store,
  desktop,
  setShareOpen,
}: ChromeProps) {
  if (desktop && route.screen === "a1-landing") {
    return (
      <DesktopLanding
        onClaim={() => nav.go("b1-claim")}
        onSample={() => nav.go("a2-public")}
        onLogin={() => nav.go("b1-claim", { isLogin: true })}
        onHome={() => nav.jump("a1-landing", "public")}
      />
    );
  }
  const ctx: ScreenCtx = {
    nav,
    owner,
    ownerState,
    onboarding,
    onReport,
    setOwnerState,
    openShare: () => setShareOpen(true),
    store,
    data: route.data,
  };
  return (
    <CanvasWrap
      desktop={desktop}
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
