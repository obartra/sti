// Group detail (doc 33): a calm roster of everyone's status color, plus the one way
// out for the reader (leave if you are a member, disband if you are the admin). The
// roster is read on open; a member's first read caches the shared key and publishes
// their own card, so the returned session is folded back (the action handles that).
// Each row shows the app's real status medallion; a gray dot means that member has
// not shared a color here yet. Admin invite / request / remove controls are a later
// slice (see the seam below).
import { useEffect, useState } from "react";
import { Button, Card } from "../../design/components/index.ts";
import { Medallion } from "../badge-card.tsx";
import type {
  GroupRecord,
  PendingRequest,
  RosterMemberView,
} from "../../store/index.ts";
import {
  AdminControls,
  RemoveControl,
  type AdminControlsProps,
} from "./GroupDetail.admin.tsx";
import { GROUPS_COPY as C, meetingChip, visibilityChip } from "./groupsCopy.ts";

type RosterState = "loading" | { members: RosterMemberView[] };

const sectionLbl = {
  fontSize: 12,
  fontWeight: 700,
  letterSpacing: "0.06em",
  textTransform: "uppercase" as const,
  color: "var(--text-subtle)",
};

// A short "you" / "admin" tag on a roster row. Both can be true (you are the admin);
// the reader's own row leads with "you".
function MemberTag({ member }: { member: RosterMemberView }) {
  const tags = [
    ...(member.isSelf ? [C.you] : []),
    ...(member.isAdmin ? [C.admin] : []),
  ];
  if (tags.length === 0) return null;
  return (
    <span
      style={{
        fontSize: 11.5,
        fontWeight: 600,
        color: "var(--text-muted)",
        background: "var(--neutral-100)",
        borderRadius: "var(--radius-pill)",
        padding: "2px 9px",
      }}
    >
      {tags.join(" · ")}
    </span>
  );
}

function MemberRow({
  member,
  onRemove,
}: {
  member: RosterMemberView;
  onRemove?: (() => void) | undefined;
}) {
  // The app's real two-state status medallion; a member with no live card reads
  // gray (honest absent), never a wrong color.
  const state = member.card?.state === "blue" ? "blue" : "gray";
  const name = member.card?.identity.handle ?? "";
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "8px 8px",
      }}
    >
      <Medallion state={state} size={34} />
      <div style={{ flex: 1, minWidth: 0 }}>
        {name !== "" && (
          <div
            style={{
              fontSize: 14.5,
              fontWeight: 600,
              color: "var(--text-strong)",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {name}
          </div>
        )}
      </div>
      <MemberTag member={member} />
      {onRemove && <RemoveControl onRemove={onRemove} />}
    </div>
  );
}

function Roster({
  members,
  onRemoveMember,
}: {
  members: RosterMemberView[];
  onRemoveMember?: ((cardId: string) => void) | undefined;
}) {
  const hasAbsent = members.some((m) => m.card === null);
  return (
    <div>
      <div style={{ ...sectionLbl, marginBottom: 8 }}>{C.rosterHeading}</div>
      <Card
        variant="flat"
        style={{ padding: 6, display: "flex", flexDirection: "column" }}
      >
        {members.map((m) => (
          <MemberRow
            key={m.cardId}
            member={m}
            onRemove={
              onRemoveMember && !m.isSelf
                ? () => onRemoveMember(m.cardId)
                : undefined
            }
          />
        ))}
      </Card>
      {hasAbsent && (
        <div
          style={{
            fontSize: 12,
            color: "var(--text-subtle)",
            lineHeight: 1.5,
            marginTop: 8,
          }}
        >
          {C.absentNote}
        </div>
      )}
    </div>
  );
}

// The one way out, an inline danger confirm mirroring the account-delete pattern:
// a danger button reveals a title/body plus cancel/confirm. A member leaves; the
// admin disbands. The wording differs by role but the shape is the same.
function DangerAction({
  cta,
  title,
  body,
  confirm,
  onConfirm,
}: {
  cta: string;
  title: string;
  body: string;
  confirm: string;
  onConfirm: () => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Card
      variant="flat"
      style={{
        borderColor: "var(--expired-100)",
        display: "flex",
        flexDirection: "column",
        gap: 12,
      }}
    >
      {!open ? (
        <Button variant="danger" size="md" block onClick={() => setOpen(true)}>
          {cta}
        </Button>
      ) : (
        <>
          <div
            style={{
              fontSize: 15,
              fontWeight: 700,
              color: "var(--text-strong)",
            }}
          >
            {title}
          </div>
          <div
            style={{
              fontSize: 13,
              color: "var(--text-muted)",
              lineHeight: 1.5,
            }}
          >
            {body}
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <Button
              variant="quiet"
              size="md"
              block
              onClick={() => setOpen(false)}
            >
              {C.cancel}
            </Button>
            <Button variant="danger" size="md" block onClick={onConfirm}>
              {confirm}
            </Button>
          </div>
        </>
      )}
    </Card>
  );
}

export interface GroupDetailProps {
  group: GroupRecord;
  /** Read the roster on open (the action folds the returned session). */
  onReadRoster: (groupId: string) => Promise<RosterMemberView[]>;
  /** Member self-exit: leave the group, then navigate away (handled by the parent). */
  onLeave: () => void;
  /** Admin teardown: disband the group for everyone, then navigate away. */
  onDisband: () => void;
  /** Admin ingest of arrived accepts/leaves, run before the roster read so a fresh
   * join shows on open (doc 33, slice 7b). Best-effort; absent when not wired. */
  onPollLifecycle?: (() => Promise<void>) | undefined;
  /** Admin: create an invite link for this group. */
  onCreateInvite?: ((groupId: string) => Promise<string>) | undefined;
  /** Admin: cancel a not-yet-accepted invite. */
  onRevokeInvite?: ((groupId: string, inviteId: string) => void) | undefined;
  /** Admin (public groups): read the waiting join requests. */
  onReviewRequests?:
    | ((groupId: string) => Promise<PendingRequest[]>)
    | undefined;
  /** Admin (public groups): approve one join request. */
  onApproveRequest?:
    | ((groupId: string, request: PendingRequest) => Promise<void>)
    | undefined;
  /** Admin (public groups): reject one join request. */
  onRejectRequest?:
    | ((groupId: string, request: PendingRequest) => Promise<void>)
    | undefined;
  /** Admin: remove a member (rotates the key); the roster is re-read after. */
  onRemoveMember?:
    | ((groupId: string, cardId: string) => Promise<void>)
    | undefined;
}

// The admin-controls bundle for this detail, or null when the reader is not an admin
// or the handlers are not wired (a member view). Kept out of the component so its
// gating does not inflate GroupDetail's complexity.
function adminControlsFor(props: GroupDetailProps): AdminControlsProps | null {
  const { group } = props;
  if (
    !group.isAdmin ||
    props.onCreateInvite === undefined ||
    props.onRevokeInvite === undefined ||
    props.onReviewRequests === undefined ||
    props.onApproveRequest === undefined ||
    props.onRejectRequest === undefined
  ) {
    return null;
  }
  return {
    group,
    onCreateInvite: props.onCreateInvite,
    onRevokeInvite: props.onRevokeInvite,
    onReviewRequests: props.onReviewRequests,
    onApproveRequest: props.onApproveRequest,
    onRejectRequest: props.onRejectRequest,
  };
}

export function GroupDetail(props: GroupDetailProps) {
  const { group, onReadRoster, onLeave, onDisband } = props;
  const [roster, setRoster] = useState<RosterState>("loading");
  const admin = adminControlsFor(props);

  useEffect(() => {
    let live = true;
    setRoster("loading");
    const read = () =>
      onReadRoster(group.groupId)
        .then((members) => {
          if (live) setRoster({ members });
        })
        .catch(() => {
          if (live) setRoster({ members: [] });
        });
    // Poll for arrived accepts/leaves first (admin), so a just-joined member shows on
    // open, then read; with no poll wired, read straight away (kept synchronous so a
    // member view reads on mount). The poll is best-effort and never blocks the read.
    if (props.onPollLifecycle) {
      void props
        .onPollLifecycle()
        .catch(() => undefined)
        .then(read);
    } else {
      void read();
    }
    return () => {
      live = false;
    };
    // Re-read when the group changes. onReadRoster arrives as a fresh closure each
    // render (it closes over the latest session ref), so keying on it would re-read
    // every parent render; the effect always calls the latest closure anyway.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [group.groupId]);

  // Remove a member, then re-read (the key rotated, so cards must be re-opened).
  const removeMember =
    props.onRemoveMember && group.isAdmin
      ? (cardId: string) => {
          void props
            .onRemoveMember?.(group.groupId, cardId)
            .then(() => onReadRoster(group.groupId))
            .then((members) => setRoster({ members }))
            .catch(() => undefined);
        }
      : undefined;

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
          {group.handle}
        </h1>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            marginTop: 6,
          }}
        >
          <span style={{ fontSize: 12.5, color: "var(--text-muted)" }}>
            {meetingChip(group.meetingKind)}
          </span>
          <span style={{ color: "var(--text-subtle)" }}>·</span>
          <span style={{ fontSize: 12.5, color: "var(--text-muted)" }}>
            {visibilityChip(group.visibility)}
          </span>
        </div>
      </div>

      <div
        style={{ fontSize: 12.5, color: "var(--text-subtle)", lineHeight: 1.5 }}
      >
        {C.membershipIsSharing}
      </div>

      {roster === "loading" ? null : (
        <Roster members={roster.members} onRemoveMember={removeMember} />
      )}

      {/* Admin controls (doc 33, slice 7b): invite link + pending invites, and, for a
          public group, the contentless join-request review. Removal lives per roster
          row above. All admin-only; the parent wires the handlers only for an admin. */}
      {admin !== null && <AdminControls {...admin} />}

      {group.isAdmin ? (
        <DangerAction
          cta={C.disbandCta}
          title={C.disbandConfirmTitle}
          body={C.disbandConfirmBody}
          confirm={C.disbandConfirm}
          onConfirm={onDisband}
        />
      ) : (
        <DangerAction
          cta={C.leaveCta}
          title={C.leaveConfirmTitle}
          body={C.leaveConfirmBody}
          confirm={C.leaveConfirm}
          onConfirm={onLeave}
        />
      )}
    </div>
  );
}
