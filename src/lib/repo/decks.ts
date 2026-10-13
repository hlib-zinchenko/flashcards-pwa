import { db, newId } from '../db';

export async function createDeck(name: string): Promise<string> {
  const now = Date.now();
  const last = await db.decks.orderBy('position').last();
  const id = newId();
  await db.decks.add({ id, name: name.trim(), position: last ? last.position + 1 : 0, createdAt: now, updatedAt: now });
  return id;
}

export async function renameDeck(id: string, name: string): Promise<void> {
  await db.decks.update(id, { name: name.trim(), updatedAt: Date.now() });
}

export async function deleteDeck(id: string): Promise<void> {
  await db.transaction('rw', db.decks, db.cards, async () => {
    await db.cards.where('deckId').equals(id).delete();
    await db.decks.delete(id);
  });
}
