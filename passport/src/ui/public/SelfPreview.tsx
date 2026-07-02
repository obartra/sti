import { useState } from "react";
import { cx } from "../../lib/cx.ts";
import { PublicResolution } from "./PublicResolution.tsx";
import type { ResolvedView } from "./PublicResolution.tsx";
import {
  deriveAliasCard,
  deriveOwnerCard,
  type AliasRecord,
} from "../../store/index.ts";
import { pseudonymFor } from "../../lib/avatars.ts";
import { todayEpochDay } from "../../core/clock.ts";
import type { OwnerState } from "../../core/badge.ts";
import "./self-preview.css";

/* The self-preview ("what others see"), per-alias (doc 15). A viewer always opens
   one specific link, so "what others see" is per alias: the owner picks which of
   their links to preview, and sees the exact face that link resolves to, the
   id-derived anonymous face by default, or their identity where they stamped it.
   With no link minted yet, it shows the anonymous face a new link would wear. */

// The opaque id of the example shown before any link exists. The same placeholder
// the onboarding default-link preview uses, so the two read consistently.
const EXAMPLE_ID = "a7f3k9q2";

type FaceKind = "anonymous" | "you" | "named";

interface PreviewOption {
  readonly key: string;
  readonly handle: string;
  readonly kind: FaceKind;
  readonly resolved: ResolvedView;
  // The alias's opaque id (doc 19): seeds the anonymous fallback face on the id,
  // not the pseudonym handle, matching what a viewer resolves.
  readonly id: string;
}

const KIND_TAG: Record<FaceKind, string> = {
  anonymous: "anonymous",
  you: "your identity",
  named: "custom",
};

function faceKind(
  record: AliasRecord,
  accountHandle: string | undefined,
): FaceKind {
  if (record.handle === undefined) return "anonymous";
  return record.handle === accountHandle ? "you" : "named";
}

function buildOptions(
  aliases: AliasRecord[],
  state: OwnerState,
  accountHandle: string | undefined,
  nowDay: number,
): PreviewOption[] {
  if (aliases.length === 0) {
    const handle = pseudonymFor(EXAMPLE_ID);
    return [
      {
        key: "example",
        handle,
        kind: "anonymous",
        resolved: deriveOwnerCard(state, handle, nowDay),
        id: EXAMPLE_ID,
      },
    ];
  }
  return aliases.map((a) => {
    const resolved = deriveAliasCard(state, a, nowDay);
    return {
      key: a.id,
      handle: resolved.identity.handle,
      kind: faceKind(a, accountHandle),
      resolved,
      id: a.id,
    };
  });
}

function AliasPicker({
  options,
  selected,
  onSelect,
  noneYet,
}: {
  options: PreviewOption[];
  selected: number;
  onSelect: (index: number) => void;
  noneYet: boolean;
}) {
  return (
    <div className="spv">
      <div className="spv__label">Previewing</div>
      <div className="spv__chips">
        {options.map((o, i) => {
          const active = i === selected;
          return (
            <button
              key={o.key}
              type="button"
              onClick={() => onSelect(i)}
              aria-pressed={active}
              className={cx("spv__chip", active && "spv__chip--active")}
            >
              @{o.handle}
              <span className="spv__chip-tag">{KIND_TAG[o.kind]}</span>
            </button>
          );
        })}
      </div>
      {noneYet && (
        <div className="spv__none">
          You haven’t made a link yet. This is the anonymous face a new link
          would show.
        </div>
      )}
    </div>
  );
}

export interface SelfPreviewProps {
  aliases: AliasRecord[];
  state: OwnerState;
  /** The owner's display name, or undefined when they set none. */
  accountHandle: string | undefined;
  onBack: () => void;
  onClaim: () => void;
  onVerify: () => void;
}

export function SelfPreview({
  aliases,
  state,
  accountHandle,
  onBack,
  onClaim,
  onVerify,
}: SelfPreviewProps) {
  const nowDay = todayEpochDay();
  const options = buildOptions(aliases, state, accountHandle, nowDay);
  const [selected, setSelected] = useState(0);
  const current = options[selected] ?? options[0];
  if (current === undefined) return null; // options is never empty; satisfies TS

  return (
    <PublicResolution
      resolved={current.resolved}
      aliasId={current.id}
      self
      picker={
        <AliasPicker
          options={options}
          selected={selected}
          onSelect={setSelected}
          noneYet={aliases.length === 0}
        />
      }
      onBack={onBack}
      onClaim={onClaim}
      onVerify={onVerify}
    />
  );
}
