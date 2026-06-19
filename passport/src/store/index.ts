/**
 * The PassportStore boundary: the single seam the screens read through, plus the
 * public-card codec and the real (api + crypto) implementation. See doc 11.
 */

export type { AliasLink, PassportStore } from "./passportStore.ts";
export { createBackendStore } from "./backendStore.ts";
export { serializePublicCard, parsePublicCard } from "./publicCard.ts";
export { parseAliasLink } from "./aliasLink.ts";
export type { AccountSync } from "./accountSync.ts";
export { createAccountSync } from "./accountSync.ts";
export type { AccountBlob, AliasRecord } from "./accountBlob.ts";
export { serializeAccountBlob, parseAccountBlob } from "./accountBlob.ts";
