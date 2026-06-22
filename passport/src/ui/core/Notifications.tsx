import { useEffect, type ReactNode } from "react";
import { Button, Card, Row } from "../../design/components/index.ts";
import {
  Bell,
  Users,
  Circles,
  Heart,
  Chevron,
  Lock,
} from "../../design/icons.tsx";

// Notifications: the activity inbox. Faithful port of core-app.jsx
// Notifications, copy verbatim from copy.js (notifications). Each row is a
// neutral prompt that never names a condition or a person in its own text;
// the privacy-safe wording is the whole point of the screen.
// The default items mirror what the app actually renders (see coreScreens
// notificationItems): the re-test nudge shown once freshness has lapsed and a
// CONTENTLESS knock entry — no requester, no count, no per-knock timing. The
// partner-notify row is added live when a contact reports. Kept in sync so
// Storybook and the privacy-invariant test model the real contract, not an older one.
const COPY = {
  notifications: {
    title: "Notifications",
    empty: "All caught up",
    items: [
      {
        icon: "bell",
        title: "Time to re-test",
        sub: "Your status has gone gray. A fresh test brings it back.",
      },
      {
        icon: "users",
        // Contentless: never names the requester, never shows a count or a time
        // (doc 02 — the owner-pull indicator carries none of that).
        title: "Someone with your link asked to see your status",
        sub: "Share an up-to-date link with people you choose",
      },
    ],
  },
} as const;

type NotifIcon = "bell" | "users" | "circle" | "heart";

export interface NotificationItem {
  icon: NotifIcon;
  title: string;
  sub: string;
  /** A coarse recency label. Omitted for knocks (no per-knock timing leaks). */
  when?: string | undefined;
  /** Optional tap handler; the source navigates to a destination route. */
  onOpen?: (() => void) | undefined;
  /** Optional inline action (e.g. Approve a knock), shown as a button on the row. */
  action?:
    | { label: string; onAct: () => void; busy?: boolean | undefined }
    | undefined;
}

function iconFor(k: NotifIcon): ReactNode {
  if (k === "bell") return <Bell size={20} />;
  if (k === "users") return <Users size={20} />;
  if (k === "circle") return <Circles size={20} />;
  return <Heart size={20} />;
}

const DEFAULT_ITEMS: NotificationItem[] = COPY.notifications.items.map((n) => ({
  icon: n.icon,
  title: n.title,
  sub: n.sub,
}));

export interface NotificationsProps {
  items?: NotificationItem[];
  /** Fired once when the inbox is shown, so the owner-pull knock count refreshes. */
  onView?: (() => void) | undefined;
}

export function Notifications({
  items = DEFAULT_ITEMS,
  onView,
}: NotificationsProps) {
  const c = COPY.notifications;
  useEffect(() => {
    onView?.();
    // Pull once on open; onView is stable enough and a re-pull per render is wrong.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 16,
        width: "100%",
        maxWidth: 390,
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
        {c.title}
      </h1>
      {items.length === 0 ? (
        <Card
          variant="flat"
          style={{
            display: "flex",
            justifyContent: "center",
            padding: "28px 16px",
            fontSize: 14,
            fontWeight: 600,
            color: "var(--text-muted)",
          }}
        >
          {c.empty}
        </Card>
      ) : (
        <Card
          variant="flat"
          style={{ padding: 6, display: "flex", flexDirection: "column" }}
        >
          {items.map((n, i) => {
            const act = n.action;
            const trail = act ? (
              <Button
                variant="secondary"
                size="sm"
                disabled={act.busy}
                onClick={act.onAct}
              >
                {act.busy ? `${act.label}…` : act.label}
              </Button>
            ) : (
              <Chevron size={18} />
            );
            // A row with an action isn't itself tappable (only its button is), so
            // it must NOT render as a <button> — that would nest a button in a
            // button. It's interactive only when it navigates via onOpen.
            return (
              <Row
                key={i}
                lead={iconFor(n.icon)}
                title={n.title}
                sub={n.when ? `${n.sub} · ${n.when}` : n.sub}
                trail={trail}
                interactive={!!n.onOpen && !act}
                {...(n.onOpen && !act ? { onClick: n.onOpen } : {})}
              />
            );
          })}
        </Card>
      )}
      <div
        style={{
          fontSize: 12.5,
          color: "var(--text-subtle)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 6,
        }}
      >
        <Lock size={13} /> Notifications never name a condition or a person.
      </div>
    </div>
  );
}
