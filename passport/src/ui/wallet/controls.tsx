import type { ReactNode } from "react";
import { Button, Card } from "../../design/components/index.ts";
import { Check, Globe } from "../../design/icons.tsx";
import { COPY, HANDLE } from "./shared.tsx";

/* ── Format chooser ──────────────────────────────────────────────────── */
export function FormatOption({
  icon,
  dark,
  title,
  sub,
  selected,
  disabled,
  onSelect,
  foot,
}: {
  icon: ReactNode;
  dark?: boolean;
  title: string;
  sub: string;
  selected?: boolean;
  disabled?: boolean;
  onSelect?: (() => void) | undefined;
  foot?: ReactNode;
}) {
  return (
    <div
      style={{
        position: "relative",
        borderRadius: "var(--radius-lg)",
        padding: 15,
        background: selected ? "var(--accent-soft)" : "var(--surface-card)",
        boxShadow: selected ? "0 0 0 2px var(--accent)" : "var(--shadow-sm)",
        display: "flex",
        flexDirection: "column",
        gap: 11,
      }}
    >
      <button
        type="button"
        onClick={disabled ? undefined : onSelect}
        aria-disabled={disabled}
        style={{
          appearance: "none",
          border: "none",
          background: "transparent",
          padding: 0,
          margin: 0,
          cursor: disabled ? "default" : "pointer",
          textAlign: "left",
          width: "100%",
          display: "flex",
          alignItems: "center",
          gap: 12,
          opacity: disabled ? 0.55 : 1,
        }}
      >
        <span
          style={{
            flex: "none",
            width: 42,
            height: 42,
            borderRadius: "var(--radius-md)",
            background: dark ? "#26222e" : "var(--accent)",
            color: "#fff",
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
        <span
          style={{
            flex: "none",
            width: 22,
            height: 22,
            borderRadius: "50%",
            border: selected ? "none" : "2px solid var(--warm-300, #ddd6ca)",
            background: selected ? "var(--accent)" : "transparent",
            color: "#fff",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {selected && <Check size={13} />}
        </span>
      </button>
      {foot}
    </div>
  );
}

/* ── Make-public confirmation (the only path to enable Live on a private
      alias). On confirm it flips this alias public, THEN switches to Live. ── */
export function ConfirmPublic({
  onKeep,
  onConfirm,
}: {
  onKeep?: (() => void) | undefined;
  onConfirm?: (() => void) | undefined;
}) {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 40,
        display: "flex",
        flexDirection: "column",
        justifyContent: "flex-end",
      }}
    >
      <div
        onClick={onKeep}
        style={{
          position: "absolute",
          inset: 0,
          background: "rgba(27,27,47,0.42)",
        }}
      />
      <div
        style={{
          position: "relative",
          background: "var(--surface-card)",
          borderTopLeftRadius: "var(--radius-2xl, 28px)",
          borderTopRightRadius: "var(--radius-2xl, 28px)",
          padding: "22px 22px 24px",
          boxShadow: "0 -18px 50px -20px rgba(27,27,47,0.5)",
          display: "flex",
          flexDirection: "column",
          gap: 16,
        }}
      >
        <span
          style={{
            width: 48,
            height: 48,
            borderRadius: "var(--radius-md)",
            background: "var(--accent-soft)",
            color: "var(--text-accent)",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Globe size={24} />
        </span>
        <div>
          <div
            style={{
              fontSize: 18,
              fontWeight: 800,
              letterSpacing: "-0.01em",
              color: "var(--text-strong)",
            }}
          >
            {COPY.confirmTitle(HANDLE)}
          </div>
          <p
            style={{
              fontSize: 13.5,
              color: "var(--text-body)",
              marginTop: 7,
              lineHeight: 1.55,
            }}
          >
            {COPY.confirmBody}
          </p>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
          {COPY.confirmPoints.map((tx, i) => (
            <div
              key={i}
              style={{
                display: "flex",
                gap: 9,
                fontSize: 13,
                lineHeight: 1.45,
                color: "var(--text-body)",
              }}
            >
              <span
                style={{
                  flex: "none",
                  marginTop: 1,
                  color: "var(--text-accent)",
                }}
              >
                <Check size={15} />
              </span>
              {tx}
            </div>
          ))}
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <Button variant="ghost" size="lg" block onClick={onKeep}>
            {COPY.keepPrivate}
          </Button>
          <Button variant="primary" size="lg" block onClick={onConfirm}>
            {COPY.makePublicGoLive}
          </Button>
        </div>
      </div>
    </div>
  );
}

/* ── Add / already-added control ─────────────────────────────────────── */
function AddButton({
  platform,
  onClick,
}: {
  platform: "apple" | "google";
  onClick?: (() => void) | undefined;
}) {
  const apple = platform === "apple";
  const Mark = apple ? (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="#fff">
      <path d="M16.4 12.7c0-2 1.6-3 1.7-3.05-1-1.4-2.4-1.6-2.9-1.6-1.2-.13-2.4.72-3 .72-.6 0-1.6-.7-2.6-.68-1.3.02-2.6.78-3.3 1.97-1.4 2.45-.36 6.07 1 8.06.66.97 1.45 2.06 2.48 2.02 1-.04 1.37-.64 2.58-.64 1.2 0 1.54.64 2.6.62 1.07-.02 1.75-.99 2.4-1.97.76-1.13 1.07-2.22 1.08-2.28-.02-.01-2.07-.8-2.1-3.16zM14.5 6.3c.55-.67.92-1.6.82-2.53-.79.03-1.75.53-2.32 1.2-.51.58-.96 1.53-.84 2.43.88.07 1.78-.45 2.34-1.1z" />
    </svg>
  ) : (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <path d="M12 4 19 8v8l-7 4-7-4V8z" fill="#fff" opacity="0.18" />
      <path
        d="M9 12l2 2 4-4"
        stroke="#fff"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        appearance: "none",
        cursor: "pointer",
        width: "100%",
        border: "none",
        background: "#1B1B2F",
        color: "#fff",
        borderRadius: 12,
        padding: "13px 18px",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 10,
        boxShadow: "var(--shadow-sm)",
      }}
    >
      {Mark}
      <span
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-start",
          lineHeight: 1.15,
          whiteSpace: "nowrap",
        }}
      >
        <span style={{ fontSize: 10, opacity: 0.75 }}>{COPY.addTo}</span>
        <span style={{ fontSize: 14, fontWeight: 700 }}>
          {apple ? COPY.appleWallet : COPY.googleWallet}
        </span>
      </span>
    </button>
  );
}

export function WalletAction({
  platform,
  added,
  onAdd,
  onRemove,
}: {
  platform: "apple" | "google";
  added: boolean;
  onAdd?: (() => void) | undefined;
  onRemove?: (() => void) | undefined;
}) {
  const name = platform === "apple" ? COPY.appleWallet : COPY.googleWallet;
  if (!added) return <AddButton platform={platform} onClick={onAdd} />;
  return (
    <Card
      variant="flat"
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "12px 14px",
      }}
    >
      <span
        style={{
          flex: "none",
          width: 34,
          height: 34,
          borderRadius: "50%",
          background: "var(--accent-soft)",
          color: "var(--text-accent)",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Check size={18} />
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{ fontSize: 14, fontWeight: 700, color: "var(--text-strong)" }}
        >
          {COPY.inYourWallet(name)}
        </div>
        <div style={{ fontSize: 12.5, color: "var(--text-muted)" }}>
          {COPY.keepsCurrent}
        </div>
      </div>
      <div style={{ display: "flex", gap: 6, flex: "none" }}>
        <Button variant="quiet" size="sm" onClick={onRemove}>
          {COPY.remove}
        </Button>
        <Button variant="secondary" size="sm">
          {COPY.open}
        </Button>
      </div>
    </Card>
  );
}
