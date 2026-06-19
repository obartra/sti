// Role-based controls and the inline invite / share-event panels for
// CircleDetail. Split out of CircleDetail.parts.tsx to keep both files within
// the file-length ceiling. Not a public surface: only CircleDetail.tsx imports
// the Controls wrapper from here.
import { Button, Card } from "../../design/components/index.ts";
import {
  Check,
  Lock,
  QrCode,
  Copy,
  Refresh,
  UserPlus,
  Share,
  Settings,
} from "../../design/icons.tsx";
import { COPY } from "./CircleDetail.parts.tsx";
import type { Circle } from "./shared.tsx";

interface GateButtonsProps {
  pendingCount: number;
  onInviteToggle: () => void;
  onApprovals?: (() => void) | undefined;
}

function GateButtons({
  pendingCount,
  onInviteToggle,
  onApprovals,
}: GateButtonsProps) {
  return (
    <div style={{ display: "flex", gap: 10 }}>
      <Button
        variant="primary"
        size="md"
        block
        icon={<UserPlus size={16} />}
        onClick={onInviteToggle}
      >
        {COPY.invite}
      </Button>
      <Button
        variant="secondary"
        size="md"
        block
        icon={<Check size={16} />}
        onClick={() => onApprovals?.()}
      >
        {COPY.approvalsTitle}
        {pendingCount ? ` · ${pendingCount}` : ""}
      </Button>
    </div>
  );
}

interface InvitePanelProps {
  inviteCode: string;
  onNewCode: () => void;
}

function InvitePanel({ inviteCode, onNewCode }: InvitePanelProps) {
  return (
    <Card style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div
        style={{
          fontSize: 15,
          fontWeight: 700,
          color: "var(--text-strong)",
        }}
      >
        {COPY.inviteTitle}
      </div>
      <div
        style={{
          fontSize: 13,
          color: "var(--text-muted)",
          lineHeight: 1.5,
        }}
      >
        {COPY.inviteSub}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <QrCode
          size={44}
          style={{ color: "var(--text-accent)", flex: "none" }}
        />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 13.5,
              color: "var(--text-strong)",
            }}
          >
            sti.care/c/{inviteCode}
          </div>
          <div
            style={{
              fontSize: 12,
              color: "var(--text-subtle)",
              marginTop: 2,
            }}
          >
            Code {inviteCode} · works as link or QR
          </div>
        </div>
        <Button variant="secondary" size="sm" icon={<Copy size={14} />}>
          Copy
        </Button>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <Button
          variant="quiet"
          size="sm"
          icon={<Refresh size={14} />}
          onClick={onNewCode}
        >
          {COPY.inviteNew}
        </Button>
        <span
          style={{
            fontSize: 12,
            color: "var(--text-subtle)",
            lineHeight: 1.4,
          }}
        >
          {COPY.inviteNewSub}
        </span>
      </div>
      <div
        style={{
          fontSize: 12.5,
          color: "var(--text-subtle)",
          display: "flex",
          alignItems: "center",
          gap: 6,
        }}
      >
        <Lock size={13} /> {COPY.approvalNote}
      </div>
    </Card>
  );
}

function ShareEventPanel({ inviteCode }: { inviteCode: string }) {
  return (
    <Card style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div
        style={{
          fontSize: 15,
          fontWeight: 700,
          color: "var(--text-strong)",
        }}
      >
        {COPY.shareEvent}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <QrCode
          size={44}
          style={{ color: "var(--text-accent)", flex: "none" }}
        />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 13.5,
              color: "var(--text-strong)",
            }}
          >
            sti.care/c/{inviteCode}
          </div>
          <div
            style={{
              fontSize: 12,
              color: "var(--text-subtle)",
              marginTop: 2,
            }}
          >
            Works as link or QR
          </div>
        </div>
        <Button variant="secondary" size="sm" icon={<Copy size={14} />}>
          Copy
        </Button>
      </div>
      <div
        style={{
          fontSize: 12.5,
          color: "var(--text-subtle)",
          display: "flex",
          alignItems: "center",
          gap: 6,
        }}
      >
        <Lock size={13} /> {COPY.approvalNote}
      </div>
    </Card>
  );
}

export interface ControlsProps {
  circle: Circle;
  inviteOpen: boolean;
  inviteCode: string;
  pendingCount: number;
  onInviteToggle: () => void;
  onNewCode: () => void;
  onApprovals?: (() => void) | undefined;
  onManage?: (() => void) | undefined;
  onLeave?: (() => void) | undefined;
}

export function Controls({
  circle: g,
  inviteOpen,
  inviteCode,
  pendingCount,
  onInviteToggle,
  onNewCode,
  onApprovals,
  onManage,
  onLeave,
}: ControlsProps) {
  const canGate = g.role === "organizer";
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {canGate && (
        <GateButtons
          pendingCount={pendingCount}
          onInviteToggle={onInviteToggle}
          onApprovals={onApprovals}
        />
      )}
      {inviteOpen && canGate && (
        <InvitePanel inviteCode={inviteCode} onNewCode={onNewCode} />
      )}
      {/* events: anyone can share the invite link; only editors rotate it */}
      {g.type === "event" && !canGate && (
        <Button
          variant="secondary"
          size="md"
          block
          icon={<Share size={16} />}
          onClick={onInviteToggle}
        >
          {COPY.shareEvent}
        </Button>
      )}
      {inviteOpen && !canGate && <ShareEventPanel inviteCode={inviteCode} />}
      {g.role === "organizer" && (
        <Button
          variant="quiet"
          size="md"
          block
          icon={<Settings size={16} />}
          onClick={() => onManage?.()}
        >
          {COPY.manage}
        </Button>
      )}
      <Button
        variant="ghost"
        size="md"
        block
        onClick={() => onLeave?.()}
        style={{ color: "var(--status-expired-fg)" }}
      >
        {COPY.leave}
      </Button>
    </div>
  );
}
