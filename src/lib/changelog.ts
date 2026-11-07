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
    version: '0.14.0',
    en: [
      'A deck holds up to 999 cards, so it opens and searches quickly. Bigger decks from older backups still work.',
      'A CSV file with more than 999 cards is split into several decks: “Name”, “Name 2”…',
    ],
    uk: [
      'У колоді може бути до 999 карток, тому вона швидко відкривається і шукає. Більші колоди зі старих бекапів працюють як і раніше.',
      'CSV-файл, у якому понад 999 карток, ділиться на кілька колод: «Назва», «Назва 2»…',
    ],
  },
  {
    version: '0.13.0',
    en: [
      'Softer colours: main buttons are plum or lavender instead of black or white, and messages at the bottom are paper tiles.',
      'Deck and collection menus are tidy lists; share and import moved into them.',
      'In Test, tapping a deck, level or tag picks just that one; All picks everything again.',
      'More cards fit on the screen of a deck.',
    ],
    uk: [
      'М’якші кольори: головні кнопки сливові або лавандові замість чорних чи білих, а повідомлення внизу стали паперовими плитками.',
      'Меню колоди й колекції стали охайними списками; «Поділитися» та «Імпорт» тепер там.',
      'У тесті тап на колоду, рівень чи тег вибирає тільки його; «Усі» знову вибирає все.',
      'На екрані колоди вміщується більше карток.',
    ],
  },
  {
    version: '0.12.0',
    en: [
      'Test now uses the decks of the collection you opened last, never mixing collections.',
      'The Study button on a collection is gone: use the Test tab instead.',
      'Study, Start and Done buttons are now mint green.',
    ],
    uk: [
      'Тест тепер бере колоди з колекції, яку ви відкривали останньою, і ніколи не змішує колекції.',
      'Кнопки «Вчити» на колекції більше немає: відкрийте вкладку «Тест».',
      'Кнопки «Вчити», «Почати» і «Готово» тепер м’ятно-зелені.',
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
