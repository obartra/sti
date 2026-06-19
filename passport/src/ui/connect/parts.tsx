import type { CSSProperties, ReactNode } from "react";
import { Button, Card, Avatar } from "../../design/components/index.ts";
import { Check, Chevron, Lock, StarFill } from "../../design/icons.tsx";
import { avatarFor } from "../../lib/avatars.ts";
import type { PendingLinkup } from "./Connect.tsx";
import { COPY } from "./copy.ts";

export { COPY };

const sectionLbl: CSSProperties = {
  fontSize: 12,
  fontWeight: 700,
  letterSpacing: "0.06em",
  textTransform: "uppercase",
  color: "var(--text-subtle)",
};

// Consistent section header: uppercase eyebrow + optional soft count chip +
// optional one-line sub. Keeps Waiting / Faves / Recent on one visual rhythm.
export function SectionHead({
  title,
  count,
  sub,
}: {
  title: string;
  count?: ReactNode;
  sub?: string;
}) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={sectionLbl}>{title}</span>
        {count != null && (
          <span
            style={{
              flex: "none",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              minWidth: 20,
              height: 20,
              padding: "0 7px",
              borderRadius: "var(--radius-pill)",
              background: "var(--accent-soft)",
              color: "var(--text-accent)",
              fontSize: 11.5,
              fontWeight: 800,
            }}
          >
            {count}
          </span>
        )}
      </div>
      {sub && (
        <div
          style={{
            fontSize: 12.5,
            color: "var(--text-subtle)",
            marginTop: 4,
            lineHeight: 1.45,
          }}
        >
          {sub}
        </div>
      )}
    </div>
  );
}

export const menuItem = (color: string): CSSProperties => ({
  appearance: "none",
  border: "none",
  background: "transparent",
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  gap: 9,
  width: "100%",
  textAlign: "left",
  padding: "9px 10px",
  borderRadius: 8,
  font: "inherit",
  fontSize: 13.5,
  fontWeight: 600,
  color,
});

export function HandleAvatar({
  handle,
  size = "md",
}: {
  handle: string;
  size?: "sm" | "md" | "lg";
}) {
  const name = handle.replace(/[^a-z]/gi, " ").trim() || handle;
  return (
    <Avatar initials={name} alt={name} src={avatarFor(handle)} size={size} />
  );
}

// A scan/share discovery tile.
export function DiscoverTile({
  icon,
  title,
  sub,
  onClick,
}: {
  icon: ReactNode;
  title: string;
  sub: string;
  onClick?: (() => void) | undefined;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        appearance: "none",
        border: "none",
        cursor: "pointer",
        textAlign: "left",
        width: "100%",
        background: "var(--surface-card)",
        boxShadow: "var(--shadow-md)",
        borderRadius: "var(--radius-lg)",
        padding: 16,
        display: "flex",
        alignItems: "center",
        gap: 13,
        font: "inherit",
      }}
    >
      <span
        style={{
          flex: "none",
          width: 44,
          height: 44,
          borderRadius: "var(--radius-md)",
          background: "var(--accent-soft)",
          color: "var(--text-accent)",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {icon}
      </span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span
          style={{
            display: "block",
            fontSize: 15,
            fontWeight: 700,
            color: "var(--text-strong)",
          }}
        >
          {title}
        </span>
        <span
          style={{
            display: "block",
            fontSize: 12.5,
            color: "var(--text-muted)",
            lineHeight: 1.4,
            marginTop: 2,
          }}
        >
          {sub}
        </span>
      </span>
      <span style={{ color: "var(--text-subtle)", flex: "none" }}>
        <Chevron size={18} />
      </span>
    </button>
  );
}

// "Waiting on you" = the recipient side of a scan: someone you scanned proposed
// a link; you confirm to bind. NOT a stranger request.
export function PendingSection({
  pending,
  onConfirm,
  onDismiss,
}: {
  pending: PendingLinkup[];
  onConfirm: (handle: string) => void;
  onDismiss: (handle: string) => void;
}) {
  return (
    <div>
      <SectionHead
        title={COPY.waitingTitle}
        count={pending.length}
        sub={COPY.waitingSub}
      />
      <Card
        variant="flat"
        style={{ padding: 4, display: "flex", flexDirection: "column" }}
      >
        {pending.map((sg) => (
          <div
            key={sg.handle}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 11,
              padding: "7px 6px",
            }}
          >
            <HandleAvatar handle={sg.handle} size="sm" />
            <div style={{ flex: 1, minWidth: 0 }}>
              <span
                style={{
                  fontSize: 14,
                  fontWeight: 600,
                  color: "var(--text-strong)",
                }}
              >
                @{sg.handle}
              </span>
              <span
                style={{
                  fontSize: 12,
                  color: "var(--text-subtle)",
                  marginLeft: 8,
                }}
              >
                {COPY.scannedAgo} · {sg.when}
              </span>
            </div>
            <div style={{ display: "flex", gap: 6, flex: "none" }}>
              <Button
                variant="quiet"
                size="sm"
                onClick={() => onDismiss(sg.handle)}
              >
                {COPY.suggestDismiss}
              </Button>
              <Button
                variant="secondary"
                size="sm"
                icon={<Check size={15} />}
                onClick={() => onConfirm(sg.handle)}
              >
                {COPY.suggestAdd}
              </Button>
            </div>
          </div>
        ))}
      </Card>
    </div>
  );
}

// Faves, starred people, capped at nine.
export function FavesSection({
  faves,
  favesFullNote,
  onToggleFave,
}: {
  faves: string[];
  favesFullNote: boolean;
  onToggleFave: (handle: string) => void;
}) {
  return (
    <div>
      <SectionHead
        title={COPY.favesTitle}
        count={`${faves.length}/9`}
        sub={COPY.favesSub}
      />
      <Card
        variant="flat"
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 8,
          padding: faves.length ? 12 : 16,
        }}
      >
        {faves.map((h) => (
          <span
            key={h}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 7,
              padding: "5px 9px 5px 5px",
              borderRadius: "var(--radius-pill)",
              background: "var(--surface-app)",
              boxShadow: "var(--shadow-sm)",
            }}
          >
            <HandleAvatar handle={h} size="sm" />
            <span
              style={{
                fontSize: 13,
                fontWeight: 600,
                color: "var(--text-strong)",
              }}
            >
              @{h}
            </span>
            <button
              type="button"
              aria-label={`Unstar ${h}`}
              onClick={() => onToggleFave(h)}
              style={{
                appearance: "none",
                border: "none",
                background: "transparent",
                cursor: "pointer",
                padding: 2,
                display: "inline-flex",
                color: "var(--status-treat-base)",
              }}
            >
              <StarFill size={15} />
            </button>
          </span>
        ))}
        {faves.length === 0 && (
          <span
            style={{
              fontSize: 13,
              color: "var(--text-muted)",
              lineHeight: 1.45,
            }}
          >
            {COPY.favesEmpty}
          </span>
        )}
      </Card>
      {favesFullNote && (
        <div
          style={{
            fontSize: 12.5,
            color: "var(--status-treat-fg)",
            marginTop: 8,
          }}
        >
          {COPY.favesFull}
        </div>
      )}
    </div>
  );
}

// Privacy promise: no directory, member-initiated only.
export function PrivacySection() {
  return (
    <Card
      variant="tint"
      style={{ display: "flex", flexDirection: "column", gap: 12 }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          color: "var(--text-accent)",
          fontSize: 13,
          fontWeight: 700,
        }}
      >
        <Lock size={15} /> {COPY.privacyTitle}
      </div>
      {COPY.privacy.map((p, i) => (
        <div
          key={i}
          style={{ display: "flex", gap: 9, alignItems: "flex-start" }}
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
              fontSize: 13.5,
              color: "var(--text-body)",
              lineHeight: 1.5,
            }}
          >
            {p}
          </span>
        </div>
      ))}
    </Card>
  );
}
