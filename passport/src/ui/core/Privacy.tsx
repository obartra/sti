import { COPY, usePrivacyState } from "./Privacy.parts.tsx";
import {
  AliasIntroCard,
  AliasList,
  AliasFooterNotes,
} from "./Privacy.aliases.tsx";
import {
  AttributesCard,
  ControlsCard,
  DangerZone,
} from "./Privacy.sections.tsx";

export interface PrivacyProps {
  onViewAs?: (() => void) | undefined;
  onDeleted?: (() => void) | undefined;
}

export function Privacy({ onViewAs, onDeleted }: PrivacyProps) {
  const state = usePrivacyState();
  return (
    <div style={{ display: "flex", justifyContent: "center" }}>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 18,
          width: "100%",
          maxWidth: 390,
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

        {/* Alias management: list / create / name / public-or-private / revoke. */}
        <AliasIntroCard onViewAs={onViewAs} />
        <AliasList state={state} />
        <AliasFooterNotes state={state} />

        <AttributesCard state={state} />
        <ControlsCard state={state} />
        <DangerZone state={state} onDeleted={onDeleted} />
      </div>
    </div>
  );
}
