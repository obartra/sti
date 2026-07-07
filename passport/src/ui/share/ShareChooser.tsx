import type { ReactElement } from "react";
import { Link, Globe, X } from "../../design/icons.tsx";
import { ActionRow } from "../editorial/ActionRow.tsx";
import { Grabber } from "./ShareSheet.parts.tsx";
import { cx } from "../../lib/cx.ts";
import "./share-sheet.css";
import "./share-chooser.css";

/* ShareChooser, the first step of "Share my passport": pick how to share before
   any link is minted. A private link goes to one person; a public name lets
   people find you and ask first. It reuses the share sheet's overlay shell (scrim
   + slide-up panel on mobile, centered modal on desktop) so the two surfaces read
   as one flow, and lays its choices out on the editorial action-row grammar
   (doc 37). Copy follows the voice guide (doc 21): plain, sentence case. */

const COPY = {
  title: "Share your passport",
  intro: "Pick how you want to share.",
  privateTitle: "Send a private link",
  privateSub: "Only people you send it to can open it.",
  publicTitle: "Share your public name",
  publicSub: "People find you by name and ask before they see your status.",
} as const;

export interface ShareChooserProps {
  open: boolean;
  onClose: () => void;
  desktop?: boolean | undefined;
  /** Chose a private link: open the share sheet in its private-link form. */
  onPrivateLink: () => void;
  /** Chose a public name: go to the Public names section on the Links tab. */
  onPublicName: () => void;
}

export function ShareChooser({
  open,
  onClose,
  desktop = false,
  onPrivateLink,
  onPublicName,
}: ShareChooserProps): ReactElement {
  return (
    <div
      aria-hidden={!open}
      className={cx("sh", open ? "sh--open" : "sh--closed")}
    >
      <div onClick={onClose} className="sh__scrim" />
      <div
        className={cx(
          "sh__panel",
          desktop ? "sh__panel--desktop" : "sh__panel--mobile",
        )}
      >
        <Grabber desktop={desktop} />
        <div className="sh__head">
          <div className="sh__title">{COPY.title}</div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="sh__close"
          >
            <X size={16} />
          </button>
        </div>
        <p className="shc__intro">{COPY.intro}</p>
        <div className="shc__rows">
          <ActionRow
            lead={<Link size={18} />}
            title={COPY.privateTitle}
            sub={COPY.privateSub}
            onClick={onPrivateLink}
          />
          <ActionRow
            lead={<Globe size={18} />}
            title={COPY.publicTitle}
            sub={COPY.publicSub}
            onClick={onPublicName}
          />
        </div>
      </div>
    </div>
  );
}
