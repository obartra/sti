import { useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import type { HivStatus } from "../../core/badge.ts";
import type { ReportOutcome } from "../../core/report.ts";

// C2 Report a result. Faithful port of comps-reference/app/core-flows.jsx
// (Report + ReportSaved + the in-file Chip helper). Copy reproduced VERBATIM
// from copy.js (report object) as inline COPY.
//
// OWNER-ONLY data entry: this is the owner recording their OWN test outcomes
// (positive / negative, per site). The selected-outcome chip styling uses the
// design's red/green tones for a positive/negative pick, that is owner result
// entry, NOT the shared viewer badge. The shared badge is still strictly the
// two-state (blue/gray) BadgeCard, never a four-light status.
export const COPY = {
  title: "Add results",
  modeAll: "All negative",
  modeDetail: "Specific results",
  allClearTitle: "The full core panel came back negative",
  allClearSub:
    "One tap. HIV, syphilis, gonorrhea and chlamydia all recorded negative, the core panel a blue card needs.",
  detailHint: "Set what applies. Anything you didn’t test stays untouched.",
  notTested: "Not tested",
  coreTitle: "What a blue card needs",
  coreBody:
    "A blue card means a recent full check: HIV, syphilis, gonorrhea and chlamydia. For gonorrhea and chlamydia, each spot counts, mark the ones that aren’t a part of your body you use.",
  coreCovered: "Core panel covered, this can show blue.",
  coreIncomplete:
    "Not the full core panel yet. Until it’s complete your card stays gray, never a half-status.",
  coreMissingLabel: "Still needed",
  notExposed: "Not a site I use",
  siteHint:
    "Mark each spot you were tested for, or “not a site I use”, so you’re never pushed to swab somewhere you don’t need to.",
  siteOpts: ["Not tested", "Negative", "Positive", "Not a site I use"],
  sites: [
    ["uro", "Genital / urine"],
    ["throat", "Throat"],
    ["rectal", "Rectal"],
  ],
  infections: [
    {
      id: "hiv",
      name: "HIV",
      options: ["Not tested", "Negative", "Undetectable", "Positive"],
      core: true,
      note: "Undetectable counts as up to date.",
    },
    {
      id: "ct",
      name: "Chlamydia",
      perSite: true,
      core: true,
      note: "Tested at each spot, or marked not a site you use.",
    },
    {
      id: "gc",
      name: "Gonorrhoea",
      perSite: true,
      core: true,
      note: "Usually one shot, then a short wait.",
    },
    {
      id: "syph",
      name: "Syphilis",
      options: ["Not tested", "Negative", "Positive", "Prior history"],
      core: true,
      note: "Treated syphilis can stay antibody positive. Your card stays up to date.",
    },
    {
      id: "herpes",
      name: "Herpes",
      options: ["Not tested", "Negative", "Positive"],
      note: "Common and manageable. A herpes result never changes the status you share, it’s not part of your badge.",
    },
    {
      id: "hepb",
      name: "Hepatitis B",
      options: ["Not tested", "Negative", "Positive"],
    },
    {
      id: "hpv",
      name: "HPV",
      options: ["Not tested", "Negative", "Positive"],
      note: "HPV is common and usually clears on its own. It’s not part of your status, the vaccine and routine screening are what matter.",
    },
  ],
  dateLabel: "Date tested",
  onPassportTitle: "Update my last test date on my passport",
  onPassportSub:
    "Refreshes your status and last-tested date. Nothing else is shown.",
  privacyNoteTitle: "Your privacy is protected",
  privacyNote:
    "Your card never names a condition. A positive simply shows no status, gray, the same as any other reason a card isn’t current.",
  chronicTitle: "This stays between you and your care",
  chronicBody:
    "Herpes and HPV are common and manageable, and they never change the status you share, they’re not part of your badge. Tap “About” above to learn what they mean and how to look after yourself.",
  chronicOutbreak:
    "Having a herpes outbreak right now? Pausing your status for a bit is a considerate choice while it passes. It just shows gray, like any other reason, never why.",
  save: "Save results",
  cancel: "Cancel",
  promptTitle: "Your recent partners will get an anonymous heads-up",
  promptBody:
    "That’s built into sti.care. We matched the linkups you logged in Connect. Review the list and add anyone we missed.",
  promptYes: "Review who gets notified",
  promptNo: "I’ll do this in a moment",
} as const;

// Cross-object copy the prototype pulls from the `learn` object (verbatim).
export const LEARN_COPY = {
  learnLink: "About",
  panelNote:
    "About half of people with an STI feel fine and have no signs. A standard panel checks HIV, gonorrhea, chlamydia and syphilis; herpes is only tested if you have a sore, so ask if you want it.",
} as const;

export const fieldLbl: CSSProperties = {
  fontSize: 14,
  fontWeight: 600,
  color: "var(--text-body)",
  marginBottom: 10,
};

// C2 infection ids -> Learn explainer ids (hep B has no explainer on the site).
export const LEARN_MAP: Record<string, string> = {
  hiv: "hiv",
  ct: "chlamydia",
  gc: "gonorrhea",
  syph: "syphilis",
  herpes: "herpes",
  hpv: "hpv",
};

// In-file Chip helper, ported verbatim from the prototype. The active state uses
// the accent (teal) family, the standard owner-entry chip styling.
interface ChipProps {
  active: boolean;
  onClick?: (() => void) | undefined;
  children: ReactNode;
}

export function Chip({ active, onClick, children }: ChipProps) {
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

export const POS = "Positive";
export const NEG = "Negative";

export type SiteStatus = "positive" | "untouched" | "covered" | "partial";

export function Tag({ children }: { children: ReactNode }) {
  return (
    <span
      style={{
        flex: "none",
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        background: "var(--surface-sunken)",
        color: "var(--text-muted)",
        borderRadius: "var(--radius-pill)",
        padding: "3px 10px",
        fontSize: 12,
        fontWeight: 700,
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </span>
  );
}

// Owner result-entry state plus the derived two-state badge reasoning. None of
// this is ever surfaced to a viewer; the badge surfaces read only the derived
// two-state badge.
export interface ReportState {
  mode: string;
  setMode: (v: string) => void;
  onPassport: boolean;
  setOnPassport: (v: boolean) => void;
  detail: boolean;
  val: (id: string) => string;
  set: (id: string, v: string) => void;
  siteVal: (id: string, sk: string) => string;
  setSite: (id: string, sk: string, v: string) => void;
  siteStatus: (id: string) => SiteStatus;
  anyPositive: boolean;
  anyChronicPositive: boolean;
  coreComplete: boolean;
  coreMissing: string[];
  touchedAny: boolean;
  anyEntered: boolean;
}

const CHRONIC = ["herpes", "hpv"];

// Single-test core infections (HIV/syphilis): covered when negative, or on the
// lone acceptable positives, undetectable HIV, prior-treated syphilis.
function singleStatus(v: string, ok: string[]): SiteStatus {
  if (v === POS) return "positive";
  if (v === COPY.notTested) return "untouched";
  return ok.includes(v) ? "covered" : "partial";
}

interface Derived {
  anyPositive: boolean;
  anyChronicPositive: boolean;
  coreComplete: boolean;
  coreMissing: string[];
  touchedAny: boolean;
  anyEntered: boolean;
}

// The badge reflects CURRENT STATE, never diagnosis HISTORY. None of this is
// surfaced to a viewer; it derives the two-state badge inputs only.
function derive(
  detail: boolean,
  val: (id: string) => string,
  siteStatus: (id: string) => SiteStatus,
): Derived {
  const c = COPY;
  const coreState: Record<string, SiteStatus> = {
    hiv: singleStatus(val("hiv"), [NEG, "Undetectable"]),
    syph: singleStatus(val("syph"), [NEG, "Prior history"]),
    gc: siteStatus("gc"),
    ct: siteStatus("ct"),
  };
  const coreList: [string, string][] = [
    ["hiv", "HIV"],
    ["syph", "Syphilis"],
    ["gc", "Gonorrhea"],
    ["ct", "Chlamydia"],
  ];
  const anyPositive =
    detail && Object.keys(coreState).some((k) => coreState[k] === "positive");
  const anyChronicPositive =
    detail &&
    c.infections.some((inf) => CHRONIC.includes(inf.id) && val(inf.id) === POS);
  const coreComplete = Object.keys(coreState).every(
    (k) => coreState[k] === "covered",
  );
  const coreMissing = coreList
    .filter(
      ([id]) => coreState[id] === "untouched" || coreState[id] === "partial",
    )
    .map(([, name]) => name);
  const touchedAny = c.infections.some((inf) =>
    "perSite" in inf
      ? siteStatus(inf.id) !== "untouched"
      : val(inf.id) !== c.notTested,
  );
  const anyEntered = !detail || touchedAny;
  return {
    anyPositive,
    anyChronicPositive,
    coreComplete,
    coreMissing,
    touchedAny,
    anyEntered,
  };
}

// Map the report UI state to the badge-relevant outcome. "All negative" mode is
// a one-tap full, clear core panel. In detail mode, HIV status comes from its
// pick (Undetectable is the U=U route), the core panel is complete only when
// every core infection is covered, and a core positive other than HIV is an
// active non-HIV STI. Prior-history syphilis is NOT active; undetectable HIV is
// not an active non-HIV STI.
export function reportOutcome(s: ReportState): ReportOutcome {
  if (!s.detail) {
    return { hiv: "negative", corePanelComplete: true, activeNonHivSti: false };
  }
  const hivPick = s.val("hiv");
  // Undefined when HIV was not tested, so applyReport preserves the prior status
  // (a syph/gc/ct-only report must not wipe a recorded undetectable/U=U).
  const hiv: HivStatus | undefined =
    hivPick === POS
      ? "positive_detectable"
      : hivPick === "Undetectable"
        ? "positive_undetectable"
        : hivPick === NEG
          ? "negative"
          : undefined;
  const activeNonHivSti =
    s.val("syph") === POS ||
    s.siteStatus("gc") === "positive" ||
    s.siteStatus("ct") === "positive";
  return { hiv, corePanelComplete: s.coreComplete, activeNonHivSti };
}

export function useReportState(): ReportState {
  const c = COPY;
  const [mode, setMode] = useState<string>(c.modeAll);
  const [vals, setVals] = useState<Record<string, string>>({});
  const [siteVals, setSiteVals] = useState<
    Record<string, Record<string, string>>
  >({});
  const [onPassport, setOnPassport] = useState(true);
  const val = (id: string) => vals[id] ?? c.notTested;
  const set = (id: string, v: string) => setVals((p) => ({ ...p, [id]: v }));
  const siteVal = (id: string, sk: string) => siteVals[id]?.[sk] ?? c.notTested;
  const setSite = (id: string, sk: string, v: string) =>
    setSiteVals((p) => ({ ...p, [id]: { ...(p[id] ?? {}), [sk]: v } }));
  // PANEL SCOPE: blue = the STANDARD CORE PANEL (HIV, syphilis, gonorrhea,
  // chlamydia). A multi-site infection is COVERED only when every site is clear
  // OR marked not-exposed; a single "not tested" site leaves it incomplete, so
  // it can't earn blue. Any site positive -> +.
  const siteStatus = (id: string): SiteStatus => {
    const vs = c.sites.map(([sk]) => siteVal(id, sk));
    if (vs.some((v) => v === POS)) return "positive";
    if (vs.every((v) => v === c.notTested)) return "untouched";
    return vs.every((v) => v === NEG || v === c.notExposed)
      ? "covered"
      : "partial";
  };
  const detail = mode === c.modeDetail;
  return {
    mode,
    setMode,
    onPassport,
    setOnPassport,
    detail,
    val,
    set,
    siteVal,
    setSite,
    siteStatus,
    ...derive(detail, val, siteStatus),
  };
}
