// Create circle / event. Faithful port of comps-reference/app/circles.jsx
// CircleCreate. Copy verbatim from copy.js `circles`.
import { useState } from "react";
import {
  Button,
  Card,
  Input,
  Field,
  Segmented,
} from "../../design/components/index.ts";
import {
  Lock,
  QrCode,
  Copy,
  Circles as CirclesIcon,
} from "../../design/icons.tsx";
import type { CircleType } from "./shared.tsx";

const COPY = {
  createTitle: "Create a circle or event",
  nameLabel: "Name",
  nameHint: "Keep it neutral. It shows on lock screens and notifications.",
  namePlaceholder: "e.g. Thursday crew",
  typeLabel: "Type",
  typeCircle: "Ongoing circle",
  typeEvent: "Dated event",
  dateLabel: "Event date",
  memberControlNote:
    "Each person controls their own status. A roster appears once a circle reaches 5 people, never below.",
  noCapNote: "No limit on how many people a circle can hold.",
  expLabel: "Expiration",
  expNone: "None",
  expHint: "On expiry the circle archives itself: roster and sharing stop.",
  inviteLabel: "Invite",
  approvalNote: "Joining always needs host approval.",
  createCta: "Create circle",
  createCtaEvent: "Create event",
} as const;

type Expiry = "none" | "date";

interface ExpirationCardProps {
  type: CircleType;
  exp: Expiry;
  onChange: (v: Expiry) => void;
}

function ExpirationCard({ type, exp, onChange }: ExpirationCardProps) {
  return (
    <Card style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div
        style={{ fontSize: 15, fontWeight: 700, color: "var(--text-strong)" }}
      >
        {COPY.expLabel}
      </div>
      <Segmented<Expiry>
        options={
          type === "event"
            ? [
                { value: "none", label: COPY.expNone },
                { value: "date", label: "On event date" },
              ]
            : [
                { value: "none", label: COPY.expNone },
                { value: "date", label: "30 Jun 2026" },
              ]
        }
        value={exp}
        onChange={onChange}
      />
      <div
        style={{ fontSize: 13, color: "var(--text-muted)", lineHeight: 1.5 }}
      >
        {COPY.expHint}
      </div>
    </Card>
  );
}

interface InviteSectionProps {
  onCopyInvite?: (() => void) | undefined;
}

function InviteSection({ onCopyInvite }: InviteSectionProps) {
  return (
    <div>
      <div
        style={{
          fontSize: 14,
          fontWeight: 600,
          color: "var(--text-body)",
          marginBottom: 8,
        }}
      >
        {COPY.inviteLabel}
      </div>
      <Card
        variant="flat"
        style={{ display: "flex", alignItems: "center", gap: 14 }}
      >
        <QrCode
          size={34}
          style={{ color: "var(--text-accent)", flex: "none" }}
        />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 13,
              color: "var(--text-strong)",
            }}
          >
            sti.care/c/KQ4-V2N
          </div>
          <div
            style={{
              fontSize: 12,
              color: "var(--text-subtle)",
              marginTop: 2,
            }}
          >
            Link · code · QR
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          icon={<Copy size={14} />}
          onClick={onCopyInvite}
        >
          Copy
        </Button>
      </Card>
      <div
        style={{
          fontSize: 12.5,
          color: "var(--text-subtle)",
          display: "flex",
          alignItems: "center",
          gap: 6,
          marginTop: 8,
        }}
      >
        <Lock size={13} /> {COPY.approvalNote}
      </div>
      <div
        style={{
          fontSize: 12.5,
          color: "var(--text-subtle)",
          display: "flex",
          alignItems: "center",
          gap: 6,
          marginTop: 6,
        }}
      >
        <CirclesIcon size={13} /> {COPY.noCapNote}
      </div>
    </div>
  );
}

export interface CircleCreateProps {
  onCreate?: ((name: string, type: CircleType) => void) | undefined;
  onCopyInvite?: (() => void) | undefined;
}

export function CircleCreate({ onCreate, onCopyInvite }: CircleCreateProps) {
  const [name, setName] = useState("");
  const [type, setType] = useState<CircleType>("circle");
  const [date, setDate] = useState("21 Jun 2026");
  const [exp, setExp] = useState<Expiry>("none");
  const ok = name.trim().length >= 2;

  return (
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
        {COPY.createTitle}
      </h1>

      <Field label={COPY.nameLabel} hint={COPY.nameHint}>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={COPY.namePlaceholder}
        />
      </Field>

      <div>
        <div
          style={{
            fontSize: 14,
            fontWeight: 600,
            color: "var(--text-body)",
            marginBottom: 8,
          }}
        >
          {COPY.typeLabel}
        </div>
        <Segmented<CircleType>
          options={[
            { value: "circle", label: COPY.typeCircle },
            { value: "event", label: COPY.typeEvent },
          ]}
          value={type}
          onChange={setType}
        />
      </div>
      {type === "event" && (
        <Field label={COPY.dateLabel}>
          <Input value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
      )}

      {/* No group-level status-visibility toggle: the group can never override a
          member's own disclosure. Each person controls their own status; the
          min-5 roster floor only ever HIDES, never reveals. */}
      <Card variant="flat" style={{ display: "flex", gap: 12 }}>
        <span
          style={{ color: "var(--text-accent)", flex: "none", marginTop: 1 }}
        >
          <Lock size={17} />
        </span>
        <div
          style={{ fontSize: 13, lineHeight: 1.55, color: "var(--text-body)" }}
        >
          {COPY.memberControlNote}
        </div>
      </Card>

      <ExpirationCard type={type} exp={exp} onChange={setExp} />

      <InviteSection onCopyInvite={onCopyInvite} />

      <Button
        variant="primary"
        size="lg"
        block
        disabled={!ok}
        onClick={() => onCreate?.(name.trim(), type)}
      >
        {type === "event" ? COPY.createCtaEvent : COPY.createCta}
      </Button>
    </div>
  );
}
