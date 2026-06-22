// Circle detail: a header, the member roster (shown once the min-5 floor is met,
// otherwise the small-circle notice), and a delete control. A circle is a private,
// read-only view over contacts you've already linked with, so there is nothing to
// "leave" and no roles, approvals, or per-circle sharing: each member's status is
// their own pairwise share, surfaced here and gated by the group-size floor.
import { useEffect, useState } from "react";
import { Avatar, Button, Card } from "../../design/components/index.ts";
import { EyeOff, Heart, Trash } from "../../design/icons.tsx";
import { avatarFor } from "../../lib/avatars.ts";
import {
  resolveCircleRoster,
  type CircleRosterMember,
} from "../../store/circles.ts";
import type { CircleRecord, ContactRecord } from "../../store/accountBlob.ts";
import type { PassportStore } from "../../store/index.ts";
import { MemberDot, sectionLbl } from "./shared.tsx";

const COPY = {
  members: "members",
  aggSmall:
    "This circle has under 5 people, so individual statuses stay hidden, a guard against guessing who’s who in a tiny group.",
  additionalPrivate:
    "A roster only shows each person’s overall status, never results or conditions, and never the full picture.",
  noShame:
    "Statuses change. If someone’s flips, their light just turns gray and they get a private nudge. Nobody is ever called out, and no one sees a tally.",
  delete: "Delete circle",
  deleteNote: "Removes this grouping for you. Your contacts are not affected.",
} as const;

// The roster resolves asynchronously (each member's status alias), so a circle is
// loading, hidden (below the floor), or a resolved member list.
type RosterState =
  | "loading"
  | { hidden: true }
  | { members: CircleRosterMember[] };

function MemberRow({ member }: { member: CircleRosterMember }) {
  const name = member.label.trim() === "" ? "Contact" : member.label;
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 11,
        padding: "8px 8px",
      }}
    >
      <Avatar alt={name} src={avatarFor(member.contactId)} size="sm" />
      <div
        style={{
          flex: 1,
          minWidth: 0,
          display: "flex",
          flexDirection: "column",
          gap: 4,
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
          {name}
        </span>
        <MemberDot tone={member.tone} />
      </div>
    </div>
  );
}

function Roster({ members }: { members: CircleRosterMember[] }) {
  return (
    <div>
      <div style={{ ...sectionLbl, marginBottom: 8 }}>
        {members.length} {COPY.members}
      </div>
      <Card
        variant="flat"
        style={{ padding: 6, display: "flex", flexDirection: "column" }}
      >
        {members.map((m) => (
          <MemberRow key={m.contactId} member={m} />
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

function SmallCircleNotice() {
  return (
    <Card variant="flat" style={{ display: "flex", gap: 12 }}>
      <span style={{ color: "var(--text-accent)", flex: "none", marginTop: 1 }}>
        <EyeOff size={18} />
      </span>
      <div
        style={{ fontSize: 13.5, lineHeight: 1.55, color: "var(--text-body)" }}
      >
        {COPY.aggSmall}
      </div>
    </Card>
  );
}

export interface CircleDetailProps {
  circle: CircleRecord;
  contacts: ContactRecord[];
  resolveAlias: PassportStore["resolveAlias"];
  onDelete?: (() => void) | undefined;
}

export function CircleDetail({
  circle,
  contacts,
  resolveAlias,
  onDelete,
}: CircleDetailProps) {
  const [roster, setRoster] = useState<RosterState>("loading");

  useEffect(() => {
    let live = true;
    setRoster("loading");
    void resolveCircleRoster(circle, contacts, resolveAlias).then((members) => {
      if (!live) return;
      setRoster(members === null ? { hidden: true } : { members });
    });
    return () => {
      live = false;
    };
    // resolveAlias is the stable backend boundary; keying on it would re-resolve on
    // every parent render (it arrives as a fresh closure). circle + contacts drive
    // re-resolution, and the effect always closes over the latest resolver.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [circle, contacts]);

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
      <div>
        <h1
          style={{
            fontSize: 24,
            fontWeight: 800,
            letterSpacing: "-0.02em",
            color: "var(--text-strong)",
          }}
        >
          {circle.name}
        </h1>
        <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 3 }}>
          {circle.memberContactIds.length} {COPY.members}
        </div>
      </div>

      {roster === "loading" ? null : "hidden" in roster ? (
        <SmallCircleNotice />
      ) : (
        <Roster members={roster.members} />
      )}

      <div
        style={{
          fontSize: 12.5,
          color: "var(--text-subtle)",
          lineHeight: 1.5,
          display: "flex",
          gap: 6,
        }}
      >
        <Heart size={14} style={{ flex: "none", marginTop: 1 }} />{" "}
        {COPY.noShame}
      </div>

      <Card
        variant="flat"
        style={{ display: "flex", flexDirection: "column", gap: 10 }}
      >
        <Button
          variant="danger"
          size="md"
          icon={<Trash size={16} />}
          onClick={onDelete}
        >
          {COPY.delete}
        </Button>
        <div
          style={{
            fontSize: 12.5,
            color: "var(--text-subtle)",
            lineHeight: 1.5,
          }}
        >
          {COPY.deleteNote}
        </div>
      </Card>
    </div>
  );
}
