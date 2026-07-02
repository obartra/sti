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
import type { GroupRecord, RosterMemberView } from "../../store/index.ts";
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

function MemberRow({ member }: { member: RosterMemberView }) {
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
    </div>
  );
}

function Roster({ members }: { members: RosterMemberView[] }) {
  const hasAbsent = members.some((m) => m.card === null);
  return (
    <div>
      <div style={{ ...sectionLbl, marginBottom: 8 }}>{C.rosterHeading}</div>
      <Card
        variant="flat"
        style={{ padding: 6, display: "flex", flexDirection: "column" }}
      >
        {members.map((m) => (
          <MemberRow key={m.cardId} member={m} />
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
}

export function GroupDetail({
  group,
  onReadRoster,
  onLeave,
  onDisband,
}: GroupDetailProps) {
  const [roster, setRoster] = useState<RosterState>("loading");

  useEffect(() => {
    let live = true;
    setRoster("loading");
    void onReadRoster(group.groupId)
      .then((members) => {
        if (live) setRoster({ members });
      })
      .catch(() => {
        if (live) setRoster({ members: [] });
      });
    return () => {
      live = false;
    };
    // Re-read when the group changes. onReadRoster arrives as a fresh closure each
    // render (it closes over the latest session ref), so keying on it would re-read
    // every parent render; the effect always calls the latest closure anyway.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [group.groupId]);

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

      {roster === "loading" ? null : <Roster members={roster.members} />}

      {/* SEAM (doc 33, slice 7b): admin invite / join-request review / remove-member
          controls land here for an admin. Slice 7a is the member happy path only. */}

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
