/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Empty in development — the Vite proxy makes /api same-origin. */
  readonly VITE_API_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
