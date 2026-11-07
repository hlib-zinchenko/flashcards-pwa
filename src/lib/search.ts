import type { Card } from './types';

/**
 * Text in a form for matching words: Unicode-normalized (full-width and half-width forms match),
 * case-insensitive, with whitespace trimmed and collapsed. Empty = nothing to match.
 */
export function normalizeText(text: string): string {
  return text.normalize('NFKC').toLowerCase().replace(/\s+/g, ' ').trim();
}

/** A card with its texts normalized once, so searching a big collection while typing stays cheap. */
export interface SearchEntry {
  card: Card;
  front: string;
  back: string;
  notes: string;
}

export function searchEntries(cards: Card[]): SearchEntry[] {
  return cards.map((card) => ({ card, front: normalizeText(card.front), back: normalizeText(card.back), notes: normalizeText(card.notes ?? '') }));
}

/**
 * Cards whose front, back or notes contain `query`. The word itself comes first (a side equal to the
 * query), then sides starting with it, then the rest; ties keep the given order.
 */
export function searchCards(entries: SearchEntry[], query: string): Card[] {
  const q = normalizeText(query);
  if (!q) return [];
  const ranked: { card: Card; rank: number }[] = [];
  for (const e of entries) {
    const sides = [e.front, e.back];
    let rank: number;
    if (sides.includes(q)) rank = 0;
    else if (sides.some((s) => s.startsWith(q))) rank = 1;
    else if (sides.some((s) => s.includes(q)) || e.notes.includes(q)) rank = 2;
    else continue;
    ranked.push({ card: e.card, rank });
  }
  return ranked.sort((a, b) => a.rank - b.rank).map((r) => r.card);
}
