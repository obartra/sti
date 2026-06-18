import type { CSSProperties } from "react";
import { resolveViewerBadge, type OwnerState } from "../core/badge.ts";

/* Faithful port of the prototype's app/badge-card.jsx (the approved two-state
   card), driven by the pure core for state + headline. The displayed protection
   labels and identity are passed in (the core does not surface them yet). */

export type ProtectionLabel =
  | "hiv"
  | "condoms_always"
  | "condoms_either"
  | "condoms_raw";

const LABELS: Record<
  ProtectionLabel,
  { text: string; icon: IconName; bg: string; fg: string }
> = {
  hiv: {
    text: "On HIV prevention",
    icon: "umbrella",
    bg: "var(--teal-100)",
    fg: "var(--teal-700)",
  },
  condoms_always: {
    text: "Condoms always",
    icon: "shield",
    bg: "var(--ink-100)",
    fg: "var(--ink-700)",
  },
  condoms_either: {
    text: "Condoms optional",
    icon: "shield",
    bg: "var(--neutral-100)",
    fg: "var(--neutral-600)",
  },
  condoms_raw: {
    text: "No condoms",
    icon: "shield",
    bg: "var(--neutral-100)",
    fg: "var(--neutral-600)",
  },
};

type IconName = "umbrella" | "shield";

function Icon({ name, size = 15 }: { name: IconName; size?: number }) {
  const c = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
  if (name === "umbrella") {
    return (
      <svg {...c}>
        <path d="M12 2v2" />
        <path d="M3.5 12a8.5 8.5 0 0 1 17 0Z" />
        <path d="M12 12v7a2.5 2.5 0 0 0 5 0" />
      </svg>
    );
  }
  return (
    <svg {...c}>
      <path d="M12 3 5 6v5c0 4 3 6.5 7 8 4-1.5 7-4 7-8V6Z" />
    </svg>
  );
}

// Two distinct SHAPES (a white in-window ring + dot for blue, a flat dash for
// gray), so the state never depends on colour alone. Neither is a checkmark.
function Medallion({
  state,
  size = 104,
}: {
  state: "blue" | "gray";
  size?: number;
}) {
  const wrap: CSSProperties = {
    position: "relative",
    width: size,
    height: size,
    flex: "none",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
  };
  if (state === "blue") {
    return (
      <span style={wrap}>
        <span
          style={{
            position: "absolute",
            inset: -9,
            borderRadius: "50%",
            background: "var(--teal-500)",
            opacity: 0.14,
            filter: "blur(9px)",
          }}
        />
        <svg
          width={size}
          height={size}
          viewBox="0 0 104 104"
          aria-hidden="true"
        >
          <circle cx="52" cy="52" r="52" fill="var(--teal-500)" />
          <circle
            cx="52"
            cy="52"
            r="27"
            fill="none"
            stroke="#fff"
            strokeWidth="5"
            strokeOpacity="0.92"
          />
          <circle cx="52" cy="52" r="10.5" fill="#fff" />
        </svg>
      </span>
    );
  }
  return (
    <span style={wrap}>
      <svg width={size} height={size} viewBox="0 0 104 104" aria-hidden="true">
        <circle cx="52" cy="52" r="52" fill="var(--neutral-100)" />
        <rect
          x="32"
          y="48.5"
          width="40"
          height="7"
          rx="3.5"
          fill="var(--neutral-500)"
        />
      </svg>
    </span>
  );
}

function LabelPill({ k }: { k: ProtectionLabel }) {
  const l = LABELS[k];
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "7px 13px 7px 11px",
        borderRadius: "var(--radius-pill)",
        background: l.bg,
        color: l.fg,
        fontSize: 13.5,
        fontWeight: 600,
        whiteSpace: "nowrap",
      }}
    >
      <Icon name={l.icon} /> {l.text}
    </span>
  );
}

function LabelRow({ labels }: { labels: ProtectionLabel[] }) {
  if (!labels.length) return null;
  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: 8,
        justifyContent: "center",
      }}
    >
      {labels.map((k) => (
        <LabelPill key={k} k={k} />
      ))}
    </div>
  );
}

// Headline-owns-route: the umbrella wins when present; the route is dropped from
// the tag row so it is never a redundant tag.
function routeOf(labels: ProtectionLabel[]): ProtectionLabel | null {
  if (labels.includes("hiv")) return "hiv";
  if (labels.includes("condoms_always")) return "condoms_always";
  return null;
}

function initials(handle: string): string {
  return handle.slice(0, 2).toUpperCase();
}

export function BadgeCard({
  owner,
  labels = [],
  identity = null,
  width = 340,
}: {
  owner: OwnerState;
  labels?: ProtectionLabel[];
  identity?: { handle: string } | null;
  width?: number;
}) {
  const view = resolveViewerBadge(owner);
  const blue = view.badge === "blue";
  const route = routeOf(labels);
  const tags = labels.filter((k) => k !== route);
  const sentence =
    blue && identity
      ? `@${identity.handle} says they've tested recently and take steps to prevent HIV. They're telling you themselves, it's not a lab result.`
      : null;

  return (
    <div
      aria-label="passport badge"
      data-badge={view.badge}
      style={{
        width,
        boxSizing: "border-box",
        background: "var(--surface-card)",
        borderRadius: "var(--radius-xl)",
        boxShadow: blue
          ? "var(--shadow-accent), var(--shadow-md)"
          : "var(--shadow-md)",
        padding: "22px 24px 24px",
        fontFamily: "var(--font-sans)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <img
          src="/assets/logo/logo-wordmark.svg"
          alt="sti.care"
          style={{ height: 19, opacity: 0.92 }}
        />
      </div>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          textAlign: "center",
          gap: 16,
          padding: "26px 0 18px",
        }}
      >
        <Medallion state={view.badge} size={104} />
        <div
          style={{
            fontSize: blue ? 25 : 22,
            fontWeight: 800,
            letterSpacing: "-0.02em",
            lineHeight: 1.15,
            color: blue ? "var(--text-strong)" : "var(--neutral-600)",
            maxWidth: blue ? 270 : 250,
            textWrap: "balance",
          }}
        >
          {view.headline}
        </div>
        {blue && <LabelRow labels={tags} />}
      </div>

      {identity ? (
        <div
          style={{
            borderTop: "1px solid var(--divider)",
            paddingTop: 16,
            display: "flex",
            flexDirection: "column",
            gap: 12,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
            <span
              aria-hidden="true"
              style={{
                width: 34,
                height: 34,
                borderRadius: "50%",
                background: "var(--accent-soft)",
                color: "var(--text-accent)",
                display: "grid",
                placeItems: "center",
                fontSize: 14,
                fontWeight: 700,
                flex: "none",
              }}
            >
              {initials(identity.handle)}
            </span>
            <span
              style={{
                fontSize: 15,
                fontWeight: 700,
                color: "var(--text-strong)",
              }}
            >
              @{identity.handle}
            </span>
          </div>
          {!blue && labels.length > 0 && (
            <div style={{ marginTop: -2 }}>
              <LabelRow labels={labels} />
            </div>
          )}
          {sentence && (
            <p
              style={{
                margin: 0,
                fontSize: 13.5,
                lineHeight: 1.5,
                color: "var(--text-muted)",
              }}
            >
              {sentence}
            </p>
          )}
        </div>
      ) : null}
    </div>
  );
}
