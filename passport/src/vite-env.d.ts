/// <reference types="vite/client" />

// Injected by vite.config.ts `define` at build time.
declare const __APP_VERSION__: string;
declare const __BUILD_DATE__: string;

// Typed build-time env (see src/config.ts).
interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string;
  // Base URL of the static education library (see src/lib/info.ts); overridable to
  // point at a preview deploy of the info site.
  readonly VITE_INFO_BASE_URL?: string;
  // Client-only dev mode (see src/ui/Root.tsx): "1"/"true" boots straight into
  // the in-memory demo runtime, so the app runs with no server.
  readonly VITE_DEMO?: string;
}
interface ImportMeta {
  readonly env: ImportMetaEnv;
}
