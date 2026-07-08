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
  type AccountBlob,
  type GroupRecord,
  type PendingGroupInvite,
} from "../accountBlob.ts";
import {
  demoGroup,
  demoInbox,
  demoJoinRequestStore,
  demoRoster,
} from "./demoGroupSeed.ts";
import { demoViewerRequestStore } from "./demoPeerSeed.ts";
import {
  demoContact,
  demoContactMethods,
  demoCircleMethods,
  demoKnocks,
  demoUrl,
  demoVanityNames,
} from "./demoOwner.ts";
import { groupInviteUrl } from "../groupInvite.ts";
import type { OwnerState } from "../../core/badge.ts";
import { deriveOwnerCard } from "../ownerCard.ts";
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

/** The live @demo passport card, derived from the very seed the demo boots into,
 * so the landing preview is the real demo card rather than a static mockup. Pure
 * and networkless (deriveOwnerCard), recomputed each call so its 90-day clock stays
 * current with the wall clock. */
export function demoSampleCard(): ResolvedView {
  return deriveOwnerCard(
    demoBlueState(),
    DEMO_HANDLE,
    todayEpochDay(),
    DEFAULT_AVATAR,
  );
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
    // Accepting a group invite joins as a MEMBER (doc 33): record a member-side group
    // from the invite (no admin write token or Kg; those arrive on the first roster
    // poll in the real flow), so People shows the joined group. Idempotent. doc 28 F.
    acceptGroupInvite: async (_s, invite) => {
      const already = (getBlob().groups ?? []).some(
        (g) => g.groupId === invite.groupId,
      );
      if (!already) {
        const group: GroupRecord = {
          groupId: invite.groupId,
          myCardId: randomAliasId(),
          myCardWriteToken: randomWriteToken(),
          handle: invite.handle,
          visibility: invite.visibility,
          meetingKind: invite.meetingKind,
          isAdmin: false,
          lifecycleInbox: invite.lifecycleInbox,
          joinedDay: todayEpochDay(),
        };
        setBlob({ ...getBlob(), groups: [...(getBlob().groups ?? []), group] });
      }
      return { session: await session(), outcome: "joined" };
    },
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
  // Device-local waiting join requests per public admin group (see demoGroupSeed):
  // review seeds a contentless row on first read; approve/reject clear it.
  const joinRequests = demoJoinRequestStore();
  // One public group the reviewer can DISCOVER and join (doc 28 F, Flow 4 member side):
  // requestToJoin resolves for this seeded handle, and the scripted admin approves on
  // the next redeem poll, adding the member-side record. Any other handle stays
  // "not-found" (the demo discovers no other real group). A distinct handle from the
  // owner's own seeded group, so joining is a genuine second-party join.
  const joinable = {
    handle: "climbing_crew",
    groupId: randomAliasId(),
    lifecycleInbox: demoInbox(),
    visibility: "public" as const,
    meetingKind: "recurring" as const,
  };
  let joinRequested = false;
  return {
    requestToJoin: (_s, handle) => {
      if (normalizeVanityName(handle) === joinable.handle) {
        joinRequested = true;
        return Promise.resolve("requested" as const);
      }
      return Promise.resolve("not-found" as const);
    },
    reviewJoinRequests: (_s, groupId) =>
      Promise.resolve(
        joinRequests.review(
          (getBlob().groups ?? []).find((g) => g.groupId === groupId),
        ),
      ),
    approveJoinRequest: (s, groupId, request) => {
      joinRequests.drop(groupId, request.requesterHash);
      return Promise.resolve(s);
    },
    rejectJoinRequest: (s, groupId, request) => {
      joinRequests.drop(groupId, request.requesterHash);
      return Promise.resolve(s);
    },
    // The scripted admin approves the reviewer's pending request on the next poll,
    // delivering the join: record the member-side group so People shows it. Idempotent.
    redeemJoinRequests: async (s) => {
      const joined = (getBlob().groups ?? []).some(
        (g) => g.groupId === joinable.groupId,
      );
      if (!joinRequested || joined) return s;
      const group: GroupRecord = {
        groupId: joinable.groupId,
        myCardId: randomAliasId(),
        myCardWriteToken: randomWriteToken(),
        handle: joinable.handle,
        visibility: joinable.visibility,
        meetingKind: joinable.meetingKind,
        isAdmin: false,
        lifecycleInbox: joinable.lifecycleInbox,
      };
      setBlob({ ...getBlob(), groups: [...(getBlob().groups ?? []), group] });
      joinRequested = false;
      return session();
    },
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
      };
      return session();
    },
    sweepExpiredLinks: () => session(),
    // No server to republish to; the demo card is always derived live anyway.
    refreshLiveLinks: () => Promise.resolve(),
    setOwnerState: async (_s, state) => {
      blob = { ...blob, state };
      return session();
    },
    shareLink: (s) => Promise.resolve({ session: s, url: demoUrl() }),
    renewLink: (s) => Promise.resolve({ session: s, url: demoUrl() }),
    // The demo has no server enforcing expiry, so the lifetime choice is a no-op.
    setShareLinkExpiry: (s) => Promise.resolve(s),
    deleteAccount: () => Promise.resolve(),
    ...demoKnocks(),
    ...demoContactMethods(getBlob, setBlob, session),
    notifyContactsOfPositive: () =>
      Promise.resolve({ sent: [], skipped: [], failed: [] }),
    hasPartnerNudge: () => Promise.resolve(false),
    ...demoCircleMethods(getBlob, setBlob, session),
    ...demoVanityNames(getBlob, setBlob, session),
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
  // Flow 3 (knock as a viewer): a gray peer the reviewer can ask to see. Its link
  // resolves to the uniform gray-nothing, so opening it shows the knock affordance;
  // a knock resolves a beat later (the scripted owner approves). One request is
  // pre-seeded, so the Requests surface also shows a live "waiting" row. doc 28 F.
  const viewer = demoViewerRequestStore(DEMO_PEER_CARD);
  return {
    resolveAlias: (link) =>
      Promise.resolve(viewer.isGray(link.id) ? null : DEMO_PEER_CARD),
    knock: (aliasId) => {
      viewer.knock(aliasId);
      return Promise.resolve();
    },
    redeemGrant: (aliasId) => Promise.resolve(viewer.redeem(aliasId)),
    resolveVanityName: () => Promise.resolve(null),
    reportVanityName: () => Promise.resolve(),
    submitFeedback: () => Promise.resolve(),
    pendingRequests: () => viewer.pending(),
    forgetRequest: (aliasId) => viewer.forget(aliasId),
  };
}
