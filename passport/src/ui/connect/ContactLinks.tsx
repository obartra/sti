import { useState } from "react";
import { Button, Card, Input } from "../../design/components/index.ts";
import { Link, Trash, Dots } from "../../design/icons.tsx";
import { AvatarCard } from "../onboarding/AvatarCard.tsx";
import { IdentityChoiceRow } from "../share/ShareSheet.identity.tsx";
import { CreatedLink } from "./ContactLinks.parts.tsx";
import type { AliasIdentity, ContactRecord } from "../../store/index.ts";

/* ContactLinks: the owner's per-contact private links (doc 13). Each link is for
   one person and individually revocable; it never expires on its own, so revoking
   it is the single cut-off. The link carries the key, so the recipient opens it
   directly. No status is shown here; this is link management, not a viewer surface. */

export interface ContactLinksProps {
  contacts: ContactRecord[];
  /** Mint a new link for `label` with a face (anonymous, or the owner's name);
   * resolves with the shareable URL. The link is durable until revoked. */
  onCreate: (
    label: string,
    identity: AliasIdentity,
  ) => Promise<{ url: string }>;
  onRevoke: (id: string) => void;
  /** Rename one link's local label (the owner-only nickname; never shared with the
   * recipient). Empty clears it back to the placeholder. Absent hides the control. */
  onRename?: ((id: string, label: string) => void) | undefined;
  /** Whether the owner has a display name to show: gates the "show my name" choice
   * on the create card (with no name there is nothing to share). Defaults to false. */
  canShowName?: boolean | undefined;
  /** Avatar editor entry: a live preview src and a handler to open the editor.
   * Private links are where a revealed avatar is actually seen (doc 19). */
  avatarSrc?: string | undefined;
  onEditAvatar?: (() => void) | undefined;
}

// The "mint a new link" card: nickname, the face choice (when the owner has a name
// to show), and the create button, with an inline error so the action never
// silently no-ops.
function CreateCard({
  label,
  setLabel,
  identity,
  setIdentity,
  canShowName,
  busy,
  error,
  onCreate,
}: {
  label: string;
  setLabel: (v: string) => void;
  identity: AliasIdentity;
  setIdentity: (v: AliasIdentity) => void;
  canShowName: boolean;
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
  onCreate,
  onRevoke,
  onRename,
  canShowName = false,
  avatarSrc,
  onEditAvatar,
}: ContactLinksProps): React.ReactElement {
  const [label, setLabel] = useState("");
  const [identity, setIdentity] = useState<AliasIdentity>("anonymous");
  const [busy, setBusy] = useState(false);
  const [created, setCreated] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const create = () => {
    if (busy) return;
    setBusy(true);
    setCreated(null);
    setError(null);
    void onCreate(label.trim(), identity)
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
          A private link for one person. They open it to see your status. It
          works until you revoke it.
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
        busy={busy}
        error={error}
        onCreate={create}
      />

      {created !== null && <CreatedLink url={created} />}

      {contacts.length > 0 && (
        <Card
          variant="flat"
          style={{ padding: 6, display: "flex", flexDirection: "column" }}
        >
          {contacts.map((c) => (
            <ContactRow
              key={c.id}
              contact={c}
              onRevoke={() => {
                // Clear the "link ready" panel if it belongs to the link being
                // revoked, so a now-dead URL never lingers on screen.
                if (created?.includes(c.alias.id)) setCreated(null);
                onRevoke(c.id);
              }}
              onRename={onRename ? (label) => onRename(c.id, label) : undefined}
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

// The rename + revoke menu revealed under a row (the "⋯" panel). Renaming changes
// only the local nickname; revoke cuts the link off. The link keeps working until
// revoked.
function RowMenu({
  label,
  onRename,
  onRevoke,
}: {
  label: string;
  onRename: ((label: string) => void) | undefined;
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

// One contact row: the private label, a linked-vs-pending line, and a "⋯" menu to
// rename or revoke the link.
function ContactRow({
  contact,
  onRevoke,
  onRename,
}: {
  contact: ContactRecord;
  onRevoke: () => void;
  onRename: ((label: string) => void) | undefined;
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
            {status}
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
          onRevoke={() => {
            onRevoke();
            setOpen(false);
          }}
        />
      )}
    </div>
  );
}
