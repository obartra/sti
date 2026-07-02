// Accept a group invite (doc 33, slice 7b): someone opened an invite link. Before
// they join, the join-time disclosure says the honest thing plainly (doc 31): being
// in the group is sharing your color with everyone in it, and if anyone later reports
// a positive, everyone gets told to test. Join accepts; No thanks declines. Mirrors
// the contact-invite accept flow (PublicResolution.accept). A logged-out visitor is
// pointed to make an account first, since joining needs one.
import { useState } from "react";
import { Button, Card } from "../../design/components/index.ts";
import { Lock, Users } from "../../design/icons.tsx";
import type { GroupInvite, MeetingKind } from "../../store/index.ts";
import { GROUPS_COPY as C, acceptTitle, disclosureFor } from "./groupsCopy.ts";

// The join-time disclosure card: the three honest lines, the middle one selected by
// the group's meeting kind (doc 33). Mirrors the create form's disclosure.
function JoinDisclosure({ meetingKind }: { meetingKind: MeetingKind }) {
  return (
    <Card variant="tint" style={{ display: "flex", gap: 12 }}>
      <span style={{ color: "var(--text-accent)", flex: "none", marginTop: 1 }}>
        <Lock size={17} />
      </span>
      <div
        style={{
          fontSize: 13,
          lineHeight: 1.55,
          color: "var(--text-body)",
          display: "flex",
          flexDirection: "column",
          gap: 8,
        }}
      >
        <span>{C.membershipIsSharing}</span>
        <span>{disclosureFor(meetingKind)}</span>
        <span style={{ color: "var(--text-muted)" }}>{C.leaveIsEasy}</span>
      </div>
    </Card>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
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
      {children}
    </div>
  );
}

export interface AcceptInviteProps {
  invite: GroupInvite;
  isLoggedIn: boolean;
  /** Accept the invite (folds the session); resolves when recorded. */
  onAccept: (invite: GroupInvite) => Promise<void>;
  /** Decline the invite (tells the admin to drop it). */
  onReject: (invite: GroupInvite) => Promise<void>;
  /** After joining, open People to see the roster. */
  onJoined: () => void;
  /** Logged out: send them to make an account first. */
  onClaim: () => void;
  onBack?: (() => void) | undefined;
}

export function AcceptInvite({
  invite,
  isLoggedIn,
  onAccept,
  onReject,
  onJoined,
  onClaim,
  onBack,
}: AcceptInviteProps) {
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  const join = () => {
    if (busy) return;
    setBusy(true);
    void onAccept(invite)
      .then(() => setDone(true))
      .catch(() => undefined)
      .finally(() => setBusy(false));
  };

  const decline = () => {
    void onReject(invite).catch(() => undefined);
    onBack?.();
  };

  if (done) {
    return (
      <Shell>
        <Card
          variant="tint"
          style={{ display: "flex", flexDirection: "column", gap: 8 }}
        >
          <div
            style={{
              fontSize: 17,
              fontWeight: 800,
              color: "var(--text-strong)",
            }}
          >
            {C.acceptedTitle}
          </div>
          <div
            style={{ fontSize: 14, color: "var(--text-body)", lineHeight: 1.5 }}
          >
            {C.acceptedBody}
          </div>
        </Card>
        <Button variant="primary" size="lg" block onClick={onJoined}>
          {C.title}
        </Button>
      </Shell>
    );
  }

  return (
    <Shell>
      <h1
        style={{
          fontSize: 24,
          fontWeight: 800,
          letterSpacing: "-0.02em",
          color: "var(--text-strong)",
        }}
      >
        {acceptTitle(invite.handle)}
      </h1>
      <JoinDisclosure meetingKind={invite.meetingKind} />
      {isLoggedIn ? (
        <>
          <Button
            variant="primary"
            size="lg"
            block
            icon={<Users size={18} />}
            disabled={busy}
            onClick={join}
          >
            {C.acceptCta}
          </Button>
          <Button variant="ghost" size="md" block onClick={decline}>
            {C.acceptRejectCta}
          </Button>
        </>
      ) : (
        <>
          <div
            style={{
              fontSize: 13.5,
              color: "var(--text-muted)",
              lineHeight: 1.55,
            }}
          >
            {C.acceptNeedAccount}
          </div>
          <Button variant="primary" size="lg" block onClick={onClaim}>
            {C.acceptClaimCta}
          </Button>
        </>
      )}
    </Shell>
  );
}
