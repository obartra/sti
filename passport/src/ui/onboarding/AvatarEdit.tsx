import { Button } from "../../design/components/index.ts";
import { AvatarBuilder } from "./AvatarBuilder.tsx";
import type { AvatarConfig } from "../../lib/avatars.ts";
import { AVATAR_CREDIT } from "../../lib/credits.ts";

// Standalone avatar editor (account already claimed, reached from Privacy).
// Faithful port of onboarding.jsx AvatarEdit: a title, the shared AvatarBuilder,
// and a done action. Copy verbatim from copy.js (privacy.editAvatar*).
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
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 18,
        width: "100%",
        maxWidth: 600,
      }}
    >
      <h1
        style={{
          fontSize: 24,
          fontWeight: 800,
          letterSpacing: "-0.02em",
          color: "var(--text-strong)",
        }}
      >
        {COPY.title}
      </h1>
      <AvatarBuilder config={config} onChange={onChange} />
      <p
        style={{
          fontSize: 11,
          lineHeight: 1.5,
          color: "var(--text-subtle)",
          margin: 0,
        }}
      >
        {AVATAR_CREDIT.title} by {AVATAR_CREDIT.creator},{" "}
        <a
          href={AVATAR_CREDIT.licenseUrl}
          target="_blank"
          rel="noreferrer"
          style={{ color: "inherit", textDecoration: "underline" }}
        >
          {AVATAR_CREDIT.license}
        </a>
      </p>
      <Button variant="primary" size="lg" block onClick={onDone}>
        {COPY.done}
      </Button>
    </div>
  );
}
