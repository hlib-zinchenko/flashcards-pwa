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
    version: '0.16.0',
    en: [
      'Search words across a whole collection: tap the magnifier on the collection screen.',
      'Adding a card warns you if the same word is already in any deck of the collection. You can still save it.',
      'You can write notes when adding a card.',
      'Tags are cleared after each card you add, so they don’t go onto the next one by mistake.',
    ],
    uk: [
      'Пошук слів у всій колекції: натисніть лупу на екрані колекції.',
      'Під час додавання картки застосунок попередить, якщо таке слово вже є в якійсь колоді колекції. Зберегти все одно можна.',
      'Під час додавання картки можна написати нотатки.',
      'Теги скидаються після кожної доданої картки, щоб не потрапити на наступну випадково.',
    ],
  },
  {
    version: '0.15.0',
    en: [
      'If the phone closes the app during a test, you can pick up where you left off: tap Resume.',
      'When something goes wrong, the app says so. Settings → About can copy details for a bug report.',
      'You can now email feedback to hello@hzinchenko.com from Settings → About.',
    ],
    uk: [
      'Якщо телефон закрив застосунок посеред тесту, можна продовжити з того ж місця: натисніть «Продовжити».',
      'Коли щось іде не так, застосунок про це каже. У Налаштування → Про застосунок можна скопіювати деталі для звіту про помилку.',
      'Тепер можна написати відгук на hello@hzinchenko.com з Налаштування → Про застосунок.',
    ],
  },
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
