import { Connect } from "../../connect/Connect.tsx";
import { PrivacySection } from "../../connect/parts.tsx";
import { QrScanner } from "../../connect/QrScanner.tsx";
import { DemoScanner } from "../../connect/DemoScanner.tsx";
import type { ScannedCode } from "../../../store/index.ts";
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
  // Scan someone's QR to open their passport: a decoded code routes to the public
  // resolution screen exactly like opening the same link in a browser, so a
  // scanned contact invite keeps its notify capability (and a return leg its ref)
  // and offers the add/connect affordance there. The demo has no camera and
  // nothing real to point at, so it simulates the scan and hands back the seeded
  // peer instead of opening a dead viewfinder (doc 28).
  scan: ({ nav, demoMode }) => {
    const onResult = ({ link, invite }: ScannedCode) =>
      nav.go("a2-public", {
        id: link.id,
        key: link.key,
        ...(invite !== undefined ? { notify: invite.notify } : {}),
        ...(invite?.ref !== undefined ? { ref: invite.ref } : {}),
      });
    return demoMode ? (
      <DemoScanner onResult={(link) => onResult({ link })} onBack={nav.back} />
    ) : (
      <QrScanner onResult={onResult} onBack={nav.back} />
    );
  },
};
