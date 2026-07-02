import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { peopleRenderers } from "./peopleScreens.tsx";
import type { ScreenCtx } from "./context.ts";

// The People page order is load-bearing: starred and groups are the prominent
// surfaces up top, the full contact list is secondary, and the "how this stays
// private" card sits last, out of the way. Pin that the privacy card renders and
// that it comes after the groups section in the DOM.
describe("peopleScreens People page", () => {
  it("renders groups above the privacy card (info content last)", () => {
    const ctx = {
      nav: { go: vi.fn(), back: vi.fn() },
      contacts: [],
      faves: new Set<string>(),
      onToggleFave: vi.fn(),
      onRevokeContact: vi.fn(),
      groups: [],
    } as unknown as ScreenCtx;

    render(<>{peopleRenderers.people?.(ctx)}</>);

    const groups = screen.getByRole("heading", { name: "Groups" });
    const privacy = screen.getByText("How this stays private");
    expect(groups).toBeInTheDocument();
    expect(privacy).toBeInTheDocument();
    // Privacy card is last: it follows the groups section in document order.
    expect(groups.compareDocumentPosition(privacy)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
  });
});
