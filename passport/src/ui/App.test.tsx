import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, it, expect, vi } from "vitest";
import { App } from "./App.tsx";
import type { ResolvedView } from "./public/PublicResolution.tsx";
import type {
  AccountBlob,
  OwnerSession,
  PassportStore,
  SessionController,
} from "../store/index.ts";
import { INITIAL_OWNER_STATE } from "../core/badge.ts";
import { DEFAULT_AVATAR } from "../lib/avatars.ts";
import { mintNotify } from "../store/index.ts";

// End-to-end of the UI wiring: a real shared link in the URL routes through
// parseAliasLink -> useAppRouter -> Chrome -> the a2-public screen ->
// store.resolveAlias -> render. The store is stubbed so the assertion is on the
// wiring, not the network (the real round-trip is covered by the integration
// tests).
const ID = "A".repeat(43);
const KEY = "B".repeat(43);

function stubStore(to: ResolvedView | null): PassportStore {
  return {
    resolveAlias: () => Promise.resolve(to),
    knock: () => Promise.resolve(),
    redeemGrant: () => Promise.resolve(null),
  };
}

// A fake session controller standing in for the backend one (the real WebAuthn
// adapter cannot run in jsdom). It records the created handle + profile so the
// derived owner view can be asserted after onboarding.
function fakeController(opts: { onPrep?: boolean } = {}): SessionController {
  const master = new Uint8Array(32);
  let blob: AccountBlob = {
    handle: "",
    aliases: [],
    contacts: [],
    // onPrep is a route the report can't set; preset it to exercise the
    // report-turns-blue path (a clear panel + a route earns blue).
    state: { ...INITIAL_OWNER_STATE, onPrep: opts.onPrep ?? false },
    avatar: DEFAULT_AVATAR,
    sharingMode: "link",
    // Real accounts always mint a notify inbox at signup; carry one so the
    // partner-notify channel (keyed on the inbox id) behaves as in production.
    myNotify: mintNotify(),
  };
  return {
    signUp: (handle) => {
      blob = { ...blob, handle };
      return Promise.resolve({
        session: { master, blob },
        recoveryPhrase: "Ck9mq2Xb7wYt0Zr8Lv3Np6Aq1Ds4Gh5Jk8Mn2Pr7Tw0",
      });
    },
    // Recovery by phrase loads a distinct account, to prove the recovered
    // session (not the placeholder) drives the app.
    recover: (phrase) =>
      phrase === "RECOVER-ME-PHRASE"
        ? Promise.resolve({ master, blob: { ...blob, handle: "rosa" } })
        : Promise.resolve(null),
    resume: () => Promise.resolve(null),
    enrollPasskey: () => Promise.resolve(),
    setProfile: (_session, profile) => {
      blob = {
        ...blob,
        avatar: profile.avatar,
        sharingMode: profile.sharingMode,
      };
      return Promise.resolve({ master, blob } as OwnerSession);
    },
    setOwnerState: (_session, state) => {
      blob = { ...blob, state };
      return Promise.resolve({ master, blob } as OwnerSession);
    },
    // Faithful to the controller contract: a public account's link carries the
    // key in the fragment, a private ("link") account's does not.
    shareLink: (session) => {
      const id = "z".repeat(43);
      const base = `https://sti.care/a/${id}`;
      return Promise.resolve({
        session,
        url:
          session.blob.sharingMode === "public"
            ? `${base}#k=${"y".repeat(43)}`
            : base,
      });
    },
    // Revoke & renew: a distinct id, so the surfaced link visibly changes.
    renewLink: (session) =>
      Promise.resolve({ session, url: `https://sti.care/a/${"w".repeat(43)}` }),
    deleteAccount: () => Promise.resolve(),
    reviewKnocks: () => Promise.resolve({ count: 0, pending: [] }),
    approveKnocks: () => Promise.resolve(0),
    createContactLink: (_session, label) => {
      const contact = {
        id: "c".repeat(43),
        label,
        createdDay: 0,
        expiresDay: 7,
        alias: {
          id: "v".repeat(43),
          writeToken: "w".repeat(43),
          key: "x".repeat(43),
          isPublic: false,
        },
      };
      blob = { ...blob, contacts: [...blob.contacts, contact] };
      return Promise.resolve({
        session: { master, blob },
        contact,
        url: `https://sti.care/a/${"v".repeat(43)}#k=${"x".repeat(43)}`,
      });
    },
    revokeContact: (_session, contactId) => {
      blob = {
        ...blob,
        contacts: blob.contacts.filter((c) => c.id !== contactId),
      };
      return Promise.resolve({ master, blob });
    },
    setContactDuration: (_session, contactId, durationDays) => {
      blob = {
        ...blob,
        contacts: blob.contacts.map((c) =>
          c.id === contactId ? { ...c, expiresDay: durationDays } : c,
        ),
      };
      return Promise.resolve({ master, blob });
    },
    revokeAlias: (_session, aliasId) => {
      blob = { ...blob, aliases: blob.aliases.filter((a) => a.id !== aliasId) };
      return Promise.resolve({ master, blob });
    },
    acceptContactInvite: () =>
      Promise.reject(new Error("not used in this test")),
    ingestContactReturn: (session) => Promise.resolve(session),
    notifyContactsOfPositive: () =>
      Promise.resolve({ sent: [], skipped: [], failed: [] }),
    hasPartnerNudge: () => Promise.resolve(false),
    createCircle: (_session, name, memberContactIds) => {
      const circleId = `circle-${name}`;
      const circle = { id: circleId, name, memberContactIds };
      blob = { ...blob, circles: [...(blob.circles ?? []), circle] };
      return Promise.resolve({ session: { master, blob }, circleId });
    },
    updateCircle: (_session, id, name, memberContactIds) => {
      blob = {
        ...blob,
        circles: (blob.circles ?? []).map((c) =>
          c.id === id ? { id, name, memberContactIds } : c,
        ),
      };
      return Promise.resolve({ master, blob });
    },
    removeCircle: (_session, id) => {
      blob = {
        ...blob,
        circles: (blob.circles ?? []).filter((c) => c.id !== id),
      };
      return Promise.resolve({ master, blob });
    },
    forget: () => undefined,
  };
}

afterEach(() => {
  window.history.pushState({}, "", "/");
});

describe("App routing of a shared passport link", () => {
  it("resolves and renders the card for /a/{id}#k={key}", async () => {
    window.history.pushState({}, "", `/a/${ID}#k=${KEY}`);
    const view: ResolvedView = {
      state: "blue",
      labels: ["hiv"],
      route: "hiv",
      identity: { handle: "robin" },
    };
    render(<App store={stubStore(view)} />);

    expect(await screen.findByText("@robin")).toBeInTheDocument();
  });

  it("renders the uniform gray-nothing when the link does not resolve", async () => {
    window.history.pushState({}, "", `/a/${ID}#k=${KEY}`);
    render(<App store={stubStore(null)} />);

    expect(
      await screen.findByText("No status shared right now"),
    ).toBeInTheDocument();
    expect(screen.queryByText(/^@/)).toBeNull();
  });
});

describe("App onboarding flow", () => {
  it("creates a real account and enters the app as the derived owner", async () => {
    // Start at b1-claim (the landing's claim target).
    window.history.pushState({}, "", "/#b1-claim");
    const user = userEvent.setup();
    render(<App store={stubStore(null)} controller={fakeController()} />);

    // b1: pick a handle distinct from the OWNER fixture ("robin") so reaching it
    // at home proves the real session drives the view, not the placeholder.
    const handle = screen.getByDisplayValue("robin");
    await user.clear(handle);
    await user.type(handle, "kai");
    await user.click(screen.getByRole("button", { name: "Continue" }));

    // b2: the real recovery token is shown once; reveal then confirm saved.
    await user.click(
      await screen.findByRole("button", { name: /Tap to reveal/ }),
    );
    await user.click(screen.getByRole("button", { name: /saved it/i }));

    // b3: enter the app.
    await user.click(
      await screen.findByRole("button", { name: /Enter my passport/ }),
    );

    // Home renders the derived owner: the chosen handle, not the fixture's.
    expect((await screen.findAllByText("@kai")).length).toBeGreaterThan(0);
    expect(screen.queryByText("@robin")).toBeNull();
  });

  it("enters even when binding a passkey fails (phrase stays the way back)", async () => {
    window.history.pushState({}, "", "/#b1-claim");
    const user = userEvent.setup();
    const controller = fakeController();
    // The authenticator declines: enrollment must not block entry.
    controller.enrollPasskey = () => Promise.reject(new Error("declined"));
    render(<App store={stubStore(null)} controller={controller} />);

    await user.click(screen.getByRole("button", { name: "Continue" }));
    await user.click(
      await screen.findByRole("button", { name: /Tap to reveal/ }),
    );
    await user.click(screen.getByRole("button", { name: /saved it/i }));
    await user.click(
      await screen.findByRole("button", { name: /Enter my passport/ }),
    );

    // The account was created (default handle "robin"), so the app still enters.
    expect((await screen.findAllByText("@robin")).length).toBeGreaterThan(0);
  });

  it("reports a result and the home badge turns blue (report -> setOwnerState -> derive)", async () => {
    window.history.pushState({}, "", "/#b1-claim");
    const user = userEvent.setup();
    // A PrEP user: a clear, complete panel then earns blue (the route exists).
    render(
      <App
        store={stubStore(null)}
        controller={fakeController({ onPrep: true })}
      />,
    );

    // Onboard through to home (still gray: never tested yet).
    await user.click(screen.getByRole("button", { name: "Continue" }));
    await user.click(
      await screen.findByRole("button", { name: /Tap to reveal/ }),
    );
    await user.click(screen.getByRole("button", { name: /saved it/i }));
    // Choose Gated ("Ask first") so this account's links are bare /a/{id} (no key
    // in the fragment); the default is now Direct, which would carry the key.
    await user.click(await screen.findByRole("tab", { name: "Ask first" }));
    await user.click(
      await screen.findByRole("button", { name: /Enter my passport/ }),
    );
    // Home is reached (gray, never tested yet): its primary action adds a result.
    const [addResult] = await screen.findAllByRole("button", {
      name: /Add a result/,
    });
    if (!addResult) throw new Error("no 'Add a result' action on home");

    // The all-negative one-tap is a clear, complete core panel.
    await user.click(addResult);
    await user.click(
      await screen.findByRole("button", { name: /Save results/ }),
    );

    // Back home, the badge is blue on the HIV-prevention (PrEP) route.
    expect(
      (await screen.findAllByText("Tested & on HIV prevention")).length,
    ).toBeGreaterThan(0);

    // Opening the share sheet asks the controller for the real link and surfaces
    // it (scheme stripped), rather than the hardcoded placeholder.
    const [share] = await screen.findAllByRole("button", {
      name: /Share my passport/,
    });
    if (!share) throw new Error("no 'Share my passport' action on home");
    await user.click(share);
    // This is a private ("link") account, so the surfaced link is the bare
    // /a/{id} with no key in the fragment, not the Storybook placeholder.
    expect(
      await screen.findByText(`sti.care/a/${"z".repeat(43)}`),
    ).toBeInTheDocument();
    expect(screen.queryByText(/a7f3k9q2/)).toBeNull();
    expect(screen.queryByText(/#k=/)).toBeNull();

    // Revoke & renew swaps the displayed link for the freshly-minted one.
    await user.click(screen.getByRole("button", { name: /Revoke & renew/ }));
    expect(
      await screen.findByText(`sti.care/a/${"w".repeat(43)}`),
    ).toBeInTheDocument();
    expect(screen.queryByText(`sti.care/a/${"z".repeat(43)}`)).toBeNull();
  });

  it("deleting the account from the danger zone logs out to the landing", async () => {
    window.history.pushState({}, "", "/#b1-claim");
    const user = userEvent.setup();
    const controller = fakeController();
    const deleteAccount = vi.fn(() => Promise.resolve());
    controller.deleteAccount = deleteAccount;
    render(<App store={stubStore(null)} controller={controller} />);

    // Onboard into the app.
    await user.click(screen.getByRole("button", { name: "Continue" }));
    await user.click(
      await screen.findByRole("button", { name: /Tap to reveal/ }),
    );
    await user.click(screen.getByRole("button", { name: /saved it/i }));
    await user.click(
      await screen.findByRole("button", { name: /Enter my passport/ }),
    );
    expect((await screen.findAllByText("@robin")).length).toBeGreaterThan(0);

    // Open Privacy, then the danger zone's two-step delete.
    await user.click(await screen.findByText("Privacy & sharing"));
    await user.click(
      await screen.findByRole("button", { name: "Delete everything" }),
    );
    await user.click(screen.getByRole("button", { name: "Delete now" }));

    // The account was really deleted and the app logged out to the landing.
    expect(deleteAccount).toHaveBeenCalledOnce();
    expect(await screen.findByText("Claim your passport")).toBeInTheDocument();
    expect(screen.queryByText("@robin")).toBeNull();
  });

  it("shows a contentless knock entry in the inbox only when someone knocked", async () => {
    window.history.pushState({}, "", "/#b1-claim");
    const user = userEvent.setup();
    const controller = fakeController();
    // Two viewers knocked, neither with a grant key (contentless info row).
    controller.reviewKnocks = () => Promise.resolve({ count: 2, pending: [] });
    render(<App store={stubStore(null)} controller={controller} />);

    // Onboard, then open the inbox via the bell.
    await user.click(screen.getByRole("button", { name: "Continue" }));
    await user.click(
      await screen.findByRole("button", { name: /Tap to reveal/ }),
    );
    await user.click(screen.getByRole("button", { name: /saved it/i }));
    await user.click(
      await screen.findByRole("button", { name: /Enter my passport/ }),
    );
    await user.click(
      await screen.findByRole("button", { name: "Notifications" }),
    );

    // The knock entry is shown, and it's contentless: the copy names no requester
    // and carries no count (the "2" from reviewKnocks never reaches the wording).
    const entry = await screen.findByText(
      "Someone with your link asked to see your status",
    );
    expect(entry).toBeInTheDocument();
    expect(entry.textContent).not.toMatch(/\d/);
  });

  it("a partner-notify ping lights the bell and leads the inbox with a contentless row", async () => {
    window.history.pushState({}, "", "/#b1-claim");
    const user = userEvent.setup();
    const controller = fakeController();
    // No knocks: the bell dot here is driven solely by the partner-notify nudge.
    controller.reviewKnocks = () => Promise.resolve({ count: 0, pending: [] });
    controller.hasPartnerNudge = () => Promise.resolve(true);
    render(<App store={stubStore(null)} controller={controller} />);

    // Onboard into the passport.
    await user.click(screen.getByRole("button", { name: "Continue" }));
    await user.click(
      await screen.findByRole("button", { name: /Tap to reveal/ }),
    );
    await user.click(screen.getByRole("button", { name: /saved it/i }));
    await user.click(
      await screen.findByRole("button", { name: /Enter my passport/ }),
    );

    // The bell shows new activity even with zero knocks, so the time-sensitive
    // nudge is not stranded behind a manual open.
    await user.click(
      await screen.findByRole("button", {
        name: "Notifications (new activity)",
      }),
    );

    // The row is present, leads the list, and is contentless (no contact, no count).
    const row = await screen.findByText(
      "A recent contact suggests getting tested",
    );
    expect(row).toBeInTheDocument();
    expect(row.textContent).not.toMatch(/\d/);
  });

  it("creates and revokes a per-contact link from the Connect screen", async () => {
    window.history.pushState({}, "", "/#b1-claim");
    const user = userEvent.setup();
    render(<App store={stubStore(null)} controller={fakeController()} />);

    // Onboard, then open Connect -> Share my link (the per-contact manager).
    await user.click(screen.getByRole("button", { name: "Continue" }));
    await user.click(
      await screen.findByRole("button", { name: /Tap to reveal/ }),
    );
    await user.click(screen.getByRole("button", { name: /saved it/i }));
    await user.click(
      await screen.findByRole("button", { name: /Enter my passport/ }),
    );
    await user.click(await screen.findByRole("button", { name: "Connect" }));
    await user.click(await screen.findByText("Share my link"));

    // Name a link and create it: the shareable URL appears and the link is listed.
    await user.type(
      await screen.findByPlaceholderText(/Who is this for/),
      "Sam",
    );
    await user.click(screen.getByRole("button", { name: /Create a link/ }));
    expect(
      await screen.findByText(new RegExp(`a/${"v".repeat(43)}`)),
    ).toBeInTheDocument();
    expect((await screen.findAllByText("Sam")).length).toBeGreaterThan(0);

    // Open the link's options menu, then revoke it: the entry is gone.
    await user.click(screen.getByRole("button", { name: /Options for Sam/ }));
    await user.click(screen.getByRole("button", { name: /Revoke/ }));
    expect(screen.queryByText("Sam")).toBeNull();
  });

  it("logs in on a new device with the recovery phrase (no passkey)", async () => {
    window.history.pushState({}, "", "/");
    const user = userEvent.setup();
    render(<App store={stubStore(null)} controller={fakeController()} />);

    // From the landing, take the login route, then recover with the phrase.
    await user.click(await screen.findByRole("button", { name: "Log in" }));
    // The login variant has a single text input: the recovery phrase.
    await user.type(await screen.findByRole("textbox"), "RECOVER-ME-PHRASE");
    await user.click(
      await screen.findByRole("button", { name: /Recover account/ }),
    );

    // The recovered account drives the app (its handle, not the fixture's).
    expect((await screen.findAllByText("@rosa")).length).toBeGreaterThan(0);
    expect(screen.queryByText("@robin")).toBeNull();
  });

  it("keeps a logged-out visitor out of app screens (no owner data leaks)", async () => {
    // A deep link to an app-group screen must clamp to the public landing when
    // there is no session, never render the OWNER placeholder's data.
    window.history.pushState({}, "", "/#home");
    render(<App store={stubStore(null)} controller={fakeController()} />);

    expect(await screen.findByText("Claim your passport")).toBeInTheDocument();
    expect(screen.queryByText("@robin")).toBeNull();
    expect(screen.queryByText("Good to see you,")).toBeNull();
  });
});
