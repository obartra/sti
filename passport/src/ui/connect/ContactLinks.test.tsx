import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { ContactLinks } from "./ContactLinks.tsx";
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
    expiresDay: 19_007,
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
        nowDay={19_000}
        onCreate={noCreate}
        onRevoke={noop}
      />,
    );
    expect(screen.getByText(/Linked both ways/)).toBeInTheDocument();
    expect(screen.getByText(/Awaiting their link back/)).toBeInTheDocument();
  });

  it("ingests a pasted return link, parsing it to the invite", async () => {
    const user = userEvent.setup();
    const onIngestReturn = vi.fn();
    render(
      <ContactLinks
        contacts={[]}
        nowDay={19_000}
        onCreate={noCreate}
        onRevoke={noop}
        onIngestReturn={onIngestReturn}
      />,
    );
    // A real return invite: an alias + notify + ref (the inviter's alias id).
    const notify = mintNotify();
    const ref = randomAliasId();
    const url = contactInviteUrl(aliasRecord(), notify, ref);

    await user.type(screen.getByPlaceholderText(/Paste the link/i), url);
    await user.click(screen.getByRole("button", { name: "Finish linking" }));

    expect(onIngestReturn).toHaveBeenCalledTimes(1);
    expect(onIngestReturn.mock.calls[0]?.[0]).toMatchObject({ ref });
  });

  it("rejects a non-return link (a plain invite or garbage) without ingesting", async () => {
    const user = userEvent.setup();
    const onIngestReturn = vi.fn();
    render(
      <ContactLinks
        contacts={[]}
        nowDay={19_000}
        onCreate={noCreate}
        onRevoke={noop}
        onIngestReturn={onIngestReturn}
      />,
    );
    // A plain invite (no ref) is someone inviting YOU; it is not ingestible here.
    const plainInvite = contactInviteUrl(aliasRecord(), mintNotify());
    await user.type(
      screen.getByPlaceholderText(/Paste the link/i),
      plainInvite,
    );
    await user.click(screen.getByRole("button", { name: "Finish linking" }));

    expect(onIngestReturn).not.toHaveBeenCalled();
    expect(
      screen.getByText(/not a link sent back to you/i),
    ).toBeInTheDocument();
  });
});
