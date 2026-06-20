/**
 * The owner's app session: the composition that onboarding, login, recovery, and
 * reload drive. It ties the account lifecycle (AccountManager, on AccountSync) to
 * the two key sources, with the recovery PHRASE as the root and a passkey as an
 * optional SECOND credential over the same account.
 *
 * Recovery model (locked, doc 11): an account is always created from a generated
 * phrase, so it is always phrase-recoverable. enrollPasskey wraps the existing
 * master under the passkey's PRF output and stores `{ credentialId, wrappedMaster }`
 * locally; resume() unwraps it on reload. There is no path that creates an account
 * from a passkey alone, so a passkey loss can never lock the owner out.
 *
 * The session carries the master in memory (needed to mutate owner state); it is
 * never persisted. Reload without an enrolled passkey returns null here, and the
 * owner re-enters the phrase.
 */

import {
  bytesToBase64url,
  base64urlToBytes,
  type Bytes,
} from "../crypto/index.ts";
import { wrapMaster, unwrapMaster } from "../auth/keyVault.ts";
import type { PasskeyAuth } from "../auth/passkey.ts";
import type { DeviceStore } from "../auth/deviceStore.ts";
import type { ApiClient } from "../api/client.ts";
import type { AccountManager, OwnerProfile } from "./account.ts";
import type { AccountSync } from "./accountSync.ts";
import type { AccountBlob } from "./accountBlob.ts";
import type { OwnerState } from "../core/badge.ts";
import { deriveOwnerCard } from "./ownerCard.ts";
import { todayEpochDay } from "../core/clock.ts";
import {
  publishCard,
  republishCard,
  revokeAlias,
  aliasLinkUrl,
} from "./publish.ts";

/** An unlocked session: the master (in memory only) and the loaded account. */
export interface OwnerSession {
  readonly master: Bytes;
  readonly blob: AccountBlob;
}

export interface SignUpResult {
  readonly session: OwnerSession;
  /** Shown once at signup; the only way back in. Never persisted. */
  readonly recoveryPhrase: string;
}

export interface SessionController {
  /** First run: mint a phrase-recoverable account. Persists nothing locally. */
  signUp(handle: string): Promise<SignUpResult>;
  /** Login / recovery by phrase. null when no account exists for it. */
  recover(phrase: string): Promise<OwnerSession | null>;
  /**
   * Reload: unlock via the enrolled passkey and load the account. null when no
   * passkey is enrolled on this device, the passkey is cancelled/unavailable, or
   * the binding does not unwrap (fail-closed; the device binding is left intact).
   */
  resume(): Promise<OwnerSession | null>;
  /**
   * Bind a passkey to the current session so reload can resume without the
   * phrase. Stores only `{ credentialId, wrappedMaster }`.
   */
  enrollPasskey(session: OwnerSession, userName: string): Promise<void>;
  /**
   * Persist a profile change (avatar + sharing default) and return the session
   * with the updated account blob.
   */
  setProfile(
    session: OwnerSession,
    profile: OwnerProfile,
  ): Promise<OwnerSession>;
  /**
   * Persist a new owner state (a reported result, a pause), republish every
   * alias so the badge propagates, and return the session with the updated blob.
   */
  setOwnerState(
    session: OwnerSession,
    state: OwnerState,
  ): Promise<OwnerSession>;
  /**
   * Produce a shareable link to the owner's current card. Reuses the account's
   * primary alias (republishing the current card to it so the link stays fresh)
   * or mints one on first share and records it. Returns the (possibly updated)
   * session and the URL.
   */
  shareLink(session: OwnerSession): Promise<ShareLinkResult>;
  /**
   * Revoke the link for the current sharing mode (the old URL stops resolving to
   * any status) and mint a fresh one for the same card. "Revoke" is no future
   * reads, not "unsee" (doc 01). Returns the updated session and the new URL. A
   * no-op-with-mint when no alias exists yet (just produces a first link).
   */
  renewLink(session: OwnerSession): Promise<ShareLinkResult>;
  /** Forget this device's passkey binding. The phrase still recovers. */
  forget(): void;
}

export interface ShareLinkResult {
  readonly session: OwnerSession;
  readonly url: string;
}

export interface SessionDeps {
  readonly accounts: AccountManager;
  readonly sync: AccountSync;
  readonly devices: DeviceStore;
  readonly passkey: PasskeyAuth;
  /** Transport for publishing/republishing the owner's shareable alias. */
  readonly api: ApiClient;
}

export function createSessionController(deps: SessionDeps): SessionController {
  const { accounts, sync, devices, passkey, api } = deps;

  // Produce a link for the owner's current sharing mode. Shared by shareLink and
  // renewLink (a free function, not a `this` method, so it survives destructuring
  // of the controller). One alias per visibility: reuse the alias whose
  // visibility matches the CURRENT sharing mode (republishing the current card so
  // an already-shared link reflects the latest badge), or mint one on first share
  // in this mode. Selecting by visibility, not array position, keeps the link's
  // key-presence aligned with the mode the sheet shows: a public link carries the
  // AES key in its `#k=` fragment, a private link never does. Reusing by position
  // would otherwise hand out a key-bearing URL under a "private link" sheet after
  // a public -> link switch.
  async function shareLinkFor(session: OwnerSession): Promise<ShareLinkResult> {
    const card = deriveOwnerCard(
      session.blob.state,
      session.blob.handle,
      todayEpochDay(),
    );
    const wantPublic = session.blob.sharingMode === "public";
    const existing = session.blob.aliases.find(
      (a) => a.isPublic === wantPublic,
    );
    if (existing !== undefined) {
      await republishCard(api, existing, card);
      return { session, url: aliasLinkUrl(existing) };
    }
    const { link, record } = await publishCard(api, card, {
      isPublic: wantPublic,
    });
    const blob = await accounts.addAlias(session.master, record);
    return { session: { master: session.master, blob }, url: link };
  }

  return {
    async signUp(handle) {
      const created = await accounts.create(handle);
      return {
        session: { master: created.master, blob: created.blob },
        recoveryPhrase: created.recoveryPhrase,
      };
    },

    async recover(phrase) {
      const recovered = await accounts.recover(phrase);
      return recovered === null
        ? null
        : { master: recovered.master, blob: recovered.blob };
    },

    async resume() {
      const cred = devices.load();
      if (cred === null) return null;

      let prfOutput: Bytes;
      try {
        prfOutput = await passkey.unlock(cred.credentialId);
      } catch {
        // Cancelled, unavailable, or unknown credential: fall back to the phrase.
        return null;
      }

      let master: Bytes;
      try {
        master = await unwrapMaster(
          base64urlToBytes(cred.wrappedMaster),
          prfOutput,
        );
      } catch {
        // Wrong passkey or corrupt binding: GCM rejects. Leave the binding in
        // place (a later correct unlock still works) and fall back to the phrase.
        return null;
      }

      const blob = await sync.load(master);
      return blob === null ? null : { master, blob };
    },

    async enrollPasskey(session, userName) {
      const { credentialId, prfOutput } = await passkey.enroll(userName);
      const wrapped = await wrapMaster(session.master, prfOutput);
      devices.save({
        credentialId,
        wrappedMaster: bytesToBase64url(wrapped),
      });
    },

    async setProfile(session, profile) {
      const blob = await accounts.setProfile(session.master, profile);
      return { master: session.master, blob };
    },

    async setOwnerState(session, state) {
      const blob = await accounts.setOwnerState(session.master, state);
      return { master: session.master, blob };
    },

    shareLink(session) {
      return shareLinkFor(session);
    },

    async renewLink(session) {
      const wantPublic = session.blob.sharingMode === "public";
      const existing = session.blob.aliases.find(
        (a) => a.isPublic === wantPublic,
      );
      let working = session;
      if (existing !== undefined) {
        // Kill the old payload first, then drop the record. Order matters: if the
        // record were dropped first and the revoke then failed, the old link would
        // keep resolving with no capability left to revoke it.
        await revokeAlias(api, existing);
        const blob = await accounts.removeAlias(session.master, existing.id);
        working = { master: session.master, blob };
      }
      // Mint a fresh link for the current card (this is now the only alias for
      // the mode, since the old record is gone).
      return shareLinkFor(working);
    },

    forget() {
      devices.clear();
    },
  };
}
