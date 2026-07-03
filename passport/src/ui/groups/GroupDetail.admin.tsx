// Admin-only pieces of the group detail (doc 33, slice 7b), split out so GroupDetail
// stays within its file/complexity ceilings: the per-member remove control, and the
// invite + join-request sections that sit under the roster for an admin.
import { useState } from "react";
import { Button } from "../../design/components/index.ts";
import { Dots } from "../../design/icons.tsx";
import type { GroupRecord, PendingRequest } from "../../store/index.ts";
import { GroupInviteShare } from "./GroupInviteShare.tsx";
import { GroupRequestsReview } from "./GroupRequestsReview.tsx";
import { GROUPS_COPY as C } from "./groupsCopy.ts";
import "./groups.css";

// The confirm popover: says plainly what removal does and that they are not told why.
function RemoveConfirm({
  onCancel,
  onConfirm,
}: {
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="gr__pop gr__pop--confirm">
      <div className="gr__pop-title">{C.removeConfirmTitle}</div>
      <div className="gr__pop-body">{C.removeConfirmBody}</div>
      <div className="gr__pop-buttons">
        <Button variant="quiet" size="sm" block onClick={onCancel}>
          {C.cancel}
        </Button>
        <Button variant="danger" size="sm" block onClick={onConfirm}>
          {C.removeConfirm}
        </Button>
      </div>
    </div>
  );
}

// The admin's per-member remove control: a kebab that reveals "Remove from group",
// then the confirm popover. Only an admin sees this, and never on their own row.
// Mirrors the contact-row remove menu + confirm.
export function RemoveControl({ onRemove }: { onRemove: () => void }) {
  const [step, setStep] = useState<"closed" | "menu" | "confirm">("closed");
  return (
    <div className="gr__pop-anchor">
      <button
        type="button"
        aria-label={C.memberMenu}
        aria-expanded={step !== "closed"}
        onClick={() => setStep(step === "closed" ? "menu" : "closed")}
        className="gr__iconbtn"
      >
        <Dots size={18} />
      </button>
      {step === "menu" && (
        <div className="gr__pop gr__pop--menu">
          <Button
            variant="quiet"
            size="sm"
            block
            onClick={() => setStep("confirm")}
          >
            {C.removeCta}
          </Button>
        </div>
      )}
      {step === "confirm" && (
        <RemoveConfirm
          onCancel={() => setStep("closed")}
          onConfirm={() => {
            setStep("closed");
            onRemove();
          }}
        />
      )}
    </div>
  );
}

export interface AdminControlsProps {
  group: GroupRecord;
  onCreateInvite: (groupId: string) => Promise<string>;
  onRevokeInvite: (groupId: string, inviteId: string) => void;
  onReviewRequests: (groupId: string) => Promise<PendingRequest[]>;
  onApproveRequest: (groupId: string, request: PendingRequest) => Promise<void>;
  onRejectRequest: (groupId: string, request: PendingRequest) => Promise<void>;
}

// The admin controls under the roster: the invite link + pending invites, and, for a
// public group, the contentless join-request review. Rendered only for an admin.
export function AdminControls({
  group,
  onCreateInvite,
  onRevokeInvite,
  onReviewRequests,
  onApproveRequest,
  onRejectRequest,
}: AdminControlsProps) {
  return (
    <>
      <GroupInviteShare
        group={group}
        onCreateInvite={onCreateInvite}
        onRevokeInvite={onRevokeInvite}
      />
      {group.visibility === "public" && (
        <GroupRequestsReview
          group={group}
          onReview={onReviewRequests}
          onApprove={onApproveRequest}
          onReject={onRejectRequest}
        />
      )}
    </>
  );
}
