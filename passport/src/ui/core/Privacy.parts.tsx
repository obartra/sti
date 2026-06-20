import { useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { Lock, Link, Globe } from "../../design/icons.tsx";
import type { CondomPreference, OwnerState } from "../../core/badge.ts";

// C6 privacy & sharing. Faithful port of core-flows.jsx Privacy (+ its CtrlRow
// helper), copy verbatim from copy.js (privacy). Presentational only: the
// prototype's window.Knock security layer and window.STI avatar helpers are
// replaced with seeded local state and the avatar initials fallback.
export const COPY = {
  title: "Privacy & sharing",
  aliasesTitle: "Your aliases",
  aliasesSub:
    "Make as many as you like. Each has its own look and link. Nothing is permanent, revoke any one and its link stops resolving.",
  aliasNew: "New alias",
  aliasRevoke: "Revoke",
  aliasPrivate: "Private",
  aliasPublic: "Public link",
  aliasFindable: "Findable",
  aliasKeyShared: "Key shared with {n} contacts",
  aliasAnyone: "Anyone with the link",
  aliasPerLook:
    "Each alias gets its own avatar and handle by default, so they can’t be linked back to each other or to you.",
  knockReqLabel: "Requests",
  knockListTitle: "People holding this link who asked to see your status.",
  knockClearAll: "Clear all",
  knockSomeone: "Someone with your link",
  knockGrant: "Grant",
  knockIgnore: "Ignore",
  knockExpiring: "expiring soon",
  knockEmpty: "No open requests right now.",
  knockNote:
    "Requests carry no message and clear themselves after about four days. Granting flows your status to that one person; ignoring tells them nothing.",
  knockDotNote:
    "A soft dot marks an alias with open requests, no buzz, no push. Open it when someone tells you they knocked.",
  aliasReuseWarn:
    "@{h} is also your private alias, making this one findable lets someone connect the two.",
  aliasReuseProceed: "Make it findable anyway",
  aliasReuseCancel: "Keep it private",
  aliasCreateTitle: "New alias",
  aliasCreateSub: "A fresh look so this one stands on its own.",
  aliasShuffle: "Shuffle avatar",
  aliasHandleLabel: "Handle on this alias",
  aliasHandleHint:
    "Just a display name, not your address, and not unique across the app.",
  aliasReuseInline:
    "Reusing a handle or avatar from another alias can let someone connect the two.",
  aliasCreateCta: "Create alias",
  vanityClaimNote:
    "Findable handles are claimed first-come. If one’s taken you’ll just pick another, there’s no way to look up which handles exist.",
  vanityClaimTaken: "That handle’s already in use. Try another.",
  viewAs: "See what others see",
  controlsTitle: "Controls",
  anonAlerts: "Anonymous partner alerts",
  anonAlertsSub:
    "Built in. If you report a positive, recent linkups get an anonymous heads-up. Never optional, never traceable to you.",
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

export type Vis = "private" | "public" | "findable";
export type Condoms = "off" | "raw" | "either" | "always";

export interface Alias {
  id: string;
  handle: string;
  vis: Vis;
  keyShared: number;
  primary?: boolean;
}

export interface Knock {
  requester_token: string;
  ageBase: string;
  expiring: boolean;
}

export interface ReuseWarn {
  id: string;
  vis: Vis;
  handle: string;
}

export const fieldLbl: CSSProperties = {
  fontSize: 14,
  fontWeight: 600,
  color: "var(--text-body)",
  marginBottom: 10,
};

export const aliasMenuItem = (color: string): CSSProperties => ({
  appearance: "none",
  border: "none",
  background: "transparent",
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  gap: 9,
  width: "100%",
  textAlign: "left",
  padding: "9px 10px",
  borderRadius: 8,
  font: "inherit",
  fontSize: 13.5,
  fontWeight: 600,
  color,
});

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

export interface VisMeta {
  label: string;
  ic: ReactNode;
  bg: string;
  fg: string;
}

export const visMeta = (vis: Vis): VisMeta =>
  ({
    private: {
      label: COPY.aliasPrivate,
      ic: <Lock size={12.5} />,
      bg: "var(--surface-sunken)",
      fg: "var(--text-muted)",
    },
    public: {
      label: COPY.aliasPublic,
      ic: <Link size={12.5} />,
      bg: "var(--accent-soft)",
      fg: "var(--text-accent)",
    },
    findable: {
      label: COPY.aliasFindable,
      ic: <Globe size={12.5} />,
      bg: "var(--treat-50, #FBF3D9)",
      fg: "var(--status-treat-fg)",
    },
  })[vis];

export const TAKEN = ["robin", "sam", "alex", "kai"];

const newId = () => Math.random().toString(36).slice(2, 10);

export interface PrivacyState {
  aliases: Alias[];
  confirmDelete: boolean;
  setConfirmDelete: (v: boolean) => void;
  menuFor: string | null;
  setMenuFor: (v: string | null) => void;
  reuseWarn: ReuseWarn | null;
  setReuseWarn: (v: ReuseWarn | null) => void;
  creating: boolean;
  setCreating: (v: boolean) => void;
  newHandle: string;
  setNewHandle: (v: string) => void;
  newVis: Vis;
  setNewVis: (v: Vis) => void;
  claimTaken: boolean;
  setClaimTaken: (v: boolean) => void;
  knocks: Record<string, Knock[]>;
  openKnocks: string | null;
  setOpenKnocks: (v: string | null) => void;
  labelHiv: boolean;
  setLabelHiv: (v: boolean) => void;
  condoms: Condoms;
  setCondoms: (v: Condoms) => void;
  doxy: boolean;
  setDoxy: (v: boolean) => void;
  paused: boolean;
  setPaused: (v: boolean) => void;
  pendingCount: (id: string) => number;
  doGrant: (id: string, tok: string) => void;
  doIgnore: (id: string, tok: string) => void;
  doClearAll: (id: string) => void;
  anyPending: boolean;
  reuseMatch: (al: Alias) => Alias | undefined;
  applyVis: (id: string, vis: Vis) => void;
  setVis: (id: string, vis: Vis) => void;
  revoke: (id: string) => void;
  createAlias: () => void;
}

const SEED_ALIASES: Alias[] = [
  {
    id: "a7f3k9q2",
    handle: "robin",
    vis: "private",
    keyShared: 4,
    primary: true,
  },
  { id: "p2m8d4q7", handle: "r.nightout", vis: "public", keyShared: 0 },
  { id: "k3v7m2p8", handle: "robin", vis: "private", keyShared: 0 },
];

const SEED_KNOCKS: Record<string, Knock[]> = {
  a7f3k9q2: [
    { requester_token: "t1", ageBase: "Knocked 2h ago", expiring: false },
    { requester_token: "t2", ageBase: "Knocked 3d ago", expiring: true },
  ],
  p2m8d4q7: [],
  k3v7m2p8: [],
};

type AliasSlice = Omit<
  PrivacyState,
  | "labelHiv"
  | "setLabelHiv"
  | "condoms"
  | "setCondoms"
  | "doxy"
  | "setDoxy"
  | "paused"
  | "setPaused"
  | "confirmDelete"
  | "setConfirmDelete"
>;

// Knock, owner-pull pending requests keyed by alias id. A soft dot (no count)
// marks an alias with open requests; the list below is contentless.
function useKnockSlice() {
  const [knocks, setKnocks] = useState<Record<string, Knock[]>>(SEED_KNOCKS);
  const [openKnocks, setOpenKnocks] = useState<string | null>(null);
  const pendingCount = (id: string) => (knocks[id] ?? []).length;
  const dropKnock = (id: string, tok: string) =>
    setKnocks((p) => ({
      ...p,
      [id]: (p[id] ?? []).filter((k) => k.requester_token !== tok),
    }));
  const doClearAll = (id: string) => {
    setKnocks((p) => ({ ...p, [id]: [] }));
    setOpenKnocks(null);
  };
  return {
    knocks,
    openKnocks,
    setOpenKnocks,
    pendingCount,
    dropKnock,
    doClearAll,
  };
}

// Aliases live on-device. The PRIMARY alias defaults to private ("link" in the
// prototype's resolution input). Each is an opaque id + handle + visibility.
function useAliasSlice(): AliasSlice {
  const [aliases, setAliases] = useState<Alias[]>(SEED_ALIASES);
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [reuseWarn, setReuseWarn] = useState<ReuseWarn | null>(null);
  const [creating, setCreating] = useState(false);
  const [newHandle, setNewHandle] = useState("");
  const [newVis, setNewVis] = useState<Vis>("private");
  const [claimTaken, setClaimTaken] = useState(false);
  const {
    knocks,
    openKnocks,
    setOpenKnocks,
    pendingCount,
    dropKnock,
    doClearAll,
  } = useKnockSlice();

  // Does any OTHER alias reuse this one's handle? (the re-link risk)
  const reuseMatch = (al: Alias) =>
    aliases.find((x) => x.id !== al.id && x.handle === al.handle);
  const applyVis = (id: string, vis: Vis) => {
    setAliases((p) => p.map((a) => (a.id === id ? { ...a, vis } : a)));
    setReuseWarn(null);
    setMenuFor(null);
  };
  // Making an alias public/findable WARNS AT LINKAGE if its handle matches
  // another alias. Going back to private never warns. Warn-only: user can proceed.
  const setVis = (id: string, vis: Vis) => {
    const al = aliases.find((a) => a.id === id);
    if (!al) return;
    if ((vis === "public" || vis === "findable") && reuseMatch(al)) {
      setReuseWarn({ id, vis, handle: al.handle });
      setMenuFor(null);
      return;
    }
    applyVis(id, vis);
  };
  const revoke = (id: string) => {
    setAliases((p) => p.filter((a) => a.id !== id));
    setMenuFor(null);
  };
  const createAlias = () => {
    const handle =
      newHandle
        .trim()
        .replace(/^@/, "")
        .replace(/[^a-z0-9_.]/gi, "")
        .toLowerCase() || "alias" + Math.random().toString(36).slice(2, 5);
    if (newVis === "findable" && TAKEN.includes(handle)) {
      setClaimTaken(true);
      return;
    }
    setAliases((p) => [
      ...p,
      { id: newId(), handle, vis: newVis, keyShared: 0 },
    ]);
    setCreating(false);
    setNewHandle("");
    setNewVis("private");
    setClaimTaken(false);
  };

  return {
    aliases,
    menuFor,
    setMenuFor,
    reuseWarn,
    setReuseWarn,
    creating,
    setCreating,
    newHandle,
    setNewHandle,
    newVis,
    setNewVis,
    claimTaken,
    setClaimTaken,
    knocks,
    openKnocks,
    setOpenKnocks,
    pendingCount,
    doGrant: dropKnock,
    doIgnore: dropKnock,
    doClearAll,
    anyPending: aliases.some((a) => pendingCount(a.id) > 0),
    reuseMatch,
    applyVis,
    setVis,
    revoke,
    createAlias,
  };
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
  const alias = useAliasSlice();
  const [confirmDelete, setConfirmDelete] = useState(false);
  // Card attributes (self-declared, optional) read from the synced owner state;
  // each setter persists via an updater so concurrent toggles compose.
  return {
    ...alias,
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
