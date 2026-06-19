import { useAppRouter } from "./app/useAppRouter.ts";
import { useDesktop } from "./desktop/Desktop.tsx";
import { OWNER } from "./app/fixtures.ts";
import { Chrome } from "./app/Chrome.tsx";

// The wired app: a route + history model (useAppRouter), responsive chrome
// (mobile shell / desktop sidebar / public canvas), and every screen rendered
// with props mapped from local fixtures. No backend yet (fixtures only).
export function App() {
  const { route, nav, shareOpen, setShareOpen } = useAppRouter();
  const desktop = useDesktop();
  return (
    <Chrome
      route={route}
      nav={nav}
      owner={OWNER}
      desktop={desktop}
      shareOpen={shareOpen}
      setShareOpen={setShareOpen}
    />
  );
}
