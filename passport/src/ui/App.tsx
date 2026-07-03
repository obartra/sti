import { useAppRouter } from "./app/useAppRouter.ts";
import type { Route } from "./app/routes.ts";
import { useSyncedRef } from "./app/useSyncedRef.ts";
import { useDesktop } from "./desktop/Desktop.tsx";
import { useOnboarding } from "./app/useOnboarding.ts";
import { useResumableSession } from "./app/useResumableSession.ts";
import { useShareLink } from "./app/useShareLink.ts";
import { useOwnerInbox } from "./app/useOwnerInbox.ts";
import { useFaves } from "./app/useFaves.ts";
import { usePendingRequests } from "./app/usePendingRequests.ts";
import { usePush } from "./app/usePush.ts";
import { useOwnerActions } from "./app/useOwnerActions.ts";
import { useAppBackground } from "./app/useAppBackground.ts";
import { useOwnerStateActions } from "./app/useOwnerStateActions.ts";
import { OWNER } from "./app/fixtures.ts";
import { Chrome } from "./app/Chrome.tsx";
import { createApiClient } from "../api/client.ts";
import {
  browserRequesterSecret,
  createAccountManager,
  createBackendStore,
  createSessionController,
  createLocalBlobStore,
  createSyncStatus,
  browserSyncStorage,
  createOfflineAccountSync,
  deriveOwnerView,
  type OwnerSession,
  type PassportStore,
  type SessionController,
} from "../store/index.ts";
import { useBackupSync } from "./app/useBackupSync.ts";
import { NotBackedUp } from "./app/NotBackedUp.tsx";
import { DemoBanner } from "./app/DemoBanner.tsx";
import {
  browserDeviceStore,
  createDeviceStore,
  type StorageLike,
} from "../auth/deviceStore.ts";
import {
  browserRootKeyStore,
  createVolatileRootKeyStore,
} from "../auth/rootKeyStore.ts";
import type { AliasRecord } from "../store/index.ts";
import { webAuthnPasskey } from "../auth/passkey.ts";
import { INITIAL_OWNER_STATE } from "../core/badge.ts";
import { todayEpochDay } from "../core/clock.ts";
import { API_BASE_URL } from "../config.ts";

// The real backend boundary: api transport + crypto. Created once; it opens no
// connection until something is resolved or published. The store carries the
// viewer's stable per-device requester secret so knocks dedupe across sessions.
const api = createApiClient(API_BASE_URL);
const backendStore = createBackendStore(api, browserRequesterSecret());

// A volatile device store for environments where localStorage is unavailable
// (private mode). The passkey binding then lives only for the tab's lifetime;
// the recovery phrase still recovers the account.
function volatileStorage(): StorageLike {
  const map = new Map<string, string>();
  return {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => void map.set(k, v),
    removeItem: (k) => void map.delete(k),
  };
}

// The offline-tolerant account sync (doc 22 slice 4): the owner's blob is cached
// in a root-key-sealed local store, so the app works offline and an offline edit
// is durable, backing up to the server when connectivity returns. syncStatus drives
// the not-backed-up marker; both are module-level so the App component and the
// controller share one instance.
const syncStatus = createSyncStatus(browserSyncStorage());
const offlineSync = createOfflineAccountSync(
  api,
  createLocalBlobStore(),
  syncStatus,
);

// The real session controller: account lifecycle + the device passkey binding +
// the WebAuthn adapter. Injectable so tests and Storybook drive a fake (the
// WebAuthn calls cannot run outside a real browser).
const backendController = createSessionController({
  accounts: createAccountManager(api, offlineSync),
  sync: offlineSync,
  devices: browserDeviceStore() ?? createDeviceStore(volatileStorage()),
  passkey: webAuthnPasskey(),
  keys: browserRootKeyStore() ?? createVolatileRootKeyStore(),
  api,
});

// The aliases shown in the live-links UI: every published alias EXCEPT the
// dedicated findable alias (doc 17), which has its own card and stays in the blob
// only so knocks to it are reviewed. Empty when logged out.
function liveLinkAliases(session: OwnerSession | null): AliasRecord[] {
  if (session === null) return [];
  const findableIds = new Set(
    (session.blob.findables ?? []).map((f) => f.aliasId),
  );
  return session.blob.aliases.filter((a) => !findableIds.has(a.id));
}

// The owner's claimed findable names, newest last (claim order). Empty when logged
// out or none claimed. Hoisted so the App component stays under its complexity ceiling.
function findableNames(session: OwnerSession | null): string[] {
  return (session?.blob.findables ?? []).map((f) => f.name);
}

// The owner's recovery name, or null (logged out, or no password factor set, doc 32).
function recoveryName(session: OwnerSession | null): string | null {
  return session?.blob.recoveryName ?? null;
}

// When the owner's recovery password was last set or changed (epoch ms, doc 32), or
// undefined (logged out, no password, or a password that predates the field). Drives
// the yearly refresh nudge from a real, synced date.
function passwordSetAt(session: OwnerSession | null): number | undefined {
  return session?.blob.passwordSetAt;
}

// The recovery-related props Chrome forwards to Settings (doc 32), bundled so the App
// render stays under its size cap: recovery name/phrase, the last set date, and the
// passkey-presence gate (verifyPasskey never disturbs the live session).
function recoveryProps(
  session: OwnerSession | null,
  controller: SessionController,
) {
  return {
    recoveryName: recoveryName(session),
    passwordSetAt: passwordSetAt(session),
    recoveryPhrase: recoveryPhrase(session),
    passkeyEnrolled: controller.passkeyEnrolled(),
    onVerifyPasskey: () => controller.verifyPasskey(),
  };
}

// The owner's stored recovery phrase for re-viewing in Settings (doc 32), or null
// when it is not stored on this device (logged out, or an account that has only
// resumed by passkey). Null makes Settings show the re-view-after-sign-in fallback.
function recoveryPhrase(session: OwnerSession | null): string | null {
  return session?.blob.recoveryPhrase ?? null;
}

// The session the network-touching hooks (push, backup sync) see: null in demo
// mode, so they stay dormant and the demo never reaches the real api/offlineSync.
// Hoisted so the demo branch lives here, not in the App component's complexity.
function networkSession(
  demoMode: boolean,
  session: OwnerSession | null,
): OwnerSession | null {
  return demoMode ? null : session;
}

// The route to actually render: a logged-out visitor is clamped off app-group
// screens to the public landing (no /home deep-link into owner data). Demo is
// exempt (its seeded account loads asynchronously, and demo is always "signed
// in", so an app screen must never bounce to the landing there). Hoisted to keep
// the clamp out of the App component's complexity.
function renderedRoute(
  route: Route,
  hasSession: boolean,
  demoMode: boolean,
): Route {
  if (demoMode || hasSession || route.group !== "app") return route;
  return { screen: "a1-landing", group: "public", data: null };
}

// Demo mode (doc 28) as one prop, so the App's parameter list and complexity do
// not grow per demo concern: the mode flag plus the enter/leave callbacks.
interface DemoControls {
  readonly mode: boolean;
  readonly onTry: () => void;
  readonly onExit: () => void;
}
const NO_DEMO: DemoControls = {
  mode: false,
  onTry: () => undefined,
  onExit: () => undefined,
};

// The two persistent banners above the chrome: the demo-mode marker (doc 28) and the
// not-backed-up marker (doc 22). Bundled so App's render stays within its size cap.
function Banners({
  demo,
  backupPending,
}: {
  demo: DemoControls;
  backupPending: boolean;
}) {
  return (
    <>
      <DemoBanner active={demo.mode} onExit={demo.onExit} />
      <NotBackedUp pending={backupPending} demo={demo.mode} />
    </>
  );
}

// The wired app: a route + history model (useAppRouter), responsive chrome, and
// the owner session. Logged out, it shows the public landing + onboarding;
// onboarding (or passkey login) mints/loads a real account, and the app screens
// then render the owner's derived view rather than a fixture. The store and the
// session controller are injectable so tests drive both deterministically.
export function App({
  store = backendStore,
  controller = backendController,
  // Demo mode (doc 28): the app runs over an in-memory demo store + controller,
  // wears a persistent banner, and never touches the network (the two hooks that
  // hold the real api/offlineSync are gated off via networkSession below).
  demo = NO_DEMO,
}: {
  store?: PassportStore;
  controller?: SessionController;
  demo?: DemoControls;
} = {}) {
  const { route, nav, shareOpen, setShareOpen } = useAppRouter();
  const desktop = useDesktop();
  // Session + the "stay signed in" lifecycle (doc 24): silent resume on load,
  // persist on login, forget on logout.
  const {
    session,
    setSession,
    onSession,
    onLogOut,
    keepSignedIn,
    setKeepSignedIn,
  } = useResumableSession(controller, nav);
  const onboarding = useOnboarding(controller, onSession);

  // The latest session, readable synchronously. setOwnerState applies its update
  // against THIS (not a render-time capture), so rapid successive edits compose
  // instead of clobbering each other while a write is in flight.
  const sessionRef = useSyncedRef(session);

  // The owner's badge-state mutations: optimistic state updates + the report path
  // (which is built on them). Both fold the persisted result back into the session.
  const { setOwnerState, onReport } = useOwnerStateActions(
    controller,
    sessionRef,
    setSession,
  );

  // Account deletion, per-contact links, and circles (each folds the result back
  // into the session; delete logs out, clamping app routes to the landing). Passed
  // through to Chrome as a group ({...actions}), since the names match 1:1.
  const actions = useOwnerActions(controller, sessionRef, setSession);

  // The share sheet: opening it mints/refreshes the owner's primary alias.
  const {
    shareUrl,
    shareError,
    retryShareLink,
    setShareOpen: handleSetShareOpen,
    copyShareLink,
    revokeLink,
    identity: shareIdentity,
    setIdentity: setShareIdentity,
    avatarOverride: shareAvatarOverride,
    setAvatarOverride: setShareAvatarOverride,
    lifetime: shareLifetime,
    setLifetime: setShareLifetime,
  } = useShareLink(controller, sessionRef, setSession, setShareOpen);

  // The owner's quiet inbox: knock review + the partner-notify nudge (owner-pull).
  const {
    knockCount,
    canApproveKnocks,
    showKnockInfo,
    approveKnocks,
    approvingKnocks,
    showPartnerNudge,
    dismissPartnerNudge,
    refreshInbox,
  } = useOwnerInbox(controller, session);

  // Background upkeep for a logged-in owner (doc 16 link-expiry sweep + doc 33 group
  // catch-up). groupRefresh is triggered on People / group-detail mount too.
  const groupRefresh = useAppBackground(controller, sessionRef, setSession, {
    session,
    demoMode: demo.mode,
  });

  // Starred contacts (device-local; see useFaves). Unrelated to the session.
  const { faves, toggleFave } = useFaves();

  // The viewer's own access requests (device-local; see usePendingRequests). A
  // logged-out viewer's way back to a status the owner may later share; unrelated
  // to the session, so it works with no account.
  const { requests: pendingRequests, forget: forgetRequest } =
    usePendingRequests();

  // Device push for the partner-notify wake (slice 7); a Privacy toggle drives it.
  // In demo mode the real api/offlineSync stay untouched: networkSession hands the
  // hooks a null session, so push and backup-sync stay dormant (demo sends nothing).
  const push = usePush(api, networkSession(demo.mode, session));

  // Offline durability (doc 22 slice 4): track whether local owner edits are backed
  // up, and on reconnect re-apply the current state to push the blob and republish.
  const backupPending = useBackupSync(
    syncStatus,
    offlineSync,
    networkSession(demo.mode, session),
    setOwnerState,
  );

  return (
    <>
      <Banners demo={demo} backupPending={backupPending} />
      <Chrome
        route={renderedRoute(route, session !== null, demo.mode)}
        nav={nav}
        owner={session ? deriveOwnerView(session.blob, todayEpochDay()) : OWNER}
        ownerState={session ? session.blob.state : INITIAL_OWNER_STATE}
        onboarding={onboarding}
        onLogOut={onLogOut}
        keepSignedIn={keepSignedIn}
        onKeepSignedInChange={setKeepSignedIn}
        onReport={onReport}
        setOwnerState={setOwnerState}
        store={store}
        desktop={desktop}
        shareOpen={shareOpen}
        setShareOpen={handleSetShareOpen}
        shareUrl={shareUrl}
        shareError={shareError}
        onRetryShareLink={retryShareLink}
        onCopyShareLink={copyShareLink}
        onRevokeShareLink={revokeLink}
        shareIdentity={shareIdentity}
        onShareIdentityChange={setShareIdentity}
        shareAvatarOverride={shareAvatarOverride}
        onShareAvatarOverrideChange={setShareAvatarOverride}
        shareLifetime={shareLifetime}
        onShareLifetimeChange={setShareLifetime}
        knockCount={knockCount}
        refreshKnocks={refreshInbox}
        canApproveKnocks={canApproveKnocks}
        showKnockInfo={showKnockInfo}
        approveKnocks={approveKnocks}
        approvingKnocks={approvingKnocks}
        showPartnerNudge={showPartnerNudge}
        dismissPartnerNudge={dismissPartnerNudge}
        aliases={liveLinkAliases(session)}
        contacts={session ? session.blob.contacts : []}
        faves={faves}
        onToggleFave={toggleFave}
        pendingRequests={pendingRequests}
        onForgetRequest={forgetRequest}
        isLoggedIn={session !== null}
        onTryDemo={demo.onTry}
        groups={session ? (session.blob.groups ?? []) : []}
        onGroupCatchup={groupRefresh}
        vanityNames={findableNames(session)}
        {...recoveryProps(session, controller)}
        push={push}
        {...actions}
      />
    </>
  );
}
