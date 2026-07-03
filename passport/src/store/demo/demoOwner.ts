/**
 * Owner-side demo methods, split out of demoRuntime so createDemoController and the
 * file stay within their length ceilings: the seeded two-way contact, the scripted
 * knock grant (doc 28 F, Flow 1), and the contact + circle mutations. Pure in-memory
 * mutation over the shared blob accessors; no api client and no network.
 */

import {
  MAX_CONTACT_LABEL,
  type AccountBlob,
  type ContactRecord,
} from "../accountBlob.ts";
import type { OwnerSession, SessionController } from "../session.ts";
import { demoSharedAlias, demoTwoWay } from "./demoPeerSeed.ts";
import { randomAliasId, randomWriteToken } from "../../crypto/keys.ts";
import { todayEpochDay } from "../../core/clock.ts";

type GetBlob = () => AccountBlob;
type SetBlob = (b: AccountBlob) => void;
type Session = () => Promise<OwnerSession>;

/** A random demo share URL (no server; the id is decorative). */
export function demoUrl(): string {
  return `https://sti.care/a/${randomAliasId()}`;
}

// A demo contact reads as a real, fully-exchanged two-way connection (doc 13): the
// scripted peer "accepted," so theirStatusAlias + theirNotify are present (not the
// half-linked pending state). The reviewer sees a genuine connection, not a stub.
export function demoContact(
  label: string,
  agoDays: number,
  expiresAt: number | null = null,
): ContactRecord {
  return {
    id: randomAliasId(),
    label,
    createdDay: todayEpochDay() - agoDays,
    expiresAt,
    alias: {
      id: randomAliasId(),
      writeToken: randomWriteToken(),
      key: randomAliasId(),
      isPublic: false,
    },
    ...demoTwoWay(),
  };
}

// Flow 1 (grant a knock): a scripted stranger has asked to see the owner's status on
// one of their shared links. The pending is grant-shaped (a truthy pubKey), so the
// Approve button renders; the ids are stable so a re-review after approve recognizes
// it as granted and clears the row (the owner's success confirmation). doc 28 F.
export function demoKnocks(): Pick<
  SessionController,
  "reviewKnocks" | "approveKnocks"
> {
  const alias = demoSharedAlias();
  const requesterHash = randomAliasId();
  const pubKey = randomAliasId();
  let granted = false;
  return {
    reviewKnocks: () =>
      Promise.resolve(
        granted
          ? { count: 0, pending: [] }
          : {
              count: 1,
              pending: [{ alias, pending: { requesterHash, pubKey } }],
            },
      ),
    approveKnocks: (_s, approvals) => {
      granted = true;
      return Promise.resolve(approvals.length);
    },
  };
}

// The contact + linkup demo methods (doc 13): create/rename/revoke a contact link,
// revoke a bare alias, and the two-way accept/return legs that form a real connection
// (doc 28 F, Flow 2). Mutate-and-persist over the shared blob accessors.
export function demoContactMethods(
  getBlob: GetBlob,
  setBlob: SetBlob,
  session: Session,
): Pick<
  SessionController,
  | "createContactLink"
  | "renameContact"
  | "revokeContact"
  | "revokeAlias"
  | "acceptContactInvite"
  | "ingestContactReturn"
> {
  return {
    createContactLink: async (_s, label, opts) => {
      const contact = demoContact(label, 0, opts?.expiresAt ?? null);
      setBlob({ ...getBlob(), contacts: [...getBlob().contacts, contact] });
      return { session: await session(), contact, url: demoUrl() };
    },
    renameContact: async (_s, contactId, label) => {
      setBlob({
        ...getBlob(),
        contacts: getBlob().contacts.map((c) =>
          c.id === contactId
            ? { ...c, label: label.trim().slice(0, MAX_CONTACT_LABEL) }
            : c,
        ),
      });
      return session();
    },
    revokeContact: async (_s, contactId) => {
      setBlob({
        ...getBlob(),
        contacts: getBlob().contacts.filter((c) => c.id !== contactId),
      });
      return session();
    },
    revokeAlias: async (_s, aliasId) => {
      setBlob({
        ...getBlob(),
        aliases: getBlob().aliases.filter((a) => a.id !== aliasId),
      });
      return session();
    },
    // Accepting a peer's invite forms a real two-way contact: the peer's status alias
    // and notify capability come off the invite, fully exchanged, not half-linked.
    acceptContactInvite: async (_s, invite, label) => {
      const contact: ContactRecord = {
        ...demoContact(label, 0),
        theirStatusAlias: invite.alias,
        theirNotify: invite.notify,
      };
      setBlob({ ...getBlob(), contacts: [...getBlob().contacts, contact] });
      return { session: await session(), contact, url: demoUrl() };
    },
    // The inviter's completion leg: fill in a still-pending contact (one this device
    // shared with but has not yet seen back) from the returned invite, flipping it to
    // a two-way connection, exactly like the real ingestContactReturn.
    ingestContactReturn: async (_s, ret) => {
      setBlob({
        ...getBlob(),
        contacts: getBlob().contacts.map((c) =>
          c.alias.id === ret.ref && c.theirStatusAlias === undefined
            ? { ...c, theirStatusAlias: ret.alias, theirNotify: ret.notify }
            : c,
        ),
      });
      return session();
    },
  };
}

// The circle (bundle) demo methods (doc 13 slice 6): create/update/remove a local
// circle. Purely local; the server never knew it existed.
export function demoCircleMethods(
  getBlob: GetBlob,
  setBlob: SetBlob,
  session: Session,
): Pick<SessionController, "createCircle" | "updateCircle" | "removeCircle"> {
  return {
    createCircle: async (_s, name, memberContactIds) => {
      const circleId = randomAliasId();
      setBlob({
        ...getBlob(),
        circles: [
          ...(getBlob().circles ?? []),
          { id: circleId, name, memberContactIds },
        ],
      });
      return { session: await session(), circleId };
    },
    updateCircle: async (_s, circleId, name, memberContactIds) => {
      setBlob({
        ...getBlob(),
        circles: (getBlob().circles ?? []).map((c) =>
          c.id === circleId ? { id: circleId, name, memberContactIds } : c,
        ),
      });
      return session();
    },
    removeCircle: async (_s, circleId) => {
      setBlob({
        ...getBlob(),
        circles: (getBlob().circles ?? []).filter((c) => c.id !== circleId),
      });
      return session();
    },
  };
}
