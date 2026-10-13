import type { Card, Level } from './types';

export const MAX_LEVEL: Level = 5;

/**
 * Level transition after a grade.
 * - Know: New jumps to Learning, otherwise +1 (capped at Mastered).
 * - Don't know: New goes to Weak, otherwise -1 (never back to New).
 */
export function nextLevel(level: Level, known: boolean): Level {
  if (level === 0) return known ? 2 : 1;
  if (known) return Math.min(level + 1, MAX_LEVEL) as Level;
  return Math.max(level - 1, 1) as Level;
}

/** Fields to update on a card after it was graded. */
export function gradeUpdate(card: Card, known: boolean, now = Date.now()): Partial<Card> {
  return {
    level: nextLevel(card.level, known),
    timesSeen: card.timesSeen + 1,
    timesKnown: card.timesKnown + (known ? 1 : 0),
    timesMissed: card.timesMissed + (known ? 0 : 1),
    lastReviewedAt: now,
    updatedAt: now,
  };
}

/** Count cards per level, indexed by Level. */
export function levelCounts(cards: readonly Pick<Card, 'level'>[]): number[] {
  const counts = [0, 0, 0, 0, 0, 0];
  for (const c of cards) counts[c.level]++;
  return counts;
}
