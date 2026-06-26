// Circles list: the owner's private circles, each a named grouping of contacts.
// A circle shows a roster of per-member status once it has five or more members.
import { Button, Card } from "../../design/components/index.ts";
import {
  Plus,
  Chevron,
  Lock,
  Circles as CirclesIcon,
} from "../../design/icons.tsx";
import type { CircleRecord } from "../../store/accountBlob.ts";

const COPY = {
  title: "Circles",
  create: "Create",
  sub: "Private groups. Everyone shares their own status, so the group can look out for each other.",
  empty: "No circles yet. Create one for a group, a household, or an event.",
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
  circle: CircleRecord;
  onOpenCircle?: ((id: string) => void) | undefined;
}

function CircleRow({ circle, onOpenCircle }: CircleRowProps) {
  return (
    <Card
      pad="sm"
      variant="interactive"
      onClick={() => onOpenCircle?.(circle.id)}
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
        <CirclesIcon size={21} />
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
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
          {circle.name}
        </div>
        <div
          style={{
            fontSize: 12.5,
            color: "var(--text-muted)",
            marginTop: 3,
          }}
        >
          {circle.memberContactIds.length} {COPY.members}
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
  circles: CircleRecord[];
  onCreate?: (() => void) | undefined;
  onOpenCircle?: ((id: string) => void) | undefined;
}

export function CirclesList({
  circles,
  onCreate,
  onOpenCircle,
}: CirclesListProps) {
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
          {circles.map((c) => (
            <CircleRow key={c.id} circle={c} onOpenCircle={onOpenCircle} />
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
          Circles only ever show each person&rsquo;s overall status. Nobody sees
          results or conditions.
        </div>
      </Card>
    </div>
  );
}
