import "./styles/global.css";
import { StrictMode, Suspense, lazy } from "react";
import { createRoot } from "react-dom/client";
import { Root } from "./ui/Root.tsx";
import { isAdminPath } from "./ui/admin/adminRoute.ts";
import { API_BASE_URL } from "./config.ts";
import { registerServiceWorker } from "./pwa/registerSw.ts";
import { initInstallPrompt } from "./pwa/installPrompt.ts";

// The operator surface loads as a separate async chunk (dynamic import), so its
// weight (including the charting library the metrics panel uses) never lands in the
// consumer app's precached offline shell (doc 22 budget; doc 20's "separate bundle"
// intent). It is only fetched when someone actually visits /admin.
const AdminPage = lazy(() =>
  import("./ui/admin/AdminPage.tsx").then((m) => ({ default: m.AdminPage })),
);

const root = document.getElementById("root");
if (!root) throw new Error("missing #root element");
// /admin is a fully isolated operator surface (doc 20): it takes over the page
// before the consumer app mounts, so none of the user-flow machinery loads behind
// it. It is never linked from the app and renders nothing until a valid token.
const admin = isAdminPath();
createRoot(root).render(
  <StrictMode>
    {admin ? (
      <Suspense fallback={null}>
        <AdminPage apiBase={API_BASE_URL} />
      </Suspense>
    ) : (
      <Root />
    )}
  </StrictMode>,
);
// The offline shell and the install affordance are for the consumer app only; the
// isolated admin surface stays network-only and is never offered for install.
if (!admin) {
  registerServiceWorker();
  initInstallPrompt();
}
