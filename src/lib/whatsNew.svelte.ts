import { CHANGELOG, compareVersions, notesToShow, type ChangelogEntry } from './changelog';
import { db } from './db';
import { loadPref, savePref } from './prefs';

const PREF = 'lastSeenVersion';

/** Release notes waiting to be shown by <WhatsNew> in App.svelte; empty when there are none. */
export const whatsNew = $state({ entries: [] as ChangelogEntry[] });

/** On launch: queue the notes for every version since the last one this device ran, then record this one. */
export async function checkWhatsNew(): Promise<void> {
  const lastSeen = loadPref<string | null>(PREF, null);
  if (lastSeen === __APP_VERSION__) return;
  const hasData = lastSeen === null ? (await db.decks.count().catch(() => 0)) > 0 : true;
  savePref(PREF, __APP_VERSION__);
  whatsNew.entries = notesToShow(lastSeen, __APP_VERSION__, hasData);
}

/** From Settings: show the latest few releases' notes again. */
export function openWhatsNew(): void {
  whatsNew.entries = CHANGELOG.filter((e) => compareVersions(e.version, __APP_VERSION__) <= 0).slice(0, 3);
}
