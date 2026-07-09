import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { ContactLinks } from "./ContactLinks.tsx";
import type { ContactRecord } from "../../store/index.ts";
import {
  randomAliasId,
  randomWriteToken,
  bytesToBase64url,
} from "../../crypto/index.ts";

function aliasRecord() {
  return {
    id: randomAliasId(),
    writeToken: randomWriteToken(),
    key: bytesToBase64url(crypto.getRandomValues(new Uint8Array(32))),
    isPublic: false,
  };
}

function contact(
  label: string,
  linked: boolean,
  expiresAt: number | null = null,
): ContactRecord {
  const base = {
    id: randomAliasId(),
    label,
    createdDay: 19_000,
    expiresAt,
    alias: aliasRecord(),
  };
  return linked
    ? {
        ...base,
        theirStatusAlias: { id: randomAliasId(), key: randomAliasId() },
      }
    : base;
}

const noop = () => undefined;
const noCreate = () => Promise.resolve({ url: "" });

describe("ContactLinks", () => {
  it("labels each contact as linked or awaiting their link back", () => {
    render(
      <ContactLinks
        contacts={[contact("Sam", true), contact("Ana", false)]}
        onCreate={noCreate}
        onRevoke={noop}
      />,
    );
    expect(screen.getByText(/^Linked/)).toBeInTheDocument();
    expect(screen.getByText(/Waiting for their link/)).toBeInTheDocument();
  });

  it("surfaces a failure to create a link instead of silently doing nothing", async () => {
    const user = userEvent.setup();
    render(
      <ContactLinks
        contacts={[]}
        onCreate={() => Promise.reject(new Error("offline"))}
        onRevoke={noop}
      />,
    );
    await user.click(screen.getByRole("button", { name: /Create a link/ }));
    expect(
      await screen.findByText(/Couldn’t create the link/),
    ).toBeInTheDocument();
  });

  it("offers the lifetime choice and defaults to no expiry", async () => {
    const user = userEvent.setup();
    const onCreate = vi.fn(() => Promise.resolve({ url: "" }));
    render(<ContactLinks contacts={[]} onCreate={onCreate} onRevoke={noop} />);
    expect(screen.getByRole("group", { name: "Link lasts" })).toBeVisible();
    await user.click(screen.getByRole("button", { name: /Create a link/ }));
    expect(onCreate).toHaveBeenCalledWith("", "anonymous", null);
  });

  it("mints with an absolute expiry when a lifetime is picked", async () => {
    const user = userEvent.setup();
    const onCreate = vi.fn<
      (l: string, i: string, e: number | null) => Promise<{ url: string }>
    >(() => Promise.resolve({ url: "" }));
    render(<ContactLinks contacts={[]} onCreate={onCreate} onRevoke={noop} />);
    const before = Date.now();
    await user.click(screen.getByRole("button", { name: "7 days" }));
    await user.click(screen.getByRole("button", { name: /Create a link/ }));
    const expiresAt = onCreate.mock.calls[0]?.[2];
    const sevenDays = 7 * 24 * 60 * 60 * 1000;
    expect(expiresAt).toBeGreaterThanOrEqual(before + sevenDays);
    expect(expiresAt).toBeLessThanOrEqual(Date.now() + sevenDays);
  });

  it("shows how long a link has left, and nothing on a no-expiry link", () => {
    const sevenDays = 7 * 24 * 60 * 60 * 1000;
    render(
      <ContactLinks
        contacts={[
          contact("Sam", true, Date.now() + sevenDays),
          contact("Ana", false),
        ]}
        onCreate={noCreate}
        onRevoke={noop}
      />,
    );
    expect(screen.getByText(/Expires in 7 days/)).toBeInTheDocument();
    expect(screen.getByText(/Waiting for their link/).textContent).not.toMatch(
      /Expires/,
    );
  });

  it("mints anonymously by default", async () => {
    const user = userEvent.setup();
    const onCreate = vi.fn(() => Promise.resolve({ url: "" }));
    render(
      <ContactLinks
        contacts={[]}
        onCreate={onCreate}
        onRevoke={noop}
        canShowName
      />,
    );
    await user.click(screen.getByRole("button", { name: /Create a link/ }));
    expect(onCreate).toHaveBeenCalledWith("", "anonymous", null);
  });

  it("mints with the owner's name when they choose to show it", async () => {
    const user = userEvent.setup();
    const onCreate = vi.fn(() => Promise.resolve({ url: "" }));
    render(
      <ContactLinks
        contacts={[]}
        onCreate={onCreate}
        onRevoke={noop}
        canShowName
      />,
    );
    await user.click(screen.getByRole("button", { name: "Show my name" }));
    await user.click(screen.getByRole("button", { name: /Create a link/ }));
    expect(onCreate).toHaveBeenCalledWith("", "main", null);
  });

  it("hides the lifetime choice for a named link, which is standing and never expires", async () => {
    const user = userEvent.setup();
    const onCreate = vi.fn(() => Promise.resolve({ url: "" }));
    render(
      <ContactLinks
        contacts={[]}
        onCreate={onCreate}
        onRevoke={noop}
        canShowName
      />,
    );
    // Pick a duration while anonymous, then switch to showing your name.
    await user.click(screen.getByRole("button", { name: "7 days" }));
    await user.click(screen.getByRole("button", { name: "Show my name" }));
    // The lifetime choice is gone: a named link is standing, not one-off.
    expect(screen.queryByRole("group", { name: "Link lasts" })).toBeNull();
    await user.click(screen.getByRole("button", { name: /Create a link/ }));
    // The earlier duration does not stick to the named link; it never expires.
    expect(onCreate).toHaveBeenCalledWith("", "main", null);
  });

  it("hides the show-my-name choice when the owner has no name", () => {
    render(<ContactLinks contacts={[]} onCreate={noCreate} onRevoke={noop} />);
    expect(screen.queryByRole("button", { name: "Show my name" })).toBeNull();
  });

  it("renames a link's local label from its options menu", async () => {
    const user = userEvent.setup();
    const onRename = vi.fn();
    const sam = contact("Sam", true);
    render(
      <ContactLinks
        contacts={[sam]}
        onCreate={noCreate}
        onRevoke={noop}
        onRename={onRename}
      />,
    );
    await user.click(screen.getByRole("button", { name: /Options for Sam/ }));
    const input = screen.getByRole("textbox", { name: "Rename this link" });
    // Save is disabled until the value actually changes.
    const save = screen.getByRole("button", { name: "Save" });
    expect(save).toBeDisabled();
    await user.clear(input);
    await user.type(input, "Sammy");
    await user.click(save);
    expect(onRename).toHaveBeenCalledWith(sam.id, "Sammy");
  });

  it("revokes a link from its options menu", async () => {
    const user = userEvent.setup();
    const onRevoke = vi.fn();
    render(
      <ContactLinks
        contacts={[contact("Sam", true)]}
        onCreate={noCreate}
        onRevoke={onRevoke}
      />,
    );
    await user.click(screen.getByRole("button", { name: /Options for Sam/ }));
    await user.click(screen.getByRole("button", { name: "Revoke" }));
    expect(onRevoke).toHaveBeenCalledTimes(1);
  });

  it("hides the rename field when no rename handler is provided", async () => {
    const user = userEvent.setup();
    render(
      <ContactLinks
        contacts={[contact("Sam", true)]}
        onCreate={noCreate}
        onRevoke={noop}
      />,
    );
    await user.click(screen.getByRole("button", { name: /Options for Sam/ }));
    expect(
      screen.queryByRole("textbox", { name: "Rename this link" }),
    ).toBeNull();
  });
});

describe("ContactLinks avatar entry (doc 19)", () => {
  const baseProps = {
    contacts: [],
    onCreate: () => Promise.resolve({ url: "https://sti.care/a/x" }),
    onRevoke: () => undefined,
  };

  it("shows the avatar editor entry and opens it on Edit", async () => {
    const onEditAvatar = vi.fn();
    render(
      <ContactLinks
        {...baseProps}
        avatarSrc="data:image/svg+xml,<svg/>"
        onEditAvatar={onEditAvatar}
      />,
    );
    expect(screen.getByText("Your avatar")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Edit" }));
    expect(onEditAvatar).toHaveBeenCalledTimes(1);
  });

  it("hides the entry when no editor handler is provided", () => {
    render(<ContactLinks {...baseProps} />);
    expect(screen.queryByText("Your avatar")).not.toBeInTheDocument();
  });
});
