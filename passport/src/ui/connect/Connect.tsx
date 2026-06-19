import { useState } from "react";
import { Sparkle, QrCode, Link } from "../../design/icons.tsx";
import {
  COPY,
  DiscoverTile,
  FavesSection,
  PendingSection,
  PrivacySection,
} from "./parts.tsx";
import { RecentSection } from "./recent.tsx";

// Connect: linkups (hookups) + faves for repeats, via SCAN / SHARE-LINK only.
// Faithful port of comps-reference/app/connect.jsx (the Connect component plus
// its helpers SectionHead, HandleAvatar, DiscoverTile), copy verbatim from the
// connect object in copy.js. Discovery is member-initiated and link/scan-scoped:
// you only ever appear to people you've scanned or sent a link to. There is no
// badge/status surfaced anywhere on this screen; the gold star and red delete
// are pure decoration/urgency, not a status model.

// Faves stay local, they are a display preference, not part of the notify edge.
const INITIAL_FAVES = ["sam", "alexj", "kai_"];

export interface PendingLinkup {
  handle: string;
  when: string;
}

export interface RecentLinkup {
  handle: string;
  when: string;
}

// Recent linkups, the most-recent encounter per alias. In the app these come
// from the on-device LinkupStore; here they are in-file fixtures.
const RECENT_LINKUPS: RecentLinkup[] = [
  { handle: "sam", when: "Today" },
  { handle: "alexj", when: "Yesterday" },
  { handle: "kai_", when: "2 days ago" },
  { handle: "noor", when: "4 days ago" },
  { handle: "devs", when: "1 week ago" },
  { handle: "max_t", when: "2 weeks ago" },
  { handle: "riley", when: "3 weeks ago" },
  { handle: "jess", when: "1 month ago" },
];

const INITIAL_PENDING: PendingLinkup[] = [{ handle: "theo", when: "3h ago" }];

export interface ConnectProps {
  onLinkup?: (() => void) | undefined;
  onScanLink?: (() => void) | undefined;
  onShareLink?: (() => void) | undefined;
  /** Seed the recent linkups list (defaults to in-file fixtures). */
  linkups?: RecentLinkup[];
  /** Seed the pending "waiting on you" list (defaults to one entry). */
  pending?: PendingLinkup[];
  /** Seed the starred faves (defaults to three). */
  initialFaves?: string[];
}

export function Connect({
  onLinkup,
  onScanLink,
  onShareLink,
  linkups = RECENT_LINKUPS,
  pending: pendingSeed = INITIAL_PENDING,
  initialFaves = INITIAL_FAVES,
}: ConnectProps) {
  // "Waiting on you" = the recipient side of a scan: someone you scanned
  // proposed a link; you confirm to bind. NOT a stranger request.
  const [pending, setPending] = useState<PendingLinkup[]>(pendingSeed);
  const [recent, setRecent] = useState<RecentLinkup[]>(linkups);
  const [faves, setFaves] = useState<string[]>(initialFaves);
  const [visible, setVisible] = useState(6);
  const [menuFor, setMenuFor] = useState<number | null>(null);
  const [favesFullNote, setFavesFullNote] = useState(false);

  const confirmPending = (handle: string) =>
    setPending((p) => p.filter((s) => s.handle !== handle));
  const dismissPending = (handle: string) =>
    setPending((p) => p.filter((s) => s.handle !== handle));
  const removeLinkup = (handle: string) => {
    setRecent((r) => r.filter((l) => l.handle !== handle));
    setMenuFor(null);
  };
  const toggleFave = (handle: string) => {
    setFaves((p) => {
      if (p.includes(handle)) {
        setFavesFullNote(false);
        return p.filter((h) => h !== handle);
      }
      if (p.length >= 9) {
        setFavesFullNote(true);
        return p;
      }
      setFavesFullNote(false);
      return [...p, handle];
    });
    setMenuFor(null);
  };

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

        {/* scan / share discovery, the only ways to connect */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <DiscoverTile
            icon={<Sparkle size={22} />}
            title={COPY.linkupTile}
            sub={COPY.linkupTileSub}
            onClick={onLinkup}
          />
          <DiscoverTile
            icon={<QrCode size={22} />}
            title={COPY.scanTile}
            sub={COPY.scanTileSub}
            onClick={onScanLink}
          />
          <DiscoverTile
            icon={<Link size={22} />}
            title={COPY.shareTile}
            sub={COPY.shareTileSub}
            onClick={onShareLink}
          />
        </div>

        {/* waiting on you, recipient side of a scan */}
        {pending.length > 0 && (
          <PendingSection
            pending={pending}
            onConfirm={confirmPending}
            onDismiss={dismissPending}
          />
        )}

        {/* faves, starred people, capped */}
        <FavesSection
          faves={faves}
          favesFullNote={favesFullNote}
          onToggleFave={toggleFave}
        />

        {/* recent linkups */}
        <RecentSection
          recent={recent}
          visible={visible}
          faves={faves}
          menuFor={menuFor}
          onToggleMenu={(i) => setMenuFor(menuFor === i ? null : i)}
          onToggleFave={toggleFave}
          onRemove={removeLinkup}
          onShowMore={() => setVisible((v) => v + 6)}
        />

        {/* privacy promise, no directory, member-initiated only */}
        <PrivacySection />
      </div>
    </div>
  );
}
