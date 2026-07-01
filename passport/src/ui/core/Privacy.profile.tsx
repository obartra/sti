import { COPY, Section, type PrivacyState } from "./Privacy.parts.tsx";
import { FaceCard, AttributesCard, ControlsCard } from "./Privacy.sections.tsx";
import type { PushControls } from "../app/usePush.ts";

// Profile: what your card shows. Your face (the account avatar + editor entry), the
// self-declared card attributes, and the device controls (notify, install, pause).
export interface ProfileSectionProps {
  state: PrivacyState;
  push?: PushControls | undefined;
  avatarSrc?: string | undefined;
  onEditAvatar?: (() => void) | undefined;
}

export function ProfileSection({
  state,
  push,
  avatarSrc,
  onEditAvatar,
}: ProfileSectionProps) {
  return (
    <Section title={COPY.profileTitle} sub={COPY.profileSub}>
      {onEditAvatar && avatarSrc !== undefined && (
        <FaceCard avatarSrc={avatarSrc} onEditAvatar={onEditAvatar} />
      )}
      <AttributesCard state={state} />
      <ControlsCard state={state} push={push} />
    </Section>
  );
}
