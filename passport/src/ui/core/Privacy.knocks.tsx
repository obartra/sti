import { Button } from "../../design/components/index.ts";
import { Users } from "../../design/icons.tsx";
import { COPY } from "./Privacy.parts.tsx";
import type { Alias, Knock, PrivacyState } from "./Privacy.parts.tsx";

export function RequestsButton({
  al,
  state,
}: {
  al: Alias;
  state: PrivacyState;
}) {
  return (
    <button
      type="button"
      aria-label={COPY.knockReqLabel}
      aria-expanded={state.openKnocks === al.id}
      onClick={() =>
        state.setOpenKnocks(state.openKnocks === al.id ? null : al.id)
      }
      style={{
        appearance: "none",
        border: "none",
        cursor: "pointer",
        font: "inherit",
        flex: "none",
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "5px 11px",
        borderRadius: "var(--radius-pill)",
        background: "var(--accent-soft)",
        color: "var(--text-accent)",
        fontSize: 12.5,
        fontWeight: 700,
      }}
    >
      {COPY.knockReqLabel}
      <span
        style={{
          width: 8,
          height: 8,
          borderRadius: "50%",
          background: "var(--accent)",
          boxShadow: "0 0 0 3px var(--surface-tint)",
          flex: "none",
        }}
      />
    </button>
  );
}

function KnockItem({
  al,
  k,
  state,
}: {
  al: Alias;
  k: Knock;
  state: PrivacyState;
}) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 11,
        padding: "13px 13px",
        background: "var(--surface-card)",
        borderRadius: "var(--radius-md)",
        boxShadow: "var(--shadow-sm)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
        <span
          style={{
            flex: "none",
            width: 36,
            height: 36,
            borderRadius: "50%",
            background: "var(--surface-sunken)",
            color: "var(--text-muted)",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Users size={18} />
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: 14,
              fontWeight: 700,
              color: "var(--text-strong)",
            }}
          >
            {COPY.knockSomeone}
          </div>
          <div
            style={{
              fontSize: 12,
              color: k.expiring
                ? "var(--status-treat-fg)"
                : "var(--text-subtle)",
              marginTop: 1,
            }}
          >
            {k.ageBase}
            {k.expiring ? ` · ${COPY.knockExpiring}` : ""}
          </div>
        </div>
      </div>
      <div style={{ display: "flex", gap: 9 }}>
        <Button
          variant="primary"
          size="md"
          block
          onClick={() => state.doGrant(al.id, k.requester_token)}
        >
          {COPY.knockGrant}
        </Button>
        <Button
          variant="ghost"
          size="md"
          block
          onClick={() => state.doIgnore(al.id, k.requester_token)}
        >
          {COPY.knockIgnore}
        </Button>
      </div>
    </div>
  );
}

export function KnockPanel({ al, state }: { al: Alias; state: PrivacyState }) {
  return (
    <div
      style={{
        borderTop: "1px solid var(--divider)",
        background: "var(--surface-app)",
        borderRadius: "var(--radius-md)",
        margin: "4px 4px 6px",
        padding: "13px 13px 8px",
        display: "flex",
        flexDirection: "column",
        gap: 12,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 10,
        }}
      >
        <span
          style={{
            fontSize: 12.5,
            color: "var(--text-muted)",
            lineHeight: 1.45,
            maxWidth: 210,
          }}
        >
          {COPY.knockListTitle}
        </span>
        {state.pendingCount(al.id) > 0 && (
          <button
            type="button"
            onClick={() => state.doClearAll(al.id)}
            style={{
              appearance: "none",
              border: "none",
              background: "transparent",
              color: "var(--text-accent)",
              font: "inherit",
              fontSize: 13,
              fontWeight: 700,
              cursor: "pointer",
              flex: "none",
              padding: "2px",
            }}
          >
            {COPY.knockClearAll}
          </button>
        )}
      </div>
      {state.pendingCount(al.id) === 0 ? (
        <div
          style={{
            padding: "8px 4px 14px",
            fontSize: 13.5,
            color: "var(--text-muted)",
            textAlign: "center",
          }}
        >
          {COPY.knockEmpty}
        </div>
      ) : (
        (state.knocks[al.id] ?? []).map((k) => (
          <KnockItem key={k.requester_token} al={al} k={k} state={state} />
        ))
      )}
      <div
        style={{
          fontSize: 11.5,
          color: "var(--text-subtle)",
          lineHeight: 1.5,
          padding: "2px 4px 4px",
        }}
      >
        {COPY.knockNote}
      </div>
    </div>
  );
}
