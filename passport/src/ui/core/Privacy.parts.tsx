import { useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import type { CondomPreference, OwnerState } from "../../core/badge.ts";
import { PRIVACY_SCREEN_NAME } from "../../copy/canonical.ts";

// Privacy and sharing: the card-attribute + controls + danger state. The live link
// list is the real LiveLinks (Privacy.aliases.tsx); this module holds only what is
// backed by real owner state. (An older seeded link UI lived here and was removed
// once LiveLinks replaced it; the public-name surface is doc 17, not built yet, so
// nothing here fakes it.)
export const COPY = {
  title: PRIVACY_SCREEN_NAME,
  avatarTitle: "Your avatar",
  avatarSub: "The look you can choose to show on a link.",
  avatarEdit: "Edit",
  controlsTitle: "Controls",
  anonAlerts: "Anonymous partner alerts",
  anonAlertsSub:
    "Built in. If you report a positive, recent connections get an anonymous heads-up. Never optional, never traceable to you.",
  pushRow: "Notify me on this device",
  pushRowSub:
    "Get the alert as a notification even when the app is closed. The heads-up stays the same: no name, no detail. You’ll still see it in-app either way.",
  pushOn: "On",
  pushUnsupported: "Not available on this device",
  pushIosInstall:
    "On iPhone, add sti.care to your Home Screen to turn this on.",
  installRow: "Install the app",
  installRowSub:
    "Keep your passport one tap away. It works offline, and we still can’t read it.",
  installCta: "Install",
  attrsTitle: "What shows on your card",
  attrsSub:
    "Optional facts you stand behind. They show to anyone allowed to see your card, on gray too. None of them is required.",
  hivLabel: "On HIV prevention",
  hivLabelSub: "One umbrella for either route. It never says which.",
  condomTitle: "Condoms",
  condomSub:
    "Your call, shown as a plain preference. Only “Condoms always” also counts toward an up-to-date card.",
  condomOff: "Don’t show",
  condomRaw: "No condoms",
  condomEither: "Condoms optional",
  condomAlways: "Condoms always",
  doxyLabel: "On doxy-PEP",
  doxyLabelSub:
    "An optional fact you stand behind. It never counts toward blue.",
  pauseRow: "Hide my status",
  pauseRowSub: "Show plain gray to everyone, identical to any other gray.",
  dangerTitle: "Danger zone",
  deleteTitle: "Delete everything",
  deleteSub: "Remove your passport, results and links. Instant, and for good.",
  deleteCta: "Delete everything",
} as const;

export type Condoms = "off" | "raw" | "either" | "always";

export const fieldLbl: CSSProperties = {
  fontSize: 14,
  fontWeight: 600,
  color: "var(--text-body)",
  marginBottom: 10,
};

export function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        appearance: "none",
        cursor: "pointer",
        font: "inherit",
        fontSize: 14,
        fontWeight: 600,
        padding: "9px 14px",
        borderRadius: "var(--radius-pill)",
        border:
          "1px solid " + (active ? "var(--accent)" : "var(--border-card)"),
        background: active ? "var(--accent-soft)" : "var(--surface-card)",
        color: active ? "var(--text-accent)" : "var(--text-body)",
        transition: "all var(--dur-fast) var(--ease-gentle)",
      }}
    >
      {children}
    </button>
  );
}

export interface PrivacyState {
  confirmDelete: boolean;
  setConfirmDelete: (v: boolean) => void;
  labelHiv: boolean;
  setLabelHiv: (v: boolean) => void;
  condoms: Condoms;
  setCondoms: (v: Condoms) => void;
  doxy: boolean;
  setDoxy: (v: boolean) => void;
  paused: boolean;
  setPaused: (v: boolean) => void;
}

// The card attributes are derived from (and written back to) the real owner
// state, so toggling them persists and republishes. The condom UI's 4th "off"
// value maps to "not shown publicly"; the three shown values set the public flag.
function condomsOf(s: OwnerState): Condoms {
  if (!s.condomPreferencePublic || s.condomPreference === "none") return "off";
  return s.condomPreference === "condoms_always"
    ? "always"
    : s.condomPreference;
}
function withCondoms(s: OwnerState, v: Condoms): OwnerState {
  if (v === "off") {
    return { ...s, condomPreference: "none", condomPreferencePublic: false };
  }
  const pref: CondomPreference = v === "always" ? "condoms_always" : v;
  return { ...s, condomPreference: pref, condomPreferencePublic: true };
}

export function usePrivacyState(
  ownerState: OwnerState,
  setOwnerState: (update: (prev: OwnerState) => OwnerState) => void,
): PrivacyState {
  const [confirmDelete, setConfirmDelete] = useState(false);
  // Card attributes (self-declared, optional) read from the synced owner state;
  // each setter persists via an updater so concurrent toggles compose.
  return {
    confirmDelete,
    setConfirmDelete,
    labelHiv: ownerState.onPrep,
    setLabelHiv: (v) => setOwnerState((s) => ({ ...s, onPrep: v })),
    condoms: condomsOf(ownerState),
    setCondoms: (v) => setOwnerState((s) => withCondoms(s, v)),
    doxy: ownerState.onDoxyPep,
    setDoxy: (v) => setOwnerState((s) => ({ ...s, onDoxyPep: v })),
    paused: ownerState.paused,
    setPaused: (v) => setOwnerState((s) => ({ ...s, paused: v })),
  };
}
