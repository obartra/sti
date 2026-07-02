import {
  Clock,
  Shield,
  Stethoscope,
  Check,
  Lock,
} from "../../design/icons.tsx";
import { ActionRow } from "../editorial/ActionRow.tsx";
import { C } from "./Alert.copy.ts";
import "./alert.css";

export function ResourcesCard({
  onFindPep,
  onFindCondoms,
  onFindPrep,
}: {
  onFindPep?: (() => void) | undefined;
  onFindCondoms?: (() => void) | undefined;
  onFindPrep?: (() => void) | undefined;
}) {
  return (
    <div className="al__section">
      <div className="e-eyebrow al__section-label">{C.resourcesTitle}</div>
      <ActionRow
        lead={<Clock size={18} />}
        title={C.findPepNear}
        sub={C.findPepNearSub}
        onClick={onFindPep}
      />
      <ActionRow
        lead={<Shield size={18} />}
        title={C.findCondoms}
        onClick={onFindCondoms}
      />
      <ActionRow
        lead={<Stethoscope size={18} />}
        title={C.findPrep}
        onClick={onFindPrep}
      />
    </div>
  );
}

export function ReassureCard() {
  return (
    <div className="al__reassure">
      <div className="e-eyebrow">{C.reassureTitle}</div>
      {C.reassure.map((r) => (
        <div key={r} className="al__reassure-row">
          <span className="al__reassure-check">
            <Check size={18} />
          </span>
          <span className="al__reassure-text">{r}</span>
        </div>
      ))}
    </div>
  );
}

export function PrivacyNote() {
  return (
    <div className="al__note al__note--micro">
      <span className="al__note-icon">
        <Lock size={16} />
      </span>
      <span>{C.inAppNote}</span>
    </div>
  );
}
