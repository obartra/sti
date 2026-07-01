/**
 * The PassportStore boundary: the single seam the screens read through, plus the
 * public-card codec and the real (api + crypto) implementation. See doc 11.
 */

export type { AliasLink, PassportStore } from "./passportStore.ts";
export { createBackendStore } from "./backendStore.ts";
export {
  createRequesterStore,
  browserRequesterSecret,
  browserForgetRequesterSecret,
} from "./requesterStore.ts";
export {
  createGrantKeyStore,
  browserGrantKeyStore,
  browserForgetGrantKeys,
  type GrantKeyStore,
} from "./grantKeyStore.ts";
export {
  createPendingKnockStore,
  browserPendingKnockStore,
  browserForgetPendingKnocks,
  type PendingKnockStore,
  type PendingKnock,
} from "./pendingKnockStore.ts";
export { serializePublicCard, parsePublicCard } from "./publicCard.ts";
export { parseAliasLink, parseScannedLink } from "./aliasLink.ts";
export {
  normalizeVanityName,
  vanityNameError,
  isValidVanityName,
  RESERVED_NAMES,
  MIN_VANITY_LEN,
  MAX_VANITY_LEN,
  type VanityNameError,
} from "./vanityName.ts";
export type { AccountSync } from "./accountSync.ts";
export { createAccountSync } from "./accountSync.ts";
export { createLocalBlobStore } from "./localBlobStore.ts";
export {
  createSyncStatus,
  browserSyncStorage,
  type SyncStatus,
} from "./syncStatus.ts";
export {
  createOfflineAccountSync,
  type OfflineAccountSync,
} from "./offlineSync.ts";
export type {
  AccountBlob,
  AliasRecord,
  ContactRecord,
  CircleRecord,
  FindableRegistration,
  StatusAlias,
  SharingMode,
} from "./accountBlob.ts";
export {
  contactInviteUrl,
  parseContactInvite,
  type ContactInvite,
} from "./contactInvite.ts";
export { normalizeCircleMembers } from "./circles.ts";
export {
  serializeAccountBlob,
  parseAccountBlob,
  isSharingMode,
} from "./accountBlob.ts";
export type { OwnerView } from "./ownerView.ts";
export { deriveOwnerView } from "./ownerView.ts";
export type { PublishedAlias } from "./publish.ts";
export {
  publishCard,
  republishCard,
  aliasLinkUrl,
  keyedAliasLinkUrl,
} from "./publish.ts";
export type {
  AccountManager,
  NewAccount,
  RecoveredAccount,
  OwnerProfile,
} from "./account.ts";
export { createAccountManager } from "./account.ts";
export {
  deriveOwnerCard,
  deriveAliasCard,
  resolveCardIdentity,
  withIdentity,
  republishOwnerCard,
  type AliasIdentity,
} from "./ownerCard.ts";
export { knock, requesterHash } from "./knock.ts";
export {
  mintInbox,
  mintNotify,
  writePing,
  pollInbox,
  type InboxCapability,
  type NotifyCapability,
} from "./notifyInbox.ts";
export {
  composeNotifyDraft,
  lockNotifyDraft,
  encodePartnerPing,
  parsePartnerPing,
  NOTIFY_DEFAULT_LOOKBACK_DAYS,
  type NotifyDraft,
  type NotifyDraftEntry,
  type NotifyLockResult,
  type PartnerPing,
} from "./partnerNotify.ts";
export { deriveGrantSlotId, grantAccess, redeemGrant } from "./grant.ts";
export type {
  OwnerSession,
  SignUpResult,
  SessionController,
  SessionDeps,
  ShareLinkResult,
  ContactLinkResult,
  PendingApproval,
  OwnerKnocks,
  ResumeResult,
  ResumeFailure,
} from "./session.ts";
export { createSessionController } from "./session.ts";
export {
  primaryShareAlias,
  registerVanityName,
  releaseVanityName,
  type VanityRegisterOutcome,
} from "./findableOps.ts";
