import type { CSSProperties } from "react";
import { Avatar } from "../design/components/index.ts";
import { avatarFor } from "../lib/avatars.ts";

/* BadgeCard, the forked two-state status + identity layer. Faithful port of the
   design's app/badge-card.jsx. It is presentational and state-based: the viewer
   renders an already-resolved `state` (the pure core resolves owner -> state on
   owner surfaces). Two visible states only, BLUE and GRAY, no four-light model,
   no checkmark, no "self-reported" mark (honesty lives in one plain sentence). */

export type BadgeState = "blue" | "gray";
export type ProtectionLabel =
  | "hiv"
  | "condoms_always"
  | "condoms_either"
  | "condoms_raw";
export type Route = ProtectionLabel | null;

// Blue = the DS teal accent family; gray = the DS neutral family, kept soft so
// it never reads as failure.
const BLUE = { fill: "var(--teal-500)" };
const GRAY = { fill: "var(--neutral-100)", mark: "var(--neutral-500)" };

// Two distinct SHAPES (filled in-window ring vs. dash) so the state never
// depends on colour alone (WCAG). Neither is a checkmark.
export function Medallion({
  state,
  size = 104,
}: {
  state: BadgeState;
  size?: number;
}) {
  if (state === "blue") {
    return (
      <span
        style={{
          position: "relative",
          width: size,
          height: size,
          flex: "none",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <span
          style={{
            position: "absolute",
            inset: -9,
            borderRadius: "50%",
            background: BLUE.fill,
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
          <circle cx="52" cy="52" r="52" fill={BLUE.fill} />
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
    <span
      style={{
        position: "relative",
        width: size,
        height: size,
        flex: "none",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <svg width={size} height={size} viewBox="0 0 104 104" aria-hidden="true">
        <circle cx="52" cy="52" r="52" fill={GRAY.fill} />
        <rect x="32" y="48.5" width="40" height="7" rx="3.5" fill={GRAY.mark} />
      </svg>
    </span>
  );
}

// Label icons (2px line, round caps), reproduced from the design.
function LabelIcon({
  name,
  size = 15,
}: {
  name: "umbrella" | "shield" | "capsule";
  size?: number;
}) {
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
  if (name === "umbrella")
    return (
      <svg {...c}>
        <path d="M12 2v2" />
        <path d="M3.5 12a8.5 8.5 0 0 1 17 0Z" />
        <path d="M12 12v7a2.5 2.5 0 0 0 5 0" />
      </svg>
    );
  if (name === "shield")
    return (
      <svg {...c}>
        <path d="M12 3 5 6v5c0 4 3 6.5 7 8 4-1.5 7-4 7-8V6Z" />
      </svg>
    );
  return (
    <svg {...c}>
      <rect
        x="3"
        y="8"
        width="18"
        height="8"
        rx="4"
        transform="rotate(-32 12 12)"
      />
      <path d="M9.2 7.3 14.8 16" />
    </svg>
  );
}

// Protection labels. Plain facts, never ranked, never summed.
const LABELS: Record<
  ProtectionLabel,
  { text: string; icon: "umbrella" | "shield"; bg: string; fg: string }
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
      <LabelIcon name={l.icon} /> {l.text}
    </span>
  );
}

export function LabelRow({ labels }: { labels: ProtectionLabel[] }) {
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

// Headline-owns-route: the umbrella wins when present; the route is then dropped
// from the tag row so it is never a redundant tag.
function routeOf(labels: ProtectionLabel[], route: Route): Route {
  if (route) return route;
  if (labels.includes("hiv")) return "hiv";
  if (labels.includes("condoms_always")) return "condoms_always";
  return null;
}
export function blueHeadline(labels: ProtectionLabel[], route: Route): string {
  return routeOf(labels, route) === "condoms_always"
    ? "Tested & always uses condoms"
    : "Tested & on HIV prevention";
}
export function tagsFor(
  labels: ProtectionLabel[],
  route: Route,
): ProtectionLabel[] {
  const r = routeOf(labels, route);
  return labels.filter((k) => k !== r);
}

export interface BadgeCardProps {
  state: BadgeState;
  labels?: ProtectionLabel[];
  route?: Route;
  // Present only when the viewer is authorized; null renders the uniform
  // private/nonexistent gray-nothing (no handle, no avatar, no labels).
  identity?: { handle: string } | null;
  avatarSrc?: string | undefined;
  width?: number | string;
}

function BadgeHeader() {
  return (
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
  );
}

function BadgeHero({
  state,
  blue,
  word,
  blueTags,
}: {
  state: BadgeState;
  blue: boolean;
  word: string;
  blueTags: ProtectionLabel[];
}) {
  return (
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
      <Medallion state={state} size={104} />
      <div
        style={{
          fontSize: blue ? 25 : 22,
          fontWeight: 800,
          letterSpacing: "-0.02em",
          lineHeight: 1.15,
          color: blue ? "var(--text-strong)" : "var(--neutral-600)",
          maxWidth: blue ? 270 : 250,
          whiteSpace: "normal",
          textWrap: "balance",
        }}
      >
        {word}
      </div>
      {blue && <LabelRow labels={blueTags} />}
    </div>
  );
}

function BadgeIdentity({
  blue,
  labels,
  identity,
  avatarSrc,
  sentence,
}: {
  blue: boolean;
  labels: ProtectionLabel[];
  identity: { handle: string };
  avatarSrc: string | undefined;
  sentence: string | null;
}) {
  return (
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
        <Avatar
          src={
            avatarSrc ??
            (identity.handle ? avatarFor(identity.handle) : undefined) ??
            undefined
          }
          initials={identity.handle.slice(0, 2).toUpperCase()}
          size="sm"
        />
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
  );
}

export function BadgeCard({
  state,
  labels = [],
  route = null,
  identity = null,
  avatarSrc,
  width = 340,
}: BadgeCardProps) {
  const blue = state === "blue";
  const blueTags = tagsFor(labels, route);
  const word = blue
    ? blueHeadline(labels, route)
    : "No status shared right now";
  const sentence =
    blue && identity
      ? `@${identity.handle} says they've tested recently and take steps to prevent HIV. They're telling you themselves, it's not a lab result.`
      : null;

  const card: CSSProperties = {
    width,
    boxSizing: "border-box",
    background: "var(--surface-card)",
    borderRadius: "var(--radius-xl)",
    boxShadow: blue
      ? "var(--shadow-accent), var(--shadow-md)"
      : "var(--shadow-md)",
    padding: "22px 24px 24px",
    fontFamily: "var(--font-sans)",
  };

  return (
    <div style={card}>
      <BadgeHeader />
      <BadgeHero state={state} blue={blue} word={word} blueTags={blueTags} />
      {identity ? (
        <BadgeIdentity
          blue={blue}
          labels={labels}
          identity={identity}
          avatarSrc={avatarSrc}
          sentence={sentence}
        />
      ) : null}
    </div>
  );
}
