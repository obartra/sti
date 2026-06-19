import { Button } from "../../design/components/index.ts";
import { Search, X, UserPlus, Info } from "../../design/icons.tsx";
import { COPY, inputShell } from "./Partners.parts.tsx";
import type { PartnersState } from "./Partners.parts.tsx";

export function SearchBar({ state }: { state: PartnersState }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        background: "var(--surface-card)",
        border: "1.5px solid var(--border-card)",
        borderRadius: "var(--radius-pill)",
        padding: "0 14px",
        height: 42,
        marginBottom: 12,
      }}
    >
      <span style={{ color: "var(--text-subtle)", flex: "none" }}>
        <Search size={16} />
      </span>
      <input
        value={state.query}
        onChange={(e) => state.setQuery(e.target.value)}
        placeholder={COPY.searchPlaceholder}
        aria-label={COPY.searchPlaceholder}
        style={inputShell}
      />
      {state.query && (
        <button
          type="button"
          aria-label="Clear search"
          onClick={() => state.setQuery("")}
          style={{
            appearance: "none",
            border: "none",
            background: "var(--surface-sunken)",
            width: 24,
            height: 24,
            borderRadius: "50%",
            cursor: "pointer",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            color: "var(--text-muted)",
            flex: "none",
          }}
        >
          <X size={13} />
        </button>
      )}
    </div>
  );
}

export function AddRow({ state }: { state: PartnersState }) {
  return (
    <>
      <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
        <div
          style={{
            flex: 1,
            display: "flex",
            alignItems: "center",
            gap: 8,
            background: "var(--surface-card)",
            border: "1.5px solid var(--border-card)",
            borderRadius: "var(--radius-pill)",
            padding: "0 14px",
            height: 44,
          }}
        >
          <span style={{ color: "var(--text-subtle)", flex: "none" }}>
            <UserPlus size={16} />
          </span>
          <input
            value={state.draft}
            onChange={(e) => state.setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") state.addDraft();
            }}
            placeholder={COPY.addPlaceholder}
            aria-label={COPY.addLabel}
            style={inputShell}
          />
        </div>
        <Button variant="secondary" size="md" onClick={state.addDraft}>
          {COPY.add}
        </Button>
      </div>
      <div
        style={{
          fontSize: 12.5,
          color: "var(--text-subtle)",
          lineHeight: 1.5,
          marginTop: 8,
        }}
      >
        {COPY.addHint}
      </div>
      <div
        style={{
          fontSize: 12.5,
          color: "var(--text-subtle)",
          display: "flex",
          alignItems: "center",
          gap: 6,
          marginTop: 8,
        }}
      >
        <Info size={14} /> {COPY.matchNote}
      </div>
    </>
  );
}
