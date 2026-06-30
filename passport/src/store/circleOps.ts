/**
 * Circle session helpers (doc 13 slice 6): turn a circle mutation on the account
 * manager into an updated owner session. A circle is a private, client-side
 * grouping of contacts; the server never learns one exists. Split out of session.ts
 * to keep that file within its length ceiling.
 */

import { MAX_CIRCLE_NAME, type CircleRecord } from "./accountBlob.ts";
import type { AccountManager } from "./account.ts";
import { randomAliasId } from "../crypto/index.ts";
import type { OwnerSession } from "./session.ts";

/** The created circle's id plus the updated session, so the caller can open it. */
export interface CircleCreated {
  readonly session: OwnerSession;
  readonly circleId: string;
}

// Create a circle: a fresh local id + the (capped) name + chosen members, which the
// account manager normalizes against current contacts. Purely client-side. Returns
// the new id so the caller opens THIS circle (not a same-named one, not a miss when
// the name was capped).
export async function addCircle(
  accounts: AccountManager,
  session: OwnerSession,
  name: string,
  memberContactIds: string[],
): Promise<CircleCreated> {
  const circleId = randomAliasId();
  const circle: CircleRecord = {
    id: circleId,
    name: name.slice(0, MAX_CIRCLE_NAME),
    memberContactIds,
  };
  const blob = await accounts.upsertCircle(session.root, circle);
  return { session: { root: session.root, blob }, circleId };
}

// Update an existing circle in place (same id): rename it and/or change its member
// set. Upserting by the given id replaces the record; members are re-normalized.
export async function editCircle(
  accounts: AccountManager,
  session: OwnerSession,
  edit: { circleId: string; name: string; memberContactIds: string[] },
): Promise<OwnerSession> {
  const circle: CircleRecord = {
    id: edit.circleId,
    name: edit.name.slice(0, MAX_CIRCLE_NAME),
    memberContactIds: edit.memberContactIds,
  };
  const blob = await accounts.upsertCircle(session.root, circle);
  return { root: session.root, blob };
}

// Drop one circle by id (a local grouping; the contacts themselves are untouched).
export async function dropCircle(
  accounts: AccountManager,
  session: OwnerSession,
  circleId: string,
): Promise<OwnerSession> {
  const blob = await accounts.removeCircle(session.root, circleId);
  return { root: session.root, blob };
}
