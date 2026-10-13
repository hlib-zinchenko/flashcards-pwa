import { describe, expect, it } from 'vitest';
import { buildPool, DEFAULT_CONFIG, filterCards, Session, sortCards, summarize, type TestConfig } from '../src/lib/session';
import type { Level } from '../src/lib/types';
import { card, seeded } from './helpers';

const cfg = (over: Partial<TestConfig> = {}): TestConfig => ({ ...DEFAULT_CONFIG, deckIds: ['d1', 'd2'], ...over });

describe('filterCards', () => {
  const cards = [
    card({ id: 'a', deckId: 'd1', level: 0, tags: ['verb'] }),
    card({ id: 'b', deckId: 'd2', level: 3, tags: ['noun'] }),
    card({ id: 'c', deckId: 'd3', level: 0 }),
    card({ id: 'd', deckId: 'd1', level: 5 }),
  ];
  const ids = (c: TestConfig) => filterCards(cards, c).map((x) => x.id);

  it('filters by deck', () => expect(ids(cfg())).toEqual(['a', 'b', 'd']));
  it('filters by level', () => expect(ids(cfg({ levels: [0, 5] }))).toEqual(['a', 'd']));
  it('filters by any selected tag', () => expect(ids(cfg({ tagIds: ['verb', 'noun'] }))).toEqual(['a', 'b']));
  it('supports untagged', () => expect(ids(cfg({ includeUntagged: true }))).toEqual(['d']));
  it('combines tags and untagged', () => expect(ids(cfg({ tagIds: ['noun'], includeUntagged: true }))).toEqual(['b', 'd']));
});

describe('sortCards', () => {
  const deckOrder = new Map([['d1', 1], ['d2', 0]]);
  const cards = [
    card({ id: 'x', deckId: 'd1', position: 0, front: 'b', back: 'Z' }),
    card({ id: 'y', deckId: 'd1', position: 1, front: 'A', back: 'y' }),
    card({ id: 'z', deckId: 'd2', position: 5, front: 'c', back: 'x' }),
  ];
  const ids = (sort: TestConfig['sort'], direction: TestConfig['direction'] = 'front') =>
    sortCards(cards, { sort, direction }, deckOrder).map((c) => c.id);

  it('deck order uses deck position then card position', () => expect(ids('deck')).toEqual(['z', 'x', 'y']));
  it('sorts A→Z case-insensitively by prompt side', () => expect(ids('az')).toEqual(['y', 'x', 'z']));
  it('sorts Z→A', () => expect(ids('za')).toEqual(['z', 'x', 'y']));
  it('uses back side when direction is back', () => expect(ids('az', 'back')).toEqual(['z', 'y', 'x']));
  it('random is a permutation', () => {
    expect(sortCards(cards, { sort: 'random', direction: 'front' }, deckOrder, seeded(3)).map((c) => c.id).sort()).toEqual(['x', 'y', 'z']);
  });
});

describe('buildPool', () => {
  it('applies the limit after sorting', () => {
    const cards = ['d', 'b', 'a', 'c'].map((f, i) => card({ id: f, front: f, position: i }));
    expect(buildPool(cards, cfg({ sort: 'az', limit: 2 }), new Map()).map((c) => c.id)).toEqual(['a', 'b']);
    expect(buildPool(cards, cfg({ limit: null }), new Map())).toHaveLength(4);
  });
});

describe('Session (finite)', () => {
  it('shows each card once when all known', () => {
    const s = new Session(['a', 'b', 'c'], 'finite');
    const seen: string[] = [];
    while (!s.done) { seen.push(s.current!); s.grade(true); }
    expect(seen).toEqual(['a', 'b', 'c']);
    expect(s.firstTry.size).toBe(3);
  });

  it('re-queues missed cards until known', () => {
    const s = new Session(['a', 'b', 'c', 'd', 'e', 'f'], 'finite', { rng: () => 0 });
    expect(s.current).toBe('a');
    s.grade(false); // a goes 3 slots ahead: b c d a e f
    const seen: string[] = [];
    while (!s.done) { seen.push(s.current!); s.grade(true); }
    expect(seen).toEqual(['b', 'c', 'd', 'a', 'e', 'f']);
    expect(s.firstTry.has('a')).toBe(false);
    expect(s.missed.has('a')).toBe(true);
    expect(s.remaining).toBe(0);
  });

  it('puts a missed card at the end when few cards remain', () => {
    const s = new Session(['a', 'b'], 'finite', { rng: () => 0.99 });
    s.grade(false);
    expect(s.current).toBe('b');
    s.grade(true);
    expect(s.current).toBe('a');
  });

  it('repeats a single card until known', () => {
    const s = new Session(['a'], 'finite');
    s.grade(false);
    expect(s.current).toBe('a');
    s.grade(true);
    expect(s.done).toBe(true);
  });

  it('is done immediately for an empty pool', () => {
    expect(new Session([], 'finite').done).toBe(true);
    expect(new Session([], 'infinite').done).toBe(true);
  });
});

describe('Session (infinite)', () => {
  it('loops forever over the pool', () => {
    const s = new Session(['a', 'b'], 'infinite');
    const seen: string[] = [];
    for (let i = 0; i < 6; i++) { seen.push(s.current!); s.grade(true); }
    expect(seen).toEqual(['a', 'b', 'a', 'b', 'a', 'b']);
    expect(s.done).toBe(false);
  });

  it('never shows the same card twice in a row when reshuffling', () => {
    const s = new Session(['a', 'b', 'c'], 'infinite', { reshuffle: true, rng: seeded(7) });
    let prev = '';
    for (let i = 0; i < 300; i++) {
      expect(s.current).not.toBe(prev);
      prev = s.current!;
      s.grade(i % 3 !== 0);
    }
  });
});

describe('summarize', () => {
  it('counts level changes', () => {
    const s = new Session(['a', 'b', 'c'], 'finite');
    s.grade(true); s.grade(false); s.grade(true); s.grade(true);
    const start = new Map<string, Level>([['a', 0], ['b', 3], ['c', 5]]);
    const now = new Map<string, Level>([['a', 2], ['b', 3], ['c', 4]]);
    expect(summarize(s, start, now)).toEqual({
      answered: 4, known: 3, missed: 1, firstTry: 2, uniqueCards: 3, levelUps: 1, levelDowns: 1,
    });
  });
});
