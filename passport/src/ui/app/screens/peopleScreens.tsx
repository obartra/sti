import { Connect } from "../../connect/Connect.tsx";
import { GroupsList } from "../../groups/GroupsList.tsx";
import { PrivacySection } from "../../connect/parts.tsx";
import { QrScanner } from "../../connect/QrScanner.tsx";
import { todayEpochDay } from "../../../core/clock.ts";
import type { ScreenRenderers } from "./context.ts";

export const peopleRenderers: ScreenRenderers = {
  // People, top to bottom: scan tile, starred people, groups, then the full contact
  // list (secondary, collapsed), and the "how this stays private" card last. Starred
  // and groups are the prominent surfaces; groups thread into Connect between starred
  // and the contact list (doc 31). Managing the links you hand out lives in the Links
  // tab.
  people: ({ nav, contacts, faves, onToggleFave, onRevokeContact, groups }) => (
    <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
      <Connect
        contacts={contacts}
        nowDay={todayEpochDay()}
        faves={faves}
        onToggleFave={onToggleFave}
        onRemoveContact={onRevokeContact}
        onScan={() => nav.go("scan")}
        groupsSlot={
          <GroupsList
            groups={groups}
            onCreate={() => nav.go("group-create")}
            onOpenGroup={(id) => nav.go("group-detail", { id })}
          />
        }
      />
      {/* info content last, out of the way */}
      <PrivacySection />
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
