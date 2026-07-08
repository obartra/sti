import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeAll, describe, it, expect, vi } from "vitest";
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
import { rootForTest } from "../test-support/phrase.ts";
import { contactInviteUrl, mintNotify } from "../store/index.ts";
import { randomAliasId } from "../crypto/index.ts";
import {
  createDemoController,
  createDemoStore,
} from "../store/demo/demoRuntime.ts";

// A real non-extractable root, so the app's background derivations (account id,
// write token) run for real on it instead of rejecting on a placeholder. Built
// once; the fake controller hands the same key to every session it returns.
let testRoot: Awaited<ReturnType<typeof rootForTest>>;
beforeAll(async () => {
  testRoot = await rootForTest("app-test-account");
});

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
    resolveVanityName: () => Promise.resolve(null),
    reportVanityName: () => Promise.resolve(),
    submitFeedback: () => Promise.resolve(),
    pendingRequests: () => [],
    forgetRequest: () => undefined,
  };
}

// A fake session controller standing in for the backend one (the real WebAuthn
// adapter cannot run in jsdom). It records the created handle + profile so the
// derived owner view can be asserted after onboarding.
function fakeController(opts: { onPrep?: boolean } = {}): SessionController {
  const root = testRoot;
  let blob: AccountBlob = {
    handle: "",
    aliases: [],
    contacts: [],
    // onPrep is a route the report can't set; preset it to exercise the
    // report-turns-blue path (a clear panel + a route earns blue).
    state: { ...INITIAL_OWNER_STATE, onPrep: opts.onPrep ?? false },
    avatar: DEFAULT_AVATAR,
  };
  return {
    signUp: (handle) => {
      blob = { ...blob, ...(handle !== undefined ? { handle } : {}) };
      return Promise.resolve({
        session: { root, blob },
        recoveryPhrase: "Ck9mq2Xb7wYt0Zr8Lv3Np6Aq1Ds4Gh5Jk8Mn2Pr7Tw0",
      });
    },
    // Recovery by phrase loads a distinct account, to prove the recovered
    // session (not the placeholder) drives the app.
    recover: (phrase) =>
      phrase === "RECOVER-ME-PHRASE"
        ? Promise.resolve({ root, blob: { ...blob, handle: "rosa" } })
        : Promise.resolve(null),
    // New-device unlock by recovery name + password (doc 32): like phrase
    // recovery, load a distinct account so the recovered session is provably in use.
    recoverByPassword: (name, password) =>
      name === "meow" && password === "correct-horse-battery-staple"
        ? Promise.resolve({ root, blob: { ...blob, handle: "rosa" } })
        : Promise.resolve(null),
    resume: () => Promise.resolve({ ok: false as const, reason: "no-binding" }),
    rememberDevice: () => Promise.resolve(),
    forgetDevice: () => Promise.resolve(),
    resumeFromStore: () => Promise.resolve(null),
    enrollPasskey: () => Promise.resolve(),
    setProfile: (_session, profile) => {
      blob = {
        ...blob,
        avatar: profile.avatar,
      };
      return Promise.resolve({ root, blob } as OwnerSession);
    },
    setOwnerState: (_session, state) => {
      blob = { ...blob, state };
      return Promise.resolve({ root, blob } as OwnerSession);
    },
    // No link in these tests has an expiry, so the in-memory pre-check never fires
    // this; return the current blob unchanged for completeness.
    sweepExpiredLinks: () => Promise.resolve({ root, blob } as OwnerSession),
    refreshLiveLinks: () => Promise.resolve(),
    // The share sheet hands out the private link: /a/{id}#k={key}, its key in the
    // fragment so it opens straight to the status (no knock).
    shareLink: (session) => {
      const id = "z".repeat(43);
      return Promise.resolve({
        session,
        url: `https://sti.care/a/${id}#k=${"k".repeat(43)}`,
      });
    },
    // Revoke & renew: a distinct id, so the surfaced link visibly changes.
    renewLink: (session) =>
      Promise.resolve({
        session,
        url: `https://sti.care/a/${"w".repeat(43)}#k=${"k".repeat(43)}`,
      }),
    setShareLinkExpiry: (session) => Promise.resolve(session),
    deleteAccount: () => Promise.resolve(),
    reviewKnocks: () => Promise.resolve({ count: 0, pending: [] }),
    approveKnocks: () => Promise.resolve(0),
    createContactLink: (_session, label) => {
      const contact = {
        id: "c".repeat(43),
        label,
        createdDay: 0,
        expiresAt: null,
        alias: {
          id: "v".repeat(43),
          writeToken: "w".repeat(43),
          key: "x".repeat(43),
          isPublic: false,
        },
      };
      blob = { ...blob, contacts: [...blob.contacts, contact] };
      return Promise.resolve({
        session: { root, blob },
        contact,
        url: `https://sti.care/a/${"v".repeat(43)}#k=${"x".repeat(43)}`,
      });
    },
    renameContact: (_session, contactId, label) => {
      blob = {
        ...blob,
        contacts: blob.contacts.map((c) =>
          c.id === contactId ? { ...c, label } : c,
        ),
      };
      return Promise.resolve({ root, blob });
    },
    revokeContact: (_session, contactId) => {
      blob = {
        ...blob,
        contacts: blob.contacts.filter((c) => c.id !== contactId),
      };
      return Promise.resolve({ root, blob });
    },
    revokeAlias: (_session, aliasId) => {
      blob = { ...blob, aliases: blob.aliases.filter((a) => a.id !== aliasId) };
      return Promise.resolve({ root, blob });
    },
    acceptContactInvite: () =>
      Promise.reject(new Error("not used in this test")),
    ingestContactReturn: (session) => Promise.resolve(session),
    completeInPersonLinkup: (session) => Promise.resolve(session),
    notifyContactsOfPositive: () =>
      Promise.resolve({ sent: [], skipped: [], failed: [] }),
    hasPartnerNudge: () => Promise.resolve(false),
    createCircle: (_session, name, memberContactIds) => {
      const circleId = `circle-${name}`;
      const circle = { id: circleId, name, memberContactIds };
      blob = { ...blob, circles: [...(blob.circles ?? []), circle] };
      return Promise.resolve({ session: { root, blob }, circleId });
    },
    updateCircle: (_session, id, name, memberContactIds) => {
      blob = {
        ...blob,
        circles: (blob.circles ?? []).map((c) =>
          c.id === id ? { id, name, memberContactIds } : c,
        ),
      };
      return Promise.resolve({ root, blob });
    },
    removeCircle: (_session, id) => {
      blob = {
        ...blob,
        circles: (blob.circles ?? []).filter((c) => c.id !== id),
      };
      return Promise.resolve({ root, blob });
    },
    registerVanityName: () =>
      Promise.reject(new Error("not used in this test")),
    checkVanityName: () => Promise.reject(new Error("not used in this test")),
    releaseVanityName: () => Promise.reject(new Error("not used in this test")),
    createGroup: () => Promise.reject(new Error("not used in this test")),
    inviteToGroup: () => Promise.reject(new Error("not used in this test")),
    revokeGroupInvite: () => Promise.reject(new Error("not used in this test")),
    acceptGroupInvite: () => Promise.reject(new Error("not used in this test")),
    rejectGroupInvite: () => Promise.reject(new Error("not used in this test")),
    pollGroupLifecycle: () =>
      Promise.reject(new Error("not used in this test")),
    removeGroupMember: () => Promise.reject(new Error("not used in this test")),
    readGroupRoster: () => Promise.reject(new Error("not used in this test")),
    requestToJoin: () => Promise.reject(new Error("not used in this test")),
    reviewJoinRequests: () =>
      Promise.reject(new Error("not used in this test")),
    approveJoinRequest: () =>
      Promise.reject(new Error("not used in this test")),
    rejectJoinRequest: () => Promise.reject(new Error("not used in this test")),
    redeemJoinRequests: () =>
      Promise.reject(new Error("not used in this test")),
    leaveGroup: () => Promise.reject(new Error("not used in this test")),
    deleteGroup: () => Promise.reject(new Error("not used in this test")),
    setRecoveryPassword: () =>
      Promise.reject(new Error("not used in this test")),
    disableRecoveryPassword: () =>
      Promise.reject(new Error("not used in this test")),
    // No passkey is enrolled in these UI-wiring tests, so the phrase re-view gate
    // falls back to the two-step confirm and a verify is never reached.
    passkeyEnrolled: () => false,
    verifyPasskey: () => Promise.resolve(false),
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

// Run the b1 -> b3 onboarding: type a handle (the field starts empty now), claim,
// reveal + confirm the recovery phrase, then enter the app.
async function onboard(
  user: ReturnType<typeof userEvent.setup>,
  handle = "robin",
) {
  await user.type(
    await screen.findByLabelText("What should we call you?"),
    handle,
  );
  await user.click(screen.getByRole("button", { name: "Continue" }));
  await user.click(
    await screen.findByRole("button", { name: /Reveal your phrase/ }),
  );
  await user.click(screen.getByRole("button", { name: /saved it/i }));
  await user.click(
    await screen.findByRole("button", { name: /Enter my passport/ }),
  );
}

describe("App onboarding flow", () => {
  it("creates a real account and enters the app as the derived owner", async () => {
    // Start at b1-claim (the landing's claim target).
    window.history.pushState({}, "", "/signup");
    const user = userEvent.setup();
    render(<App store={stubStore(null)} controller={fakeController()} />);

    // Pick a handle distinct from the OWNER fixture ("robin") so reaching it at
    // home proves the real session drives the view, not the placeholder.
    await onboard(user, "kai");

    // Home renders the derived owner: the chosen handle, not the fixture's.
    expect((await screen.findAllByText(/Hi, kai/)).length).toBeGreaterThan(0);
    expect(screen.queryByText("Hi, robin")).toBeNull();
  });

  it("enters even when binding a passkey fails (phrase stays the way back)", async () => {
    window.history.pushState({}, "", "/signup");
    const user = userEvent.setup();
    const controller = fakeController();
    // The authenticator declines: enrollment must not block entry.
    controller.enrollPasskey = () => Promise.reject(new Error("declined"));
    render(<App store={stubStore(null)} controller={controller} />);

    await onboard(user);

    // The account was created (default handle "robin"), so the app still enters.
    expect((await screen.findAllByText(/Hi, robin/)).length).toBeGreaterThan(0);
  });

  it("reports a result and the home badge turns blue (report -> setOwnerState -> derive)", async () => {
    window.history.pushState({}, "", "/signup");
    const user = userEvent.setup();
    // A PrEP user: a clear, complete panel then earns blue (the route exists).
    render(
      <App
        store={stubStore(null)}
        controller={fakeController({ onPrep: true })}
      />,
    );

    // Onboard through to home (still gray: never tested yet).
    await user.type(
      await screen.findByLabelText("What should we call you?"),
      "robin",
    );
    await user.click(screen.getByRole("button", { name: "Continue" }));
    await user.click(
      await screen.findByRole("button", { name: /Reveal your phrase/ }),
    );
    await user.click(screen.getByRole("button", { name: /saved it/i }));
    // A new account is private by default; there is no reach choice at setup, and
    // the share sheet always hands out the keyed private /a/{id}#k= link.
    await user.click(
      await screen.findByRole("button", { name: /Enter my passport/ }),
    );
    // Home is reached (gray, never tested yet): its primary action adds a result.
    const [addResult] = await screen.findAllByRole("button", {
      name: /Add a result/,
    });
    if (!addResult) throw new Error("no 'Add a result' action on home");

    // No one-tap path now: mark every condition negative (HIV, syphilis, and
    // each gonorrhea/chlamydia site) to record a clear, complete core panel.
    await user.click(addResult);
    const negatives = await screen.findAllByRole("button", {
      name: "Negative",
    });
    for (const btn of negatives) {
      await user.click(btn);
    }
    await user.click(
      await screen.findByRole("button", { name: /Save results/ }),
    );

    // Back home, the badge is blue on the HIV-prevention (PrEP) route.
    expect(
      (await screen.findAllByText("Tested & on HIV prevention")).length,
    ).toBeGreaterThan(0);

    // "Share my passport" opens the chooser first; picking "Send a private link"
    // then asks the controller for the real link and surfaces it (scheme
    // stripped), rather than the hardcoded placeholder.
    const [share] = await screen.findAllByRole("button", {
      name: /Share my passport/,
    });
    if (!share) throw new Error("no 'Share my passport' action on home");
    await user.click(share);
    await user.click(
      await screen.findByRole("button", { name: /Send a private link/ }),
    );
    // The surfaced link is the keyed private /a/{id}#k= link (opens with no knock),
    // not the Storybook placeholder.
    const keyedShareLink = `sti.care/a/${"z".repeat(43)}#k=${"k".repeat(43)}`;
    expect(await screen.findByText(keyedShareLink)).toBeInTheDocument();
    expect(screen.queryByText(/a7f3k9q2/)).toBeNull();

    // Revoke & renew swaps the displayed link for the freshly-minted one.
    await user.click(screen.getByRole("button", { name: /Revoke and renew/ }));
    expect(
      await screen.findByText(
        `sti.care/a/${"w".repeat(43)}#k=${"k".repeat(43)}`,
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText(keyedShareLink)).toBeNull();
  });

  it("deleting the account from the danger zone logs out to the landing", async () => {
    window.history.pushState({}, "", "/signup");
    const user = userEvent.setup();
    const controller = fakeController();
    const deleteAccount = vi.fn(() => Promise.resolve());
    controller.deleteAccount = deleteAccount;
    render(<App store={stubStore(null)} controller={controller} />);

    // Onboard into the app.
    await onboard(user);
    expect((await screen.findAllByText(/Hi, robin/)).length).toBeGreaterThan(0);

    // Open Settings (the home "Manage links" action routes there), then the
    // danger zone's two-step delete.
    await user.click(
      await screen.findByRole("button", { name: "Manage links" }),
    );
    await user.click(
      await screen.findByRole("button", { name: "Delete everything" }),
    );
    await user.click(screen.getByRole("button", { name: "Delete now" }));

    // The account was really deleted and the app logged out to the landing.
    expect(deleteAccount).toHaveBeenCalledOnce();
    expect(await screen.findByText("Claim your passport")).toBeInTheDocument();
    expect(screen.queryByText("Hi, robin")).toBeNull();
  });

  it("shows a contentless knock entry in the inbox only when someone knocked", async () => {
    window.history.pushState({}, "", "/signup");
    const user = userEvent.setup();
    const controller = fakeController();
    // Two viewers knocked, neither with a grant key (contentless info row).
    controller.reviewKnocks = () => Promise.resolve({ count: 2, pending: [] });
    render(<App store={stubStore(null)} controller={controller} />);

    // Onboard, then open the inbox via the bell.
    await onboard(user);
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
    window.history.pushState({}, "", "/signup");
    const user = userEvent.setup();
    const controller = fakeController();
    // No knocks: the bell dot here is driven solely by the partner-notify nudge.
    controller.reviewKnocks = () => Promise.resolve({ count: 0, pending: [] });
    controller.hasPartnerNudge = () => Promise.resolve(true);
    render(<App store={stubStore(null)} controller={controller} />);

    // Onboard into the passport.
    await onboard(user);

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

  it("creates and revokes a per-contact link from the Links screen", async () => {
    window.history.pushState({}, "", "/signup");
    const user = userEvent.setup();
    render(<App store={stubStore(null)} controller={fakeController()} />);

    // Onboard, then open the Links tab (the per-contact link manager lives there).
    await onboard(user);
    await user.click(await screen.findByRole("button", { name: "Links" }));

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

    // Open the link's options menu, then revoke it (the manager's menu Revoke, not
    // the live-links list one, which names its link): the entry is gone.
    await user.click(screen.getByRole("button", { name: /Options for Sam/ }));
    await user.click(screen.getByRole("button", { name: "Revoke" }));
    expect(screen.queryByText("Sam")).toBeNull();
  });

  it("links both ways by opening the return link, no paste (doc 13 path A)", async () => {
    window.history.pushState({}, "", "/signup");
    const user = userEvent.setup();
    const controller = fakeController();
    const ingest = vi.fn((session: OwnerSession) => Promise.resolve(session));
    controller.ingestContactReturn = ingest;
    // The return link resolves to the sender's card, so the connect action shows.
    const view: ResolvedView = {
      state: "blue",
      labels: ["hiv"],
      route: "hiv",
      identity: { handle: "alex" },
    };
    render(<App store={stubStore(view)} controller={controller} />);
    await onboard(user);

    // A real RETURN link (keyed alias + notify + ref) opened while logged in: the
    // router parses it to a2-public, and the logged-in viewer gets a one-tap connect.
    const returnUrl = contactInviteUrl(
      {
        id: "R".repeat(43),
        writeToken: "w".repeat(43),
        key: "S".repeat(43),
        isPublic: false,
      },
      mintNotify(),
      { ref: randomAliasId() },
    );
    window.history.pushState(
      {},
      "",
      returnUrl.replace(/^https?:\/\/[^/]+/, ""),
    );
    window.dispatchEvent(new PopStateEvent("popstate"));

    const connect = await screen.findByRole("button", { name: "Connect" });
    await user.click(connect);
    expect(ingest).toHaveBeenCalledTimes(1);
    expect(await screen.findByText(/Linked\./i)).toBeInTheDocument();
  });

  it("logs in on a new device with the recovery phrase (no passkey)", async () => {
    window.history.pushState({}, "", "/");
    const user = userEvent.setup();
    render(<App store={stubStore(null)} controller={fakeController()} />);

    // From the landing, take the login route, open the "other ways" chooser,
    // pick the phrase way (only that form shows), then recover with the phrase.
    await user.click(await screen.findByRole("button", { name: "Log in" }));
    await user.click(
      await screen.findByRole("button", { name: /Other ways to log in/ }),
    );
    await user.click(
      await screen.findByRole("button", { name: /^Recovery phrase/ }),
    );
    // One way per screen: the password form is not on this stage.
    expect(screen.queryByRole("textbox", { name: "Username" })).toBeNull();
    await user.type(
      await screen.findByRole("textbox", { name: "Recovery phrase" }),
      "RECOVER-ME-PHRASE",
    );
    await user.click(await screen.findByRole("button", { name: "Log in" }));

    // The recovered account drives the app (its handle, not the fixture's).
    expect((await screen.findAllByText(/Hi, rosa/)).length).toBeGreaterThan(0);
    expect(screen.queryByText("Hi, robin")).toBeNull();
  });

  it("logs in on a new device with the recovery name + password (doc 32)", async () => {
    window.history.pushState({}, "", "/");
    const user = userEvent.setup();
    render(<App store={stubStore(null)} controller={fakeController()} />);

    // Take the login route, open the "other ways" chooser, pick the username +
    // password way (only that form shows), then sign in with it.
    await user.click(await screen.findByRole("button", { name: "Log in" }));
    await user.click(
      await screen.findByRole("button", { name: /Other ways to log in/ }),
    );
    await user.click(
      await screen.findByRole("button", { name: /^Username and password/ }),
    );
    // One way per screen: the phrase form is not on this stage.
    expect(
      screen.queryByRole("textbox", { name: "Recovery phrase" }),
    ).toBeNull();
    await user.type(
      await screen.findByRole("textbox", { name: "Username" }),
      "meow",
    );
    await user.type(
      await screen.findByLabelText("Password"),
      "correct-horse-battery-staple",
    );
    await user.click(await screen.findByRole("button", { name: "Log in" }));

    // The recovered account drives the app (its handle, not the fixture's).
    expect((await screen.findAllByText(/Hi, rosa/)).length).toBeGreaterThan(0);
    expect(screen.queryByText("Hi, robin")).toBeNull();
  });

  it("keeps a logged-out visitor out of app screens (no owner data leaks)", async () => {
    // A deep link to an app-group screen must clamp to the public landing when
    // there is no session, never render the OWNER placeholder's data.
    window.history.pushState({}, "", "/wallet");
    render(<App store={stubStore(null)} controller={fakeController()} />);

    expect(await screen.findByText("Claim your passport")).toBeInTheDocument();
    expect(screen.queryByText("Hi, robin")).toBeNull();
    expect(screen.queryByText("Good to see you,")).toBeNull();
  });

  it("shows the landing at the root / when signed out (Home lives at /)", async () => {
    // Home now owns the root `/`, which resolves to the app-group `home` screen;
    // with no session the clamp still shows the public landing, not owner data.
    window.history.pushState({}, "", "/");
    render(<App store={stubStore(null)} controller={fakeController()} />);

    expect(await screen.findByText("Claim your passport")).toBeInTheDocument();
    expect(screen.queryByText("Hi, robin")).toBeNull();
    expect(screen.queryByText("Good to see you,")).toBeNull();
  });
});

describe("demo mode", () => {
  it("the landing's 'Try the demo' action enters the demo", async () => {
    window.history.pushState({}, "", "/");
    const user = userEvent.setup();
    const onTry = vi.fn();
    render(
      <App
        store={stubStore(null)}
        controller={fakeController()}
        demo={{ mode: false, onTry, onExit: () => undefined }}
      />,
    );

    await user.click(
      await screen.findByRole("button", { name: "Try the demo" }),
    );
    expect(onTry).toHaveBeenCalledOnce();
  });

  it("boots into the seeded @demo account, shows the banner, and leaves", async () => {
    window.history.pushState({}, "", "/");
    const user = userEvent.setup();
    const onExit = vi.fn();
    render(
      <App
        store={createDemoStore()}
        controller={createDemoController()}
        demo={{ mode: true, onTry: () => undefined, onExit }}
      />,
    );

    // The seeded demo session drives the app: the owner greeting names the demo.
    expect((await screen.findAllByText(/Hi, demo/)).length).toBeGreaterThan(0);
    // The persistent banner marks every demo screen.
    expect(
      screen.getByText("Demo. Nothing here is saved or sent."),
    ).toBeInTheDocument();
    // The not-backed-up marker never shows in demo: there is no server to drain
    // to, so the pending marker would otherwise stick on forever (bug A).
    expect(
      screen.queryByText(
        "Saved on this device. It backs up when you're online.",
      ),
    ).toBeNull();

    // Leaving the demo calls back out (the root then remounts the real app).
    await user.click(screen.getByRole("button", { name: "Leave demo" }));
    expect(onExit).toHaveBeenCalledOnce();
  });

  it("stays in the app on an app-group route (Links), never bouncing to the landing", async () => {
    // Deep-linking into an app screen in demo must not clamp to the public landing:
    // the demo account seeds asynchronously, so there is a window with no session,
    // and demo is always signed in (bug D, the glitchy redirect to the logged-out
    // home when navigating to Links).
    // The demo runs under the `/demo` prefix (doc 28 G), so a demo app-screen URL is
    // `/demo/links`; the router strips the prefix to resolve the Links screen.
    window.history.pushState({}, "", "/demo/links");
    render(
      <App
        store={createDemoStore()}
        controller={createDemoController()}
        demo={{ mode: true, onTry: () => undefined, onExit: () => undefined }}
      />,
    );

    // The Links screen renders (its "Your links" list), and the logged-out landing
    // never shows: the app-group route was not clamped away in demo.
    expect((await screen.findAllByText("Your links")).length).toBeGreaterThan(
      0,
    );
    expect(screen.queryByText("Claim your passport")).toBeNull();
  });
});
