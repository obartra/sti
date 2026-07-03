// Accept a group invite (doc 33, slice 7b): someone opened an invite link. Before
// they join, the join-time disclosure says the honest thing plainly (doc 31): being
// in the group is sharing your color with everyone in it, and if anyone later reports
// a positive, everyone gets told to test. Join accepts; No thanks declines. Mirrors
// the contact-invite accept flow (PublicResolution.accept). A logged-out visitor is
// pointed to make an account first, since joining needs one.
import { useState } from "react";
import { Button } from "../../design/components/index.ts";
import { Lock, Users } from "../../design/icons.tsx";
import { cx } from "../../lib/cx.ts";
import type {
  AliasIdentity,
  GroupInvite,
  MeetingKind,
} from "../../store/index.ts";
import { GROUPS_COPY as C, acceptTitle, disclosureFor } from "./groupsCopy.ts";
import { GroupFaceChoice } from "./GroupFaceChoice.tsx";
import "./groups.css";

// The join-time disclosure: the three honest lines, the middle one selected by
// the group's meeting kind (doc 33). Mirrors the create form's disclosure.
function JoinDisclosure({ meetingKind }: { meetingKind: MeetingKind }) {
  return (
    <div className="gr__aside">
      <span aria-hidden className="gr__aside-icon">
        <Lock size={17} />
      </span>
      <div className="gr__aside-body">
        <span>{C.membershipIsSharing}</span>
        <span>{disclosureFor(meetingKind)}</span>
        <span className="gr__aside-quiet">{C.leaveIsEasy}</span>
      </div>
    </div>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return <div className="gr">{children}</div>;
}

export interface AcceptInviteProps {
  invite: GroupInvite;
  isLoggedIn: boolean;
  /** Accept the invite (folds the session); resolves when recorded. `identity` is
   * the face the joiner appears under to members (doc 33 "show as you"). */
  onAccept: (invite: GroupInvite, identity?: AliasIdentity) => Promise<void>;
  /** Decline the invite (tells the admin to drop it). */
  onReject: (invite: GroupInvite) => Promise<void>;
  /** After joining, open People to see the roster. */
  onJoined: () => void;
  /** Logged out: send them to make an account first. */
  onClaim: () => void;
  /** Whether the joiner set a display name, so the "show as you" choice is offered. */
  hasName?: boolean;
  onBack?: (() => void) | undefined;
}

export function AcceptInvite({
  invite,
  isLoggedIn,
  onAccept,
  onReject,
  onJoined,
  onClaim,
  hasName = false,
  onBack,
}: AcceptInviteProps) {
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const [identity, setIdentity] = useState<AliasIdentity>("anonymous");

  const join = () => {
    if (busy) return;
    setBusy(true);
    void onAccept(invite, identity)
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
        <div className={cx("e-card", "gr__done")}>
          <div className="gr__done-title">{C.acceptedTitle}</div>
          <div className="gr__done-body">{C.acceptedBody}</div>
        </div>
        <Button variant="primary" size="lg" block onClick={onJoined}>
          {C.title}
        </Button>
      </Shell>
    );
  }

  return (
    <Shell>
      <h1 className="gr__title">{acceptTitle(invite.handle)}</h1>
      <JoinDisclosure meetingKind={invite.meetingKind} />
      {isLoggedIn ? (
        <>
          <GroupFaceChoice
            value={identity}
            hasName={hasName}
            onChange={setIdentity}
          />
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
          <div className="gr__note">{C.acceptNeedAccount}</div>
          <Button variant="primary" size="lg" block onClick={onClaim}>
            {C.acceptClaimCta}
          </Button>
        </>
      )}
    </Shell>
  );
}
