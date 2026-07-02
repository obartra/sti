// Groups list (doc 33): the shared groups the owner is in. Each row names the
// group, tags whether it is an event or recurring and public or invite only, and
// shows a human member count. A create CTA sits up top; an empty state invites the
// first group. This is both the /groups screen and the People slot between starred
// and the contact list (doc 31).
import { Button, Card } from "../../design/components/index.ts";
import { Plus, Chevron, Lock, Users } from "../../design/icons.tsx";
import type { GroupRecord, RequestResult } from "../../store/index.ts";
import { RequestToJoin } from "./RequestToJoin.tsx";
import {
  GROUPS_COPY as C,
  memberCount,
  meetingChip,
  visibilityChip,
} from "./groupsCopy.ts";

// The reader plus everyone else the record knows about. An admin's `members` is
// the roster minus themselves, so add one; a member record has no roster and reads
// as "just you" here (the detail screen shows the real roster on open).
function countOf(group: GroupRecord): number {
  return (group.members?.length ?? 0) + 1;
}

function Chip({ children }: { children: string }) {
  return (
    <span
      style={{
        fontSize: 11.5,
        fontWeight: 600,
        color: "var(--text-muted)",
        background: "var(--neutral-100)",
        borderRadius: "var(--radius-pill)",
        padding: "2px 9px",
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </span>
  );
}

function EmptyState({ onCreate }: { onCreate?: (() => void) | undefined }) {
  return (
    <Card
      variant="flat"
      style={{
        textAlign: "center",
        padding: "34px 24px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 12,
      }}
    >
      <span
        style={{
          width: 56,
          height: 56,
          borderRadius: "50%",
          background: "var(--accent-soft)",
          color: "var(--text-accent)",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Users size={28} />
      </span>
      <div
        style={{
          fontSize: 14,
          color: "var(--text-muted)",
          lineHeight: 1.55,
          maxWidth: 280,
        }}
      >
        {C.empty}
      </div>
      <Button
        variant="secondary"
        size="md"
        icon={<Plus size={16} />}
        onClick={onCreate}
      >
        {C.create}
      </Button>
    </Card>
  );
}

function GroupRow({
  group,
  onOpenGroup,
}: {
  group: GroupRecord;
  onOpenGroup?: ((id: string) => void) | undefined;
}) {
  return (
    <Card
      pad="sm"
      variant="interactive"
      onClick={() => onOpenGroup?.(group.groupId)}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 13,
        cursor: "pointer",
      }}
    >
      <span
        style={{
          flex: "none",
          width: 44,
          height: 44,
          borderRadius: "var(--radius-sm)",
          background: "var(--accent-soft)",
          color: "var(--text-accent)",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Users size={21} />
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 15.5,
            fontWeight: 700,
            color: "var(--text-strong)",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
            minWidth: 0,
          }}
        >
          {group.handle}
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            marginTop: 5,
          }}
        >
          <Chip>{meetingChip(group.meetingKind)}</Chip>
          <Chip>{visibilityChip(group.visibility)}</Chip>
          <span style={{ fontSize: 12, color: "var(--text-subtle)" }}>
            {memberCount(countOf(group))}
          </span>
        </div>
      </div>
      <Chevron
        size={20}
        style={{ color: "var(--text-subtle)", flex: "none" }}
      />
    </Card>
  );
}

export interface GroupsListProps {
  groups: GroupRecord[];
  onCreate?: (() => void) | undefined;
  onOpenGroup?: ((id: string) => void) | undefined;
  /** Ask to join a public group by name (doc 33, slice 7b). Absent when logged out. */
  onRequestToJoin?: ((handle: string) => Promise<RequestResult>) | undefined;
}

export function GroupsList({
  groups,
  onCreate,
  onOpenGroup,
  onRequestToJoin,
}: GroupsListProps) {
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
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <h1
          style={{
            fontSize: 26,
            fontWeight: 800,
            letterSpacing: "-0.02em",
            color: "var(--text-strong)",
          }}
        >
          {C.title}
        </h1>
        <Button
          variant="primary"
          size="sm"
          icon={<Plus size={16} />}
          onClick={onCreate}
        >
          {C.create}
        </Button>
      </div>
      <p
        style={{
          fontSize: 14,
          lineHeight: 1.55,
          color: "var(--text-body)",
          margin: 0,
        }}
      >
        {C.listSub}
      </p>

      {groups.length === 0 ? (
        <EmptyState onCreate={onCreate} />
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
            gap: 10,
          }}
        >
          {groups.map((g) => (
            <GroupRow key={g.groupId} group={g} onOpenGroup={onOpenGroup} />
          ))}
        </div>
      )}

      {onRequestToJoin && <RequestToJoin onRequest={onRequestToJoin} />}

      <Card variant="tint" style={{ display: "flex", gap: 12 }}>
        <span
          style={{ color: "var(--text-accent)", flex: "none", marginTop: 1 }}
        >
          <Lock size={17} />
        </span>
        <div
          style={{ fontSize: 13, lineHeight: 1.55, color: "var(--text-body)" }}
        >
          {C.privacyNote}
        </div>
      </Card>
    </div>
  );
}
