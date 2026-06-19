// Approvals queue. Faithful port of comps-reference/app/circles.jsx
// CircleApprovals. Copy verbatim from copy.js `circles`.
import { useState } from "react";
import { Button, Card, Avatar } from "../../design/components/index.ts";
import { Lock, Shield, Info } from "../../design/icons.tsx";
import { avatarFor } from "../../lib/avatars.ts";
import { makeCircleFixture, circleById } from "./shared.tsx";
import type { Circle, CircleRequest } from "./shared.tsx";

const COPY = {
  approvalsTitle: "Approvals",
  approve: "Approve",
  deny: "Decline",
  approvalsEmpty: "No pending requests",
  declined: "Declined",
  declinedNote:
    "Declined requests can’t reach you again for a while, a built-in cooldown so no one can re-ask on repeat.",
  rateLimitNote:
    "Join requests are rate-limited per person, so the queue can’t be flooded.",
} as const;

interface RequestRowProps {
  request: CircleRequest;
  onDecide: (handle: string, ok: boolean) => void;
}

function RequestRow({ request: r, onDecide }: RequestRowProps) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: 10,
        opacity: r.declined ? 0.6 : 1,
      }}
    >
      <Avatar alt={r.handle} src={avatarFor(r.handle)} size="md" />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 15,
            fontWeight: 600,
            color: "var(--text-strong)",
          }}
        >
          @{r.handle}
        </div>
        <div style={{ fontSize: 12, color: "var(--text-subtle)" }}>
          {r.when}
        </div>
      </div>
      {r.declined ? (
        <span
          style={{
            fontSize: 12.5,
            fontWeight: 600,
            color: "var(--text-subtle)",
            display: "inline-flex",
            alignItems: "center",
            gap: 5,
          }}
        >
          <Lock size={13} /> {COPY.declined}
        </span>
      ) : (
        <div style={{ display: "flex", gap: 6 }}>
          <Button
            variant="quiet"
            size="sm"
            onClick={() => {
              onDecide(r.handle, false);
            }}
          >
            {COPY.deny}
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => {
              onDecide(r.handle, true);
            }}
          >
            {COPY.approve}
          </Button>
        </div>
      )}
    </div>
  );
}

export interface CircleApprovalsProps {
  circle?: Circle;
}

export function CircleApprovals({ circle }: CircleApprovalsProps) {
  const [g, setG] = useState<Circle>(
    () => circle ?? circleById(makeCircleFixture(), "sol"),
  );

  const decide = (handle: string, ok: boolean) => {
    setG((prev) => {
      if (ok) {
        return {
          ...prev,
          requests: prev.requests.filter((r) => r.handle !== handle),
          members: [
            ...prev.members,
            { handle, status: "gray", role: "member" },
          ],
        };
      }
      // Sticky decline + rate-limit: the request stays declined rather than
      // vanishing, and the requester is cooled-down from re-asking.
      return {
        ...prev,
        requests: prev.requests.map((r) =>
          r.handle === handle ? { ...r, declined: true } : r,
        ),
      };
    });
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 16,
        width: "100%",
        maxWidth: 390,
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
          {COPY.approvalsTitle}
        </h1>
        <div
          style={{ fontSize: 13.5, color: "var(--text-muted)", marginTop: 4 }}
        >
          {g.name}
        </div>
      </div>
      {g.requests.length === 0 ? (
        <Card
          variant="flat"
          style={{
            textAlign: "center",
            padding: "30px 20px",
            color: "var(--text-muted)",
            fontSize: 14,
          }}
        >
          {COPY.approvalsEmpty}
        </Card>
      ) : (
        <Card
          variant="flat"
          style={{ padding: 6, display: "flex", flexDirection: "column" }}
        >
          {g.requests.map((r) => (
            <RequestRow key={r.handle} request={r} onDecide={decide} />
          ))}
        </Card>
      )}
      <Card variant="flat" style={{ display: "flex", gap: 12 }}>
        <span
          style={{ color: "var(--text-accent)", flex: "none", marginTop: 1 }}
        >
          <Shield size={17} />
        </span>
        <div
          style={{
            fontSize: 12.5,
            lineHeight: 1.55,
            color: "var(--text-body)",
          }}
        >
          {COPY.declinedNote} {COPY.rateLimitNote}
        </div>
      </Card>
      <Card variant="tint" style={{ display: "flex", gap: 12 }}>
        <span
          style={{ color: "var(--text-accent)", flex: "none", marginTop: 1 }}
        >
          <Info size={17} />
        </span>
        <div
          style={{ fontSize: 13, lineHeight: 1.55, color: "var(--text-body)" }}
        >
          New members start gray until they share. You only ever see their
          status, never their results.
        </div>
      </Card>
    </div>
  );
}
