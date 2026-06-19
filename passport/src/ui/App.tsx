import { useAppRouter } from "./app/useAppRouter.ts";
import { useDesktop } from "./desktop/Desktop.tsx";
import { OWNER } from "./app/fixtures.ts";
import { Chrome } from "./app/Chrome.tsx";
import { createApiClient } from "../api/client.ts";
import { createBackendStore, type PassportStore } from "../store/index.ts";
import { API_BASE_URL } from "../config.ts";

// The real backend boundary: api transport + crypto. Created once; it opens no
// connection until a screen resolves something.
const backendStore = createBackendStore(createApiClient(API_BASE_URL));

// The wired app: a route + history model (useAppRouter), responsive chrome
// (mobile shell / desktop sidebar / public canvas), screens rendered from local
// fixtures, plus the injected store for real reads (public resolution). The
// store is injectable so tests can drive resolution deterministically.
export function App({ store = backendStore }: { store?: PassportStore } = {}) {
  const { route, nav, shareOpen, setShareOpen } = useAppRouter();
  const desktop = useDesktop();
  return (
    <Chrome
      route={route}
      nav={nav}
      owner={OWNER}
      store={store}
      desktop={desktop}
      shareOpen={shareOpen}
      setShareOpen={setShareOpen}
    />
  );
}
