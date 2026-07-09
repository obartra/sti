import { Suspense, lazy } from "react";
import { Connect } from "../../connect/Connect.tsx";
import { PrivacySection } from "../../connect/parts.tsx";
import { DemoScanner } from "../../connect/DemoScanner.tsx";
import { GroupsSlot } from "./groupScreens.tsx";
import { todayEpochDay } from "../../../core/clock.ts";
import { offerUrlWithBadge, type ScannedCode } from "../../../store/index.ts";
import type { ScreenCtx, ScreenRenderers } from "./context.ts";
import "../../connect/connect.css";

// The connect screen loads lazily, like the jsQR decoder it wraps: it sits
// behind a tap, and keeping it out of the entry chunk keeps the offline-shell
// precache inside its budget (doc 22 N).
const Linkup = lazy(() =>
  import("../../connect/Linkup.tsx").then((m) => ({ default: m.Linkup })),
);

export const peopleRenderers: ScreenRenderers = {
  // People, top to bottom: scan tile, starred people, groups, then the full contact
  // list (secondary, collapsed), and the "how this stays private" card last. Starred
  // and groups are the prominent surfaces; groups thread into Connect between starred
  // and the contact list (doc 31). Managing the links you hand out lives in the Links
  // tab. The groups slot carries the "join a group by name" entry and runs the group
  // catch-up on mount (doc 33, slice 7b).
  people: (ctx) => (
    <div className="cn-screen">
      <Connect
        contacts={ctx.contacts}
        nowDay={todayEpochDay()}
        faves={ctx.faves}
        onToggleFave={ctx.onToggleFave}
        onRemoveContact={ctx.onRevokeContact}
        onScan={() => ctx.nav.go("scan")}
        groupsSlot={<GroupsSlot ctx={ctx} />}
      />
      {/* info content last, out of the way */}
      <PrivacySection />
    </div>
  ),
  // Connect in person (doc 25): one screen shows your code and runs the camera
  // at once. Scanning another connect screen's offer completes the two-way link
  // on this side; scanning any other passport code routes exactly like OPENING
  // the same link (a remote invite keeps its notify capability and its accept
  // flow, a return leg its ref). The demo has no camera and nothing real to
  // point at, so it simulates the scan and hands back the seeded peer instead
  // of opening a dead viewfinder (doc 28).
  scan: (ctx) => {
    const onView = ({ link, invite }: ScannedCode) =>
      ctx.nav.go("a2-public", {
        id: link.id,
        key: link.key,
        ...(invite !== undefined ? { notify: invite.notify } : {}),
        ...(invite?.ref !== undefined ? { ref: invite.ref } : {}),
      });
    return ctx.demoMode ? (
      <DemoScanner
        onResult={(link) => onView({ link })}
        onBack={ctx.nav.back}
      />
    ) : (
      <Suspense fallback={null}>
        <Linkup
          ownerBadge={ctx.owner.viewerBadge}
          createOffer={() => mintOffer(ctx)}
          complete={ctx.onCompleteLinkup}
          discard={ctx.onRevokeContact}
          resolvePeer={(link) => ctx.store.resolveAlias(link)}
          onViewCode={onView}
          onExit={ctx.nav.back}
          door={ctx.doorStore}
          acceptGrant={async (invite) => {
            const accepted = await ctx.onAcceptContactInvite(invite, "");
            return { contactId: accepted.contact.id, url: accepted.url };
          }}
          ingestReturn={ctx.onIngestContactReturn}
        />
      </Suspense>
    );
  },
};

// This device's offer: a fresh anonymous per-contact link (the standard path-A
// mint; the person can rename it in People afterward) with today's badge
// snapshot appended, so status crosses in the QR even with no signal (doc 25).
async function mintOffer(
  ctx: ScreenCtx,
): Promise<{ contactId: string; url: string }> {
  const minted = await ctx.onCreateContactLink("", "anonymous", null);
  const url = offerUrlWithBadge(minted.url, {
    badge: ctx.owner.viewerBadge,
    day: todayEpochDay(),
  });
  return { contactId: minted.contact.id, url };
}
