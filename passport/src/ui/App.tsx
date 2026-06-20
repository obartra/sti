import { useCallback, useState } from "react";
import { useAppRouter } from "./app/useAppRouter.ts";
import { useDesktop } from "./desktop/Desktop.tsx";
import { useOnboarding } from "./app/useOnboarding.ts";
import { OWNER } from "./app/fixtures.ts";
import { Chrome } from "./app/Chrome.tsx";
import type { Route } from "./app/routes.ts";
import { createApiClient } from "../api/client.ts";
import {
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
import { API_BASE_URL } from "../config.ts";

// The real backend boundary: api transport + crypto. Created once; it opens no
// connection until something is resolved or published.
const api = createApiClient(API_BASE_URL);
const backendStore = createBackendStore(api);

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

  const loggedIn = session !== null;
  const owner = session ? deriveOwnerView(session.blob) : OWNER;

  // A logged-out visitor must never land on an app-group screen (e.g. a #home
  // deep link): clamp those to the public landing until they sign in. Public
  // screens (landing, a shared link, onboarding) are reachable either way.
  const effectiveRoute: Route =
    !loggedIn && route.group === "app"
      ? { screen: "a1-landing", group: "public", data: null }
      : route;

  return (
    <Chrome
      route={effectiveRoute}
      nav={nav}
      owner={owner}
      onboarding={onboarding}
      store={store}
      desktop={desktop}
      shareOpen={shareOpen}
      setShareOpen={setShareOpen}
    />
  );
}
