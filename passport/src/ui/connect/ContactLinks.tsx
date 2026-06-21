import { useState } from "react";
import { Button, Card, Input } from "../../design/components/index.ts";
import { Link, Copy, Trash } from "../../design/icons.tsx";
import {
  parseContactInvite,
  type ContactInvite,
  type ContactRecord,
} from "../../store/index.ts";

/* ContactLinks: the owner's per-contact private links (doc 13). Each link is for
   one person, individually revocable, and expires on its own (default 7 days).
   The link carries the key, so the recipient opens it directly. No status is
   shown here; this is link management, not a viewer surface. */

export interface ContactLinksProps {
  contacts: ContactRecord[];
  /** Today as an epoch day, for the expiry countdown. */
  nowDay: number;
  /** Mint a new link for `label`; resolves with the shareable URL. */
  onCreate: (label: string) => Promise<{ url: string }>;
  onRevoke: (id: string) => void;
  /** Ingest a return link a contact sent back, completing the pending link. */
  onIngestReturn?: ((ret: ContactInvite) => void) | undefined;
}

// Normalize a pasted link (the UI displays them without the scheme) so new URL()
// can split it into the pathname + hash the invite parser consumes.
function parsePastedReturn(pasted: string): ContactInvite | null {
  const trimmed = pasted.trim();
  if (trimmed === "") return null;
  const withScheme = /^https?:\/\//.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;
  let url: URL;
  try {
    url = new URL(withScheme);
  } catch {
    return null;
  }
  const invite = parseContactInvite(url.pathname, url.hash);
  // Only a RETURN invite (it carries `ref`) is ingestible here; a plain invite is
  // someone inviting YOU, which you accept by opening it.
  return invite?.ref !== undefined ? invite : null;
}

// Paste-a-link-back: the inviter completes the two-way link from a return invite a
// contact sent them (doc 13 path A).
function IngestReturn({
  onIngest,
}: {
  onIngest: (ret: ContactInvite) => void;
}): React.ReactElement {
  const [pasted, setPasted] = useState("");
  const [status, setStatus] = useState<"idle" | "ok" | "bad">("idle");

  const submit = () => {
    const invite = parsePastedReturn(pasted);
    if (invite === null) {
      setStatus("bad");
      return;
    }
    onIngest(invite);
    setPasted("");
    setStatus("ok");
  };

  return (
    <Card
      variant="flat"
      style={{ display: "flex", flexDirection: "column", gap: 10 }}
    >
      <div
        style={{ fontSize: 13.5, fontWeight: 700, color: "var(--text-strong)" }}
      >
        Got a link back? Paste it to finish linking.
      </div>
      <Input
        placeholder="Paste the link they sent back"
        value={pasted}
        onChange={(e) => {
          setPasted(e.target.value);
          setStatus("idle");
        }}
      />
      <Button variant="secondary" size="md" block onClick={submit}>
        Finish linking
      </Button>
      {status === "bad" && (
        <div style={{ fontSize: 12.5, color: "var(--status-expired-fg)" }}>
          That is not a link sent back to you. Open an invite link to add
          someone new instead.
        </div>
      )}
      {status === "ok" && (
        <div style={{ fontSize: 12.5, color: "var(--text-accent)" }}>
          Linked. You will see each other now.
        </div>
      )}
    </Card>
  );
}

function expiryLabel(expiresDay: number | null, nowDay: number): string {
  if (expiresDay === null) return "No expiry";
  const left = expiresDay - nowDay;
  if (left <= 0) return "Expired";
  if (left === 1) return "Expires tomorrow";
  return `Expires in ${left} days`;
}

function CreatedLink({ url }: { url: string }): React.ReactElement {
  const copy = () => {
    try {
      void navigator.clipboard.writeText(url).catch(() => undefined);
    } catch {
      // no clipboard available
    }
  };
  return (
    <Card
      variant="tint"
      style={{ display: "flex", flexDirection: "column", gap: 8 }}
    >
      <div
        style={{ fontSize: 13, fontWeight: 700, color: "var(--text-strong)" }}
      >
        Link ready, send it to that person
      </div>
      <div
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 12.5,
          color: "var(--text-strong)",
          wordBreak: "break-all",
        }}
      >
        {url.replace(/^https?:\/\//, "")}
      </div>
      <Button
        variant="secondary"
        size="sm"
        icon={<Copy size={15} />}
        onClick={copy}
      >
        Copy link
      </Button>
    </Card>
  );
}

export function ContactLinks({
  contacts,
  nowDay,
  onCreate,
  onRevoke,
  onIngestReturn,
}: ContactLinksProps): React.ReactElement {
  const [label, setLabel] = useState("");
  const [busy, setBusy] = useState(false);
  const [created, setCreated] = useState<string | null>(null);

  const create = () => {
    if (busy) return;
    setBusy(true);
    setCreated(null);
    void onCreate(label.trim())
      .then((r) => {
        setCreated(r.url);
        setLabel("");
      })
      .catch(() => undefined)
      .finally(() => setBusy(false));
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 16,
        width: "100%",
        maxWidth: 390,
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
          any link anytime; links expire on their own after a week.
        </p>
      </div>

      <Card
        variant="flat"
        style={{ display: "flex", flexDirection: "column", gap: 10 }}
      >
        <Input
          placeholder="Who is this for? (a nickname)"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          maxLength={64}
        />
        <Button
          variant="primary"
          size="md"
          block
          icon={<Link size={16} />}
          onClick={create}
        >
          {busy ? "Creating..." : "Create a link"}
        </Button>
      </Card>

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
              nowDay={nowDay}
              onRevoke={() => {
                // Clear the "link ready" panel if it belongs to the link being
                // revoked, so a now-dead URL never lingers on screen.
                if (created?.includes(c.alias.id)) setCreated(null);
                onRevoke(c.id);
              }}
            />
          ))}
        </Card>
      )}
    </div>
  );
}

// One contact row: the private label, a linked-vs-pending line with the expiry,
// and a revoke control.
function ContactRow({
  contact,
  nowDay,
  onRevoke,
}: {
  contact: ContactRecord;
  nowDay: number;
  onRevoke: () => void;
}): React.ReactElement {
  const status =
    contact.theirStatusAlias !== undefined
      ? "Linked both ways"
      : "Awaiting their link back";
  return (
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
          {`${status} · ${expiryLabel(contact.expiresDay, nowDay)}`}
        </div>
      </div>
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
