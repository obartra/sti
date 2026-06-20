import { Button } from "../../design/components/index.ts";
import { BadgeCard } from "../badge-card.tsx";
import type { ProtectionLabel, Route } from "../badge-card.tsx";
import {
  avatarFor,
  avatarSrc,
  type AvatarConfigInput,
} from "../../lib/avatars.ts";
import {
  COPY,
  TODAY,
  addDays,
  nextAction,
  MeansCard,
  QuickActions,
  ReminderCard,
} from "./Home.parts.tsx";
import type { HomeBadge } from "./Home.parts.tsx";
import { PauseBanner } from "./Home.pause.tsx";

// C1 Home: the badge card is the hero, with the single next-best action, a
// "what this means" explainer, quick actions, and a re-test reminder. Faithful
// port of core-app.jsx Home (+ HomeCard, PauseBanner, ReminderCard, QuickRow).
// The badge is TWO-STATE only (blue / gray): the hero renders the same
// two-state BadgeCard, there is no four-light status here. Copy verbatim from
// copy.js (home + pause); the small action labels, the "what this means"
// sentences, and the quick-action subs are inline literals in the source and
// reproduced exactly.
export type { HomeBadge };

function HomeHero({
  handle,
  avatar,
  viewerBadge,
  labels,
  route,
  isPaused,
  autoPaused,
  clearBy,
  onResume,
  onExtend,
}: {
  handle: string;
  avatar: AvatarConfigInput | undefined;
  viewerBadge: HomeBadge;
  labels: ProtectionLabel[];
  route: Route;
  isPaused: boolean;
  autoPaused: boolean;
  clearBy: Date;
  onResume: (() => void) | undefined;
  onExtend: (() => void) | undefined;
}) {
  const h = COPY.home;
  return (
    <>
      <div style={{ marginTop: 2 }}>
        <div style={{ fontSize: 14, color: "var(--text-muted)" }}>
          {h.greeting}
        </div>
        <h1
          style={{
            fontSize: 26,
            fontWeight: 800,
            letterSpacing: "-0.02em",
            color: "var(--text-strong)",
          }}
        >
          {`@${handle}`}
        </h1>
      </div>

      <BadgeCard
        state={viewerBadge}
        labels={labels}
        route={route}
        identity={{ handle }}
        avatarSrc={avatar !== undefined ? avatarSrc(avatar) : avatarFor(handle)}
        width="100%"
      />

      {isPaused && (
        <PauseBanner
          autoPaused={autoPaused}
          clearBy={clearBy}
          resume={onResume}
          onExtend={onExtend}
        />
      )}
    </>
  );
}

export interface HomeProps {
  // Owner-facing status that drives the next action.
  badge?: HomeBadge;
  // The viewer-facing state of the hero card (gray while paused).
  viewerBadge?: HomeBadge;
  labels?: ProtectionLabel[];
  route?: Route;
  // Handle shown on the hero card; also the avatar fallback when no config is set.
  handle?: string;
  // The owner's chosen avatar. Falls back to the handle-derived avatar in
  // isolation (Storybook), so the real app threads the config and stories don't.
  avatar?: AvatarConfigInput;
  paused?: boolean;
  autoPaused?: boolean;
  sharingMode?: "public" | "link";
  // Days left in the freshness window, for the re-test reminder.
  daysLeft?: number;
  // The auto-pause clearance date, for the auto-pause panel.
  clearBy?: Date;
  onShare?: (() => void) | undefined;
  onReport?: (() => void) | undefined;
  onViewAs?: (() => void) | undefined;
  onPrivacy?: (() => void) | undefined;
  onContinueCare?: (() => void) | undefined;
  onResume?: (() => void) | undefined;
  // Extend the clearance auto-pause by one window (persists; never shortens).
  onExtend?: (() => void) | undefined;
}

export function Home({
  badge = "blue",
  viewerBadge = "blue",
  labels = ["hiv"],
  route = null,
  handle = "robin",
  avatar,
  paused = false,
  autoPaused = false,
  sharingMode = "link",
  daysLeft = 87,
  clearBy = addDays(TODAY, 9),
  onShare,
  onReport,
  onViewAs,
  onPrivacy,
  onContinueCare,
  onResume,
  onExtend,
}: HomeProps) {
  const isPaused = paused || autoPaused;
  const act = nextAction({
    badge,
    paused: isPaused,
    auto: autoPaused,
    resume: onResume,
    onContinueCare,
    onShare,
    onReport,
  });
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 18,
        width: "100%",
        maxWidth: 390,
      }}
    >
      <HomeHero
        handle={handle}
        avatar={avatar}
        viewerBadge={viewerBadge}
        labels={labels}
        route={route}
        isPaused={isPaused}
        autoPaused={autoPaused}
        clearBy={clearBy}
        onResume={onResume}
        onExtend={onExtend}
      />

      <Button
        variant="primary"
        size="lg"
        block
        icon={act.icon}
        onClick={act.run}
      >
        {act.label}
      </Button>

      <MeansCard isPaused={isPaused} viewerBadge={viewerBadge} />

      <QuickActions
        sharingMode={sharingMode}
        onReport={onReport}
        onViewAs={onViewAs}
        onPrivacy={onPrivacy}
      />

      <ReminderCard daysLeft={daysLeft} />
    </div>
  );
}
