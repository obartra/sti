import type { ReactNode } from "react";
import { IconButton } from "../../design/components/index.ts";
import { KnockDot } from "./KnockDot.tsx";
import {
  Plus,
  Bell,
  Back,
  Passport,
  Users,
  Circles,
  Results,
  Care,
  type IconProps,
} from "../../design/icons.tsx";
import "./app-shell.css";

const cx = (...parts: (string | false | undefined)[]) =>
  parts.filter(Boolean).join(" ");

export type TabId = "home" | "connect" | "circles" | "results" | "care";

// Order, labels, and icons reproduced from shell.jsx TabBar + copy.js nav.
const TABS: { id: TabId; label: string; Icon: (p: IconProps) => ReactNode }[] =
  [
    { id: "home", label: "Passport", Icon: Passport },
    { id: "connect", label: "Connect", Icon: Users },
    { id: "circles", label: "Circles", Icon: Circles },
    { id: "results", label: "Results", Icon: Results },
    { id: "care", label: "Care", Icon: Care },
  ];

export function AppTopBar({
  onAdd,
  onBell,
  showAdd = true,
  hasKnocks = false,
}: {
  onAdd?: (() => void) | undefined;
  onBell?: (() => void) | undefined;
  showAdd?: boolean | undefined;
  hasKnocks?: boolean | undefined;
}) {
  return (
    <header className="app-topbar">
      <img
        src="/assets/logo/logo-wordmark.svg"
        alt="sti.care"
        style={{ height: 30 }}
      />
      <div className="app-topbar__actions">
        {showAdd && (
          <IconButton aria-label="Add results" variant="accent" onClick={onAdd}>
            <Plus size={20} />
          </IconButton>
        )}
        <IconButton
          aria-label={
            hasKnocks ? "Notifications (new activity)" : "Notifications"
          }
          onClick={onBell}
        >
          <span style={{ position: "relative", display: "inline-flex" }}>
            <Bell size={20} />
            {hasKnocks && <KnockDot />}
          </span>
        </IconButton>
      </div>
    </header>
  );
}

export function BackBar({
  onBack,
  title,
}: {
  onBack?: () => void;
  title?: string;
}) {
  return (
    <div className="app-backbar">
      <IconButton aria-label="Back" onClick={onBack}>
        <Back size={22} />
      </IconButton>
      {title && <span className="app-backbar__title">{title}</span>}
    </div>
  );
}

export function TabBar({
  tab,
  onTab,
}: {
  tab: TabId;
  onTab: (tab: TabId) => void;
}) {
  return (
    <nav className="app-tabbar">
      {TABS.map(({ id, label, Icon }) => {
        const active = tab === id;
        return (
          <button
            key={id}
            type="button"
            onClick={() => onTab(id)}
            aria-current={active || undefined}
            className={cx("app-tab", active && "app-tab--active")}
          >
            <Icon size={24} />
            <span className="app-tab__label">{label}</span>
          </button>
        );
      })}
    </nav>
  );
}

export interface AppShellProps {
  tab: TabId;
  onTab: (tab: TabId) => void;
  onAdd?: () => void;
  onBell?: () => void;
  showAdd?: boolean;
  hasKnocks?: boolean;
  children: ReactNode;
}

// The mobile app chrome: fixed top bar, scrolling content, fixed bottom tab bar.
export function AppShell({
  tab,
  onTab,
  onAdd,
  onBell,
  showAdd,
  hasKnocks,
  children,
}: AppShellProps) {
  return (
    <div className="app-shell">
      <AppTopBar
        onAdd={onAdd}
        onBell={onBell}
        showAdd={showAdd}
        hasKnocks={hasKnocks}
      />
      <main className="app-shell__content">{children}</main>
      <TabBar tab={tab} onTab={onTab} />
    </div>
  );
}
