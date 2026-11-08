/// <reference types="svelte" />
/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/svelte" />

declare const __APP_VERSION__: string;

interface ImportMetaEnv {
  /** Origin allowed to send a library to #/import-legacy (default https://flashcards.hzinchenko.com). */
  readonly VITE_LEGACY_ORIGIN?: string;
  /** Where a legacy build sends the library (default https://app.karbka.com). */
  readonly VITE_NEW_ORIGIN?: string;
  /** '1' builds the app for the old address, with the "We moved" screen. */
  readonly VITE_LEGACY?: string;
}
