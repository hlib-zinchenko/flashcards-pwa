import Dexie from 'dexie';
import { db } from '../src/lib/db';

/** Start each test from a fresh database (preset tags only), as on a first launch. */
export async function resetDb(): Promise<void> {
  db.close();
  await Dexie.delete(db.name);
  await db.open();
}

/** Write a database as app versions before collections (v1) left it, then close it. */
export async function seedV1(data: { decks?: object[]; cards?: object[]; tags?: object[] }): Promise<void> {
  db.close();
  await Dexie.delete(db.name);
  const old = new Dexie(db.name);
  old.version(1).stores({
    decks: 'id, position',
    cards: 'id, deckId, [deckId+position], level, *tags',
    tags: 'id, name',
  });
  await old.open();
  await old.table('decks').bulkAdd(data.decks ?? []);
  await old.table('cards').bulkAdd(data.cards ?? []);
  await old.table('tags').bulkAdd(data.tags ?? []);
  old.close();
}
