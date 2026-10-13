import Dexie, { type EntityTable } from 'dexie';
import { PRESET_TAG_IDS, type Card, type Deck, type Tag } from './types';

export const db = new Dexie('flashcards') as Dexie & {
  decks: EntityTable<Deck, 'id'>;
  cards: EntityTable<Card, 'id'>;
  tags: EntityTable<Tag, 'id'>;
};

db.version(1).stores({
  decks: 'id, position',
  cards: 'id, deckId, [deckId+position], level, *tags',
  tags: 'id, name',
});

export function presetTags(now = Date.now()): Tag[] {
  return PRESET_TAG_IDS.map((id, i) => ({ id, name: id, preset: true, createdAt: now + i }));
}

db.on('populate', (tx) => {
  tx.table('tags').bulkAdd(presetTags());
});

export const newId = (): string => crypto.randomUUID();
