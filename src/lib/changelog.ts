/**
 * In-app release notes, newest first. Shipped inside the build so they work offline and always match
 * the running version. Add an entry for each release with user-visible changes (skip ones without);
 * keep each line short, one change per line, in both languages.
 */
export type ChangelogEntry = { version: string; en: string[]; uk: string[] };

export const CHANGELOG: ChangelogEntry[] = [
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
  {
    version: '0.5.0',
    en: [
      'After an update, this sheet shows what changed. You can open it again from Settings → About.',
    ],
    uk: [
      'Після оновлення це вікно показує, що змінилося. Відкрити його знову можна в Налаштування → Про застосунок.',
    ],
  },
  {
    version: '0.4.0',
    en: [
      'Delete a card during a test: tap ✏️ (or swipe down) and use 🗑.',
      'When you swipe a card away, the one underneath slides into its place.',
      'All test options are always visible on the Test screen.',
      'The bottom bar shows icons only, each in a fixed place.',
    ],
    uk: [
      'Картку можна видалити під час тесту: натисніть ✏️ (або змахніть вниз) і 🗑.',
      'Коли ви змахуєте картку, та, що під нею, плавно стає на її місце.',
      'Усі налаштування тесту завжди видно на екрані «Тест».',
      'Нижня панель показує лише іконки, кожну на сталому місці.',
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
