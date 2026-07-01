import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { LiveLinks } from "./Privacy.aliases.tsx";
import type { LinkShareContext } from "./Privacy.aliases.share.tsx";
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

const shareCtx: LinkShareContext = {
  state: "blue",
  labels: [],
  route: null,
  handle: "robin",
};

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

    // Each revoke names the link it acts on (so a screen with two lists stays
    // unambiguous): the public profile, and the "Sam" contact link.
    await user.click(
      screen.getByRole("button", { name: "Revoke Public profile" }),
    );
    expect(onRevokeAlias).toHaveBeenCalledWith(id("A"));
    await user.click(screen.getByRole("button", { name: "Revoke Sam" }));
    expect(onRevokeContact).toHaveBeenCalledWith(id("C"));
  });

  it("opens a per-link share sheet (its own QR) when a badge context is given", async () => {
    const user = userEvent.setup();
    render(
      <LiveLinks
        aliases={[alias("A", true)]}
        contacts={[contact("Sam")]}
        onRevokeAlias={vi.fn()}
        onRevokeContact={vi.fn()}
        share={shareCtx}
      />,
    );

    // Each row has its own Share action; no single global passport card.
    expect(
      screen.getByRole("button", { name: "Share Public profile" }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Share Sam" }));
    // The share sheet opens for that one link (its private-link title).
    expect(await screen.findByText("Share private link")).toBeInTheDocument();
  });

  it("hides the per-link share action when no badge context is given", () => {
    render(
      <LiveLinks
        aliases={[alias("A", true)]}
        contacts={[]}
        onRevokeAlias={vi.fn()}
        onRevokeContact={vi.fn()}
      />,
    );
    expect(screen.queryByRole("button", { name: /^Share/ })).toBeNull();
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
