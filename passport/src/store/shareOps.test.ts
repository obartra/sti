// @vitest-environment node
//
// Per-contact decorrelation (doc 13, G1): an owner minting two contact links from
// one session must hand each contact a FULLY distinct notify capability. If two
// links ever shared an inbox or any of its tokens, a recipient holding both could
// tie them to a single owner. This pins that all four capability fields differ
// across two links, and that the two emitted invite URLs carry different `n=`
// payloads, so a regression that hoisted or shared the inbox fails here.
import { describe, it, expect } from "vitest";
import {
  mintContactLink,
  acceptContactInvite,
  renameContactLabel,
} from "./shareOps.ts";
import { parseContactInvite, type ContactInvite } from "./contactInvite.ts";
import { mintNotify } from "./notifyInbox.ts";
import { randomAliasId } from "../crypto/index.ts";
import type { ApiClient } from "../api/client.ts";
import type { AccountManager } from "./account.ts";
import type { AccountBlob, ContactRecord } from "./accountBlob.ts";
import type { OwnerSession } from "./session.ts";
import { INITIAL_OWNER_STATE } from "../core/badge.ts";
import { DEFAULT_AVATAR } from "../lib/avatars.ts";

// The only api method mintContactLink reaches is putAlias (via publishCard); a
// no-op satisfies it. Everything else throws so a stray call is loud, not silent.
function fakeApi(): ApiClient {
  const unused = () => {
    throw new Error("not used in shareOps mint test");
  };
  return new Proxy({} as ApiClient, {
    get(_t, prop) {
      if (prop === "putAlias") return () => Promise.resolve();
      return unused;
    },
  });
}

// An account manager that only records contacts: addContact appends to an in-memory
// blob and returns it, so the session threads forward exactly like the real one.
function fakeAccounts(blob: AccountBlob): {
  accounts: AccountManager;
  contacts: ContactRecord[];
} {
  const contacts: ContactRecord[] = [];
  const accounts = new Proxy({} as AccountManager, {
    get(_t, prop) {
      if (prop === "addContact") {
        return (_root: unknown, contact: ContactRecord) => {
          contacts.push(contact);
          return Promise.resolve({ ...blob, contacts: [...contacts] });
        };
      }
      return () => Promise.reject(new Error("not used in shareOps mint test"));
    },
  });
  return { accounts, contacts };
}

function parts(url: string): { pathname: string; hash: string } {
  const u = new URL(url);
  return { pathname: u.pathname, hash: u.hash };
}

// A blob carrying one contact, for the rename tests below.
function blobWithContact(contact: ContactRecord): AccountBlob {
  return {
    handle: "robin",
    aliases: [],
    contacts: [contact],
    state: INITIAL_OWNER_STATE,
    avatar: DEFAULT_AVATAR,
    sharingMode: "link",
  };
}

// An account manager whose addContact replaces the matching contact by id (the real
// blob's behavior for an existing id), so a rename round-trips through the session.
function renamingAccounts(): AccountManager {
  return new Proxy({} as AccountManager, {
    get(_t, prop) {
      if (prop === "addContact") {
        return (_root: unknown, contact: ContactRecord) =>
          Promise.resolve(blobWithContact(contact));
      }
      return () => Promise.reject(new Error("not used in rename test"));
    },
  });
}

// A fresh owner blob + session + recording accounts for the shared-name tests.
function freshOwner(handle: string | undefined): {
  api: ApiClient;
  accounts: AccountManager;
  session: OwnerSession;
} {
  const blob: AccountBlob = {
    ...(handle !== undefined ? { handle } : {}),
    aliases: [],
    contacts: [],
    state: INITIAL_OWNER_STATE,
    avatar: DEFAULT_AVATAR,
    sharingMode: "link",
  };
  const { accounts } = fakeAccounts(blob);
  return {
    api: fakeApi(),
    accounts,
    session: { root: {}, blob } as unknown as OwnerSession,
  };
}

function sharedNameOf(url: string): string | undefined {
  const invite = parseContactInvite(parts(url).pathname, parts(url).hash);
  return invite?.sharedName;
}

describe("shared name on a contact link (doc 15)", () => {
  it("carries the owner's handle when they show their name (identity main)", async () => {
    const { api, accounts, session } = freshOwner("robin");
    const { url } = await mintContactLink(api, accounts, session, {
      label: "sam",
      identity: "main",
    });
    expect(sharedNameOf(url)).toBe("robin");
  });

  it("shares no name when staying anonymous", async () => {
    const { api, accounts, session } = freshOwner("robin");
    const { url } = await mintContactLink(api, accounts, session, {
      label: "sam",
      identity: "anonymous",
    });
    expect(sharedNameOf(url)).toBeUndefined();
  });

  it("shares no name when showing a nameless account", async () => {
    const { api, accounts, session } = freshOwner(undefined);
    const { url } = await mintContactLink(api, accounts, session, {
      label: "sam",
      identity: "main",
    });
    expect(sharedNameOf(url)).toBeUndefined();
  });

  it("seeds the accepter's label from the inviter's shared name when unnamed", async () => {
    const { api, accounts, session } = freshOwner("alex");
    const invite: ContactInvite = {
      alias: { id: randomAliasId(), key: randomAliasId() },
      notify: mintNotify(),
      sharedName: "robin",
    };
    const { contact } = await acceptContactInvite(api, accounts, session, {
      invite,
      label: "",
      identity: "anonymous",
    });
    expect(contact.label).toBe("robin");
  });

  it("keeps the accepter's own label over the inviter's shared name", async () => {
    const { api, accounts, session } = freshOwner("alex");
    const invite: ContactInvite = {
      alias: { id: randomAliasId(), key: randomAliasId() },
      notify: mintNotify(),
      sharedName: "robin",
    };
    const { contact } = await acceptContactInvite(api, accounts, session, {
      invite,
      label: "my doctor",
      identity: "anonymous",
    });
    expect(contact.label).toBe("my doctor");
  });
});

describe("renameContactLabel (receiver-owned local label)", () => {
  const baseContact: ContactRecord = {
    id: "c-1",
    label: "Sam",
    createdDay: 19_000,
    expiresAt: null,
    alias: {
      id: "a".repeat(43),
      writeToken: "w".repeat(43),
      key: "k".repeat(43),
      isPublic: false,
    },
  };

  it("updates only the label and leaves the alias untouched", async () => {
    const session = {
      root: {} as CryptoKey,
      blob: blobWithContact(baseContact),
    } as OwnerSession;
    const next = await renameContactLabel(renamingAccounts(), session, {
      contactId: "c-1",
      label: "Sammy",
    });
    const updated = next.blob.contacts.find((c) => c.id === "c-1");
    expect(updated?.label).toBe("Sammy");
    // The published link is identical: a rename never re-keys or re-publishes.
    expect(updated?.alias).toEqual(baseContact.alias);
  });

  it("trims and caps the new label, and an empty value clears it", async () => {
    const session = {
      root: {} as CryptoKey,
      blob: blobWithContact(baseContact),
    } as OwnerSession;
    const long = "x".repeat(200);
    const capped = await renameContactLabel(renamingAccounts(), session, {
      contactId: "c-1",
      label: `  ${long}  `,
    });
    expect(capped.blob.contacts[0]?.label).toBe("x".repeat(64));

    const cleared = await renameContactLabel(renamingAccounts(), session, {
      contactId: "c-1",
      label: "   ",
    });
    expect(cleared.blob.contacts[0]?.label).toBe("");
  });

  it("is a no-op (same session) for an unknown contact id", async () => {
    const session = {
      root: {} as CryptoKey,
      blob: blobWithContact(baseContact),
    } as OwnerSession;
    const next = await renameContactLabel(renamingAccounts(), session, {
      contactId: "nope",
      label: "Ghost",
    });
    expect(next).toBe(session);
  });
});

describe("mintContactLink per-contact decorrelation (doc 13)", () => {
  it("hands each contact a fully distinct notify capability (id, write token, key, routing token)", async () => {
    const api = fakeApi();
    const blob: AccountBlob = {
      handle: "robin",
      aliases: [],
      contacts: [],
      state: INITIAL_OWNER_STATE,
      avatar: DEFAULT_AVATAR,
      sharingMode: "link",
    };
    const { accounts } = fakeAccounts(blob);
    const session = { root: {} as CryptoKey, blob } as OwnerSession;

    // Two links from the SAME owner/session.
    const first = await mintContactLink(api, accounts, session, {
      label: "sam",
      identity: "anonymous",
    });
    const second = await mintContactLink(api, accounts, first.session, {
      label: "alex",
      identity: "anonymous",
    });

    const a = first.contact.myInbox;
    const b = second.contact.myInbox;
    if (a === undefined || b === undefined) {
      throw new Error(
        "expected each contact to carry its own notify capability",
      );
    }
    // All FOUR capability fields must differ; a shared/hoisted inbox fails here.
    expect(a.inboxId).not.toBe(b.inboxId);
    expect(a.writeToken).not.toBe(b.writeToken);
    expect(a.key).not.toBe(b.key);
    expect(a.routingToken).not.toBe(b.routingToken);

    // The READ alias each contact resolves must also be freshly minted, not shared:
    // a recipient holding two of the owner's links must see unrelated id/key/token,
    // so they cannot tie the links to one owner. A hoisted publishCard fails here.
    expect(first.contact.alias.id).not.toBe(second.contact.alias.id);
    expect(first.contact.alias.key).not.toBe(second.contact.alias.key);
    expect(first.contact.alias.writeToken).not.toBe(
      second.contact.alias.writeToken,
    );

    // The two invite URLs must carry different notify payloads (`n=`): the recipient
    // sees no shared bytes that could correlate the links to one owner.
    const nOf = (url: string): string => {
      const u = new URL(url);
      const n = new URLSearchParams(u.hash.replace(/^#/, "")).get("n");
      if (n === null)
        throw new Error("expected an invite URL with an n= payload");
      return n;
    };
    expect(nOf(first.url)).not.toBe(nOf(second.url));

    // And the parsed capabilities round-trip to the distinct ones above.
    const pa = parseContactInvite(
      parts(first.url).pathname,
      parts(first.url).hash,
    );
    const pb = parseContactInvite(
      parts(second.url).pathname,
      parts(second.url).hash,
    );
    if (pa === null || pb === null) {
      throw new Error("expected both URLs to parse as contact invites");
    }
    expect(pa.notify.routingToken).toBe(a.routingToken);
    expect(pb.notify.routingToken).toBe(b.routingToken);
    expect(pa.notify.routingToken).not.toBe(pb.notify.routingToken);
  });
});
