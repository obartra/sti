import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import {
  NAV_ITEMS,
  Sidebar,
  Header,
  MainContent,
  type DesktopTab,
} from "./DesktopShellParts.tsx";

export { DesktopLanding } from "./DesktopLanding.tsx";
export type { DesktopLandingProps } from "./DesktopLanding.tsx";
export type { DesktopTab } from "./DesktopShellParts.tsx";

/* Desktop / large-screen layer for the sti.care passport. Faithful port of the
   design's app/desktop.jsx: same content, different chrome above the breakpoint:
     - a left sidebar app shell (replaces phone status/tab bars)
     - a real desktop marketing landing (A1, in DesktopLanding.tsx)
     - a persistent right-hand share rail on wide screens
   The phone experience is untouched; the app branches on useDesktop() and
   renders one or the other. Chrome pieces live in DesktopShellParts.tsx.

   The badge is two-state only (blue / gray); there is no four-light model. */

// A matchMedia hook for "(min-width: <px>)". Shared shape used by the
// desktop-breakpoint check, the wide-screen share-rail check, and the trust
// pages' large-screen "trust center" layout.
export function useMinWidth(px: number): boolean {
  const q = `(min-width: ${px}px)`;
  const [match, setMatch] = useState<boolean>(
    typeof window !== "undefined" && typeof window.matchMedia === "function"
      ? window.matchMedia(q).matches
      : true,
  );
  useEffect(() => {
    const mq = window.matchMedia(q);
    const on = (e: MediaQueryListEvent) => {
      setMatch(e.matches);
    };
    mq.addEventListener("change", on);
    return () => {
      mq.removeEventListener("change", on);
    };
  }, [q]);
  return match;
}

// Desktop chrome kicks in at the design's breakpoint. The source's matchMedia
// query is "(min-width: 900px)"; below that the phone shell renders.
export function useDesktop(): boolean {
  return useMinWidth(900);
}

// Which sidebar tab "owns" a given screen, so sub-screens keep the right nav
// item lit. Ported verbatim from desktop.jsx SECTION.
export const SECTION: Record<string, string> = {
  home: "home",
  report: "home",
  "report-saved": "home",
  privacy: "home",
  notifications: "home",
  wallet: "home",
  "avatar-edit": "home",
  connect: "connect",
  "alias-share": "connect",
  circles: "circles",
  "circle-create": "circles",
  "circle-detail": "circles",
  care: "care",
  learn: "care",
  "learn-detail": "care",
  "learn-uu": "care",
};

const TABS: readonly DesktopTab[] = ["home", "connect", "circles", "care"];
export const isTab = (s: string): boolean =>
  (TABS as readonly string[]).includes(s);

export interface DesktopShellProps {
  /** The active sidebar tab. */
  tab: DesktopTab;
  onTab?: (tab: DesktopTab) => void;
  /** When true, render a Back affordance instead of the section title (a
   *  sub-screen). */
  sub?: boolean;
  /** Title shown when on a top-level tab (defaults to the active tab's label). */
  title?: string;
  onBack?: () => void;
  onShare?: () => void;
  onBell?: () => void;
  onReport?: () => void;
  /** Owner chip: opens the visitor preview. */
  onViewAs?: () => void;
  /** Avatar shown in the owner chip. */
  avatarSrc?: string | undefined;
  /** Content column width. */
  roomy?: boolean;
  /** Force the wide (share-rail) layout, overriding the media query. Used by
   *  stories for deterministic capture. */
  wide?: boolean;
  children?: ReactNode;
}

// ── App shell (logged-in screens) ───────────────────────────────────────────
export function DesktopShell({
  tab,
  onTab,
  sub = false,
  title,
  onBack,
  onShare,
  onBell,
  onReport,
  onViewAs,
  avatarSrc,
  roomy = false,
  wide: wideProp,
  children,
}: DesktopShellProps) {
  const colW = roomy ? 720 : 560;
  const headerTitle = title ?? NAV_ITEMS.find((n) => n.id === tab)?.label ?? "";
  const autoWide = useMinWidth(1400);
  const wide = wideProp ?? autoWide;
  const showRail = wide && !sub;

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        display: "flex",
        background: "var(--surface-app)",
        color: "var(--text-body)",
      }}
    >
      <Sidebar
        tab={tab}
        onTab={onTab}
        onReport={onReport}
        onViewAs={onViewAs}
        avatarSrc={avatarSrc}
      />

      <div
        style={{
          flex: 1,
          minWidth: 0,
          height: "100%",
          display: "flex",
          flexDirection: "column",
          position: "relative",
        }}
      >
        <Header
          sub={sub}
          headerTitle={headerTitle}
          showShare={!showRail}
          onBack={onBack}
          onShare={onShare}
          onBell={onBell}
        />
        <MainContent
          colW={colW}
          showRail={showRail}
          onShare={onShare}
          onViewAs={onViewAs}
        >
          {children}
        </MainContent>
      </div>
    </div>
  );
}
