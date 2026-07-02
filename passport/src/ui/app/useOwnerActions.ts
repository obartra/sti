import { useCallback, type RefObject } from "react";
import type {
  AliasIdentity,
  ContactInvite,
  ContactLinkResult,
  CreateGroupInput,
  CreateGroupResult,
  OwnerProfile,
  OwnerSession,
  RosterMemberView,
  SessionController,
} from "../../store/index.ts";
import type { VanityRegisterResult } from "../../api/client.ts";
import type {
  SetRecoveryPasswordInput,
  SetRecoveryPasswordOutcome,
} from "../../store/recoveryOps.ts";
import type { AvatarConfig } from "../../lib/avatars.ts";
import { disablePush } from "../../store/push.ts";
import {
  browserForgetRequesterSecret,
  browserForgetGrantKeys,
  browserForgetPendingKnocks,
  browserForgetGroupJoins,
} from "../../store/index.ts";

export interface OwnerActions {
  /** Permanently delete the account and log out (clamps to the landing). */
  onDeleteAccount: () => void;
  /** Persist a new account-wide avatar (keeps the current sharing mode). */
  onSetAvatar: (avatar: AvatarConfig) => void;
  /** Persist the owner's local display name (keeps avatar + sharing mode); pass
   * null to clear it back to no name. Owner-facing only, never sent to a viewer. */
  onSetName: (name: string | null) => void;
  /** Mint a new per-contact link with a face (anonymous, or the owner's name);
   * resolves with the contact + URL. The link is durable until revoked. */
  onCreateContactLink: (
    label: string,
    identity: AliasIdentity,
  ) => Promise<ContactLinkResult>;
  /** Rename one contact link's local label (owner-only nickname; never shared). */
  onRenameContact: (id: string, label: string) => void;
  /** Revoke one contact link by id. */
  onRevokeContact: (id: string) => void;
  /** Revoke one published alias (public/casual link) by id. */
  onRevokeAlias: (id: string) => void;
  /** Accept a contact invite; resolves with the return invite to send back.
   * The accepter can reveal their name (identity "main") and pick a per-link face
   * (avatarOverride), mirroring the inviter's own choice; both default to anonymous. */
  onAcceptContactInvite: (
    invite: ContactInvite,
    label: string,
    identity?: AliasIdentity,
    avatarOverride?: AvatarConfig,
  ) => Promise<ContactLinkResult>;
  /** Ingest a return invite, completing the matching pending contact (no-op if none). */
  onIngestContactReturn: (ret: ContactInvite) => void;
  /** Create a shared group (doc 33); resolves the outcome + new group id so the
   * form can navigate on success, or show a taken-name message. Folds the session. */
  onCreateGroup: (
    input: CreateGroupInput,
  ) => Promise<{ result: CreateGroupResult; groupId: string }>;
  /** Read a group's roster on open; folds the returned session (a member's first
   * read caches the shared key and publishes their own card). */
  onReadGroupRoster: (groupId: string) => Promise<RosterMemberView[]>;
  /** Leave a group (member self-exit); folds the session. */
  onLeaveGroup: (groupId: string) => void;
  /** Disband a group the owner admins (teardown for everyone); folds the session. */
  onDeleteGroup: (groupId: string) => void;
  /** Claim a public findable name; resolves with the outcome (the form shows it). */
  onRegisterVanityName: (name: string) => Promise<VanityRegisterResult>;
  /** Check if a findable name is free as the owner types (no claim). */
  onCheckVanityName: (name: string) => Promise<"free" | "taken" | "error">;
  /** Release the owner's claimed findable name (no-op if none). */
  onReleaseVanityName: () => Promise<void>;
  /** Turn the password factor on (or change it, doc 32); resolves with the outcome
   * the Settings card shows (set / wrong phrase / taken name / weak / error). */
  onSetRecoveryPassword: (
    input: SetRecoveryPasswordInput,
  ) => Promise<SetRecoveryPasswordOutcome>;
  /** Turn the password factor off (a no-op when none is set). */
  onDisableRecoveryPassword: () => Promise<void>;
}

/**
 * Owner-state mutations that delete or reshape the account: account deletion and
 * per-contact link create/revoke. Each reads the latest session from the ref and
 * folds the controller's result back into the session (optimistic where it can
 * be), so App stays a thin host. A no-op while logged out.
 *
 * NOTE: these read sessionRef.current before an await and write the result back,
 * so a concurrent edit landing during the await is last-write-wins in memory
 * (single-device, modal UI makes this rare, and the next account sync reconciles).
 */
export function useOwnerActions(
  controller: SessionController,
  sessionRef: RefObject<OwnerSession | null>,
  setSession: (s: OwnerSession | null) => void,
): OwnerActions {
  const onDeleteAccount = useCallback(() => {
    const current = sessionRef.current;
    if (current === null) return;
    sessionRef.current = null;
    setSession(null);
    void controller.deleteAccount(current).catch(() => undefined);
    // Also forget this device's push context so the deleted account's notify
    // capability does not linger at rest in IndexedDB (best-effort, never throws).
    void disablePush();
    // And wipe this device's viewer secrets (the requester secret, any grant
    // keypairs, and the pending-requests list), so leaving the device clears the
    // traces of which aliases it knocked or asked to see. Best-effort; each no-ops
    // when nothing was persisted.
    browserForgetRequesterSecret();
    browserForgetGrantKeys();
    browserForgetPendingKnocks();
    browserForgetGroupJoins();
  }, [controller, sessionRef, setSession]);

  const profile = useProfileActions(controller, sessionRef, setSession);

  const onCreateContactLink = useCallback(
    async (label: string, identity: AliasIdentity) => {
      const current = sessionRef.current;
      if (current === null) throw new Error("not signed in");
      const result = await controller.createContactLink(
        current,
        label,
        identity,
      );
      sessionRef.current = result.session;
      setSession(result.session);
      return result;
    },
    [controller, sessionRef, setSession],
  );

  const contact = useContactActions(controller, sessionRef, setSession);

  const onRevokeAlias = useCallback(
    (id: string) => {
      const current = sessionRef.current;
      if (current === null) return;
      void controller
        .revokeAlias(current, id)
        .then((updated) => {
          sessionRef.current = updated;
          setSession(updated);
        })
        .catch(() => undefined);
    },
    [controller, sessionRef, setSession],
  );

  const onAcceptContactInvite = useCallback(
    async (
      invite: ContactInvite,
      label: string,
      identity?: AliasIdentity,
      avatarOverride?: AvatarConfig,
    ) => {
      const current = sessionRef.current;
      if (current === null) throw new Error("not signed in");
      const result = await controller.acceptContactInvite(
        current,
        invite,
        label,
        {
          identity: identity ?? "anonymous",
          avatarOverride,
        },
      );
      sessionRef.current = result.session;
      setSession(result.session);
      return result;
    },
    [controller, sessionRef, setSession],
  );

  const onIngestContactReturn = useCallback(
    (ret: ContactInvite) => {
      const current = sessionRef.current;
      if (current === null) return;
      void controller
        .ingestContactReturn(current, ret)
        .then((updated) => {
          sessionRef.current = updated;
          setSession(updated);
        })
        .catch(() => undefined);
    },
    [controller, sessionRef, setSession],
  );

  const group = useGroupActions(controller, sessionRef, setSession);
  const findable = useFindableActions(controller, sessionRef, setSession);
  const recovery = useRecoveryActions(controller, sessionRef, setSession);

  return {
    onDeleteAccount,
    onCreateContactLink,
    onRevokeAlias,
    onAcceptContactInvite,
    onIngestContactReturn,
    ...contact,
    ...profile,
    ...group,
    ...findable,
    ...recovery,
  };
}

// The fire-and-fold per-contact link mutations (rename / revoke / set lifetime),
// split out so useOwnerActions stays within its length ceiling. Each reads the
// latest session, runs the controller op, and folds the result back; a no-op while
// logged out, and a failure leaves the session as-is.
function useContactActions(
  controller: SessionController,
  sessionRef: RefObject<OwnerSession | null>,
  setSession: (s: OwnerSession | null) => void,
): Pick<OwnerActions, "onRenameContact" | "onRevokeContact"> {
  const onRenameContact = useCallback(
    (id: string, label: string) => {
      const current = sessionRef.current;
      if (current === null) return;
      void controller
        .renameContact(current, id, label)
        .then((updated) => {
          sessionRef.current = updated;
          setSession(updated);
        })
        .catch(() => undefined);
    },
    [controller, sessionRef, setSession],
  );

  const onRevokeContact = useCallback(
    (id: string) => {
      const current = sessionRef.current;
      if (current === null) return;
      void controller
        .revokeContact(current, id)
        .then((updated) => {
          sessionRef.current = updated;
          setSession(updated);
        })
        .catch(() => undefined);
    },
    [controller, sessionRef, setSession],
  );

  return { onRenameContact, onRevokeContact };
}

// The findable (vanity-name) mutations (claim / release), split out so
// useOwnerActions stays within its length ceiling. The claim returns its outcome so
// the form can show "taken"/"try again"; both fold the resulting session.
function useFindableActions(
  controller: SessionController,
  sessionRef: RefObject<OwnerSession | null>,
  setSession: (s: OwnerSession | null) => void,
): Pick<
  OwnerActions,
  "onRegisterVanityName" | "onCheckVanityName" | "onReleaseVanityName"
> {
  const onCheckVanityName = useCallback(
    (name: string) => controller.checkVanityName(name),
    [controller],
  );
  const onRegisterVanityName = useCallback(
    async (name: string): Promise<VanityRegisterResult> => {
      const current = sessionRef.current;
      if (current === null) return "error";
      const { session, result } = await controller.registerVanityName(
        current,
        name,
      );
      sessionRef.current = session;
      setSession(session);
      return result;
    },
    [controller, sessionRef, setSession],
  );

  const onReleaseVanityName = useCallback(async (): Promise<void> => {
    const current = sessionRef.current;
    if (current === null) return;
    const updated = await controller.releaseVanityName(current);
    sessionRef.current = updated;
    setSession(updated);
  }, [controller, sessionRef, setSession]);

  return { onRegisterVanityName, onCheckVanityName, onReleaseVanityName };
}

// The recovery-password mutations (turn on/off, doc 32), split out like the findable
// ones. onSetRecoveryPassword folds the resulting session (the blob now carries the
// recovery name) and returns the outcome for the card; onDisable folds the cleared one.
function useRecoveryActions(
  controller: SessionController,
  sessionRef: RefObject<OwnerSession | null>,
  setSession: (s: OwnerSession | null) => void,
): Pick<OwnerActions, "onSetRecoveryPassword" | "onDisableRecoveryPassword"> {
  const onSetRecoveryPassword = useCallback(
    async (
      input: SetRecoveryPasswordInput,
    ): Promise<SetRecoveryPasswordOutcome> => {
      const current = sessionRef.current;
      if (current === null) return "error";
      const { session, outcome } = await controller.setRecoveryPassword(
        current,
        input,
      );
      sessionRef.current = session;
      setSession(session);
      return outcome;
    },
    [controller, sessionRef, setSession],
  );

  const onDisableRecoveryPassword = useCallback(async (): Promise<void> => {
    const current = sessionRef.current;
    if (current === null) return;
    const updated = await controller.disableRecoveryPassword(current);
    sessionRef.current = updated;
    setSession(updated);
  }, [controller, sessionRef, setSession]);

  return { onSetRecoveryPassword, onDisableRecoveryPassword };
}

// The profile mutation (avatar today), split out so useOwnerActions stays within
// its length ceiling. Same fold-result-into-session shape as the rest.
function useProfileActions(
  controller: SessionController,
  sessionRef: RefObject<OwnerSession | null>,
  setSession: (s: OwnerSession | null) => void,
): Pick<OwnerActions, "onSetAvatar" | "onSetName"> {
  // Persist a profile edit and fold the re-sealed blob back into the session.
  // setProfile leaves any field the profile omits unchanged (doc 15), so each
  // editor passes only what it touches.
  const persist = useCallback(
    (profile: OwnerProfile) => {
      const current = sessionRef.current;
      if (current === null) return;
      void controller
        .setProfile(current, profile)
        .then((updated) => {
          sessionRef.current = updated;
          setSession(updated);
        })
        .catch(() => undefined);
    },
    [controller, sessionRef, setSession],
  );
  const onSetAvatar = useCallback(
    (avatar: AvatarConfig) => {
      const current = sessionRef.current;
      if (current === null) return;
      // Keep the current sharing mode; only the avatar changes.
      persist({ avatar, sharingMode: current.blob.sharingMode });
    },
    [persist, sessionRef],
  );
  const onSetName = useCallback(
    (name: string | null) => {
      const current = sessionRef.current;
      if (current === null) return;
      // Keep avatar + sharing mode; only the local display name changes.
      persist({
        avatar: current.blob.avatar,
        sharingMode: current.blob.sharingMode,
        handle: name,
      });
    },
    [persist, sessionRef],
  );
  return { onSetAvatar, onSetName };
}

// The shared-group mutations (doc 33: create / read roster / leave / disband),
// split out so useOwnerActions stays within its length ceiling. Same read-ref,
// run-controller, fold-result-into-session shape as the rest. createGroup and
// readGroupRoster resolve a value the caller needs (the outcome + id, and the
// roster), so they surface it; leave and disband are fire-and-fold.
function useGroupActions(
  controller: SessionController,
  sessionRef: RefObject<OwnerSession | null>,
  setSession: (s: OwnerSession | null) => void,
): Pick<
  OwnerActions,
  "onCreateGroup" | "onReadGroupRoster" | "onLeaveGroup" | "onDeleteGroup"
> {
  const onCreateGroup = useCallback(
    async (input: CreateGroupInput) => {
      const current = sessionRef.current;
      if (current === null) throw new Error("not signed in");
      const { session, groupId, result } = await controller.createGroup(
        current,
        input,
      );
      sessionRef.current = session;
      setSession(session);
      return { result, groupId };
    },
    [controller, sessionRef, setSession],
  );

  const onReadGroupRoster = useCallback(
    async (groupId: string) => {
      const current = sessionRef.current;
      if (current === null) return [];
      // readGroupRoster folds the session (a member's first read caches the shared
      // key and publishes their own card, a persistence side effect we must keep).
      const { session, members } = await controller.readGroupRoster(
        current,
        groupId,
      );
      sessionRef.current = session;
      setSession(session);
      return members;
    },
    [controller, sessionRef, setSession],
  );

  const onLeaveGroup = useCallback(
    (groupId: string) => {
      const current = sessionRef.current;
      if (current === null) return;
      void controller
        .leaveGroup(current, groupId)
        .then((updated) => {
          sessionRef.current = updated;
          setSession(updated);
        })
        .catch(() => undefined);
    },
    [controller, sessionRef, setSession],
  );

  const onDeleteGroup = useCallback(
    (groupId: string) => {
      const current = sessionRef.current;
      if (current === null) return;
      void controller
        .deleteGroup(current, groupId)
        .then((updated) => {
          sessionRef.current = updated;
          setSession(updated);
        })
        .catch(() => undefined);
    },
    [controller, sessionRef, setSession],
  );

  return { onCreateGroup, onReadGroupRoster, onLeaveGroup, onDeleteGroup };
}
