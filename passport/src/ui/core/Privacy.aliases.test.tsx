import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { LiveLinks } from "./Privacy.aliases.tsx";
import type { AliasRecord, ContactRecord } from "../../store/index.ts";

const id = (c: string) => c.repeat(43);
const alias = (seed: string, isPublic: boolean): AliasRecord => ({
  id: id(seed),
  writeToken: id("W"),
  key: id("K"),
  isPublic,
});
const contact = (label: string): ContactRecord => ({
  id: id("C"),
  label,
  createdDay: 19_000,
  expiresAt: null,
  alias: alias("D", false),
});

describe("LiveLinks", () => {
  it("lists the public/casual aliases and contact links, and revokes each", async () => {
    const user = userEvent.setup();
    const onRevokeAlias = vi.fn();
    const onRevokeContact = vi.fn();
    render(
      <LiveLinks
        aliases={[alias("A", true), alias("B", false)]}
        contacts={[contact("Sam")]}
        onRevokeAlias={onRevokeAlias}
        onRevokeContact={onRevokeContact}
      />,
    );

    expect(screen.getByText("Public profile")).toBeInTheDocument();
    expect(screen.getByText("Casual link")).toBeInTheDocument();
    expect(screen.getByText("Sam")).toBeInTheDocument();

    // Aliases come first (public, casual), then contact links.
    const [aliasRevoke, , contactRevoke] = screen.getAllByRole("button", {
      name: "Revoke",
    });
    if (!aliasRevoke || !contactRevoke) {
      throw new Error("expected a revoke for each link");
    }
    await user.click(aliasRevoke);
    expect(onRevokeAlias).toHaveBeenCalledWith(id("A"));
    await user.click(contactRevoke);
    expect(onRevokeContact).toHaveBeenCalledWith(id("C"));
  });

  it("shows an empty state when nothing is shared", () => {
    render(
      <LiveLinks
        aliases={[]}
        contacts={[]}
        onRevokeAlias={vi.fn()}
        onRevokeContact={vi.fn()}
      />,
    );
    expect(screen.getByText(/No links shared yet/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Revoke" })).toBeNull();
  });
});
