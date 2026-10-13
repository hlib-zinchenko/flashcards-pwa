import { isPresetTagId, type Card, type Deck, type Level, type Tag } from '../types';

export const BACKUP_APP = 'flashcards-pwa';
export const SCHEMA_VERSION = 1;

export interface Backup {
  app: typeof BACKUP_APP;
  schemaVersion: number;
  exportedAt: number;
  decks: Deck[];
  cards: Card[];
  tags: Tag[];
}

export interface Library {
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

/** Parse and validate a backup file; missing optional fields get defaults. */
export function parseBackup(text: string, now = Date.now()): Backup {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new BackupError('Not a valid JSON file');
  }
  if (!isObj(raw) || raw.app !== BACKUP_APP) throw new BackupError('Not a Flashcards backup file');
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

  const decks: Deck[] = raw.decks.map((d, i) => {
    if (!isObj(d)) throw new BackupError(`Deck #${i + 1} is invalid`);
    return {
      id: str(d, 'id', `Deck #${i + 1}`),
      name: str(d, 'name', `Deck #${i + 1}`),
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

  return { app: BACKUP_APP, schemaVersion: version, exportedAt: num(raw, 'exportedAt', now), decks, cards, tags };
}

/**
 * Records to write when merging a backup into the local library.
 * Decks and cards: insert if missing, overwrite if the backup copy is newer.
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

  return { decks: newer(incoming.decks, local.decks), cards: newer(remapped, local.cards), tags };
}
