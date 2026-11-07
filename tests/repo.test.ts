import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../src/lib/db';
import { addCards, cardsInDecks, DeckFullError, deckCards, deleteCard, gradeCard, resetDeckProgress, restoreGrade, swapCards, updateCard } from '../src/lib/repo/cards';
import { createCollection, deleteCollection, setCollectionLanguages } from '../src/lib/repo/collections';
import { createDeck, deleteDeck, moveDeck, setDeckSpeech, swapDeckSides } from '../src/lib/repo/decks';
import { createTag, deleteTag, renameTag, resolveTagNames, TagExistsError } from '../src/lib/repo/tags';
import { MAX_DECK_CARDS, PRESET_TAG_IDS } from '../src/lib/types';
import { restoreTrash } from '../src/lib/repo/trash';
import { resetDb } from './dbHelpers';

const input = (front: string, tags: string[] = []) => ({ front, back: `${front}-back`, tags });

beforeEach(resetDb);

describe('new database', () => {
  it('has the preset tags and nothing else', async () => {
    expect((await db.tags.toArray()).map((t) => t.id).sort()).toEqual([...PRESET_TAG_IDS].sort());
    expect(await db.collections.count()).toBe(0);
    expect(await db.decks.count()).toBe(0);
  });
});

describe('collections and decks', () => {
  it('appends positions', async () => {
    const k1 = await createCollection(' A ');
    const k2 = await createCollection('B');
    expect((await db.collections.get(k1))!.name).toBe('A');
    expect((await db.collections.get(k2))!.position).toBe(1);
    const d1 = await createDeck('one', k1);
    const d2 = await createDeck('two', k2);
    expect([(await db.decks.get(d1))!.position, (await db.decks.get(d2))!.position]).toEqual([0, 1]);
  });

  it('stores plain language objects without empty voices', async () => {
    const k = await createCollection('A');
    await setCollectionLanguages(k, [{ lang: 'ja-JP', voiceURI: '' }, { lang: 'uk-UA', voiceURI: 'Lesya' }]);
    expect((await db.collections.get(k))!.languages).toEqual([{ lang: 'ja-JP' }, { lang: 'uk-UA', voiceURI: 'Lesya' }]);
  });

  it('deleting a deck deletes its cards only', async () => {
    const k = await createCollection('A');
    const d1 = await createDeck('one', k);
    const d2 = await createDeck('two', k);
    await addCards(d1, [input('a'), input('b')]);
    await addCards(d2, [input('c')]);
    await deleteDeck(d1);
    expect(await db.decks.get(d1)).toBeUndefined();
    expect((await db.cards.toArray()).map((c) => c.front)).toEqual(['c']);
  });

  it('deleting a collection deletes its decks and their cards only', async () => {
    const k1 = await createCollection('A');
    const k2 = await createCollection('B');
    const d1 = await createDeck('one', k1);
    const d2 = await createDeck('two', k2);
    await addCards(d1, [input('a')]);
    await addCards(d2, [input('b')]);
    await deleteCollection(k1);
    expect((await db.collections.toArray()).map((c) => c.id)).toEqual([k2]);
    expect((await db.decks.toArray()).map((d) => d.id)).toEqual([d2]);
    expect((await db.cards.toArray()).map((c) => c.front)).toEqual(['b']);
  });

  it('moves a deck, keeping its cards', async () => {
    const k1 = await createCollection('A');
    const k2 = await createCollection('B');
    const d = await createDeck('one', k1);
    await addCards(d, [input('a')]);
    await moveDeck(d, k2);
    expect((await db.decks.get(d))!.collectionId).toBe(k2);
    expect(await deckCards(d)).toHaveLength(1);
  });

  it('swaps card sides and side languages', async () => {
    const d = await createDeck('one', await createCollection('A'));
    await setDeckSpeech(d, { front: 'ja-JP', back: '' });
    await addCards(d, [input('a')]);
    await swapDeckSides(d);
    expect((await db.decks.get(d))!.speech).toEqual({ back: 'ja-JP' });
    const [c] = await deckCards(d);
    expect([c.front, c.back]).toEqual(['a-back', 'a']);
  });
});

describe('cards', () => {
  let deck: string;
  beforeEach(async () => {
    deck = await createDeck('one', await createCollection('A'));
  });

  it('trims, dedupes tags and keeps adding at the end', async () => {
    await addCards(deck, [{ front: ' a ', back: ' b ', notes: ' n ', tags: ['verb', 'verb'] }]);
    await addCards(deck, [input('x'), input('y')]);
    const cards = await deckCards(deck);
    expect(cards.map((c) => [c.front, c.position])).toEqual([['a', 0], ['x', 1], ['y', 2]]);
    expect(cards[0]).toMatchObject({ back: 'b', notes: 'n', tags: ['verb'], level: 0 });
  });

  it('moving a card to another deck puts it last there', async () => {
    const other = await createDeck('two', (await db.decks.get(deck))!.collectionId);
    await addCards(other, [input('o1'), input('o2')]);
    await addCards(deck, [input('a')]);
    const [a] = await deckCards(deck);
    await updateCard(a.id, { ...input('a2'), deckId: other });
    expect((await deckCards(other)).map((c) => [c.front, c.position])).toEqual([['o1', 0], ['o2', 1], ['a2', 2]]);
    expect(await deckCards(deck)).toEqual([]);
  });

  it('keeps notes when an update leaves them out', async () => {
    await addCards(deck, [{ ...input('a'), notes: 'keep' }]);
    const [a] = await deckCards(deck);
    await updateCard(a.id, input('b'));
    expect((await db.cards.get(a.id))!.notes).toBe('keep');
  });

  it('undoes a delete', async () => {
    await addCards(deck, [input('a')]);
    const [a] = await deckCards(deck);
    const deleted = await deleteCard(a.id);
    expect(await db.cards.count()).toBe(0);
    await restoreTrash(deleted!.id);
    expect(await db.cards.get(a.id)).toEqual(a);
  });

  it('swaps positions', async () => {
    await addCards(deck, [input('a'), input('b')]);
    const [a, b] = await deckCards(deck);
    await swapCards(a, b);
    expect((await deckCards(deck)).map((c) => c.front)).toEqual(['b', 'a']);
  });

  it('grades, undoes a grade and resets progress', async () => {
    await addCards(deck, [input('a')]);
    const [before] = await deckCards(deck);
    const graded = await gradeCard(before.id, true);
    expect(graded).toEqual(await db.cards.get(before.id));
    expect(graded!.timesSeen).toBe(1);
    expect(graded!.lastReviewedAt).toBeTypeOf('number');
    await restoreGrade(before);
    expect(await db.cards.get(before.id)).toEqual(before);

    await gradeCard(before.id, false);
    await resetDeckProgress(deck);
    const reset = (await db.cards.get(before.id))!;
    expect(reset).toMatchObject({ level: 0, timesSeen: 0, timesKnown: 0, timesMissed: 0 });
    expect('lastReviewedAt' in reset).toBe(false);
  });

  it('grading a missing card does nothing', async () => {
    expect(await gradeCard('nope', true)).toBeUndefined();
  });
});

describe('tags', () => {
  it('finds presets by id or translated name', async () => {
    expect((await createTag('Verb')).id).toBe('verb');
    expect((await createTag(' дієслово ')).id).toBe('verb');
    expect(await db.tags.count()).toBe(PRESET_TAG_IDS.length);
  });

  it('creates a custom tag once, case-insensitively', async () => {
    const a = await createTag('N5');
    expect((await createTag('n5')).id).toBe(a.id);
    const ids = await resolveTagNames(['N5', 'n5', 'noun', 'JLPT', '']);
    expect([...ids.keys()]).toEqual(['n5', 'noun', 'jlpt']);
    expect(ids.get('n5')).toBe(a.id);
  });

  it('refuses a rename onto another tag name and leaves presets alone', async () => {
    const a = await createTag('A');
    await createTag('B');
    await expect(renameTag(a.id, 'b')).rejects.toThrow(TagExistsError);
    await renameTag(a.id, 'C');
    expect((await db.tags.get(a.id))!.name).toBe('C');
    await renameTag('verb', 'X');
    await deleteTag('verb');
    expect((await db.tags.get('verb'))!.name).toBe('verb');
  });

  it('deleting a tag removes it from cards', async () => {
    const t = await createTag('N5');
    const d = await createDeck('one', await createCollection('A'));
    await addCards(d, [input('a', [t.id, 'verb']), input('b', [t.id])]);
    await deleteTag(t.id);
    expect((await deckCards(d)).map((c) => c.tags)).toEqual([['verb'], []]);
    expect(await db.tags.get(t.id)).toBeUndefined();
  });
});

describe('deck size limit', () => {
  const many = (n: number) => Array.from({ length: n }, (_, i) => input(`w${i}`));

  it('fills a deck up to MAX_DECK_CARDS and refuses more, all or nothing', async () => {
    const d = await createDeck('one', await createCollection('A'));
    await addCards(d, many(MAX_DECK_CARDS - 2));
    await expect(addCards(d, many(3))).rejects.toEqual(new DeckFullError(2));
    expect(await db.cards.count()).toBe(MAX_DECK_CARDS - 2);
    await addCards(d, many(2));
    await expect(addCards(d, many(1))).rejects.toBeInstanceOf(DeckFullError);
    expect(await db.cards.count()).toBe(MAX_DECK_CARDS);
  });

  it('refuses to move a card into a full deck, but edits in place still work', async () => {
    const k = await createCollection('A');
    const full = await createDeck('full', k);
    const other = await createDeck('other', k);
    await addCards(full, many(MAX_DECK_CARDS));
    await addCards(other, [input('x')]);
    const [x] = await deckCards(other);
    await expect(updateCard(x.id, { ...input('x'), deckId: full })).rejects.toBeInstanceOf(DeckFullError);
    expect((await db.cards.get(x.id))!.deckId).toBe(other);
    const [first] = await deckCards(full);
    await updateCard(first.id, { ...input('edited'), deckId: full });
    expect((await db.cards.get(first.id))!.front).toBe('edited');
  });
});

describe('cardsInDecks', () => {
  it('reads the cards of the given decks only, in deck order', async () => {
    const k = await createCollection('Japanese');
    const nouns = await createDeck('nouns', k);
    const verbs = await createDeck('verbs', k);
    const other = await createDeck('other', await createCollection('Other'));
    await addCards(verbs, [input('食べる'), input('飲む')]);
    await addCards(nouns, [input('猫'), input('犬')]);
    await addCards(other, [input('鳥')]);
    expect((await cardsInDecks([nouns, verbs])).map((c) => c.front)).toEqual(['猫', '犬', '食べる', '飲む']);
    expect(await cardsInDecks([])).toEqual([]);
  });
});
