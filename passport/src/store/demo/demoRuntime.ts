/**
 * The demo runtime (doc 28, "demo mode"): a fully in-memory, seeded stand-in for
 * the real backend, so anyone can use the whole passport without an account and
 * without a single request to the server. It is the REAL app over a local store
 * with a locally simulated backend, so every feature behaves the same; the only
 * difference a person can feel is that it forgets everything on reload.
 *
 * SECURITY/PRIVACY: this module imports no api client and opens no connection.
 * The root is a throwaway non-extractable key minted for the session and never
 * persisted, the `@demo` account is synthetic, and nothing here reaches
 * `api.sti.care`. That is the "demo makes no account and sends us nothing"
 * promise, kept structurally true (there is no network surface to call).
 */

import type { ResolvedView } from "../../ui/public/PublicResolution.tsx";
import type { OwnerSession, SessionController } from "../session.ts";
import type { PassportStore } from "../passportStore.ts";
import type { AccountBlob, ContactRecord } from "../accountBlob.ts";
import type { OwnerState } from "../../core/badge.ts";
import {
  importRootKey,
  randomAliasId,
  randomWriteToken,
} from "../../crypto/keys.ts";
import { todayEpochDay } from "../../core/clock.ts";
import { DEFAULT_AVATAR } from "../../lib/avatars.ts";

/** The reserved handle the demo account wears everywhere (server-reserved too). */
export const DEMO_HANDLE = "demo";

// A blue-eligible owner state anchored to TODAY (not a fixed fixture day), so the
// demo badge ages with the wall clock exactly like a real account's would.
function demoBlueState(): OwnerState {
  return {
    testing: {
      lastPanelDay: todayEpochDay() - 10,
      corePanelComplete: true,
      exposedSitesCovered: true,
    },
    hiv: "negative",
    activeNonHivSti: false,
    onPrep: true,
    condomPreference: "none",
    condomPreferencePublic: false,
    onDoxyPep: false,
    paused: false,
    clearUntilDay: null,
  };
}

function demoContact(label: string, agoDays: number): ContactRecord {
  return {
    id: randomAliasId(),
    label,
    createdDay: todayEpochDay() - agoDays,
    expiresAt: null,
    alias: {
      id: randomAliasId(),
      writeToken: randomWriteToken(),
      key: randomAliasId(),
      isPublic: false,
    },
  };
}

/** A freshly seeded demo account: handle, a blue badge, and a couple of contacts
 * so every tab has something real to look at. Rebuilt on each demo entry. */
export function demoBlob(): AccountBlob {
  return {
    handle: DEMO_HANDLE,
    aliases: [],
    contacts: [demoContact("Sam", 12), demoContact("Alex", 30)],
    state: demoBlueState(),
    avatar: DEFAULT_AVATAR,
    sharingMode: "link",
  };
}

// A canned peer card the demo resolves any shared link to, so "see someone else's
// passport" works on one device with no second person.
const DEMO_PEER_CARD: ResolvedView = {
  state: "blue",
  labels: ["hiv"],
  route: "hiv",
  identity: { handle: "demo-friend" },
};

function demoUrl(): string {
  return `https://sti.care/a/${randomAliasId()}`;
}

/**
 * The in-memory session controller. Every method mutates a local blob and returns
 * a session; none touch the network. `resumeFromStore` returns the seeded session,
 * so an app mounted with this controller boots straight into the `@demo` account.
 */
export function createDemoController(): SessionController {
  let blob = demoBlob();
  // A throwaway non-extractable root, so the app's real derivations (account id,
  // write token) run on a real key; it is never persisted or exported.
  const rootPromise = importRootKey(crypto.getRandomValues(new Uint8Array(32)));
  const session = async (): Promise<OwnerSession> => ({
    root: await rootPromise,
    blob,
  });

  return {
    signUp: async (handle) => {
      if (handle !== undefined) blob = { ...blob, handle };
      return {
        session: await session(),
        recoveryPhrase: "demo demo demo demo",
      };
    },
    recover: () => session(),
    resume: () => Promise.resolve({ ok: false as const, reason: "no-binding" }),
    rememberDevice: () => Promise.resolve(),
    forgetDevice: () => Promise.resolve(),
    resumeFromStore: () => session(),
    enrollPasskey: () => Promise.resolve(),
    setProfile: async (_s, profile) => {
      blob = {
        ...blob,
        avatar: profile.avatar,
        sharingMode: profile.sharingMode,
      };
      return session();
    },
    sweepExpiredLinks: () => session(),
    setOwnerState: async (_s, state) => {
      blob = { ...blob, state };
      return session();
    },
    shareLink: (s) => Promise.resolve({ session: s, url: demoUrl() }),
    renewLink: (s) => Promise.resolve({ session: s, url: demoUrl() }),
    setShareLinkDuration: () => session(),
    deleteAccount: () => Promise.resolve(),
    // One contentless ask, so the demo inbox shows "someone asked to see your
    // status" (faithful to real behavior: a count with no grantable pending is an
    // informational row, never a dead-end the demo can't honor).
    reviewKnocks: () => Promise.resolve({ count: 1, pending: [] }),
    approveKnocks: (_s, approvals) => Promise.resolve(approvals.length),
    createContactLink: async (_s, label) => {
      const contact = demoContact(label, 0);
      blob = { ...blob, contacts: [...blob.contacts, contact] };
      return { session: await session(), contact, url: demoUrl() };
    },
    revokeContact: async (_s, contactId) => {
      blob = {
        ...blob,
        contacts: blob.contacts.filter((c) => c.id !== contactId),
      };
      return session();
    },
    setContactDuration: async (_s, contactId, durationMs) => {
      blob = {
        ...blob,
        contacts: blob.contacts.map((c) =>
          c.id === contactId ? { ...c, expiresAt: durationMs } : c,
        ),
      };
      return session();
    },
    revokeAlias: async (_s, aliasId) => {
      blob = { ...blob, aliases: blob.aliases.filter((a) => a.id !== aliasId) };
      return session();
    },
    acceptContactInvite: async (_s, _invite, label) => {
      const contact = demoContact(label, 0);
      blob = { ...blob, contacts: [...blob.contacts, contact] };
      return { session: await session(), contact, url: demoUrl() };
    },
    ingestContactReturn: (s) => Promise.resolve(s),
    notifyContactsOfPositive: () =>
      Promise.resolve({ sent: [], skipped: [], failed: [] }),
    hasPartnerNudge: () => Promise.resolve(false),
    createCircle: async (_s, name, memberContactIds) => {
      const circleId = randomAliasId();
      const circle = { id: circleId, name, memberContactIds };
      blob = { ...blob, circles: [...(blob.circles ?? []), circle] };
      return { session: await session(), circleId };
    },
    updateCircle: async (_s, circleId, name, memberContactIds) => {
      blob = {
        ...blob,
        circles: (blob.circles ?? []).map((c) =>
          c.id === circleId ? { id: circleId, name, memberContactIds } : c,
        ),
      };
      return session();
    },
    removeCircle: async (_s, circleId) => {
      blob = {
        ...blob,
        circles: (blob.circles ?? []).filter((c) => c.id !== circleId),
      };
      return session();
    },
    registerVanityName: (s) =>
      Promise.resolve({ session: s, result: "unavailable" as const }),
    checkVanityName: () => Promise.resolve("taken" as const),
    releaseVanityName: (s) => Promise.resolve(s),
    forget: () => undefined,
  };
}

/**
 * The in-memory read store. Any shared link resolves to the canned peer card, so a
 * demo user (or an app reviewer) can open "someone else's" passport on one device.
 */
export function createDemoStore(): PassportStore {
  return {
    resolveAlias: () => Promise.resolve(DEMO_PEER_CARD),
    knock: () => Promise.resolve(),
    redeemGrant: () => Promise.resolve(null),
    resolveVanityName: () => Promise.resolve(null),
    reportVanityName: () => Promise.resolve(),
    pendingRequests: () => [],
    forgetRequest: () => undefined,
  };
}
