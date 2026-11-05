import { liveQuery } from 'dexie';
import { db } from './db';

/** Dexie live queries; usable as Svelte stores ($allDecks…). Undefined until loaded. */
export const allCollections = liveQuery(() => db.collections.orderBy('position').toArray());
export const allDecks = liveQuery(() => db.decks.orderBy('position').toArray());
export const allCards = liveQuery(() => db.cards.toArray());
export const allTags = liveQuery(() => db.tags.toArray());
