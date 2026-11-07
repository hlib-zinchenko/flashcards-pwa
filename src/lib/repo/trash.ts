import { db, newId } from '../db';
import { MAX_DECK_CARDS, TRASH_DAYS, type Card, type TrashItem } from '../types';
import { DeckFullError } from './cards';
import { ensurePresetTags } from './tags';

const DAY = 86_400_000;

/** Items in "Recently deleted", newest first. */
export async function trashItems(): Promise<TrashItem[]> {
  return (await db.trash.orderBy('deletedAt').toArray()).reverse();
}

/** Remove items deleted more than TRASH_DAYS ago. Run on launch. */
export async function purgeTrash(now = Date.now()): Promise<void> {
  await db.trash.where('deletedAt').below(now - TRASH_DAYS * DAY).delete();
}

export async function deleteForever(id: string): Promise<void> {
  await db.trash.delete(id);
}

/**
 * Keep the whole library in "Recently deleted" before it's replaced. Only the latest such copy is
 * kept (one is enough to undo an import, and a big library takes room). Call inside a transaction
 * on collections, decks, cards, tags and trash.
 */
export async function trashLibrary(now = Date.now()): Promise<void> {
  const [collections, decks, cards, tags] = await Promise.all([db.collections.toArray(), db.decks.toArray(), db.cards.toArray(), db.tags.toArray()]);
  if (collections.length === 0 && decks.length === 0 && cards.length === 0) return;
  await db.trash.where('kind').equals('library').delete();
  await db.trash.add({ id: newId(), kind: 'library', name: '', deletedAt: now, collections, decks, cards, tags });
}

/**
 * Put a deleted item back. A card or deck whose collection (or deck) is gone brings it back too. Things
 * go back to their old place when it's free, else to the end. Throws DeckFullError when cards don't fit
 * in a deck that still exists. A library replaces the current one, which goes to "Recently deleted" in
 * its place, so restoring can be undone the same way.
 */
export async function restoreTrash(id: string, now = Date.now()): Promise<void> {
  await db.transaction('rw', [db.collections, db.decks, db.cards, db.tags, db.trash], async () => {
    const item = await db.trash.get(id);
    if (!item) return;
    await db.trash.delete(id);
    if (item.kind === 'library') return restoreLibrary(item, now);

    for (const collection of item.collections) {
      if (await db.collections.get(collection.id)) continue;
      const taken = await db.collections.where('position').equals(collection.position).count();
      const position = taken ? ((await db.collections.orderBy('position').last())?.position ?? -1) + 1 : collection.position;
      await db.collections.add({ ...collection, position });
    }

    const existingDecks = new Set<string>();
    for (const deck of item.decks) {
      if (await db.decks.get(deck.id)) {
        existingDecks.add(deck.id);
        continue;
      }
      const taken = await db.decks.where('position').equals(deck.position).count();
      const position = taken ? ((await db.decks.orderBy('position').last())?.position ?? -1) + 1 : deck.position;
      await db.decks.add({ ...deck, position });
    }

    const tagIds = new Set((await db.tags.toCollection().primaryKeys()) as string[]);
    const byDeck = new Map<string, Card[]>();
    for (const card of item.cards) {
      if (await db.cards.get(card.id)) continue;
      const list = byDeck.get(card.deckId);
      if (list) list.push(card);
      else byDeck.set(card.deckId, [card]);
    }
    for (const [deckId, cards] of byDeck) {
      if (!(await db.decks.get(deckId))) continue; // can't happen for items this app wrote
      // A deck restored whole keeps all its cards, as a backup from before the limit would.
      if (existingDecks.has(deckId)) {
        const room = Math.max(0, MAX_DECK_CARDS - (await db.cards.where('deckId').equals(deckId).count()));
        if (cards.length > room) throw new DeckFullError(room);
      }
      let end: number | null = null;
      for (const card of cards) {
        let position = card.position;
        if (await db.cards.where('[deckId+position]').equals([deckId, position]).count()) {
          end ??= ((await db.cards.where('deckId').equals(deckId).sortBy('position')).at(-1)?.position ?? -1) + 1;
          position = end++;
        }
        await db.cards.add({ ...card, position, tags: card.tags.filter((t) => tagIds.has(t)) });
      }
    }
  });
}

async function restoreLibrary(item: TrashItem, now: number): Promise<void> {
  await trashLibrary(now);
  await Promise.all([db.collections.clear(), db.decks.clear(), db.cards.clear(), db.tags.clear()]);
  await db.tags.bulkPut(item.tags);
  await db.collections.bulkPut(item.collections);
  await db.decks.bulkPut(item.decks);
  await db.cards.bulkPut(item.cards);
  await ensurePresetTags();
}
