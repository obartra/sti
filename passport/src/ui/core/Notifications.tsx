import { useEffect, type ReactNode } from "react";
import { Button } from "../../design/components/index.ts";
import {
  Bell,
  Users,
  Circles,
  Heart,
  Chevron,
  Lock,
} from "../../design/icons.tsx";
import { cx } from "../../lib/cx.ts";
import "./notifications.css";

// Notifications: the activity inbox, a quiet one (doc 37): hairline rows on
// the page surface, never tinted. Each row is a neutral prompt that never
// names a condition or a person in its own text; the privacy-safe wording is
// the whole point of the screen.
// The default items mirror what the app actually renders (see coreScreens
// notificationItems): the re-test nudge shown once freshness has lapsed and a
// CONTENTLESS knock entry - no requester, no count, no per-knock timing. The
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
        // (doc 02 - the owner-pull indicator carries none of that).
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
  if (k === "bell") return <Bell size={18} />;
  if (k === "users") return <Users size={18} />;
  if (k === "circle") return <Circles size={18} />;
  return <Heart size={18} />;
}

const DEFAULT_ITEMS: NotificationItem[] = COPY.notifications.items.map((n) => ({
  icon: n.icon,
  title: n.title,
  sub: n.sub,
}));

// One inbox row on the hairline grammar. A row with an inline action isn't
// itself tappable (only its button is), so it must NOT render as a <button> -
// that would nest a button in a button. It's interactive only when it
// navigates via onOpen.
function InboxRow({ item }: { item: NotificationItem }) {
  const act = item.action;
  const sub = item.when ? `${item.sub} · ${item.when}` : item.sub;
  const body = (
    <>
      <span className="e-row__lead">{iconFor(item.icon)}</span>
      <span className="e-row__body">
        <span className="e-row__title">{item.title}</span>
        <span className="e-row__sub">{sub}</span>
      </span>
    </>
  );
  if (act) {
    return (
      <div className="e-row">
        {body}
        <Button
          variant="secondary"
          size="sm"
          disabled={act.busy}
          onClick={act.onAct}
        >
          {act.busy ? `${act.label}…` : act.label}
        </Button>
      </div>
    );
  }
  if (item.onOpen) {
    return (
      <button
        type="button"
        className={cx("e-row", "e-row--action")}
        onClick={item.onOpen}
      >
        {body}
        <span className="e-row__trail" aria-hidden>
          <Chevron size={18} />
        </span>
      </button>
    );
  }
  return <div className="e-row">{body}</div>;
}

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
    <div className="ntf">
      <h1 className="ntf__title">{c.title}</h1>
      {items.length === 0 ? (
        <div className="ntf__empty">{c.empty}</div>
      ) : (
        <div className="ntf__rows">
          {items.map((n, i) => (
            <InboxRow key={i} item={n} />
          ))}
        </div>
      )}
      <div className="ntf__foot">
        <Lock size={13} /> Notifications never name a condition or a person.
      </div>
    </div>
  );
}
