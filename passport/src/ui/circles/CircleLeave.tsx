// Leave / revoke: confirm leaving a circle, with the option to stop sharing
// instead or stay.
//
// Faithful port of comps-reference/app/circles2.jsx CircleLeave. Copy verbatim
// from copy.js `circles`.
import { useState } from "react";
import { Button, Card } from "../../design/components/index.ts";
import { Check, EyeOff } from "../../design/icons.tsx";
import { makeCircleFixture, circleById } from "./shared.tsx";
import type { Circle } from "./shared.tsx";

const COPY = {
  leaveTitle: "Leave this circle?",
  leaveRemoves: [
    "Your status disappears from the roster right away.",
    "Sharing with this circle stops. Nothing else changes.",
  ],
  leaveCta: "Leave circle",
  leaveStay: "Stay",
  stopShare: "Stop sharing instead",
} as const;

export interface CircleLeaveProps {
  circle?: Circle;
  onLeave?: (() => void) | undefined;
  onStopShare?: (() => void) | undefined;
  onStay?: (() => void) | undefined;
}

export function CircleLeave({
  circle,
  onLeave,
  onStopShare,
  onStay,
}: CircleLeaveProps) {
  const [g] = useState<Circle>(
    () => circle ?? circleById(makeCircleFixture(), "thu"),
  );

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 18,
        paddingTop: 12,
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
            width: 68,
            height: 68,
            borderRadius: "50%",
            background: "var(--surface-sunken)",
            color: "var(--text-muted)",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <EyeOff size={30} />
        </span>
        <h1
          style={{
            fontSize: 23,
            fontWeight: 800,
            letterSpacing: "-0.02em",
            color: "var(--text-strong)",
          }}
        >
          {COPY.leaveTitle}
        </h1>
        <div style={{ fontSize: 13.5, color: "var(--text-muted)" }}>
          {g.name}
        </div>
      </div>

      <Card
        variant="flat"
        style={{ display: "flex", flexDirection: "column", gap: 12 }}
      >
        {COPY.leaveRemoves.map((r, i) => (
          <div
            key={i}
            style={{ display: "flex", gap: 10, alignItems: "flex-start" }}
          >
            <span
              style={{
                color: "var(--text-accent)",
                flex: "none",
                marginTop: 1,
              }}
            >
              <Check size={16} />
            </span>
            <span
              style={{
                fontSize: 14,
                color: "var(--text-body)",
                lineHeight: 1.5,
              }}
            >
              {r}
            </span>
          </div>
        ))}
      </Card>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <Button variant="danger" size="lg" block onClick={() => onLeave?.()}>
          {COPY.leaveCta}
        </Button>
        <Button
          variant="secondary"
          size="md"
          block
          icon={<EyeOff size={16} />}
          onClick={() => onStopShare?.()}
        >
          {COPY.stopShare}
        </Button>
        <Button variant="ghost" size="md" block onClick={() => onStay?.()}>
          {COPY.leaveStay}
        </Button>
      </div>
    </div>
  );
}
