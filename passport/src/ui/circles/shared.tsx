// Circles & Events shared bits: the two-state member "tone" system (a
// circle-membership color system, NOT the passport status badge), the small UI
// atoms the circle screens compose from, and the mock fixture data the screens
// read.
//
// Faithful port of comps-reference/app/circles-ui.jsx:
//   window.CirclesUI  -> MemberDot, MiniDot, RoleBadge, DotGlyph
//   window.CircleStore -> TONE, circleById, plus the mock circle data
//
// Member status is two-state only (blue = "Tested & on HIV prevention",
// gray = "No status shared right now"). No worst-of room rollup, no status
// counts, no aggregate banner. A roster shows each person's individual atom;
// that's the only status surface a circle has.
//
// IMPORTANT: this "tone" is the circle-membership color system, distinct from
// the passport badge. It is intentionally two-state and uses two distinct
// SHAPES so the state never rides on colour alone.
import type { CSSProperties } from "react";
import { Shield } from "../../design/icons.tsx";

// ── Copy (verbatim from copy.js `circles`, the role label used here) ──────────
const COPY = {
  roleOrganizer: "Organizer",
} as const;

// ── Types ─────────────────────────────────────────────────────────────────────
export type Tone = "blue" | "gray";
export type CircleType = "circle" | "event";
export type Role = "organizer" | "member";

export interface CircleMember {
  handle: string;
  status: Tone;
  role: Role;
  you?: boolean;
  sharing?: boolean;
}

export interface CircleRequest {
  handle: string;
  when?: string;
  declined?: boolean;
}

export interface Circle {
  id: string;
  name: string;
  type: CircleType;
  role: Role;
  barDays?: number;
  date?: string;
  daysToDate?: number;
  expires?: string | null;
  daysToExpiry?: number;
  members: CircleMember[];
  requests: CircleRequest[];
}

export interface CircleStoreData {
  circles: Circle[];
  archived: Circle[];
}

// ── Mock fixture data (module-level, mirrors the demo store) ──────────────────
export function makeCircleFixture(): CircleStoreData {
  return {
    circles: [
      {
        id: "thu",
        name: "Thursday crew",
        type: "circle",
        role: "organizer",
        barDays: 30,
        expires: null,
        members: [
          {
            handle: "robin",
            status: "blue",
            role: "organizer",
            you: true,
            sharing: true,
          },
          { handle: "sam", status: "blue", role: "organizer" },
          { handle: "ari", status: "blue", role: "member" },
          { handle: "leo", status: "blue", role: "member" },
          { handle: "noa.v", status: "blue", role: "member" },
          { handle: "kit", status: "blue", role: "member" },
          { handle: "jules", status: "blue", role: "member" },
          { handle: "theo", status: "gray", role: "member" },
        ],
        requests: [],
      },
      {
        id: "sol",
        name: "Solstice",
        type: "event",
        role: "organizer",
        date: "21 Jun 2026",
        daysToDate: 11,
        barDays: 30,
        expires: "21 Jun 2026",
        daysToExpiry: 11,
        members: [
          {
            handle: "robin",
            status: "blue",
            role: "organizer",
            you: true,
            sharing: true,
          },
          { handle: "max.b", status: "blue", role: "organizer" },
          { handle: "rio", status: "blue", role: "member" },
          { handle: "dann", status: "blue", role: "member" },
          { handle: "sasha", status: "blue", role: "member" },
          { handle: "nico", status: "blue", role: "member" },
          { handle: "ben10", status: "blue", role: "member" },
          { handle: "ozzy", status: "blue", role: "member" },
          { handle: "finn", status: "blue", role: "member" },
          { handle: "remy", status: "blue", role: "member" },
          { handle: "cass", status: "blue", role: "member" },
          { handle: "jay", status: "blue", role: "member" },
        ],
        requests: [
          { handle: "mika", when: "2h ago" },
          { handle: "drew", when: "Yesterday" },
        ],
      },
      {
        id: "fern",
        name: "Fern house",
        type: "circle",
        role: "member",
        barDays: 90,
        expires: "30 Jun 2026",
        daysToExpiry: 20,
        members: [
          {
            handle: "robin",
            status: "blue",
            role: "member",
            you: true,
            sharing: true,
          },
          { handle: "alexj", status: "blue", role: "organizer" },
          { handle: "kai_", status: "blue", role: "member" },
          { handle: "marco", status: "gray", role: "member" },
          { handle: "lee0", status: "gray", role: "member" },
        ],
        requests: [],
      },
    ],
    archived: [],
  };
}

export function circleById(data: CircleStoreData, id: string): Circle {
  const found = data.circles.find((c) => c.id === id);
  if (found) return found;
  const first = data.circles[0];
  if (!first) throw new Error("circleById: empty circle store");
  return first;
}

// ── Two-state tone ───────────────────────────────────────────────────────────
export interface ToneStyle {
  base: string;
  bg: string;
  fg: string;
}

export const TONE: Record<Tone, ToneStyle> = {
  blue: {
    base: "var(--teal-500)",
    bg: "var(--teal-100)",
    fg: "var(--teal-700)",
  },
  gray: {
    base: "var(--neutral-500)",
    bg: "var(--neutral-100)",
    fg: "var(--neutral-600)",
  },
};

function toneStyle(tone: Tone): ToneStyle {
  return TONE[tone];
}

function labelFor(tone: Tone): string {
  // Short, non-explanatory. Blue names both halves (never "safe/cleared");
  // gray is one flat bucket, never says why.
  return tone === "blue" ? "Tested & on HIV prevention" : "No status";
}

// ── Atoms ────────────────────────────────────────────────────────────────────
// Two distinct SHAPES so the state never rides on colour alone:
//   blue = in-window ring + dot (not a tick) · gray = single dash.
export interface DotGlyphProps {
  tone: Tone;
  size?: number;
}

export function DotGlyph({ tone, size = 10 }: DotGlyphProps) {
  const common = {
    viewBox: "0 0 16 16",
    width: size,
    height: size,
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
  if (tone === "blue") {
    return (
      <svg {...common}>
        <circle cx="8" cy="8" r="4.4" />
        <circle cx="8" cy="8" r="1.7" fill="currentColor" stroke="none" />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <path d="M4.5 8 h7" />
    </svg>
  );
}

// Per-member status atom: colour + glyph + word, always together.
export interface MemberDotProps {
  tone: Tone;
  size?: "md" | "lg";
}

export function MemberDot({ tone, size = "md" }: MemberDotProps) {
  const t = toneStyle(tone);
  const big = size === "lg";
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
      <span
        style={{
          width: big ? 22 : 18,
          height: big ? 22 : 18,
          borderRadius: "50%",
          flex: "none",
          background: t.base,
          color: "#fff",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <DotGlyph tone={tone} size={big ? 12 : 10} />
      </span>
      <span
        style={{
          fontSize: big ? 13.5 : 12.5,
          fontWeight: 600,
          color: t.fg,
          whiteSpace: "nowrap",
        }}
      >
        {labelFor(tone)}
      </span>
    </span>
  );
}

// Compact dot only (for tight rows), still carries a title.
export interface MiniDotProps {
  tone: Tone;
  size?: number;
}

export function MiniDot({ tone, size = 16 }: MiniDotProps) {
  const t = toneStyle(tone);
  return (
    <span
      title={labelFor(tone)}
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        flex: "none",
        background: t.base,
        color: "#fff",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <DotGlyph tone={tone} size={size * 0.58} />
    </span>
  );
}

// Permissions are binary: organizers can edit; members can't. One badge.
export interface RoleBadgeProps {
  role: Role;
}

export function RoleBadge({ role }: RoleBadgeProps) {
  if (role !== "organizer") return null;
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        flex: "none",
        background: "var(--accent-soft)",
        color: "var(--text-accent)",
        borderRadius: "var(--radius-pill)",
        padding: "2px 8px",
        fontSize: 10.5,
        fontWeight: 700,
        letterSpacing: "0.04em",
        textTransform: "uppercase",
        whiteSpace: "nowrap",
      }}
    >
      <Shield size={10} /> {COPY.roleOrganizer}
    </span>
  );
}

// Section label style shared by the circle screens.
export const sectionLbl: CSSProperties = {
  fontSize: 12,
  fontWeight: 700,
  letterSpacing: "0.06em",
  textTransform: "uppercase",
  color: "var(--text-subtle)",
};
