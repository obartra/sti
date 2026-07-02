// @vitest-environment node
import { describe, it, expect } from "vitest";
import {
  serializeGroupBlob,
  parseGroupBlobForMember,
  parseGroupBlobWithKg,
  type GroupObject,
} from "./groupObject.ts";
import { mintGroupKey, wrapGroupKey, type MemberKey } from "./groupCrypto.ts";
import { GROUP_BLOB_SIZE } from "../api/contract.ts";

// A random 32-byte member wrapping key.
function memberKey(): MemberKey {
  return crypto.getRandomValues(new Uint8Array(32));
}

const obj: GroupObject = {
  handle: "book_club",
  visibility: "public",
  meetingKind: "recurring",
  adminCardId: "A".repeat(43),
  roster: [{ cardId: "A".repeat(43) }, { cardId: "B".repeat(43) }],
};

describe("group blob codec (doc 33)", () => {
  it("round-trips for the addressed member and for a Kg holder", async () => {
    const Kg = mintGroupKey();
    const mk = memberKey();
    const blob = await serializeGroupBlob(Kg, obj, [
      await wrapGroupKey(Kg, mk),
    ]);

    // A joining member trial-unwraps their entry to recover Kg and the object.
    const forMember = await parseGroupBlobForMember(blob, mk);
    expect(forMember).not.toBeNull();
    expect(forMember?.Kg).toEqual(Kg);
    expect(forMember?.obj).toEqual(obj);

    // A holder of Kg skips the wrapped keys and opens the core directly.
    expect(await parseGroupBlobWithKg(blob, Kg)).toEqual(obj);
  });

  it("is exactly GROUP_BLOB_SIZE bytes (padded, existence-uniform)", async () => {
    const Kg = mintGroupKey();
    const blob = await serializeGroupBlob(Kg, obj, [
      await wrapGroupKey(Kg, memberKey()),
    ]);
    expect(blob.length).toBe(GROUP_BLOB_SIZE);
  });

  it("fails closed to null for the wrong member key", async () => {
    const Kg = mintGroupKey();
    const blob = await serializeGroupBlob(Kg, obj, [
      await wrapGroupKey(Kg, memberKey()),
    ]);
    expect(await parseGroupBlobForMember(blob, memberKey())).toBeNull();
  });

  it("fails closed to null on a wrong Kg", async () => {
    const Kg = mintGroupKey();
    const blob = await serializeGroupBlob(Kg, obj, [
      await wrapGroupKey(Kg, memberKey()),
    ]);
    expect(await parseGroupBlobWithKg(blob, mintGroupKey())).toBeNull();
  });

  it("fails closed to null on a tampered byte", async () => {
    const Kg = mintGroupKey();
    const mk = memberKey();
    const blob = await serializeGroupBlob(Kg, obj, [
      await wrapGroupKey(Kg, mk),
    ]);
    // Flip the last byte (inside the core's GCM region), so both the member path
    // and the Kg-holder path see the corruption and fail closed.
    const view = new DataView(blob.buffer, blob.byteOffset, blob.byteLength);
    const idx = blob.length - 1;
    view.setUint8(idx, view.getUint8(idx) ^ 0xff);
    expect(await parseGroupBlobForMember(blob, mk)).toBeNull();
    expect(await parseGroupBlobWithKg(blob, Kg)).toBeNull();
  });

  it("fails closed to null on a wrong-size blob", async () => {
    const Kg = mintGroupKey();
    const mk = memberKey();
    const full = await serializeGroupBlob(Kg, obj, [
      await wrapGroupKey(Kg, mk),
    ]);
    const short = full.subarray(0, full.length - 1);
    expect(await parseGroupBlobForMember(short, mk)).toBeNull();
    expect(await parseGroupBlobWithKg(short, Kg)).toBeNull();
  });

  // Existence-uniformity: the server returns random decoy bytes on a miss (slice
  // 2). A decoy is the same size and shape as a real blob and simply opens to
  // nothing, so a reader cannot tell "no such group" from "not my group".
  it("treats a random decoy as an unopenable non-group", async () => {
    const decoy = crypto.getRandomValues(new Uint8Array(GROUP_BLOB_SIZE));
    expect(await parseGroupBlobForMember(decoy, memberKey())).toBeNull();
    expect(await parseGroupBlobWithKg(decoy, mintGroupKey())).toBeNull();
  });

  // Proves the format is slice-4-ready: a two-entry wrappedKeys array resolves for
  // BOTH members (each finds their own entry by trial) and null for a third.
  it("resolves a two-member blob for both members and null for a stranger", async () => {
    const Kg = mintGroupKey();
    const mk1 = memberKey();
    const mk2 = memberKey();
    const mk3 = memberKey();
    const blob = await serializeGroupBlob(Kg, obj, [
      await wrapGroupKey(Kg, mk1),
      await wrapGroupKey(Kg, mk2),
    ]);

    expect((await parseGroupBlobForMember(blob, mk1))?.Kg).toEqual(Kg);
    expect((await parseGroupBlobForMember(blob, mk2))?.Kg).toEqual(Kg);
    expect(await parseGroupBlobForMember(blob, mk3)).toBeNull();
  });
});
