import { Connect } from "../../connect/Connect.tsx";
import { PrivacySection } from "../../connect/parts.tsx";
import { Linkup } from "../../connect/Linkup.tsx";
import { DemoScanner } from "../../connect/DemoScanner.tsx";
import { GroupsSlot } from "./groupScreens.tsx";
import { todayEpochDay } from "../../../core/clock.ts";
import { offerUrlWithBadge } from "../../../store/index.ts";
import type { ScreenCtx, ScreenRenderers } from "./context.ts";
import "../../connect/connect.css";

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
  // at once. Scanning another connect screen completes the two-way link on this
  // side; scanning a plain shared link still routes to the public resolution
  // screen, exactly what scanning did before the gesture existed. The demo has
  // no camera and nothing real to point at, so it simulates the scan and hands
  // back the seeded peer instead of opening a dead viewfinder (doc 28).
  scan: (ctx) => {
    const onView = (link: { id: string; key: string }) =>
      ctx.nav.go("a2-public", { id: link.id, key: link.key });
    return ctx.demoMode ? (
      <DemoScanner onResult={onView} onBack={ctx.nav.back} />
    ) : (
      <Linkup
        ownerBadge={ctx.owner.viewerBadge}
        createOffer={() => mintOffer(ctx)}
        complete={ctx.onCompleteLinkup}
        discard={ctx.onRevokeContact}
        resolvePeer={(link) => ctx.store.resolveAlias(link)}
        onViewLink={onView}
        onExit={ctx.nav.back}
        door={ctx.doorStore}
        acceptGrant={async (invite) => {
          const accepted = await ctx.onAcceptContactInvite(invite, "");
          return { contactId: accepted.contact.id, url: accepted.url };
        }}
        ingestReturn={ctx.onIngestContactReturn}
      />
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
