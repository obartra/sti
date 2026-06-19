import { useCallback, useState, type CSSProperties } from "react";
import { Button } from "../../design/components/index.ts";
import { Check, Link, Sparkle } from "../../design/icons.tsx";
import { Medallion } from "../badge-card.tsx";
import { HandleAvatar } from "./parts.tsx";
import {
  COPY,
  ME,
  sx,
  Mode,
  Title,
  Body,
  Proximity,
  MicroNote,
  OtherPhone,
  sub,
} from "./Linkup.parts.tsx";

/* Linkup, the in-app "we're together right now" handshake.

   A faithful port of the design prototype's linkup. It is a DISTINCT in-app
   mode reached from Connect, deliberately NOT the profile QR: the entry is a
   proximity affordance (production = NFC tap / BLE match / local rotating code),
   never a scannable matrix. Foundational styles and leaf components live in
   Linkup.parts.tsx; this file holds the phase views and the state machine.

   THE THREE THINGS THAT MUST NOT WEAKEN:

   A. CONSENT IS THE MUTUAL GESTURE, NEVER AMBIENT. One side's tap only ARMS.
      The bind + log fires solely inside commit(), and commit() is only ever
      reached after BOTH sides have acted. The armed "waiting on them" state is
      a real gate (see armOrComplete below).

   B. THE ONE-GRAY HEADS-UP CANNOT DECODE. If the other person is gray at
      handshake time, you (blue) see ONE neutral line, gray Medallion, no red,
      no warning icon, never why. It informs, never blocks; Continue completes it.

   C. THE ENCOUNTER WRITES THE EXISTING ROW. commit() calls onLogged(), the
      "encounter write" that appends the canonical row Connect already keeps. */

type Phase = "ready" | "armed" | "headsup" | "done";

// DONE, both-blue is silent & warm; relog says "linked again".
function DoneView({
  them,
  relog,
  onDone,
}: {
  them: string;
  relog: boolean;
  onDone?: (() => void) | undefined;
}) {
  const ringA: CSSProperties = {
    position: "absolute",
    inset: -22,
    borderRadius: "50%",
    border: "1.5px solid var(--accent)",
    opacity: 0.16,
  };
  const ringB: CSSProperties = { ...ringA, inset: -44, opacity: 0.08 };
  return (
    <Mode>
      <div style={sx.center}>
        <div style={sx.doneCol}>
          <div style={{ position: "relative" }}>
            <span style={ringA} />
            <span style={ringB} />
            <Medallion state="blue" size={104} />
          </div>
          <div>
            <Title>{relog ? COPY.doneTitleRelog : COPY.doneTitle}</Title>
            <Body>{relog ? COPY.doneBodyRelog : COPY.doneBody}</Body>
          </div>
          <span style={sx.doneLoggedRow}>
            <HandleAvatar handle={ME} size="sm" />
            <span style={{ color: "var(--text-subtle)" }}>
              <Link size={15} />
            </span>
            <HandleAvatar handle={them} size="sm" />
            <span style={sx.doneLoggedText}>{COPY.doneLogged}</span>
          </span>
        </div>
      </div>
      <Button variant="primary" size="lg" block onClick={onDone}>
        {COPY.doneCta}
      </Button>
    </Mode>
  );
}

// HEADS-UP, the only case that interrupts. One neutral line, no decode, no red,
// no warning icon. Continue finalizes (writes the row).
function HeadsUpView({
  them,
  onContinue,
}: {
  them: string;
  onContinue: () => void;
}) {
  return (
    <Mode>
      <div style={sx.center}>
        <div style={sx.doneCol}>
          <Medallion state="gray" size={88} />
          <div style={sx.headsupKicker}>{COPY.headsupKicker}</div>
          <div style={sx.headsupLine}>{sub(COPY.headsupLine, them)}</div>
          <p style={sx.headsupBody}>{COPY.headsupBody}</p>
        </div>
      </div>
      <div style={sx.col10}>
        <Button variant="primary" size="lg" block onClick={onContinue}>
          {COPY.headsupCta}
        </Button>
        <div style={sx.headsupFoot}>{COPY.headsupFoot}</div>
      </div>
    </Mode>
  );
}

// ARMED, one side tapped, waiting on the other. The real gate.
function ArmedView({
  them,
  meActed,
  themActed,
  onArmThem,
}: {
  them: string;
  meActed: boolean;
  themActed: boolean;
  onArmThem: () => void;
}) {
  const youWait = meActed && !themActed; // you tapped, waiting on them
  return (
    <Mode>
      <div style={sx.center}>
        <Proximity
          them={them}
          meLit={meActed}
          themLit={themActed}
          bound={false}
        />
        <div style={{ marginTop: 12 }}>
          <Title>
            {youWait ? COPY.armedTitle : sub(COPY.themFirstTitle, them)}
          </Title>
          <Body>
            {youWait ? sub(COPY.armedBody, them) : COPY.themFirstBody}
          </Body>
        </div>
      </div>
      <div style={sx.col12}>
        {youWait ? (
          <>
            <Button
              variant="secondary"
              size="lg"
              block
              disabled
              icon={<Check size={18} />}
            >
              {COPY.armedCta}
            </Button>
            <OtherPhone them={them} active onTap={onArmThem} />
          </>
        ) : (
          <Button
            variant="primary"
            size="lg"
            block
            icon={<Sparkle size={18} />}
            onClick={onArmThem}
          >
            {COPY.entryCta}
          </Button>
        )}
        <MicroNote icon="Info">{COPY.armedNote}</MicroNote>
      </div>
    </Mode>
  );
}

// READY, in range, both about to tap.
function ReadyView({
  them,
  alreadyLinked,
  onArmMe,
  onArmThem,
}: {
  them: string;
  alreadyLinked: boolean;
  onArmMe: () => void;
  onArmThem: () => void;
}) {
  return (
    <Mode>
      <div style={sx.center}>
        <Proximity them={them} meLit={false} themLit={false} bound={false} />
        <div style={{ marginTop: 12 }}>
          <Title>{COPY.entryTitle}</Title>
          <Body>
            {sub(alreadyLinked ? COPY.entryBodyRelink : COPY.entryBody, them)}
          </Body>
        </div>
      </div>
      <div style={sx.col12}>
        <Button
          variant="primary"
          size="lg"
          block
          icon={<Sparkle size={18} />}
          onClick={onArmMe}
        >
          {COPY.entryCta}
        </Button>
        <OtherPhone them={them} active onTap={onArmThem} />
        <MicroNote icon="Lock">{COPY.entryNote}</MicroNote>
      </div>
    </Mode>
  );
}

export interface LinkupProps {
  /** The other person in the handshake (default "devon"). */
  partner?: { handle: string };
  /** Their testing isn't up to date, drives the heads-up path (default false). */
  partnerGray?: boolean;
  /** Whether you have linked with them before (relink/relog copy, default false). */
  alreadyLinked?: boolean;
  /** The encounter write, called inside commit() (replaces LinkupStore.log). */
  onLogged?: (() => void) | undefined;
  /** The done CTA / back out of the mode. */
  onDone?: (() => void) | undefined;
  /** Test/story seeding only: initial phase (not part of the runtime API). */
  initialPhase?: Phase;
  /** Test/story seeding only: whether you have acted. */
  initialMeActed?: boolean;
  /** Test/story seeding only: whether they have acted. */
  initialThemActed?: boolean;
}

export function Linkup({
  partner = { handle: "devon" },
  partnerGray = false,
  alreadyLinked = false,
  onLogged,
  onDone,
  initialPhase = "ready",
  initialMeActed = false,
  initialThemActed = false,
}: LinkupProps) {
  const them = partner.handle;

  // phase: ready -> armed -> (headsup ->) done. meActed / themActed are the two
  // gestures; only both true ever advances past armed.
  const [meActed, setMe] = useState(initialMeActed);
  const [themActed, setThem] = useState(initialThemActed);
  const [phase, setPhase] = useState<Phase>(initialPhase);
  const [relog, setRelog] = useState(alreadyLinked && initialPhase === "done");

  // The single commit. Logs (every time) the canonical row, and on a relink it
  // says so. ONLY called from armOrComplete's both-acted branch or the heads-up
  // Continue, which itself is only reachable after both acted.
  const commit = useCallback(() => {
    onLogged?.(); // <- the encounter write
    setRelog(alreadyLinked);
    setPhase("done");
  }, [onLogged, alreadyLinked]);

  // The consent gate. A single side's act ARMS and returns, nothing is logged.
  // The bind + log only happens once both flags are true.
  const armOrComplete = useCallback(
    (side: "me" | "them") => {
      const m = side === "me" ? true : meActed;
      const tm = side === "them" ? true : themActed;
      if (side === "me") setMe(true);
      if (side === "them") setThem(true);
      if (!(m && tm)) {
        setPhase("armed"); // armed gate: NO write here
        return;
      }
      if (partnerGray) {
        setPhase("headsup"); // one calm line, defer write
        return;
      }
      commit(); // both blue -> silent write
    },
    [meActed, themActed, partnerGray, commit],
  );

  if (phase === "done") {
    return <DoneView them={them} relog={relog} onDone={onDone} />;
  }
  if (phase === "headsup") {
    return <HeadsUpView them={them} onContinue={commit} />;
  }
  if (phase === "armed") {
    return (
      <ArmedView
        them={them}
        meActed={meActed}
        themActed={themActed}
        onArmThem={() => armOrComplete(meActed ? "them" : "me")}
      />
    );
  }
  return (
    <ReadyView
      them={them}
      alreadyLinked={alreadyLinked}
      onArmMe={() => armOrComplete("me")}
      onArmThem={() => armOrComplete("them")}
    />
  );
}
