import { Avatar } from "../design/components/index.ts";
import { avatarFor } from "../lib/avatars.ts";
import { cx } from "../lib/cx.ts";
import "./badge-card.css";

/* BadgeCard, the forked two-state status + identity layer. It is presentational
   and state-based: the viewer renders an already-resolved `state` (the pure
   core resolves owner -> state on owner surfaces). Two visible states only,
   BLUE and GRAY, no four-light model, no checkmark, no "self-reported" mark
   (honesty lives in one plain sentence). THE card (doc 37): the one credential
   artifact, on the .e-artifact certificate treatment (a double printed rule,
   flat, no glow); its interior is the artifact's own print. */

export type BadgeState = "blue" | "gray";
export type ProtectionLabel =
  "hiv" | "condoms_always" | "condoms_either" | "condoms_raw" | "doxy_pep";
export type Route = ProtectionLabel | null;

// Blue = the DS teal accent family; gray = the DS neutral family, kept soft so
// it never reads as failure.
const BLUE = { fill: "var(--teal-500)" };
const GRAY = { fill: "var(--neutral-100)", mark: "var(--neutral-500)" };

// Two distinct SHAPES (filled in-window ring vs. dash) so the state never
// depends on color alone (WCAG). Neither is a checkmark. The size is a prop,
// so the box stays an inline value.
export function Medallion({
  state,
  size = 104,
}: {
  state: BadgeState;
  size?: number;
}) {
  return (
    <span className="bc__medal" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox="0 0 104 104" aria-hidden="true">
        {state === "blue" ? (
          <>
            <circle cx="52" cy="52" r="52" fill={BLUE.fill} />
            <circle
              cx="52"
              cy="52"
              r="27"
              fill="none"
              stroke="var(--white)"
              strokeWidth="5"
              strokeOpacity="0.92"
            />
            <circle cx="52" cy="52" r="10.5" fill="var(--white)" />
          </>
        ) : (
          <>
            <circle cx="52" cy="52" r="52" fill={GRAY.fill} />
            <rect
              x="32"
              y="48.5"
              width="40"
              height="7"
              rx="3.5"
              fill={GRAY.mark}
            />
          </>
        )}
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

// Protection labels. Plain facts, never ranked, never summed. The pill colors
// are per-label data (the artifact's print), so they stay inline values.
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
  // A self-declared flat attribute (doxycycline post-exposure prophylaxis for
  // bacterial STIs). Never a route, never ranked; shown only when the owner opts in.
  doxy_pep: {
    text: "On doxy-PEP",
    icon: "shield",
    bg: "var(--neutral-100)",
    fg: "var(--neutral-600)",
  },
};

function LabelPill({ k }: { k: ProtectionLabel }) {
  const l = LABELS[k];
  return (
    <span className="bc__pill" style={{ background: l.bg, color: l.fg }}>
      <LabelIcon name={l.icon} /> {l.text}
    </span>
  );
}

export function LabelRow({ labels }: { labels: ProtectionLabel[] }) {
  if (!labels.length) return null;
  return (
    <div className="bc__labels">
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
  // private/nonexistent gray-nothing (no handle, no avatar, no labels). The
  // optional `id` is the alias's opaque identifier (doc 19): when no avatarSrc is
  // supplied, the fallback face seeds on it, never on the handle (which can be
  // user-chosen and identifying). Absent for surfaces with no per-alias id (the
  // owner's own home, samples), which seed on the handle.
  identity?: { handle: string; id?: string } | null;
  avatarSrc?: string | undefined;
  width?: number | string;
}

function BadgeHeader() {
  return (
    <div className="bc__head">
      <img
        src="/assets/logo/logo-wordmark.svg"
        alt="sti.care"
        className="bc__logo"
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
    <div className="bc__hero">
      <Medallion state={state} size={104} />
      <div
        className={cx("bc__word", blue ? "bc__word--blue" : "bc__word--gray")}
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
  identity: { handle: string; id?: string };
  avatarSrc: string | undefined;
  sentence: string | null;
}) {
  // With no chosen avatar, the fallback face seeds on the alias opaque id when we
  // have one, else the handle (doc 19): the id is unlinkable, the handle may be
  // user-chosen and identifying.
  const seed = identity.id ?? identity.handle;
  const src = avatarSrc ?? (seed ? avatarFor(seed) : undefined);
  return (
    <div className="bc__identity">
      <div className="bc__who">
        <Avatar
          src={src}
          initials={identity.handle.slice(0, 2).toUpperCase()}
          size="sm"
        />
        <span className="bc__handle">@{identity.handle}</span>
      </div>
      {!blue && labels.length > 0 && (
        <div className="bc__identity-labels">
          <LabelRow labels={labels} />
        </div>
      )}
      {sentence && <p className="bc__sentence">{sentence}</p>}
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

  return (
    <div className={cx("e-artifact", "bc")} style={{ width }}>
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
