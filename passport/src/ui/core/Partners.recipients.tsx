import { Button, Card, Avatar } from "../../design/components/index.ts";
import { avatarFor } from "../../lib/avatars.ts";
import { Sparkle, X, Plus, Mail, Phone } from "../../design/icons.tsx";
import { COPY, fieldLbl, MoreDots, ContactLead } from "./Partners.parts.tsx";
import type { Recipient, PartnersState } from "./Partners.parts.tsx";
import { SearchBar, AddRow } from "./Partners.inputs.tsx";

function RecipientLabel({ r }: { r: Recipient }) {
  return (
    <span
      style={{ fontSize: 14, fontWeight: 600, color: "var(--text-strong)" }}
    >
      {r.kind === "email" || r.kind === "phone"
        ? r.handle
        : /^[\w.]+$/.test(r.handle)
          ? "@" + r.handle
          : r.handle}
    </span>
  );
}

function RecipientRow({ r, state }: { r: Recipient; state: PartnersState }) {
  return (
    <div
      style={{
        position: "relative",
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "7px 6px",
      }}
    >
      {r.kind === "email" || r.kind === "phone" ? (
        <ContactLead>
          {r.kind === "email" ? <Mail size={16} /> : <Phone size={16} />}
        </ContactLead>
      ) : (
        <Avatar initials={r.handle} src={avatarFor(r.handle)} size="sm" />
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <RecipientLabel r={r} />
        <span
          style={{ fontSize: 12, color: "var(--text-subtle)", marginLeft: 8 }}
        >
          {r.when}
        </span>
      </div>
      <button
        type="button"
        aria-label={`Options for ${r.handle}`}
        aria-expanded={state.menuFor === r.handle}
        onClick={() =>
          state.setMenuFor(state.menuFor === r.handle ? null : r.handle)
        }
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
        <MoreDots size={18} />
      </button>
      {state.menuFor === r.handle && (
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
            minWidth: 200,
          }}
        >
          <button
            type="button"
            onClick={() => state.remove(r.handle)}
            style={{
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
              color: "var(--status-expired-fg)",
            }}
          >
            <X size={15} /> {COPY.menuRemove}
          </button>
        </div>
      )}
    </div>
  );
}

function SinceList({ state }: { state: PartnersState }) {
  const lastTestLabel = "7 Jun";
  return (
    <>
      <div
        style={{
          fontSize: 11.5,
          fontWeight: 700,
          letterSpacing: "0.05em",
          textTransform: "uppercase",
          color: "var(--text-subtle)",
          margin: "4px 0 8px",
        }}
      >
        {COPY.sinceTest} · {lastTestLabel}
      </div>
      <Card
        variant="flat"
        style={{ padding: 4, display: "flex", flexDirection: "column" }}
      >
        {state.rShown.length === 0 && (
          <div
            style={{
              padding: 14,
              fontSize: 13.5,
              color: "var(--text-muted)",
              textAlign: "center",
            }}
          >
            No one matches
          </div>
        )}
        {state.rShown.map((r) => (
          <RecipientRow key={r.handle} r={r} state={state} />
        ))}
        {!state.q && !state.showAllR && state.fr.length > 5 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => state.setShowAllR(true)}
            style={{ alignSelf: "flex-start", margin: 4 }}
          >
            {COPY.showAll} {state.fr.length}
          </Button>
        )}
      </Card>
    </>
  );
}

function EarlierList({ state }: { state: PartnersState }) {
  if (state.fe.length === 0) return null;
  return (
    <div style={{ marginTop: 14 }}>
      <div
        style={{
          fontSize: 11.5,
          fontWeight: 700,
          letterSpacing: "0.05em",
          textTransform: "uppercase",
          color: "var(--text-subtle)",
        }}
      >
        {COPY.earlierTitle}
      </div>
      <div
        style={{
          fontSize: 12.5,
          color: "var(--text-subtle)",
          margin: "3px 0 8px",
        }}
      >
        {COPY.earlierSub}
      </div>
      <Card
        variant="flat"
        style={{ padding: 4, display: "flex", flexDirection: "column" }}
      >
        {state.eShown.map((e) => (
          <div
            key={e.handle}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "6px 6px",
            }}
          >
            <Avatar initials={e.handle} src={avatarFor(e.handle)} size="sm" />
            <div style={{ flex: 1, minWidth: 0 }}>
              <span
                style={{
                  fontSize: 14,
                  fontWeight: 600,
                  color: "var(--text-strong)",
                }}
              >
                @{e.handle}
              </span>
              <span
                style={{
                  fontSize: 12,
                  color: "var(--text-subtle)",
                  marginLeft: 8,
                }}
              >
                {e.when}
              </span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              icon={<Plus size={14} />}
              onClick={() => state.addEarlier(e.handle)}
            >
              {COPY.add}
            </Button>
          </div>
        ))}
        {!state.q && state.fe.length > state.visEarlier && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => state.setVisEarlier((v) => v + 6)}
            style={{ alignSelf: "flex-start", margin: 4 }}
          >
            {COPY.showMore} · {state.fe.length - state.visEarlier} left
          </Button>
        )}
      </Card>
    </div>
  );
}

export function RecipientsSection({ state }: { state: PartnersState }) {
  return (
    <div>
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          marginBottom: 4,
        }}
      >
        <span style={fieldLbl}>{COPY.recipientsTitle}</span>
        <span
          style={{ fontSize: 13, fontWeight: 600, color: "var(--text-muted)" }}
        >
          {state.recipients.length} selected
        </span>
      </div>
      <div
        style={{
          fontSize: 12.5,
          color: "var(--text-subtle)",
          marginBottom: 10,
          display: "flex",
          alignItems: "center",
          gap: 6,
        }}
      >
        <Sparkle size={14} /> {COPY.fromConnections}
      </div>

      {/* search, the log is big enough that scanning isn't enough */}
      <SearchBar state={state} />
      <SinceList state={state} />
      <EarlierList state={state} />
      <AddRow state={state} />
    </div>
  );
}
