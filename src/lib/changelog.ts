/**
 * In-app release notes, newest first. Shipped inside the build so they work offline and always match
 * the running version. Add an entry for each release with user-visible changes (skip ones without);
 * keep each line short, one change per line, in en and uk (other languages show the English lines).
 * Keep only the latest MAX_ENTRIES releases: older ones live on the GitHub releases page, which the dialog links to.
 */
export const MAX_ENTRIES = 3;
export const RELEASES_URL = 'https://github.com/hlib-zinchenko/karbka/releases';
export type ChangelogEntry = { version: string; en: string[]; uk: string[] };

export const CHANGELOG: ChangelogEntry[] = [
  {
    version: '1.0.1',
    en: [
      'New guide: how to import cards from Excel, Google Sheets, Numbers or Quizlet, at karbka.com/csv.',
      'Installing on Android now shows pictures of the app first.',
      'The voices hint in Settings now points to the right button: ⋯ at the top of a collection.',
    ],
    uk: [
      'Новий посібник: як імпортувати картки з Excel, Google Таблиць, Numbers чи Quizlet, на karbka.com/ua/csv.',
      'Під час встановлення на Android тепер видно знімки застосунку.',
      'Підказка про голоси в Налаштуваннях тепер вказує на правильну кнопку: ⋯ угорі колекції.',
    ],
  },
  {
    version: '1.0.0',
    en: [
      'The app has a name now: Karbka. Carve it into memory.',
      'It has a new address too: app.karbka.com. Add it to your home screen from here.',
      'Coming from flashcards.hzinchenko.com? Open the app there: it moves your cards here in one tap, or by a backup file on iPhone.',
      'Once a day the app now sends one anonymous count to our own server, to see whether Karbka is used and on which devices. Never your cards, no ID. Settings → Usage counts explains it and turns it off.',
    ],
    uk: [
      'У застосунку тепер є назва: Карбка. Закарбуй у памʼяті.',
      'І нова адреса: app.karbka.com. Додайте її на початковий екран звідси.',
      'Користувались flashcards.hzinchenko.com? Відкрийте застосунок там: він перенесе картки сюди одним дотиком, а на iPhone через файл копії.',
      'Раз на день застосунок тепер надсилає один анонімний лічильник на наш власний сервер, щоб ми бачили, чи користуються Карбкою і на яких пристроях. Ніколи не картки, без ідентифікаторів. Налаштування → Статистика використання пояснює це й дає вимкнути.',
    ],
  },
  {
    version: '0.17.0',
    en: [
      'Deleted cards, decks and collections can be restored for 30 days: Settings → Recently deleted.',
      '“Replace everything” on import keeps your old library there too, so you can switch back.',
      'Deleting a deck or a collection can be undone right away.',
      'The app reminds you to export a backup after a week of studying without one.',
    ],
    uk: [
      'Видалені картки, колоди й колекції можна відновити протягом 30 днів: Налаштування → Нещодавно видалені.',
      '«Замінити все» під час імпорту теж зберігає там стару бібліотеку, тож до неї можна повернутися.',
      'Видалення колоди чи колекції можна одразу скасувати.',
      'Застосунок нагадає зробити резервну копію, якщо ви навчаєтеся понад тиждень без неї.',
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
