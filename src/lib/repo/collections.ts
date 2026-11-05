import { db, newId } from '../db';
import type { CollectionLanguage } from '../types';

export async function createCollection(name: string): Promise<string> {
  const now = Date.now();
  const last = await db.collections.orderBy('position').last();
  const id = newId();
  await db.collections.add({ id, name: name.trim(), position: last ? last.position + 1 : 0, languages: [], createdAt: now, updatedAt: now });
  return id;
}

export async function renameCollection(id: string, name: string): Promise<void> {
  await db.collections.update(id, { name: name.trim(), updatedAt: Date.now() });
}

/** Pass plain objects (copy $state with $state.snapshot first). */
export async function setCollectionLanguages(id: string, languages: CollectionLanguage[]): Promise<void> {
  await db.collections.update(id, {
    languages: languages.map((l) => (l.voiceURI ? { lang: l.lang, voiceURI: l.voiceURI } : { lang: l.lang })),
    updatedAt: Date.now(),
  });
}

/** Deletes the collection with all its decks and their cards. */
export async function deleteCollection(id: string): Promise<void> {
  await db.transaction('rw', db.collections, db.decks, db.cards, async () => {
    const deckIds = (await db.decks.where('collectionId').equals(id).primaryKeys()) as string[];
    await db.cards.where('deckId').anyOf(deckIds).delete();
    await db.decks.bulkDelete(deckIds);
    await db.collections.delete(id);
  });
}
