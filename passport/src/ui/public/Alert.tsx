import {
  PreviewBanner,
  AlertHero,
  TestingAction,
  PepBlock,
} from "./Alert.parts.tsx";
import {
  ResourcesCard,
  ReassureCard,
  PrivacyNote,
} from "./Alert.resources.tsx";

// A3 exposure alert. Faithful port of public.jsx Alert, copy verbatim from
// copy.js (alert + learn.pep + partners). Contentless: never names an infection
// or a positive result. The PEP card is composed against LOCAL status only
// (pepVariant), never a fetch. Amber here is the design's time-critical urgency
// cue on the PEP action, not a status badge.

export type PepVariant = "show" | "soft" | "suppress";

export interface AlertProps {
  // Composed on-device against local status: HIV-negative/uncertain -> show,
  // on-PrEP -> soft, living-with-HIV -> suppress.
  pepVariant?: PepVariant;
  // Sender's preview of what the recipient will receive.
  preview?: boolean;
  onFindTesting?: () => void;
  onFindPep?: () => void;
  onFindCondoms?: () => void;
  onFindPrep?: () => void;
  onBack?: () => void;
}

export function Alert({
  pepVariant = "show",
  preview = false,
  onFindTesting,
  onFindPep,
  onFindCondoms,
  onFindPrep,
  onBack,
}: AlertProps) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 20,
        width: "100%",
        maxWidth: 390,
      }}
    >
      {preview && <PreviewBanner onBack={onBack} />}
      <AlertHero />
      <TestingAction onFindTesting={onFindTesting} />
      <PepBlock pepVariant={pepVariant} onFindPep={onFindPep} />
      <ResourcesCard
        onFindPep={onFindPep}
        onFindCondoms={onFindCondoms}
        onFindPrep={onFindPrep}
      />
      <ReassureCard />
      <PrivacyNote />
    </div>
  );
}
