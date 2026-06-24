import "./design/index.css";
import "./app.css";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./ui/App.tsx";
import { AdminPage } from "./ui/admin/AdminPage.tsx";
import { isAdminPath } from "./ui/admin/adminRoute.ts";
import { API_BASE_URL } from "./config.ts";

const root = document.getElementById("root");
if (!root) throw new Error("missing #root element");
// /admin is a fully isolated operator surface (doc 20): it takes over the page
// before the consumer app mounts, so none of the user-flow machinery loads behind
// it. It is never linked from the app and renders nothing until a valid token.
createRoot(root).render(
  <StrictMode>
    {isAdminPath() ? <AdminPage apiBase={API_BASE_URL} /> : <App />}
  </StrictMode>,
);
