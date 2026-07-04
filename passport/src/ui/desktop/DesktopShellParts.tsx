import type { ReactNode } from "react";
import { Button, IconButton, Avatar } from "../../design/components/index.ts";
import { avatarFor } from "../../lib/avatars.ts";
import { cx } from "../../lib/cx.ts";
import { Matrix } from "../../lib/qr.tsx";
import {
  Passport,
  Users,
  Link,
  Care,
  Plus,
  Bell,
  Share,
  Back,
  Eye,
  type IconProps,
} from "../../design/icons.tsx";
import type { Tab } from "../app/routes.ts";
import "./desktop-shell.css";

/* Chrome pieces for the desktop app shell (sidebar, header, share rail, content
   area), split out of Desktop.tsx so each file stays under the length ceiling.
   Styled by desktop-shell.css on the editorial grammar (doc 37). */

export type DesktopTab = Tab;

// The sidebar nav copy + the home actions the header/rail read.
const COPY = {
  nav: {
    passport: "Passport",
    links: "Links",
    people: "People",
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
  { id: "links", label: COPY.nav.links, icon: Link },
  { id: "people", label: COPY.nav.people, icon: Users },
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
      className={cx("desk-nav-item", active && "desk-nav-item--active")}
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
    <button type="button" onClick={onViewAs} className="desk-owner">
      <Avatar
        src={avatarSrc ?? (handle ? avatarFor(handle) : undefined)}
        size="sm"
      />
      <span className="desk-owner__body">
        <span className="desk-owner__handle">{handle ?? ""}</span>
        <span className="desk-owner__hint">{COPY.home.viewAs}</span>
      </span>
      <Eye size={16} className="desk-owner__eye" />
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
    <aside className="desk-side">
      <div className="desk-side__brand">
        <img src="/assets/logo/logo-wordmark.svg" alt="sti.care" />
      </div>

      <nav className="desk-side__nav">
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

      <div className="desk-side__report">
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

      <div className="desk-side__spacer" />

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
    <header className="desk-header">
      <div className="desk-header__lead">
        {sub ? (
          <button type="button" onClick={onBack} className="desk-header__back">
            <Back size={20} /> Back
          </button>
        ) : (
          <span className="desk-header__title">{headerTitle}</span>
        )}
      </div>
      <div className="desk-header__actions">
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
    <aside className="desk-rail">
      <div className="desk-rail__sticky">
        <div className="e-card desk-rail__card">
          <div className="desk-rail__label">Your passport</div>
          <div className="desk-rail__qr">
            <Matrix size={156} seed="a7f3k9q2" color="var(--ink-900)" />
          </div>
          <div className="desk-rail__sub">
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
        </div>
      </div>
    </aside>
  );
}

// ── Main content area ───────────────────────────────────────────────────────
export function MainContent({
  roomy,
  showRail,
  onShare,
  onViewAs,
  children,
}: {
  roomy: boolean;
  showRail: boolean;
  onShare?: (() => void) | undefined;
  onViewAs?: (() => void) | undefined;
  children?: ReactNode;
}) {
  return (
    <main className="desk-main">
      {showRail ? (
        <div
          className={cx("desk-main__wide", roomy && "desk-main__wide--roomy")}
        >
          <div
            className={cx("desk-main__col", roomy && "desk-main__col--roomy")}
          >
            {children}
          </div>
          <ShareRail onShare={onShare} onViewAs={onViewAs} />
        </div>
      ) : (
        <div
          className={cx(
            "desk-main__center",
            roomy && "desk-main__center--roomy",
          )}
        >
          {children}
        </div>
      )}
    </main>
  );
}
