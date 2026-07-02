// On-read avatar migration for the account blob (doc 19). Avatars are cosmetic and
// their shape can change across versions, so a stored override avatar is never gated
// on parse: instead a bad or old-shape one is dropped here on read, and the record
// falls back to its id-derived avatar. This keeps a corrupt avatar from ever bricking
// an account. Split out of accountBlob so that file stays within its length ceiling;
// the records these operate on are defined there and imported type-only (no cycle).

import { isAvatarConfig, type AvatarConfig } from "../lib/avatars.ts";
import type { AliasRecord, ContactRecord, GroupRecord } from "./accountBlob.ts";

// Drop an alias override avatar that is not a valid current config (old-shape or
// corrupt), so the alias keeps every other field (handle, expiry, tokens) and just
// falls back to the id-derived avatar. Cosmetic-only, lossy on purpose (doc 19).
export function migrateAliasOverride(a: AliasRecord): AliasRecord {
  if (a.avatar === undefined || isAvatarConfig(a.avatar)) return a;
  const copy = { ...a };
  delete (copy as { avatar?: AvatarConfig }).avatar;
  return copy;
}

// A per-contact link carries the owner's alias (it can hold an avatar override
// when the owner revealed themselves), so its avatar migrates the same way.
export function migrateContactAvatar(c: ContactRecord): ContactRecord {
  const alias = migrateAliasOverride(c.alias);
  return alias === c.alias ? c : { ...c, alias };
}

// A group record can carry the member's shown-face avatar (doc 33 "show as you").
// It migrates like an alias override avatar: an old-shape or corrupt one is dropped
// so the card falls back to the id-derived avatar, never bricking the group (doc 19).
export function migrateGroupAvatar(g: GroupRecord): GroupRecord {
  if (g.myAvatar === undefined || isAvatarConfig(g.myAvatar)) return g;
  const copy = { ...g };
  delete (copy as { myAvatar?: AvatarConfig }).myAvatar;
  return copy;
}
