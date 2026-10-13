import type { Card, Level } from '../src/lib/types';

let n = 0;
export function card(over: Partial<Card> = {}): Card {
  n++;
  return {
    id: `c${n}`,
    deckId: 'd1',
    front: `front ${n}`,
    back: `back ${n}`,
    tags: [],
    position: n,
    level: 0 as Level,
    timesSeen: 0,
    timesKnown: 0,
    timesMissed: 0,
    createdAt: 0,
    updatedAt: 0,
    ...over,
  };
}

/** Deterministic PRNG (mulberry32) */
export function seeded(seed = 1): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
