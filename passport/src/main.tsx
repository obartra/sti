import "./design/index.css";
import "./app.css";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Root } from "./ui/Root.tsx";
import { AdminPage } from "./ui/admin/AdminPage.tsx";
import { isAdminPath } from "./ui/admin/adminRoute.ts";
import { API_BASE_URL } from "./config.ts";
import { registerServiceWorker } from "./pwa/registerSw.ts";
import { initInstallPrompt } from "./pwa/installPrompt.ts";

const root = document.getElementById("root");
if (!root) throw new Error("missing #root element");
// /admin is a fully isolated operator surface (doc 20): it takes over the page
// before the consumer app mounts, so none of the user-flow machinery loads behind
// it. It is never linked from the app and renders nothing until a valid token.
const admin = isAdminPath();
createRoot(root).render(
  <StrictMode>
    {admin ? <AdminPage apiBase={API_BASE_URL} /> : <Root />}
  </StrictMode>,
);
// The offline shell and the install affordance are for the consumer app only; the
// isolated admin surface stays network-only and is never offered for install.
if (!admin) {
  registerServiceWorker();
  initInstallPrompt();
}
