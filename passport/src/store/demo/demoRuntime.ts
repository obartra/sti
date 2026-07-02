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
import {
  MAX_CONTACT_LABEL,
  type AccountBlob,
  type ContactRecord,
  type GroupRecord,
  type PendingGroupInvite,
} from "../accountBlob.ts";
import { demoGroup, demoInbox, demoRoster } from "./demoGroupSeed.ts";
import { groupInviteUrl } from "../groupInvite.ts";
import type { OwnerState } from "../../core/badge.ts";
import {
  importRootKey,
  randomAliasId,
  randomWriteToken,
} from "../../crypto/keys.ts";
import { todayEpochDay, nowMs } from "../../core/clock.ts";
import { DEFAULT_AVATAR } from "../../lib/avatars.ts";
import { normalizeVanityName } from "../vanityName.ts";

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

/** A freshly seeded demo account: handle, a blue badge, a couple of contacts, and
 * one group, so every tab has something real to look at. Rebuilt on each demo
 * entry. */
function demoBlob(): AccountBlob {
  return {
    handle: DEMO_HANDLE,
    aliases: [],
    contacts: [demoContact("Sam", 12), demoContact("Alex", 30)],
    state: demoBlueState(),
    avatar: DEFAULT_AVATAR,
    sharingMode: "link",
    groups: [demoGroup()],
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

// The recovery-factor demo methods (doc 32). The demo has no server, so it just
// records or clears the recovery name locally and reports success, so the Settings
// factor row reflects the toggle faithfully. Split out to keep createDemoController
// within its length ceiling.
function demoRecovery(
  getBlob: () => AccountBlob,
  setBlob: (b: AccountBlob) => void,
  session: () => Promise<OwnerSession>,
): Pick<
  SessionController,
  | "setRecoveryPassword"
  | "disableRecoveryPassword"
  | "passkeyEnrolled"
  | "verifyPasskey"
> {
  return {
    // The demo enrolls no passkey, so the phrase re-view gate falls back to the
    // two-step confirm; a verify would never be reached, and resolves false.
    passkeyEnrolled: () => false,
    verifyPasskey: () => Promise.resolve(false),
    setRecoveryPassword: async (_s, input) => {
      setBlob({
        ...getBlob(),
        recoveryName: normalizeVanityName(input.name),
        passwordSetAt: nowMs(),
      });
      return { session: await session(), outcome: "set" as const };
    },
    disableRecoveryPassword: () => {
      const next = { ...getBlob() };
      delete (next as { recoveryName?: string }).recoveryName;
      delete (next as { passwordSetAt?: number }).passwordSetAt;
      setBlob(next);
      return session();
    },
  };
}

// The shared-group demo method (doc 33). No server, so it mints local ids, records
// the group in the local blob, and reports "registered" for a public handle (the
// happy path) or "created" for a private one, faithful to the real create flow.
// Split out to keep createDemoController within its length ceiling.
function demoGroups(
  getBlob: () => AccountBlob,
  setBlob: (b: AccountBlob) => void,
  session: () => Promise<OwnerSession>,
): Pick<SessionController, "createGroup"> {
  return {
    createGroup: async (_s, input) => {
      const groupId = randomAliasId();
      const isPublic = input.visibility === "public";
      const group: GroupRecord = {
        groupId,
        groupWriteToken: randomWriteToken(),
        kg: randomAliasId(),
        myCardId: randomAliasId(),
        myCardWriteToken: randomWriteToken(),
        handle: normalizeVanityName(input.handle),
        visibility: input.visibility,
        meetingKind: input.meetingKind,
        isAdmin: true,
        ...(isPublic
          ? {
              joinPointerId: randomAliasId(),
              joinWriteToken: randomWriteToken(),
            }
          : {}),
      };
      setBlob({ ...getBlob(), groups: [...(getBlob().groups ?? []), group] });
      return {
        session: await session(),
        groupId,
        handle: group.handle,
        result: isPublic ? ("registered" as const) : ("created" as const),
      };
    },
  };
}

// The shared-group membership demo methods (doc 33, slice 4a). No server, so invite/
// revoke/remove mutate the local group record faithfully and the cross-party paths
// (accept/reject/poll) resolve inert; a roster read returns the seeded group's real
// roster (see demoRoster), a calm mix of blue and one gray/absent member. Split out
// to keep createDemoController within its length ceiling.
function demoGroupMembership(
  getBlob: () => AccountBlob,
  setBlob: (b: AccountBlob) => void,
  session: () => Promise<OwnerSession>,
): Pick<
  SessionController,
  | "inviteToGroup"
  | "revokeGroupInvite"
  | "acceptGroupInvite"
  | "rejectGroupInvite"
  | "pollGroupLifecycle"
  | "removeGroupMember"
  | "readGroupRoster"
> {
  const updateGroup = (groupId: string, fn: (g: GroupRecord) => GroupRecord) =>
    setBlob({
      ...getBlob(),
      groups: (getBlob().groups ?? []).map((g) =>
        g.groupId === groupId ? fn(g) : g,
      ),
    });
  return {
    inviteToGroup: async (_s, groupId, opts) => {
      const lifecycleInbox = demoInbox();
      const invite: PendingGroupInvite = {
        inviteId: randomAliasId(),
        lifecycleInbox,
        createdDay: todayEpochDay(),
        ...(opts?.label !== undefined ? { label: opts.label } : {}),
      };
      updateGroup(groupId, (g) => ({
        ...g,
        pendingInvites: [...(g.pendingInvites ?? []), invite],
      }));
      const g = (getBlob().groups ?? []).find((x) => x.groupId === groupId);
      const url = g
        ? groupInviteUrl({
            groupId,
            lifecycleInbox,
            handle: g.handle,
            visibility: g.visibility,
            meetingKind: g.meetingKind,
          })
        : demoUrl();
      return { session: await session(), url };
    },
    revokeGroupInvite: async (_s, groupId, inviteId) => {
      updateGroup(groupId, (g) => ({
        ...g,
        pendingInvites: (g.pendingInvites ?? []).filter(
          (p) => p.inviteId !== inviteId,
        ),
      }));
      return session();
    },
    acceptGroupInvite: () => session(),
    rejectGroupInvite: () => session(),
    pollGroupLifecycle: () => session(),
    removeGroupMember: async (_s, groupId, cardId) => {
      updateGroup(groupId, (g) => ({
        ...g,
        members: (g.members ?? []).filter((m) => m.cardId !== cardId),
      }));
      return session();
    },
    readGroupRoster: async (_s, groupId) => {
      const group = (getBlob().groups ?? []).find((g) => g.groupId === groupId);
      return {
        session: await session(),
        obj: null,
        members: group ? demoRoster(group, DEMO_PEER_CARD) : [],
      };
    },
  };
}

// The shared-group REQUEST + LEAVE demo methods (doc 33, slice 4b). No server, so
// requestToJoin finds nothing (`not-found`, faithful: the demo discovers no real
// public group), review returns no requests, and approve/reject/redeem round-trip
// inert; leave drops the group locally, faithful to the real member-side leave.
// Split out to keep createDemoController within its length ceiling.
function demoGroupJoin(
  getBlob: () => AccountBlob,
  setBlob: (b: AccountBlob) => void,
  session: () => Promise<OwnerSession>,
): Pick<
  SessionController,
  | "requestToJoin"
  | "reviewJoinRequests"
  | "approveJoinRequest"
  | "rejectJoinRequest"
  | "redeemJoinRequests"
  | "leaveGroup"
  | "deleteGroup"
> {
  // Leave (member) and disband (admin) both end the same way locally: forget the group
  // record. The demo has no server, so each just drops it, faithful to the real drop.
  const dropGroup = (groupId: string) =>
    setBlob({
      ...getBlob(),
      groups: (getBlob().groups ?? []).filter((g) => g.groupId !== groupId),
    });
  return {
    requestToJoin: () => Promise.resolve("not-found" as const),
    reviewJoinRequests: () => Promise.resolve([]),
    approveJoinRequest: (s) => Promise.resolve(s),
    rejectJoinRequest: (s) => Promise.resolve(s),
    redeemJoinRequests: (s) => Promise.resolve(s),
    leaveGroup: async (_s, groupId) => {
      dropGroup(groupId);
      return session();
    },
    deleteGroup: async (_s, groupId) => {
      dropGroup(groupId);
      return session();
    },
  };
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
  const getBlob = () => blob;
  const setBlob = (b: AccountBlob) => void (blob = b);

  return {
    signUp: async (handle, recovery) => {
      if (handle !== undefined) blob = { ...blob, handle };
      // The demo has no server, so an at-sign-up password just records the chosen
      // Username locally and reports "set", faithful to the real flow's happy path.
      if (recovery !== undefined) {
        blob = {
          ...blob,
          recoveryName: normalizeVanityName(recovery.recoveryName),
          passwordSetAt: nowMs(),
        };
      }
      return {
        session: await session(),
        recoveryPhrase: "demo demo demo demo",
        ...(recovery !== undefined ? { recoveryOutcome: "set" as const } : {}),
      };
    },
    recover: () => session(),
    // The demo has no server, so there is nothing to unlock by password.
    recoverByPassword: () => Promise.resolve(null),
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
    // The demo has no server enforcing expiry, so the lifetime choice is a no-op.
    setShareLinkExpiry: (s) => Promise.resolve(s),
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
    renameContact: async (_s, contactId, label) => {
      blob = {
        ...blob,
        contacts: blob.contacts.map((c) =>
          c.id === contactId
            ? { ...c, label: label.trim().slice(0, MAX_CONTACT_LABEL) }
            : c,
        ),
      };
      return session();
    },
    revokeContact: async (_s, contactId) => {
      blob = {
        ...blob,
        contacts: blob.contacts.filter((c) => c.id !== contactId),
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
    ...demoRecovery(getBlob, setBlob, session),
    ...demoGroups(getBlob, setBlob, session),
    ...demoGroupMembership(getBlob, setBlob, session),
    ...demoGroupJoin(getBlob, setBlob, session),
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
    submitFeedback: () => Promise.resolve(),
    pendingRequests: () => [],
    forgetRequest: () => undefined,
  };
}
