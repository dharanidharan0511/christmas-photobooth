/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_ENGINE_URL: string;
  /** Default Mind Share Key for code-repo CodeFlo chat (optional). */
  readonly VITE_CODEFLO_SHARE_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
