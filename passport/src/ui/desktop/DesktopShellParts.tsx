import type { ReactNode } from "react";
import {
  Button,
  IconButton,
  Card,
  Avatar,
} from "../../design/components/index.ts";
import { avatarFor } from "../../lib/avatars.ts";
import { Matrix } from "../../lib/qr.tsx";
import {
  Passport,
  Users,
  Circles,
  Care,
  Plus,
  Bell,
  Share,
  Back,
  Eye,
  type IconProps,
} from "../../design/icons.tsx";

/* Chrome pieces for the desktop app shell (sidebar, header, share rail, content
   area), split out of Desktop.tsx so each file stays under the length ceiling.
   Faithful port of the design's app/desktop.jsx; output is unchanged. */

export type DesktopTab = "home" | "connect" | "circles" | "care";

// Copy inlined verbatim from copy.js (the strings the desktop AppShell reads:
// nav.*, home.*).
const COPY = {
  nav: {
    passport: "Passport",
    connect: "Connect",
    circles: "Groups",
    care: "Care",
  },
  home: {
    report: "Add a result",
    share: "Share my passport",
    viewAs: "See what others see",
  },
} as const;

export const NAV_ITEMS: {
  id: DesktopTab;
  label: string;
  icon: (p: IconProps) => ReactNode;
}[] = [
  { id: "home", label: COPY.nav.passport, icon: Passport },
  { id: "connect", label: COPY.nav.connect, icon: Users },
  { id: "circles", label: COPY.nav.circles, icon: Circles },
  { id: "care", label: COPY.nav.care, icon: Care },
];

// ── Sidebar nav item ────────────────────────────────────────────────────────
function NavItem({
  icon: Ico,
  label,
  active,
  onClick,
}: {
  icon: (p: IconProps) => ReactNode;
  label: string;
  active: boolean;
  onClick?: (() => void) | undefined;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active}
      className="sti-desknav"
      style={{
        appearance: "none",
        border: "none",
        cursor: "pointer",
        width: "100%",
        textAlign: "left",
        display: "flex",
        alignItems: "center",
        gap: 13,
        padding: "11px 13px",
        borderRadius: "var(--radius-md)",
        font: "inherit",
        fontSize: 15,
        fontWeight: active ? 700 : 600,
        color: active ? "var(--text-accent)" : "var(--text-body)",
        background: active ? "var(--accent-soft)" : "transparent",
        transition:
          "background var(--dur-fast) var(--ease-gentle), color var(--dur-fast) var(--ease-gentle)",
      }}
    >
      <Ico size={22} />
      <span>{label}</span>
    </button>
  );
}

// ── Owner chip (sidebar footer) ─────────────────────────────────────────────
function OwnerChip({
  handle,
  avatarSrc,
  onViewAs,
}: {
  handle?: string | undefined;
  avatarSrc?: string | undefined;
  onViewAs?: (() => void) | undefined;
}) {
  return (
    <button
      type="button"
      onClick={onViewAs}
      style={{
        appearance: "none",
        cursor: "pointer",
        width: "100%",
        textAlign: "left",
        marginTop: 8,
        display: "flex",
        alignItems: "center",
        gap: 11,
        padding: "10px 12px",
        borderRadius: "var(--radius-md)",
        border: "1px solid var(--divider)",
        background: "var(--surface-app)",
      }}
    >
      <Avatar
        src={avatarSrc ?? (handle ? avatarFor(handle) : undefined)}
        size="sm"
      />
      <span style={{ flex: 1, minWidth: 0 }}>
        <span
          style={{
            display: "block",
            fontSize: 14,
            fontWeight: 700,
            color: "var(--text-strong)",
          }}
        >
          {handle ? `@${handle}` : ""}
        </span>
        <span
          style={{
            display: "block",
            fontSize: 12,
            color: "var(--text-subtle)",
          }}
        >
          {COPY.home.viewAs}
        </span>
      </span>
      <Eye size={16} style={{ color: "var(--text-subtle)", flex: "none" }} />
    </button>
  );
}

// ── Sidebar ─────────────────────────────────────────────────────────────────
export function Sidebar({
  tab,
  onTab,
  onReport,
  onViewAs,
  handle,
  avatarSrc,
}: {
  tab: DesktopTab;
  onTab?: ((tab: DesktopTab) => void) | undefined;
  onReport?: (() => void) | undefined;
  onViewAs?: (() => void) | undefined;
  handle?: string | undefined;
  avatarSrc?: string | undefined;
}) {
  return (
    <aside
      style={{
        width: 264,
        flex: "none",
        height: "100%",
        boxSizing: "border-box",
        background: "var(--surface-card)",
        borderRight: "1px solid var(--divider)",
        display: "flex",
        flexDirection: "column",
        padding: "22px 16px 16px",
      }}
    >
      <div style={{ padding: "0 8px 18px" }}>
        <img
          src="/assets/logo/logo-wordmark.svg"
          alt="sti.care"
          style={{ height: 30 }}
        />
      </div>

      <nav style={{ display: "flex", flexDirection: "column", gap: 3 }}>
        {NAV_ITEMS.map((it) => (
          <NavItem
            key={it.id}
            icon={it.icon}
            label={it.label}
            active={tab === it.id}
            onClick={() => onTab?.(it.id)}
          />
        ))}
      </nav>

      <div style={{ marginTop: 16 }}>
        <Button
          variant="secondary"
          size="md"
          block
          icon={<Plus size={18} />}
          onClick={onReport}
        >
          {COPY.home.report}
        </Button>
      </div>

      <div style={{ flex: 1 }} />

      <OwnerChip handle={handle} avatarSrc={avatarSrc} onViewAs={onViewAs} />
    </aside>
  );
}

// ── Header ──────────────────────────────────────────────────────────────────
export function Header({
  sub,
  headerTitle,
  showShare,
  onBack,
  onShare,
  onBell,
}: {
  sub: boolean;
  headerTitle: string;
  showShare: boolean;
  onBack?: (() => void) | undefined;
  onShare?: (() => void) | undefined;
  onBell?: (() => void) | undefined;
}) {
  return (
    <header
      style={{
        flex: "none",
        height: 66,
        boxSizing: "border-box",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 32px",
        borderBottom: "1px solid var(--divider)",
        background: "color-mix(in srgb, var(--surface-app), transparent 12%)",
        backdropFilter: "saturate(1.2) blur(8px)",
        WebkitBackdropFilter: "saturate(1.2) blur(8px)",
        position: "sticky",
        top: 0,
        zIndex: 5,
      }}
    >
      <div
        style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}
      >
        {sub ? (
          <button
            type="button"
            onClick={onBack}
            style={{
              appearance: "none",
              border: "none",
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: 7,
              background: "transparent",
              color: "var(--text-body)",
              font: "inherit",
              fontSize: 14.5,
              fontWeight: 600,
              padding: "8px 6px",
            }}
          >
            <Back size={20} /> Back
          </button>
        ) : (
          <span
            style={{
              fontSize: 13,
              fontWeight: 700,
              letterSpacing: "0.04em",
              textTransform: "uppercase",
              color: "var(--text-subtle)",
            }}
          >
            {headerTitle}
          </span>
        )}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <IconButton aria-label="Notifications" onClick={onBell}>
          <Bell size={20} />
        </IconButton>
        {showShare && (
          <Button
            variant="primary"
            size="md"
            icon={<Share size={17} />}
            onClick={onShare}
          >
            {COPY.home.share}
          </Button>
        )}
      </div>
    </header>
  );
}

// ── Wide-screen share rail ──────────────────────────────────────────────────
function ShareRail({
  onShare,
  onViewAs,
}: {
  onShare?: (() => void) | undefined;
  onViewAs?: (() => void) | undefined;
}) {
  return (
    <aside style={{ width: 300, flex: "none" }}>
      <div style={{ position: "sticky", top: 0 }}>
        <Card style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div
            style={{
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              color: "var(--text-subtle)",
            }}
          >
            Your passport
          </div>
          <div
            style={{
              alignSelf: "center",
              background: "var(--surface-app)",
              borderRadius: "var(--radius-md)",
              padding: 16,
              boxShadow: "var(--shadow-sm)",
            }}
          >
            <Matrix size={156} seed="a7f3k9q2" color="var(--ink-900)" />
          </div>
          <div
            style={{
              fontSize: 13,
              color: "var(--text-muted)",
              lineHeight: 1.5,
              textAlign: "center",
            }}
          >
            One status, ready to share. Never the details.
          </div>
          <Button
            variant="primary"
            size="lg"
            block
            icon={<Share size={18} />}
            onClick={onShare}
          >
            {COPY.home.share}
          </Button>
          <Button
            variant="ghost"
            size="md"
            block
            icon={<Eye size={16} />}
            onClick={onViewAs}
          >
            {COPY.home.viewAs}
          </Button>
        </Card>
      </div>
    </aside>
  );
}

// ── Main content area ───────────────────────────────────────────────────────
export function MainContent({
  colW,
  showRail,
  onShare,
  onViewAs,
  children,
}: {
  colW: number;
  showRail: boolean;
  onShare?: (() => void) | undefined;
  onViewAs?: (() => void) | undefined;
  children?: ReactNode;
}) {
  return (
    <main style={{ flex: 1, overflowY: "auto", padding: "36px 32px 64px" }}>
      {showRail ? (
        <div
          style={{
            display: "flex",
            gap: 44,
            maxWidth: colW + 344,
            margin: "0 auto",
            alignItems: "flex-start",
          }}
        >
          <div style={{ flex: "1 1 0", minWidth: 0, maxWidth: colW }}>
            {children}
          </div>
          <ShareRail onShare={onShare} onViewAs={onViewAs} />
        </div>
      ) : (
        <div style={{ maxWidth: colW, margin: "0 auto" }}>{children}</div>
      )}
    </main>
  );
}
