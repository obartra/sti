import type { HTMLAttributes } from "react";

const cx = (...parts: (string | false | undefined)[]) => parts.filter(Boolean).join(" ");

export type CardVariant = "default" | "flat" | "interactive" | "raised" | "tint";
export type CardPad = "sm" | "md" | "lg";

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: CardVariant;
  pad?: CardPad;
}

export function Card({ variant = "default", pad = "md", className, children, ...rest }: CardProps) {
  return (
    <div
      className={cx(
        "sti-card",
        variant !== "default" && `sti-card--${variant}`,
        pad !== "md" && `sti-card--pad-${pad}`,
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  );
}

export type AvatarSize = "sm" | "md" | "lg";

export interface AvatarProps extends HTMLAttributes<HTMLSpanElement> {
  size?: AvatarSize;
  src?: string | undefined;
  alt?: string;
  /** Fallback initials shown when there is no image. */
  initials?: string | undefined;
}

export function Avatar({ size = "md", src, alt = "", initials, className, ...rest }: AvatarProps) {
  return (
    <span className={cx("sti-avatar", `sti-avatar--${size}`, className)} {...rest}>
      {src ? <img src={src} alt={alt} /> : initials}
    </span>
  );
}

export type BadgeVariant = "default" | "accent" | "count";

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
}

export function Badge({ variant = "default", className, children, ...rest }: BadgeProps) {
  return (
    <span className={cx("sti-badge", variant !== "default" && `sti-badge--${variant}`, className)} {...rest}>
      {children}
    </span>
  );
}

// NOTE: there is deliberately no four-light status Pill here. The product badge
// is two-state (blue/gray, distinguished by shape) and never decodes to a
// diagnosis, so the clear/in-treatment/out-of-date/none tones in components.css
// (leftover from the rejected four-light model) are not surfaced as a component.
// Protection-label pills live in the badge card itself (teal/neutral).
