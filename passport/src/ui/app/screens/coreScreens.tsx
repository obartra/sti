import { Home } from "../../core/Home.tsx";
import { Results } from "../../core/Results.tsx";
import { Care } from "../../core/Care.tsx";
import { Notifications } from "../../core/Notifications.tsx";
import type { NotificationItem } from "../../core/Notifications.tsx";
import { Privacy } from "../../core/Privacy.tsx";
import { extendClearance } from "../../../core/report.ts";
import { todayEpochDay } from "../../../core/clock.ts";
import { RESOURCES, openResource } from "../../../lib/resources.ts";
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

export function notificationItems(
  knocks: KnockInbox,
  nudge: { show: boolean; dismiss: () => void },
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
  items.push({
    icon: "bell",
    title: "Time to re-test soon",
    sub: "Keep your status up to date",
    onOpen: () => go("report"),
  });
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
  results: () => <Results />,
  care: ({ nav, owner }) => (
    <Care
      badge={owner.badge}
      onLearn={() => nav.go("learn")}
      onFindClinic={() => openResource(RESOURCES.clinic)}
      onLearnOfficial={() => openResource(RESOURCES.clinic)}
      onFindCondoms={() => openResource(RESOURCES.condoms)}
      onFindPrep={() => openResource(RESOURCES.prep)}
    />
  ),
  notifications: ({
    nav,
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
        (to) => nav.go(to),
      )}
      onView={refreshKnocks}
    />
  ),
  privacy: ({
    nav,
    ownerState,
    setOwnerState,
    onDeleteAccount,
    aliases,
    contacts,
    onRevokeAlias,
    onRevokeContact,
  }) => (
    <Privacy
      ownerState={ownerState}
      setOwnerState={setOwnerState}
      aliases={aliases}
      contacts={contacts}
      onRevokeAlias={onRevokeAlias}
      onRevokeContact={onRevokeContact}
      onViewAs={() => nav.go("a2-public", { self: true })}
      onDeleted={() => {
        // Really delete (revoke links + remove the blob, logs out), then reset
        // the URL to the public landing.
        onDeleteAccount();
        nav.jump("a1-landing", "public");
      }}
    />
  ),
};
