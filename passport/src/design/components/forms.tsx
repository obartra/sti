import { useState, type InputHTMLAttributes, type ReactNode } from "react";
import { IconButton } from "./buttons.tsx";
import { Eye, EyeOff } from "../icons.tsx";

const cx = (...parts: (string | false | undefined)[]) => parts.filter(Boolean).join(" ");

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  error?: boolean;
}

export function Input({ error = false, className, ...rest }: InputProps) {
  return <input className={cx("sti-input", error && "sti-input--error", className)} {...rest} />;
}

export type PasswordInputProps = Omit<InputProps, "type">;

// A password field with a show/hide toggle. The toggle is a sibling of the
// input, never an overlay inside it: password managers (1Password, Bitwarden,
// the browser's own key icon) anchor their fill buttons inside the input's own
// box, so an in-field eye ends up underneath them. Keeping the eye outside
// that box sidesteps the collision without any extension sniffing.
export function PasswordInput({ disabled, ...rest }: PasswordInputProps) {
  const [shown, setShown] = useState(false);
  return (
    <div className="sti-password">
      <Input type={shown ? "text" : "password"} disabled={disabled} {...rest} />
      <IconButton
        className="sti-password__toggle"
        aria-label={shown ? "Hide password" : "Show password"}
        disabled={disabled}
        onClick={() => setShown((v) => !v)}
      >
        {shown ? <EyeOff /> : <Eye />}
      </IconButton>
    </div>
  );
}

export interface FieldProps {
  label?: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  /** id of the control this field labels. */
  htmlFor?: string;
  children: ReactNode;
}

export function Field({ label, hint, error, htmlFor, children }: FieldProps) {
  return (
    <div className="sti-field">
      {label && (
        <label className="sti-field__label" htmlFor={htmlFor}>
          {label}
        </label>
      )}
      {children}
      {error ? (
        <span className="sti-field__error">{error}</span>
      ) : hint ? (
        <span className="sti-field__hint">{hint}</span>
      ) : null}
    </div>
  );
}

export interface SwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: ReactNode;
  disabled?: boolean;
  id?: string;
}

// The CSS drives the visual on-state from the `--on` class and keeps a real
// hidden checkbox for keyboard focus (`:focus-within`) and assistive tech.
export function Switch({ checked, onChange, label, disabled = false, id }: SwitchProps) {
  return (
    <label className={cx("sti-switch", checked && "sti-switch--on", disabled && "sti-switch--disabled")}>
      <input
        type="checkbox"
        id={id}
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span className="sti-switch__track">
        <span className="sti-switch__thumb" />
      </span>
      {label && <span className="sti-switch__label">{label}</span>}
    </label>
  );
}

export interface SegmentedOption<T extends string> {
  value: T;
  label: ReactNode;
}

export interface SegmentedProps<T extends string> {
  options: SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  "aria-label"?: string;
}

export function Segmented<T extends string>({ options, value, onChange, ...rest }: SegmentedProps<T>) {
  return (
    <div className="sti-segmented" role="tablist" {...rest}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="tab"
          aria-selected={o.value === value}
          className={cx("sti-segmented__item", o.value === value && "sti-segmented__item--active")}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
