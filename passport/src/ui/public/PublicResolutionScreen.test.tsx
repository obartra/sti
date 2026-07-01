import { render, screen, act, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { PublicResolutionScreen } from "./PublicResolutionScreen.tsx";
import type { ResolvedView } from "./PublicResolution.tsx";
import type {
  ContactInvite,
  ContactLinkResult,
  PassportStore,
} from "../../store/index.ts";
import { fakeRootKey } from "../../test-support/phrase.ts";
import { avatarFor, DEFAULT_AVATAR } from "../../lib/avatars.ts";

const LINK = { id: "A".repeat(43), key: "B".repeat(43) };

const NOTIFY = {
  inboxId: "I".repeat(43),
  writeToken: "W".repeat(43),
  key: "K".repeat(43),
  routingToken: "R".repeat(43),
};
const INVITE: ContactInvite = { alias: LINK, notify: NOTIFY };

function storeResolving(
  to: ResolvedView | null,
  knock: PassportStore["knock"] = () => Promise.resolve(),
  redeemGrant: PassportStore["redeemGrant"] = () => Promise.resolve(null),
): PassportStore {
  return {
    resolveAlias: () => Promise.resolve(to),
    knock,
    redeemGrant,
    resolveVanityName: () => Promise.resolve(null),
    reportVanityName: () => Promise.resolve(),
    pendingRequests: () => [],
    forgetRequest: () => undefined,
  };
}

describe("PublicResolutionScreen", () => {
  it("renders the resolved card once resolution completes", async () => {
    const view: ResolvedView = {
      state: "blue",
      labels: ["hiv"],
      route: "hiv",
      identity: { handle: "robin" },
    };
    render(<PublicResolutionScreen store={storeResolving(view)} link={LINK} />);

    expect(await screen.findByText("@robin")).toBeInTheDocument();
    expect(screen.getByText("Tested & on HIV prevention")).toBeInTheDocument();
  });

  it("seeds the no-avatar fallback face on the alias id, not the handle (doc 19)", async () => {
    // A resolved card with no chosen avatar must derive its face from the opaque
    // alias id (the link the viewer holds), never the payload's handle.
    const view: ResolvedView = {
      state: "blue",
      labels: ["hiv"],
      route: "hiv",
      identity: { handle: "robin" },
    };
    const { container } = render(
      <PublicResolutionScreen store={storeResolving(view)} link={LINK} />,
    );
    await screen.findByText("@robin");
    const img = container.querySelector(".sti-avatar img");
    expect(img?.getAttribute("src")).toBe(avatarFor(LINK.id));
    expect(img?.getAttribute("src")).not.toBe(avatarFor("robin"));
  });

  it("renders the uniform gray-nothing when resolution returns null", async () => {
    render(<PublicResolutionScreen store={storeResolving(null)} link={LINK} />);

    expect(
      await screen.findByText("No status shared right now"),
    ).toBeInTheDocument();
    expect(screen.queryByText(/^@/)).toBeNull();
  });

  it("knocks on the alias id when the link-holder requests access", async () => {
    const user = userEvent.setup();
    const knock = vi.fn(() => Promise.resolve());
    render(
      <PublicResolutionScreen
        store={storeResolving(null, knock)}
        link={LINK}
      />,
    );

    // Gray-nothing + link-holder shows the knock prompt; requesting access sends
    // a knock for THIS alias id (and nothing identifying the requester).
    await user.click(
      await screen.findByRole("button", { name: "Request access" }),
    );
    expect(knock).toHaveBeenCalledWith(LINK.id);
  });

  it("offers a report affordance for a findable name and files the chosen reason", async () => {
    const user = userEvent.setup();
    const reportName = vi.fn(() => Promise.resolve());
    render(
      <PublicResolutionScreen
        store={storeResolving(null)}
        link={LINK}
        name="rob1n"
        reportName={reportName}
      />,
    );

    // The report affordance appears (the viewer arrived via a findable name).
    await user.click(
      await screen.findByRole("button", { name: /report this name/i }),
    );
    // The report form opens against that name; picking a reason + sending files it.
    expect(screen.getByText("rob1n")).toBeInTheDocument();
    await user.click(screen.getByRole("radio", { name: /slur or hate/i }));
    await user.click(screen.getByRole("button", { name: /send report/i }));

    expect(reportName).toHaveBeenCalledWith("rob1n", "slur");
    expect(
      await screen.findByText(/thanks for the report/i),
    ).toBeInTheDocument();
  });

  it("shows no report affordance for a keyed/sample link (no name)", async () => {
    render(<PublicResolutionScreen store={storeResolving(null)} link={LINK} />);
    await screen.findByText("No status shared right now");
    expect(
      screen.queryByRole("button", { name: /report this name/i }),
    ).not.toBeInTheDocument();
  });

  it("resolves via an already-approved grant when the link key alone is gray", async () => {
    // The link has no usable key, but a knock from a prior visit was approved, so
    // the mount fallback redeems the grant and the card appears with no knock.
    const view: ResolvedView = {
      state: "blue",
      labels: ["hiv"],
      route: "hiv",
      identity: { handle: "robin" },
    };
    const store = storeResolving(
      null,
      () => Promise.resolve(),
      () => Promise.resolve(view),
    );
    render(<PublicResolutionScreen store={store} link={LINK} />);
    expect(await screen.findByText("@robin")).toBeInTheDocument();
  });

  it("a logged-in viewer adds the inviter and gets a return link to send back", async () => {
    const user = userEvent.setup();
    const view: ResolvedView = {
      state: "blue",
      labels: ["hiv"],
      route: "hiv",
      identity: { handle: "alex" },
    };
    const returnUrl = `https://sti.care/a/${"R".repeat(43)}#k=${"S".repeat(43)}&n=abc`;
    const onAcceptInvite = vi.fn(
      (): Promise<ContactLinkResult> =>
        Promise.resolve({
          session: { root: fakeRootKey(), blob: {} as never },
          contact: {} as never,
          url: returnUrl,
        }),
    );
    render(
      <PublicResolutionScreen
        store={storeResolving(view)}
        link={LINK}
        invite={INVITE}
        onAcceptInvite={onAcceptInvite}
      />,
    );

    // The invite shows "Add to contacts", not the knock prompt.
    const add = await screen.findByRole("button", { name: "Add to contacts" });
    expect(screen.queryByRole("button", { name: "Request access" })).toBeNull();

    await user.type(
      screen.getByPlaceholderText(/private nickname/i),
      "from the party",
    );
    await user.click(add);

    // Anonymous is the default, so with no reveal chosen the accept stays anonymous
    // and carries no per-link face.
    expect(onAcceptInvite).toHaveBeenCalledWith(
      INVITE,
      "from the party",
      "anonymous",
      undefined,
    );
    // The return link to send back is surfaced.
    expect(
      await screen.findByRole("button", { name: /Copy link to send back/i }),
    ).toBeInTheDocument();
  });

  it("offers the reveal choice on accept when the accepter has a name", async () => {
    const view: ResolvedView = {
      state: "blue",
      identity: { handle: "alex" },
    };
    render(
      <PublicResolutionScreen
        store={storeResolving(view)}
        link={LINK}
        invite={INVITE}
        onAcceptInvite={() => Promise.reject(new Error("not called"))}
        accepterName="robin"
        accepterAvatar={DEFAULT_AVATAR}
      />,
    );
    await screen.findByRole("button", { name: "Add to contacts" });
    // The Anonymous / Show my name choice is present (the accepter has a name).
    expect(
      screen.getByRole("button", { name: "Show my name" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Anonymous" }),
    ).toBeInTheDocument();
    // The per-link face picker only appears once "main" is chosen.
    expect(screen.queryByRole("button", { name: "Pick a face" })).toBeNull();
  });

  it("hides the reveal choice on accept when the accepter has no name", async () => {
    const view: ResolvedView = {
      state: "blue",
      identity: { handle: "alex" },
    };
    render(
      <PublicResolutionScreen
        store={storeResolving(view)}
        link={LINK}
        invite={INVITE}
        onAcceptInvite={() => Promise.reject(new Error("not called"))}
        accepterAvatar={DEFAULT_AVATAR}
      />,
    );
    await screen.findByRole("button", { name: "Add to contacts" });
    // No name to show, so the choice is hidden and the accept stays anonymous.
    expect(screen.queryByRole("button", { name: "Show my name" })).toBeNull();
  });

  it("carries the accepter's reveal choice through accept", async () => {
    const user = userEvent.setup();
    const view: ResolvedView = {
      state: "blue",
      identity: { handle: "alex" },
    };
    const returnUrl = `https://sti.care/a/${"R".repeat(43)}#k=${"S".repeat(43)}&n=abc`;
    const onAcceptInvite = vi.fn(
      (): Promise<ContactLinkResult> =>
        Promise.resolve({
          session: { root: fakeRootKey(), blob: {} as never },
          contact: {} as never,
          url: returnUrl,
        }),
    );
    render(
      <PublicResolutionScreen
        store={storeResolving(view)}
        link={LINK}
        invite={INVITE}
        onAcceptInvite={onAcceptInvite}
        accepterName="robin"
        accepterAvatar={DEFAULT_AVATAR}
      />,
    );
    await screen.findByRole("button", { name: "Add to contacts" });
    // The accepter opts to show their name, then accepts.
    await user.click(screen.getByRole("button", { name: "Show my name" }));
    await user.click(screen.getByRole("button", { name: "Add to contacts" }));

    // The reveal choice threads through: identity "main", no override chosen.
    expect(onAcceptInvite).toHaveBeenCalledWith(INVITE, "", "main", undefined);
  });

  it("does not offer accept for a return invite (it is the inviter's to ingest)", async () => {
    const view: ResolvedView = {
      state: "gray",
      identity: { handle: "alex" },
    };
    render(
      <PublicResolutionScreen
        store={storeResolving(view)}
        link={LINK}
        invite={{ ...INVITE, ref: "Q".repeat(43) }}
        onAcceptInvite={() => Promise.reject(new Error("should not be called"))}
      />,
    );
    expect(await screen.findByText("@alex")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Add to contacts" }),
    ).toBeNull();
  });

  it("opening a return link connects both ways in one tap (no paste)", async () => {
    const user = userEvent.setup();
    const view: ResolvedView = {
      state: "blue",
      labels: ["hiv"],
      route: "hiv",
      identity: { handle: "alex" },
    };
    const returnInvite = { ...INVITE, ref: "Q".repeat(43) };
    const onIngestReturn = vi.fn();
    render(
      <PublicResolutionScreen
        store={storeResolving(view)}
        link={LINK}
        invite={returnInvite}
        onIngestReturn={onIngestReturn}
      />,
    );

    // A return link offers "Connect", not "Add to contacts" and not a knock.
    const connect = await screen.findByRole("button", { name: "Connect" });
    expect(
      screen.queryByRole("button", { name: "Add to contacts" }),
    ).toBeNull();
    await user.click(connect);

    expect(onIngestReturn).toHaveBeenCalledWith(returnInvite);
    // The confirmation replaces the prompt; nothing to send onward.
    expect(await screen.findByText(/Linked\./i)).toBeInTheDocument();
  });

  it("polls for the grant after the viewer requests access", async () => {
    vi.useFakeTimers();
    try {
      const redeem = vi.fn(() => Promise.resolve(null));
      const store = storeResolving(null, () => Promise.resolve(), redeem);
      render(<PublicResolutionScreen store={store} link={LINK} />);
      // Flush the mount effect: resolveAlias -> null, then one redeem fallback.
      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
      });
      const afterMount = redeem.mock.calls.length;

      fireEvent.click(screen.getByRole("button", { name: "Request access" }));
      // The knock settles, which arms the poll.
      await act(async () => {
        await Promise.resolve();
      });
      // One poll interval elapses -> redeemGrant is called again.
      await act(async () => {
        await vi.advanceTimersByTimeAsync(4000);
      });
      expect(redeem.mock.calls.length).toBeGreaterThan(afterMount);
    } finally {
      vi.useRealTimers();
    }
  });
});
