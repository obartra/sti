import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { ContactLinks } from "./ContactLinks.tsx";
import { DAY_MS } from "../../core/clock.ts";
import {
  contactInviteUrl,
  mintNotify,
  type ContactRecord,
} from "../../store/index.ts";
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
    expiresAt: 19_007,
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
        now={19_000}
        onCreate={noCreate}
        onRevoke={noop}
        onSetDuration={noop}
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
        now={19_000}
        onCreate={() => Promise.reject(new Error("offline"))}
        onRevoke={noop}
        onSetDuration={noop}
      />,
    );
    await user.click(screen.getByRole("button", { name: /Create a link/ }));
    expect(
      await screen.findByText(/Couldn’t create the link/),
    ).toBeInTheDocument();
  });

  it("changes a link's lifetime in place from its options menu", async () => {
    const user = userEvent.setup();
    const onSetDuration = vi.fn();
    const sam = contact("Sam", true);
    render(
      <ContactLinks
        contacts={[sam]}
        now={19_000}
        onCreate={noCreate}
        onRevoke={noop}
        onSetDuration={onSetDuration}
      />,
    );
    // The row's lifetime menu is hidden until its options button is tapped (the
    // always-visible "Lasts" picker on the create card is a separate control).
    expect(
      screen.queryByRole("tablist", { name: "Change link lifetime" }),
    ).toBeNull();
    await user.click(screen.getByRole("button", { name: /Options for Sam/ }));
    const menu = screen.getByRole("tablist", { name: "Change link lifetime" });
    // Picking "24h" sets a 1-day lifetime for this link (not a new link).
    await user.click(within(menu).getByRole("tab", { name: "24h" }));
    expect(onSetDuration).toHaveBeenCalledWith(sam.id, DAY_MS);
  });

  it("can set a link to never expire from its options menu", async () => {
    const user = userEvent.setup();
    const onSetDuration = vi.fn();
    const ana = contact("Ana", false);
    render(
      <ContactLinks
        contacts={[ana]}
        now={19_000}
        onCreate={noCreate}
        onRevoke={noop}
        onSetDuration={onSetDuration}
      />,
    );
    await user.click(screen.getByRole("button", { name: /Options for Ana/ }));
    const menu = screen.getByRole("tablist", { name: "Change link lifetime" });
    await user.click(within(menu).getByRole("tab", { name: "No expiry" }));
    expect(onSetDuration).toHaveBeenCalledWith(ana.id, null);
  });

  it("renames a link's local label from its options menu", async () => {
    const user = userEvent.setup();
    const onRename = vi.fn();
    const sam = contact("Sam", true);
    render(
      <ContactLinks
        contacts={[sam]}
        now={19_000}
        onCreate={noCreate}
        onRevoke={noop}
        onRename={onRename}
        onSetDuration={noop}
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

  it("hides the rename field when no rename handler is provided", async () => {
    const user = userEvent.setup();
    render(
      <ContactLinks
        contacts={[contact("Sam", true)]}
        now={19_000}
        onCreate={noCreate}
        onRevoke={noop}
        onSetDuration={noop}
      />,
    );
    await user.click(screen.getByRole("button", { name: /Options for Sam/ }));
    expect(
      screen.queryByRole("textbox", { name: "Rename this link" }),
    ).toBeNull();
  });

  it("ingests a pasted return link, parsing it to the invite", async () => {
    const user = userEvent.setup();
    const onIngestReturn = vi.fn();
    render(
      <ContactLinks
        contacts={[]}
        now={19_000}
        onCreate={noCreate}
        onRevoke={noop}
        onSetDuration={noop}
        onIngestReturn={onIngestReturn}
      />,
    );
    // A real return invite: an alias + notify + ref (the inviter's alias id).
    const notify = mintNotify();
    const ref = randomAliasId();
    const url = contactInviteUrl(aliasRecord(), notify, { ref });

    await user.type(screen.getByPlaceholderText(/Paste the link/i), url);
    await user.click(screen.getByRole("button", { name: "Link both ways" }));

    expect(onIngestReturn).toHaveBeenCalledTimes(1);
    expect(onIngestReturn.mock.calls[0]?.[0]).toMatchObject({ ref });
  });

  it("rejects a non-return link (a plain invite or garbage) without ingesting", async () => {
    const user = userEvent.setup();
    const onIngestReturn = vi.fn();
    render(
      <ContactLinks
        contacts={[]}
        now={19_000}
        onCreate={noCreate}
        onRevoke={noop}
        onSetDuration={noop}
        onIngestReturn={onIngestReturn}
      />,
    );
    // A plain invite (no ref) is someone inviting YOU; it is not ingestible here.
    const plainInvite = contactInviteUrl(aliasRecord(), mintNotify());
    await user.type(
      screen.getByPlaceholderText(/Paste the link/i),
      plainInvite,
    );
    await user.click(screen.getByRole("button", { name: "Link both ways" }));

    expect(onIngestReturn).not.toHaveBeenCalled();
    expect(
      screen.getByText(/not a link sent back to you/i),
    ).toBeInTheDocument();
  });
});

describe("ContactLinks avatar entry (doc 19)", () => {
  const baseProps = {
    contacts: [],
    now: 19_000,
    onCreate: () => Promise.resolve({ url: "https://sti.care/a/x" }),
    onRevoke: () => undefined,
    onSetDuration: () => undefined,
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
