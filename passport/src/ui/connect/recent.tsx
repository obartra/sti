import { Button, Input } from "../../design/components/index.ts";
import { Star, StarFill, Trash } from "../../design/icons.tsx";
import {
  relativeDayLabel,
  epochDayToISODate,
  isoDateToEpochDay,
} from "../../core/clock.ts";
import { encounterDayOf, type ContactRecord } from "../../store/accountBlob.ts";
import { COPY, ContactAvatar, SectionHead, contactName } from "./parts.tsx";
import "./connect.css";

// The kebab popover for a recent-connection row: set the day you met, star, and
// delete the link. An overlay control, so it keeps its elevation (doc 37).
function RecentRowMenu({
  contact,
  nowDay,
  isFave,
  onToggleFave,
  onRemove,
  onSetEncounterDay,
}: {
  contact: ContactRecord;
  nowDay: number;
  isFave: boolean;
  onToggleFave: (contactId: string) => void;
  onRemove: (contactId: string) => void;
  onSetEncounterDay: (contactId: string, day: number) => void;
}) {
  return (
    <div className="cn__menu">
      <label className="cn__menu-item cn__menu-date">
        {COPY.menuMetOn}
        <Input
          type="date"
          value={epochDayToISODate(encounterDayOf(contact))}
          max={epochDayToISODate(nowDay)}
          onChange={(e) => {
            const day = isoDateToEpochDay(e.target.value);
            if (day !== null) onSetEncounterDay(contact.id, day);
          }}
        />
      </label>
      <button
        type="button"
        onClick={() => onToggleFave(contact.id)}
        className="cn__menu-item"
      >
        {isFave ? <StarFill size={15} /> : <Star size={15} />}{" "}
        {isFave ? "Unstar" : "Star as fave"}
      </button>
      <button
        type="button"
        onClick={() => onRemove(contact.id)}
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
  onSetEncounterDay,
}: {
  contact: ContactRecord;
  nowDay: number;
  isFave: boolean;
  menuOpen: boolean;
  onToggleMenu: () => void;
  onToggleFave: (contactId: string) => void;
  onRemove: (contactId: string) => void;
  onSetEncounterDay: (contactId: string, day: number) => void;
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
          {relativeDayLabel(encounterDayOf(contact), nowDay)}
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
          contact={contact}
          nowDay={nowDay}
          isFave={isFave}
          onToggleFave={onToggleFave}
          onRemove={onRemove}
          onSetEncounterDay={onSetEncounterDay}
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
  onSetEncounterDay,
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
  onSetEncounterDay: (contactId: string, day: number) => void;
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
              onSetEncounterDay={onSetEncounterDay}
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
