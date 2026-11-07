import { describe, expect, it } from 'vitest';
import { normalizeText, searchCards, searchEntries } from '../src/lib/search';
import { card } from './helpers';

describe('normalizeText', () => {
  it('ignores case, width and extra whitespace', () => {
    expect(normalizeText('  Ｔｏ   EAT ')).toBe('to eat');
    expect(normalizeText('ｶﾀｶﾅ')).toBe('カタカナ');
    expect(normalizeText(' \n ')).toBe('');
  });
});

describe('searchCards', () => {
  const cards = [
    card({ id: 'notes', front: '飲む', back: 'to drink', notes: 'not to eat' }),
    card({ id: 'inside', front: '食べ物', back: 'food to eat' }),
    card({ id: 'starts', front: '食べる', back: 'to eat, to have a meal' }),
    card({ id: 'exact', front: '食う', back: 'To  Eat' }),
    card({ id: 'other', front: '寝る', back: 'to sleep' }),
  ];
  const entries = searchEntries(cards);

  it('finds the query on either side or in notes, the word itself first', () => {
    expect(searchCards(entries, 'to eat').map((c) => c.id)).toEqual(['exact', 'starts', 'notes', 'inside']);
  });

  it('matches the front too', () => {
    expect(searchCards(entries, '食べ').map((c) => c.id)).toEqual(['inside', 'starts']);
  });

  it('finds nothing for an empty or unknown query', () => {
    expect(searchCards(entries, '  ')).toEqual([]);
    expect(searchCards(entries, 'swim')).toEqual([]);
  });
});
