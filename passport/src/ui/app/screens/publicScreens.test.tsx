import { render, waitFor } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { publicRenderers } from "./publicScreens.tsx";
import type { ScreenCtx } from "./context.ts";

const ID = "A".repeat(43);

// The load-bearing privacy property of Findable: looking someone up by name
// resolves to gray-nothing + a knock, NEVER to their status. That holds only
// because the u-resolve -> a2-public handoff carries the alias id (+ the public
// name, for the report affordance) but NO decryption key. A refactor that threaded
// a key through would silently turn a name lookup into a status leak, so pin it.
describe("publicScreens u-resolve handoff", () => {
  it("hands a resolved name to a2-public WITHOUT a key (keyless knock)", async () => {
    const go = vi.fn();
    const ctx = {
      data: { name: "robin" },
      store: { resolveVanityName: () => Promise.resolve(ID) },
      nav: { go, back: vi.fn() },
    } as unknown as ScreenCtx;

    render(<>{publicRenderers["u-resolve"]?.(ctx)}</>);

    await waitFor(() =>
      expect(go).toHaveBeenCalledWith("a2-public", expect.anything()),
    );
    const data = (go.mock.calls[0]?.[1] ?? {}) as Record<string, unknown>;
    expect(data).toEqual({ id: ID, name: "robin" });
    expect("key" in data).toBe(false);
  });
});
