import { db } from '../db';
import { planMerge, type Backup, type Library } from '../io/json';
import { ensurePresetTags } from './tags';

export async function loadLibrary(): Promise<Library> {
  const [collections, decks, cards, tags] = await Promise.all([
    db.collections.toArray(),
    db.decks.toArray(),
    db.cards.toArray(),
    db.tags.toArray(),
  ]);
  return { collections, decks, cards, tags };
}

export async function importReplace(backup: Backup): Promise<void> {
  await db.transaction('rw', db.collections, db.decks, db.cards, db.tags, async () => {
    await Promise.all([db.collections.clear(), db.decks.clear(), db.cards.clear(), db.tags.clear()]);
    await db.tags.bulkPut(backup.tags);
    await db.collections.bulkPut(backup.collections);
    await db.decks.bulkPut(backup.decks);
    await db.cards.bulkPut(backup.cards);
    await ensurePresetTags();
  });
}

export async function importMerge(backup: Backup): Promise<void> {
  await db.transaction('rw', db.collections, db.decks, db.cards, db.tags, async () => {
    const plan = planMerge(await loadLibrary(), backup);
    await db.tags.bulkPut(plan.tags);
    await db.collections.bulkPut(plan.collections);
    await db.decks.bulkPut(plan.decks);
    await db.cards.bulkPut(plan.cards);
  });
}
