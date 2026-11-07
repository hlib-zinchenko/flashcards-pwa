import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../src/lib/db';
import { createBackup, parseBackup } from '../src/lib/io/json';
import { addCards, DeckFullError, deckCards, deleteCard } from '../src/lib/repo/cards';
import { createCollection, deleteCollection } from '../src/lib/repo/collections';
import { createDeck, deleteDeck } from '../src/lib/repo/decks';
import { importReplace, loadLibrary } from '../src/lib/repo/library';
import { createTag, deleteTag } from '../src/lib/repo/tags';
import { deleteForever, purgeTrash, restoreTrash, trashItems } from '../src/lib/repo/trash';
import { MAX_DECK_CARDS, TRASH_DAYS } from '../src/lib/types';
import { resetDb } from './dbHelpers';

const input = (front: string, tags: string[] = []) => ({ front, back: `${front}-back`, tags });
const DAY = 86_400_000;

beforeEach(resetDb);

async function seed() {
  const k = await createCollection('Japanese');
  const d = await createDeck('Verbs', k);
  await addCards(d, [input('食べる', ['verb']), input('飲む'), input('見る')]);
  return { k, d, cards: await deckCards(d) };
}

describe('deleting a card', () => {
  it('moves it to "Recently deleted" and restores it in its place, with its progress', async () => {
    const { d, cards } = await seed();
    await db.cards.update(cards[1].id, { level: 3, timesSeen: 5 });
    await deleteCard(cards[1].id, 1000);
    expect((await deckCards(d)).map((c) => c.front)).toEqual(['食べる', '見る']);
    expect(await trashItems()).toMatchObject([{ id: cards[1].id, kind: 'card', name: '飲む', deletedAt: 1000 }]);

    await restoreTrash(cards[1].id);
    expect((await deckCards(d)).map((c) => c.front)).toEqual(['食べる', '飲む', '見る']);
    expect(await db.cards.get(cards[1].id)).toMatchObject({ level: 3, timesSeen: 5 });
    expect(await db.trash.count()).toBe(0);
  });

  it('goes to the end when its place was taken', async () => {
    const { d, cards } = await seed();
    await deleteCard(cards[2].id);
    await addCards(d, [input('寝る')]); // takes position 2
    await restoreTrash(cards[2].id);
    expect((await deckCards(d)).map((c) => c.front)).toEqual(['食べる', '飲む', '寝る', '見る']);
  });

  it('brings back its deck and collection when they were deleted since', async () => {
    const { k, d, cards } = await seed();
    await deleteCard(cards[0].id);
    await deleteCollection(k);
    await restoreTrash(cards[0].id);
    expect(await db.collections.get(k)).toMatchObject({ name: 'Japanese' });
    expect(await db.decks.get(d)).toMatchObject({ name: 'Verbs', collectionId: k });
    expect((await deckCards(d)).map((c) => c.front)).toEqual(['食べる']);
    // The collection is still in "Recently deleted" with the other two cards.
    expect((await trashItems()).map((i) => i.kind)).toEqual(['collection']);
  });

  it("drops tags deleted since and won't overfill a deck", async () => {
    const tag = await createTag('jlpt');
    const k = await createCollection('K');
    const d = await createDeck('D', k);
    await addCards(d, [input('a', [tag.id, 'verb'])]);
    const [a] = await deckCards(d);
    await deleteCard(a.id);
    await deleteTag(tag.id);
    await restoreTrash(a.id);
    expect((await db.cards.get(a.id))!.tags).toEqual(['verb']);

    await deleteCard(a.id);
    await addCards(d, Array.from({ length: MAX_DECK_CARDS }, (_, i) => input(`w${i}`)));
    await expect(restoreTrash(a.id)).rejects.toBeInstanceOf(DeckFullError);
    expect(await db.trash.get(a.id)).toBeDefined();
  });
});

describe('deleting a deck or collection', () => {
  it('restores a deck with all its cards', async () => {
    const { k, d } = await seed();
    const other = await createDeck('Nouns', k);
    await deleteDeck(d);
    expect(await db.cards.count()).toBe(0);
    await restoreTrash(d);
    expect((await db.decks.where('collectionId').equals(k).sortBy('position')).map((x) => x.id)).toEqual([d, other]);
    expect(await deckCards(d)).toHaveLength(3);
  });

  it('restores a collection with its decks and cards', async () => {
    const { k, d } = await seed();
    await deleteCollection(k);
    expect(await db.decks.count()).toBe(0);
    expect(await trashItems()).toMatchObject([{ kind: 'collection', name: 'Japanese' }]);
    await restoreTrash(k);
    expect(await db.collections.get(k)).toBeDefined();
    expect(await deckCards(d)).toHaveLength(3);
  });
});

describe('replacing the library', () => {
  it('keeps the old library, and restoring it keeps the replaced one in turn', async () => {
    await seed();
    const before = await loadLibrary();
    const other = parseBackup(JSON.stringify(createBackup({ collections: [], decks: [], cards: [], tags: [] })), 1, { defaultCollectionName: 'x' });
    await importReplace(other);
    expect(await db.cards.count()).toBe(0);
    const [item] = await trashItems();
    expect(item).toMatchObject({ kind: 'library' });
    expect(item.cards).toHaveLength(3);

    await restoreTrash(item.id);
    expect(await loadLibrary()).toEqual(before);
    // The empty library it replaced isn't worth keeping.
    expect(await db.trash.count()).toBe(0);
  });

  it('keeps only the latest library', async () => {
    await seed();
    const backup = parseBackup(JSON.stringify(createBackup(await loadLibrary())), 1, { defaultCollectionName: 'x' });
    await importReplace(backup);
    await importReplace(backup);
    expect((await trashItems()).filter((i) => i.kind === 'library')).toHaveLength(1);
  });
});

describe('clean-up', () => {
  it(`removes items after ${TRASH_DAYS} days`, async () => {
    const { cards } = await seed();
    const now = 100 * DAY;
    await deleteCard(cards[0].id, now - TRASH_DAYS * DAY - 1);
    await deleteCard(cards[1].id, now - TRASH_DAYS * DAY + 1);
    await purgeTrash(now);
    expect((await trashItems()).map((i) => i.name)).toEqual(['飲む']);
  });

  it('deletes an item for good', async () => {
    const { d } = await seed();
    await deleteDeck(d);
    await deleteForever(d);
    expect(await db.trash.count()).toBe(0);
  });

  it('is not part of a backup', async () => {
    const { d } = await seed();
    await deleteDeck(d);
    expect(Object.keys(await loadLibrary()).sort()).toEqual(['cards', 'collections', 'decks', 'tags']);
  });
});
