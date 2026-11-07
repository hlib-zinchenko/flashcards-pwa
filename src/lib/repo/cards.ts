import Dexie from 'dexie';
import { db, newId } from '../db';
import { gradeFields, gradeUpdate } from '../learning';
import { MAX_DECK_CARDS, type Card } from '../types';

/** The deck can't take that many more cards; `room` is how many still fit. */
export class DeckFullError extends Error {
  constructor(readonly room: number) {
    super(`Deck is full: room for ${room} more`);
  }
}

/** Throw DeckFullError unless `adding` more cards fit in the deck. Call inside a transaction on db.cards. */
async function checkRoom(deckId: string, adding: number): Promise<void> {
  const room = Math.max(0, MAX_DECK_CARDS - (await db.cards.where('deckId').equals(deckId).count()));
  if (adding > room) throw new DeckFullError(room);
}

export interface CardInput {
  front: string;
  back: string;
  notes?: string;
  tags: string[];
}

export function deckCards(deckId: string): Promise<Card[]> {
  return db.cards.where('[deckId+position]').between([deckId, Dexie.minKey], [deckId, Dexie.maxKey]).toArray();
}

/** Every card in these decks, in deck order. */
export async function cardsInDecks(deckIds: string[]): Promise<Card[]> {
  if (deckIds.length === 0) return [];
  const found = await db.cards.where('deckId').anyOf(deckIds).toArray();
  const order = new Map(deckIds.map((id, i) => [id, i]));
  return found.sort((a, b) => order.get(a.deckId)! - order.get(b.deckId)! || a.position - b.position);
}

async function nextPosition(deckId: string): Promise<number> {
  const last = await db.cards
    .where('[deckId+position]')
    .between([deckId, Dexie.minKey], [deckId, Dexie.maxKey])
    .last();
  return last ? last.position + 1 : 0;
}

function newCard(deckId: string, input: CardInput, position: number, now: number): Card {
  return {
    id: newId(),
    deckId,
    front: input.front.trim(),
    back: input.back.trim(),
    notes: (input.notes ?? '').trim(),
    tags: [...new Set(input.tags)],
    position,
    level: 0,
    timesSeen: 0,
    timesKnown: 0,
    timesMissed: 0,
    createdAt: now,
    updatedAt: now,
  };
}

/** Add cards at the end of the deck; all or none (DeckFullError when they don't fit). */
export async function addCards(deckId: string, inputs: CardInput[]): Promise<void> {
  await db.transaction('rw', db.cards, async () => {
    await checkRoom(deckId, inputs.length);
    const start = await nextPosition(deckId);
    const now = Date.now();
    await db.cards.bulkAdd(inputs.map((input, i) => newCard(deckId, input, start + i, now)));
  });
}

export async function addCard(deckId: string, input: CardInput): Promise<void> {
  await addCards(deckId, [input]);
}

export async function updateCard(id: string, input: CardInput & { deckId?: string }): Promise<void> {
  await db.transaction('rw', db.cards, async () => {
    const card = await db.cards.get(id);
    if (!card) return;
    const changes: Partial<Card> = {
      front: input.front.trim(),
      back: input.back.trim(),
      tags: [...new Set(input.tags)],
      updatedAt: Date.now(),
    };
    if (input.notes !== undefined) changes.notes = input.notes.trim();
    if (input.deckId && input.deckId !== card.deckId) {
      await checkRoom(input.deckId, 1);
      changes.deckId = input.deckId;
      changes.position = await nextPosition(input.deckId);
    }
    await db.cards.update(id, changes);
  });
}

/** Delete a card and return it as it was, so the delete can be undone with restoreCard. */
export async function deleteCard(id: string): Promise<Card | undefined> {
  return db.transaction('rw', db.cards, async () => {
    const card = await db.cards.get(id);
    await db.cards.delete(id);
    return card;
  });
}

/** Put back a card returned by deleteCard. Pass the plain object from the database, not a $state proxy. */
export async function restoreCard(card: Card): Promise<void> {
  await db.cards.put(card);
}

/** Swap the order of two cards in the same deck. */
export async function swapCards(a: Card, b: Card): Promise<void> {
  const now = Date.now();
  await db.transaction('rw', db.cards, async () => {
    await db.cards.update(a.id, { position: b.position, updatedAt: now });
    await db.cards.update(b.id, { position: a.position, updatedAt: now });
  });
}

export async function resetDeckProgress(deckId: string): Promise<void> {
  const now = Date.now();
  await db.cards.where('deckId').equals(deckId).modify({
    level: 0,
    timesSeen: 0,
    timesKnown: 0,
    timesMissed: 0,
    lastReviewedAt: undefined,
    updatedAt: now,
  });
}

/** Apply a grade and return the updated card. */
/** Undo a grade: write back the grade fields from the card as it was before. */
export async function restoreGrade(before: Card): Promise<void> {
  // An undefined lastReviewedAt removes the field, as on a never-reviewed card.
  await db.cards.update(before.id, gradeFields(before));
}

export async function gradeCard(id: string, known: boolean): Promise<Card | undefined> {
  return db.transaction('rw', db.cards, async () => {
    const card = await db.cards.get(id);
    if (!card) return undefined;
    const changes = gradeUpdate(card, known);
    await db.cards.update(id, changes);
    return { ...card, ...changes };
  });
}
