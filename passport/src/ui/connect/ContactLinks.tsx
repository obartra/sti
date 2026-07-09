import { useState } from "react";
import { Button, Input } from "../../design/components/index.ts";
import { Link, Trash, Dots } from "../../design/icons.tsx";
import { AvatarCard } from "../onboarding/AvatarCard.tsx";
import { IdentityChoiceRow } from "../share/ShareSheet.identity.tsx";
import { LifetimeRow, expiryLabel } from "../share/ShareSheet.lifetime.tsx";
import { CreatedLink } from "./ContactLinks.parts.tsx";
import { nowMs } from "../../core/clock.ts";
import type { AliasIdentity, ContactRecord } from "../../store/index.ts";
import "./connect.css";

/* ContactLinks: the owner's per-contact private links (doc 13). Each link is for
   one person and individually revocable, and the owner picks how long it lasts
   at creation (doc 16): a preset lifetime, or until they turn it off. Revoking
   always cuts it off immediately. The link carries the key, so the recipient
   opens it directly. No status is shown here; this is link management, not a
   viewer surface. */

export interface ContactLinksProps {
  contacts: ContactRecord[];
  /** Mint a new link for `label` with a face (anonymous, or the owner's name)
   * and a lifetime: `expiresAt` is the absolute instant the link stops working,
   * or null for until-revoked. Resolves with the shareable URL. */
  onCreate: (
    label: string,
    identity: AliasIdentity,
    expiresAt: number | null,
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

// The "mint a new link" form: nickname, the face choice (when the owner has a name
// to show), the lifetime choice, and the create button, with an inline error so
// the action never silently no-ops.
function CreateCard({
  label,
  setLabel,
  identity,
  setIdentity,
  lifetime,
  setLifetime,
  canShowName,
  busy,
  error,
  onCreate,
}: {
  label: string;
  setLabel: (v: string) => void;
  identity: AliasIdentity;
  setIdentity: (v: AliasIdentity) => void;
  lifetime: number | null;
  setLifetime: (v: number | null) => void;
  canShowName: boolean;
  busy: boolean;
  error: string | null;
  onCreate: () => void;
}): React.ReactElement {
  return (
    <div className="cl__form">
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
      {/* How long the link lasts (doc 16): a preset duration, or until the owner
          turns it off. Only offered for an anonymous, one-off link; a link that
          shows your name is a standing link and never expires, so the row is
          hidden and it stays open until you revoke it. The choice is fixed at
          creation; changing your mind later means revoking and making a new one. */}
      {identity === "anonymous" && (
        <LifetimeRow choice={lifetime} onChange={setLifetime} />
      )}
      <Button
        variant="primary"
        size="md"
        block
        icon={<Link size={16} />}
        onClick={onCreate}
      >
        {busy ? "Creating..." : "Create a link"}
      </Button>
      {error !== null && <div className="cl__error">{error}</div>}
    </div>
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
  // The chosen lifetime as a duration from now (null = until turned off). Turned
  // into an absolute expiry instant at the moment the link is created.
  const [lifetime, setLifetime] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [created, setCreated] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const create = () => {
    if (busy) return;
    setBusy(true);
    setCreated(null);
    setError(null);
    // A named ("show my name") link is standing and never expires; only an
    // anonymous, one-off link carries a chosen lifetime.
    const expiresAt =
      identity === "anonymous" && lifetime !== null ? nowMs() + lifetime : null;
    void onCreate(label.trim(), identity, expiresAt)
      .then((r) => {
        setCreated(r.url);
        setLabel("");
        setLifetime(null);
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
    <div className="cl">
      <div>
        <h1 className="cn__title">Your links</h1>
        <p className="cn__sub">
          A private link for one person. They open it to see your status.
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
        lifetime={lifetime}
        setLifetime={setLifetime}
        canShowName={canShowName}
        busy={busy}
        error={error}
        onCreate={create}
      />

      {created !== null && <CreatedLink url={created} />}

      {contacts.length > 0 && (
        <div className="cl__rows">
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
        </div>
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
      <div className="cl__row-menu-label">Name</div>
      <div className="cl__row-menu-fields">
        <div className="cl__row-menu-grow">
          <Input
            aria-label="Rename this link"
            placeholder="Who is this for?"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            maxLength={64}
          />
        </div>
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
    <div className="cl__row-menu">
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

// One contact row: the private label, a linked-vs-pending line (plus how long the
// link has left, when it has an expiry), and a "⋯" menu to rename or revoke.
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
  // "Linked" describes the exchanged capabilities; whether their status
  // currently resolves is a live read the viewer sees on open, not a claim the
  // row makes (they may have since walked away, doc 25).
  const linked =
    contact.theirStatusAlias !== undefined
      ? "Linked"
      : "Waiting for their link";
  const expiry = expiryLabel(contact.expiresAt, nowMs());
  const status = expiry === null ? linked : `${linked} · ${expiry}`;
  return (
    <div>
      <div className="cl__row">
        <div className="cl__row-body">
          <div className="cl__row-title">{contact.label || "Unnamed link"}</div>
          <div className="cl__row-sub">{status}</div>
        </div>
        <button
          type="button"
          aria-label={`Options for ${contact.label || "this link"}`}
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
          className="cn__iconbtn"
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
