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

const popover = {
  position: "absolute" as const,
  right: 0,
  top: "calc(100% - 2px)",
  zIndex: 5,
  background: "var(--surface-card)",
  borderRadius: "var(--radius-md)",
  boxShadow: "var(--shadow-lg)",
};

// The confirm popover: says plainly what removal does and that they are not told why.
function RemoveConfirm({
  onCancel,
  onConfirm,
}: {
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div
      style={{
        ...popover,
        border: "1px solid var(--expired-100)",
        padding: 12,
        width: 260,
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}
    >
      <div
        style={{ fontSize: 14.5, fontWeight: 700, color: "var(--text-strong)" }}
      >
        {C.removeConfirmTitle}
      </div>
      <div
        style={{ fontSize: 13, color: "var(--text-muted)", lineHeight: 1.5 }}
      >
        {C.removeConfirmBody}
      </div>
      <div style={{ display: "flex", gap: 8 }}>
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
    <div style={{ position: "relative", flex: "none" }}>
      <button
        type="button"
        aria-label={C.memberMenu}
        aria-expanded={step !== "closed"}
        onClick={() => setStep(step === "closed" ? "menu" : "closed")}
        style={{
          appearance: "none",
          border: "none",
          background: "transparent",
          cursor: "pointer",
          width: 32,
          height: 32,
          borderRadius: "50%",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          color: "var(--text-subtle)",
        }}
      >
        <Dots size={18} />
      </button>
      {step === "menu" && (
        <div style={{ ...popover, padding: 6, minWidth: 190 }}>
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
