import { useState } from "react";
import { Link } from "../../design/icons.tsx";
import { COPY, DiscoverTile, FavesSection, PrivacySection } from "./parts.tsx";
import { RecentSection } from "./recent.tsx";
import type { ContactRecord } from "../../store/accountBlob.ts";

// Connect: your linkups (the contacts you've connected with), via SCAN / SHARE-LINK
// only. A linkup IS a contact link: there is one underlying record, shown here as a
// browsable, starrable list (newest first) and managed as links under "Share my
// link". Discovery is member-initiated and link/scan-scoped; you only ever appear to
// people you've scanned or sent a link to. No badge/status is surfaced here. Faves
// (stars) are a device-local display preference, never synced.
export interface ConnectProps {
  /** The owner's contacts (a linkup == a contact); shown newest first. */
  contacts: ContactRecord[];
  /** Today as an epoch day, for the relative "when" labels. */
  nowDay: number;
  /** Starred contact ids (device-local). */
  faves: ReadonlySet<string>;
  onToggleFave: (contactId: string) => void;
  /** Delete a contact link (the "delete linkup" row action). */
  onRemoveContact: (contactId: string) => void;
  onShareLink?: (() => void) | undefined;
}

export function Connect({
  contacts,
  nowDay,
  faves,
  onToggleFave,
  onRemoveContact,
  onShareLink,
}: ConnectProps) {
  const [visible, setVisible] = useState(6);
  const [menuFor, setMenuFor] = useState<string | null>(null);

  const recent = [...contacts].sort((a, b) => b.createdDay - a.createdDay);
  const faveContacts = recent.filter((c) => faves.has(c.id));

  return (
    <div style={{ width: "100%", maxWidth: 390 }}>
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

        {/* share a link, the supported way to connect (scan/NFC ride on slice 7) */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <DiscoverTile
            icon={<Link size={22} />}
            title={COPY.shareTile}
            sub={COPY.shareTileSub}
            onClick={onShareLink}
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
