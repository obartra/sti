import { Home } from "../../core/Home.tsx";
import { Care } from "../../core/Care.tsx";
import { Notifications } from "../../core/Notifications.tsx";
import type { NotificationItem } from "../../core/Notifications.tsx";
import { Privacy } from "../../core/Privacy.tsx";
import { Promises } from "../../promises/Promises.tsx";
import { FINDABLE_ENABLED } from "../../../features.ts";
import { extendClearance } from "../../../core/report.ts";
import { todayEpochDay } from "../../../core/clock.ts";
import { RESOURCES, openResource } from "../../../lib/resources.ts";
import { avatarSrc } from "../../../lib/avatars.ts";
import type { ScreenRenderers } from "./context.ts";

// The real inbox: a standing re-test nudge, plus a knock entry only when someone
// has actually knocked (no requester, no count, no per-knock time). When a knock
// carried a key the entry becomes an Approve action (grant in-app); otherwise it
// is the older contentless info row. Circle/partner-notify entries are absent
// until those features ship, so the inbox never shows an unactionable item.
export interface KnockInbox {
  canApprove: boolean;
  showInfo: boolean;
  approve: () => void;
  approving: boolean;
}

// How many days before the freshness window lapses the re-test nudge starts
// warning, so the owner can refresh before their status goes gray rather than after.
const RETEST_SOON_DAYS = 14;

/** Inputs that decide the re-test row: pause state, days left, ever-tested. */
export interface RetestState {
  /** Manually paused or in a post-positive clearance window: no re-test nudge. */
  suppressed: boolean;
  /** Days left in the 90-day freshness window (0 when untested or lapsed). */
  daysLeft: number;
  /** The owner has a recorded test (distinguishes re-test / soon from set-up). */
  tested: boolean;
}

// The re-test row, or null when not warranted. Lapsed (or never set) reads as a
// firm nudge; the last RETEST_SOON_DAYS before lapse read as an advance warning so
// the owner can refresh before going gray; otherwise nothing. Suppressed while
// paused or in a clearance window. Never shown to a freshly-tested owner.
function retestRow(
  retest: RetestState,
  go: (to: "report") => void,
): NotificationItem | null {
  if (retest.suppressed) return null;
  if (retest.daysLeft === 0) {
    return retest.tested
      ? {
          icon: "bell",
          title: "Time to re-test",
          sub: "Your status has gone gray. A fresh test brings it back.",
          onOpen: () => go("report"),
        }
      : {
          icon: "bell",
          title: "Set up your status",
          sub: "Take a test to start sharing where you stand.",
          onOpen: () => go("report"),
        };
  }
  if (retest.daysLeft <= RETEST_SOON_DAYS) {
    const days = retest.daysLeft === 1 ? "1 day" : `${retest.daysLeft} days`;
    return {
      icon: "bell",
      title: "Time to re-test soon",
      sub: `${days} left before your status goes gray.`,
      onOpen: () => go("report"),
    };
  }
  return null;
}

export function notificationItems(
  knocks: KnockInbox,
  nudge: { show: boolean; dismiss: () => void },
  retest: RetestState,
  go: (to: "report" | "privacy" | "care") => void,
): NotificationItem[] {
  const items: NotificationItem[] = [];
  // The partner-notify nudge leads when present: it is the most time-sensitive row
  // (PEP is most effective within 72h). Contentless, so it never names the contact;
  // opening it routes to Care and clears the row for the session.
  if (nudge.show) {
    items.push({
      icon: "heart",
      title: "A recent contact suggests getting tested",
      sub: "Find testing and PEP options in Care",
      onOpen: () => {
        nudge.dismiss();
        go("care");
      },
    });
  }
  const retestItem = retestRow(retest, go);
  if (retestItem !== null) items.push(retestItem);
  if (knocks.canApprove) {
    items.push({
      icon: "users",
      title: "Someone with your link asked to see your status",
      sub: "Approve to let them see your current status",
      action: {
        label: "Approve",
        onAct: knocks.approve,
        busy: knocks.approving,
      },
    });
  } else if (knocks.showInfo) {
    items.push({
      icon: "users",
      title: "Someone with your link asked to see your status",
      sub: "Share an up-to-date link with people you choose",
      onOpen: () => go("privacy"),
    });
  }
  return items;
}

export const coreRenderers: ScreenRenderers = {
  home: ({ nav, owner, openShare, setOwnerState }) => (
    <Home
      badge={owner.badge}
      viewerBadge={owner.viewerBadge}
      labels={owner.labels}
      route={owner.blueRoute}
      handle={owner.handle}
      avatar={owner.avatar}
      paused={owner.paused}
      autoPaused={owner.autoPaused}
      clearBy={owner.clearBy}
      sharingMode={owner.sharingMode}
      daysLeft={owner.daysLeft}
      onShare={openShare}
      onReport={() => nav.go("report")}
      onViewAs={() => nav.go("a2-public", { self: true })}
      onPrivacy={() => nav.go("privacy")}
      onContinueCare={() => nav.go("care")}
      onExtend={() => setOwnerState((s) => extendClearance(s, todayEpochDay()))}
    />
  ),
  care: ({ nav, owner }) => (
    <Care
      badge={owner.badge}
      onLearn={() => nav.go("learn")}
      onFindClinic={() => openResource(RESOURCES.clinic)}
      onLearnOfficial={() => openResource(RESOURCES.clinic)}
      onFindCondoms={() => openResource(RESOURCES.condoms)}
      onFindPep={() => openResource(RESOURCES.pep)}
      onFindPrep={() => openResource(RESOURCES.prep)}
    />
  ),
  notifications: ({
    nav,
    owner,
    ownerState,
    canApproveKnocks,
    showKnockInfo,
    approveKnocks,
    approvingKnocks,
    refreshKnocks,
    showPartnerNudge,
    dismissPartnerNudge,
  }) => (
    <Notifications
      items={notificationItems(
        {
          canApprove: canApproveKnocks,
          showInfo: showKnockInfo,
          approve: approveKnocks,
          approving: approvingKnocks,
        },
        { show: showPartnerNudge, dismiss: dismissPartnerNudge },
        {
          suppressed: owner.paused || owner.autoPaused,
          daysLeft: owner.daysLeft,
          tested: ownerState.testing.lastPanelDay !== null,
        },
        (to) => nav.go(to),
      )}
      onView={refreshKnocks}
    />
  ),
  privacy: ({
    nav,
    owner,
    ownerState,
    setOwnerState,
    onDeleteAccount,
    aliases,
    contacts,
    onRevokeAlias,
    onRevokeContact,
    vanityName,
    onRegisterVanityName,
    onReleaseVanityName,
    push,
    isLoggedIn,
  }) => (
    <Privacy
      ownerState={ownerState}
      setOwnerState={setOwnerState}
      aliases={aliases}
      contacts={contacts}
      onRevokeAlias={onRevokeAlias}
      onRevokeContact={onRevokeContact}
      push={push}
      avatarSrc={avatarSrc(owner.avatar)}
      onEditAvatar={isLoggedIn ? () => nav.go("avatar-edit") : undefined}
      onViewAs={() => nav.go("a2-public", { self: true })}
      onViewPromises={() => nav.go("promises")}
      // The Findable section is gated here, at the wiring boundary, so the Privacy
      // screen + FindableName stay flag-agnostic (and storyable): present the ops
      // only when the flag is on and the owner is logged in.
      vanityName={vanityName}
      findableOps={
        FINDABLE_ENABLED && isLoggedIn
          ? { register: onRegisterVanityName, release: onReleaseVanityName }
          : undefined
      }
      onDeleted={() => {
        // Really delete (revoke links + remove the blob, logs out), then reset
        // the URL to the public landing.
        onDeleteAccount();
        nav.jump("a1-landing", "public");
      }}
    />
  ),
  promises: () => <Promises />,
};
