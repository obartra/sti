import { Button, Switch, Avatar } from "../../design/components/index.ts";
import { EyeOff, Users, Bell } from "../../design/icons.tsx";
import { COPY, Chip } from "./Privacy.parts.tsx";
import type { Condoms, PrivacyState } from "./Privacy.parts.tsx";
import type { PushControls } from "../app/usePush.ts";
import { InstallRow } from "./Privacy.install.tsx";
import { isIOS, isStandalone } from "../../pwa/installPrompt.ts";
import "./settings.css";

// Your face: the account's default avatar, framed under Profile with an entry to the
// editor (doc 19). It is the default face a revealed link wears; a link can override
// it with its own face from the share sheet (doc 15). The editor is onEditAvatar.
export function FaceCard({
  avatarSrc,
  onEditAvatar,
}: {
  avatarSrc: string;
  onEditAvatar: () => void;
}) {
  return (
    <div className="st__row">
      <Avatar size="lg" src={avatarSrc} alt="" />
      <div className="st__row-body">
        <div className="st__row-title">{COPY.faceTitle}</div>
        <div className="st__row-sub">{COPY.faceSub}</div>
      </div>
      <Button variant="secondary" size="sm" onClick={onEditAvatar}>
        {COPY.faceEdit}
      </Button>
    </div>
  );
}

// What rides on the card besides the status, self-declared, optional. Toggle
// rows separated by hairlines; the condom preference as editorial chips.
export function AttributesCard({ state }: { state: PrivacyState }) {
  const condomChips: [Condoms, string][] = [
    ["off", COPY.condomOff],
    ["raw", COPY.condomRaw],
    ["either", COPY.condomEither],
    ["always", COPY.condomAlways],
  ];
  return (
    <div className="st__block">
      <div>
        <div className="st__row-title">{COPY.attrsTitle}</div>
        <div className="st__row-sub">{COPY.attrsSub}</div>
      </div>
      <div className="st__row">
        <div className="st__row-body">
          <div className="st__row-title">{COPY.hivLabel}</div>
          <div className="st__row-sub">{COPY.hivLabelSub}</div>
        </div>
        <Switch checked={state.labelHiv} onChange={state.setLabelHiv} />
      </div>
      <div className="st__row">
        <div className="st__row-body">
          <div className="st__row-title">{COPY.doxyLabel}</div>
          <div className="st__row-sub">{COPY.doxyLabelSub}</div>
        </div>
        <Switch checked={state.doxy} onChange={state.setDoxy} />
      </div>
      <div className="st__row st__row--top">
        <div className="st__row-body">
          <div className="st__row-title">{COPY.condomTitle}</div>
          <div className="st__row-sub">{COPY.condomSub}</div>
          <div className="st__chips">
            {condomChips.map(([value, label]) => (
              <Chip
                key={value}
                active={state.condoms === value}
                onClick={() => state.setCondoms(value)}
              >
                {label}
              </Chip>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// The push row's sub-line. On iOS, push only works once the app is installed, so
// the "unavailable" case points at the Add-to-Home-Screen step (doc 22 F) rather
// than a dead end; everywhere else it is the normal supported / not-supported copy.
function pushSub(push: PushControls): string {
  if (push.supported && !push.ready) return COPY.pushNoContacts;
  if (push.supported) return COPY.pushRowSub;
  if (isIOS() && !isStandalone()) return COPY.pushIosInstall;
  return COPY.pushUnsupported;
}

// Device push toggle (slice 7): an opt-in enhancement to the always-on in-app
// alerts. The heads-up is identical (contentless); this only changes WHERE it
// arrives (a closed-app notification). Disabled when the browser can't do push.
function PushRow({ push }: { push: PushControls }) {
  return (
    <>
      <div className="st__row">
        <span aria-hidden className="st__row-icon">
          <Bell size={18} />
        </span>
        <div className="st__row-body">
          <div className="st__row-title">{COPY.pushRow}</div>
          <div className="st__row-sub">{pushSub(push)}</div>
        </div>
        <Switch
          checked={push.enabled}
          disabled={!push.supported || !push.ready || push.busy}
          onChange={(on) => (on ? push.enable() : push.disable())}
        />
      </div>
      {push.error !== null && <div className="st__row-error">{push.error}</div>}
    </>
  );
}

export function ControlsCard({
  state,
  push,
}: {
  state: PrivacyState;
  push?: PushControls | undefined;
}) {
  return (
    <div className="st__block">
      {/* Partner alerts are baked in: informational row, no switch. The
          always-on marker is a quiet status word, never a badge pill. */}
      <div className="st__row st__row--top">
        <span aria-hidden className="st__row-icon">
          <Users size={18} />
        </span>
        <div className="st__row-body">
          <div className="st__row-title-line">
            <span className="st__row-title">{COPY.anonAlerts}</span>
            <span className="st__always">Always on</span>
          </div>
          <div className="st__row-sub">{COPY.anonAlertsSub}</div>
        </div>
      </div>
      {push && <PushRow push={push} />}
      <InstallRow />
      {/* Manual pause: show plain gray to everyone (CtrlRow). */}
      <div className="st__row">
        <span aria-hidden className="st__row-icon">
          <EyeOff size={18} />
        </span>
        <div className="st__row-body">
          <div className="st__row-title">{COPY.pauseRow}</div>
          <div className="st__row-sub">{COPY.pauseRowSub}</div>
        </div>
        <Switch checked={state.paused} onChange={state.setPaused} />
      </div>
    </div>
  );
}
