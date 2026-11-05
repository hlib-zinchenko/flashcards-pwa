import Dexie, { type EntityTable } from 'dexie';
import { defaultCollection } from './collections';
import { t } from './i18n/index.svelte';
import { PRESET_TAG_IDS, type Card, type Collection, type Deck, type Tag } from './types';

export const db = new Dexie('flashcards') as Dexie & {
  decks: EntityTable<Deck, 'id'>;
  cards: EntityTable<Card, 'id'>;
  tags: EntityTable<Tag, 'id'>;
  collections: EntityTable<Collection, 'id'>;
};

db.version(1).stores({
  decks: 'id, position',
  cards: 'id, deckId, [deckId+position], level, *tags',
  tags: 'id, name',
});

// v2: collections. Decks from before go into one collection with no reading-aloud languages.
db.version(2)
  .stores({
    decks: 'id, position, collectionId',
    collections: 'id, position',
  })
  .upgrade(async (tx) => {
    const decks = tx.table<Deck>('decks');
    if ((await decks.count()) === 0) return;
    const collection = defaultCollection(t('collections.defaultName'), Date.now());
    await tx.table<Collection>('collections').add(collection);
    await decks.toCollection().modify((d) => {
      d.collectionId = collection.id;
    });
  });

export function presetTags(now = Date.now()): Tag[] {
  return PRESET_TAG_IDS.map((id, i) => ({ id, name: id, preset: true, createdAt: now + i }));
}

db.on('populate', (tx) => {
  tx.table('tags').bulkAdd(presetTags());
});

export const newId = (): string => crypto.randomUUID();
