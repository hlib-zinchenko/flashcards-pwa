import { describe, expect, it } from 'vitest';
import { gradeUpdate, levelCounts, nextLevel } from '../src/lib/learning';
import { card } from './helpers';

describe('nextLevel', () => {
  it('moves New to Learning on know and Weak on miss', () => {
    expect(nextLevel(0, true)).toBe(2);
    expect(nextLevel(0, false)).toBe(1);
  });
  it('steps up by one and caps at Mastered', () => {
    expect(nextLevel(2, true)).toBe(3);
    expect(nextLevel(4, true)).toBe(5);
    expect(nextLevel(5, true)).toBe(5);
  });
  it('steps down by one and never returns to New', () => {
    expect(nextLevel(5, false)).toBe(4);
    expect(nextLevel(2, false)).toBe(1);
    expect(nextLevel(1, false)).toBe(1);
  });
});

describe('gradeUpdate', () => {
  it('updates counters and timestamps', () => {
    const c = card({ level: 3, timesSeen: 4, timesKnown: 3, timesMissed: 1 });
    expect(gradeUpdate(c, false, 99)).toEqual({
      level: 2, timesSeen: 5, timesKnown: 3, timesMissed: 2, lastReviewedAt: 99, updatedAt: 99,
    });
  });
});

describe('levelCounts', () => {
  it('counts per level', () => {
    expect(levelCounts([card({ level: 0 }), card({ level: 0 }), card({ level: 5 })])).toEqual([2, 0, 0, 0, 0, 1]);
  });
});
