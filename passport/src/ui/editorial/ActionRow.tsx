import type { ReactNode } from "react";
import { Chevron } from "../../design/icons.tsx";

export interface ActionRowProps {
  /** A small muted lead icon (16-20px stroke), never a tile. */
  lead?: ReactNode;
  title: string;
  sub?: string | undefined;
  onClick?: (() => void) | undefined;
}

/**
 * The interactive hairline row (doc 37): the editorial replacement for the
 * card-backed Row lists. Button semantics on the .e-row grammar; a quiet
 * chevron marks it as an action.
 */
export function ActionRow({ lead, title, sub, onClick }: ActionRowProps) {
  return (
    <button type="button" className="e-row e-row--action" onClick={onClick}>
      {lead && <span className="e-row__lead">{lead}</span>}
      <span className="e-row__body">
        <span className="e-row__title">{title}</span>
        {sub && <span className="e-row__sub">{sub}</span>}
      </span>
      <span className="e-row__trail" aria-hidden>
        <Chevron size={18} />
      </span>
    </button>
  );
}
