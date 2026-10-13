import Dexie from 'dexie';
import { db, newId } from '../db';
import { gradeUpdate } from '../learning';
import type { Card } from '../types';

export interface CardInput {
  front: string;
  back: string;
  tags: string[];
}

export function deckCards(deckId: string): Promise<Card[]> {
  return db.cards.where('[deckId+position]').between([deckId, Dexie.minKey], [deckId, Dexie.maxKey]).toArray();
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

export async function addCards(deckId: string, inputs: CardInput[]): Promise<void> {
  await db.transaction('rw', db.cards, async () => {
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
    if (input.deckId && input.deckId !== card.deckId) {
      changes.deckId = input.deckId;
      changes.position = await nextPosition(input.deckId);
    }
    await db.cards.update(id, changes);
  });
}

export async function deleteCard(id: string): Promise<void> {
  await db.cards.delete(id);
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
export async function gradeCard(id: string, known: boolean): Promise<Card | undefined> {
  return db.transaction('rw', db.cards, async () => {
    const card = await db.cards.get(id);
    if (!card) return undefined;
    const changes = gradeUpdate(card, known);
    await db.cards.update(id, changes);
    return { ...card, ...changes };
  });
}
