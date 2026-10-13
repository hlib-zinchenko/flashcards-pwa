import { describe, expect, it } from 'vitest';
import { BackupError, createBackup, parseBackup, planMerge, type Library } from '../src/lib/io/json';
import type { Deck, Tag } from '../src/lib/types';
import { card } from './helpers';

const deck = (id: string, updatedAt = 0): Deck => ({ id, name: id, position: 0, createdAt: 0, updatedAt });
const tag = (id: string, name: string): Tag => ({ id, name, preset: false, createdAt: 0 });

describe('parseBackup', () => {
  it('round-trips a backup', () => {
    const lib: Library = { decks: [deck('d1')], cards: [card({ deckId: 'd1', tags: ['verb', 't1'], notes: 'irregular' })], tags: [tag('t1', 'N5')] };
    expect(parseBackup(JSON.stringify(createBackup(lib, 5)))).toEqual(createBackup(lib, 5));
  });
  it('rejects foreign files', () => {
    expect(() => parseBackup('nope')).toThrow(BackupError);
    expect(() => parseBackup('{"app":"other"}')).toThrow(BackupError);
    expect(() => parseBackup('{"app":"flashcards-pwa","schemaVersion":99,"decks":[],"cards":[],"tags":[]}')).toThrow(/version/);
  });
  it('rejects cards pointing to missing decks', () => {
    const text = JSON.stringify(createBackup({ decks: [], cards: [card({ deckId: 'zz' })], tags: [] }));
    expect(() => parseBackup(text)).toThrow(/deck/);
  });
  it('fills defaults and drops unknown tag ids', () => {
    const text = JSON.stringify({
      app: 'flashcards-pwa', schemaVersion: 1, tags: [],
      decks: [{ id: 'd', name: 'D' }],
      cards: [{ id: 'c', deckId: 'd', front: 'f', back: 'b', level: 9, tags: ['noun', 'ghost'] }],
    });
    const b = parseBackup(text, 7);
    expect(b.cards[0]).toMatchObject({ level: 0, tags: ['noun'], timesSeen: 0, createdAt: 7 });
    expect(b.decks[0]).toMatchObject({ position: 0, updatedAt: 7 });
  });
});

describe('planMerge', () => {
  it('keeps newer records and adds missing ones', () => {
    const local: Library = {
      decks: [deck('d1', 10)],
      cards: [card({ id: 'c1', updatedAt: 10 }), card({ id: 'c2', updatedAt: 10 })],
      tags: [],
    };
    const incoming = createBackup({
      decks: [deck('d1', 5), deck('d2', 5)],
      cards: [card({ id: 'c1', updatedAt: 20 }), card({ id: 'c2', updatedAt: 1 }), card({ id: 'c3' })],
      tags: [],
    });
    const plan = planMerge(local, incoming);
    expect(plan.decks.map((d) => d.id)).toEqual(['d2']);
    expect(plan.cards.map((c) => c.id)).toEqual(['c1', 'c3']);
  });
  it('maps tags with the same name onto local tags', () => {
    const local: Library = { decks: [], cards: [], tags: [tag('local', 'N5')] };
    const incoming = createBackup({
      decks: [deck('d1')],
      cards: [card({ id: 'c', tags: ['remote', 'other'] })],
      tags: [tag('remote', 'n5'), tag('other', 'Food')],
    });
    const plan = planMerge(local, incoming);
    expect(plan.tags.map((t) => t.id)).toEqual(['other']);
    expect(plan.cards[0].tags).toEqual(['local', 'other']);
  });
});
