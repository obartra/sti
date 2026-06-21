import { useState, type ReactNode } from "react";
import { Copy, Check, Flame, Hand, Heart } from "../../design/icons.tsx";

// After a positive is saved, an OPTIONAL way to give a heads-up to someone who
// isn't on sti.care (linked contacts are handled automatically and silently, so
// they are never mentioned here). The message is pre-written so the hard part is
// done; the tone is the user's to pick. Nothing here is required.
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
      style={{
        flex: 1,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 5,
        padding: "8px 6px",
        borderRadius: "var(--radius-md)",
        cursor: "pointer",
        fontSize: 12.5,
        fontWeight: active ? 700 : 500,
        border: active
          ? "1px solid var(--accent)"
          : "1px solid var(--border-card)",
        background: active ? "var(--accent-soft)" : "transparent",
        color: active ? "var(--text-accent)" : "var(--text-muted)",
      }}
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
    try {
      void navigator.clipboard.writeText(tone.message).catch(() => undefined);
    } catch {
      // no clipboard available
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1400);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div>
        <div
          style={{ fontSize: 15, fontWeight: 700, color: "var(--text-strong)" }}
        >
          Linked with someone who isn&apos;t on sti.care?
        </div>
        <div
          style={{
            fontSize: 13,
            lineHeight: 1.5,
            color: "var(--text-muted)",
            marginTop: 5,
          }}
        >
          Shoot them a quick text. We wrote it for you:
        </div>
      </div>

      <div style={{ display: "flex", gap: 7 }}>
        {TONES.map((t) => (
          <ToneChip
            key={t.id}
            tone={t}
            active={t.id === activeId}
            onSelect={() => setActiveId(t.id)}
          />
        ))}
      </div>

      <div
        style={{
          position: "relative",
          background: "var(--accent-soft)",
          borderRadius: "var(--radius-lg)",
          borderTopLeftRadius: 5,
          padding: "13px 42px 13px 14px",
        }}
      >
        <button
          type="button"
          onClick={copy}
          aria-label="Copy message"
          style={{
            position: "absolute",
            top: 8,
            right: 8,
            width: 30,
            height: 30,
            borderRadius: "var(--radius-md)",
            border: "none",
            background: "transparent",
            color: "var(--text-accent)",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
          }}
        >
          {copied ? <Check size={17} /> : <Copy size={17} />}
        </button>
        <div
          style={{
            fontSize: 13.5,
            lineHeight: 1.55,
            color: "var(--text-strong)",
          }}
        >
          {tone.message}
        </div>
      </div>
    </div>
  );
}
