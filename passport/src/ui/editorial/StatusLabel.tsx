import { Heart } from "../../design/icons.tsx";
import { cx } from "../../lib/cx.ts";

export interface StatusLabelProps {
  label: string;
  tone: "clear" | "treat" | "none";
}

/**
 * The editorial status treatment (doc 37): the word in uppercase with an
 * AA-safe derived ink, plus the heart glyph in the raw status color. Word
 * plus icon is mandatory so status reads in grayscale and for color-blind
 * users; it replaces pill chips everywhere a status is named.
 */
export function StatusLabel({ label, tone }: StatusLabelProps) {
  return (
    <span className={cx("e-status", `e-status--${tone}`)}>
      <span className="e-status__icon">
        <Heart size={12} />
      </span>
      {label}
    </span>
  );
}
