// sti.care design-system primitives. Typed React wrappers over the .sti-*
// component classes in components.css, so screens compose from a real library
// instead of hand-writing class names.
export { Button, IconButton } from "./buttons.tsx";
export type { ButtonProps, ButtonVariant, ButtonSize, IconButtonProps, IconButtonVariant } from "./buttons.tsx";

export { Card, Avatar, Badge } from "./surfaces.tsx";
export type {
  CardProps,
  CardVariant,
  CardPad,
  AvatarProps,
  AvatarSize,
  BadgeProps,
  BadgeVariant,
} from "./surfaces.tsx";

export { Input, PasswordInput, Field, Switch, Segmented } from "./forms.tsx";
export type { InputProps, PasswordInputProps, FieldProps, SwitchProps, SegmentedOption, SegmentedProps } from "./forms.tsx";

export { Row } from "./row.tsx";
export type { RowProps } from "./row.tsx";
