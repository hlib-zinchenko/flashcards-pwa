import { describe, expect, it } from 'vitest';
import { DEFAULT_COLLECTION_ID } from '../src/lib/collections';
import { BackupError, createBackup, parseBackup, planMerge, type Library } from '../src/lib/io/json';
import type { Collection, Deck, Tag } from '../src/lib/types';
import { card } from './helpers';

const collection = (id: string, updatedAt = 0, languages: Collection['languages'] = []): Collection => ({
  id, name: id, position: 0, languages, createdAt: 0, updatedAt,
});
const deck = (id: string, updatedAt = 0, collectionId = 'k1'): Deck => ({ id, name: id, collectionId, position: 0, createdAt: 0, updatedAt });
const tag = (id: string, name: string): Tag => ({ id, name, preset: false, createdAt: 0 });
const lib = (over: Partial<Library> = {}): Library => ({ collections: [collection('k1')], decks: [], cards: [], tags: [], ...over });

/** A file as written by app versions before collections. */
const v1 = (decks: unknown[], cards: unknown[] = []) => JSON.stringify({ app: 'flashcards-pwa', schemaVersion: 1, exportedAt: 1, tags: [], decks, cards });

describe('parseBackup', () => {
  it('round-trips a backup', () => {
    const library = lib({
      collections: [collection('k1', 0, [{ lang: 'ja-JP', voiceURI: 'Kyoko' }, { lang: 'uk-UA' }])],
      decks: [{ ...deck('d1'), speech: { front: 'ja-JP', back: 'uk-UA' } }],
      cards: [card({ deckId: 'd1', tags: ['verb', 't1'], notes: 'irregular' })],
      tags: [tag('t1', 'N5')],
    });
    expect(parseBackup(JSON.stringify(createBackup(library, 5)))).toEqual(createBackup(library, 5));
  });
  it('rejects foreign files', () => {
    expect(() => parseBackup('nope')).toThrow(BackupError);
    expect(() => parseBackup('{"app":"other"}')).toThrow(BackupError);
    expect(() => parseBackup('{"app":"flashcards-pwa","schemaVersion":99,"decks":[],"cards":[],"tags":[]}')).toThrow(/version/);
  });
  it('rejects cards pointing to missing decks', () => {
    const text = JSON.stringify(createBackup(lib({ cards: [card({ deckId: 'zz' })] })));
    expect(() => parseBackup(text)).toThrow(/deck/);
  });
  it('rejects decks pointing to missing collections', () => {
    const text = JSON.stringify(createBackup(lib({ decks: [deck('d1', 0, 'gone')] })));
    expect(() => parseBackup(text)).toThrow(/collection/);
  });
  it('fills defaults and drops unknown tag ids', () => {
    const text = JSON.stringify({
      app: 'flashcards-pwa', schemaVersion: 2, tags: [],
      collections: [{ id: 'k', name: 'K' }],
      decks: [{ id: 'd', name: 'D', collectionId: 'k' }],
      cards: [{ id: 'c', deckId: 'd', front: 'f', back: 'b', level: 9, tags: ['noun', 'ghost'] }],
    });
    const b = parseBackup(text, 7);
    expect(b.cards[0]).toMatchObject({ level: 0, tags: ['noun'], timesSeen: 0, createdAt: 7 });
    expect(b.decks[0]).toMatchObject({ position: 0, updatedAt: 7 });
    expect(b.decks[0].speech).toBeUndefined();
    expect(b.collections[0]).toMatchObject({ languages: [], position: 0, updatedAt: 7 });
  });
  it('drops malformed, duplicate and Russian languages', () => {
    const text = JSON.stringify({
      app: 'flashcards-pwa', schemaVersion: 2, tags: [], cards: [],
      collections: [{ id: 'k', name: 'K', languages: [{ lang: 'ja-JP', voiceURI: 'Kyoko' }, { lang: 'ja-jp' }, { lang: 'ru-RU' }, { lang: 5 }, 'x', { lang: 'uk-UA', voiceURI: '' }] }],
      decks: [{ id: 'd', name: 'D', collectionId: 'k', speech: { front: 'ja-JP', back: 'ru-RU' } }],
    });
    const b = parseBackup(text);
    expect(b.collections[0].languages).toEqual([{ lang: 'ja-JP', voiceURI: 'Kyoko' }, { lang: 'uk-UA' }]);
    expect(b.decks[0].speech).toEqual({ front: 'ja-JP' });
  });

  describe('version 1 files (before collections)', () => {
    it('puts every deck into one default collection with no languages', () => {
      const b = parseBackup(v1([{ id: 'd1', name: 'A' }, { id: 'd2', name: 'B' }], [{ id: 'c', deckId: 'd1', front: 'f', back: 'b' }]), 3, { defaultCollectionName: 'Мої колоди' });
      expect(b.schemaVersion).toBe(1);
      expect(b.collections).toEqual([{ id: DEFAULT_COLLECTION_ID, name: 'Мої колоди', position: 0, languages: [], createdAt: 3, updatedAt: 3 }]);
      expect(b.decks.map((d) => d.collectionId)).toEqual([DEFAULT_COLLECTION_ID, DEFAULT_COLLECTION_ID]);
      expect(b.cards).toHaveLength(1);
    });
    it('creates no collection for a file without decks', () => {
      expect(parseBackup(v1([])).collections).toEqual([]);
    });
  });
});

describe('planMerge', () => {
  it('keeps newer records and adds missing ones', () => {
    const local = lib({
      collections: [collection('k1', 10)],
      decks: [deck('d1', 10)],
      cards: [card({ id: 'c1', updatedAt: 10 }), card({ id: 'c2', updatedAt: 10 })],
    });
    const incoming = createBackup(lib({
      collections: [collection('k1', 5), collection('k2', 5)],
      decks: [deck('d1', 5), deck('d2', 5)],
      cards: [card({ id: 'c1', updatedAt: 20 }), card({ id: 'c2', updatedAt: 1 }), card({ id: 'c3' })],
    }));
    const plan = planMerge(local, incoming);
    expect(plan.collections.map((c) => c.id)).toEqual(['k2']);
    expect(plan.decks.map((d) => d.id)).toEqual(['d2']);
    expect(plan.cards.map((c) => c.id)).toEqual(['c1', 'c3']);
  });
  it('maps tags with the same name onto local tags', () => {
    const local = lib({ tags: [tag('local', 'N5')] });
    const incoming = createBackup(lib({
      decks: [deck('d1')],
      cards: [card({ id: 'c', tags: ['remote', 'other'] })],
      tags: [tag('remote', 'n5'), tag('other', 'Food')],
    }));
    const plan = planMerge(local, incoming);
    expect(plan.tags.map((t) => t.id)).toEqual(['other']);
    expect(plan.cards[0].tags).toEqual(['local', 'other']);
  });

  describe('a version 1 file', () => {
    const old = parseBackup(v1([{ id: 'd1', name: 'Verbs', updatedAt: 50 }, { id: 'd9', name: 'New', updatedAt: 50 }]), 0, { defaultCollectionName: 'My decks' });

    it('keeps the collection and reading aloud of decks this device already has', () => {
      const local = lib({ collections: [collection('jp', 0, [{ lang: 'ja-JP' }])], decks: [{ ...deck('d1', 10, 'jp'), speech: { front: 'ja-JP' } }] });
      const plan = planMerge(local, old);
      expect(plan.decks.find((d) => d.id === 'd1')).toMatchObject({ name: 'Verbs', collectionId: 'jp', speech: { front: 'ja-JP' } });
      expect(plan.decks.find((d) => d.id === 'd9')?.collectionId).toBe(DEFAULT_COLLECTION_ID);
      expect(plan.collections.map((c) => c.id)).toEqual([DEFAULT_COLLECTION_ID]);
    });
    it('adds no default collection when it already exists or no deck needs it', () => {
      const withDefault = lib({ collections: [collection(DEFAULT_COLLECTION_ID)] });
      expect(planMerge(withDefault, old).collections).toEqual([]);
      const known = lib({ collections: [collection('jp')], decks: [deck('d1', 99, 'jp'), deck('d9', 99, 'jp')] });
      expect(planMerge(known, old).collections).toEqual([]);
    });
  });
});
