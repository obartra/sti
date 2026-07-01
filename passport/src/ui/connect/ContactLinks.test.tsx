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

function contact(label: string, linked: boolean): ContactRecord {
  const base = {
    id: randomAliasId(),
    label,
    createdDay: 19_000,
    expiresAt: null,
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
    expect(screen.getByText(/Linked both ways/)).toBeInTheDocument();
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

  it("has no lifetime control: every link is durable until revoked", () => {
    render(<ContactLinks contacts={[]} onCreate={noCreate} onRevoke={noop} />);
    expect(screen.queryByText("Lasts")).toBeNull();
    expect(screen.queryByRole("tablist", { name: "Link lifetime" })).toBeNull();
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
    expect(onCreate).toHaveBeenCalledWith("", "anonymous");
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
    expect(onCreate).toHaveBeenCalledWith("", "main");
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
