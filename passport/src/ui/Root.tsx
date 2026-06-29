import { useMemo, useState } from "react";
import { App } from "./App.tsx";
import {
  createDemoController,
  createDemoStore,
} from "../store/demo/demoRuntime.ts";

// Client-only dev mode: `VITE_DEMO=1 npm run dev` boots straight into the demo
// runtime, so the whole app can be exercised with no server (doc 28). It only
// seeds the INITIAL state; "Leave demo" still drops to the real, logged-out app.
const DEMO_AT_BOOT =
  import.meta.env.VITE_DEMO === "1" || import.meta.env.VITE_DEMO === "true";

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

  if (demo && demoStore && demoController) {
    return (
      <App
        key="demo"
        store={demoStore}
        controller={demoController}
        demo={{
          mode: true,
          onTry: () => undefined,
          onExit: () => setDemo(false),
        }}
      />
    );
  }
  return (
    <App
      key="real"
      demo={{
        mode: false,
        onTry: () => setDemo(true),
        onExit: () => undefined,
      }}
    />
  );
}
