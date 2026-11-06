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
    version: '0.8.0',
    en: [
      'The app now speaks 11 languages: English, Ukrainian, Spanish, German, French, Japanese, Portuguese, Italian, Turkish, Dutch and Chinese.',
      'Pick yours in Settings → Language, now a drop-down list.',
      'This sheet keeps the latest releases and links to the full history.',
    ],
    uk: [
      'Застосунок тепер 11 мовами: англійська, українська, іспанська, німецька, французька, японська, португальська, італійська, турецька, нідерландська та китайська.',
      'Обирайте мову в Налаштування → Мова, тепер це випадний список.',
      'Це вікно зберігає останні випуски й має посилання на повну історію.',
    ],
  },
  {
    version: '0.7.0',
    en: [
      'Collections: group decks by language or course. Your decks are now in “My decks”.',
      'The app opens on the collection you used last. Tap ‹ to see all collections.',
      'Reading aloud is set up per collection: add its languages and voices with ⚙.',
      'Then pick the language of the card front and back in each deck’s ⋯ → Reading aloud. Until then, cards aren’t read.',
      'Speed is a slider in Settings, with an English sample when you let go.',
    ],
    uk: [
      'Колекції: групуйте колоди за мовою чи курсом. Ваші колоди тепер у «Мої колоди».',
      'Застосунок відкривається на колекції, з якою ви працювали востаннє. Натисніть ‹, щоб побачити всі.',
      'Читання вголос налаштовується в колекції: додайте мови й голоси через ⚙.',
      'Потім у кожній колоді (⋯ → Читання вголос) виберіть мову лицьового та зворотного боку. Доти картки не читаються.',
      'Швидкість у Налаштуваннях тепер повзунок; відпустіть його, щоб почути приклад англійською.',
    ],
  },
  {
    version: '0.6.0',
    en: [
      'Hear a card: tap 🔊 on either side during a test (or press S). Works offline.',
      'Pick a voice for each language and the speed in Settings → Reading aloud.',
    ],
    uk: [
      'Картку можна послухати: натисніть 🔊 на будь-якому боці під час тесту (або S). Працює офлайн.',
      'Голос для кожної мови та швидкість можна вибрати в Налаштування → Читання вголос.',
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
