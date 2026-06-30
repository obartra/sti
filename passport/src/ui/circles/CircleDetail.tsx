// Group detail: a header, the member roster (every member, any size), and a delete
// control. A group is a private, read-only view over contacts you've already linked
// with, so there is nothing to "leave" and no roles, approvals, or per-group
// sharing: each member's color is their own pairwise share, and being in the group
// is itself sharing that color to it (doc 31), so the roster shows at any size.
import { useEffect, useState } from "react";
import { Avatar, Button, Card } from "../../design/components/index.ts";
import { EyeOff, Heart, Trash, UserPlus } from "../../design/icons.tsx";
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
  sharing:
    "Everyone here sees each other’s color. Being in the group is sharing it.",
  additionalPrivate:
    "A roster only shows each person’s overall color, never results or conditions, and never the full picture.",
  noShame:
    "If someone’s status changes, only they are told. No one else sees it, and there’s no count.",
  edit: "Edit name and members",
  delete: "Delete group",
  deleteNote: "Removes this grouping for you. Your contacts are not affected.",
} as const;

// The roster resolves asynchronously (each member's status alias), so a group is
// either loading or a resolved member list (shown at any size, doc 31).
type RosterState = "loading" | { members: CircleRosterMember[] };

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

export interface CircleDetailProps {
  circle: CircleRecord;
  contacts: ContactRecord[];
  resolveAlias: PassportStore["resolveAlias"];
  onEdit?: (() => void) | undefined;
  onDelete?: (() => void) | undefined;
}

export function CircleDetail({
  circle,
  contacts,
  resolveAlias,
  onEdit,
  onDelete,
}: CircleDetailProps) {
  const [roster, setRoster] = useState<RosterState>("loading");

  useEffect(() => {
    let live = true;
    setRoster("loading");
    void resolveCircleRoster(circle, contacts, resolveAlias).then((members) => {
      if (!live) return;
      setRoster({ members });
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
        maxWidth: 600,
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

      <div
        style={{
          fontSize: 12.5,
          color: "var(--text-subtle)",
          lineHeight: 1.5,
        }}
      >
        {COPY.sharing}
      </div>

      {roster === "loading" ? null : <Roster members={roster.members} />}

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
          variant="secondary"
          size="md"
          icon={<UserPlus size={16} />}
          onClick={onEdit}
        >
          {COPY.edit}
        </Button>
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
