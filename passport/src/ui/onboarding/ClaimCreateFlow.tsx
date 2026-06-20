import { useState } from "react";
import {
  Button,
  Card,
  Input,
  Field,
  Switch,
  Segmented,
} from "../../design/components/index.ts";
import {
  Info,
  Lock,
  Check,
  Globe,
  Link,
  ShieldCheck,
  ArrowRight,
} from "../../design/icons.tsx";
import { randomAvatar, avatarSrc } from "../../lib/avatars.ts";
import type { AvatarConfig } from "../../lib/avatars.ts";
import { AvatarBuilder } from "./AvatarBuilder.tsx";
import { COPY, sectionLabel } from "./claimCopy.ts";
import type { Vis } from "./claimCopy.ts";

// The opaque-id alias card: avatar, @handle, the URL, and the opaque-id note.
function AliasCard({
  handle,
  avatar,
  aliasId,
}: {
  handle: string;
  avatar: AvatarConfig;
  aliasId: string;
}) {
  return (
    <Card style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <img
          src={avatarSrc(avatar)}
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
            @{handle || "…"}
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
        {COPY.opaqueNote}
      </div>
    </Card>
  );
}

// Public vs private = key distribution. Private (default) keeps the key off the
// URL; public puts it in the #fragment.
function VisibilityCard({
  vis,
  onChange,
}: {
  vis: Vis;
  onChange: (next: Vis) => void;
}) {
  return (
    <Card style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div
        style={{
          fontSize: 15,
          fontWeight: 700,
          color: "var(--text-strong)",
        }}
      >
        {COPY.visTitle}
      </div>
      <Segmented<Vis>
        options={[
          { value: "private", label: COPY.visPrivate },
          { value: "public", label: COPY.visPublic },
        ]}
        value={vis}
        onChange={onChange}
      />
      <div
        style={{
          fontSize: 12.5,
          color: "var(--text-muted)",
          lineHeight: 1.5,
          display: "flex",
          gap: 6,
        }}
      >
        <span
          style={{
            flex: "none",
            marginTop: 1,
            color: "var(--text-accent)",
          }}
        >
          {vis === "private" ? <Lock size={13} /> : <Link size={13} />}
        </span>
        <span>
          {vis === "private" ? COPY.visPrivateNote : COPY.visPublicNote}
        </span>
      </div>
    </Card>
  );
}

// Vanity opt-in, the one taught choice point. Public-only, off by default.
function VanityCard({
  vis,
  vanity,
  onChange,
}: {
  vis: Vis;
  vanity: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <Card
      variant="flat"
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 10,
        opacity: vis === "public" ? 1 : 0.55,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ flex: "none", color: "var(--text-subtle)" }}>
          <Globe size={18} />
        </span>
        <div style={{ flex: 1 }}>
          <div
            style={{
              fontSize: 14,
              fontWeight: 700,
              color: "var(--text-strong)",
            }}
          >
            {COPY.vanityTitle}
          </div>
          <div style={{ fontSize: 12, color: "var(--text-subtle)" }}>
            {COPY.vanityOff}
          </div>
        </div>
        <Switch
          checked={vanity}
          onChange={(v) => onChange(v && vis === "public")}
          disabled={vis !== "public"}
        />
      </div>
      {vanity && (
        <div
          style={{
            fontSize: 12.5,
            lineHeight: 1.5,
            color: "var(--status-treat-fg)",
            background: "var(--treat-50, #FBF3D9)",
            borderRadius: "var(--radius-sm)",
            padding: "9px 11px",
            display: "flex",
            gap: 7,
          }}
        >
          <span style={{ flex: "none", marginTop: 1 }}>
            <Info size={14} />
          </span>
          <span>{COPY.vanityWarn}</span>
        </div>
      )}
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

// The create-account body shown when not in the login variant. Holds all the
// alias-related state, which the login variant never touches.
export function CreateFlow({
  busy = false,
  onClaim,
}: {
  busy?: boolean;
  onClaim?: ((handle: string, avatar: AvatarConfig) => void) | undefined;
}) {
  const [handle, setHandle] = useState("robin");
  // First alias is opaque + PRIVATE by default; vanity is an explicit opt-in.
  const [vis, setVis] = useState<Vis>("private");
  const [vanity, setVanity] = useState(false);
  const aliasId = "a7f3k9q2"; // opaque id, the only thing in the URL
  const ok = handle.trim().length >= 3;
  // Avatar config lives in component state; seed a deterministic default.
  const [avatar, setAvatar] = useState<AvatarConfig>(() => randomAvatar(2));

  return (
    <>
      <div style={{ ...sectionLabel, marginTop: 2 }}>{COPY.aliasSection}</div>

      {/* The opaque id is the only thing in the URL; the handle lives in the
          encrypted payload. Two aliases can't be linked by their address. */}
      <AliasCard handle={handle} avatar={avatar} aliasId={aliasId} />

      <Field label={COPY.aliasHandleLabel} hint={COPY.aliasHandleHint}>
        <Input
          value={handle}
          onChange={(e) =>
            setHandle(e.target.value.replace(/[^a-z0-9_]/gi, "").toLowerCase())
          }
        />
      </Field>

      <div>
        <div
          style={{
            fontSize: 14,
            fontWeight: 600,
            color: "var(--text-body)",
            marginBottom: 4,
          }}
        >
          {COPY.avatarLabel}
        </div>
        <div
          style={{
            fontSize: 13,
            color: "var(--text-muted)",
            marginBottom: 12,
          }}
        >
          {COPY.avatarHint}
        </div>
        <AvatarBuilder config={avatar} onChange={setAvatar} />
      </div>

      <VisibilityCard
        vis={vis}
        onChange={(v) => {
          setVis(v);
          if (v === "private") setVanity(false);
        }}
      />

      <VanityCard vis={vis} vanity={vanity} onChange={setVanity} />

      <PromiseCard />
      <Button
        variant="primary"
        size="lg"
        block
        disabled={!ok || busy}
        onClick={() => onClaim?.(handle.trim(), avatar)}
      >
        {COPY.cta} <ArrowRight size={18} />
      </Button>
    </>
  );
}
