import { swappedSpeech } from '../collections';
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

/** Swap front and back on every card in the deck, with the side languages; progress is kept. */
export async function swapDeckSides(id: string): Promise<void> {
  const now = Date.now();
  await db.transaction('rw', db.decks, db.cards, async () => {
    const deck = await db.decks.get(id);
    if (!deck) return;
    await db.cards.where('deckId').equals(id).modify((c) => {
      [c.front, c.back] = [c.back, c.front];
      c.updatedAt = now;
    });
    await db.decks.update(id, { speech: swappedSpeech(deck.speech), updatedAt: now });
  });
}

/** Move a deck and its cards to "Recently deleted"; undo with restoreTrash(id). */
export async function deleteDeck(id: string, now = Date.now()): Promise<void> {
  await db.transaction('rw', [db.decks, db.cards, db.collections, db.trash], async () => {
    const deck = await db.decks.get(id);
    if (!deck) return;
    const collection = await db.collections.get(deck.collectionId);
    const cards = await db.cards.where('deckId').equals(id).toArray();
    await db.trash.put({ id, kind: 'deck', name: deck.name, deletedAt: now, collections: collection ? [collection] : [], decks: [deck], cards, tags: [] });
    await db.cards.where('deckId').equals(id).delete();
    await db.decks.delete(id);
  });
}
