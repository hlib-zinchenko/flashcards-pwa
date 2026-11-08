import { cleanDeckSpeech, cleanLanguages, DEFAULT_COLLECTION_ID, defaultCollection } from '../collections';
import { isPresetTagId, type Card, type Collection, type Deck, type Level, type Tag } from '../types';

export const BACKUP_APP = 'flashcards-pwa';
/** 2: collections (decks belong to one; reading-aloud languages). 1 files are still read. */
export const SCHEMA_VERSION = 2;

export interface Backup extends Library {
  app: typeof BACKUP_APP;
  /** Version of the file as written; parseBackup keeps it so merging can treat old files differently. */
  schemaVersion: number;
  exportedAt: number;
}

export interface Library {
  collections: Collection[];
  decks: Deck[];
  cards: Card[];
  tags: Tag[];
}

export class BackupError extends Error {}

export function createBackup(lib: Library, now = Date.now()): Backup {
  return { app: BACKUP_APP, schemaVersion: SCHEMA_VERSION, exportedAt: now, ...lib };
}

type Obj = Record<string, unknown>;

const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);
const str = (o: Obj, k: string, what: string): string => {
  if (typeof o[k] !== 'string') throw new BackupError(`${what}: "${k}" must be a string`);
  return o[k] as string;
};
const num = (o: Obj, k: string, fallback: number): number =>
  typeof o[k] === 'number' && Number.isFinite(o[k]) ? (o[k] as number) : fallback;

export interface ParseOptions {
  /** Name for the collection that decks from a version 1 file (before collections) are put in. */
  defaultCollectionName?: string;
}

/** Parse and validate a backup file; missing optional fields get defaults. */
export function parseBackup(text: string, now = Date.now(), opts: ParseOptions = {}): Backup {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new BackupError('Not a valid JSON file');
  }
  if (!isObj(raw) || raw.app !== BACKUP_APP) throw new BackupError('Not a Karbka backup file');
  const version = num(raw, 'schemaVersion', 0);
  if (version < 1 || version > SCHEMA_VERSION) throw new BackupError(`Unsupported backup version: ${version}`);
  if (!Array.isArray(raw.decks) || !Array.isArray(raw.cards) || !Array.isArray(raw.tags)) {
    throw new BackupError('Backup is missing decks, cards or tags');
  }

  const tags: Tag[] = raw.tags.map((t, i) => {
    if (!isObj(t)) throw new BackupError(`Tag #${i + 1} is invalid`);
    const id = str(t, 'id', `Tag #${i + 1}`);
    return { id, name: str(t, 'name', `Tag #${i + 1}`), preset: isPresetTagId(id), createdAt: num(t, 'createdAt', now) };
  });
  const tagIds = new Set(tags.map((t) => t.id));

  // Before version 2 there were no collections: every deck goes into one, with no reading aloud.
  const legacy = version < 2 || !Array.isArray(raw.collections);
  const collections: Collection[] = legacy
    ? raw.decks.length
      ? [defaultCollection(opts.defaultCollectionName ?? 'My decks', now)]
      : []
    : (raw.collections as unknown[]).map((c, i) => {
        const what = `Collection #${i + 1}`;
        if (!isObj(c)) throw new BackupError(`${what} is invalid`);
        return {
          id: str(c, 'id', what),
          name: str(c, 'name', what),
          position: num(c, 'position', i),
          languages: cleanLanguages(c.languages),
          createdAt: num(c, 'createdAt', now),
          updatedAt: num(c, 'updatedAt', now),
        };
      });
  const collectionIds = new Set(collections.map((c) => c.id));

  const decks: Deck[] = raw.decks.map((d, i) => {
    const what = `Deck #${i + 1}`;
    if (!isObj(d)) throw new BackupError(`${what} is invalid`);
    const collectionId = legacy ? DEFAULT_COLLECTION_ID : str(d, 'collectionId', what);
    if (!collectionIds.has(collectionId)) throw new BackupError(`${what} belongs to a collection that is not in the file`);
    const speech = legacy ? undefined : cleanDeckSpeech(d.speech);
    return {
      id: str(d, 'id', what),
      name: str(d, 'name', what),
      collectionId,
      ...(speech ? { speech } : {}),
      position: num(d, 'position', i),
      createdAt: num(d, 'createdAt', now),
      updatedAt: num(d, 'updatedAt', now),
    };
  });
  const deckIds = new Set(decks.map((d) => d.id));

  const cards: Card[] = raw.cards.map((c, i) => {
    const what = `Card #${i + 1}`;
    if (!isObj(c)) throw new BackupError(`${what} is invalid`);
    const deckId = str(c, 'deckId', what);
    if (!deckIds.has(deckId)) throw new BackupError(`${what} belongs to a deck that is not in the file`);
    const level = num(c, 'level', 0);
    const cardTags = Array.isArray(c.tags) ? c.tags.filter((t): t is string => typeof t === 'string') : [];
    return {
      id: str(c, 'id', what),
      deckId,
      front: str(c, 'front', what),
      back: str(c, 'back', what),
      notes: typeof c.notes === 'string' ? c.notes : undefined,
      tags: cardTags.filter((t) => tagIds.has(t) || isPresetTagId(t)),
      position: num(c, 'position', i),
      level: (Number.isInteger(level) && level >= 0 && level <= 5 ? level : 0) as Level,
      timesSeen: num(c, 'timesSeen', 0),
      timesKnown: num(c, 'timesKnown', 0),
      timesMissed: num(c, 'timesMissed', 0),
      lastReviewedAt: typeof c.lastReviewedAt === 'number' ? c.lastReviewedAt : undefined,
      createdAt: num(c, 'createdAt', now),
      updatedAt: num(c, 'updatedAt', now),
    };
  });

  return { app: BACKUP_APP, schemaVersion: version, exportedAt: num(raw, 'exportedAt', now), collections, decks, cards, tags };
}

/**
 * Records to write when merging a backup into the local library.
 * Collections, decks and cards: insert if missing, overwrite if the backup copy is newer.
 * A version 1 file has no collections: its decks keep the collection (and reading aloud) they have
 * here, and only decks new to this device go into the default collection.
 * Tags: keep local ones; a backup tag with the same name as a local tag
 * (different id) is mapped onto the local tag.
 */
export function planMerge(local: Library, incoming: Backup): Library {
  const localTagsById = new Map(local.tags.map((t) => [t.id, t]));
  const localTagsByName = new Map(local.tags.map((t) => [t.name.toLowerCase(), t]));
  const tagRemap = new Map<string, string>();
  const tags: Tag[] = [];
  for (const t of incoming.tags) {
    if (localTagsById.has(t.id)) continue;
    const sameName = localTagsByName.get(t.name.toLowerCase());
    if (sameName) {
      tagRemap.set(t.id, sameName.id);
    } else {
      tags.push(t);
      localTagsByName.set(t.name.toLowerCase(), t);
    }
  }

  const newer = <T extends { id: string; updatedAt: number }>(items: T[], existing: T[]): T[] => {
    const byId = new Map(existing.map((e) => [e.id, e]));
    return items.filter((item) => {
      const cur = byId.get(item.id);
      return !cur || item.updatedAt > cur.updatedAt;
    });
  };

  const remapped = incoming.cards.map((c) => ({
    ...c,
    tags: [...new Set(c.tags.map((t) => tagRemap.get(t) ?? t))],
  }));

  let decks = newer(incoming.decks, local.decks);
  let collections = newer(incoming.collections, local.collections);
  if (incoming.schemaVersion < 2) {
    const localDecks = new Map(local.decks.map((d) => [d.id, d]));
    decks = decks.map((d) => {
      const cur = localDecks.get(d.id);
      return cur ? { ...d, collectionId: cur.collectionId, ...(cur.speech ? { speech: cur.speech } : {}) } : d;
    });
    const hasDefault = local.collections.some((c) => c.id === DEFAULT_COLLECTION_ID);
    const needsDefault = decks.some((d) => d.collectionId === DEFAULT_COLLECTION_ID);
    collections = !hasDefault && needsDefault ? incoming.collections : [];
  }

  return { collections, decks, cards: newer(remapped, local.cards), tags };
}
