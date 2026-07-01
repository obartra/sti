import { Button, Card } from "../../design/components/index.ts";
import { Copy } from "../../design/icons.tsx";
import { copyText } from "../../lib/clipboard.ts";

/* Leaf pieces of the contact-links screen, split out to keep ContactLinks.tsx
   under its file/function size caps: the "link ready" panel after a create. */

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
