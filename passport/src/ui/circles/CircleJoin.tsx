// Join flow: invite -> request -> waiting -> consent -> in. Faithful port of
// comps-reference/app/circles.jsx CircleJoin. Copy verbatim from copy.js
// `circles`.
import { useEffect, useState } from "react";
import { Button, Card, Avatar } from "../../design/components/index.ts";
import { Calendar, Clock, Check, Lock } from "../../design/icons.tsx";
import { avatarFor } from "../../lib/avatars.ts";
import {
  makeCircleFixture,
  circleById,
  MemberDot,
  sectionLbl,
} from "./shared.tsx";

const COPY = {
  joinTitle: "You’re invited",
  joinShares: "What you’ll share",
  joinSharesBody:
    "Your overall status only. Never your results, never what you tested for.",
  joinCta: "Request to join",
  waiting: "Waiting for approval",
  waitingSub: "An organizer will let you in.",
  approvedTitle: "You’re approved",
  consentTitle: "Share my status with this circle",
  consentBody: "Your light joins the roster. Stop sharing or leave anytime.",
  consentCta: "Share and join",
  eventChip: "Event",
  members: "members",
  approvalNote: "Joining always needs host approval.",
} as const;

export type JoinStep = "invite" | "waiting" | "consent";

function WaitingStep({ circleName }: { circleName: string }) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        textAlign: "center",
        gap: 16,
        paddingTop: 56,
        width: "100%",
        maxWidth: 390,
      }}
    >
      <span
        style={{
          width: 76,
          height: 76,
          borderRadius: "50%",
          background: "var(--accent-soft)",
          color: "var(--text-accent)",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Clock size={36} />
      </span>
      <h1
        style={{
          fontSize: 23,
          fontWeight: 800,
          letterSpacing: "-0.02em",
          color: "var(--text-strong)",
        }}
      >
        {COPY.waiting}
      </h1>
      <p
        style={{
          fontSize: 14.5,
          color: "var(--text-muted)",
          margin: 0,
          maxWidth: 260,
          lineHeight: 1.55,
        }}
      >
        {COPY.waitingSub}
      </p>
      <span style={{ fontSize: 12, color: "var(--text-subtle)" }}>
        Request sent to {circleName}
      </span>
    </div>
  );
}

interface ConsentStepProps {
  onJoin?: (() => void) | undefined;
  onNotNow?: (() => void) | undefined;
}

function ConsentStep({ onJoin, onNotNow }: ConsentStepProps) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 18,
        paddingTop: 24,
        width: "100%",
        maxWidth: 390,
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          textAlign: "center",
          gap: 12,
        }}
      >
        <span
          style={{
            width: 72,
            height: 72,
            borderRadius: "50%",
            background: "var(--status-clear-bg)",
            color: "var(--status-clear-base)",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Check size={34} />
        </span>
        <h1
          style={{
            fontSize: 23,
            fontWeight: 800,
            letterSpacing: "-0.02em",
            color: "var(--text-strong)",
          }}
        >
          {COPY.approvedTitle}
        </h1>
      </div>
      <Card style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div
          style={{
            fontSize: 16,
            fontWeight: 700,
            color: "var(--text-strong)",
          }}
        >
          {COPY.consentTitle}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Avatar alt="robin" src={avatarFor("robin")} size="sm" />
          <MemberDot tone="blue" />
        </div>
        <div
          style={{
            fontSize: 13.5,
            color: "var(--text-muted)",
            lineHeight: 1.5,
          }}
        >
          {COPY.consentBody}
        </div>
      </Card>
      <Button variant="primary" size="lg" block onClick={onJoin}>
        {COPY.consentCta}
      </Button>
      <Button variant="ghost" size="md" block onClick={onNotNow}>
        Not now
      </Button>
    </div>
  );
}

interface InviteStepProps {
  circle: ReturnType<typeof circleById>;
  onRequest: () => void;
}

function InviteStep({ circle: g, onRequest }: InviteStepProps) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 18,
        width: "100%",
        maxWidth: 390,
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          textAlign: "center",
          gap: 10,
          paddingTop: 8,
        }}
      >
        <span
          style={{
            width: 64,
            height: 64,
            borderRadius: "var(--radius-md)",
            background: "var(--accent-soft)",
            color: "var(--text-accent)",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Calendar size={30} />
        </span>
        <div
          style={{
            fontSize: 11,
            fontWeight: 800,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: "var(--text-accent)",
          }}
        >
          {COPY.joinTitle}
        </div>
        <h1
          style={{
            fontSize: 26,
            fontWeight: 800,
            letterSpacing: "-0.02em",
            color: "var(--text-strong)",
          }}
        >
          {g.name}
        </h1>
        <div style={{ fontSize: 13.5, color: "var(--text-muted)" }}>
          {COPY.eventChip} · {g.date} · {g.members.length} {COPY.members}
        </div>
      </div>

      <Card
        variant="tint"
        style={{ display: "flex", flexDirection: "column", gap: 8 }}
      >
        <div style={{ ...sectionLbl, color: "var(--text-accent)" }}>
          {COPY.joinShares}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <MemberDot tone="blue" size="lg" />
        </div>
        <div
          style={{
            fontSize: 13.5,
            color: "var(--text-body)",
            lineHeight: 1.55,
          }}
        >
          {COPY.joinSharesBody}
        </div>
      </Card>

      <Button variant="primary" size="lg" block onClick={onRequest}>
        {COPY.joinCta}
      </Button>
      <div
        style={{
          fontSize: 12.5,
          color: "var(--text-subtle)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 6,
        }}
      >
        <Lock size={13} /> {COPY.approvalNote}
      </div>
    </div>
  );
}

export interface CircleJoinProps {
  initialStep?: JoinStep;
  /** Auto-advance waiting -> consent after a beat (the live demo flow). The
   *  waiting story turns this off so its capture is deterministic. */
  autoAdvance?: boolean;
  onJoin?: (() => void) | undefined;
  onNotNow?: (() => void) | undefined;
}

export function CircleJoin({
  initialStep = "invite",
  autoAdvance = true,
  onJoin,
  onNotNow,
}: CircleJoinProps) {
  const [step, setStep] = useState<JoinStep>(initialStep);
  const g = circleById(makeCircleFixture(), "sol");

  useEffect(() => {
    if (step !== "waiting" || !autoAdvance) return;
    const id = setTimeout(() => setStep("consent"), 2600);
    return () => clearTimeout(id);
  }, [step, autoAdvance]);

  if (step === "waiting") {
    return <WaitingStep circleName={g.name} />;
  }

  if (step === "consent") {
    return <ConsentStep onJoin={onJoin} onNotNow={onNotNow} />;
  }

  return <InviteStep circle={g} onRequest={() => setStep("waiting")} />;
}
