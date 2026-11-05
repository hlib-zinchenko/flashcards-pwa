import { db, newId } from '../db';
import type { DeckSpeech } from '../types';

export async function createDeck(name: string, collectionId: string): Promise<string> {
  const now = Date.now();
  const last = await db.decks.orderBy('position').last();
  const id = newId();
  await db.decks.add({ id, name: name.trim(), collectionId, position: last ? last.position + 1 : 0, createdAt: now, updatedAt: now });
  return id;
}

export async function renameDeck(id: string, name: string): Promise<void> {
  await db.decks.update(id, { name: name.trim(), updatedAt: Date.now() });
}

/** Sides keep their language; one the new collection doesn't have is simply not read. */
export async function moveDeck(id: string, collectionId: string): Promise<void> {
  await db.decks.update(id, { collectionId, updatedAt: Date.now() });
}

/** Language per card side; a missing side is not read aloud. */
export async function setDeckSpeech(id: string, speech: DeckSpeech): Promise<void> {
  const clean: DeckSpeech = {};
  if (speech.front) clean.front = speech.front;
  if (speech.back) clean.back = speech.back;
  await db.decks.update(id, { speech: clean, updatedAt: Date.now() });
}

export async function deleteDeck(id: string): Promise<void> {
  await db.transaction('rw', db.decks, db.cards, async () => {
    await db.cards.where('deckId').equals(id).delete();
    await db.decks.delete(id);
  });
}
