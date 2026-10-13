import { db } from '../db';
import { planMerge, type Backup, type Library } from '../io/json';
import { ensurePresetTags } from './tags';

export async function loadLibrary(): Promise<Library> {
  const [decks, cards, tags] = await Promise.all([db.decks.toArray(), db.cards.toArray(), db.tags.toArray()]);
  return { decks, cards, tags };
}

export async function importReplace(backup: Backup): Promise<void> {
  await db.transaction('rw', db.decks, db.cards, db.tags, async () => {
    await Promise.all([db.decks.clear(), db.cards.clear(), db.tags.clear()]);
    await db.tags.bulkPut(backup.tags);
    await db.decks.bulkPut(backup.decks);
    await db.cards.bulkPut(backup.cards);
    await ensurePresetTags();
  });
}

export async function importMerge(backup: Backup): Promise<void> {
  await db.transaction('rw', db.decks, db.cards, db.tags, async () => {
    const plan = planMerge(await loadLibrary(), backup);
    await db.tags.bulkPut(plan.tags);
    await db.decks.bulkPut(plan.decks);
    await db.cards.bulkPut(plan.cards);
  });
}
