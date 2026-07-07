import type { HTMLAttributes } from "react";

const cx = (...parts: (string | false | undefined)[]) => parts.filter(Boolean).join(" ");

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
