import { useState } from "react";
import { QrCode } from "../../design/icons.tsx";
import { COPY, DiscoverTile, FavesSection, PrivacySection } from "./parts.tsx";
import { RecentSection } from "./recent.tsx";
import type { ContactRecord } from "../../store/accountBlob.ts";

// People: your connections (the contacts you've connected with), via SCAN / SHARE-LINK
// only. A connection IS a contact link: there is one underlying record, shown here as a
// browsable, starrable list (newest first). Discovery is member-initiated and
// link/scan-scoped; you only ever appear to people you've scanned or sent a link to.
// No badge/status is surfaced here. Stars are a device-local display preference, never
// synced. Managing the links themselves lives in the Links tab.
export interface ConnectProps {
  /** The owner's contacts (a connection == a contact); shown newest first. */
  contacts: ContactRecord[];
  /** Today as an epoch day, for the relative "when" labels. */
  nowDay: number;
  /** Starred contact ids (device-local). */
  faves: ReadonlySet<string>;
  onToggleFave: (contactId: string) => void;
  /** Delete a contact link (the "delete connection" row action). */
  onRemoveContact: (contactId: string) => void;
  /** Open the in-app QR scanner to read someone's code. */
  onScan?: (() => void) | undefined;
}

export function Connect({
  contacts,
  nowDay,
  faves,
  onToggleFave,
  onRemoveContact,
  onScan,
}: ConnectProps) {
  const [visible, setVisible] = useState(6);
  const [menuFor, setMenuFor] = useState<string | null>(null);

  const recent = [...contacts].sort((a, b) => b.createdDay - a.createdDay);
  const faveContacts = recent.filter((c) => faves.has(c.id));

  return (
    <div style={{ width: "100%", maxWidth: 600 }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        <div>
          <h1
            style={{
              fontSize: 26,
              fontWeight: 800,
              letterSpacing: "-0.02em",
              color: "var(--text-strong)",
            }}
          >
            {COPY.title}
          </h1>
          <p
            style={{
              fontSize: 14.5,
              lineHeight: 1.55,
              color: "var(--text-body)",
              marginTop: 6,
            }}
          >
            {COPY.sub}
          </p>
        </div>

        {/* meet someone in person: scan their code to connect */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <DiscoverTile
            icon={<QrCode size={22} />}
            title={COPY.scanTile}
            sub={COPY.scanTileSub}
            onClick={onScan}
          />
        </div>

        {/* faves, starred contacts */}
        <FavesSection faves={faveContacts} onToggleFave={onToggleFave} />

        {/* recent linkups (your contacts, newest first) */}
        <RecentSection
          recent={recent}
          visible={visible}
          faves={faves}
          nowDay={nowDay}
          menuFor={menuFor}
          onToggleMenu={(id) => setMenuFor(menuFor === id ? null : id)}
          onToggleFave={onToggleFave}
          onRemove={(id) => {
            onRemoveContact(id);
            setMenuFor(null);
          }}
          onShowMore={() => setVisible((v) => v + 6)}
        />

        {/* privacy promise, no directory, member-initiated only */}
        <PrivacySection />
      </div>
    </div>
  );
}
