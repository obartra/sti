// Circle member display atoms: the two-state "tone" system (a circle-membership
// color system, NOT the passport status badge) and the small UI atoms the circle
// screens compose from.
//
// Member status is two-state only (blue = "Tested & on HIV prevention",
// gray = "No status shared right now"). No worst-of room rollup, no status counts,
// no aggregate banner. A roster shows each person's individual atom; that's the
// only status surface a circle has.
//
// IMPORTANT: this "tone" is the circle-membership color system, distinct from the
// passport badge. It is intentionally two-state and uses two distinct SHAPES so
// the state never rides on colour alone.
import type { CSSProperties } from "react";

// ── Two-state tone ───────────────────────────────────────────────────────────
export type Tone = "blue" | "gray";

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

// Section label style shared by the circle screens.
export const sectionLbl: CSSProperties = {
  fontSize: 12,
  fontWeight: 700,
  letterSpacing: "0.06em",
  textTransform: "uppercase",
  color: "var(--text-subtle)",
};
