import { Connect } from "../../connect/Connect.tsx";
import { GroupsList } from "../../groups/GroupsList.tsx";
import { QrScanner } from "../../connect/QrScanner.tsx";
import { todayEpochDay } from "../../../core/clock.ts";
import type { ScreenRenderers } from "./context.ts";

export const peopleRenderers: ScreenRenderers = {
  // People: your connections (starred, then recent) with the scan tile to meet
  // someone in person, and your groups folded in below (doc 31). Managing the links
  // you hand out lives in the Links tab.
  people: ({
    nav,
    contacts,
    faves,
    onToggleFave,
    onRevokeContact,
    circles,
  }) => (
    <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
      <Connect
        contacts={contacts}
        nowDay={todayEpochDay()}
        faves={faves}
        onToggleFave={onToggleFave}
        onRemoveContact={onRevokeContact}
        onScan={() => nav.go("scan")}
      />
      <GroupsList
        circles={circles}
        onCreate={() => nav.go("group-create")}
        onOpenGroup={(id) => nav.go("group-detail", { id })}
      />
    </div>
  ),
  // Scan someone's QR to open their passport: a decoded alias link routes to the
  // public resolution screen (the same flow as opening the link in a browser).
  scan: ({ nav }) => (
    <QrScanner
      onResult={(link) => nav.go("a2-public", { id: link.id, key: link.key })}
      onBack={nav.back}
    />
  ),
};
