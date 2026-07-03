import { Button } from "../../design/components/index.ts";
import { AvatarBuilder } from "./AvatarBuilder.tsx";
import type { AvatarConfig } from "../../lib/avatars.ts";
import { AVATAR_CREDIT } from "../../lib/credits.ts";
import "./onboarding.css";
import "./avatar.css";

// Standalone avatar editor (account already claimed, reached from Privacy).
// A serif title, the shared AvatarBuilder, the art credit, and a done action.
const COPY = {
  title: "Your avatar",
  done: "Done",
} as const;

export interface AvatarEditProps {
  config: AvatarConfig;
  onChange: (next: AvatarConfig) => void;
  onDone?: (() => void) | undefined;
}

export function AvatarEdit({ config, onChange, onDone }: AvatarEditProps) {
  return (
    <div className="onb">
      <h1 className="onb__title">{COPY.title}</h1>
      <AvatarBuilder config={config} onChange={onChange} />
      <p className="ave__credit">
        {AVATAR_CREDIT.title} by {AVATAR_CREDIT.creator},{" "}
        <a href={AVATAR_CREDIT.licenseUrl} target="_blank" rel="noreferrer">
          {AVATAR_CREDIT.license}
        </a>
      </p>
      <Button variant="primary" size="lg" block onClick={onDone}>
        {COPY.done}
      </Button>
    </div>
  );
}
