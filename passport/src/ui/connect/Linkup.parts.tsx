import type { CSSProperties, ReactNode } from "react";
import { Check, Lock, Info, Link, Sparkle } from "../../design/icons.tsx";
import { HandleAvatar } from "./parts.tsx";

// Foundational styles and leaf components for the Linkup handshake screen, split
// out of Linkup.tsx so each file stays under the length ceiling. Output is
// unchanged; the phase views and state machine live in Linkup.tsx.

export const COPY = {
  modeLabel: "Linkup",
  entryTitle: "You’re together",
  entryBody:
    "@{h} is right here. You both tap to link up and log this. That tap is the yes, from both of you.",
  entryBodyRelink:
    "You’ve linked with @{h} before. Tap together and this time is logged too.",
  entryCta: "Tap to link up",
  entryNote:
    "Linking lets you two quietly look out for each other later if a test ever comes back positive. Nothing about your status is stored, just that you connected.",
  otherPhoneTag: "’s phone",
  otherPhoneHint: "Two phones, two taps. This stands in for their tap.",
  armedTitle: "You tapped",
  armedBody:
    "Waiting for @{h} to tap too. The moment they do, you’re linked and it’s logged.",
  armedCta: "You’re in",
  armedNote:
    "Both of you tap. Being near each other is never enough on its own, and never logs anything by itself.",
  themFirstTitle: "@{h} tapped",
  themFirstBody: "They’re in and waiting on you. Tap to link up and log this.",
  headsupKicker: "Just so you know",
  headsupLine: "@{h}’s testing isn’t up to date right now.",
  headsupBody:
    "That’s all it means. It isn’t a result, and it doesn’t say anything about what they have. Plenty of reasons a status lapses. Up to you what you do next.",
  headsupCta: "Got it, continue",
  headsupFoot: "This won’t stop your linkup. It just makes sure you know.",
  doneTitle: "You’re linked",
  doneTitleRelog: "Linked again",
  doneBody:
    "Have fun. This is just between you two, and it’s logged so you can look out for each other.",
  doneBodyRelog: "You two were already linked. This time together is logged.",
  doneLogged: "logged just now",
  doneCta: "Done",
} as const;

export const ME = "robin";

const FIELD_BG =
  "linear-gradient(178deg, var(--accent-soft) 0%, var(--surface-app) 60%)";
const DOT_TRANSITION =
  "box-shadow var(--dur-base) var(--ease-gentle), outline-color var(--dur-base) var(--ease-gentle)";

export const sx = {
  field: {
    boxSizing: "border-box",
    padding: "12px 22px 24px",
    display: "flex",
    flexDirection: "column",
    background: FIELD_BG,
  },
  modeLabel: {
    display: "inline-flex",
    alignItems: "center",
    gap: 7,
    alignSelf: "center",
    color: "var(--text-accent)",
    fontSize: 12,
    fontWeight: 800,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    marginBottom: 4,
  },
  center: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    paddingBottom: 8,
  },
  title: {
    fontSize: 25,
    fontWeight: 800,
    letterSpacing: "-0.02em",
    color: "var(--text-strong)",
    lineHeight: 1.15,
    textAlign: "center",
  },
  body: {
    margin: "9px auto 0",
    maxWidth: 290,
    fontSize: 14.5,
    lineHeight: 1.55,
    color: "var(--text-body)",
    textAlign: "center",
  },
  proximity: {
    position: "relative",
    height: 196,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    margin: "2px 0",
  },
  proxRow: {
    position: "relative",
    display: "flex",
    alignItems: "center",
    gap: 28,
  },
  dotCol: {
    position: "relative",
    display: "inline-flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 8,
  },
  dotCheck: {
    position: "absolute",
    right: -4,
    bottom: -4,
    width: 23,
    height: 23,
    borderRadius: "50%",
    background: "var(--accent)",
    color: "#fff",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    boxShadow: "var(--shadow-sm)",
  },
  microNote: {
    display: "flex",
    gap: 9,
    alignItems: "flex-start",
    padding: "0 2px",
  },
  microIcon: { color: "var(--text-accent)", flex: "none", marginTop: 1 },
  microText: { fontSize: 12, lineHeight: 1.5, color: "var(--text-muted)" },
  phoneAvatarText: { flex: 1, minWidth: 0 },
  phoneTag: {
    display: "block",
    fontSize: 13.5,
    fontWeight: 700,
    color: "var(--text-strong)",
  },
  phoneHint: {
    display: "block",
    fontSize: 11.5,
    color: "var(--text-subtle)",
    lineHeight: 1.35,
    marginTop: 1,
  },
  doneCol: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    textAlign: "center",
    gap: 18,
  },
  doneLoggedRow: { display: "inline-flex", alignItems: "center", gap: 8 },
  doneLoggedText: {
    marginLeft: 4,
    fontSize: 12.5,
    fontWeight: 600,
    color: "var(--text-muted)",
  },
  headsupKicker: {
    fontSize: 11,
    fontWeight: 800,
    letterSpacing: "0.12em",
    textTransform: "uppercase",
    color: "var(--text-subtle)",
  },
  headsupLine: {
    fontSize: 22,
    fontWeight: 800,
    letterSpacing: "-0.01em",
    color: "var(--text-strong)",
    lineHeight: 1.25,
    maxWidth: 290,
    textWrap: "balance",
  },
  headsupBody: {
    margin: 0,
    maxWidth: 290,
    fontSize: 14,
    lineHeight: 1.6,
    color: "var(--text-muted)",
  },
  headsupFoot: {
    textAlign: "center",
    fontSize: 12,
    color: "var(--text-subtle)",
  },
  col10: { display: "flex", flexDirection: "column", gap: 10 },
  col12: { display: "flex", flexDirection: "column", gap: 12 },
} satisfies Record<string, CSSProperties>;

function dotShell(lit: boolean): CSSProperties {
  return {
    position: "relative",
    width: 66,
    height: 66,
    borderRadius: "50%",
    transition: DOT_TRANSITION,
    boxShadow: lit
      ? "var(--shadow-accent), var(--shadow-md)"
      : "var(--shadow-sm)",
    outline: "2.5px solid",
    outlineColor: lit ? "var(--accent)" : "transparent",
    outlineOffset: 2,
  };
}

// The proximity field: concentric STATIC rings (an "in range" signal, not an
// attention loop) with the two avatars. Lit follows each person's own act, so
// the screen shows plainly that both must light up. Never a QR.
function Ring({ r, o }: { r: number; o: number }) {
  return (
    <span
      style={{
        position: "absolute",
        inset: `calc(50% - ${r}px)`,
        width: r * 2,
        height: r * 2,
        borderRadius: "50%",
        border: "1.5px solid var(--accent)",
        opacity: o,
      }}
    />
  );
}

function ProximityDot({ handle, lit }: { handle: string; lit: boolean }) {
  const label: CSSProperties = {
    fontSize: 12.5,
    fontWeight: 700,
    color: lit ? "var(--text-accent)" : "var(--text-muted)",
  };
  return (
    <span style={sx.dotCol}>
      <span style={dotShell(lit)}>
        <HandleAvatar handle={handle} size="lg" />
        {lit && (
          <span style={sx.dotCheck}>
            <Check size={14} />
          </span>
        )}
      </span>
      <span style={label}>{handle === ME ? "You" : "@" + handle}</span>
    </span>
  );
}

export function Proximity({
  them,
  meLit,
  themLit,
  bound,
}: {
  them: string;
  meLit: boolean;
  themLit: boolean;
  bound: boolean;
}) {
  const linkIcon: CSSProperties = {
    color: "var(--accent)",
    opacity: bound ? 1 : 0.45,
    transition: "opacity var(--dur-base) var(--ease-gentle)",
  };
  return (
    <div style={sx.proximity}>
      <Ring r={96} o={0.1} />
      <Ring r={68} o={0.18} />
      <Ring r={42} o={0.3} />
      <div style={sx.proxRow}>
        <ProximityDot handle={ME} lit={meLit} />
        <span style={linkIcon}>
          <Link size={22} />
        </span>
        <ProximityDot handle={them} lit={themLit} />
      </div>
    </div>
  );
}

export function MicroNote({
  icon,
  children,
}: {
  icon: "Lock" | "Info";
  children: ReactNode;
}) {
  const Ico = icon === "Info" ? Info : Lock;
  return (
    <div style={sx.microNote}>
      <span style={sx.microIcon}>
        <Ico size={15} />
      </span>
      <span style={sx.microText}>{children}</span>
    </div>
  );
}

// The "other phone" stand-in. Two phones means two taps; in this single-device
// prototype this control fires the OTHER person's gesture. It is visibly a
// separate device acting, never something your tap alone can satisfy.
export function OtherPhone({
  them,
  onTap,
  active,
}: {
  them: string;
  onTap: () => void;
  active: boolean;
}) {
  const btn: CSSProperties = {
    appearance: "none",
    cursor: active ? "pointer" : "default",
    width: "100%",
    textAlign: "left",
    display: "flex",
    alignItems: "center",
    gap: 11,
    padding: "10px 12px",
    font: "inherit",
    borderRadius: "var(--radius-md)",
    border: "1.5px dashed " + (active ? "var(--accent)" : "var(--border-card)"),
    background: active ? "var(--surface-card)" : "transparent",
    opacity: active ? 1 : 0.6,
    boxShadow: active ? "var(--shadow-sm)" : "none",
    transition: "all var(--dur-base) var(--ease-gentle)",
  };
  const chevron: CSSProperties = {
    flex: "none",
    color: active ? "var(--text-accent)" : "var(--text-subtle)",
  };
  return (
    <button type="button" onClick={onTap} disabled={!active} style={btn}>
      <HandleAvatar handle={them} size="sm" />
      <span style={sx.phoneAvatarText}>
        <span style={sx.phoneTag}>
          @{them}
          {COPY.otherPhoneTag}
        </span>
        <span style={sx.phoneHint}>{COPY.otherPhoneHint}</span>
      </span>
      <span style={chevron}>
        {active ? <Sparkle size={17} /> : <Check size={16} />}
      </span>
    </button>
  );
}

export function Title({ children }: { children: ReactNode }) {
  return <div style={sx.title}>{children}</div>;
}

export function Body({ children }: { children: ReactNode }) {
  return <p style={sx.body}>{children}</p>;
}

// The immersive Linkup chrome: a warm teal field that is visibly NOT the app
// shell and NOT the profile QR card. Self-contained at width 390 (the shell
// gutter bleed and minHeight from the prototype are dropped for standalone use).
export function Mode({ children }: { children: ReactNode }) {
  return (
    <div style={{ width: "100%", maxWidth: 390 }}>
      <div style={sx.field}>
        <div style={sx.modeLabel}>
          <Sparkle size={15} /> {COPY.modeLabel}
        </div>
        {children}
      </div>
    </div>
  );
}

export function sub(s: string, them: string): string {
  return s.split("{h}").join(them);
}
