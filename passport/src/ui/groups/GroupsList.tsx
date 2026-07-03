// Groups list (doc 33): the shared groups the owner is in. Each row names the
// group, tags whether it is an event or recurring and public or invite only, and
// shows a human member count. A create CTA sits up top; an empty state invites the
// first group. This is both the /groups screen and the People slot between starred
// and the contact list (doc 31).
import { Button } from "../../design/components/index.ts";
import { Plus, Chevron, Lock, Users } from "../../design/icons.tsx";
import type { GroupRecord, RequestResult } from "../../store/index.ts";
import { RequestToJoin } from "./RequestToJoin.tsx";
import {
  GROUPS_COPY as C,
  memberCount,
  meetingChip,
  visibilityChip,
} from "./groupsCopy.ts";
import "./groups.css";

// The reader plus everyone else the record knows about. An admin's `members` is
// the roster minus themselves, so add one; a member record has no roster and reads
// as "just you" here (the detail screen shows the real roster on open).
function countOf(group: GroupRecord): number {
  return (group.members?.length ?? 0) + 1;
}

function EmptyState({ onCreate }: { onCreate?: (() => void) | undefined }) {
  return (
    <div className="gr__empty">
      <span>{C.empty}</span>
      <Button
        variant="secondary"
        size="md"
        icon={<Plus size={16} />}
        onClick={onCreate}
      >
        {C.create}
      </Button>
    </div>
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
    <button
      type="button"
      className="gr__row"
      onClick={() => onOpenGroup?.(group.groupId)}
    >
      <span aria-hidden className="gr__row-icon">
        <Users size={20} />
      </span>
      <span className="gr__row-body">
        <span className="gr__row-name">{group.handle}</span>
        <span className="gr__row-meta">
          <span>{meetingChip(group.meetingKind)}</span>
          <span aria-hidden className="gr__meta-dot">
            ·
          </span>
          <span>{visibilityChip(group.visibility)}</span>
          <span aria-hidden className="gr__meta-dot">
            ·
          </span>
          <span>{memberCount(countOf(group))}</span>
        </span>
      </span>
      <span aria-hidden className="gr__row-trail">
        <Chevron size={20} />
      </span>
    </button>
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
    <div className="gr">
      <div className="gr__head">
        <h1 className="gr__title">{C.title}</h1>
        <Button
          variant="primary"
          size="sm"
          icon={<Plus size={16} />}
          onClick={onCreate}
        >
          {C.create}
        </Button>
      </div>
      <p className="gr__sub">{C.listSub}</p>

      {groups.length === 0 ? (
        <EmptyState onCreate={onCreate} />
      ) : (
        <div className="gr__rows">
          {groups.map((g) => (
            <GroupRow key={g.groupId} group={g} onOpenGroup={onOpenGroup} />
          ))}
        </div>
      )}

      {onRequestToJoin && <RequestToJoin onRequest={onRequestToJoin} />}

      <div className="gr__aside">
        <span aria-hidden className="gr__aside-icon">
          <Lock size={17} />
        </span>
        <div className="gr__aside-body">{C.privacyNote}</div>
      </div>
    </div>
  );
}
