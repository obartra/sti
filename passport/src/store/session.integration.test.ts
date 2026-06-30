// @vitest-environment node
// The session against a live blind store: sign up (phrase path), enroll a
// passkey, then resume on "reload" by unwrapping the locally-stored binding and
// reloading the real account blob. Proves the reload story round-trips through
// GET/PUT /acct, not just that the wiring compiles.
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createApiClient } from "../api/client.ts";
import { createAccountManager } from "./account.ts";
import { createAccountSync } from "./accountSync.ts";
import { createBackendStore } from "./backendStore.ts";
import { createSessionController } from "./session.ts";
import { resolveCircleRoster } from "./circles.ts";
import { deriveOwnerCard } from "./ownerCard.ts";
import { pseudonymFor } from "../lib/avatars.ts";
import { redeemGrant } from "./grant.ts";
import { requesterHash } from "./knock.ts";
import { parseContactInvite } from "./contactInvite.ts";
import { lockNotifyDraft, parsePartnerPing } from "./partnerNotify.ts";
import { pollInbox, mintNotify } from "./notifyInbox.ts";
import { todayEpochDay, nowMs, DAY_MS } from "../core/clock.ts";

// Link expiry is an absolute ms instant set to `now + duration` at call time, so
// assert it lands within a few seconds of the expected instant (the wall clock
// moves between the call and the check).
function expectExpiryNear(actual: number | null, durationMs: number): void {
  expect(actual).not.toBeNull();
  expect(Math.abs((actual ?? 0) - (nowMs() + durationMs))).toBeLessThan(5000);
}
import {
  generateGrantKeyPair,
  bytesToBase64url,
  randomAliasId,
  randomWriteToken,
} from "../crypto/index.ts";
import type { ContactRecord } from "./accountBlob.ts";
import { createDeviceStore, type StorageLike } from "../auth/deviceStore.ts";
import type { PasskeyAuth } from "../auth/passkey.ts";
import type { AliasRecord } from "./accountBlob.ts";
import type { AliasLink } from "./passportStore.ts";
import { type Bytes, type RootKey } from "../crypto/index.ts";
import { createVolatileRootKeyStore } from "../auth/rootKeyStore.ts";
import type { OwnerState } from "../core/badge.ts";
import { startApi, type Harness } from "../test-support/serverHarness.ts";

// The read capabilities (id + key) of an alias record, for resolveAlias. Keeps
// the round-trip assertions free of repeated optional-chaining noise.
function caps(record: AliasRecord | undefined): AliasLink {
  return { id: record?.id ?? "", key: record?.key ?? "" };
}

// A fixed-PRF fake authenticator (the passkey contract), so unlock re-yields the
// exact PRF output enroll produced. The concrete WebAuthn adapter is browser-only.
function fakePasskey(): PasskeyAuth {
  const prfByCred = new Map<string, Bytes>();
  return {
    available: () => true,
    enroll() {
      const credentialId = crypto.randomUUID();
      const prfOutput = crypto.getRandomValues(new Uint8Array(32));
      prfByCred.set(credentialId, prfOutput);
      return Promise.resolve({ credentialId, prfOutput });
    },
    unlock(credentialId) {
      const prf = prfByCred.get(credentialId);
      return prf
        ? Promise.resolve(prf)
        : Promise.reject(new Error("unknown credential"));
    },
  };
}

function memoryStorage(): StorageLike {
  const map = new Map<string, string>();
  return {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => void map.set(k, v),
    removeItem: (k) => void map.delete(k),
  };
}

describe("owner session against a live blind store", () => {
  let harness: Harness | undefined;
  let baseUrl!: string;

  beforeAll(async () => {
    harness = await startApi();
    baseUrl = harness.baseUrl;
  }, 120_000);

  afterAll(() => harness?.stop());

  function controller(
    passkey: PasskeyAuth,
    devices = createDeviceStore(memoryStorage()),
  ) {
    const api = createApiClient(baseUrl);
    return {
      ctl: createSessionController({
        accounts: createAccountManager(api),
        sync: createAccountSync(api),
        devices,
        passkey,
        keys: createVolatileRootKeyStore(),
        api,
      }),
      devices,
      api,
    };
  }

  it("sign up -> enroll passkey -> resume reloads the real account", async () => {
    const passkey = fakePasskey();
    const { ctl, devices } = controller(passkey);

    const { session, recoveryPhrase } = await ctl.signUp("robin");
    expect(devices.load()).toBeNull(); // phrase-only until a passkey is enrolled

    await ctl.enrollPasskey(recoveryPhrase, "robin");
    expect(devices.load()).not.toBeNull();

    // A reload: the same passkey + the persisted binding reload the account blob
    // through the live server.
    const resumed = await ctl.resume();
    expect(resumed?.root).toEqual(session.root);
    expect(resumed?.blob).toEqual(session.blob);
  });

  it("a mutual contact-link exchange links two owners both ways", async () => {
    const store = createBackendStore(createApiClient(baseUrl));
    const linkParts = (url: string) => {
      const u = new URL(url);
      return { pathname: u.pathname, hash: u.hash };
    };

    // Owner A (made blue via PrEP so reading A's card is distinguishable) and B.
    const a = controller(fakePasskey());
    const { session: a0 } = await a.ctl.signUp("alex");
    const aSession = await a.ctl.setOwnerState(a0, {
      ...a0.blob.state,
      onPrep: true,
    });
    const b = controller(fakePasskey());
    const { session: bSession } = await b.ctl.signUp("blair");

    // A invites; the link is a contact invite carrying A's notify capability.
    const invite = await a.ctl.createContactLink(aSession, "blair");
    const parsed = parseContactInvite(
      linkParts(invite.url).pathname,
      linkParts(invite.url).hash,
    );
    if (parsed === null) throw new Error("expected a contact invite");

    // B accepts: records A as a complete two-way contact and returns an invite.
    const accept = await b.ctl.acceptContactInvite(bSession, parsed, "alex");
    const ret = parseContactInvite(
      linkParts(accept.url).pathname,
      linkParts(accept.url).hash,
    );
    if (ret === null) throw new Error("expected a return invite");

    // A ingests the return, completing the pending contact it created.
    const aDone = await a.ctl.ingestContactReturn(invite.session, ret);

    const aContact = aDone.blob.contacts[0];
    const bContact = accept.session.blob.contacts[0];
    if (aContact?.theirStatusAlias === undefined) {
      throw new Error("A's contact did not complete");
    }
    if (bContact?.theirStatusAlias === undefined) {
      throw new Error("B's contact did not complete");
    }

    // Each side reads the other's status through theirStatusAlias.
    expect(await store.resolveAlias(bContact.theirStatusAlias)).toEqual(
      deriveOwnerCard(
        aSession.blob.state,
        pseudonymFor(bContact.theirStatusAlias.id),
        todayEpochDay(),
      ),
    );
    expect(await store.resolveAlias(aContact.theirStatusAlias)).toEqual(
      deriveOwnerCard(
        bSession.blob.state,
        pseudonymFor(aContact.theirStatusAlias.id),
        todayEpochDay(),
      ),
    );

    // Each side holds the OTHER's per-contact inbox as theirNotify, and its own copy
    // as myInbox: A's theirNotify for B is exactly B's myInbox for A, and vice-versa.
    expect(aContact.theirNotify).toEqual(bContact.myInbox);
    expect(bContact.theirNotify).toEqual(aContact.myInbox);

    // And the notify path works: A notifies B by writing to B's inbox-for-A, and B
    // receives it by polling that same inbox (its own myInbox for A).
    const bInboxForA = bContact.myInbox;
    if (bInboxForA === undefined) throw new Error("B has no inbox for A");
    const sent = await lockNotifyDraft(a.api, aDone.blob, [aContact.id]);
    expect(sent.sent).toEqual([aContact.id]);
    const ping = await pollInbox(b.api, bInboxForA);
    if (ping === null) throw new Error("expected B to receive the ping");
    expect(parsePartnerPing(ping)?.kind).toBe("partner-notify");
  });

  it("ingest and accept guard the exchange edges (no-match, no-ref, double, return)", async () => {
    const linkParts = (url: string) => {
      const u = new URL(url);
      return { pathname: u.pathname, hash: u.hash };
    };
    const a = controller(fakePasskey());
    const { session } = await a.ctl.signUp("quinn");
    const invite = await a.ctl.createContactLink(session, "river");
    const parsed = parseContactInvite(
      linkParts(invite.url).pathname,
      linkParts(invite.url).hash,
    );
    if (parsed === null) throw new Error("expected an invite");

    // A return whose ref matches no pending contact is a no-op.
    const noMatch = await a.ctl.ingestContactReturn(invite.session, {
      alias: { id: "Z".repeat(43), key: "Y".repeat(43) },
      notify: parsed.notify,
      ref: "W".repeat(43),
    });
    expect(noMatch.blob.contacts).toEqual(invite.session.blob.contacts);

    // A return with no ref at all is a no-op.
    const noRef = await a.ctl.ingestContactReturn(invite.session, {
      alias: { id: "Z".repeat(43), key: "Y".repeat(43) },
      notify: parsed.notify,
    });
    expect(noRef.blob.contacts).toEqual(invite.session.blob.contacts);

    // Accepting a RETURN invite (it carries ref) is refused.
    await expect(
      a.ctl.acceptContactInvite(
        invite.session,
        { ...parsed, ref: "W".repeat(43) },
        "river",
      ),
    ).rejects.toThrow();

    // A real return completes the contact; a second ingest of it is a no-op.
    const contact = invite.session.blob.contacts[0];
    if (contact === undefined) throw new Error("expected a pending contact");
    const ret = {
      alias: { id: "1".repeat(43), key: "2".repeat(43) },
      notify: parsed.notify,
      ref: contact.alias.id,
    };
    const done = await a.ctl.ingestContactReturn(invite.session, ret);
    expect(done.blob.contacts[0]?.theirStatusAlias).toEqual(ret.alias);
    const twice = await a.ctl.ingestContactReturn(done, ret);
    expect(twice.blob.contacts).toEqual(done.blob.contacts);
  });

  it("a reported positive silently notifies every linked contact", async () => {
    const { ctl, api } = controller(fakePasskey());
    const accounts = createAccountManager(createApiClient(baseUrl));
    const { session } = await ctl.signUp("dana");

    // A fully-linked contact (it holds a notify capability). The alias it resolves
    // is irrelevant to notification, so random tokens are fine.
    const theirNotify = mintNotify();
    const contact: ContactRecord = {
      id: randomAliasId(),
      label: "the gym one",
      createdDay: todayEpochDay(),
      expiresAt: null,
      alias: {
        id: randomAliasId(),
        writeToken: randomWriteToken(),
        key: bytesToBase64url(crypto.getRandomValues(new Uint8Array(32))),
        isPublic: false,
      },
      theirNotify,
    };
    const blob = await accounts.addContact(session.root, contact);
    const linked = { root: session.root, blob };

    // Before the report, the contact's inbox is an existence-uniform decoy.
    expect(await pollInbox(api, theirNotify)).toBeNull();

    const result = await ctl.notifyContactsOfPositive(linked);
    expect(result.sent).toEqual([contact.id]);

    // The contact's inbox now holds a contentless partner-notify ping.
    const ping = await pollInbox(api, theirNotify);
    if (ping === null) throw new Error("expected the partner-notify ping");
    expect(parsePartnerPing(ping)?.kind).toBe("partner-notify");
  });

  it("the recipient sees a partner-notify nudge once a contact reports positive", async () => {
    const { ctl } = controller(fakePasskey());
    const accounts = createAccountManager(createApiClient(baseUrl));

    // The recipient (ada) holds a contact whose per-contact inbox is how THAT contact
    // nudges her; she polls every such inbox for a ping. The inbox the sender will
    // write to is exactly this contact's myInbox.
    const { session: ada } = await ctl.signUp("ada");
    const adaInboxForBen = mintNotify();
    const recipientContact: ContactRecord = {
      id: randomAliasId(),
      label: "ben",
      createdDay: todayEpochDay(),
      expiresAt: null,
      alias: {
        id: randomAliasId(),
        writeToken: randomWriteToken(),
        key: bytesToBase64url(crypto.getRandomValues(new Uint8Array(32))),
        isPublic: false,
      },
      myInbox: adaInboxForBen,
    };
    const recipientBlob = await accounts.addContact(ada.root, recipientContact);
    const recipient = { root: ada.root, blob: recipientBlob };

    // Before any ping the poll over her inboxes is an existence-uniform decoy.
    expect(await ctl.hasPartnerNudge(recipient)).toBe(false);

    // The sender (ben) holds ada as a linked contact; his theirNotify IS ada's inbox
    // for him. He reports a positive, notifying every contact.
    const { session: sender } = await ctl.signUp("ben");
    const contact: ContactRecord = {
      id: randomAliasId(),
      label: "from the app",
      createdDay: todayEpochDay(),
      expiresAt: null,
      alias: {
        id: randomAliasId(),
        writeToken: randomWriteToken(),
        key: bytesToBase64url(crypto.getRandomValues(new Uint8Array(32))),
        isPublic: false,
      },
      theirNotify: adaInboxForBen,
    };
    const senderBlob = await accounts.addContact(sender.root, contact);
    await ctl.notifyContactsOfPositive({
      root: sender.root,
      blob: senderBlob,
    });

    // The recipient now finds the contentless nudge on her per-contact inbox poll.
    expect(await ctl.hasPartnerNudge(recipient)).toBe(true);
  });

  it("resolves a circle roster against the live store (blue member, gray rest, hidden below floor)", async () => {
    const { ctl, api } = controller(fakePasskey());
    const store = createBackendStore(api);

    // A blue owner (recent core panel + PrEP) publishes a contact link; resolving
    // that alias with its key yields the blue card the member reads as theirStatus.
    const { session } = await ctl.signUp("nova");
    const blue = await ctl.setOwnerState(session, {
      ...session.blob.state,
      testing: {
        lastPanelDay: todayEpochDay(),
        corePanelComplete: true,
        exposedSitesCovered: true,
      },
      onPrep: true,
    });
    const link = await ctl.createContactLink(blue, "member zero");
    const blueStatus = {
      id: link.contact.alias.id,
      key: link.contact.alias.key,
    };

    // A circle of five: one member whose status alias resolves blue, four with no
    // exchanged status (gray). resolveCircleRoster reads only contacts + resolver,
    // so synthetic membership ids are fine here.
    const contacts: ContactRecord[] = [
      {
        id: "m0",
        label: "zero",
        createdDay: 1,
        expiresAt: null,
        alias: { id: "m0", writeToken: "w", key: "k", isPublic: false },
        theirStatusAlias: blueStatus,
      },
      ...["m1", "m2", "m3", "m4"].map(
        (id): ContactRecord => ({
          id,
          label: id,
          createdDay: 1,
          expiresAt: null,
          alias: { id, writeToken: "w", key: "k", isPublic: false },
        }),
      ),
    ];
    const ids = ["m0", "m1", "m2", "m3", "m4"];
    const roster = await resolveCircleRoster(
      { id: "c", name: "crew", memberContactIds: ids },
      contacts,
      (link) => store.resolveAlias(link),
    );
    expect(roster?.map((m) => m.tone)).toEqual([
      "blue",
      "gray",
      "gray",
      "gray",
      "gray",
    ]);

    // Below the floor the whole roster hides (never a partial reveal).
    const small = await resolveCircleRoster(
      { id: "c", name: "crew", memberContactIds: ids.slice(0, 4) },
      contacts,
      (link) => store.resolveAlias(link),
    );
    expect(small).toBeNull();
  });

  it("creates then edits a circle in place (rename + member change persists)", async () => {
    const { ctl } = controller(fakePasskey());
    const { session } = await ctl.signUp("circler");
    const c1 = await ctl.createContactLink(session, "sam");
    const c2 = await ctl.createContactLink(c1.session, "ari");

    // Create with one member, then rename + add the second member (same id).
    const created = await ctl.createCircle(c2.session, "crew", [c1.contact.id]);
    const before = created.session.blob.circles?.find(
      (c) => c.id === created.circleId,
    );
    expect(before?.memberContactIds).toEqual([c1.contact.id]);

    const edited = await ctl.updateCircle(
      created.session,
      created.circleId,
      "the crew",
      [c1.contact.id, c2.contact.id],
    );
    const after = edited.blob.circles?.find((c) => c.id === created.circleId);
    expect(after?.name).toBe("the crew");
    expect(after?.memberContactIds).toEqual([c1.contact.id, c2.contact.id]);
    // Same id: still exactly one circle, not a duplicate.
    expect(edited.blob.circles?.length).toBe(1);
  });

  it("recovers the same account from the phrase", async () => {
    const { ctl } = controller(fakePasskey());
    const { session, recoveryPhrase } = await ctl.signUp("sam");
    const recovered = await ctl.recover(recoveryPhrase);
    expect(recovered?.root).toEqual(session.root);
    expect(recovered?.blob).toEqual(session.blob);
  });

  it("a foreign passkey cannot resume another device's binding", async () => {
    const devices = createDeviceStore(memoryStorage());
    const { ctl } = controller(fakePasskey(), devices);
    const { recoveryPhrase } = await ctl.signUp("kai");
    await ctl.enrollPasskey(recoveryPhrase, "kai");

    // A different authenticator over the same stored binding: unlock rejects.
    const { ctl: foreign } = controller(fakePasskey(), devices);
    expect(await foreign.resume()).toBeNull();
  });

  it("setOwnerState persists a reported result that survives recovery", async () => {
    const { ctl } = controller(fakePasskey());
    const { session, recoveryPhrase } = await ctl.signUp("blue");
    const blueState: OwnerState = {
      ...session.blob.state,
      testing: {
        lastPanelDay: todayEpochDay(),
        corePanelComplete: true,
        exposedSitesCovered: true,
      },
      onPrep: true,
    };
    const updated = await ctl.setOwnerState(session, blueState);
    expect(updated.blob.state).toEqual(blueState);

    // The new state round-trips through the real /acct endpoint.
    const recovered = await ctl.recover(recoveryPhrase);
    expect(recovered?.blob.state).toEqual(blueState);
  });

  it("shareLink publishes a resolvable alias, reuses it, and republishes the latest card", async () => {
    const { ctl, api } = controller(fakePasskey());
    const store = createBackendStore(api);
    const { session } = await ctl.signUp("ari");

    // First share mints the account's primary alias and records it.
    const first = await ctl.shareLink(session);
    expect(first.session.blob.aliases).toHaveLength(1);
    const record = first.session.blob.aliases[0];
    expect(record).toBeDefined();
    expect(first.url).toContain(`/a/${record?.id}`);

    // The published payload decrypts (via the alias capabilities) to exactly the
    // owner's current card, proving the real seal -> PUT -> GET -> open round-trip.
    const resolved = await store.resolveAlias(caps(record));
    expect(resolved).toEqual(
      deriveOwnerCard(
        session.blob.state,
        pseudonymFor(record?.id ?? ""),
        todayEpochDay(),
      ),
    );

    // A second share reuses the same alias (one primary link per account) rather
    // than minting another, and the link is stable.
    const second = await ctl.shareLink(first.session);
    expect(second.session.blob.aliases).toHaveLength(1);
    expect(second.url).toBe(first.url);

    // After a state change, sharing republishes the SAME alias so the existing
    // link now resolves to the updated card (republish path, same id/key).
    const blueState: OwnerState = { ...session.blob.state, onPrep: true };
    const moved = await ctl.setOwnerState(second.session, blueState);
    const third = await ctl.shareLink(moved);
    expect(third.url).toBe(first.url);
    const after = await store.resolveAlias(caps(record));
    expect(after).toEqual(
      deriveOwnerCard(
        blueState,
        pseudonymFor(record?.id ?? ""),
        todayEpochDay(),
      ),
    );
  });

  it("pendingKnocks surfaces a knock's key, and approveKnocks grants it in-app", async () => {
    const { ctl, api } = controller(fakePasskey());
    const store = createBackendStore(api);
    const { session } = await ctl.signUp("nova");

    // The owner has a shareable alias; a requester device opens it but can't
    // decrypt (no key), so it knocks with an ephemeral grant key.
    const shared = await ctl.shareLink(session);
    const aliasId = shared.session.blob.aliases[0]?.id ?? "";
    const requesterSecret = bytesToBase64url(
      crypto.getRandomValues(new Uint8Array(32)),
    );
    const kp = await generateGrantKeyPair();
    await api.knock(
      aliasId,
      await requesterHash(requesterSecret, aliasId),
      kp.publicKey,
    );

    // The owner sees exactly one grantable knock, tagged with the alias it hit,
    // and the contentless count agrees.
    const review = await ctl.reviewKnocks(shared.session);
    expect(review.count).toBe(1);
    expect(review.pending).toHaveLength(1);
    expect(review.pending[0]?.alias.id).toBe(aliasId);
    expect(review.pending[0]?.pending.pubKey).toBe(kp.publicKey);

    // Approving seals the alias key to the requester; they redeem it and the
    // status resolves to the owner's real card.
    expect(await ctl.approveKnocks(shared.session, review.pending)).toBe(1);
    const key = await redeemGrant(api, aliasId, requesterSecret, kp.privateKey);
    if (key === null) throw new Error("expected a granted key");
    expect(await store.resolveAlias({ id: aliasId, key })).toEqual(
      deriveOwnerCard(
        session.blob.state,
        pseudonymFor(aliasId),
        todayEpochDay(),
      ),
    );
  });

  it("share link's key-presence tracks the current sharing mode, not the first share", async () => {
    const { ctl } = controller(fakePasskey());
    const created = await ctl.signUp("pat"); // accounts default to link (private)

    // A private link is the bare /a/{id}: the key is never in the URL.
    const linkShare = await ctl.shareLink(created.session);
    expect(linkShare.url).not.toContain("#k=");
    const linkAlias = linkShare.session.blob.aliases[0];
    expect(linkAlias?.isPublic).toBe(false);

    // Switch the account to public, then share: now the link must carry the key
    // in its fragment, and it is a DISTINCT alias (not the private one re-dressed).
    const pub = await ctl.setProfile(linkShare.session, {
      avatar: created.session.blob.avatar,
      sharingMode: "public",
    });
    const pubShare = await ctl.shareLink(pub);
    expect(pubShare.url).toContain("#k=");
    expect(pubShare.session.blob.aliases).toHaveLength(2);
    const pubAlias = pubShare.session.blob.aliases.find((a) => a.isPublic);
    expect(pubAlias?.id).not.toBe(linkAlias?.id);

    // Switching back to private reuses the ORIGINAL private alias (same link),
    // and crucially never surfaces the public alias's key under a private sheet.
    const back = await ctl.setProfile(pubShare.session, {
      avatar: created.session.blob.avatar,
      sharingMode: "link",
    });
    const backShare = await ctl.shareLink(back);
    expect(backShare.url).toBe(linkShare.url);
    expect(backShare.url).not.toContain("#k=");
  });

  it("renewLink revokes the old link (no future reads) and mints a working fresh one", async () => {
    const { ctl, api } = controller(fakePasskey());
    const store = createBackendStore(api);
    const { session } = await ctl.signUp("max");

    const first = await ctl.shareLink(session);
    const old = first.session.blob.aliases[0];
    expect(old).toBeDefined();
    // The first link resolves to the owner's card.
    expect(await store.resolveAlias(caps(old))).toEqual(
      deriveOwnerCard(
        session.blob.state,
        pseudonymFor(old?.id ?? ""),
        todayEpochDay(),
      ),
    );

    const renewed = await ctl.renewLink(first.session);
    // A distinct link, and the old record is gone (one alias for the mode).
    expect(renewed.url).not.toBe(first.url);
    expect(renewed.session.blob.aliases).toHaveLength(1);
    const fresh = renewed.session.blob.aliases[0];
    expect(fresh?.id).not.toBe(old?.id);

    // Revoke = no future reads: the OLD capability now decrypts to nothing, so it
    // resolves to the same uniform gray-nothing as a never-existed link.
    expect(await store.resolveAlias(caps(old))).toBeNull();
    // The fresh link resolves to the current card.
    expect(await store.resolveAlias(caps(fresh))).toEqual(
      deriveOwnerCard(
        session.blob.state,
        pseudonymFor(fresh?.id ?? ""),
        todayEpochDay(),
      ),
    );
  });

  it("deleteAccount removes the blob and revokes every shared link", async () => {
    const { ctl, api } = controller(fakePasskey());
    const store = createBackendStore(api);
    const { session, recoveryPhrase } = await ctl.signUp("gone");

    // Publish a link, confirm it resolves, then delete the whole account.
    const shared = await ctl.shareLink(session);
    const alias = shared.session.blob.aliases[0];
    expect(await store.resolveAlias(caps(alias))).not.toBeNull();

    await ctl.deleteAccount(shared.session);

    // The account blob is gone: the phrase recovers nothing.
    expect(await ctl.recover(recoveryPhrase)).toBeNull();
    // The shared link no longer resolves to any status (revoked to gray-nothing).
    expect(await store.resolveAlias(caps(alias))).toBeNull();
  });

  it("createContactLink mints a private, keyed, 7-day link that resolves, then revokes", async () => {
    const { ctl, api } = controller(fakePasskey());
    const store = createBackendStore(api);
    const { session } = await ctl.signUp("nat");

    const made = await ctl.createContactLink(session, "Sam");
    expect(made.contact.label).toBe("Sam");
    expect(made.contact.alias.isPublic).toBe(false);
    // Default 7-day expiry.
    expectExpiryNear(made.contact.expiresAt, 7 * DAY_MS);
    expect(made.session.blob.contacts).toHaveLength(1);
    // The link carries the key, so the one recipient can open it directly.
    expect(made.url).toContain(`/a/${made.contact.alias.id}#k=`);

    // It resolves to the owner's current card.
    expect(await store.resolveAlias(caps(made.contact.alias))).toEqual(
      deriveOwnerCard(
        session.blob.state,
        pseudonymFor(made.contact.alias.id),
        todayEpochDay(),
      ),
    );

    // Revoke: the contact is dropped and the link stops resolving.
    const after = await ctl.revokeContact(made.session, made.contact.id);
    expect(after.blob.contacts).toHaveLength(0);
    expect(await store.resolveAlias(caps(made.contact.alias))).toBeNull();
  });

  it("createContactLink honours a chosen lifetime (a duration in ms, or until-revoked)", async () => {
    const { ctl } = controller(fakePasskey());
    const { session } = await ctl.signUp("dora");

    // A 1-day link expires tomorrow.
    const short = await ctl.createContactLink(
      session,
      "Sam",
      "anonymous",
      DAY_MS,
    );
    expectExpiryNear(short.contact.expiresAt, DAY_MS);

    // null = no expiry (lives until revoked); the sweep + republish-skip treat a
    // null expiry as always-live.
    const forever = await ctl.createContactLink(
      short.session,
      "Ari",
      "anonymous",
      null,
    );
    expect(forever.contact.expiresAt).toBeNull();
  });

  it("setContactDuration moves a link's expiry in place (same link keeps working)", async () => {
    const { ctl, api } = controller(fakePasskey());
    const store = createBackendStore(api);
    const { session } = await ctl.signUp("eli");
    const made = await ctl.createContactLink(
      session,
      "Sam",
      "anonymous",
      7 * DAY_MS,
    );
    const aliasId = made.contact.alias.id;

    // Extend to 30 days: same contact id, same alias (URL unchanged), new expiry.
    const extended = await ctl.setContactDuration(
      made.session,
      made.contact.id,
      30 * DAY_MS,
    );
    const updated = extended.blob.contacts.find(
      (c) => c.id === made.contact.id,
    );
    expect(updated?.alias.id).toBe(aliasId);
    expectExpiryNear(updated?.expiresAt ?? null, 30 * DAY_MS);
    // The link still resolves (it was not revoked or re-minted).
    expect(await store.resolveAlias(caps(made.contact.alias))).not.toBeNull();

    // Set to never expire.
    const forever = await ctl.setContactDuration(
      extended,
      made.contact.id,
      null,
    );
    expect(
      forever.blob.contacts.find((c) => c.id === made.contact.id)?.expiresAt,
    ).toBeNull();
  });

  it("setShareLinkDuration moves the share-sheet link's expiry in place", async () => {
    const { ctl, api } = controller(fakePasskey());
    const store = createBackendStore(api);
    const { session } = await ctl.signUp("fern");
    const shared = await ctl.shareLink(session);
    const aliasId = shared.session.blob.aliases[0]?.id;

    // Give the share-sheet link a 30-day lifetime: same alias, expiry moves.
    const dated = await ctl.setShareLinkDuration(shared.session, 30 * DAY_MS);
    const alias = dated.blob.aliases.find((a) => a.id === aliasId);
    expectExpiryNear(alias?.expiresAt ?? null, 30 * DAY_MS);
    // The link still resolves (it was not revoked or re-minted).
    expect(await store.resolveAlias(caps(alias))).not.toBeNull();

    // Clear it back to no expiry.
    const forever = await ctl.setShareLinkDuration(dated, null);
    expect(
      forever.blob.aliases.find((a) => a.id === aliasId)?.expiresAt,
    ).toBeNull();
  });

  it("the server returns a decoy once an alias's expiry has passed (doc 16)", async () => {
    // End-to-end through the real client + server: the same id resolves while
    // live and goes to a decoy once expired, proving server-side enforcement (not
    // just the device sweep). Raw bytes suffice; this tests transport, not crypto.
    const { api } = controller(fakePasskey());
    const id = "p".repeat(43);
    const token = "q".repeat(43);
    const payload = new Uint8Array(4096).fill(7);

    await api.putAlias(id, payload, token, nowMs() + 60_000); // expires in a minute
    expect(await api.getAlias(id)).toEqual(payload); // still live -> the real bytes

    await api.putAlias(id, payload, token, nowMs() - 1000); // already expired
    expect(await api.getAlias(id)).not.toEqual(payload); // a decoy now
  });

  it("reviewKnocks counts knocks on the owner's aliases (deduped per requester)", async () => {
    const { ctl, api } = controller(fakePasskey());
    const { session } = await ctl.signUp("ivy");
    const shared = await ctl.shareLink(session);
    const aliasId = shared.session.blob.aliases[0]?.id ?? "";

    // No knocks yet.
    expect(await ctl.reviewKnocks(shared.session)).toEqual({
      count: 0,
      pending: [],
    });

    // Two distinct viewers knock (each its own device secret + grant key); a
    // repeat from one dedupes. Each viewer's knock carries a grant pubkey, so both
    // are grantable.
    const viewerA = createBackendStore(api, "secret-a");
    const viewerB = createBackendStore(api, "secret-b");
    await viewerA.knock(aliasId);
    await viewerA.knock(aliasId); // same requester -> deduped
    await viewerB.knock(aliasId);

    const review = await ctl.reviewKnocks(shared.session);
    expect(review.count).toBe(2);
    expect(review.pending).toHaveLength(2);
    expect(review.pending.every((p) => p.alias.id === aliasId)).toBe(true);
  });

  it("renewLink: a failing revoke leaves the record and old link intact (retryable)", async () => {
    // The owner holds the write token; if the revoke PUT fails, nothing should
    // change: the old link must keep resolving (no false "it's gone") and the
    // record must stay so a retry can revoke it.
    const api = createApiClient(baseUrl);
    const store = createBackendStore(api);
    let failPut = false;
    const gatedApi = {
      ...api,
      putAlias: (id: string, payload: Bytes, token: string) =>
        failPut
          ? Promise.reject(new Error("revoke put failed"))
          : api.putAlias(id, payload, token),
    };
    const ctl = createSessionController({
      accounts: createAccountManager(gatedApi),
      sync: createAccountSync(gatedApi),
      devices: createDeviceStore(memoryStorage()),
      passkey: fakePasskey(),
      keys: createVolatileRootKeyStore(),
      api: gatedApi,
    });

    const { session } = await ctl.signUp("rae");
    const first = await ctl.shareLink(session);
    const old = first.session.blob.aliases[0];

    failPut = true;
    await expect(ctl.renewLink(first.session)).rejects.toThrow();
    // Fail-safe: the record is untouched and the old link still resolves.
    expect(first.session.blob.aliases).toHaveLength(1);
    expect(await store.resolveAlias(caps(old))).toEqual(
      deriveOwnerCard(
        session.blob.state,
        pseudonymFor(old?.id ?? ""),
        todayEpochDay(),
      ),
    );

    // A retry once the write recovers converges: old revoked, one fresh alias.
    failPut = false;
    const renewed = await ctl.renewLink(first.session);
    expect(renewed.session.blob.aliases).toHaveLength(1);
    expect(await store.resolveAlias(caps(old))).toBeNull();
  });

  it("renewLink: revoke lands even if removeAlias fails, and a retry converges", async () => {
    // Revoke-then-remove ordering: if the payload overwrite succeeds but dropping
    // the record fails, "no future reads" must already hold (the old link is dead)
    // and a retry must clean up the orphaned record.
    const api = createApiClient(baseUrl);
    const store = createBackendStore(api);
    const realAccounts = createAccountManager(api);
    let failRemove = true;
    const accounts = {
      ...realAccounts,
      removeAlias: (root: RootKey, id: string) =>
        failRemove
          ? Promise.reject(new Error("remove failed"))
          : realAccounts.removeAlias(root, id),
    };
    const ctl = createSessionController({
      accounts,
      sync: createAccountSync(api),
      devices: createDeviceStore(memoryStorage()),
      passkey: fakePasskey(),
      keys: createVolatileRootKeyStore(),
      api,
    });

    const { session } = await ctl.signUp("ola");
    const first = await ctl.shareLink(session);
    const old = first.session.blob.aliases[0];

    await expect(ctl.renewLink(first.session)).rejects.toThrow();
    // The overwrite landed before the record drop failed: no future reads already.
    expect(await store.resolveAlias(caps(old))).toBeNull();

    // Retry: renewLink finds the still-recorded (now-dead) alias, re-revokes
    // idempotently, removes it, and mints a fresh working link.
    failRemove = false;
    const renewed = await ctl.renewLink(first.session);
    expect(renewed.session.blob.aliases).toHaveLength(1);
    const fresh = renewed.session.blob.aliases[0];
    expect(fresh?.id).not.toBe(old?.id);
    expect(await store.resolveAlias(caps(fresh))).toEqual(
      deriveOwnerCard(
        session.blob.state,
        pseudonymFor(fresh?.id ?? ""),
        todayEpochDay(),
      ),
    );
  });
});
