import { useMemo, useState } from "react";
import { App } from "./App.tsx";
import {
  createDemoController,
  createDemoStore,
} from "../store/demo/demoRuntime.ts";

// Two ways to boot straight into the demo (doc 28), so the whole app can be exercised
// with no server. Both only seed the INITIAL state; "Leave demo" still drops to the
// real, logged-out app.
//   - The stable `/#demo` route, so the App Review notes (and a shared link) can deep
//     link into the demo on any device.
//   - A build flag (`VITE_DEMO=1 npm run dev`), a developer convenience.
const DEMO_HASH = "#demo";

function demoRouteAtBoot(): boolean {
  return typeof location !== "undefined" && location.hash === DEMO_HASH;
}

const DEMO_AT_BOOT =
  import.meta.env.VITE_DEMO === "1" ||
  import.meta.env.VITE_DEMO === "true" ||
  demoRouteAtBoot();

/**
 * The app root: the real app, plus the toggle into demo mode (doc 28). Entering
 * the demo mounts a SECOND App over an in-memory demo store + controller, keyed so
 * it is a fresh mount (its silent resume boots straight into the seeded @demo
 * account). Leaving remounts the real app, logged out, on the landing. The demo
 * runtime is rebuilt on each entry, so the demo always starts fresh and forgets
 * everything on exit.
 */
export function Root() {
  const [demo, setDemo] = useState(DEMO_AT_BOOT);
  const demoStore = useMemo(() => (demo ? createDemoStore() : null), [demo]);
  const demoController = useMemo(
    () => (demo ? createDemoController() : null),
    [demo],
  );

  // Entering syncs the URL to `/#demo` so a reload stays in the demo and the address
  // is shareable; leaving clears it so the real app is not stuck on the demo route.
  const enter = () => {
    if (typeof location !== "undefined") location.hash = DEMO_HASH.slice(1);
    setDemo(true);
  };
  const exit = () => {
    if (typeof location !== "undefined" && location.hash === DEMO_HASH) {
      history.replaceState(null, "", location.pathname + location.search);
    }
    setDemo(false);
  };

  if (demo && demoStore && demoController) {
    return (
      <App
        key="demo"
        store={demoStore}
        controller={demoController}
        demo={{ mode: true, onTry: () => undefined, onExit: exit }}
      />
    );
  }
  return (
    <App
      key="real"
      demo={{ mode: false, onTry: enter, onExit: () => undefined }}
    />
  );
}
