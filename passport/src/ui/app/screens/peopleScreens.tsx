import { Connect } from "../../connect/Connect.tsx";
import { PrivacySection } from "../../connect/parts.tsx";
import { QrScanner } from "../../connect/QrScanner.tsx";
import { DemoScanner } from "../../connect/DemoScanner.tsx";
import { GroupsSlot } from "./groupScreens.tsx";
import { todayEpochDay } from "../../../core/clock.ts";
import type { ScreenRenderers } from "./context.ts";
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
  // Scan someone's QR to open their passport: a decoded alias link routes to the
  // public resolution screen (the same flow as opening the link in a browser). The
  // demo has no camera and nothing real to point at, so it simulates the scan and
  // hands back the seeded peer instead of opening a dead viewfinder (doc 28).
  scan: ({ nav, demoMode }) => {
    const onResult = (link: { id: string; key: string }) =>
      nav.go("a2-public", { id: link.id, key: link.key });
    return demoMode ? (
      <DemoScanner onResult={onResult} onBack={nav.back} />
    ) : (
      <QrScanner onResult={onResult} onBack={nav.back} />
    );
  },
};
