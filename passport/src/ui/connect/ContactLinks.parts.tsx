import { useState } from "react";
import { Button, Card, Input } from "../../design/components/index.ts";
import { Copy } from "../../design/icons.tsx";
import { copyText } from "../../lib/clipboard.ts";
import { parseContactInvite, type ContactInvite } from "../../store/index.ts";

/* Leaf pieces of the contact-links screen, split out to keep ContactLinks.tsx
   under its file/function size caps: the "link ready" panel after a create, and
   the paste-a-link-back card that completes a two-way link (doc 13 path A). */

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

// The "link ready" panel shown after a successful create: the URL plus a copy.
export function CreatedLink({ url }: { url: string }): React.ReactElement {
  const copy = () => copyText(url);
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

// Paste-a-link-back: the inviter completes the two-way link from a return invite
// a contact sent them (doc 13 path A).
export function IngestReturn({
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
        Got a link back? Paste it here so you can see their status too.
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
        Link both ways
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
