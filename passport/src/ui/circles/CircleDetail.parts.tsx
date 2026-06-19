// Internal presentational sub-components for CircleDetail. Kept in a sibling
// file so CircleDetail.tsx stays within the file-length ceiling. Not a public
// surface: only CircleDetail.tsx imports from here.
import { Card, Avatar, Switch } from "../../design/components/index.ts";
import { Calendar, EyeOff } from "../../design/icons.tsx";
import { avatarFor } from "../../lib/avatars.ts";
import { MemberDot, RoleBadge, sectionLbl } from "./shared.tsx";
import type { Circle, CircleMember, Tone } from "./shared.tsx";

export const COPY = {
  eventChip: "Event",
  circleChip: "Circle",
  members: "members",
  additionalPrivate:
    "Some members share privately, so they’re not shown here. A roster is never the full picture.",
  aggSmall:
    "This circle has under 5 people, so individual statuses stay hidden, a guard against guessing who’s who in a tiny group.",
  approvalNote: "Joining always needs host approval.",
  invite: "Invite",
  inviteTitle: "Invite people",
  inviteSub:
    "Share the link or code, or let them scan the QR. Everyone who opens it can request to join.",
  inviteNew: "New link",
  inviteNewSub:
    "Replaces the old one. Anyone holding the old link can no longer request.",
  yourShare: "Sharing your status with this circle",
  yourShareOff: "Your status is hidden from this circle",
  manage: "Manage",
  leave: "Leave circle",
  expires: "Expires",
  eventIn: "Event in",
  days: "days",
  approvalsTitle: "Approvals",
  shareEvent: "Share event",
  noShame:
    "Statuses change. If yours flips, your light just turns gray and you get a private nudge. Nobody is ever called out, and no one sees a tally.",
} as const;

export const ROSTER_MIN = 5;

// In the live app, "you" can pause sharing globally; here a member's own
// sharing flag is the only thing that grays their light.
export function tone(m: CircleMember): Tone {
  if (m.you && m.sharing === false) return "gray";
  return m.status;
}

export function DetailHeader({ circle: g }: { circle: Circle }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "space-between",
        gap: 10,
      }}
    >
      <div>
        <h1
          style={{
            fontSize: 24,
            fontWeight: 800,
            letterSpacing: "-0.02em",
            color: "var(--text-strong)",
          }}
        >
          {g.name}
        </h1>
        <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 3 }}>
          {g.type === "event"
            ? `${COPY.eventChip} · ${g.date}`
            : COPY.circleChip}{" "}
          · {g.members.length} {COPY.members}
        </div>
      </div>
      <RoleBadge role={g.role} />
    </div>
  );
}

export function DateCard({ circle: g }: { circle: Circle }) {
  return (
    <Card
      variant="flat"
      pad="sm"
      style={{ display: "flex", alignItems: "center", gap: 12 }}
    >
      <span
        style={{
          flex: "none",
          width: 36,
          height: 36,
          borderRadius: "var(--radius-sm)",
          background: "var(--accent-soft)",
          color: "var(--text-accent)",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Calendar size={18} />
      </span>
      <div style={{ flex: 1 }}>
        <div
          style={{
            fontSize: 14,
            fontWeight: 700,
            color: "var(--text-strong)",
          }}
        >
          {g.type === "event"
            ? `${COPY.eventIn} ${g.daysToDate} ${COPY.days}`
            : `${COPY.expires} ${g.expires}`}
        </div>
        <div style={{ fontSize: 12, color: "var(--text-subtle)" }}>
          {g.type === "event"
            ? g.date
            : `${g.daysToExpiry} ${COPY.days} left · then auto-archives`}
        </div>
      </div>
    </Card>
  );
}

interface ShareToggleProps {
  me: CircleMember;
  onToggle: () => void;
}

export function ShareToggle({ me, onToggle }: ShareToggleProps) {
  return (
    <Card
      variant={me.sharing ? "tint" : "flat"}
      style={{ display: "flex", alignItems: "center", gap: 12 }}
    >
      <Avatar alt="robin" src={avatarFor(me.handle)} size="sm" />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 14,
            fontWeight: 600,
            color: "var(--text-strong)",
          }}
        >
          {me.sharing ? COPY.yourShare : COPY.yourShareOff}
        </div>
        <div style={{ marginTop: 3 }}>
          <MemberDot tone={tone(me)} />
        </div>
      </div>
      <Switch checked={!!me.sharing} onChange={onToggle} />
    </Card>
  );
}

function RosterRow({ member: m }: { member: CircleMember }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 11,
        padding: "8px 8px",
      }}
    >
      <Avatar alt={m.handle} src={avatarFor(m.handle)} size="sm" />
      <div
        style={{
          flex: 1,
          minWidth: 0,
          display: "flex",
          flexDirection: "column",
          gap: 4,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 7,
            minWidth: 0,
          }}
        >
          <span
            style={{
              fontSize: 14.5,
              fontWeight: 600,
              color: "var(--text-strong)",
              minWidth: 0,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            @{m.handle}
            {m.you ? " · you" : ""}
          </span>
          <RoleBadge role={m.role} />
        </div>
        <MemberDot tone={tone(m)} />
      </div>
    </div>
  );
}

export function Roster({ circle: g }: { circle: Circle }) {
  return (
    <div>
      <div style={{ ...sectionLbl, marginBottom: 8 }}>
        {g.members.length} {COPY.members}
      </div>
      <Card
        variant="flat"
        style={{ padding: 6, display: "flex", flexDirection: "column" }}
      >
        {g.members.map((m) => (
          <RosterRow key={m.handle} member={m} />
        ))}
      </Card>
      <div
        style={{
          fontSize: 12,
          color: "var(--text-subtle)",
          lineHeight: 1.5,
          display: "flex",
          gap: 6,
          marginTop: 8,
        }}
      >
        <EyeOff size={13} style={{ flex: "none", marginTop: 2 }} />{" "}
        {COPY.additionalPrivate}
      </div>
    </div>
  );
}

export function SmallCircleNotice() {
  return (
    <Card variant="flat" style={{ display: "flex", gap: 12 }}>
      <span style={{ color: "var(--text-accent)", flex: "none", marginTop: 1 }}>
        <EyeOff size={18} />
      </span>
      <div
        style={{
          fontSize: 13.5,
          lineHeight: 1.55,
          color: "var(--text-body)",
        }}
      >
        {COPY.aggSmall}
        <div
          style={{
            fontSize: 12.5,
            color: "var(--text-subtle)",
            marginTop: 6,
          }}
        >
          {COPY.additionalPrivate}
        </div>
      </div>
    </Card>
  );
}
