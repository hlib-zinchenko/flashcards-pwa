/**
 * In-app release notes, newest first. Shipped inside the build so they work offline and always match
 * the running version. Add an entry for each release with user-visible changes (skip ones without);
 * keep each line short, one change per line, in en and uk (other languages show the English lines).
 * Keep only the latest MAX_ENTRIES releases: older ones live on the GitHub releases page, which the dialog links to.
 */
export const MAX_ENTRIES = 3;
export const RELEASES_URL = 'https://github.com/hlib-zinchenko/flashcards-pwa/releases';
export type ChangelogEntry = { version: string; en: string[]; uk: string[] };

export const CHANGELOG: ChangelogEntry[] = [
  {
    version: '0.11.5',
    en: ['Buttons at the top of a test are no longer dimmed on iPad.'],
    uk: ['Кнопки вгорі тесту більше не затінені на iPad.'],
  },
  {
    version: '0.11.3',
    en: [
      'Browsers that cannot read aloud now say so, instead of asking you to set up languages.',
      'Making storage persistent tells you when the browser declines.',
    ],
    uk: [
      'Браузери, які не вміють читати вголос, тепер так і кажуть, а не пропонують налаштувати мови.',
      'Якщо браузер не дозволяє зробити сховище постійним, застосунок про це скаже.',
    ],
  },
  {
    version: '0.11.2',
    en: [
      'The Start button in Test is no longer dimmed by the bottom bar.',
      'Buttons at the top of a test are no longer dimmed on iPhone.',
    ],
    uk: [
      'Нижня панель більше не затінює кнопку «Старт» у Тесті.',
      'Кнопки вгорі тесту більше не затінені на iPhone.',
    ],
  },
];

/** Negative if a < b, positive if a > b. Compares dotted numeric versions ("0.10.0" > "0.9.2"). */
export function compareVersions(a: string, b: string): number {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] || 0) - (pb[i] || 0);
    if (d) return d;
  }
  return 0;
}

/**
 * Notes to show on launch: every entry newer than `lastSeen` up to `current`.
 * `lastSeen` is null before the app ever recorded it: a fresh install (no data) gets nothing,
 * an existing user updating from a version without this feature gets the current version's notes.
 */
export function notesToShow(
  lastSeen: string | null,
  current: string,
  hasData: boolean,
  changelog: ChangelogEntry[] = CHANGELOG,
): ChangelogEntry[] {
  if (lastSeen === null) {
    return hasData ? changelog.filter((e) => compareVersions(e.version, current) === 0) : [];
  }
  return changelog.filter((e) => compareVersions(e.version, lastSeen) > 0 && compareVersions(e.version, current) <= 0);
}
