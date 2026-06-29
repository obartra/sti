import type { CSSProperties, MouseEvent, ReactNode } from "react";

// A real anchor that navigates in-app. Plain left-clicks are intercepted and routed
// through the SPA (no full reload); modified clicks (cmd/ctrl/shift/alt or middle
// button) fall through to the browser, so "open in new tab", "copy link address",
// and middle-click all work like any genuine link. This is the accessible form of a
// link-styled control: it IS a link (focusable, has a real href, announced as a
// link), not a button pretending to be one.
export function NavLink({
  href,
  onNavigate,
  style,
  ariaCurrent,
  ariaLabel,
  children,
}: {
  href: string;
  onNavigate: () => void;
  style?: CSSProperties;
  ariaCurrent?: "page" | undefined;
  ariaLabel?: string | undefined;
  children: ReactNode;
}) {
  const onClick = (e: MouseEvent<HTMLAnchorElement>) => {
    // Let the browser handle anything that is not a plain primary click: new-tab /
    // new-window / download gestures must keep working on a real link.
    if (
      e.defaultPrevented ||
      e.button !== 0 ||
      e.metaKey ||
      e.ctrlKey ||
      e.shiftKey ||
      e.altKey
    ) {
      return;
    }
    e.preventDefault();
    onNavigate();
  };
  return (
    <a
      href={href}
      onClick={onClick}
      aria-current={ariaCurrent}
      aria-label={ariaLabel}
      style={style}
    >
      {children}
    </a>
  );
}
