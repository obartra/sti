import { Card, Button, Avatar } from "../../design/components/index.ts";
import {
  Lock,
  Eye,
  EyeOff,
  Globe,
  Link,
  Trash,
  Plus,
  Bell,
  Dots,
} from "../../design/icons.tsx";
import { COPY, aliasMenuItem, visMeta } from "./Privacy.parts.tsx";
import type { Alias, PrivacyState } from "./Privacy.parts.tsx";
import { ReuseWarnBanner, CreateAliasForm } from "./Privacy.create.tsx";
import { RequestsButton, KnockPanel } from "./Privacy.knocks.tsx";

export function AliasIntroCard({
  onViewAs,
}: {
  onViewAs?: (() => void) | undefined;
}) {
  return (
    <Card variant="tint" style={{ display: "flex", gap: 12 }}>
      <span style={{ color: "var(--text-accent)", flex: "none", marginTop: 1 }}>
        <Lock size={18} />
      </span>
      <div style={{ flex: 1 }}>
        <div
          style={{ fontSize: 14, fontWeight: 700, color: "var(--text-strong)" }}
        >
          {COPY.aliasesTitle}
        </div>
        <div
          style={{
            fontSize: 13.5,
            lineHeight: 1.55,
            color: "var(--text-body)",
            marginTop: 2,
          }}
        >
          {COPY.aliasesSub}
        </div>
        <Button
          variant="secondary"
          size="sm"
          icon={<Eye size={15} />}
          onClick={onViewAs}
          style={{ marginTop: 10 }}
        >
          {COPY.viewAs}
        </Button>
      </div>
    </Card>
  );
}

function AliasMenu({ al, state }: { al: Alias; state: PrivacyState }) {
  return (
    <div
      style={{
        position: "absolute",
        right: 6,
        top: "calc(100% - 6px)",
        zIndex: 5,
        background: "var(--surface-card)",
        borderRadius: "var(--radius-md)",
        boxShadow: "var(--shadow-lg)",
        padding: 6,
        minWidth: 184,
      }}
    >
      {al.vis !== "private" && (
        <button
          type="button"
          onClick={() => state.setVis(al.id, "private")}
          style={aliasMenuItem("var(--text-body)")}
        >
          <Lock size={15} /> {COPY.aliasPrivate}
        </button>
      )}
      {al.vis !== "public" && (
        <button
          type="button"
          onClick={() => state.setVis(al.id, "public")}
          style={aliasMenuItem("var(--text-body)")}
        >
          <Link size={15} /> {COPY.aliasPublic}
        </button>
      )}
      {al.vis !== "findable" && (
        <button
          type="button"
          onClick={() => state.setVis(al.id, "findable")}
          style={aliasMenuItem("var(--text-body)")}
        >
          <Globe size={15} /> {COPY.aliasFindable}
        </button>
      )}
      {!al.primary && (
        <button
          type="button"
          onClick={() => state.revoke(al.id)}
          style={aliasMenuItem("var(--status-expired-fg)")}
        >
          <Trash size={15} /> {COPY.aliasRevoke}
        </button>
      )}
    </div>
  );
}

function AliasMeta({ al, dup }: { al: Alias; dup: boolean }) {
  const m = visMeta(al.vis);
  return (
    <div style={{ flex: 1, minWidth: 0 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 7,
          flexWrap: "wrap",
        }}
      >
        <span
          style={{
            fontSize: 14.5,
            fontWeight: 700,
            color: "var(--text-strong)",
          }}
        >
          @{al.handle}
        </span>
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
            padding: "2px 8px 2px 6px",
            borderRadius: "var(--radius-pill)",
            background: m.bg,
            color: m.fg,
            fontSize: 11.5,
            fontWeight: 700,
            whiteSpace: "nowrap",
          }}
        >
          {m.ic} {m.label}
        </span>
        {al.primary && (
          <span
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: "var(--text-subtle)",
            }}
          >
            · this card
          </span>
        )}
      </div>
      <div
        style={{
          fontSize: 12,
          color: "var(--text-subtle)",
          fontFamily: "var(--font-mono)",
          marginTop: 3,
        }}
      >
        sti.care/a/{al.id}
        {al.vis === "private" ? "" : "#k"}
      </div>
      <div
        style={{
          fontSize: 11.5,
          color: dup ? "var(--status-treat-fg)" : "var(--text-subtle)",
          marginTop: 3,
          display: "flex",
          alignItems: "center",
          gap: 5,
        }}
      >
        {dup && <Globe size={12} style={{ flex: "none" }} />}
        {dup
          ? "Reuses @" + al.handle + ", keep private to stay unlinkable"
          : al.vis === "private"
            ? al.keyShared > 0
              ? COPY.aliasKeyShared.replace("{n}", String(al.keyShared))
              : "Key handed out at link time"
            : COPY.aliasAnyone}
      </div>
    </div>
  );
}

export function AliasRow({
  al,
  idx,
  state,
}: {
  al: Alias;
  idx: number;
  state: PrivacyState;
}) {
  const dup = !!state.reuseMatch(al);
  return (
    <div>
      <div
        style={{
          position: "relative",
          display: "flex",
          alignItems: "center",
          gap: 11,
          padding: "9px 6px",
          borderTop: idx ? "1px solid var(--divider)" : "none",
        }}
      >
        <Avatar size="sm" initials={al.handle.slice(0, 1).toUpperCase()} />
        <AliasMeta al={al} dup={dup} />
        {state.pendingCount(al.id) > 0 && (
          <RequestsButton al={al} state={state} />
        )}
        <button
          type="button"
          aria-label={`Options for @${al.handle}`}
          aria-expanded={state.menuFor === al.id}
          onClick={() =>
            state.setMenuFor(state.menuFor === al.id ? null : al.id)
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
          <Dots size={18} />
        </button>
        {state.menuFor === al.id && <AliasMenu al={al} state={state} />}
      </div>
      {/* Inline pending list, contentless knocks, Grant/Ignore each + Clear all. */}
      {state.openKnocks === al.id && <KnockPanel al={al} state={state} />}
    </div>
  );
}

export function AliasList({ state }: { state: PrivacyState }) {
  return (
    <Card
      variant="flat"
      style={{ padding: 6, display: "flex", flexDirection: "column" }}
    >
      {state.aliases.map((al, idx) => (
        <AliasRow key={al.id} al={al} idx={idx} state={state} />
      ))}

      {/* reuse warning fires AT LINKAGE (private alias made public/findable) */}
      {state.reuseWarn && <ReuseWarnBanner state={state} />}

      {state.creating ? (
        <CreateAliasForm state={state} />
      ) : (
        <Button
          variant="ghost"
          size="sm"
          icon={<Plus size={16} />}
          onClick={() => state.setCreating(true)}
          style={{ alignSelf: "flex-start", margin: 6 }}
        >
          {COPY.aliasNew}
        </Button>
      )}
    </Card>
  );
}

export function AliasFooterNotes({ state }: { state: PrivacyState }) {
  return (
    <>
      <div
        style={{
          fontSize: 12.5,
          color: "var(--text-subtle)",
          lineHeight: 1.5,
          display: "flex",
          gap: 7,
          padding: "0 4px",
        }}
      >
        <EyeOff
          size={14}
          style={{ flex: "none", marginTop: 1, color: "var(--text-accent)" }}
        />{" "}
        {COPY.aliasPerLook}
      </div>
      {state.anyPending && (
        <div
          style={{
            fontSize: 12.5,
            color: "var(--text-subtle)",
            lineHeight: 1.5,
            display: "flex",
            gap: 7,
            padding: "0 4px",
          }}
        >
          <Bell
            size={14}
            style={{ flex: "none", marginTop: 1, color: "var(--text-accent)" }}
          />{" "}
          {COPY.knockDotNote}
        </div>
      )}
    </>
  );
}
