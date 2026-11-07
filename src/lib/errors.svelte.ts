/** Catches errors nothing else handled: shows a toast and keeps them for "Copy diagnostics". */
import { db } from './db';
import { describeError, diagnosticsText, isIgnorable, parseErrorLog, pushError, type ErrorEntry } from './diagnostics';
import { t } from './i18n/index.svelte';
import { install } from './install.svelte';
import { copyText } from './io/file';
import { loadPref, savePref } from './prefs';
import { showToast } from './toast.svelte';

const PREF = 'errorLog';
/** One toast for a burst of errors, not one per error. */
const TOAST_GAP = 4000;

let log: ErrorEntry[] = parseErrorLog(loadPref<unknown>(PREF, []));
let lastToast = 0;

export function reportError(reason: unknown): void {
  const message = describeError(reason);
  if (isIgnorable(message)) return;
  log = pushError(log, { at: Date.now(), message });
  savePref(PREF, log);
  const now = Date.now();
  if (now - lastToast < TOAST_GAP) return;
  lastToast = now;
  showToast(t('error.toast'), 8000, { label: t('error.copy'), run: copyDiagnostics });
}

export function installErrorHandlers(): void {
  window.addEventListener('error', (e) => reportError(e.error ?? e.message));
  window.addEventListener('unhandledrejection', (e) => reportError(e.reason));
}

async function buildDiagnostics(): Promise<string> {
  const [decks, cards] = await Promise.all([db.decks.count().catch(() => null), db.cards.count().catch(() => null)]);
  return diagnosticsText({
    version: __APP_VERSION__,
    now: Date.now(),
    userAgent: navigator.userAgent,
    language: `${document.documentElement.lang} (device: ${navigator.language})`,
    standalone: install.standalone,
    screen: `${window.innerWidth}×${window.innerHeight} @${window.devicePixelRatio}x`,
    decks,
    cards,
    errors: log,
  });
}

/** Copy the report for an email or a GitHub issue. Call it from a tap. */
export async function copyDiagnostics(): Promise<void> {
  const ok = await copyText(buildDiagnostics());
  showToast(ok ? t('settings.copied') : t('settings.copyFailed'), 3000);
}
