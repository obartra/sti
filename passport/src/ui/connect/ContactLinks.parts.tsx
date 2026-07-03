import { Button } from "../../design/components/index.ts";
import { Copy } from "../../design/icons.tsx";
import { copyText } from "../../lib/clipboard.ts";
import { cx } from "../../lib/cx.ts";
import "./connect.css";

/* Leaf pieces of the contact-links screen, split out to keep ContactLinks.tsx
   under its file/function size caps: the "link ready" panel after a create. */

// The "link ready" panel shown after a successful create: an action callout
// with the URL plus a copy.
export function CreatedLink({ url }: { url: string }): React.ReactElement {
  const copy = () => copyText(url);
  return (
    <div className={cx("e-card", "cl__created")}>
      <div className="cl__created-title">
        Link ready, send it to that person
      </div>
      <div className="cl__created-url">{url.replace(/^https?:\/\//, "")}</div>
      <Button
        variant="secondary"
        size="sm"
        icon={<Copy size={15} />}
        onClick={copy}
      >
        Copy link
      </Button>
    </div>
  );
}
