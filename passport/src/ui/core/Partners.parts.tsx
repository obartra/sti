import { useState } from "react";
import type { CSSProperties, ReactNode } from "react";

// C5 Partner alert review. Faithful port of comps-reference/app/core-flows.jsx
// (Partners + PartnersSent + the in-file Step / MoreDots helpers). Copy
// reproduced VERBATIM from copy.js (partners object) as inline COPY.
//
// CONTENTLESS by design: a partner alert never names a condition, never shows a
// positive, never carries a status. The viewer badge is two-state elsewhere; it
// does not appear here at all. The amber/red tones below are pure urgency /
// danger affordances (a "send to one person" caution, a destructive delete),
// NOT a status model.
export const COPY = {
  title: "Your recent partners get an anonymous heads-up",
  sub: "This happens whenever a positive is reported. It’s automatic, it’s how sti.care keeps everyone safer, and your name is never shared. Review the list before it goes out.",
  searchPlaceholder: "Search linkups",
  showAll: "Show all",
  showMore: "Show more",
  menuRemove: "Remove from this alert",
  batchTitle: "You get 30 minutes to change your mind",
  batchNote:
    "When you commit, the report doesn’t go out right away. It stays a draft you can edit, or delete entirely, for 30 minutes. After that it’s final and out of your hands.",
  previewBanner: "Previewing what they’ll receive",
  backToReview: "Back to review",
  steps: [
    [
      "You stay anonymous",
      "They never see your name, handle, or any health detail.",
    ],
    [
      "They get a clear prompt",
      "“A recent contact suggests getting tested. It’s quick and often free.”",
    ],
    ["They’re guided to care", "Straight to free in-person testing near them."],
  ] as const,
  recipientsTitle: "Who gets notified",
  circlesTitle: "Circles you’re in are covered too",
  circlesBody:
    "Recent contacts, including the small circles and events you’ve checked into, get the same anonymous heads-up. No one sees a name, a count, or which infection.",
  sinceTest: "Since your last test",
  earlierTitle: "Earlier linkups",
  earlierSub:
    "Before your last clear test, so not notified unless you add them.",
  fromConnections:
    "These come from the linkups you logged in Connect. Add or remove anyone.",
  add: "Add",
  addLabel: "Add someone we missed",
  addPlaceholder: "@handle",
  addHint: "Only people on sti.care can be notified, by their handle.",
  matchNote:
    "Matched privately and never stored against your name. You decide who is on this list.",
  messageTitle: "Exactly what they’ll receive",
  previewAlert: "Preview the alert",
  messageBody:
    "A recent contact suggests getting tested. It’s quick, and often free. No name, no details.",
  anonTitle: "Anonymity check",
  anonOk: "Your recent partners will get an anonymous heads-up.",
  anonSingle:
    "A heads-up to just one person can be a little easier to trace back to you. You can still send, or add another if you’d rather not stand out.",
  confirm: "I’ve reviewed this list and it’s right",
  send: "Commit this report",
  decline: "Not now",
  draftEyebrow: "Draft",
  draftTitle: "Your report is in a draft window",
  draftSub:
    "You can still add, correct, or remove anyone, or delete the whole report. When the window closes it locks, and we take it from there.",
  draftLocksIn: "Locks in about 30 minutes. You can keep editing until then.",
  draftListTitle: "Who’s included",
  draftAdd: "Add someone",
  draftAddPlaceholder: "@handle",
  draftSave: "Save changes",
  draftSaved: "Draft updated",
  lockNow: "Lock it in now",
  deleteReport: "Delete this entire report",
  deleteReportNote:
    "Frictionless: removes the whole report before it locks. Nothing goes out, no trace left.",
  confirmDeleteTitle: "Delete the whole report?",
  confirmDeleteBody:
    "This removes everyone and cancels the report. It can’t be undone, but nothing has gone out yet.",
  confirmDeleteYes: "Delete report",
  confirmDeleteNo: "Keep editing",
  lockedTitle: "This report is locked",
  lockedBody:
    "It’s final now, and out of your hands by design. There’s no delivery status, no timing, and no list to check, nothing here to track or undo.",
  lockedReassure:
    "Letting go is the safe part. The rest happens quietly, with nothing pointing back to you.",
  lockedCta: "Continue my care",
};

export const fieldLbl: CSSProperties = {
  fontSize: 14,
  fontWeight: 600,
  color: "var(--text-body)",
  marginBottom: 10,
};

export const inputShell: CSSProperties = {
  flex: 1,
  border: "none",
  outline: "none",
  background: "transparent",
  font: "inherit",
  fontSize: 14,
  color: "var(--text-strong)",
};

// A recipient row. `kind` switches the leading visual (avatar vs contact glyph).
export interface Recipient {
  handle: string;
  when: string;
  kind?: "email" | "phone";
}

// Default linkups, mirrors window.LinkupStore.buckets() seeded against the
// reference NOW (2026-06-18) / last clear test (7 Jun). `since` are recent
// enough to be notified; `earlier` predate the last clear test.
export const DEFAULT_SINCE: Recipient[] = [
  { handle: "sam", when: "9 Jun" },
  { handle: "leo", when: "8 Jun" },
  { handle: "ari", when: "8 Jun" },
  { handle: "noa.v", when: "7 Jun" },
  { handle: "marco", when: "7 Jun" },
];

export const DEFAULT_EARLIER: Recipient[] = [
  { handle: "kai_", when: "4 Jun" },
  { handle: "alexj", when: "29 May" },
  { handle: "jules", when: "26 May" },
  { handle: "theo", when: "21 May" },
  { handle: "max.b", when: "18 May" },
  { handle: "rio", when: "12 May" },
  { handle: "dann", when: "8 May" },
  { handle: "sasha", when: "2 May" },
  { handle: "kit", when: "27 Apr" },
  { handle: "nico", when: "22 Apr" },
  { handle: "ben10", when: "15 Apr" },
  { handle: "ozzy", when: "9 Apr" },
  { handle: "finn", when: "2 Apr" },
  { handle: "remy", when: "28 Mar" },
  { handle: "cass", when: "22 Mar" },
  { handle: "jay", when: "18 Mar" },
  { handle: "mika", when: "14 Mar" },
  { handle: "drew", when: "12 Mar" },
];

export function Step({
  icon,
  title,
  children,
}: {
  icon: ReactNode;
  title: ReactNode;
  children: ReactNode;
}) {
  return (
    <div style={{ display: "flex", gap: 12 }}>
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          width: 36,
          height: 36,
          borderRadius: "var(--radius-pill)",
          background: "var(--accent-soft)",
          color: "var(--text-accent)",
          flex: "none",
        }}
      >
        {icon}
      </span>
      <div>
        <div
          style={{ fontSize: 15, fontWeight: 600, color: "var(--text-strong)" }}
        >
          {title}
        </div>
        <div
          style={{
            fontSize: 13.5,
            color: "var(--text-muted)",
            lineHeight: 1.45,
          }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}

// Inline "more" (...) icon for row overflow menus.
export function MoreDots({ size = 18 }: { size?: number }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="currentColor"
      aria-hidden
    >
      <circle cx="5" cy="12" r="1.8" />
      <circle cx="12" cy="12" r="1.8" />
      <circle cx="19" cy="12" r="1.8" />
    </svg>
  );
}

export function ContactLead({ children }: { children: ReactNode }) {
  return (
    <span
      style={{
        flex: "none",
        width: 34,
        height: 34,
        borderRadius: "var(--radius-sm)",
        background: "var(--accent-soft)",
        color: "var(--text-accent)",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {children}
    </span>
  );
}

export interface PartnersState {
  recipients: Recipient[];
  earlier: Recipient[];
  query: string;
  setQuery: (v: string) => void;
  showAllR: boolean;
  setShowAllR: (v: boolean) => void;
  visEarlier: number;
  setVisEarlier: (fn: (v: number) => number) => void;
  menuFor: string | null;
  setMenuFor: (v: string | null) => void;
  draft: string;
  setDraft: (v: string) => void;
  q: string;
  fr: Recipient[];
  fe: Recipient[];
  rShown: Recipient[];
  eShown: Recipient[];
  addDraft: () => void;
  remove: (h: string) => void;
  addEarlier: (h: string) => void;
  safe: boolean;
  canSend: boolean;
}

// The K threshold is a GENTLE nudge, never a gate: a user with a single
// recent partner must still be able to send. canSend only requires >= 1.
const K = 2;

function filterLists(args: {
  query: string;
  recipients: Recipient[];
  earlier: Recipient[];
  showAllR: boolean;
  visEarlier: number;
}) {
  const { query, recipients, earlier, showAllR, visEarlier } = args;
  const q = query.toLowerCase().trim().replace(/^@/, "");
  const match = (r: Recipient) => !q || r.handle.toLowerCase().includes(q);
  const fr = recipients.filter(match);
  const fe = earlier.filter(match);
  const rShown = showAllR || q ? fr : fr.slice(0, 5);
  const eShown = q ? fe : fe.slice(0, visEarlier);
  return { q, fr, fe, rShown, eShown };
}

export function usePartnersState(
  initialRecipients: Recipient[],
  initialEarlier: Recipient[],
): PartnersState {
  const [recipients, setRecipients] = useState<Recipient[]>(initialRecipients);
  const [earlier, setEarlier] = useState<Recipient[]>(initialEarlier);
  const [query, setQuery] = useState("");
  const [showAllR, setShowAllR] = useState(false);
  const [visEarlier, setVisEarlier] = useState(6);
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const { q, fr, fe, rShown, eShown } = filterLists({
    query,
    recipients,
    earlier,
    showAllR,
    visEarlier,
  });

  const addDraft = () => {
    const raw = draft.trim();
    if (!raw) return;
    const handle = raw
      .replace(/^@/, "")
      .replace(/[^a-z0-9_]/gi, "")
      .toLowerCase();
    if (!handle) return;
    setRecipients((p) =>
      p.some((r) => r.handle === handle)
        ? p
        : [...p, { handle, when: "Added by you" }],
    );
    setDraft("");
    setShowAllR(true);
  };
  // Removed recipients drop into "earlier" so the choice is reversible.
  const remove = (h: string) => {
    const item = recipients.find((r) => r.handle === h);
    setRecipients((p) => p.filter((r) => r.handle !== h));
    if (item) setEarlier((p) => [item, ...p]);
    setMenuFor(null);
  };
  const addEarlier = (h: string) => {
    const item = earlier.find((e) => e.handle === h);
    setEarlier((p) => p.filter((e) => e.handle !== h));
    if (item) setRecipients((p) => [...p, item]);
  };
  const safe = recipients.length >= K;
  const canSend = recipients.length >= 1;

  return {
    recipients,
    earlier,
    query,
    setQuery,
    showAllR,
    setShowAllR,
    visEarlier,
    setVisEarlier,
    menuFor,
    setMenuFor,
    draft,
    setDraft,
    q,
    fr,
    fe,
    rShown,
    eShown,
    addDraft,
    remove,
    addEarlier,
    safe,
    canSend,
  };
}
