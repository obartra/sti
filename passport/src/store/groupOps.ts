/**
 * The owner's shared-group operations (doc 33, slice 3): create a group. Like the
 * other owner ops (findableOps, shareOps) this is a free function over the api +
 * account manager, called by the session controller's thin method wrapper.
 *
 * Creating a group mints the shared key `Kg`, publishes the creator's own status
 * card sealed under `Kg` to an opaque card id (unlinkable to their other aliases,
 * doc 33 decorrelation-from-non-members), writes the group blob, and, if the group
 * is public, claims the handle so it resolves like a findable name (doc 17) to a
 * DEDICATED join pointer that is unlinkable from the group blob id. In v1 the
 * creator is the sole admin and the only member; invite / accept / remove /
 * rotation are later slices.
 *
 * Ordering is fail-safe: publish the card and write the blob BEFORE claiming the
 * handle, so a handle-claim failure still leaves a usable group. Unlike a findable
 * name, a failed public handle here does NOT tear the group down: it is a valid
 * private-until-named group, and the outcome tells the caller the handle was not
 * claimed.
 */

import type { ApiClient, VanityRegisterResult } from "../api/client.ts";
import type { AccountManager } from "./account.ts";
import type { AliasRecord, GroupRecord } from "./accountBlob.ts";
import type { OwnerSession } from "./session.ts";
import {
  bytesToBase64url,
  deriveGroupMemberKey,
  randomAliasId,
  randomWriteToken,
  type RootKey,
} from "../crypto/index.ts";
import { todayEpochDay } from "../core/clock.ts";
import type { OwnerState } from "../core/badge.ts";
import { normalizeVanityName, vanityNameError } from "./vanityName.ts";
import { deriveAliasCard } from "./ownerCard.ts";
import {
  mintGroupKey,
  sealGroupCard,
  wrapGroupKey,
  type GroupKey,
} from "./groupCrypto.ts";
import { serializeGroupBlob, type GroupObject } from "./groupObject.ts";
import type { GroupVisibility, MeetingKind } from "./groupObject.ts";

/** The inputs a create takes (doc 33): the chosen handle, whether it is public,
 * and the meeting kind that scopes a later notify. */
export interface CreateGroupInput {
  readonly handle: string;
  readonly visibility: GroupVisibility;
  readonly meetingKind: MeetingKind;
}

/**
 * How a create resolved:
 * - `created`: a private group (no public handle to claim).
 * - `registered`: a public group whose handle was claimed.
 * - `unavailable` / `error`: a public group whose handle was taken/reserved/blocked
 *   or failed to claim. The group still exists (private-until-named); the caller can
 *   surface the outcome and let the owner retry the handle later.
 */
export type CreateGroupResult = "created" | VanityRegisterResult; // "registered" | "unavailable" | "error"

/** The session after a create plus what happened. */
export interface GroupCreated {
  readonly session: OwnerSession;
  readonly groupId: string;
  readonly handle: string;
  readonly result: CreateGroupResult;
}

// The freshly minted capabilities for one group: the shared key and the two
// (id, write-token) pairs for the group blob and the creator's own card. Bundled
// so the create helpers pass one value instead of a long parameter list.
interface GroupMint {
  readonly Kg: GroupKey;
  readonly groupId: string;
  readonly groupWriteToken: string;
  readonly myCardId: string;
  readonly myCardWriteToken: string;
}

function mintGroup(): GroupMint {
  return {
    Kg: mintGroupKey(),
    groupId: randomAliasId(),
    groupWriteToken: randomWriteToken(),
    myCardId: randomAliasId(),
    myCardWriteToken: randomWriteToken(),
  };
}

// A group card is byte-identical to an alias payload but sealed under Kg, so it is
// PUT with the low-level alias write. Its display face is id-derived (anonymous, doc
// 33): built from the card id alone, so it is unlinkable to the owner's other
// aliases. The `key` here is unused (the card is sealed under Kg, not an alias key),
// so the card id doubles as a well-shaped placeholder.
function anonymousGroupCardRecord(
  cardId: string,
  writeToken: string,
): AliasRecord {
  return { id: cardId, writeToken, key: cardId, isPublic: false };
}

/**
 * Publish a member's current status card as a group card, sealed under `Kg`, to
 * their group card id (byte-identical to an alias payload, so the same alias PUT).
 * Shared by create (the creator's card) and the membership ops (a joining member's
 * card, published on their first roster poll once they hold `Kg`).
 */
export async function publishGroupCard(
  api: ApiClient,
  state: OwnerState,
  Kg: GroupKey,
  card: { cardId: string; cardWriteToken: string },
): Promise<void> {
  const view = deriveAliasCard(
    state,
    anonymousGroupCardRecord(card.cardId, card.cardWriteToken),
    todayEpochDay(),
  );
  await api.putAlias(
    card.cardId,
    await sealGroupCard(Kg, view),
    card.cardWriteToken,
  );
}

// Publish the creator's own group card at create time.
async function publishCreatorCard(
  api: ApiClient,
  session: OwnerSession,
  mint: GroupMint,
): Promise<void> {
  await publishGroupCard(api, session.blob.state, mint.Kg, {
    cardId: mint.myCardId,
    cardWriteToken: mint.myCardWriteToken,
  });
}

// Write the group blob: the group object sealed under Kg, plus the creator's
// wrapped-Kg entry (their own member key, derived from the root).
async function writeGroupBlob(
  api: ApiClient,
  root: RootKey,
  obj: GroupObject,
  mint: GroupMint,
): Promise<void> {
  const memberKey = await deriveGroupMemberKey(root, mint.groupId);
  const bytes = await serializeGroupBlob(mint.Kg, obj, [
    await wrapGroupKey(mint.Kg, memberKey),
  ]);
  await api.putGroupBlob(mint.groupId, bytes, mint.groupWriteToken);
}

// The outcome of claiming the public handle, plus the dedicated join pointer when
// (and only when) it was actually claimed.
interface HandleClaim {
  readonly result: CreateGroupResult;
  readonly joinPointerId?: string;
  readonly joinWriteToken?: string;
}

// A public group claims its handle to a DEDICATED join pointer (not the group blob
// id, so the public handle stays unlinkable from the blob). A private group has no
// handle to claim. A non-registered outcome records no join pointer (the group is
// valid, private-until-named) and carries the reason back.
async function claimGroupHandle(
  api: ApiClient,
  handle: string,
  visibility: GroupVisibility,
): Promise<HandleClaim> {
  if (visibility !== "public") return { result: "created" };
  const joinPointerId = randomAliasId();
  const joinWriteToken = randomWriteToken();
  const result = await api
    .registerVanityName(handle, joinPointerId, joinWriteToken)
    .catch((): VanityRegisterResult => "error");
  return result === "registered"
    ? { result, joinPointerId, joinWriteToken }
    : { result };
}

/**
 * Create a shared group. `input.handle` is normalized + validated against the
 * vanity-name rules and rejected (throws) before any network call, so an invalid
 * handle never mints keys or writes a blob. Ordering is fail-safe: the card and the
 * blob are written BEFORE the handle is claimed, so a claim failure still leaves a
 * usable group.
 */
export async function createGroup(
  api: ApiClient,
  accounts: AccountManager,
  session: OwnerSession,
  input: CreateGroupInput,
): Promise<GroupCreated> {
  const handle = normalizeVanityName(input.handle);
  const nameError = vanityNameError(handle);
  if (nameError !== null) {
    throw new Error(`createGroup: invalid handle (${nameError})`);
  }
  const mint = mintGroup();
  await publishCreatorCard(api, session, mint);
  const obj: GroupObject = {
    handle,
    visibility: input.visibility,
    meetingKind: input.meetingKind,
    adminCardId: mint.myCardId,
    roster: [{ cardId: mint.myCardId }],
  };
  await writeGroupBlob(api, session.root, obj, mint);
  const claim = await claimGroupHandle(api, handle, input.visibility);
  const group: GroupRecord = {
    groupId: mint.groupId,
    groupWriteToken: mint.groupWriteToken,
    kg: bytesToBase64url(mint.Kg),
    myCardId: mint.myCardId,
    myCardWriteToken: mint.myCardWriteToken,
    handle,
    visibility: input.visibility,
    meetingKind: input.meetingKind,
    isAdmin: true,
    ...(claim.joinPointerId !== undefined
      ? { joinPointerId: claim.joinPointerId }
      : {}),
    ...(claim.joinWriteToken !== undefined
      ? { joinWriteToken: claim.joinWriteToken }
      : {}),
  };
  const blob = await accounts.recordGroup(session.root, group);
  return {
    session: { root: session.root, blob },
    groupId: mint.groupId,
    handle,
    result: claim.result,
  };
}
