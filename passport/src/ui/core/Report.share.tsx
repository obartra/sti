import { useState, type ReactNode } from "react";
import { Copy, Check, Flame, Hand, Heart } from "../../design/icons.tsx";
import { copyText } from "../../lib/clipboard.ts";
import { infoUrl } from "../../lib/info.ts";
import { cx } from "../../lib/cx.ts";
import "./report.css";

// After a positive is saved, an OPTIONAL way to give a heads-up to someone who
// isn't on sti.care (linked contacts are handled automatically and silently, so
// they are never mentioned here). The message is pre-written so the hard part is
// done; the tone is the user's to pick. Nothing here is required. The message
// bubble keeps its shape and tint: it depicts the text you'd send (doc 37).
interface Tone {
  id: string;
  label: string;
  icon: ReactNode;
  message: string;
}

const DIRECT: Tone = {
  id: "direct",
  label: "Direct",
  icon: <Flame size={15} />,
  message:
    "Hey, I tested positive for an STI and you should get tested too. Info + where: sti.care/exposed",
};

const TONES: Tone[] = [
  DIRECT,
  {
    id: "casual",
    label: "Casual",
    icon: <Hand size={15} />,
    message:
      "heads up, worth getting an STI test soon. why + where: sti.care/exposed",
  },
  {
    id: "gentle",
    label: "Gentle",
    icon: <Heart size={15} />,
    message:
      "Hey, looking out for you, worth an STI test soon. Here's info: sti.care/exposed",
  },
];

function ToneChip({
  tone,
  active,
  onSelect,
}: {
  tone: Tone;
  active: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={active}
      className={cx("rp__tone", active && "rp__tone--on")}
    >
      {tone.icon}
      {tone.label}
    </button>
  );
}

export function ShareHeadsUp() {
  const [activeId, setActiveId] = useState(DIRECT.id);
  const [copied, setCopied] = useState(false);
  const tone = TONES.find((t) => t.id === activeId) ?? DIRECT;

  const copy = () => {
    if (!copyText(tone.message)) return;
    setCopied(true);
    setTimeout(() => setCopied(false), 1400);
  };

  return (
    <div className="rp__hu">
      <div>
        <div className="rp__hu-title">
          Linked with someone who isn&apos;t on sti.care?
        </div>
        <div className="rp__hu-sub">
          Shoot them a quick text. We wrote it for you:
        </div>
      </div>

      <div className="rp__hu-tones">
        {TONES.map((t) => (
          <ToneChip
            key={t.id}
            tone={t}
            active={t.id === activeId}
            onSelect={() => setActiveId(t.id)}
          />
        ))}
      </div>

      <div className="rp__hu-bubble">
        <button
          type="button"
          onClick={copy}
          aria-label="Copy message"
          className="rp__hu-copy"
        >
          {copied ? <Check size={17} /> : <Copy size={17} />}
        </button>
        <div className="rp__hu-msg">{tone.message}</div>
      </div>

      <a
        href={infoUrl("/tell-a-partner")}
        target="_blank"
        rel="noopener noreferrer"
        className="rp__hu-link"
      >
        See how to tell a partner
      </a>
    </div>
  );
}
