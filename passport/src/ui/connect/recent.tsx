import { Button } from "../../design/components/index.ts";
import { Star, StarFill, Trash } from "../../design/icons.tsx";
import { relativeDayLabel } from "../../core/clock.ts";
import type { ContactRecord } from "../../store/accountBlob.ts";
import { COPY, ContactAvatar, SectionHead, contactName } from "./parts.tsx";
import "./connect.css";

// The kebab popover for a recent-connection row: star/unstar and delete the link.
// An overlay control, so it keeps its elevation (doc 37).
function RecentRowMenu({
  contactId,
  isFave,
  onToggleFave,
  onRemove,
}: {
  contactId: string;
  isFave: boolean;
  onToggleFave: (contactId: string) => void;
  onRemove: (contactId: string) => void;
}) {
  return (
    <div className="cn__menu">
      <button
        type="button"
        onClick={() => onToggleFave(contactId)}
        className="cn__menu-item"
      >
        {isFave ? <StarFill size={15} /> : <Star size={15} />}{" "}
        {isFave ? "Unstar" : "Star as fave"}
      </button>
      <button
        type="button"
        onClick={() => onRemove(contactId)}
        className="cn__menu-item cn__menu-item--danger"
      >
        <Trash size={15} /> {COPY.menuDelete}
      </button>
    </div>
  );
}

// One recent-connection row (a contact) plus its kebab menu.
function RecentRow({
  contact,
  nowDay,
  isFave,
  menuOpen,
  onToggleMenu,
  onToggleFave,
  onRemove,
}: {
  contact: ContactRecord;
  nowDay: number;
  isFave: boolean;
  menuOpen: boolean;
  onToggleMenu: () => void;
  onToggleFave: (contactId: string) => void;
  onRemove: (contactId: string) => void;
}) {
  const name = contactName(contact);
  return (
    <div className="cn__row">
      <ContactAvatar contact={contact} size="sm" />
      <div className="cn__row-body">
        <span className="cn__row-name">{name}</span>
        {isFave && (
          <span aria-hidden className="cn__row-star">
            <StarFill size={12} />
          </span>
        )}
        <span className="cn__row-when">
          {relativeDayLabel(contact.createdDay, nowDay)}
        </span>
      </div>
      <button
        type="button"
        aria-label={`Options for ${name}`}
        aria-expanded={menuOpen}
        onClick={onToggleMenu}
        className="cn__iconbtn"
      >
        <svg
          viewBox="0 0 24 24"
          width="18"
          height="18"
          fill="currentColor"
          aria-hidden
        >
          <circle cx="5" cy="12" r="1.8" />
          <circle cx="12" cy="12" r="1.8" />
          <circle cx="19" cy="12" r="1.8" />
        </svg>
      </button>
      {menuOpen && (
        <RecentRowMenu
          contactId={contact.id}
          isFave={isFave}
          onToggleFave={onToggleFave}
          onRemove={onRemove}
        />
      )}
    </div>
  );
}

export function RecentSection({
  recent,
  visible,
  faves,
  nowDay,
  menuFor,
  onToggleMenu,
  onToggleFave,
  onRemove,
  onShowMore,
}: {
  recent: ContactRecord[];
  visible: number;
  faves: ReadonlySet<string>;
  nowDay: number;
  menuFor: string | null;
  onToggleMenu: (contactId: string) => void;
  onToggleFave: (contactId: string) => void;
  onRemove: (contactId: string) => void;
  onShowMore: () => void;
}) {
  return (
    <div>
      <SectionHead
        title={COPY.recentTitle}
        count={recent.length}
        sub={COPY.pruneNote}
        muted
      />
      {recent.length === 0 ? (
        <div className="cn__empty">{COPY.empty}</div>
      ) : (
        <div className="cn__rows">
          {recent.slice(0, visible).map((c) => (
            <RecentRow
              key={c.id}
              contact={c}
              nowDay={nowDay}
              isFave={faves.has(c.id)}
              menuOpen={menuFor === c.id}
              onToggleMenu={() => onToggleMenu(c.id)}
              onToggleFave={onToggleFave}
              onRemove={onRemove}
            />
          ))}
          {recent.length > visible && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onShowMore}
              className="cn__more"
            >
              {COPY.showMore} · {recent.length - visible} left
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
