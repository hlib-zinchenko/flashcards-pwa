import { normalizeText } from './search';
import type { Card } from './types';

/** Front text in a form for spotting the same word twice (see normalizeText). Empty = nothing to compare. */
export const normalizeFront = normalizeText;

/** Whether two card fronts are the same word. Two empty fronts are not. */
export function sameFront(a: string, b: string): boolean {
  const na = normalizeFront(a);
  return na !== '' && na === normalizeFront(b);
}

/** Cards by normalized front, for looking words up while typing without rescanning a big collection. */
export type FrontIndex = Map<string, Card[]>;

export function indexFronts(cards: Card[]): FrontIndex {
  const index: FrontIndex = new Map();
  for (const card of cards) {
    const key = normalizeFront(card.front);
    if (!key) continue;
    const list = index.get(key);
    if (list) list.push(card);
    else index.set(key, [card]);
  }
  return index;
}

/** Cards with the same front as `front`: those in `cards` first (scanned, e.g. the live deck), then those in `index`. */
export function findSameFront(front: string, cards: Card[], index: FrontIndex): Card[] {
  const key = normalizeFront(front);
  if (!key) return [];
  return [...cards.filter((c) => normalizeFront(c.front) === key), ...(index.get(key) ?? [])];
}
