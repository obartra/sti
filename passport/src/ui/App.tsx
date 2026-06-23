import { useCallback, useRef, useState } from "react";
import { useAppRouter } from "./app/useAppRouter.ts";
import { useDesktop } from "./desktop/Desktop.tsx";
import { useOnboarding } from "./app/useOnboarding.ts";
import { useShareLink } from "./app/useShareLink.ts";
import { useOwnerInbox } from "./app/useOwnerInbox.ts";
import { useFaves } from "./app/useFaves.ts";
import { usePush } from "./app/usePush.ts";
import { useOwnerActions } from "./app/useOwnerActions.ts";
import { OWNER } from "./app/fixtures.ts";
import { Chrome } from "./app/Chrome.tsx";
import { createApiClient } from "../api/client.ts";
import {
  browserRequesterSecret,
  createAccountManager,
  createAccountSync,
  createBackendStore,
  createSessionController,
  deriveOwnerView,
  type OwnerSession,
  type PassportStore,
  type SessionController,
} from "../store/index.ts";
import {
  browserDeviceStore,
  createDeviceStore,
  type StorageLike,
} from "../auth/deviceStore.ts";
import { webAuthnPasskey } from "../auth/passkey.ts";
import { applyReport, type ReportOutcome } from "../core/report.ts";
import { INITIAL_OWNER_STATE, type OwnerState } from "../core/badge.ts";
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

// The real session controller: account lifecycle + the device passkey binding +
// the WebAuthn adapter. Injectable so tests and Storybook drive a fake (the
// WebAuthn calls cannot run outside a real browser).
const backendController = createSessionController({
  accounts: createAccountManager(api),
  sync: createAccountSync(api),
  devices: browserDeviceStore() ?? createDeviceStore(volatileStorage()),
  passkey: webAuthnPasskey(),
  api,
});

// The wired app: a route + history model (useAppRouter), responsive chrome, and
// the owner session. Logged out, it shows the public landing + onboarding;
// onboarding (or passkey login) mints/loads a real account, and the app screens
// then render the owner's derived view rather than a fixture. The store and the
// session controller are injectable so tests drive both deterministically.
export function App({
  store = backendStore,
  controller = backendController,
}: { store?: PassportStore; controller?: SessionController } = {}) {
  const { route, nav, shareOpen, setShareOpen } = useAppRouter();
  const desktop = useDesktop();
  const [session, setSession] = useState<OwnerSession | null>(null);

  const onSession = useCallback(
    (s: OwnerSession) => {
      setSession(s);
      nav.jump("home");
    },
    [nav],
  );
  const onboarding = useOnboarding(controller, onSession);

  // The latest session, readable synchronously. setOwnerState applies its update
  // against THIS (not a render-time capture), so rapid successive edits compose
  // instead of clobbering each other while a write is in flight.
  const sessionRef = useRef<OwnerSession | null>(null);
  sessionRef.current = session;

  // Apply an update to the owner state, optimistically (so a follow-up edit sees
  // it immediately) and persist + republish in the background; the server's
  // answer reconciles. A no-op logged out. On a network failure the optimistic
  // state stands and a later edit re-persists, matching the report path.
  const setOwnerState = useCallback(
    (update: (prev: OwnerState) => OwnerState) => {
      const current = sessionRef.current;
      if (current === null) return;
      const next = update(current.blob.state);
      const optimistic: OwnerSession = {
        ...current,
        blob: { ...current.blob, state: next },
      };
      sessionRef.current = optimistic;
      setSession(optimistic);
      void controller
        .setOwnerState(current, next)
        .then((saved) => {
          sessionRef.current = saved;
          setSession(saved);
        })
        .catch(() => undefined);
    },
    [controller],
  );

  // Apply a reported result on top of the current owner state, stamped with the
  // report day so freshness ages from now.
  const onReport = useCallback(
    (outcome: ReportOutcome) => {
      setOwnerState((s) => applyReport(s, outcome, todayEpochDay()));
      // A reported active non-HIV positive silently notifies linked contacts (doc 13).
      if (outcome.activeNonHivSti) {
        const current = sessionRef.current;
        if (current !== null) {
          void controller
            .notifyContactsOfPositive(current)
            .catch(() => undefined);
        }
      }
    },
    [setOwnerState, controller],
  );

  // Account deletion, per-contact links, and circles (each folds the result back
  // into the session; delete logs out, clamping app routes to the landing). Passed
  // through to Chrome as a group ({...actions}), since the names match 1:1.
  const actions = useOwnerActions(controller, sessionRef, setSession);

  // The share sheet: opening it mints/refreshes the owner's primary alias.
  const {
    shareUrl,
    setShareOpen: handleSetShareOpen,
    copyShareLink,
    revokeLink,
    identity: shareIdentity,
    setIdentity: setShareIdentity,
    duration: shareDuration,
    setDuration: setShareDuration,
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

  // Starred contacts (device-local; see useFaves). Unrelated to the session.
  const { faves, toggleFave } = useFaves();

  // Device push for the partner-notify wake (slice 7); a Privacy toggle drives it.
  const push = usePush(api, session);

  return (
    <Chrome
      // A logged-out visitor must never land on an app-group screen (e.g. a #home
      // deep link): clamp those to the public landing until they sign in. Public
      // screens (landing, a shared link, onboarding) are reachable either way.
      route={
        session === null && route.group === "app"
          ? { screen: "a1-landing", group: "public", data: null }
          : route
      }
      nav={nav}
      owner={session ? deriveOwnerView(session.blob, todayEpochDay()) : OWNER}
      ownerState={session ? session.blob.state : INITIAL_OWNER_STATE}
      onboarding={onboarding}
      onReport={onReport}
      setOwnerState={setOwnerState}
      store={store}
      desktop={desktop}
      shareOpen={shareOpen}
      setShareOpen={handleSetShareOpen}
      shareUrl={shareUrl}
      onCopyShareLink={copyShareLink}
      onRevokeShareLink={revokeLink}
      shareIdentity={shareIdentity}
      onShareIdentityChange={setShareIdentity}
      shareDuration={shareDuration}
      onShareDurationChange={setShareDuration}
      knockCount={knockCount}
      refreshKnocks={refreshInbox}
      canApproveKnocks={canApproveKnocks}
      showKnockInfo={showKnockInfo}
      approveKnocks={approveKnocks}
      approvingKnocks={approvingKnocks}
      showPartnerNudge={showPartnerNudge}
      dismissPartnerNudge={dismissPartnerNudge}
      aliases={session ? session.blob.aliases : []}
      contacts={session ? session.blob.contacts : []}
      faves={faves}
      onToggleFave={toggleFave}
      isLoggedIn={session !== null}
      circles={session ? (session.blob.circles ?? []) : []}
      push={push}
      {...actions}
    />
  );
}
