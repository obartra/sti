import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { SelfPreview } from "./SelfPreview.tsx";
import { pseudonymFor } from "../../lib/avatars.ts";
import { INITIAL_OWNER_STATE } from "../../core/badge.ts";
import type { AliasRecord } from "../../store/index.ts";

const ACCOUNT_HANDLE = "robin";

function alias(over: Partial<AliasRecord>): AliasRecord {
  return { id: "id-0", writeToken: "w", key: "k", isPublic: true, ...over };
}

function renderPreview(aliases: AliasRecord[]) {
  return render(
    <SelfPreview
      aliases={aliases}
      state={INITIAL_OWNER_STATE}
      accountHandle={ACCOUNT_HANDLE}
      onBack={vi.fn()}
      onClaim={vi.fn()}
      onVerify={vi.fn()}
    />,
  );
}

describe("SelfPreview", () => {
  it("with no link yet, previews the anonymous face a new link would show", () => {
    renderPreview([]);
    expect(screen.getByText(/haven’t made a link yet/)).toBeInTheDocument();
    // The example uses the same id-derived pseudonym the wire would, not the
    // owner's account handle.
    const exampleHandle = pseudonymFor("a7f3k9q2");
    expect(screen.getAllByText(`@${exampleHandle}`).length).toBeGreaterThan(0);
    expect(screen.queryByText(`@${ACCOUNT_HANDLE}`)).toBeNull();
  });

  it("labels each alias by the face it resolves to (anonymous vs your identity)", () => {
    const anonId = "anon-alias-id";
    renderPreview([
      alias({ id: anonId }), // no override = anonymous
      alias({ id: "main-alias-id", handle: ACCOUNT_HANDLE }), // stamped main identity
    ]);
    // Anonymous alias shows its id-derived pseudonym, tagged anonymous.
    expect(
      screen.getAllByText(`@${pseudonymFor(anonId)}`).length,
    ).toBeGreaterThan(0);
    expect(screen.getByText("anonymous")).toBeInTheDocument();
    // The main-identity alias shows the account handle, tagged accordingly.
    expect(screen.getByText("your identity")).toBeInTheDocument();
  });

  it("swaps the previewed face when another alias is picked", () => {
    const anonId = "anon-alias-id";
    renderPreview([
      alias({ id: anonId }),
      alias({ id: "main-alias-id", handle: ACCOUNT_HANDLE }),
    ]);
    const anonHandle = pseudonymFor(anonId);
    // Each handle appears once in its chip; the previewed one appears again in
    // the badge. The anonymous alias is selected by default (chip + badge = 2),
    // the main-identity one only as its chip (1).
    expect(screen.getAllByText(`@${anonHandle}`).length).toBe(2);
    expect(screen.getAllByText(`@${ACCOUNT_HANDLE}`).length).toBe(1);

    // Pick the main-identity alias: now its face is the one in the badge.
    fireEvent.click(
      screen.getByRole("button", { name: new RegExp(ACCOUNT_HANDLE) }),
    );
    expect(screen.getAllByText(`@${ACCOUNT_HANDLE}`).length).toBe(2);
    expect(screen.getAllByText(`@${anonHandle}`).length).toBe(1);
  });
});
