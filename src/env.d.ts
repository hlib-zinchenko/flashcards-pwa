/// <reference types="svelte" />
/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/svelte" />

declare const __APP_VERSION__: string;

interface ImportMetaEnv {
  /** Origin allowed to send a library to #/import-legacy (default https://flashcards.hzinchenko.com). */
  readonly VITE_LEGACY_ORIGIN?: string;
}
