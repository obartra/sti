// Circles & events list. Faithful port of comps-reference/app/circles.jsx
// CirclesList. Copy verbatim from copy.js `circles`.
import { useState } from "react";
import { Button, Card } from "../../design/components/index.ts";
import {
  Plus,
  Calendar,
  Chevron,
  Lock,
  Circles as CirclesIcon,
} from "../../design/icons.tsx";
import { makeCircleFixture, RoleBadge } from "./shared.tsx";
import type { Circle } from "./shared.tsx";

const COPY = {
  title: "Circles",
  create: "Create",
  sub: "Private groups and dated events. Everyone shares their own status, so the group can look out for each other.",
  empty: "No circles yet. Create one for your crew, your house, or a night.",
  eventChip: "Event",
  circleChip: "Circle",
  members: "members",
} as const;

interface EmptyStateProps {
  onCreate?: (() => void) | undefined;
}

function EmptyState({ onCreate }: EmptyStateProps) {
  return (
    <Card
      variant="flat"
      style={{
        textAlign: "center",
        padding: "34px 24px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 12,
      }}
    >
      <span
        style={{
          width: 56,
          height: 56,
          borderRadius: "50%",
          background: "var(--accent-soft)",
          color: "var(--text-accent)",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <CirclesIcon size={28} />
      </span>
      <div
        style={{
          fontSize: 14,
          color: "var(--text-muted)",
          lineHeight: 1.55,
          maxWidth: 260,
        }}
      >
        {COPY.empty}
      </div>
      <Button
        variant="secondary"
        size="md"
        icon={<Plus size={16} />}
        onClick={onCreate}
      >
        {COPY.create}
      </Button>
    </Card>
  );
}

interface CircleRowProps {
  circle: Circle;
  onOpenCircle?: ((id: string) => void) | undefined;
}

function CircleRow({ circle: g, onOpenCircle }: CircleRowProps) {
  const pending = g.requests.filter((r) => !r.declined).length;
  return (
    <Card
      pad="sm"
      variant="interactive"
      onClick={() => onOpenCircle?.(g.id)}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 13,
        cursor: "pointer",
      }}
    >
      <span
        style={{
          flex: "none",
          width: 44,
          height: 44,
          borderRadius: "var(--radius-sm)",
          background: "var(--accent-soft)",
          color: "var(--text-accent)",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {g.type === "event" ? (
          <Calendar size={21} />
        ) : (
          <CirclesIcon size={21} />
        )}
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            minWidth: 0,
          }}
        >
          <span
            style={{
              fontSize: 15.5,
              fontWeight: 700,
              color: "var(--text-strong)",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
              minWidth: 0,
            }}
          >
            {g.name}
          </span>
          <RoleBadge role={g.role} />
        </div>
        <div
          style={{
            fontSize: 12.5,
            color: "var(--text-muted)",
            marginTop: 3,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {g.type === "event"
            ? `${COPY.eventChip} · ${g.date}`
            : COPY.circleChip}{" "}
          · {g.members.length} {COPY.members}
          {pending > 0 ? ` · ${pending} pending` : ""}
        </div>
      </div>
      <Chevron
        size={20}
        style={{ color: "var(--text-subtle)", flex: "none" }}
      />
    </Card>
  );
}

export interface CirclesListProps {
  initialCircles?: Circle[];
  onCreate?: (() => void) | undefined;
  onOpenCircle?: ((id: string) => void) | undefined;
}

export function CirclesList({
  initialCircles,
  onCreate,
  onOpenCircle,
}: CirclesListProps) {
  const [circles] = useState<Circle[]>(
    () => initialCircles ?? makeCircleFixture().circles,
  );

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
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <h1
          style={{
            fontSize: 26,
            fontWeight: 800,
            letterSpacing: "-0.02em",
            color: "var(--text-strong)",
          }}
        >
          {COPY.title}
        </h1>
        <Button
          variant="primary"
          size="sm"
          icon={<Plus size={16} />}
          onClick={onCreate}
        >
          {COPY.create}
        </Button>
      </div>
      <p
        style={{
          fontSize: 14,
          lineHeight: 1.55,
          color: "var(--text-body)",
          margin: 0,
        }}
      >
        {COPY.sub}
      </p>

      {circles.length === 0 ? (
        <EmptyState onCreate={onCreate} />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {circles.map((g) => (
            <CircleRow key={g.id} circle={g} onOpenCircle={onOpenCircle} />
          ))}
        </div>
      )}

      <Card variant="tint" style={{ display: "flex", gap: 12 }}>
        <span
          style={{ color: "var(--text-accent)", flex: "none", marginTop: 1 }}
        >
          <Lock size={17} />
        </span>
        <div
          style={{ fontSize: 13, lineHeight: 1.55, color: "var(--text-body)" }}
        >
          Circles only ever show each person&rsquo;s overall status. Nobody,
          including organizers, sees results or conditions.
        </div>
      </Card>
    </div>
  );
}
