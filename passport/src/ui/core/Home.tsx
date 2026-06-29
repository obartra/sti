import { Button } from "../../design/components/index.ts";
import { BadgeCard } from "../badge-card.tsx";
import type { ProtectionLabel, Route } from "../badge-card.tsx";
import { avatarSrc, type AvatarConfigInput } from "../../lib/avatars.ts";
import {
  TODAY,
  addDays,
  nextAction,
  MeansLine,
  QuickActionsRow,
  ReminderCard,
  RetestHint,
} from "./Home.parts.tsx";
import type { HomeBadge } from "./Home.parts.tsx";
import { PauseBanner } from "./Home.pause.tsx";

// C1 Home (calm fold): the badge card is the hero, with the single next-best
// action right under it. The rest is demoted so the status keeps the focus, a
// quiet one-line "what this means", a compact row of quick actions, and a re-test
// nudge that only becomes a full card when it is actually due. The badge is
// TWO-STATE only (blue / gray); there is no four-light status here.
export type { HomeBadge };

// How close to the freshness lapse the re-test nudge earns a full card (vs the
// faint hint). Mirrors the inbox's "re-test soon" window.
const RETEST_SOON_DAYS = 14;

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
  handle: string | undefined;
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
  return (
    <>
      <div style={{ marginTop: 2 }}>
        <h1
          style={{
            fontSize: 26,
            fontWeight: 800,
            letterSpacing: "-0.02em",
            color: "var(--text-strong)",
          }}
        >
          {handle ? `Good to see you, @${handle}` : "Hey there!"}
        </h1>
      </div>

      <BadgeCard
        state={viewerBadge}
        labels={labels}
        route={route}
        identity={handle ? { handle } : null}
        avatarSrc={avatar !== undefined ? avatarSrc(avatar) : undefined}
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
  handle,
  avatar,
  paused = false,
  autoPaused = false,
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
        gap: 16,
        width: "100%",
        maxWidth: 600,
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

      <HomeExtras
        isPaused={isPaused}
        viewerBadge={viewerBadge}
        daysLeft={daysLeft}
        onReport={onReport}
        onViewAs={onViewAs}
        onPrivacy={onPrivacy}
      />
    </div>
  );
}

// The demoted, below-the-hero content: a quiet meaning line, the compact quick
// actions, and the re-test nudge (suppressed while paused; a full card only when
// the freshness window is close to lapsing, else a faint hint).
function HomeExtras({
  isPaused,
  viewerBadge,
  daysLeft,
  onReport,
  onViewAs,
  onPrivacy,
}: {
  isPaused: boolean;
  viewerBadge: HomeBadge;
  daysLeft: number;
  onReport: (() => void) | undefined;
  onViewAs: (() => void) | undefined;
  onPrivacy: (() => void) | undefined;
}) {
  const retestDue = daysLeft <= RETEST_SOON_DAYS;
  return (
    <>
      {!isPaused && <MeansLine viewerBadge={viewerBadge} />}

      <QuickActionsRow
        onReport={onReport}
        onViewAs={onViewAs}
        onPrivacy={onPrivacy}
      />

      {!isPaused &&
        (retestDue ? (
          <ReminderCard daysLeft={daysLeft} />
        ) : (
          <RetestHint daysLeft={daysLeft} />
        ))}
    </>
  );
}
