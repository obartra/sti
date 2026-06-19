import type { ReactNode } from "react";
import { Card, Row } from "../../design/components/index.ts";
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
const COPY = {
  notifications: {
    title: "Notifications",
    empty: "All caught up",
    items: [
      {
        icon: "bell",
        title: "Time to re-test soon",
        sub: "Keep your status up to date",
        when: "Today",
        to: "report",
      },
      {
        icon: "users",
        title: "@marco asked to see your status",
        sub: "Approve or decline in Privacy & sharing",
        when: "2h ago",
        to: "privacy",
      },
      {
        icon: "circle",
        title: "2 people asked to join Solstice",
        sub: "Review requests in the approvals queue",
        when: "Yesterday",
        to: "circle-approvals",
      },
      {
        icon: "heart",
        title: "A private heads-up",
        sub: "A recent contact suggests getting tested",
        when: "Last week",
        to: "a3-alert",
      },
    ],
  },
} as const;

type NotifIcon = "bell" | "users" | "circle" | "heart";

export interface NotificationItem {
  icon: NotifIcon;
  title: string;
  sub: string;
  when: string;
  /** Optional tap handler; the source navigates to a destination route. */
  onOpen?: (() => void) | undefined;
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
  when: n.when,
}));

export interface NotificationsProps {
  items?: NotificationItem[];
}

export function Notifications({ items = DEFAULT_ITEMS }: NotificationsProps) {
  const c = COPY.notifications;
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
          {items.map((n, i) => (
            <Row
              key={i}
              lead={iconFor(n.icon)}
              title={n.title}
              sub={`${n.sub} · ${n.when}`}
              trail={<Chevron size={18} />}
              {...(n.onOpen ? { onClick: n.onOpen } : {})}
            />
          ))}
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
