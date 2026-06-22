import { Button, Card } from "../../design/components/index.ts";
import { Star, StarFill, Trash } from "../../design/icons.tsx";
import { relativeDayLabel } from "../../core/clock.ts";
import type { ContactRecord } from "../../store/accountBlob.ts";
import {
  COPY,
  ContactAvatar,
  SectionHead,
  contactName,
  menuItem,
} from "./parts.tsx";

// The kebab popover for a recent-linkup row: star/unstar and delete the link.
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
    <div
      style={{
        position: "absolute",
        right: 6,
        top: "calc(100% - 4px)",
        zIndex: 5,
        background: "var(--surface-card)",
        borderRadius: "var(--radius-md)",
        boxShadow: "var(--shadow-lg)",
        padding: 6,
        minWidth: 190,
      }}
    >
      <button
        type="button"
        onClick={() => onToggleFave(contactId)}
        style={menuItem("var(--text-body)")}
      >
        {isFave ? <StarFill size={15} /> : <Star size={15} />}{" "}
        {isFave ? "Unstar" : "Star as fave"}
      </button>
      <button
        type="button"
        onClick={() => onRemove(contactId)}
        style={menuItem("var(--status-expired-fg)")}
      >
        <Trash size={15} /> {COPY.menuDelete}
      </button>
    </div>
  );
}

// One recent-linkup row (a contact) plus its kebab menu.
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
    <div
      style={{
        position: "relative",
        display: "flex",
        alignItems: "center",
        gap: 11,
        padding: "7px 6px",
      }}
    >
      <ContactAvatar contact={contact} size="sm" />
      <div style={{ flex: 1, minWidth: 0 }}>
        <span
          style={{
            fontSize: 14,
            fontWeight: 600,
            color: "var(--text-strong)",
          }}
        >
          {name}
        </span>
        {isFave && (
          <span
            style={{
              color: "var(--status-treat-base)",
              marginLeft: 6,
              display: "inline-flex",
              verticalAlign: "-2px",
            }}
          >
            <StarFill size={12} />
          </span>
        )}
        <span
          style={{
            fontSize: 12,
            color: "var(--text-subtle)",
            marginLeft: 8,
          }}
        >
          {relativeDayLabel(contact.createdDay, nowDay)}
        </span>
      </div>
      <button
        type="button"
        aria-label={`Options for ${name}`}
        aria-expanded={menuOpen}
        onClick={onToggleMenu}
        style={{
          appearance: "none",
          border: "none",
          background: "transparent",
          cursor: "pointer",
          width: 34,
          height: 34,
          borderRadius: "50%",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          color: "var(--text-subtle)",
          flex: "none",
        }}
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
      />
      {recent.length === 0 ? (
        <Card
          variant="flat"
          style={{
            textAlign: "center",
            color: "var(--text-muted)",
            fontSize: 14,
          }}
        >
          {COPY.empty}
        </Card>
      ) : (
        <Card
          variant="flat"
          style={{ padding: 4, display: "flex", flexDirection: "column" }}
        >
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
              style={{ alignSelf: "flex-start", margin: 4 }}
            >
              {COPY.showMore} · {recent.length - visible} left
            </Button>
          )}
        </Card>
      )}
    </div>
  );
}
