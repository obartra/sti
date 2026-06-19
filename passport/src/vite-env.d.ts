/// <reference types="vite/client" />

// Injected by vite.config.ts `define` at build time.
declare const __APP_VERSION__: string;
declare const __BUILD_DATE__: string;

// Typed build-time env (see src/config.ts).
interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string;
}
interface ImportMeta {
  readonly env: ImportMetaEnv;
}
