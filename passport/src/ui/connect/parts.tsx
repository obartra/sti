import type { CSSProperties, ReactNode } from "react";
import { Card, Avatar } from "../../design/components/index.ts";
import { Check, Chevron, Lock, StarFill } from "../../design/icons.tsx";
import { avatarFor } from "../../lib/avatars.ts";
import type { ContactRecord } from "../../store/accountBlob.ts";
import { COPY } from "./copy.ts";

export { COPY };

const sectionLbl: CSSProperties = {
  fontSize: 12,
  fontWeight: 700,
  letterSpacing: "0.06em",
  textTransform: "uppercase",
  color: "var(--text-subtle)",
};

// The owner's private label for a contact, or a neutral fallback. There is no
// cross-account handle to show (unlinkability), so a contact is named only by the
// nickname the owner gave it.
export function contactName(contact: ContactRecord): string {
  return contact.label.trim() === "" ? "Contact" : contact.label;
}

// Consistent section header: uppercase eyebrow + optional soft count chip +
// optional one-line sub. Keeps Faves / Recent on one visual rhythm.
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

export function ContactAvatar({
  contact,
  size = "md",
}: {
  contact: ContactRecord;
  size?: "sm" | "md" | "lg";
}) {
  const name = contactName(contact);
  return (
    <Avatar
      initials={name}
      alt={name}
      src={avatarFor(contact.id)}
      size={size}
    />
  );
}

// Handle-seeded avatar, still used by the scan / in-person linkup screens (their
// partner identity comes from the slice-7 device flow, not a stored contact).
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

// Faves: the starred contacts, pinned to the top.
export function FavesSection({
  faves,
  onToggleFave,
}: {
  faves: ContactRecord[];
  onToggleFave: (contactId: string) => void;
}) {
  return (
    <div>
      <SectionHead
        title={COPY.favesTitle}
        count={faves.length}
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
        {faves.map((c) => (
          <span
            key={c.id}
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
            <ContactAvatar contact={c} size="sm" />
            <span
              style={{
                fontSize: 13,
                fontWeight: 600,
                color: "var(--text-strong)",
              }}
            >
              {contactName(c)}
            </span>
            <button
              type="button"
              aria-label={`Unstar ${contactName(c)}`}
              onClick={() => onToggleFave(c.id)}
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
