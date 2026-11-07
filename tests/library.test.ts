import { beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_COLLECTION_ID } from '../src/lib/collections';
import { db } from '../src/lib/db';
import { createBackup, parseBackup } from '../src/lib/io/json';
import { addCards, deckCards } from '../src/lib/repo/cards';
import { createCollection, setCollectionLanguages } from '../src/lib/repo/collections';
import { createDeck, setDeckSpeech } from '../src/lib/repo/decks';
import { importMerge, importReplace, loadLibrary } from '../src/lib/repo/library';
import { createTag } from '../src/lib/repo/tags';
import { PRESET_TAG_IDS } from '../src/lib/types';
import { resetDb, seedV1, seedV2 } from './dbHelpers';

beforeEach(resetDb);

/** A small library: one collection with reading aloud, a deck, two cards with a custom tag. */
async function seed() {
  const k = await createCollection('Japanese');
  await setCollectionLanguages(k, [{ lang: 'ja-JP' }]);
  const d = await createDeck('N5', k);
  await setDeckSpeech(d, { front: 'ja-JP' });
  const tag = await createTag('JLPT');
  await addCards(d, [
    { front: '猫', back: 'cat', notes: 'neko', tags: [tag.id, 'noun'] },
    { front: '食べる', back: 'to eat', tags: ['verb'] },
  ]);
  return { k, d, tag };
}

const exportText = async () => JSON.stringify(createBackup(await loadLibrary(), 1));
const sortById = <T extends { id: string }>(xs: T[]) => [...xs].sort((a, b) => a.id.localeCompare(b.id));
const snapshot = async () => {
  const lib = await loadLibrary();
  return { collections: sortById(lib.collections), decks: sortById(lib.decks), cards: sortById(lib.cards), tags: sortById(lib.tags) };
};

describe('export → import', () => {
  it('replace restores the library exactly on an empty device', async () => {
    await seed();
    const before = await snapshot();
    const text = await exportText();
    await resetDb();
    await importReplace(parseBackup(text));
    expect(await snapshot()).toEqual(before);
  });

  it('replace drops what was here and keeps the preset tags', async () => {
    await seed();
    const text = JSON.stringify(createBackup({ collections: [], decks: [], cards: [], tags: [] }));
    await importReplace(parseBackup(text));
    expect(await db.cards.count()).toBe(0);
    expect(await db.decks.count()).toBe(0);
    expect((await db.tags.toArray()).map((t) => t.id).sort()).toEqual([...PRESET_TAG_IDS].sort());
  });

  it('merge adds new records, keeps newer local ones and maps tags by name', async () => {
    const { d } = await seed();
    const text = await exportText();
    // Here: edit one card later than the backup, delete the custom tag and make one with the same name.
    const [neko, taberu] = await deckCards(d);
    await db.cards.update(neko.id, { back: 'kitty', updatedAt: neko.updatedAt + 1000 });
    await db.cards.delete(taberu.id);
    const oldTag = neko.tags.find((t) => t !== 'noun')!;
    await db.tags.delete(oldTag);
    const newTag = await createTag('jlpt');
    await db.cards.update(neko.id, { tags: [newTag.id] });

    await importMerge(parseBackup(text));
    const cards = await deckCards(d);
    expect(cards.map((c) => c.back)).toEqual(['kitty', 'to eat']);
    expect(cards[1].id).toBe(taberu.id);
    expect(await db.tags.get(oldTag)).toBeUndefined();
  });

  it('merge maps backup tags onto a local tag with the same name', async () => {
    await seed();
    const text = await exportText();
    await resetDb();
    const local = await createTag('jlpt');
    await importMerge(parseBackup(text));
    const neko = (await db.cards.toArray()).find((c) => c.front === '猫')!;
    expect(neko.tags.sort()).toEqual([local.id, 'noun'].sort());
    expect(await db.tags.where('name').equalsIgnoreCase('jlpt').count()).toBe(1);
  });

  it('merging twice changes nothing', async () => {
    await seed();
    const text = await exportText();
    await importMerge(parseBackup(text));
    const once = await snapshot();
    await importMerge(parseBackup(text));
    expect(await snapshot()).toEqual(once);
  });

  it('a version 1 file goes into the default collection', async () => {
    const v1 = JSON.stringify({
      app: 'flashcards-pwa', schemaVersion: 1, exportedAt: 1, tags: [],
      decks: [{ id: 'd1', name: 'Old', position: 0, createdAt: 1, updatedAt: 1 }],
      cards: [{ id: 'c1', deckId: 'd1', front: 'a', back: 'b', tags: [], position: 0, level: 2 }],
    });
    await importMerge(parseBackup(v1, 1, { defaultCollectionName: 'My decks' }));
    expect((await db.collections.toArray()).map((c) => [c.id, c.name])).toEqual([[DEFAULT_COLLECTION_ID, 'My decks']]);
    expect((await db.decks.get('d1'))!.collectionId).toBe(DEFAULT_COLLECTION_ID);
    expect((await db.cards.get('c1'))!.level).toBe(2);
  });
});

describe('database upgrade', () => {
  it('v1 → v2 puts existing decks into one collection and keeps cards', async () => {
    await seedV1({
      decks: [{ id: 'd1', name: 'A', position: 0, createdAt: 1, updatedAt: 1 }, { id: 'd2', name: 'B', position: 1, createdAt: 1, updatedAt: 1 }],
      cards: [{ id: 'c1', deckId: 'd1', front: 'a', back: 'b', tags: ['verb'], position: 0, level: 3, timesSeen: 4, timesKnown: 3, timesMissed: 1, createdAt: 1, updatedAt: 1 }],
      tags: [{ id: 'verb', name: 'verb', preset: true, createdAt: 1 }],
    });
    await db.open();
    const collections = await db.collections.toArray();
    expect(collections).toHaveLength(1);
    expect(collections[0]).toMatchObject({ id: DEFAULT_COLLECTION_ID, languages: [] });
    expect((await db.decks.where('collectionId').equals(DEFAULT_COLLECTION_ID).toArray()).map((d) => d.id)).toEqual(['d1', 'd2']);
    expect(await db.cards.get('c1')).toMatchObject({ level: 3, timesSeen: 4 });
    expect(await deckCards('d1')).toHaveLength(1);
  });

  it('an empty v1 database gets no collection', async () => {
    await seedV1({ tags: [{ id: 'verb', name: 'verb', preset: true, createdAt: 1 }] });
    await db.open();
    expect(await db.collections.count()).toBe(0);
    expect(await db.tags.count()).toBe(1);
  });

  it('v2 → v3 keeps the library and starts with nothing in "Recently deleted"', async () => {
    await seedV2({
      collections: [{ id: 'k1', name: 'K', position: 0, languages: [], createdAt: 1, updatedAt: 1 }],
      decks: [{ id: 'd1', name: 'A', collectionId: 'k1', position: 0, createdAt: 1, updatedAt: 1 }],
      cards: [{ id: 'c1', deckId: 'd1', front: 'a', back: 'b', tags: [], position: 0, level: 2, timesSeen: 1, timesKnown: 1, timesMissed: 0, createdAt: 1, updatedAt: 1 }],
      tags: [{ id: 'verb', name: 'verb', preset: true, createdAt: 1 }],
    });
    await db.open();
    expect(db.verno).toBe(3);
    expect(await db.cards.get('c1')).toMatchObject({ deckId: 'd1', level: 2 });
    expect(await db.decks.get('d1')).toMatchObject({ collectionId: 'k1' });
    expect(await db.trash.count()).toBe(0);
  });
});
