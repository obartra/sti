import { useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { Button, Card } from "../../design/components/index.ts";
import type { BadgeState } from "../badge-card.tsx";
import {
  Care as CareIcon,
  Eye,
  Share,
  Plus,
  Info,
  Lock,
  Bell,
  Check,
} from "../../design/icons.tsx";
import { PRIVACY_SCREEN_NAME } from "../../copy/canonical.ts";

export const COPY = {
  home: {
    greeting: "Good to see you,",
    meansTitle: "What this means",
    share: "Share my passport",
    quick: "Quick actions",
    report: "Add a result",
    viewAs: "See what others see",
    viewAsSub: "Preview your profile as a visitor",
    privacy: PRIVACY_SCREEN_NAME,
    nextDue: "Next test",
    remind: "Remind me",
    remindOn: "Reminder on",
    remindOnSub: "We’ll remind you 3 days before",
    remindOffSub: "Stay up to date to keep your status fresh",
  },
  pause: {
    manualOn: "Status hidden",
    manualOnSub: "Everyone sees plain gray. Resume whenever you like.",
    resume: "Resume sharing",
    autoTitle: "Status paused while you recover",
    autoSub:
      "After a positive, your card pauses on its own until you’re likely past the window. To anyone else it’s just gray.",
    autoUntil: "Earliest auto-resume",
    autoNote:
      "You can keep it paused longer, but not lift it before the guideline window.",
    extend: "Keep paused longer",
    extended: "Extended",
    ownerOnly: "Only you can see this. Viewers only ever see gray.",
  },
} as const;

// Anchored "today" + last-tested so the relative copy is stable, matching
// copy.js. Owner-facing dates only; viewers never see any of this.
export const TODAY = new Date(2026, 5, 10); // 10 Jun 2026
const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

export function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}
export function fmtDate(d: Date): string {
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

export const leadTile: CSSProperties = {
  flex: "none",
  width: 40,
  height: 40,
  borderRadius: "var(--radius-sm)",
  background: "var(--accent-soft)",
  color: "var(--text-accent)",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
};

// Two-state badge only (blue / gray). `badge` drives the next action; the
// viewer-facing `viewerBadge` drives the hero card and "what this means" copy.
export type HomeBadge = BadgeState;

interface NextAction {
  label: string;
  icon: ReactNode;
  run: (() => void) | undefined;
}

interface NextActionArgs {
  badge: HomeBadge;
  paused: boolean;
  auto: boolean;
  resume: (() => void) | undefined;
  onContinueCare: (() => void) | undefined;
  onShare: (() => void) | undefined;
  onReport: (() => void) | undefined;
}

// Status -> the single next-best action on Home. Two states only.
export function nextAction({
  badge,
  paused,
  auto,
  resume,
  onContinueCare,
  onShare,
  onReport,
}: NextActionArgs): NextAction {
  if (paused) {
    return auto
      ? {
          label: "Continue my care",
          icon: <CareIcon size={18} />,
          run: onContinueCare,
        }
      : { label: COPY.pause.resume, icon: <Eye size={18} />, run: resume };
  }
  if (badge === "blue")
    return { label: COPY.home.share, icon: <Share size={18} />, run: onShare };
  return { label: "Add a result", icon: <Plus size={18} />, run: onReport };
}

function meaning(badge: HomeBadge): string {
  return badge === "blue"
    ? "Your card shows one thing, up to date, alongside any protection facts you choose to add. It never shows what you tested for."
    : "Your card shows no status to others right now. Add a result to share an up-to-date badge, or leave it as is. Nothing here reveals any detail.";
}

// Owner-only re-test nudge. Never shown to a viewer.
export function ReminderCard({ daysLeft }: { daysLeft: number }) {
  const h = COPY.home;
  const [on, setOn] = useState(false);
  return (
    <Card
      variant="flat"
      style={{ display: "flex", alignItems: "center", gap: 14 }}
    >
      <span
        style={{
          ...leadTile,
          background: on ? "var(--surface-sunken)" : "var(--accent-soft)",
          color: on ? "var(--text-muted)" : "var(--text-accent)",
        }}
      >
        {on ? <Check size={20} /> : <Bell size={20} />}
      </span>
      <div style={{ flex: 1 }}>
        <div
          style={{ fontSize: 15, fontWeight: 600, color: "var(--text-strong)" }}
        >
          {h.nextDue} · in {Math.max(0, daysLeft)} days
        </div>
        <div style={{ fontSize: 13, color: "var(--text-muted)" }}>
          {on ? h.remindOnSub : h.remindOffSub}
        </div>
      </div>
      {on ? (
        <button
          type="button"
          onClick={() => setOn(false)}
          style={{
            appearance: "none",
            border: "none",
            background: "transparent",
            cursor: "pointer",
            display: "inline-flex",
            alignItems: "center",
            gap: 5,
            color: "var(--text-accent)",
            fontSize: 13.5,
            fontWeight: 700,
            padding: "8px 4px",
          }}
        >
          <Check size={15} /> {h.remindOn}
        </button>
      ) : (
        <Button variant="ghost" size="sm" onClick={() => setOn(true)}>
          {h.remind}
        </Button>
      )}
    </Card>
  );
}

// A quiet one-line explainer under the hero (the calm-fold home demotes the old
// "what this means" card to a single muted sentence). Owner-facing only.
export function MeansLine({ viewerBadge }: { viewerBadge: HomeBadge }) {
  return (
    <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
      <span style={{ flex: "none", marginTop: 1, color: "var(--text-subtle)" }}>
        <Info size={15} />
      </span>
      <p
        style={{
          margin: 0,
          fontSize: 13,
          lineHeight: 1.5,
          color: "var(--text-muted)",
        }}
      >
        {meaning(viewerBadge)}
      </p>
    </div>
  );
}

function QuickTile({
  icon,
  label,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  onClick: (() => void) | undefined;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        appearance: "none",
        cursor: "pointer",
        flex: 1,
        minWidth: 0,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 9,
        padding: "15px 8px",
        border: "1px solid var(--border-card)",
        borderRadius: "var(--radius-md)",
        background: "var(--surface-card)",
        boxShadow: "var(--shadow-sm)",
      }}
    >
      <span style={leadTile}>{icon}</span>
      <span
        style={{
          fontSize: 12.5,
          fontWeight: 700,
          color: "var(--text-strong)",
          textAlign: "center",
        }}
      >
        {label}
      </span>
    </button>
  );
}

// The calm-fold quick actions: three compact tiles instead of a stacked card
// list, so the fold stays short and the badge keeps the focus.
export function QuickActionsRow({
  onReport,
  onViewAs,
  onPrivacy,
}: {
  onReport: (() => void) | undefined;
  onViewAs: (() => void) | undefined;
  onPrivacy: (() => void) | undefined;
}) {
  return (
    <div style={{ display: "flex", gap: 10 }}>
      <QuickTile
        icon={<Plus size={20} />}
        label="Add result"
        onClick={onReport}
      />
      <QuickTile icon={<Eye size={20} />} label="Preview" onClick={onViewAs} />
      <QuickTile
        icon={<Lock size={20} />}
        label="Privacy"
        onClick={onPrivacy}
      />
    </div>
  );
}

// The re-test nudge when it is NOT yet due: a faint one-liner rather than the full
// reminder card, so it is present without competing with the badge.
export function RetestHint({ daysLeft }: { daysLeft: number }) {
  return (
    <p
      style={{
        margin: "2px 0 0",
        textAlign: "center",
        fontSize: 12.5,
        color: "var(--text-subtle)",
      }}
    >
      {`Next test in ${Math.max(0, daysLeft)} days. We'll keep your status fresh.`}
    </p>
  );
}
