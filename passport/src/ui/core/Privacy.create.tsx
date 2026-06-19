import {
  Button,
  Avatar,
  Segmented,
  Input,
  Field,
} from "../../design/components/index.ts";
import { Info, Globe, Sparkle } from "../../design/icons.tsx";
import { COPY } from "./Privacy.parts.tsx";
import type { Vis, PrivacyState } from "./Privacy.parts.tsx";

export function ReuseWarnBanner({ state }: { state: PrivacyState }) {
  const reuseWarn = state.reuseWarn;
  if (!reuseWarn) return null;
  return (
    <div
      style={{
        margin: 6,
        padding: 14,
        borderRadius: "var(--radius-md)",
        background: "var(--treat-50, #FBF3D9)",
        display: "flex",
        flexDirection: "column",
        gap: 11,
      }}
    >
      <div style={{ display: "flex", gap: 9 }}>
        <span
          style={{
            color: "var(--status-treat-base)",
            flex: "none",
            marginTop: 1,
          }}
        >
          <Info size={17} />
        </span>
        <div
          style={{
            fontSize: 13,
            lineHeight: 1.5,
            color: "var(--status-treat-fg)",
          }}
        >
          {COPY.aliasReuseWarn.replace("{h}", reuseWarn.handle)}
        </div>
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <Button
          variant="quiet"
          size="sm"
          block
          onClick={() => state.setReuseWarn(null)}
        >
          {COPY.aliasReuseCancel}
        </Button>
        <Button
          variant="secondary"
          size="sm"
          block
          onClick={() => state.applyVis(reuseWarn.id, reuseWarn.vis)}
        >
          {COPY.aliasReuseProceed}
        </Button>
      </div>
    </div>
  );
}

function CreateHeader({ state }: { state: PrivacyState }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
      <Avatar
        size="lg"
        initials={(
          state.newHandle.trim().replace(/^@/, "").slice(0, 1) || "A"
        ).toUpperCase()}
        style={{ flex: "none" }}
      />
      <div style={{ flex: 1 }}>
        <div
          style={{
            fontSize: 14.5,
            fontWeight: 700,
            color: "var(--text-strong)",
          }}
        >
          {COPY.aliasCreateTitle}
        </div>
        <div style={{ fontSize: 12.5, color: "var(--text-muted)" }}>
          {COPY.aliasCreateSub}
        </div>
      </div>
      <Button variant="quiet" size="sm" icon={<Sparkle size={14} />}>
        {COPY.aliasShuffle}
      </Button>
    </div>
  );
}

export function CreateAliasForm({ state }: { state: PrivacyState }) {
  const reusesExisting = state.aliases.some(
    (x) => x.handle === state.newHandle.replace(/^@/, "").toLowerCase(),
  );
  return (
    <div
      style={{
        margin: 6,
        padding: 12,
        borderRadius: "var(--radius-md)",
        background: "var(--surface-app)",
        display: "flex",
        flexDirection: "column",
        gap: 12,
      }}
    >
      <CreateHeader state={state} />
      <Field label={COPY.aliasHandleLabel} hint={COPY.aliasHandleHint}>
        <Input
          value={state.newHandle}
          onChange={(e) => {
            state.setNewHandle(
              e.target.value.replace(/[^a-z0-9_.]/gi, "").toLowerCase(),
            );
            state.setClaimTaken(false);
          }}
          placeholder="r.weekend"
        />
      </Field>
      {state.newHandle && reusesExisting && (
        <div
          style={{
            fontSize: 12,
            color: "var(--status-treat-fg)",
            display: "flex",
            gap: 6,
            alignItems: "center",
          }}
        >
          <Info size={13} style={{ flex: "none" }} /> {COPY.aliasReuseInline}
        </div>
      )}
      <Segmented
        value={state.newVis}
        onChange={(v: Vis) => {
          state.setNewVis(v);
          state.setClaimTaken(false);
        }}
        options={[
          { value: "private", label: COPY.aliasPrivate },
          { value: "public", label: COPY.aliasPublic },
          { value: "findable", label: COPY.aliasFindable },
        ]}
      />
      {state.newVis === "findable" && (
        <div
          style={{
            fontSize: 12,
            color: "var(--text-subtle)",
            lineHeight: 1.45,
            display: "flex",
            gap: 6,
          }}
        >
          <Globe size={13} style={{ flex: "none", marginTop: 1 }} />{" "}
          {COPY.vanityClaimNote}
        </div>
      )}
      {state.claimTaken && (
        <div
          style={{
            fontSize: 12.5,
            fontWeight: 600,
            color: "var(--status-expired-fg)",
            display: "flex",
            gap: 6,
            alignItems: "center",
          }}
        >
          <Info size={13} /> {COPY.vanityClaimTaken}
        </div>
      )}
      <div style={{ display: "flex", gap: 8 }}>
        <Button
          variant="quiet"
          size="sm"
          onClick={() => {
            state.setCreating(false);
            state.setNewHandle("");
            state.setNewVis("private");
            state.setClaimTaken(false);
          }}
        >
          Cancel
        </Button>
        <Button variant="secondary" size="sm" block onClick={state.createAlias}>
          {COPY.aliasCreateCta}
        </Button>
      </div>
    </div>
  );
}
