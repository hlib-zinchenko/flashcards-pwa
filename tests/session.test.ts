import { describe, expect, it } from 'vitest';
import { buildPool, DEFAULT_CONFIG, filterCards, isAll, normalizeConfig, pickFromAll, poolSize, quickConfig, scopeDeckIds, Session, sortCards, summarize, type TestConfig } from '../src/lib/session';
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
    card({ id: 'x', deckId: 'd1', position: 0, level: 3 }),
    card({ id: 'y', deckId: 'd1', position: 1, level: 1 }),
    card({ id: 'z', deckId: 'd2', position: 5, level: 3 }),
  ];
  const ids = (sort: TestConfig['sort']) => sortCards(cards, { sort }, deckOrder).map((c) => c.id);

  it('deck order uses deck position then card position', () => expect(ids('deck')).toEqual(['z', 'x', 'y']));
  it('level sorts ascending, ties in deck order', () => expect(ids('level')).toEqual(['y', 'z', 'x']));
  it('random is a permutation', () => {
    expect(sortCards(cards, { sort: 'random' }, deckOrder, seeded(3)).map((c) => c.id).sort()).toEqual(['x', 'y', 'z']);
  });
});

describe('buildPool', () => {
  it('applies the limit after sorting', () => {
    const cards = [3, 1, 0, 2].map((level, i) => card({ id: `l${level}`, level: level as Level, position: i }));
    expect(buildPool(cards, cfg({ sort: 'level', limit: 2 }), new Map()).map((c) => c.id)).toEqual(['l0', 'l1']);
    expect(buildPool(cards, cfg({ limit: null }), new Map())).toHaveLength(4);
  });
});

describe('poolSize', () => {
  const cards = [0, 1, 1, 4].map((level, i) => card({ id: `c${i}`, deckId: 'd1', level: level as Level }));
  it('counts matching cards', () => expect(poolSize(cards, cfg({ levels: [1, 4] }))).toBe(3));
  it('caps at the limit', () => expect(poolSize(cards, cfg({ limit: 2 }))).toBe(2));
  it('ignores a limit above the match count', () => expect(poolSize(cards, cfg({ limit: 50 }))).toBe(4));
});

describe('quickConfig', () => {
  const saved = cfg({ direction: 'back', mode: 'refresh', sort: 'random', limit: 20, levels: [5], tagIds: ['verb'], includeUntagged: true });

  it('resets the filters to the given decks and levels', () => {
    expect(quickConfig(saved, ['d2'], [0, 1])).toMatchObject({ deckIds: ['d2'], levels: [0, 1], tagIds: [], includeUntagged: false });
  });
  it('keeps direction, mode, order and count', () => {
    expect(quickConfig(saved, ['d2'])).toMatchObject({ direction: 'back', mode: 'refresh', sort: 'random', limit: 20, levels: DEFAULT_CONFIG.levels });
  });
  it('does not share arrays with its inputs', () => {
    const ids = ['d1'];
    const next = quickConfig(saved, ids);
    expect(next.deckIds).not.toBe(ids);
    expect(next.levels).not.toBe(DEFAULT_CONFIG.levels);
  });
});

describe('normalizeConfig', () => {
  it('replaces modes and orders from older versions', () => {
    const old = { mode: 'infinite', sort: 'az', limit: 20 } as unknown as Partial<TestConfig>;
    expect(normalizeConfig(old)).toMatchObject({ mode: 'cram', sort: 'deck', limit: 20 });
  });
});

describe('Session (cram)', () => {
  it('removes a deleted card from the pool, the queue and the counts', () => {
    const s = new Session(['a', 'b', 'c', 'd'], 'cram', { rng: () => 0 });
    s.grade(false); // a missed, requeued right after b: b a c d
    expect(s.current).toBe('b');
    s.remove('a');
    expect(s.pool).toEqual(['b', 'c', 'd']);
    expect(s.missed.has('a')).toBe(false);
    expect(s.canUndo).toBe(false);
    const seen: string[] = [];
    while (!s.done) { seen.push(s.current!); s.grade(true); }
    expect(seen).toEqual(['b', 'c', 'd']);
    expect(s.remaining).toBe(0);
  });

  it('moves on when the current card is removed', () => {
    const s = new Session(['a', 'b'], 'refresh');
    s.remove('a');
    expect(s.current).toBe('b');
    s.remove('b');
    expect(s.done).toBe(true);
  });

  it('shows each card once when all known', () => {
    const s = new Session(['a', 'b', 'c'], 'cram');
    const seen: string[] = [];
    while (!s.done) { seen.push(s.current!); s.grade(true); }
    expect(seen).toEqual(['a', 'b', 'c']);
    expect(s.firstTry.size).toBe(3);
    expect(s.completed).toBe(3);
  });

  it('puts missed cards back at a random spot until known', () => {
    // rng 0.5 with 5 cards left → index 1 + floor(2.5) = 3
    const s = new Session(['a', 'b', 'c', 'd', 'e', 'f'], 'cram', { rng: () => 0.5 });
    s.grade(false); // queue: b c d a e f
    const seen: string[] = [];
    while (!s.done) { seen.push(s.current!); s.grade(true); }
    expect(seen).toEqual(['b', 'c', 'd', 'a', 'e', 'f']);
    expect(s.firstTry.has('a')).toBe(false);
    expect(s.missed.has('a')).toBe(true);
    expect(s.completed).toBe(6);
  });

  it('never puts a missed card right next when others remain', () => {
    const s = new Session(['a', 'b'], 'cram', { rng: () => 0 });
    s.grade(false);
    expect(s.current).toBe('b');
    s.grade(true);
    expect(s.current).toBe('a');
  });

  it('can put a missed card at the very end', () => {
    const s = new Session(['a', 'b', 'c'], 'cram', { rng: () => 0.99 });
    s.grade(false);
    expect([s.current, (s.grade(true), s.current), (s.grade(true), s.current)]).toEqual(['b', 'c', 'a']);
  });

  it('repeats a single card until known', () => {
    const s = new Session(['a'], 'cram');
    s.grade(false);
    expect(s.current).toBe('a');
    s.grade(true);
    expect(s.done).toBe(true);
  });

  it('is done immediately for an empty pool', () => {
    expect(new Session([], 'cram').done).toBe(true);
    expect(new Session([], 'refresh').done).toBe(true);
  });

  it('ends after every card is known, whatever the misses', () => {
    const rng = seeded(7);
    const s = new Session(['a', 'b', 'c', 'd'], 'cram', { rng });
    let prev = '';
    for (let i = 0; i < 1000 && !s.done; i++) {
      expect(s.current).not.toBe(prev);
      prev = s.current!;
      s.grade(rng() < 0.4);
    }
    expect(s.done).toBe(true);
    expect(s.learned.size).toBe(4);
  });
});

describe('Session undo', () => {
  const state = (s: Session) => ({
    current: s.current,
    answered: s.answered,
    known: s.knownCount,
    completed: s.completed,
    learned: [...s.learned],
    missed: [...s.missed],
    firstTry: [...s.firstTry],
  });

  it('has nothing to undo before the first grade', () => {
    const s = new Session(['a', 'b'], 'cram');
    expect(s.canUndo).toBe(false);
    expect(s.undo()).toBeNull();
    expect(s.current).toBe('a');
  });

  it('restores the state before a know', () => {
    const s = new Session(['a', 'b', 'c'], 'cram');
    const before = state(s);
    s.grade(true);
    expect(s.undo()).toBe('a');
    expect(state(s)).toEqual(before);
    expect(s.canUndo).toBe(false);
  });

  it('takes a missed card back out of the queue', () => {
    const s = new Session(['a', 'b', 'c'], 'cram', { rng: () => 0.99 });
    s.grade(false); // queue: c a
    s.undo();
    const seen: string[] = [];
    while (!s.done) { seen.push(s.current!); s.grade(true); }
    expect(seen).toEqual(['a', 'b', 'c']);
    expect(s.missed.size).toBe(0);
    expect(s.firstTry.size).toBe(3);
  });

  it('undoes several grades in order, including the last one', () => {
    const s = new Session(['a', 'b'], 'refresh');
    s.grade(true);
    s.grade(false);
    expect(s.done).toBe(true);
    expect(s.undo()).toBe('b');
    expect(s.done).toBe(false);
    expect(s.undo()).toBe('a');
    expect(state(s)).toEqual(state(new Session(['a', 'b'], 'refresh')));
  });

  it('counts remaining cards', () => {
    const s = new Session(['a', 'b', 'c'], 'cram', { rng: () => 0 });
    s.grade(false);
    expect(s.remaining).toBe(3);
    s.grade(true);
    expect(s.remaining).toBe(2);
  });
});

describe('Session (refresh)', () => {
  it('shows every card exactly once and records misses', () => {
    const s = new Session(['a', 'b', 'c'], 'refresh');
    const seen: string[] = [];
    while (!s.done) { seen.push(s.current!); s.grade(seen.length !== 2); }
    expect(seen).toEqual(['a', 'b', 'c']);
    expect([...s.missed]).toEqual(['b']);
    expect(s.completed).toBe(3);
    expect(s.answered).toBe(3);
  });
});

describe('summarize', () => {
  it('counts level changes', () => {
    const s = new Session(['a', 'b', 'c'], 'cram');
    s.grade(true); s.grade(false); s.grade(true); s.grade(true);
    const start = new Map<string, Level>([['a', 0], ['b', 3], ['c', 5]]);
    const now = new Map<string, Level>([['a', 2], ['b', 3], ['c', 4]]);
    expect(summarize(s, start, now)).toEqual({
      answered: 4, known: 3, missed: 1, firstTry: 2, uniqueCards: 3, levelUps: 1, levelDowns: 1,
    });
  });
});

describe('scopeDeckIds', () => {
  it('drops decks from other collections', () => expect(scopeDeckIds(['a1', 'b1', 'a2'], ['a1', 'a2', 'a3'])).toEqual(['a1', 'a2']));
  it('selects the whole collection when none of its decks were chosen', () => expect(scopeDeckIds(['b1'], ['a1', 'a2'])).toEqual(['a1', 'a2']));
  it('selects the whole collection when nothing was chosen', () => expect(scopeDeckIds([], ['a1'])).toEqual(['a1']));
  it('keeps the selection for an empty collection', () => expect(scopeDeckIds(['b1'], [])).toEqual(['b1']));
});

describe('pickFromAll', () => {
  const all = ['a', 'b', 'c'];
  it('picks only the tapped one when everything was chosen', () => expect(pickFromAll(['a', 'b', 'c'], all, 'b')).toEqual(['b']));
  it('adds a chip in the order of all', () => expect(pickFromAll(['c'], all, 'a')).toEqual(['a', 'c']));
  it('removes a chosen chip', () => expect(pickFromAll(['a', 'c'], all, 'c')).toEqual(['a']));
  it('goes back to all when the last one is unticked', () => expect(pickFromAll(['b'], all, 'b')).toEqual(all));
  it('ignores ids that are not in all', () => expect(pickFromAll(['x', 'a'], all, 'b')).toEqual(['a', 'b']));
});

describe('isAll', () => {
  it('is true when every one is chosen', () => expect(isAll(['b', 'a'], ['a', 'b'])).toBe(true));
  it('is false when one is missing', () => expect(isAll(['a'], ['a', 'b'])).toBe(false));
  it('is false for an empty row', () => expect(isAll([], [])).toBe(false));
});
