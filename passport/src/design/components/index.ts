// sti.care design-system primitives. Typed React wrappers over the .sti-*
// component classes in components.css, so screens compose from a real library
// instead of hand-writing class names.
export { Button, IconButton } from "./buttons.tsx";
export type { ButtonProps, ButtonVariant, ButtonSize, IconButtonProps, IconButtonVariant } from "./buttons.tsx";

export { Avatar } from "./surfaces.tsx";
export type { AvatarProps, AvatarSize } from "./surfaces.tsx";

export { Input, Field, Switch, Segmented } from "./forms.tsx";
export type { InputProps, FieldProps, SwitchProps, SegmentedOption, SegmentedProps } from "./forms.tsx";
