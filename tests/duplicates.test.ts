import { describe, expect, it } from 'vitest';
import { findSameFront, indexFronts, normalizeFront, sameFront } from '../src/lib/duplicates';
import { card } from './helpers';

describe('sameFront', () => {
  it('ignores case and surrounding or repeated whitespace', () => {
    expect(sameFront('  Кіт ', 'кіт')).toBe(true);
    expect(sameFront('to  eat', 'To eat')).toBe(true);
  });

  it('matches full-width and half-width forms', () => {
    expect(sameFront('ＡＢＣ', 'abc')).toBe(true);
    expect(sameFront('ｶﾀｶﾅ', 'カタカナ')).toBe(true);
  });

  it('tells different words apart', () => {
    expect(sameFront('食べる', '食べ物')).toBe(false);
    expect(sameFront('cat', 'cats')).toBe(false);
  });

  it('never matches empty fronts', () => {
    expect(sameFront('', '')).toBe(false);
    expect(sameFront('  ', '')).toBe(false);
    expect(normalizeFront(' \n ')).toBe('');
  });
});

describe('findSameFront', () => {
  const verbs = [card({ id: 'v1', deckId: 'verbs', front: '食べる', back: 'to eat' }), card({ id: 'v2', deckId: 'verbs', front: '飲む' })];
  const index = indexFronts(verbs);

  it('finds the word in the scanned cards first, then in the index', () => {
    const own = [card({ id: 'n1', deckId: 'food', front: ' 食べる', back: 'eating' })];
    expect(findSameFront('食べる ', own, index).map((c) => c.id)).toEqual(['n1', 'v1']);
  });

  it('finds nothing for a new or empty word', () => {
    expect(findSameFront('寝る', [], index)).toEqual([]);
    expect(findSameFront(' ', verbs, index)).toEqual([]);
  });

  it('leaves cards with an empty front out of the index', () => {
    expect([...indexFronts([card({ front: '' })]).keys()]).toEqual([]);
  });
});
