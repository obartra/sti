import { useState } from "react";
import { Button, Card, Input, Field } from "../../design/components/index.ts";
import { Info, Check, ShieldCheck, ArrowRight } from "../../design/icons.tsx";
import { randomAvatar, anonymousFace } from "../../lib/avatars.ts";
import type { AvatarConfig } from "../../lib/avatars.ts";
import { COPY, sectionLabel } from "./claimCopy.ts";

// The opaque id of the previewed default link. Fixed here (no session yet); the
// real one is a random id minted at publish. The anonymous face is derived from
// it the same way the wire does (anonymousFace), so the preview is honest: this
// is the face a link wears by default, not the identity above.
const PREVIEW_ALIAS_ID = "a7f3k9q2";

// The default-link preview: the anonymous, id-derived face (doc 15) and the
// opaque URL. Deliberately NOT the identity the owner is building above; that
// face only appears when they choose to show it (per link, at share time).
function DefaultLinkCard({ aliasId }: { aliasId: string }) {
  // The id-derived anonymous identity (doc 19): handle and face both seed on the
  // opaque alias id the wire seals, so the preview is honest.
  const { handle, avatarSrc: faceSrc } = anonymousFace(aliasId);
  return (
    <Card style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <img
          src={faceSrc}
          alt=""
          style={{
            width: 46,
            height: 46,
            borderRadius: "50%",
            boxShadow: "var(--shadow-sm)",
            flex: "none",
          }}
        />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: 15,
              fontWeight: 700,
              color: "var(--text-strong)",
            }}
          >
            @{handle}
          </div>
          <div
            style={{
              fontSize: 12.5,
              color: "var(--text-subtle)",
              fontFamily: "var(--font-mono)",
              marginTop: 2,
            }}
          >
            sti.care/a/{aliasId}
          </div>
        </div>
      </div>
      <div
        style={{
          fontSize: 12,
          color: "var(--text-subtle)",
          display: "flex",
          alignItems: "flex-start",
          gap: 6,
          lineHeight: 1.45,
        }}
      >
        <span style={{ flex: "none", marginTop: 1 }}>
          <Info size={13} />
        </span>{" "}
        {COPY.anonNote}
      </div>
    </Card>
  );
}

function PromiseCard() {
  return (
    <Card
      variant="tint"
      style={{ display: "flex", flexDirection: "column", gap: 12 }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          color: "var(--text-accent)",
          fontSize: 13,
          fontWeight: 700,
        }}
      >
        <ShieldCheck size={16} /> {COPY.promiseTitle}
      </div>
      {COPY.promise.map((p, i) => (
        <div
          key={i}
          style={{ display: "flex", gap: 9, alignItems: "flex-start" }}
        >
          <span
            style={{
              color: "var(--text-accent)",
              flex: "none",
              marginTop: 1,
            }}
          >
            <Check size={16} />
          </span>
          <span
            style={{
              fontSize: 13.5,
              color: "var(--text-body)",
              lineHeight: 1.5,
            }}
          >
            {p}
          </span>
        </div>
      ))}
    </Card>
  );
}

// The create-account body shown when not in the login variant. Holds the main
// identity (handle + avatar), which the login variant never touches. Reach mode
// (Direct / Gated / Findable) is chosen later, at first-run setup (doc 16).
export function CreateFlow({
  busy = false,
  onClaim,
}: {
  busy?: boolean;
  onClaim?:
    | ((handle: string | undefined, avatar: AvatarConfig) => void)
    | undefined;
}) {
  // Start empty: the owner types their own name (don't prefill a demo handle).
  const [handle, setHandle] = useState("");
  const trimmed = handle.trim();
  // Empty is allowed (name is optional); if something is typed it needs ≥3 chars.
  const ok = trimmed.length === 0 || trimmed.length >= 3;
  // The avatar is not built here (doc 19): a fresh account gets a random one and
  // the owner customizes it later from the dedicated editor. Seed once per mount so
  // every new account starts with a different face.
  const [avatar] = useState<AvatarConfig>(() =>
    randomAvatar(Math.floor(Math.random() * 0x7fffffff)),
  );

  return (
    <>
      <div style={{ ...sectionLabel, marginTop: 2 }}>
        {COPY.identitySection}
      </div>

      <Field
        label={COPY.identityHandleLabel}
        hint={COPY.identityHandleHint}
        error={
          trimmed.length > 0 && !ok ? COPY.identityHandleTooShort : undefined
        }
      >
        <Input
          value={handle}
          placeholder={COPY.identityHandlePlaceholder}
          onChange={(e) =>
            setHandle(e.target.value.replace(/[^a-z0-9_]/gi, "").toLowerCase())
          }
        />
      </Field>

      <div style={{ ...sectionLabel, marginTop: 2 }}>{COPY.defaultSection}</div>
      {/* The opaque id is the only thing in the URL, and the previewed face is
          id-derived, so the default link reveals neither your identity nor a
          way to link it to another alias. */}
      <DefaultLinkCard aliasId={PREVIEW_ALIAS_ID} />

      <PromiseCard />
      <Button
        variant="primary"
        size="lg"
        block
        disabled={!ok || busy}
        onClick={() => onClaim?.(trimmed || undefined, avatar)}
      >
        {COPY.cta} <ArrowRight size={18} />
      </Button>
    </>
  );
}
