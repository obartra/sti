/**
 * The client-side crypto boundary. Plaintext goes in here and only ciphertext
 * (and opaque ids/tokens) comes out, so the api layer and the server never see
 * anything readable. See doc 11 for how this sits under the PassportStore.
 */

export {
  bytesToBase64url,
  base64urlToBytes,
  utf8ToBytes,
  bytesToUtf8,
  type Bytes,
} from "./encoding.ts";

export {
  importAesKey,
  seal,
  open,
  sealToSize,
  openSized,
  maxPlaintextForSize,
} from "./payload.ts";

export {
  randomAliasId,
  randomWriteToken,
  randomRecoveryPhrase,
  deriveMasterKey,
  deriveAccountId,
  deriveAccountKey,
} from "./keys.ts";
