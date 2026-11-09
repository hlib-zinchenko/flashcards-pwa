/**
 * Moving a library from the old address (flashcards.hzinchenko.com) to this one.
 * The old app opens `#/import-legacy` here with window.open; this page tells the opener it is
 * ready, the opener sends its backup and preferences, and this page merges them and answers.
 * Every message is checked against the one origin allowed to send it.
 */

export const LEGACY_ORIGIN: string = import.meta.env.VITE_LEGACY_ORIGIN || 'https://flashcards.hzinchenko.com';

/** Where the app lives now. A legacy build sends the library there. */
export const NEW_ORIGIN: string = import.meta.env.VITE_NEW_ORIGIN || 'https://app.karbka.com';

/** Built for the old address (VITE_LEGACY=1): shows the "We moved" screen. */
export const IS_LEGACY = import.meta.env.VITE_LEGACY === '1';

/** Preferences carried over. Each is copied only when it isn't set here yet. */
export const TRANSFER_PREFS = [
  'lang',
  'theme',
  'lastCollection',
  'speech',
  'testConfig',
  'gestureHintSeen',
  'installHintDismissed',
  'lastBackupAt',
  // So What's new at the new address shows only what's new since the old one.
  'lastSeenVersion',
  // The daily usage count: someone who turned it off keeps it off, and the age and last-studied ranges carry on.
  'usageCounts',
  'firstOpenedAt',
  'lastStudiedAt',
] as const;

export type TransferMessage =
  | { type: 'karbka-transfer-ready' }
  | { type: 'karbka-transfer-backup'; backup: string; prefs: Record<string, unknown> }
  | { type: 'karbka-transfer-done'; decks: number; cards: number }
  | { type: 'karbka-transfer-failed'; error: string };

/**
 * The backup message from the old app, or null for anything else: another origin, another
 * shape, or a message this page doesn't expect.
 */
export function readBackupMessage(
  origin: string,
  data: unknown,
  allowed: string = LEGACY_ORIGIN,
): { backup: string; prefs: Record<string, unknown> } | null {
  if (origin !== allowed) return null;
  if (typeof data !== 'object' || data === null) return null;
  const msg = data as Record<string, unknown>;
  if (msg.type !== 'karbka-transfer-backup' || typeof msg.backup !== 'string') return null;
  const prefs: Record<string, unknown> = {};
  if (typeof msg.prefs === 'object' && msg.prefs !== null) {
    for (const key of TRANSFER_PREFS) {
      const value = (msg.prefs as Record<string, unknown>)[key];
      if (value !== undefined && value !== null) prefs[key] = value;
    }
  }
  return { backup: msg.backup, prefs };
}

/** Preferences to write: the sent ones that aren't set here already. */
export function prefsToApply(sent: Record<string, unknown>, isSet: (key: string) => boolean): Record<string, unknown> {
  return Object.fromEntries(Object.entries(sent).filter(([key]) => !isSet(key)));
}

/** A reply from the new address (ready, done or failed), or null for anything else. */
export function readReply(
  origin: string,
  data: unknown,
  allowed: string = NEW_ORIGIN,
): Exclude<TransferMessage, { type: 'karbka-transfer-backup' }> | null {
  if (origin !== allowed) return null;
  if (typeof data !== 'object' || data === null) return null;
  const msg = data as Record<string, unknown>;
  if (msg.type === 'karbka-transfer-ready') return { type: msg.type };
  if (msg.type === 'karbka-transfer-done' && typeof msg.decks === 'number' && typeof msg.cards === 'number') {
    return { type: msg.type, decks: msg.decks, cards: msg.cards };
  }
  if (msg.type === 'karbka-transfer-failed') return { type: msg.type, error: String(msg.error ?? '') };
  return null;
}
