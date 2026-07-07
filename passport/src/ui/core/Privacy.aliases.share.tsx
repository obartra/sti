import { useState } from "react";
import { ShareSheet } from "../share/ShareSheet.tsx";
import type { BadgeState, ProtectionLabel, Route } from "../badge-card.tsx";
import { copyText } from "../../lib/clipboard.ts";

/* The per-link share surface for the "Your links" list: each link opens its own
   ShareSheet (its own URL + QR), reusing the same sheet the home "Share my
   passport" uses. The badge preview is the owner's current status; the URL is that
   one link's fixed URL (not a fresh mint), so copy/QR/native-share all point at it. */

/** The owner's current badge context, threaded in so each link's sheet previews
 * the same card a viewer would resolve. */
export interface LinkShareContext {
  state: BadgeState;
  labels: ProtectionLabel[];
  route: Route;
  handle?: string | undefined;
  avatarSrc?: string | undefined;
}

// The controls a row hands up to open (and close) its own share sheet.
export interface LinkShareControls {
  /** Open the sheet for one link's URL. */
  open: (url: string) => void;
  /** The sheet element (null when nothing is being shared). */
  sheet: React.ReactElement | null;
}

// A hook the list uses once: it owns the "which link is being shared" state and
// renders a single ShareSheet for it. One sheet is enough (only one is open at a
// time), so rows just call open(url).
export function useLinkShare(
  ctx: LinkShareContext,
  desktop = false,
): LinkShareControls {
  const [url, setUrl] = useState<string | null>(null);
  const sheet =
    url !== null ? (
      <ShareSheet
        open
        onClose={() => setUrl(null)}
        state={ctx.state}
        labels={ctx.labels}
        route={ctx.route}
        identity={ctx.handle !== undefined ? { handle: ctx.handle } : {}}
        avatarSrc={ctx.avatarSrc}
        url={url}
        onCopy={() => copyText(url)}
        showWallet={false}
        desktop={desktop}
      />
    ) : null;
  return { open: setUrl, sheet };
}
