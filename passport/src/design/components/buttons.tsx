import type { ButtonHTMLAttributes, ReactNode } from "react";

const cx = (...parts: (string | false | undefined)[]) => parts.filter(Boolean).join(" ");

export type ButtonVariant = "primary" | "secondary" | "ghost" | "quiet" | "danger";
export type ButtonSize = "sm" | "md" | "lg";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  block?: boolean;
  /** Optional leading icon (rendered in the icon slot). */
  icon?: ReactNode;
}

export function Button({
  variant = "primary",
  size = "md",
  block = false,
  icon,
  className,
  children,
  type = "button",
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cx("sti-btn", `sti-btn--${variant}`, `sti-btn--${size}`, block && "sti-btn--block", className)}
      {...rest}
    >
      {icon && <span className="sti-btn__icon">{icon}</span>}
      {children}
    </button>
  );
}

export type IconButtonVariant = "default" | "accent" | "filled";

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: IconButtonVariant;
  /** Required: icon-only controls need an accessible name. */
  "aria-label": string;
}

export function IconButton({ variant = "default", className, children, type = "button", ...rest }: IconButtonProps) {
  return (
    <button
      type={type}
      className={cx("sti-iconbtn", variant !== "default" && `sti-iconbtn--${variant}`, className)}
      {...rest}
    >
      {children}
    </button>
  );
}
