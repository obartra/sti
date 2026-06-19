import type { HTMLAttributes, ReactNode } from "react";

const cx = (...parts: (string | false | undefined)[]) => parts.filter(Boolean).join(" ");

// Omit the native `title` (tooltip) attribute: here `title` is the row's
// primary text content (ReactNode), not an HTML title string.
export interface RowProps extends Omit<HTMLAttributes<HTMLElement>, "title"> {
  lead?: ReactNode;
  title?: ReactNode;
  sub?: ReactNode;
  trail?: ReactNode;
  /** Interactive rows render as a button (tappable); static rows as a div. */
  interactive?: boolean;
}

// Internal structure uses spans only, so an interactive row (a <button>) holds
// valid phrasing content. The CSS supplies the flex layout regardless of tag.
export function Row({ lead, title, sub, trail, interactive = true, className, children, ...rest }: RowProps) {
  const cls = cx("sti-row", !interactive && "sti-row--static", className);
  const body = (
    <>
      {lead && <span className="sti-row__lead">{lead}</span>}
      <span className="sti-row__body">
        {title && <span className="sti-row__title">{title}</span>}
        {sub && <span className="sti-row__sub">{sub}</span>}
        {children}
      </span>
      {trail && <span className="sti-row__trail">{trail}</span>}
    </>
  );
  return interactive ? (
    <button type="button" className={cls} {...rest}>
      {body}
    </button>
  ) : (
    <div className={cls} {...rest}>
      {body}
    </div>
  );
}
