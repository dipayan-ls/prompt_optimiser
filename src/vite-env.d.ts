/// <reference types="vite/client" />

interface ImportMetaEnv {
  /**
   * Base URL of the optimize endpoint. Public — inlined into the bundle.
   * Empty string means "no backend"; the app then runs the rule-based
   * optimizer in the browser. See .env.example.
   */
  readonly VITE_API_BASE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
