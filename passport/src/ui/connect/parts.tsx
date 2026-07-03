import type { ReactNode } from "react";
import { Avatar } from "../../design/components/index.ts";
import { Check, Chevron, Lock, StarFill } from "../../design/icons.tsx";
import { avatarFor } from "../../lib/avatars.ts";
import { cx } from "../../lib/cx.ts";
import type { ContactRecord } from "../../store/accountBlob.ts";
import { COPY } from "./copy.ts";
import "./connect.css";

export { COPY };

// The owner's private label for a contact, or a neutral fallback. There is no
// cross-account handle to show (unlinkability), so a contact is named only by the
// nickname the owner gave it.
export function contactName(contact: ContactRecord): string {
  return contact.label.trim() === "" ? "Contact" : contact.label;
}

// Consistent section header: uppercase eyebrow + optional plain count +
// optional one-line sub. Keeps Starred / Recent on one visual rhythm. `muted`
// lightens the eyebrow so a secondary section (the full contact list) sits below
// the prominent ones (starred, groups).
export function SectionHead({
  title,
  count,
  sub,
  muted = false,
}: {
  title: string;
  count?: ReactNode;
  sub?: string;
  muted?: boolean;
}) {
  return (
    <div className="cn__head">
      <div className="cn__head-row">
        <span
          className={cx("cn__head-label", muted && "cn__head-label--muted")}
        >
          {title}
        </span>
        {count != null && <span className="cn__head-count">{count}</span>}
      </div>
      {sub && <div className="cn__head-sub">{sub}</div>}
    </div>
  );
}

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

// The scan action: the screen's one callout (hairline border, no tile, no shadow).
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
    <button type="button" onClick={onClick} className="cn__scan">
      <span aria-hidden className="cn__scan-icon">
        {icon}
      </span>
      <span className="cn__scan-body">
        <span className="cn__scan-title">{title}</span>
        <span className="cn__scan-sub">{sub}</span>
      </span>
      <span aria-hidden className="cn__scan-trail">
        <Chevron size={18} />
      </span>
    </button>
  );
}

// Starred: the pinned contacts as dense hairline rows, unstar at the trail.
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
      {faves.length === 0 ? (
        <div className="cn__empty">{COPY.favesEmpty}</div>
      ) : (
        <div className="cn__rows">
          {faves.map((c) => (
            <div key={c.id} className="cn__row">
              <ContactAvatar contact={c} size="sm" />
              <div className="cn__row-body">
                <span className="cn__row-name">{contactName(c)}</span>
              </div>
              <button
                type="button"
                aria-label={`Unstar ${contactName(c)}`}
                onClick={() => onToggleFave(c.id)}
                className="cn__star"
              >
                <StarFill size={15} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Privacy promise: no directory, member-initiated only. A quiet hairline aside,
// not a tinted card.
export function PrivacySection() {
  return (
    <div className="cn__privacy">
      <div className="cn__privacy-title">
        <Lock size={15} /> {COPY.privacyTitle}
      </div>
      {COPY.privacy.map((p, i) => (
        <div key={i} className="cn__privacy-row">
          <span aria-hidden className="cn__privacy-check">
            <Check size={16} />
          </span>
          <span className="cn__privacy-text">{p}</span>
        </div>
      ))}
    </div>
  );
}
