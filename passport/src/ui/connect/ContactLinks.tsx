import { useState } from "react";
import {
  Button,
  Card,
  Input,
  Segmented,
} from "../../design/components/index.ts";
import { Link, Trash, Dots } from "../../design/icons.tsx";
import { AvatarCard } from "../onboarding/AvatarCard.tsx";
import { IdentityChoiceRow } from "../share/ShareSheet.identity.tsx";
import { DAY_MS } from "../../core/clock.ts";
import { CreatedLink, IngestReturn } from "./ContactLinks.parts.tsx";
import type {
  AliasIdentity,
  ContactInvite,
  ContactRecord,
} from "../../store/index.ts";

/* ContactLinks: the owner's per-contact private links (doc 13). Each link is for
   one person, individually revocable, and expires on its own (default 7 days).
   The link carries the key, so the recipient opens it directly. No status is
   shown here; this is link management, not a viewer surface. */

// The lifetimes a link can be minted with, as a duration in ms from now (doc 16);
// null means until-revoked. 7 days is the default, matching the prior behavior.
const DURATIONS: { key: string; label: string; ms: number | null }[] = [
  { key: "1", label: "24h", ms: DAY_MS },
  { key: "7", label: "7 days", ms: 7 * DAY_MS },
  { key: "30", label: "30 days", ms: 30 * DAY_MS },
  { key: "none", label: "No expiry", ms: null },
];
const DEFAULT_DURATION = "7";

function durationMsFor(key: string): number | null {
  return DURATIONS.find((d) => d.key === key)?.ms ?? null;
}

export interface ContactLinksProps {
  contacts: ContactRecord[];
  /** Now as epoch ms, for the expiry countdown. */
  now: number;
  /** Mint a new link for `label` with a chosen lifetime (ms from now, or null for
   * until-revoked) and a face (anonymous, or the owner's name); resolves with the
   * shareable URL. */
  onCreate: (
    label: string,
    durationMs: number | null,
    identity: AliasIdentity,
  ) => Promise<{ url: string }>;
  onRevoke: (id: string) => void;
  /** Rename one link's local label (the owner-only nickname; never shared with the
   * recipient). Empty clears it back to the placeholder. Absent hides the control. */
  onRename?: ((id: string, label: string) => void) | undefined;
  /** Change one link's lifetime in place (ms from now, or null for
   * until-revoked); the same link keeps working. */
  onSetDuration: (id: string, durationMs: number | null) => void;
  /** Ingest a return link a contact sent back, completing the pending link. */
  onIngestReturn?: ((ret: ContactInvite) => void) | undefined;
  /** Whether the owner has a display name to show: gates the "show my name" choice
   * on the create card (with no name there is nothing to share). Defaults to false. */
  canShowName?: boolean | undefined;
  /** Avatar editor entry: a live preview src and a handler to open the editor.
   * Private links are where a revealed avatar is actually seen (doc 19). */
  avatarSrc?: string | undefined;
  onEditAvatar?: (() => void) | undefined;
}

function expiryLabel(expiresAt: number | null, now: number): string {
  if (expiresAt === null) return "No expiry";
  const left = expiresAt - now;
  if (left <= 0) return "Expired";
  const days = Math.ceil(left / DAY_MS);
  if (days === 1) return "Expires tomorrow";
  return `Expires in ${days} days`;
}

// The "mint a new link" card: nickname, the face choice (when the owner has a name
// to show), lifetime, and the create button, with an inline error so the action
// never silently no-ops.
function CreateCard({
  label,
  setLabel,
  identity,
  setIdentity,
  canShowName,
  duration,
  setDuration,
  busy,
  error,
  onCreate,
}: {
  label: string;
  setLabel: (v: string) => void;
  identity: AliasIdentity;
  setIdentity: (v: AliasIdentity) => void;
  canShowName: boolean;
  duration: string;
  setDuration: (v: string) => void;
  busy: boolean;
  error: string | null;
  onCreate: () => void;
}): React.ReactElement {
  return (
    <Card
      variant="flat"
      style={{ display: "flex", flexDirection: "column", gap: 10 }}
    >
      <Input
        placeholder="Who is this for?"
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        maxLength={64}
      />
      {/* The face this one link shows (doc 15): anonymous by default, or the owner's
          name when they choose to. Hidden when there is no name to show. */}
      <IdentityChoiceRow
        choice={identity}
        hasName={canShowName}
        onChange={setIdentity}
      />
      <div
        style={{ fontSize: 12.5, fontWeight: 600, color: "var(--text-subtle)" }}
      >
        Lasts
      </div>
      <Segmented
        aria-label="Link lifetime"
        value={duration}
        onChange={setDuration}
        options={DURATIONS.map((d) => ({ value: d.key, label: d.label }))}
      />
      <Button
        variant="primary"
        size="md"
        block
        icon={<Link size={16} />}
        onClick={onCreate}
      >
        {busy ? "Creating..." : "Create a link"}
      </Button>
      {error !== null && (
        <div style={{ fontSize: 12.5, color: "var(--status-expired-fg)" }}>
          {error}
        </div>
      )}
    </Card>
  );
}

export function ContactLinks({
  contacts,
  now,
  onCreate,
  onRevoke,
  onRename,
  onSetDuration,
  onIngestReturn,
  canShowName = false,
  avatarSrc,
  onEditAvatar,
}: ContactLinksProps): React.ReactElement {
  const [label, setLabel] = useState("");
  const [identity, setIdentity] = useState<AliasIdentity>("anonymous");
  const [duration, setDuration] = useState(DEFAULT_DURATION);
  const [busy, setBusy] = useState(false);
  const [created, setCreated] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const create = () => {
    if (busy) return;
    setBusy(true);
    setCreated(null);
    setError(null);
    void onCreate(label.trim(), durationMsFor(duration), identity)
      .then((r) => {
        setCreated(r.url);
        setLabel("");
      })
      // Surface the failure instead of swallowing it: a primary action must never
      // silently do nothing (that reads as "the button is broken").
      .catch(() =>
        setError(
          "Couldn’t create the link. Check your connection and try again.",
        ),
      )
      .finally(() => setBusy(false));
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 16,
        width: "100%",
        maxWidth: 600,
      }}
    >
      <div>
        <h1
          style={{
            fontSize: 24,
            fontWeight: 800,
            letterSpacing: "-0.02em",
            color: "var(--text-strong)",
          }}
        >
          Your links
        </h1>
        <p style={{ fontSize: 14, color: "var(--text-body)", marginTop: 6 }}>
          A private link for one person. They open it to see your status. Revoke
          any link anytime; each link expires on its own when its time is up.
        </p>
      </div>

      {onEditAvatar && avatarSrc !== undefined && (
        <AvatarCard src={avatarSrc} onEdit={onEditAvatar} />
      )}

      <CreateCard
        label={label}
        setLabel={setLabel}
        identity={identity}
        setIdentity={setIdentity}
        canShowName={canShowName}
        duration={duration}
        setDuration={setDuration}
        busy={busy}
        error={error}
        onCreate={create}
      />

      {created !== null && <CreatedLink url={created} />}

      {onIngestReturn !== undefined && (
        <IngestReturn onIngest={onIngestReturn} />
      )}

      {contacts.length > 0 && (
        <Card
          variant="flat"
          style={{ padding: 6, display: "flex", flexDirection: "column" }}
        >
          {contacts.map((c) => (
            <ContactRow
              key={c.id}
              contact={c}
              now={now}
              onRevoke={() => {
                // Clear the "link ready" panel if it belongs to the link being
                // revoked, so a now-dead URL never lingers on screen.
                if (created?.includes(c.alias.id)) setCreated(null);
                onRevoke(c.id);
              }}
              onRename={onRename ? (label) => onRename(c.id, label) : undefined}
              onSetDuration={(ms) => onSetDuration(c.id, ms)}
            />
          ))}
        </Card>
      )}
    </div>
  );
}

// The rename field inside the "⋯" panel: edit the owner-only nickname for a link.
// Local only, never shared with the recipient; an empty save clears it back to the
// placeholder. Save stays disabled until the (trimmed) value actually changes.
function RenameField({
  label,
  onRename,
}: {
  label: string;
  onRename: (label: string) => void;
}): React.ReactElement {
  const [value, setValue] = useState(label);
  const trimmed = value.trim();
  const changed = trimmed !== label.trim();
  return (
    <>
      <div
        style={{ fontSize: 12.5, fontWeight: 600, color: "var(--text-subtle)" }}
      >
        Name
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <Input
          aria-label="Rename this link"
          placeholder="Who is this for?"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          maxLength={64}
        />
        <Button
          variant="secondary"
          size="sm"
          disabled={!changed}
          onClick={() => onRename(trimmed)}
        >
          Save
        </Button>
      </div>
    </>
  );
}

// The rename + lifetime + revoke menu revealed under a row (the "⋯" panel).
// Renaming changes only the local nickname; setting a lifetime changes the link's
// expiry in place; the link keeps working through both.
function RowMenu({
  label,
  onRename,
  onSetDuration,
  onRevoke,
}: {
  label: string;
  onRename: ((label: string) => void) | undefined;
  onSetDuration: (durationMs: number | null) => void;
  onRevoke: () => void;
}): React.ReactElement {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 8,
        padding: "6px 10px 12px",
        borderTop: "1px solid var(--border-card)",
      }}
    >
      {onRename && <RenameField label={label} onRename={onRename} />}
      <div
        style={{ fontSize: 12.5, fontWeight: 600, color: "var(--text-subtle)" }}
      >
        Change lifetime
      </div>
      <Segmented
        aria-label="Change link lifetime"
        value=""
        onChange={(key) => onSetDuration(durationMsFor(key))}
        options={DURATIONS.map((d) => ({ value: d.key, label: d.label }))}
      />
      <Button
        variant="quiet"
        size="sm"
        icon={<Trash size={15} />}
        onClick={onRevoke}
      >
        Revoke
      </Button>
    </div>
  );
}

// One contact row: the private label, a linked-vs-pending line with the expiry,
// and a "⋯" menu to change the link's lifetime or revoke it.
function ContactRow({
  contact,
  now,
  onRevoke,
  onRename,
  onSetDuration,
}: {
  contact: ContactRecord;
  now: number;
  onRevoke: () => void;
  onRename: ((label: string) => void) | undefined;
  onSetDuration: (durationMs: number | null) => void;
}): React.ReactElement {
  const [open, setOpen] = useState(false);
  const status =
    contact.theirStatusAlias !== undefined
      ? "Linked both ways"
      : "Waiting for their link";
  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "10px 10px",
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: 14.5,
              fontWeight: 700,
              color: "var(--text-strong)",
            }}
          >
            {contact.label || "Unnamed link"}
          </div>
          <div style={{ fontSize: 12.5, color: "var(--text-muted)" }}>
            {`${status} · ${expiryLabel(contact.expiresAt, now)}`}
          </div>
        </div>
        <button
          type="button"
          aria-label={`Options for ${contact.label || "this link"}`}
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
          style={{
            appearance: "none",
            border: "none",
            background: "transparent",
            cursor: "pointer",
            width: 34,
            height: 34,
            borderRadius: "50%",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            color: "var(--text-subtle)",
            flex: "none",
          }}
        >
          <Dots size={18} />
        </button>
      </div>
      {open && (
        <RowMenu
          label={contact.label}
          onRename={
            onRename
              ? (label) => {
                  onRename(label);
                  setOpen(false);
                }
              : undefined
          }
          onSetDuration={(ms) => {
            onSetDuration(ms);
            setOpen(false);
          }}
          onRevoke={() => {
            onRevoke();
            setOpen(false);
          }}
        />
      )}
    </div>
  );
}
