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
import { parsePublicCard } from "./publicCard.ts";
import { requesterHash } from "./knock.ts";
import { parseContactInvite } from "./contactInvite.ts";
import { offerUrlWithBadge, parseScannedConnect } from "./linkup.ts";
import { lockNotifyDraft, parsePartnerPing } from "./partnerNotify.ts";
import { pollInbox, mintNotify } from "./notifyInbox.ts";
import { todayEpochDay, nowMs } from "../core/clock.ts";
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
    expect(resumed.ok).toBe(true);
    if (resumed.ok) {
      expect(resumed.session.root).toEqual(session.root);
      expect(resumed.session.blob).toEqual(session.blob);
    }
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

  it("the in-person linkup completes both sides from their own scans (doc 25)", async () => {
    const store = createBackendStore(createApiClient(baseUrl));
    const nowDay = todayEpochDay();
    const a = controller(fakePasskey());
    const { session: aSession } = await a.ctl.signUp("alex");
    const b = controller(fakePasskey());
    const { session: bSession } = await b.ctl.signUp("blair");

    // Each device mints its own offer (what its shown QR carries): a pending
    // contact + the invite URL, with the badge snapshot appended.
    const aOffer = await a.ctl.createContactLink(aSession, "");
    const bOffer = await b.ctl.createContactLink(bSession, "");
    const aUrl = offerUrlWithBadge(aOffer.url, { badge: "gray", day: nowDay });
    const bUrl = offerUrlWithBadge(bOffer.url, { badge: "blue", day: nowDay });

    // A's camera catches B's screen and vice versa; each side classifies the
    // scan and completes its OWN pending contact, in whatever order.
    const aScan = parseScannedConnect(bUrl);
    const bScan = parseScannedConnect(aUrl);
    if (aScan?.kind !== "offer" || bScan?.kind !== "offer") {
      throw new Error("expected both scans to classify as offers");
    }
    expect(aScan.snapshot).toEqual({ badge: "blue", day: nowDay });
    expect(bScan.snapshot).toEqual({ badge: "gray", day: nowDay });
    const aDone = await a.ctl.completeInPersonLinkup(
      aOffer.session,
      aOffer.contact.id,
      aScan.invite,
    );
    const bDone = await b.ctl.completeInPersonLinkup(
      bOffer.session,
      bOffer.contact.id,
      bScan.invite,
    );

    const aContact = aDone.blob.contacts[0];
    const bContact = bDone.blob.contacts[0];
    if (aContact?.theirStatusAlias === undefined) {
      throw new Error("A's linkup did not complete");
    }
    if (bContact?.theirStatusAlias === undefined) {
      throw new Error("B's linkup did not complete");
    }

    // Each side reads the other's live status through the exchanged alias.
    expect(await store.resolveAlias(aContact.theirStatusAlias)).toEqual(
      deriveOwnerCard(
        bSession.blob.state,
        pseudonymFor(aContact.theirStatusAlias.id),
        nowDay,
      ),
    );
    expect(await store.resolveAlias(bContact.theirStatusAlias)).toEqual(
      deriveOwnerCard(
        aSession.blob.state,
        pseudonymFor(bContact.theirStatusAlias.id),
        nowDay,
      ),
    );

    // The notify channels exchanged exactly like a remote link: each side holds
    // the other's per-contact inbox, so the partner-notify loop works here too.
    expect(aContact.theirNotify).toEqual(bContact.myInbox);
    expect(bContact.theirNotify).toEqual(aContact.myInbox);
  });

  it("walking away discards the offer: the shown code stops resolving", async () => {
    const store = createBackendStore(createApiClient(baseUrl));
    const a = controller(fakePasskey());
    const { session } = await a.ctl.signUp("alex");
    const offer = await a.ctl.createContactLink(session, "");
    const link = caps(offer.contact.alias);

    // Until discarded, the shown offer resolves (the other side may scan first).
    expect(await store.resolveAlias(link)).not.toBeNull();

    // Closing the screen before this side's scan landed revokes + drops it, so
    // a half-gesture leaves nothing behind and the code goes uniformly dark.
    const after = await a.ctl.revokeContact(offer.session, offer.contact.id);
    expect(after.blob.contacts).toHaveLength(0);
    expect(await store.resolveAlias(link)).toBeNull();
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

    // The merged fan-out (doc 33 slice 6) reports per INBOX, so a pinged contact
    // shows up as its notify inbox id, not its contact id.
    const result = await ctl.notifyContactsOfPositive(linked);
    expect(result.sent).toEqual([theirNotify.inboxId]);

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
    expect(roster.map((m) => m.tone)).toEqual([
      "blue",
      "gray",
      "gray",
      "gray",
      "gray",
    ]);

    // A small group still resolves a full roster (no hide floor, doc 31): being in
    // the group is itself sharing your color, so size protects nothing.
    const small = await resolveCircleRoster(
      { id: "c", name: "crew", memberContactIds: ids.slice(0, 2) },
      contacts,
      (link) => store.resolveAlias(link),
    );
    expect(small.map((m) => m.contactId)).toEqual(["m0", "m1"]);
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
    expect((await foreign.resume()).ok).toBe(false);
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

    // A standing approve seals the alias key to the requester; they redeem it and
    // the status resolves to the owner's real card, and stays re-checkable.
    expect(
      await ctl.approveKnocks(shared.session, review.pending, "standing"),
    ).toBe(1);
    const grant = await redeemGrant(
      api,
      aliasId,
      requesterSecret,
      kp.privateKey,
    );
    if (grant?.kind !== "key") throw new Error("expected a granted key");
    expect(await store.resolveAlias({ id: aliasId, key: grant.key })).toEqual(
      deriveOwnerCard(
        session.blob.state,
        pseudonymFor(aliasId),
        todayEpochDay(),
      ),
    );
  });

  it("a one-time approve delivers a card snapshot, not the key (no live access)", async () => {
    const { ctl, api } = controller(fakePasskey());
    const { session } = await ctl.signUp("juno");

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

    const review = await ctl.reviewKnocks(shared.session);
    // A one-time approve seals a frozen snapshot of the owner's current card.
    expect(
      await ctl.approveKnocks(shared.session, review.pending, "once"),
    ).toBe(1);

    // The requester gets a card snapshot, never the alias key: no live access.
    const grant = await redeemGrant(
      api,
      aliasId,
      requesterSecret,
      kp.privateKey,
    );
    if (grant?.kind !== "card") throw new Error("expected a card snapshot");

    // The frozen snapshot parses back to the owner's current card (the same one a
    // keyed link would resolve to), so the viewer sees the status once.
    expect(parsePublicCard(grant.card)).toEqual(
      deriveOwnerCard(
        session.blob.state,
        pseudonymFor(aliasId),
        todayEpochDay(),
      ),
    );
  });

  it("the share link is the keyed private /a/ link, reused across shares", async () => {
    const { ctl } = controller(fakePasskey());
    const created = await ctl.signUp("pat");

    // The share sheet mints one private link: /a/{id}#k=, its key in the fragment so
    // it opens straight to the status (no knock). isPublic stays false (unadvertised,
    // expirable). Public sharing is the /u/ handle, never this path (doc 16).
    const linkShare = await ctl.shareLink(created.session);
    expect(linkShare.url).toContain("#k=");
    expect(linkShare.session.blob.aliases).toHaveLength(1);
    expect(linkShare.session.blob.aliases[0]?.isPublic).toBe(false);

    // Sharing again reuses the SAME private alias (same link) and refreshes its
    // card, never minting a second one.
    const again = await ctl.shareLink(linkShare.session);
    expect(again.url).toBe(linkShare.url);
    expect(again.url).toContain("#k=");
    expect(again.session.blob.aliases).toHaveLength(1);
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

  it("createContactLink mints a private, keyed, durable link that resolves, then revokes", async () => {
    const { ctl, api } = controller(fakePasskey());
    const store = createBackendStore(api);
    const { session } = await ctl.signUp("nat");

    const made = await ctl.createContactLink(session, "Sam");
    expect(made.contact.label).toBe("Sam");
    expect(made.contact.alias.isPublic).toBe(false);
    // Default lifetime: no expiry, the link lives until revoked.
    expect(made.contact.expiresAt).toBeNull();
    expect(made.session.blob.contacts).toHaveLength(1);

    // A chosen lifetime is stored as the absolute instant the owner picked.
    const in7d = nowMs() + 7 * 24 * 60 * 60 * 1000;
    const timed = await ctl.createContactLink(made.session, "Ari", {
      expiresAt: in7d,
    });
    expect(timed.contact.expiresAt).toBe(in7d);
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
    const after = await ctl.revokeContact(timed.session, made.contact.id);
    expect(after.blob.contacts.map((c) => c.label)).toEqual(["Ari"]);
    expect(await store.resolveAlias(caps(made.contact.alias))).toBeNull();
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
