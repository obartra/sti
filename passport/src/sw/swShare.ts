/**
 * share_target resolution (doc 22 section C). When the OS hands the installed app a
 * shared passport link, the service worker resolves it ENTIRELY on-device and never
 * forwards the request to the network, so the AES key (which rides in the URL
 * fragment, doc 16) never leaves the device. These are the two pure decisions behind
 * that handler, so they test in Node without a service worker, like swCache.ts.
 */

import { parseScannedLink } from "../store/aliasLink.ts";

/** The action path the manifest's `share_target` posts to, resolved against scope. */
const SHARE_TARGET_PATH = "share-target";

/**
 * Whether a request is the share_target POST. The action is `{scope}share-target`
 * (POST, multipart), so we match the method and the resolved path; anything else is
 * left to the normal fetch routing.
 */
export function isShareTargetRequest(
  method: string,
  url: string,
  scope: string,
): boolean {
  if (method !== "POST") return false;
  try {
    return new URL(url).pathname === new URL(SHARE_TARGET_PATH, scope).pathname;
  } catch {
    return false;
  }
}

/**
 * The in-app URL to redirect a share to: the resolved card route when the shared
 * text holds a well-formed public link to our own site, else the app root. Strict by
 * construction (parseScannedLink rejects a foreign host, a non-link, or a keyless
 * link), so a hostile share can only ever land on the app root, never off-site and
 * never with junk fed to the crypto layer. The `#k={key}` fragment is rebuilt here
 * and carried in the redirect, so it stays on the device.
 */
export function shareTargetRedirect(
  shared: { url?: string | null; text?: string | null },
  scope: string,
  selfHost: string,
): string {
  const candidate = (shared.url ?? shared.text ?? "").trim();
  const link = parseScannedLink(candidate, selfHost);
  if (link === null) return scope;
  return `${scope}a/${link.id}#k=${link.key}`;
}
