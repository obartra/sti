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
import { ALIAS_PAYLOAD_SIZE } from "../api/contract.ts";
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
import type { AvatarConfig } from "../lib/avatars.ts";
import { normalizeVanityName, vanityNameError } from "./vanityName.ts";
import { deriveAliasCard, type AliasIdentity } from "./ownerCard.ts";
import {
  mintGroupKey,
  sealGroupCard,
  wrapGroupKey,
  type GroupKey,
} from "./groupCrypto.ts";
import { serializeGroupBlob, type GroupObject } from "./groupObject.ts";
import type { GroupVisibility, MeetingKind } from "./groupObject.ts";

/** The inputs a create takes (doc 33): the chosen handle, whether it is public,
 * the meeting kind that scopes a later notify, and the face the creator appears
 * under to fellow members (doc 33 "show as you"): `anonymous` (the default,
 * id-derived) or `main` (their account identity). Optional so callers that do not
 * offer the choice stay anonymous. */
export interface CreateGroupInput {
  readonly handle: string;
  readonly visibility: GroupVisibility;
  readonly meetingKind: MeetingKind;
  readonly identity?: AliasIdentity;
}

/** The face a group member's own card shows (doc 33 "show as you"): absent both
 * fields means anonymous (id-derived); a name and/or avatar means they chose to
 * appear as their main identity. */
export interface MemberFace {
  readonly handle?: string;
  readonly avatar?: AvatarConfig;
}

/**
 * Resolve the face a member appears under from their identity choice and account
 * (doc 33). `main` snapshots the account handle + avatar (so a later account edit
 * does not retroactively change what the group sees, mirroring a link's stored
 * face, doc 15); `anonymous` returns an empty face, leaving the card id-derived. A
 * nameless account showing itself still contributes its avatar, matching links.
 */
export function memberFace(
  identity: AliasIdentity,
  blob: { readonly handle?: string; readonly avatar: AvatarConfig },
): MemberFace {
  if (identity !== "main") return {};
  return {
    ...(blob.handle !== undefined ? { handle: blob.handle } : {}),
    avatar: blob.avatar,
  };
}

/**
 * The publish args for a member's own group card: its address plus their stored
 * shown face (doc 33), read straight off the group record. Used by the first-read
 * sync and the rotation republish so every republish shows the SAME face the member
 * chose, never silently reverting a revealed member to anonymous.
 */
export function ownCardPublish(
  group: GroupRecord,
): { cardId: string; cardWriteToken: string } & MemberFace {
  return {
    cardId: group.myCardId,
    cardWriteToken: group.myCardWriteToken,
    ...(group.myHandle !== undefined ? { handle: group.myHandle } : {}),
    ...(group.myAvatar !== undefined ? { avatar: group.myAvatar } : {}),
  };
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
// 33) UNLESS the member chose "show as you", in which case the stamped handle/avatar
// override it (resolveCardIdentity applies the same per-alias override as any link).
// The `key` here is unused (the card is sealed under Kg, not an alias key), so the
// card id doubles as a well-shaped placeholder.
function groupCardRecord(card: {
  cardId: string;
  cardWriteToken: string;
  handle?: string;
  avatar?: AvatarConfig;
}): AliasRecord {
  return {
    id: card.cardId,
    writeToken: card.cardWriteToken,
    key: card.cardId,
    isPublic: false,
    ...(card.handle !== undefined ? { handle: card.handle } : {}),
    ...(card.avatar !== undefined ? { avatar: card.avatar } : {}),
  };
}

/**
 * Publish a member's current status card as a group card, sealed under `Kg`, to
 * their group card id (byte-identical to an alias payload, so the same alias PUT).
 * Shared by create (the creator's card) and the membership ops (a joining member's
 * card, published on their first roster poll once they hold `Kg`). The optional
 * `handle`/`avatar` are the member's chosen shown face (doc 33 "show as you");
 * absent, the card stays anonymous (id-derived).
 */
export async function publishGroupCard(
  api: ApiClient,
  state: OwnerState,
  Kg: GroupKey,
  card: { cardId: string; cardWriteToken: string } & MemberFace,
): Promise<void> {
  const view = deriveAliasCard(state, groupCardRecord(card), todayEpochDay());
  await api.putAlias(
    card.cardId,
    await sealGroupCard(Kg, view),
    card.cardWriteToken,
  );
}

// Publish the creator's own group card at create time, under their chosen face.
async function publishCreatorCard(
  api: ApiClient,
  session: OwnerSession,
  mint: GroupMint,
  face: MemberFace,
): Promise<void> {
  await publishGroupCard(api, session.blob.state, mint.Kg, {
    cardId: mint.myCardId,
    cardWriteToken: mint.myCardWriteToken,
    ...face,
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

/**
 * Bind a write token at a group's join pointer (doc 33, slice 4b): a pure decoy PUT
 * under `writeToken`, so the server associates that capability with the pointer id.
 * Two things need it: the vanity claim, which is authorized by the write token of
 * the alias the name points at, and a later knockReview at the pointer, which 403s
 * without it. Idempotent and self-healing (a fresh decoy under the same token
 * re-binds it). The pointer stays keyless and statusless: the decoy is never a card,
 * so a resolver who navigates to it sees gray-nothing (doc 33); this only binds the
 * capability.
 */
export async function bindJoinPointer(
  api: ApiClient,
  pointerId: string,
  writeToken: string,
): Promise<void> {
  await api.putAlias(
    pointerId,
    crypto.getRandomValues(new Uint8Array(ALIAS_PAYLOAD_SIZE)),
    writeToken,
  );
}

// A public group claims its handle to a DEDICATED join pointer (not the group blob
// id, so the public handle stays unlinkable from the blob). A private group has no
// handle to claim. A non-registered outcome records no join pointer (the group is
// valid, private-until-named) and carries the reason back.
//
// The pointer is BOUND BEFORE the claim, and that order is load-bearing: the server
// authorizes a claim with the write token of the alias the name points at, so a
// claim aimed at an id that carries no capability yet is refused and the name is
// never registered. A bind that fails means the claim cannot be authorized, so it
// is reported as the claim failing rather than sent anyway.
async function claimGroupHandle(
  api: ApiClient,
  handle: string,
  visibility: GroupVisibility,
): Promise<HandleClaim> {
  if (visibility !== "public") return { result: "created" };
  const joinPointerId = randomAliasId();
  const joinWriteToken = randomWriteToken();
  const bound = await bindJoinPointer(api, joinPointerId, joinWriteToken).then(
    () => true,
    () => false,
  );
  if (!bound) return { result: "error" };
  const result = await api
    .registerVanityName(handle, joinPointerId, joinWriteToken)
    .catch((): VanityRegisterResult => "error");
  if (result !== "registered") return { result };
  return { result, joinPointerId, joinWriteToken };
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
  const face = memberFace(input.identity ?? "anonymous", session.blob);
  await publishCreatorCard(api, session, mint, face);
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
    ...(face.handle !== undefined ? { myHandle: face.handle } : {}),
    ...(face.avatar !== undefined ? { myAvatar: face.avatar } : {}),
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
