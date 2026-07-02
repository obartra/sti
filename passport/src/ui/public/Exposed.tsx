import { Button } from "../../design/components/index.ts";
import { Stethoscope, Clock, Shield, Info, Lock } from "../../design/icons.tsx";
import { ActionRow } from "../editorial/ActionRow.tsx";
import { RESOURCES, openResource } from "../../lib/resources.ts";
import { infoUrl } from "../../lib/info.ts";
import { CREATE_ACCOUNT_CTA } from "../../copy/canonical.ts";
import "./exposed.css";

// The public page the off-app heads-up text links to (sti.care/exposed). Fully
// anonymous: no account, no sign-in, no identity, no token. It just turns "a
// recent contact suggested testing" into the next steps, calmly. Reuses the same
// CDC/PrEP locators as Care.
export interface ExposedProps {
  /** Soft CTA: start your own passport (onboarding). */
  onClaim?: (() => void) | undefined;
}

export function Exposed({ onClaim }: ExposedProps) {
  return (
    <div className="exposed">
      <div>
        <h1 className="exposed__title">A heads-up worth acting on</h1>
        <p className="exposed__lead">
          Someone you&apos;ve been in contact with recently suggested getting an
          STI test. It&apos;s a responsible heads-up, not a diagnosis, and who
          sent it stays private.
        </p>
      </div>

      <p className="exposed__reassure">
        STIs are common and often have no symptoms, so testing is the only way
        to know. Most are quick to treat or easy to manage, and testing is
        usually fast and often free.
      </p>

      <div className="e-eyebrow">What to do</div>
      <div className="exposed__rows">
        <ActionRow
          lead={<Stethoscope size={20} />}
          title="Find free testing near you"
          sub="CDC test finder"
          onClick={() => openResource(RESOURCES.clinic)}
        />
        <ActionRow
          lead={<Info size={20} />}
          title="Getting tested, what to expect"
          sub="The whole visit, start to finish"
          onClick={() => openResource(infoUrl("/testing"))}
        />
        <ActionRow
          lead={<Clock size={20} />}
          title="PEP, if it has been under 72 hours"
          sub="Emergency HIV prevention, time-sensitive"
          onClick={() => openResource(RESOURCES.pep)}
        />
        <ActionRow
          lead={<Shield size={20} />}
          title="PrEP for prevention going forward"
          sub="Find a PrEP provider"
          onClick={() => openResource(RESOURCES.prep)}
        />
      </div>

      <div className="exposed__anon">
        <Lock size={13} className="exposed__anon-icon" /> This page is
        anonymous. No account, no sign-in, nothing tied to you.
      </div>

      <Button variant="ghost" size="md" block onClick={onClaim}>
        {CREATE_ACCOUNT_CTA}
      </Button>
    </div>
  );
}
